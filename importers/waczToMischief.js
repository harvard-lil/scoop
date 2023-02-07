import path from 'path'
import { URL } from 'url'
import StreamZip from 'node-stream-zip'
import { Readable } from 'stream'
import { Mischief } from '../Mischief.js'
import { MischiefProxyExchange, MischiefGeneratedExchange } from '../exchanges/index.js'
import { WARCParser } from 'warcio'

/**
 * @function waczToMischief
 * @memberof module:importers
 *
 * @description
 * Reconstructs a Mischief capture from a WACZ
 * containing raw http traffic data.
 *
 * @param {string} zipPath - path to the zipped WACZ
 * @returns {Promise<Mischief>} a reconstructed Mischief capture object
 */
export async function waczToMischief (zipPath) {
  const zip = new StreamZip.async({ file: zipPath }) // eslint-disable-line
  const pageJSON = await getPagesJSON(zip)
  const datapackage = await getDataPackage(zip)

  const capture = new Mischief(pageJSON.url, datapackage.extras?.provenanceInfo?.options)
  Object.assign(capture, {
    id: pageJSON.id,
    startedAt: new Date(pageJSON.ts),
    exchanges: await getExchanges(zip),
    state: Mischief.states.RECONSTRUCTED
  })

  // Only set `provenanceInfo` if available.
  if (datapackage?.extras?.provenanceInfo) {
    capture.provenanceInfo = datapackage?.extras?.provenanceInfo
  }

  await zip.close()
  return capture
}

/**
 * Retrieves the pages.jsonl data from the WARC and parses it
 *
 * @param {StreamZipAsync} zip
 * @returns {object[]} an array of page entry objects
 * @private
 */
const getPagesJSON = async (zip) => {
  const data = await zip.entryData('pages/pages.jsonl')
  return data.toString().split('\n').map(JSON.parse)[1]
}

/**
 * Retrieves the datapackage.json data from the WARC and parses it
 *
 * @param {StreamZipAsync} zip
 * @returns {object} datapackage data
 * @private
 */
const getDataPackage = async (zip) => {
  return JSON.parse(await zip.entryData('datapackage.json'))
}

/**
 * Retrieves the raw requests and responses and initializes
 * them into MischiefProxyExchanges
 *
 * @param {StreamZipAsync} zip
 * @returns {MischiefProxyExchange[]} an array of reconstructed MischiefProxyExchanges
 * @private
 */
const getExchanges = async (zip) => {
  const exchanges = []
  const generatedExchanges = []

  const zipEntries = await zip.entries()
  const zipDirs = Object.keys(zipEntries).reduce((acc, name) => {
    const dir = path.dirname(name)
    acc[dir] ||= []
    acc[dir].push(name)
    return acc
  }, {})

  const warcEntriesByDigest = {}
  const rawPayloadDigests = zipDirs.raw.map(name => path.basename(name).split('_')[3])
    .filter(digest => digest)

  // TODO: does the warc parser need any special handling for GZIPed warcs?
  for (const name of zipDirs.archive) {
    const zipData = await zip.entryData(name)
    const warc = new WARCParser(Readable.from(zipData))

    for await (const record of warc) {
      // get data for rehydrating regular exchanges
      const digest = record.warcHeader('WARC-Payload-Digest')
      if (rawPayloadDigests.includes(digest)) {
        warcEntriesByDigest[digest] = await record.readFully(false)
      }

      // get data for rehydrating generated exchanges
      const url = record.warcHeader('WARC-Target-URI')
      if (url && (new URL(url)).protocol === 'file:') {
        generatedExchanges.push(new MischiefGeneratedExchange({
          url,
          id: record.warcHeaders.headers.get('exchange-id'),
          date: new Date(record.warcHeaders.headers.get('WARC-Date')),
          description: record.warcHeaders.headers.get('description'),
          response: {
            startLine: record.httpHeaders.statusline,
            headers: new Headers(record.getResponseInfo().headers),
            body: await record.readFully(false)
          }
        }))
      }
    }
  }

  let rawProps = await Promise.all(
    zipDirs.raw
      // get the data from the zip and shape it for exchange initialization
      .map(async (name) => {
        const [type, date, id, warcPayloadDigest] = path.basename(name).split('_')
        const buffers = [await zip.entryData(name)]
        // if the file name contains a warc payload digest and there's a matching
        // record from the warc file, append it to the headers
        if (warcEntriesByDigest[warcPayloadDigest]) {
          buffers.push(warcEntriesByDigest[warcPayloadDigest])
        }

        return {
          id,
          date: new Date(date),
          [`${type}Raw`]: Buffer.concat(buffers)
        }
      })
  )

  // sort based on id to order responses next to their requests
  rawProps = rawProps.sort(({ id }, { id: id2 }) => id.localeCompare(id2))

  for (const props of rawProps) {
    const prev = exchanges[exchanges.length - 1]
    if (prev && prev.id === props.id) {
      Object.assign(prev, props)
    } else {
      exchanges.push(new MischiefProxyExchange(props))
    }
  }

  return [...exchanges, ...generatedExchanges]
}

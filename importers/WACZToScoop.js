import path from 'path'
import { URL } from 'url'
import { createServer, request } from 'http'
import { Readable, PassThrough } from 'node:stream'

import { WARCParser } from 'warcio'
import StreamZip from 'node-stream-zip'

import { Scoop } from '../Scoop.js'
import { ScoopProxyExchange, ScoopGeneratedExchange } from '../exchanges/index.js'
import { EXCHANGE_ID_HEADER_LABEL, EXCHANGE_DESCRIPTION_HEADER_LABEL } from '../constants.js'
import { parseRawResourceDate, parseRawResourceDigest } from '../exporters/rawResourceName.js'
import { bodyStartIndex, responseBodyStartIndex } from '../utils/http.js'

const parsers = {
  request: (data) => {
    if (bodyStartIndex(data) === -1) return undefined
    return new Promise(resolve => {
      const stream = new PassThrough()
      stream.once('close', () => resolve(undefined))
      const unsupportedRequest = () => {
        stream.destroy()
        resolve(undefined)
      }
      createServer()
        .once('request', message => {
          message.on('error', () => {})
          resolve(message)
        })
        .once('connect', unsupportedRequest)
        .once('upgrade', unsupportedRequest)
        .once('clientError', unsupportedRequest)
        .emit('connection', stream)
      stream.end(data)
    })
  },
  response: (data) => {
    // An archive is finite: an informational or truncated header block will
    // never acquire a final response. Preserve its raw bytes without metadata.
    if (responseBodyStartIndex(data) === -1) return undefined
    return new Promise(resolve => {
      request({ createConnection: () => new PassThrough() })
        .once('socket', stream => stream.end(data))
        .once('error', () => resolve(undefined))
        .once('upgrade', (_response, stream) => {
          // Upgrade traffic has no ordinary final HTTP response to reconstruct.
          stream.destroy()
          resolve(undefined)
        })
        .once('response', response => {
          // Truncated payloads can emit an error after headers were parsed.
          response.on('error', () => {})
          resolve(response)
        })
    })
  }
}

/**
 * (Experimental) Reconstructs a Scoop capture from a WACZ containing raw http traffic data.
 * @param {string} zipPath - path to the zipped WACZ
 * @returns {Promise<Scoop>} a reconstructed Scoop capture object
 */
export async function WACZToScoop (zipPath) {
  const zip = new StreamZip.async({ file: zipPath }) // eslint-disable-line
  try {
    const datapackage = await getDataPackage(zip)
    // Archived options describe the original capture; they are not trusted runtime configuration.
    const capture = Scoop.fromArchive(datapackage.mainPageUrl)

    Object.assign(capture, {
      // TODO: id assignment was skipped during the transition to js-wacz. To reconsider?
      startedAt: new Date(datapackage.mainPageDate),
      exchanges: await getExchanges(zip, capture.log),
      state: Scoop.states.RECONSTRUCTED
    })

    // Only set `provenanceInfo` if available.
    if (datapackage?.extras?.provenanceInfo) {
      capture.provenanceInfo = datapackage?.extras?.provenanceInfo
    }

    return capture
  } finally {
    await zip.close()
  }
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
 * them into ScoopProxyExchanges
 *
 * @param {StreamZipAsync} zip
 * @param {object} log - Capture logger
 * @returns {ScoopProxyExchange[]} an array of reconstructed ScoopProxyExchanges
 * @private
 */
const getExchanges = async (zip, log) => {
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
  const rawPayloadDigests = new Set(zipDirs.raw.map(parseRawResourceDigest).filter(Boolean))

  for (const name of zipDirs.archive) {
    const zipData = await zip.entryData(name)
    const warc = new WARCParser(Readable.from(zipData))

    for await (const record of warc) {
      // Get data for rehydrating regular exchanges
      const digest = record.warcHeader('WARC-Payload-Digest')
      if (rawPayloadDigests.has(digest)) {
        warcEntriesByDigest[digest] = Buffer.from(await record.readFully(false))
      }

      // Get data for rehydrating generated exchanges
      const url = record.warcHeader('WARC-Target-URI')
      if (url && (new URL(url)).protocol === 'file:') {
        generatedExchanges.push(new ScoopGeneratedExchange({
          url,
          id: record.warcHeaders.headers.get(EXCHANGE_ID_HEADER_LABEL),
          date: new Date(record.warcHeaders.headers.get('WARC-Date')),
          description: record.warcHeaders.headers.get(EXCHANGE_DESCRIPTION_HEADER_LABEL),
          response: {
            startLine: record.httpHeaders.statusline,
            headers: new Headers(record.getResponseInfo().headers),
            body: Buffer.from(await record.readFully(false))
          }
        }))
      }
    }
  }

  let rawProps = await Promise.all(
    zipDirs.raw
      // get the data from the zip and shape it for exchange initialization
      .map(async (name) => {
        const [type, date, id] = path.basename(name).split('_')
        const warcPayloadDigest = parseRawResourceDigest(name)
        const buffers = [await zip.entryData(name)]
        // if the file name contains a warc payload digest and there's a matching
        // record from the warc file, append it to the headers
        const missingPayload = warcPayloadDigest && !warcEntriesByDigest[warcPayloadDigest]
        if (missingPayload) {
          log.warn(`Missing WARC payload for ${name}; preserving the available raw bytes without parsed metadata.`)
        } else if (warcPayloadDigest) {
          buffers.push(warcEntriesByDigest[warcPayloadDigest])
        }

        const combined = Buffer.concat(buffers)
        const parsed = missingPayload ? undefined : await parsers[type](combined)

        return {
          id,
          date: parseRawResourceDate(date),
          [`${type}Raw`]: combined,
          ...(parsed ? { [`${type}Parsed`]: parsed } : {})
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
      exchanges.push(new ScoopProxyExchange(props))
    }
  }

  return [...exchanges, ...generatedExchanges]
}

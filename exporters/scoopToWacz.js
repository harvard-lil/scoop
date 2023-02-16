import { Readable } from 'stream'

import { getHead } from '../utils/http.js'
import { Scoop } from '../Scoop.js'
import { WACZ, scoopExchangeToPageLine, hash } from '../utils/WACZ.js'
import { WARCParser } from 'warcio'

/**
 * @function scoopToWacz
 * @memberof module:exporters
 *
 * @description
 * Scoop capture to WACZ converter.
 *
 * Note:
 * - Logs are added to capture object via `Scoop.log`.
 *
 * @param {Scoop} capture
 * @param {boolean} [includeRaw=false] - If `true`, includes the raw http exchanges in the WACZ.
 * @param {object} signingServer - Optional server information for signing the WACZ
 * @param {string} signingServer.url - url of the signing server
 * @param {string} signingServer.token - Optional token to be passed to the signing server via the Authorization header
 * @returns {Promise<ArrayBuffer>}
 */
export async function scoopToWacz (capture, includeRaw = false, signingServer) {
  const validStates = [Scoop.states.PARTIAL, Scoop.states.COMPLETE]

  if (!(capture instanceof Scoop) || !validStates.includes(capture.state)) {
    throw new Error('`capture` must be a partial or complete Scoop object.')
  }

  const wacz = new WACZ({ signingServer })

  // Append WARC
  const warc = Buffer.from(await capture.toWarc())
  wacz.files['archive/data.warc'] = warc

  // Append extra `datapackage.json` info:
  if (capture.options.provenanceSummary && capture.provenanceInfo) {
    wacz.datapackageExtras = { provenanceInfo: capture.provenanceInfo }
  }

  // Append raw exchanges
  if (includeRaw) {
    const parser = new WARCParser(Readable.from(warc))
    const warcPayloadDigests = []
    // compiles a list of payload digests to match against below
    for await (const record of parser) {
      const digest = record.warcHeader('WARC-Payload-Digest')
      if (digest) {
        warcPayloadDigests.push(digest)
      }
    }

    capture.exchanges.forEach((exchange) => {
      ['request', 'response'].forEach((type) => {
        const data = exchange[`${type}Raw`]
        if (data) {
          const fpath = `raw/${type}_${exchange.date.toISOString()}_${exchange.id}`
          const digest = exchange[type].body.length ? hash(exchange[type].body) : null
          // if the WARC contains identical body data, remove it from this raw exchange
          // to avoid data bloat and add the digest to the end of the file name for later retrieval
          if (warcPayloadDigests.includes(digest)) {
            // add only the head and trailing CRLF
            wacz.files[`${fpath}_${digest}`] = getHead(data)
          } else {
            wacz.files[fpath] = data
          }
        }
      })
    })
  }

  // Generate entry points (exchanges added to `pages.jsonl`).
  const firstExchange = capture.exchanges[0]
  wacz.pages = capture.exchanges
    .filter((ex) => ex === firstExchange || ex.isEntryPoint)
    .map(scoopExchangeToPageLine)

  return await wacz.finalize()
}

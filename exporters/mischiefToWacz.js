/**
 * Mischief
 * @module exporters.mischiefToWacz
 * @author The Harvard Library Innovation Lab
 * @license MIT
 * @description Mischief to WACZ exporter.
 */
import { Readable } from 'stream'

import { Mischief } from '../Mischief.js'
import { WACZ, mischiefExchangeToPageLine, hash } from '../utils/WACZ.js'
import { WARCParser } from 'warcio'

/**
 * Mischief capture to WACZ converter.
 *
 * Note:
 * - Logs are added to capture object via `Mischief.log`.
 *
 * @param {Mischief} capture
 * @param {boolean} [includeRaw=false] - If `true`, includes the raw http exchanges in the WACZ.
 * @param {boolean|object} [sign=false] -
 * @returns {Promise<ArrayBuffer>}
 */
export async function mischiefToWacz (capture, includeRaw = false, sign = false) {
  const validStates = [Mischief.states.PARTIAL, Mischief.states.COMPLETE]

  if (!(capture instanceof Mischief) || !validStates.includes(capture.state)) {
    throw new Error('`capture` must be a partial or complete Mischief object.')
  }

  const wacz = new WACZ()

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
            // add only the headers along with trailing CRLF
            wacz.files[`${fpath}_${digest}`] = exchange[`${type}RawHeaders`]
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
    .map(mischiefExchangeToPageLine)

  return await wacz.finalize(sign)
}

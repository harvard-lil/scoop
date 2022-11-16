/**
 * Mischief
 * @module exporters.mischiefToWacz
 * @author The Harvard Library Innovation Lab
 * @license MIT
 * @description Mischief to WACZ exporter.
 */
import { Readable } from "stream";

import { Mischief } from "../Mischief.js";
import { WACZ, mischiefExchangeToPageLine, hash } from "../utils/WACZ.js";
import { WARCParser } from "warcio";

/**
 * Mischief capture to WACZ converter.
 *
 * Note:
 * - Logs are added to capture object via `Mischief.addToLogs()`.
 *
 * @param {Mischief} capture
 * @param {boolean} includeRaw - If `true`, includes the raw http exchanges in the WACZ.
 * @returns {Promise<ArrayBuffer>}
 */
export async function mischiefToWacz(capture, includeRaw = false) {
  const validStates = [Mischief.states.PARTIAL, Mischief.states.COMPLETE];

  if (!(capture instanceof Mischief) || !validStates.includes(capture.state)) {
    throw new Error("`capture` must be a partial or complete Mischief object.");
  }

  const wacz = new WACZ();

  // Append WARC
  const warc = Buffer.from(await capture.toWarc());
  wacz.files['archive/data.warc'] = warc;

  // Append extra `datapackage.json` info:
  if (capture.options.provenanceSummary && capture.provenanceInfo) {
    wacz.datapackageExtras = {"provenanceInfo": capture.provenanceInfo};
  }

  // Append raw exchanges
  if (includeRaw) {
    const parser = new WARCParser(Readable.from(warc));
    const warcPayloadDigests = [];
    // compiles a list of payload digests to match against below
    for await (const record of parser) {
      const digest = record.warcHeader('WARC-Payload-Digest');
      if(digest){
        warcPayloadDigests.push(digest);
      }
    }

    capture.exchanges.forEach((exchange) => {
      ['request', 'response'].forEach((type) => {
        const data = exchange[`${type}Raw`];
        if (data) {
          const fpath = `raw/${type}_${exchange.date.toISOString()}_${exchange.id}`;
          const digest = exchange[type].body.length ? hash(exchange[type].body) : null;
          // if the WARC contains identical body data, remove it from this raw exchange
          // to avoid data bloat and add the digest to the end of the file name for later retrieval
          if(warcPayloadDigests.includes(digest)){
            // identify the offset where the body begins based on the CRLF delimiter
            const headerBodyCRLF = data.indexOf("\r\n\r\n")+4;
            // add only the headers along with trailing CRLF
            wacz.files[`${fpath}_${digest}`] = data.subarray(0, headerBodyCRLF);
          }
          else {
            wacz.files[fpath] = data;
          }
        }
      })
    })
  }

  // Generate entry points (exchanges added to `pages.jsonl`).
  let entryPoints = [];

  if (capture.exchanges.length > 0) {
    entryPoints.push(capture.exchanges[0]); // the first exchange is our entrypoint url for the entire crawl
  }

  for (let exchange of Object.values(capture.generatedExchanges)) {
    if (exchange?.isEntryPoint && exchange.isEntryPoint === true) {
      entryPoints.push(exchange);
    }
  }

  wacz.pages = entryPoints.map(mischiefExchangeToPageLine)

  return await wacz.finalize();
}

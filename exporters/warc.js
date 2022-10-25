/**
 * Mischief
 * @module exporters.warc
 * @author The Harvard Library Innovation Lab
 * @license MIT
 * @description Mischief to WARC exporter.
 */

import crypto from "crypto"; // warcio needs the crypto utils suite but does not import it.
global.crypto = crypto;

import { WARCRecord, WARCSerializer } from "warcio";
import { baseRules as baseDSRules } from "@webrecorder/wabac/src/rewrite/index.js";
import { rewriteDASH, rewriteHLS } from "@webrecorder/wabac/src/rewrite/rewriteVideo.js";
import { decodeResponse } from "@webrecorder/wabac/src/rewrite/decoder.js";
import { ArchiveResponse } from "@webrecorder/wabac/src/response.js";

import { HTTPParser } from "../parsers/http.js";
import { Mischief } from "../Mischief.js";
import { MischiefExchange } from "../MischiefExchange.js";

/**
 * WARC version to be used. 
 * @constant
 */
const WARC_VERSION = "WARC/1.1";

/**
 * Software version to be 
 * @constant
 */
const SOFTWARE = "Mischief @ Harvard Library Innovation Lab - (DEV)";

/**
 * Mischief capture to WARC converter.
 * 
 * Note:
 * - Logs are added to capture object via `Mischief.addToLogs()`. 
 * 
 * @param {Mischief} capture
 * @param {Boolean} [optimizeForPlayback=true] - If `true`, will apply wabac.js' rewrite rules to responses to help with playback of videos and other edge cases. 
 * @returns {Promise<ArrayBuffer>}
 */
export async function warc(capture, optimizeForPlayback=true) {
  let serializedInfo = null;
  const serializedRecords = [];
  const validStates = [Mischief.states.PARTIAL, Mischief.states.COMPLETE];

  // Check capture state
  if (!(capture instanceof Mischief) || !validStates.includes(capture.state)) {
    throw new Error("`capture` must be a partial or complete Mischief capture object.");
  }

  //
  // Prepare WARC info section
  //
  const info = WARCRecord.createWARCInfo(
    { filename: "archive.warc", warcVersion: WARC_VERSION },
    { software: SOFTWARE }
  );
  serializedInfo = await WARCSerializer.serialize(info);
  
  //
  // Prepare WARC records section
  //
  for (const exchange of capture.exchanges.filter((ex) => ex.response)) {
    for (const type of ['request', 'response']) {

      if(!exchange[type]) continue;

      try {
        const statusLine = prepareExchangeStatusLine(exchange, type);
        let httpHeaders = HTTPParser.headersToMap(exchange[type].headers);
        let body = exchange[type].body;

        // Apply playback optimization (optional)
        if (type === "response" && optimizeForPlayback === true) {
          const rewrite = await optimizeResponseForPlayback(exchange.url, body, httpHeaders);
          body = rewrite.body;
          httpHeaders = rewrite.httpHeaders;

          if (rewrite.modified) {
            capture.addToLogs(`Response to ${exchange.url} was rewritten (playback optimization).`);
          }
        }

        async function* content() {
          if (body instanceof Buffer || body instanceof Uint8Array) {
            yield body;
          }
          else {
            throw new Error(`"body" must be of type "Buffer" (or compatible).`);
          }
        }

        const record = WARCRecord.create(
          {
            url: exchange.url,
            date: exchange.date.toISOString(),
            type: type,
            warcVersion: WARC_VERSION,
            statusline: statusLine,
            httpHeaders: httpHeaders,
            keepHeadersCase: false,
          },
          content()
        );

        serializedRecords.push(await WARCSerializer.serialize(record));
      }
      catch(err) {
        capture.addToLogs(`${exchange.url} ${type} could not be added to warc.`, true, err);
      }
    }
  }

  //
  // Combine output and return as ArrayBuffer
  //
  return new Blob([serializedInfo, ...serializedRecords]).arrayBuffer();
}

/**
 * [WORK IN PROGRESS] 
 * Playback optimization: applies rewriting logic from wabac.js to a given response. 
 * 
 * Rewritten responses are returned uncompressed, meaning:
 * - `body` will be uncompressed text
 * - `Content-Length`, `Content-Encoding` / `Transfer-Encoding` headers will be altered.
 * 
 * Headers that were modified will be copied as such:
 * - "Content-Length": 1024 <- Altered header
 * - "X-Mischief-Original-Content-Length": 512 <- Original value
 * 
 * Reference:
 * - https://github.com/webrecorder/archiveweb.page/blob/main/src/recorder.js#L952
 * 
 * @param {String} url 
 * @param {Buffer} body 
 * @param {Object} httpHeaders 
 * @returns {{url: String, body: Buffer, httpHeaders: Object, modified: Boolean}} - Rewritten response
 */
async function optimizeResponseForPlayback(url, body, httpHeaders) {
  let contentType = null;
  let contentEncoding = null;
  let transferEncoding = null;

  let bodyToStringBefore = null;
  let bodyToStringAfter = null;

  const rewrite = {
    url: url,
    body: body,
    httpHeaders: structuredClone(httpHeaders),
    modified: false
  };

  // Ignore empty responses
  if (body.byteLength === 0) {
    return rewrite;
  }

  // Pull `contentType`, `contentEncoding` and `transferEncoding` from headers.
  for (let [key, value] of Object.entries(httpHeaders)) {
    key = key.toLowerCase();

    switch (key) {
      case "content-type":
        contentType = value.split(";")[0];
      break;

      case "content-encoding":
        contentEncoding = value;
      break;

      case "transfer-encoding":
        transferEncoding = value;
      break;
    }
  }

  // Apply wabac.js' response rewriting based on content-type.
  // Reference: https://github.com/webrecorder/archiveweb.page/blob/main/src/recorder.js#L968
  switch (contentType) {
    case "application/x-mpegURL":
    case "application/vnd.apple.mpegurl":
      bodyToStringBefore = await inflateBody(body, httpHeaders, url, contentEncoding, transferEncoding);
      bodyToStringAfter = rewriteHLS(bodyToStringBefore, {save: {}});
    break;

    case "application/dash+xml":
      bodyToStringBefore = await inflateBody(body, httpHeaders, url, contentEncoding, transferEncoding);
      bodyToStringAfter = rewriteDASH(bodyToStringBefore, {save: {}});
    break;

    case "text/html":
    case "application/json":
    case "text/javascript":
    case "application/javascript":
    case "application/x-javascript": 
      const rw = baseDSRules.getRewriter(url);

      if (rw !== baseDSRules.defaultRewriter) {
        bodyToStringBefore = await inflateBody(body, httpHeaders, url, contentEncoding, transferEncoding);
        bodyToStringAfter = await rw.rewrite(bodyToStringBefore, {live: true, save: {}});
      }
    break;
  }

  // Process rewritten response, if any: encode body, apply header modifications.
  if (bodyToStringAfter && bodyToStringBefore !== bodyToStringAfter) {
    rewrite.modified = true;

    for (let headerToDelete of ["Content-Encoding", "Transfer-Encoding", "Content-Length"]) {
      delete rewrite.httpHeaders[headerToDelete];
      delete rewrite.httpHeaders[headerToDelete.toLowerCase()];
    }

    rewrite.httpHeaders["X-Mischief-Original-Content-Length"] = `${body.byteLength}`;

    if (contentEncoding) {
      rewrite.httpHeaders["X-Mischief-Original-Content-Encoding"] = contentEncoding;
    }

    if (transferEncoding) {
      rewrite.httpHeaders["X-Mischief-Original-Transfer-Encoding"] = transferEncoding;
    }

    rewrite.body = new TextEncoder("utf-8").encode(bodyToStringAfter);
    rewrite.httpHeaders["Content-Length"] = `${rewrite.body.byteLength}`;
  }

  return rewrite;
}

/**
 * Inflates gzip, br, deflate bodies using wabac.js's `decodeResponse()` before attempting to rewrite them.
 * @param {Buffer} body 
 * @param {Object} httpHeaders 
 * @param {String} url 
 * @param {?String} contentEncoding 
 * @param {?String} transferEncoding 
 * @returns {String} - Decompressed and decoded response body.
 */
async function inflateBody(body, httpHeaders, url, contentEncoding, transferEncoding) {
  const response = new ArchiveResponse({
    payload: body,
    status: 200,
    statusText: "200 OK",
    headers: httpHeaders,
    url: url,
    date: new Date().toISOString(),
    noRW: true,
    isLive: false,
  });

  const decodedResponse = await decodeResponse(response, contentEncoding, transferEncoding, null);
  return await decodedResponse.getText();
}

/**
 * Prepares an HTTP status line string for a given MischiefExchange.
 * 
 * Warcio expects the method to be prepended to the request statusLine.
 * Reference:
 * - https://github.com/webrecorder/pywb/pull/636#issue-869181282
 * - https://github.com/webrecorder/warcio.js/blob/d5dcaec38ffb0a905fd7151273302c5f478fe5d9/src/statusandheaders.js#L69-L74
 * - https://github.com/webrecorder/warcio.js/blob/fdb68450e2e011df24129bac19691073ab6b2417/test/testSerializer.js#L212
 * 
 * @param {MischiefExchange} exchange 
 * @param {String} [type="response"] 
 * @returns {String}
 */
function prepareExchangeStatusLine(exchange, type = "response") {
  let statusLine = ``;

  switch(type) {
    case "request":
      statusLine = `${exchange.request.method} ${exchange.url} HTTP/${exchange.request.versionMajor}.${exchange.request.versionMinor}`;
    break;

    case "response":
    default:
      statusLine = `HTTP/${exchange.response.versionMajor}.${exchange.response.versionMinor} ${exchange.response.statusCode} ${exchange.response.statusMessage}`;
    break;
  }

  return statusLine;
}

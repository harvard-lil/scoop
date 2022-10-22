import crypto from "crypto"; // warcio needs the crypto utils suite but does not import it.
global.crypto = crypto;

import { WARCRecord, WARCSerializer } from "warcio";
import { baseRules as baseDSRules } from "@webrecorder/wabac/src/rewrite/index.js";
import { rewriteDASH, rewriteHLS } from "@webrecorder/wabac/src/rewrite/rewriteVideo.js";

import { Mischief } from "../Mischief.js";

/**
 * Mischief to WARC converter.
 * 
 * Note:
 * - Logs are added to capture object via `Mischief.addToLogs()`. 
 * 
 * @param {Mischief} capture
 * @param {Boolean} [gzip=false] 
 * @param {Boolean} [optimizeForPlayback=true] - If `true`, will apply wabac.js' rewrite rules to responses to help with playback of videos and other edge cases. 
 * @returns {Promise<ArrayBuffer>}
 */
export async function warc(capture, gzip=false, optimizeForPlayback=true) {
  const warcVersion = "WARC/1.1";
  gzip = Boolean(gzip);
  let serializedInfo = null;
  const serializedRecords = [];
  const filename = `archive${gzip ? ".warc.gz" : ".warc"}`;

  const validStates = [Mischief.states.PARTIAL, Mischief.states.COMPLETE];
  if (!(capture instanceof Mischief) || !validStates.includes(capture.state)) {
    throw new Error("`capture` must be a partial or complete Mischief object.");
  }

  //
  // Prepare WARC info section
  //
  const info = WARCRecord.createWARCInfo(
    { filename, warcVersion },
    { software: "LIL Mischief DEV" }
  );
  serializedInfo = await WARCSerializer.serialize(info, {gzip});
  
  //
  // Prepare WARC records section
  //
  for (const exchange of capture.exchanges.filter((ex) => ex.response)) {
    for (const type of ['request', 'response']) {
      if(!exchange[type]) continue;
      try {
        const statusLine = prepareExchangeStatusLine(exchange, type);

        async function* content() {
          let body = exchange[type].body;

          if (type === "response" && optimizeForPlayback === true) {
            body = await optimizeResponseBodyForPlayback(exchange.url, body, exchange[type].headers);
          }

          yield new Uint8Array(body);
        }

        const record = WARCRecord.create(
          {
            url: exchange[type].url,
            date: exchange.date.toISOString(),
            type: type,
            warcVersion: warcVersion,
            statusline: statusLine,
            httpHeaders: exchange[type].headers,
            keepHeadersCase: false,
          },
          content()
        );

        serializedRecords.push(await WARCSerializer.serialize(record, {gzip}));
      }
      catch(err) {
        capture.addToLogs(`${exchange[type].url} ${type} could not be added to warc.`, true, err);
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
 * Applies rewriting logic from wabac.js to a given response. 
 * 
 * TODO: Figure out why `bodyToStringBefore` is always equal to `bodyToStringAfter`.
 * 
 * Reference:
 * - https://github.com/webrecorder/archiveweb.page/blob/main/src/recorder.js#L952
 * 
 * @param {String} url 
 * @param {Buffer} body 
 * @param {Object} httpHeaders 
 * @returns {Buffer|Uint8Array}
 */
async function optimizeResponseBodyForPlayback(url, body, httpHeaders) {
  let contentType = ""; 
  let bodyToStringBefore = null;
  let bodyToStringAfter = null;

  // Ignore empty responses
  if (body.byteLength === 0) {
    return body;
  }

  // Assert content-type from headers
  for (let [key, value] of Object.entries(httpHeaders)) {
    if (key.toLowerCase() !== "content-type") { 
      continue;
    }

    contentType = value.split(";")[0];
  }

  if (!contentType) {
    return body;
  }

  // Apply wabac.js rewriting based on content-type
  // Reference: https://github.com/webrecorder/archiveweb.page/blob/main/src/recorder.js#L968
  switch (contentType) {
    case "application/x-mpegURL":
    case "application/vnd.apple.mpegurl":
      bodyToStringBefore = body.toString("utf-8");
      bodyToStringAfter = rewriteHLS(bodyToStringBefore, {save: {}});
    break;

    case "application/dash+xml":
      bodyToStringBefore = body.toString("utf-8");
      bodyToStringAfter = rewriteDASH(bodyToStringBefore, {save: {}});
    break;

    case "text/html":
    case "application/json":
    case "text/javascript":
    case "application/javascript":
    case "application/x-javascript": 
      const rw = baseDSRules.getRewriter(url);

      if (rw !== baseDSRules.defaultRewriter) {
        bodyToStringBefore = body.toString("utf-8");
        bodyToStringAfter = await rw.rewrite(bodyToStringBefore, {live: true, save: {}});
      }
    break;
  }

  // Return body as is if no rewriting was done
  if (!bodyToStringAfter) {
    return body;
  }

  // Return altered body if rewriting affected it
  if (bodyToStringBefore !== bodyToStringAfter) {
    const encoder = new TextEncoder("utf-8");
    body = encoder.encode(bodyToStringAfter);
  }

  return body;
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

/**
 * Mischief
 * @module parsers.MischiefHTTPParser
 * @author The Harvard Library Innovation Lab
 * @license MIT
 * @description Utility class for parsing intercepted HTTP exchanges.
 */
import zlib from 'node:zlib'
import { HTTPParser as _HTTPParser } from 'http-parser-js'

/**
 * Via: https://github.com/creationix/http-parser-js/blob/master/standalone-example.js
 */
export class MischiefHTTPParser {
  static headersToMap (headers) {
    return Object.fromEntries(
      headers.reduce(
        (result, value, index, sourceArray) =>
          index % 2 === 0 ? [...result, sourceArray.slice(index, index + 2)] : result,
        []
      )
    )
  }

  static parseRequest (input) {
    const parser = new _HTTPParser(_HTTPParser.REQUEST)
    let complete = false
    let shouldKeepAlive
    let upgrade
    let method
    let url
    let versionMajor
    let versionMinor
    let headers = []
    let trailers = []
    const bodyChunks = []

    parser[_HTTPParser.kOnHeadersComplete] = function (req) {
      shouldKeepAlive = req.shouldKeepAlive
      upgrade = req.upgrade
      method = _HTTPParser.methods[req.method]
      url = req.url
      versionMajor = req.versionMajor
      versionMinor = req.versionMinor
      headers = req.headers
    }

    parser[_HTTPParser.kOnBody] = function (chunk, offset, length) {
      bodyChunks.push(chunk.slice(offset, offset + length))
    }

    // This is actually the event for trailers, go figure.
    parser[_HTTPParser.kOnHeaders] = function (t) {
      trailers = t
    }

    parser[_HTTPParser.kOnMessageComplete] = function () {
      complete = true
    }

    // Since we are sending the entire Buffer at once here all callbacks above happen synchronously.
    // The parser does not do _anything_ asynchronous.
    // However, you can of course call execute() multiple times with multiple chunks, e.g. from a stream.
    // But then you have to refactor the entire logic to be async (e.g. resolve a Promise in kOnMessageComplete and add timeout logic).
    parser.execute(input)
    parser.finish()

    if (!complete) {
      throw new Error('Could not parse request')
    }

    const body = Buffer.concat(bodyChunks)

    return {
      shouldKeepAlive,
      upgrade,
      method,
      url,
      versionMajor,
      versionMinor,
      headers,
      body,
      trailers
    }
  }

  /**
   *
   * @param {*} input
   * @returns {MischiefHTTPParserResponse}
   */
  static parseResponse (input) {
    const parser = new _HTTPParser(_HTTPParser.RESPONSE)
    let complete = false // eslint-disable-line
    let shouldKeepAlive
    let upgrade
    let statusCode
    let statusMessage
    let versionMajor
    let versionMinor
    let headers = []
    let trailers = []
    const bodyChunks = []

    parser[_HTTPParser.kOnHeadersComplete] = function (res) {
      shouldKeepAlive = res.shouldKeepAlive
      upgrade = res.upgrade
      statusCode = res.statusCode
      statusMessage = res.statusMessage
      versionMajor = res.versionMajor
      versionMinor = res.versionMinor
      headers = res.headers
    }

    parser[_HTTPParser.kOnBody] = function (chunk, offset, length) {
      bodyChunks.push(chunk.slice(offset, offset + length))
    }

    // This is actually the event for trailers, go figure.
    parser[_HTTPParser.kOnHeaders] = function (t) {
      trailers = t
    }

    parser[_HTTPParser.kOnMessageComplete] = function () {
      complete = true
    }

    // Since we are sending the entire Buffer at once here all callbacks above happen synchronously.
    // The parser does not do _anything_ asynchronous.
    // However, you can of course call execute() multiple times with multiple chunks, e.g. from a stream.
    // But then you have to refactor the entire logic to be async (e.g. resolve a Promise in kOnMessageComplete and add timeout logic).
    parser.execute(input)
    parser.finish()

    const body = Buffer.concat(bodyChunks)

    return {
      shouldKeepAlive,
      upgrade,
      statusCode,
      statusMessage,
      versionMajor,
      versionMinor,
      headers,
      body,
      trailers
    }
  }
}

/**
 * Locates the beginning of an HTTP response body
 *
 * The HTTP spec requires an empty line
 * with a CRLF (\r\n) before the body starts, but apparently
 * some poorly configured servers only use LF (\n) so we
 * look for the first pair we can find.
 *
 * Ref: https://stackoverflow.com/a/11254057
 *
 * @param {Buffer} buffer -
 * @returns {integer} -
 */
const CRLFx2 = '\r\n\r\n'
const LFx2 = '\n\n'
export function bodyStartIndex (buffer) {
  return [CRLFx2, LFx2].reduce((prevEnd, delimiter) => {
    const start = buffer.indexOf(delimiter)
    const end = start + delimiter.length
    return (start !== -1 && (prevEnd === -1 || end < prevEnd)) ? end : prevEnd
  }, -1)
}

/**
 * Extracts the protocol version from an HTTP status line
 *
 * @param {string} statusLine -
 * @returns {array} -
 */
export function versionFromStatusLine (statusLine) {
  return statusLine.match(/\/([\d.]+)/)[1].split('.').map(n => parseInt(n))
}

/**
 * Utility for turning an HTTP body into a string.
 * Handles "deflate", "gzip" and "br" decompression.
 *
 * @param {Buffer} body
 * @param {?string} [contentEncoding=null] - Can be "br", "deflate" or "gzip"
 * @returns {string}
 */
export function bodyToString (body, contentEncoding = null) {
  switch (contentEncoding) {
    case 'deflate':
      body = zlib.inflateSync(body, { finishFlush: zlib.constants.Z_SYNC_FLUSH })
      break

    case 'gzip':
      body = zlib.gunzipSync(body, { finishFlush: zlib.constants.Z_SYNC_FLUSH })
      break

    case 'br':
      body = zlib.brotliDecompressSync(body, { finishFlush: zlib.constants.BROTLI_OPERATION_FLUSH })
      break
  }

  return body.toString('utf-8')
}

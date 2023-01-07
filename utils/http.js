/**
 * Mischief
 * @module utils.http
 * @description Helper functions for working with raw HTTP exchanges.
 * @private
 */

import zlib from 'node:zlib'
import { promisify } from 'util'

const inflate = promisify(zlib.inflate)
const gunzip = promisify(zlib.gunzip)
const brotliDecompress = promisify(zlib.brotliDecompress)

const CRLFx2 = '\r\n\r\n'
const LFx2 = '\n\n'

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
export async function bodyToString (body, contentEncoding = null) {
  switch (contentEncoding) {
    case 'deflate':
      body = await inflate(body, { finishFlush: zlib.constants.Z_SYNC_FLUSH })
      break

    case 'gzip':
      body = await gunzip(body, { finishFlush: zlib.constants.Z_SYNC_FLUSH })
      break

    case 'br':
      body = await brotliDecompress(body, { finishFlush: zlib.constants.BROTLI_OPERATION_FLUSH })
      break
  }

  return body.toString('utf-8')
}

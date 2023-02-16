import zlib from 'node:zlib'
import { promisify } from 'util'

const inflate = promisify(zlib.inflate)
const gunzip = promisify(zlib.gunzip)
const brotliDecompress = promisify(zlib.brotliDecompress)

const CRLF = '\r\n'
const LF = '\n'

/**
 *
 * @param {any} searchItems -
 * @param {any} buffer -
 * @returns {any} -
 */
function firstIndexOf (searchItems, buffer, getIndexAfter = false) {
  return searchItems.reduce((prevEnd, delimiter) => {
    const start = buffer.indexOf(delimiter)
    const end = start + (getIndexAfter ? delimiter.length : 0)
    return (start !== -1 && (prevEnd === -1 || end < prevEnd)) ? end : prevEnd
  }, -1)
}

/**
 * Locates the beginning of an HTTP response body
 *
 * The HTTP spec requires an empty line
 * with a CRLF (\r\n) before the body starts, but apparently
 * some poorly configured servers only use LF (\n) so we
 * look for the first pair we can find.
 *
 * @see {@link https://stackoverflow.com/a/11254057}
 *
 * @param {Buffer} buffer - The contents of an HTTP response
 * @returns {integer} The index within the buffer at which the body begins
 */
export function bodyStartIndex (buffer) {
  return firstIndexOf([CRLF + CRLF, LF + LF], buffer, true)
}

/**
 *
 * @param {any} buffer -
 * @returns {any} -
 */
export function getHead (buffer) {
  return buffer.subarray(0, bodyStartIndex(buffer))
}

/**
 *
 * @param {any} buffer -
 * @returns {any} -
 */
export function getStartLine (buffer) {
  return buffer.subarray(0, firstIndexOf([CRLF, LF], buffer))
}

/**
 *
 * @param {any} buffer -
 * @returns {any} -
 */
export function getBody (buffer) {
  return buffer.subarray(bodyStartIndex(buffer))
}

/**
 * Utility for turning an HTTP body into a string.
 * Handles "deflate", "gzip" and "br" decompression.
 *
 * @param {Buffer} body
 * @param {?string} [contentEncoding=null] - Can be "br", "deflate" or "gzip"
 * @returns {Promise<string>}
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

/**
 * Maps HTTP headers into an key / value association.
 * @param {Array} headersArray - Parsed HTTP headers presented as a flat array.
 * @returns {Headers}
 */
export function flatArrayToHeadersObject (headersArray) {
  if (headersArray?.constructor !== Array || headersArray.length % 2 === 1) {
    throw new Error('headers must be an array with an even number of items as matched key value pairs')
  }

  return new Headers(
    headersArray.reduce(
      (result, _value, index, sourceArray) =>
        index % 2 === 0 ? [...result, sourceArray.slice(index, index + 2)] : result,
      []
    )
  )
}

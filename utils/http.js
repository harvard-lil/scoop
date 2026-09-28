import zlib from 'node:zlib'
import { promisify } from 'util'
import { MAX_HTTP_HEADER_SIZE } from '../constants.js'

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
 * Locates the final response body after any informational header blocks.
 * Informational responses have no body. A 101 terminates HTTP parsing rather
 * than introducing another response. Never scan payload bytes for headers.
 *
 * @param {Buffer} buffer - Captured HTTP responses in wire order
 * @returns {number} Body offset, or -1 if the final headers are incomplete
 */
export function responseBodyStartIndex (buffer) {
  let offset = 0
  while (offset < buffer.length) {
    // Only locate boundaries here: Node validates the HTTP metadata. Keep the
    // scan bounded and accept leading blank lines in older raw archives.
    const remaining = buffer.subarray(offset, offset + MAX_HTTP_HEADER_SIZE)
    let position = 0
    let code
    let end = -1
    while (position < remaining.length) {
      const newline = remaining.indexOf(LF, position)
      if (newline === -1) return -1
      const lineEnd = remaining[newline - 1] === 13 ? newline - 1 : newline
      const line = remaining.subarray(position, lineEnd).toString('latin1')
      position = newline + 1
      if (code === undefined) {
        if (!line) continue
        const status = /^HTTP\/1\.[01] ([0-9]{3})(?: |$)/.exec(line)
        if (!status) return -1
        code = Number(status[1])
        if (code < 100) return -1
      } else if (!line) {
        end = position
        break
      }
    }
    if (end === -1) return -1
    offset += end
    if (code === 101 || code >= 200) return offset
  }
  return -1
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

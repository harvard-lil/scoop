const magicByte = '%PDF'

/**
 * Sniffs a buffer to loosely infer whether it's a PDF file.
 *
 * Note: this is an imperfect method. See {@link https://stackoverflow.com/a/32179564}
 *
 * @param {Buffer} buffer - A buffer containing potential PDF data
 * @returns {boolean} - Returns true if the buffer contains PDF data
 */
export function isPDF (buffer) {
  return buffer.toString('utf8', 0, magicByte.length) === magicByte
}

/**
 * Very loosely extracts the number of pages in a PDF buffer
 * NOTE: VERY LOOSELY; use only for testing on known PDF output
 *
 * @param {Buffer} buffer - a buffer containing PDF data
 * @returns {Integer} - the number of pages it the document
 */
export function getPageCount (buffer) {
  return parseInt(buffer.toString().match(/Count (\d+)/)[1])
}

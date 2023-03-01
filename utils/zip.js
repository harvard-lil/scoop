/**
 * Sniffs a buffer to loosely infer whether it's a zip file.
 *
 * Note: this is an imperfect method.
 * @see {@link https://stackoverflow.com/a/1887113}
 *
 * @param {Buffer} buf - The buffer to check
 * @returns {boolean} True if buffer appears to be a zip file.
 */
export function isZip (buf) {
  return buf.toString('utf8', 0, 2) === 'PK'
}

/**
 * Checks the header of a zip buffer
 * to see if STORE compression was used
 *
 * @param {Buffer} buf - A buffer containing zip data
 * @returns {boolean}
 */
export function usesStoreCompression (buf) {
  return buf.readUIntLE(8, 2) === 0
}

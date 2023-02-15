/**
 * Mischief
 * @module utils.png
 * @description Helper functions for working with buffers containing png data.
 * @private
 */

const magicNumber = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])
const IHDR = Buffer.from('IHDR')

/**
 * Checks a buffer to see if it contains the PNG magic number
 *
 * @param {Buffer} buffer - The buffer to check
 * @returns {boolean} True if buffer appears to be a png file.
 */
export function isPNG (buffer) {
  return Buffer.compare(buffer.subarray(0, magicNumber.length), magicNumber) === 0
}

/**
 * Checks a buffer to see if it contains an IHDR data field
 *
 * @param {Buffer} buffer - The buffer to check
 * @returns {boolean} True if buffer contains the IHDR data field
 */
export function hasIHDR (buffer) {
  // The first four bytes represent the length of the chunk's data field and the following four bytes represent the chunk's name
  const offset = magicNumber.length + IHDR.length
  return Buffer.compare(buffer.subarray(offset, offset + IHDR.length), IHDR) === 0
}

/**
 * Extracts the width and height from a buffer containing PNG data
 *
 * @param {Buffer} buffer - The png data
 * @returns {integer[]} A tuple containing the width and height
 */
export function getDimensions (buffer) {
  if (!isPNG(buffer) || !hasIHDR(buffer)) {
    throw new Error('buffer must contain PNG data.')
  }

  const offset = magicNumber.length + (IHDR.length * 2)
  return [
    buffer.readUInt32BE(offset),
    buffer.readUInt32BE(offset + 4)
  ]
}

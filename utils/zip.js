/**
 * Mischief
 * @module utils.zip
 * @description Helper functions for working with buffers containing zip data.
 * @private
 */

import { Writable } from 'stream'
import Archiver from 'archiver'

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
 * Sniffs a buffer to infer whether it's a gzip file.
 *
 * @param {Buffer} buf - The buffer to check
 * @returns {boolean} True if buf appears to be a gzip file.
 */
export function isGzip (buf) {
  return buf[0] === 0x1f && buf[1] === 0x8b
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

/**
 * Checks the header of a zip buffer to see
 * how long the file name is in the header.
 * Used to seek past the header to the body.
 *
 * @param {Buffer} buf - A buffer containing zip data
 * @returns {integer}
 */
export function fileNameLen (buf) {
  return buf.readUIntLE(26, 2)
}

/**
 * Checks the header of a zip buffer to see
 * how long the "extra field" is in the header.
 * Used to seek past the header to the body.
 *
 * @param {Buffer} buf - A buffer containing zip data
 * @returns {integer}
 */
export function extraFieldLen (buf) {
  return buf.readUIntLE(28, 2)
}

/**
 * A convenience function to seek past the header
 * of a zip buffer and read N bytes of the body.
 *
 * @param {Buffer} buf - A buffer containing zip data
 * @param {integer} byteLen
 * @returns {string}
 */
export function readBodyAsString (buf, byteLen) {
  return buf.toString('utf8', 30 + fileNameLen(buf) + extraFieldLen(buf), byteLen)
}

/**
 * Creates a zip file, in memory, from a list of files
 *
 * @param {object} files - an object whose keys are the file paths and values are the file data
 * @param {boolean} [store=true] - should store compression be used?
 * @returns {Promise<Buffer>} - a buffer containing the zipped data
 */
export async function create (files, store = true) {
  const archive = new Archiver('zip', { store })

  const buffers = []
  const converter = new Writable()
  converter._write = (chunk, _encoding, cb) => {
    buffers.push(chunk)
    process.nextTick(cb)
  }
  archive.pipe(converter)

  Object.entries(files).forEach(([name, data]) => {
    archive.append(data, { name })
  })

  await archive.finalize()
  return Buffer.concat(buffers)
}

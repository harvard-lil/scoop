/**
 * Mischief
 * @module utils.pdf
 * @description Helper functions for working with buffers containing pdf data.
 * @private
 */

import { promisify } from 'util'
import { execFile as execFileCB } from 'child_process'
import { inflate as inflateCB } from 'node:zlib'

const execFile = promisify(execFileCB)
const inflate = promisify(inflateCB)

const magicByte = '%PDF'

/**
 * Compresses a PDF using ghostscript (if available)
 *
 * @param {Buffer} buffer - A buffer containing PDF data
 * @returns {Promise<Buffer>} - A buffer containing compressed PDF data
 */
export async function gsCompress (buffer) {
  const promise = execFile('gs', [
    '-sDEVICE=pdfwrite',
    '-dNOPAUSE',
    '-dBATCH',
    '-dJPEGQ=90',
    '-r150',
    '-q',
    '-sOutputFile=-',
    '-'
  ])

  promise.child.stdin.write(buffer)
  promise.child.stdin.end()

  return promise.then(({ stdout, stderr }) => {
    if (stderr) throw new Error(stderr)
    return Buffer.from(stdout)
  })
}

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

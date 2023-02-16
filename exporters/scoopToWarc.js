import crypto from 'crypto'
import { Blob } from 'buffer'

import { WARCRecord, WARCSerializer } from 'warcio'

import * as CONSTANTS from '../constants.js'
import { Scoop } from '../Scoop.js'

// warcio needs the crypto utils suite as a global, but does not import it.
// Node JS 19+ automatically imports webcrypto as globalThis.crypto.
if (!globalThis.crypto) {
  globalThis.crypto = crypto
}

/**
 * @function scoopToWarc
 * @memberof module:exporters
 *
 * @description
 * Scoop capture to WARC converter.
 *
 * Note:
 * - Logs are added to capture object via `Scoop.log`.
 *
 * @param {Scoop} capture
 * @returns {Promise<ArrayBuffer>}
 */
export async function scoopToWarc (capture) {
  let serializedInfo = null
  const serializedRecords = []
  const validStates = [
    Scoop.states.PARTIAL,
    Scoop.states.COMPLETE,
    Scoop.states.RECONSTRUCTED
  ]

  // Check capture state
  if (!(capture instanceof Scoop) || !validStates.includes(capture.state)) {
    throw new Error('"capture" must be a partial or complete Scoop capture object.')
  }

  //
  // Prepare WARC info section
  //
  const info = WARCRecord.createWARCInfo(
    { filename: 'archive.warc', warcVersion: `WARC/${CONSTANTS.WARC_VERSION}` },
    { software: `${CONSTANTS.SOFTWARE} ${CONSTANTS.VERSION}` }
  )
  serializedInfo = await WARCSerializer.serialize(info)

  //
  // Prepare WARC records section
  //
  for (const exchange of capture.exchanges) {
    // Ignore loose requests
    if (!exchange.response) {
      continue
    }

    for (const type of ['request', 'response']) {
      const msg = exchange[type]
      // Ignore empty records
      if (!msg) {
        continue
      }

      try {
        async function * content () {
          yield msg.body
        }

        const warcHeaders = {
          'exchange-id': exchange.id
        }

        if (exchange.description) {
          warcHeaders.description = exchange.description
        }

        const record = WARCRecord.create(
          {
            url: exchange.url,
            date: exchange.date.toISOString(),
            type,
            warcVersion: `WARC/${CONSTANTS.WARC_VERSION}`,
            statusline: msg.startLine,
            httpHeaders: Object.fromEntries(msg.headers.entries()),
            warcHeaders
          },
          content()
        )

        serializedRecords.push(await WARCSerializer.serialize(record))
      } catch (err) {
        capture.log.warn(`${msg.url} ${type} could not be added to warc.`)
        capture.log.trace(err)
      }
    }
  }

  //
  // Combine output and return as ArrayBuffer
  //
  return new Blob([serializedInfo, ...serializedRecords]).arrayBuffer()
}

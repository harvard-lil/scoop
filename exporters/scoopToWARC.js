import crypto from 'crypto'

import { WARCRecord, WARCSerializer } from 'warcio'

import * as CONSTANTS from '../constants.js'
import { Scoop } from '../Scoop.js'
import { ScoopGeneratedExchange } from '../exchanges/index.js'

// warcio needs the crypto utils suite as a global, but does not import it.
// Node JS 19+ automatically imports webcrypto as globalThis.crypto.
if (!globalThis.crypto) {
  globalThis.crypto = crypto
}

/**
 * Scoop capture to WARC converter.
 *
 * Note:
 * - Logs are added to capture object via `Scoop.log`.
 *
 * @param {Scoop} capture
 * @param {boolean} [gzip=false]
 * @returns {Promise<ArrayBuffer|Uint8Array>}
 */
export async function scoopToWARC (capture, gzip = false) {
  let serializedInfo = null

  const serializedRecords = []

  const validStates = [
    Scoop.states.PARTIAL,
    Scoop.states.COMPLETE,
    Scoop.states.RECONSTRUCTED
  ]

  gzip = Boolean(gzip)

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
  serializedInfo = await WARCSerializer.serialize(info, { gzip })

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

        const warcHeaders = {}

        // Pairs request / responses together so they can be reconstructed later.
        warcHeaders[CONSTANTS.EXCHANGE_ID_HEADER_LABEL] = exchange.id

        // Add `WARC-Refers-To-Target-URI` to associate generated exchanges with their origin.
        if (exchange instanceof ScoopGeneratedExchange) {
          warcHeaders['WARC-Refers-To-Target-URI'] = capture.url
        }

        if (exchange.description) {
          warcHeaders[CONSTANTS.EXCHANGE_DESCRIPTION_HEADER_LABEL] = exchange.description
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

        serializedRecords.push(await WARCSerializer.serialize(record, { gzip }))
      } catch (err) {
        capture.log.warn(`${msg.url} ${type} could not be added to warc.`)
        capture.log.trace(err)
      }
    }
  }

  //
  // Combine output and return as Uint8Array
  //

  // Calculate total byte length
  let totalByteLength = serializedInfo.length

  for (const record of serializedRecords) {
    totalByteLength += record.length
  }

  // Add entries
  const warc = new Uint8Array(totalByteLength)

  warc.set(serializedInfo, 0)

  let offset = serializedInfo.length
  for (const record of serializedRecords) {
    warc.set(record, offset)
    offset += record.length
  }

  return warc

  // TODO: Investigate why this no longer works in latest Node 19.X.
  // return new Blob([serializedInfo, ...serializedRecords]).arrayBuffer()
}

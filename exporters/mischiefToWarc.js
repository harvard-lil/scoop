/**
 * Mischief
 * @module exporters.mischiefToWarc
 * @author The Harvard Library Innovation Lab
 * @license MIT
 * @description Mischief to WARC exporter.
 */

import crypto from 'crypto'
import { Blob } from 'buffer'

import { WARCRecord, WARCSerializer } from 'warcio'

import CONSTANTS from '../constants.js'
import { Mischief } from '../Mischief.js' // warcio needs the crypto utils suite but does not import it.
global.crypto = crypto

/**
 * Mischief capture to WARC converter.
 *
 * Note:
 * - Logs are added to capture object via `Mischief.log`.
 *
 * @param {Mischief} capture
 * @returns {Promise<ArrayBuffer>}
 */
export async function mischiefToWarc (capture) {
  let serializedInfo = null
  const serializedRecords = []
  const validStates = [Mischief.states.PARTIAL, Mischief.states.COMPLETE]

  // Check capture state
  if (!(capture instanceof Mischief) || !validStates.includes(capture.state)) {
    throw new Error('`capture` must be a partial or complete Mischief capture object.')
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
      // Ignore empty records
      if (!exchange[type]) {
        continue
      }

      try {
        async function * content () {
          yield (exchange[`${type}RawBody`] || exchange[type].body)
        }

        const warcHeaders = {
          'exchange-id': exchange.id
        }

        if (exchange.description) {
          warcHeaders.description = exchange.description
        }

        const record = WARCRecord.create(
          {
            url: exchange[type].url,
            date: exchange.date.toISOString(),
            type,
            warcVersion: `WARC/${CONSTANTS.WARC_VERSION}`,
            statusline: prepareExchangeStatusLine(exchange, type),
            httpHeaders: exchange[type].headers,
            keepHeadersCase: false,
            warcHeaders
          },
          content()
        )

        serializedRecords.push(await WARCSerializer.serialize(record))
      } catch (err) {
        capture.log.warn(`${exchange[type].url} ${type} could not be added to warc.`)
        capture.log.trace(err)
      }
    }
  }

  //
  // Combine output and return as ArrayBuffer
  //
  return new Blob([serializedInfo, ...serializedRecords]).arrayBuffer()
}

/**
 * Prepares an HTTP status line string for a given MischiefExchange.
 *
 * Warcio expects the method to be prepended to the request statusLine.
 * Reference:
 * - https://github.com/webrecorder/pywb/pull/636#issue-869181282
 * - https://github.com/webrecorder/warcio.js/blob/d5dcaec38ffb0a905fd7151273302c5f478fe5d9/src/statusandheaders.js#L69-L74
 * - https://github.com/webrecorder/warcio.js/blob/fdb68450e2e011df24129bac19691073ab6b2417/test/testSerializer.js#L212
 *
 * @param {MischiefExchange} exchange
 * @param {string} [type="response"]
 * @returns {string}
 */
function prepareExchangeStatusLine (exchange, type = 'response') {
  let statusLine = ''
  const reqOrResp = exchange[type]

  switch (type) {
    case 'request':
      statusLine = `${reqOrResp.method} ${reqOrResp.url} HTTP/${reqOrResp.versionMajor}.${reqOrResp.versionMinor}`
      break

    case 'response':
    default:
      statusLine = `HTTP/${reqOrResp.versionMajor}.${reqOrResp.versionMinor} ${reqOrResp.statusCode} ${reqOrResp.statusMessage}`
      break
  }

  return statusLine
}

import zlib from 'node:zlib'
import { strict as assert } from 'node:assert'
import { parse as parseHTML } from 'node-html-parser'

import { Mischief } from '../Mischief.js'
import { MischiefExchange } from '../exchanges/MischiefExchange.js'

export class MischiefIntercepter {
  /**
   * The Mischief capture utilizing this intercepter
   *
   * @type {Mischief}
   */
  capture

  /**
   * When set to `false`, the intercepter will cease
   * appending data to the exchanges array until
   * once again set to `true`
   *
   * @type {boolean}
   */
  recordExchanges = true

  /**
   * Total byte length of all data recorded to exchanges
   *
   * @type {integer}
   */
  byteLength = 0

  /**
   * Data recorded by the intercepter,
   * formatted as a series of exchanges
   *
   * @type {MischiefExchange[]}
   */
  exchanges = []

  constructor (capture) {
    this.capture = capture
    return this
  }

  // convenience function
  get options () {
    return this.capture.options
  }

  setup (_page) {
    throw new Error('method must be implemented')
  }

  teardown () {
    throw new Error('method must be implemented')
  }

  get contextOptions () {
    return {}
  }

  /**
   * Tries to find the "noarchive" directive in a given exchange.
   * @param {MischiefExchange} exchange
   * @returns {boolean}
   */
  checkAndEnforceNoArchiveDirective (exchange) {
    let responseBody = null
    let contentType = null
    let contentEncoding = null

    // Skip if `followNoArchive` is off
    if (!this.options.followNoArchive) {
      return false
    }

    // Skip if a content-type was found, and it is not `text/html`
    contentType = exchange?.response?.headers['content-type']
      ? exchange?.response?.headers['content-type']
      : exchange?.response?.headers['Content-Type']

    if (contentType && !contentType.startsWith('text/html')) {
      return false
    }

    // Skip if body is empty
    responseBody = exchange?.response?.body

    if (!responseBody) {
      return false
    }

    // Handle deflate / gzip / brotly compression
    contentEncoding = exchange?.response?.headers['content-encoding']
      ? exchange?.response?.headers['content-encoding']
      : exchange?.response?.headers['Content-Encoding']

    try {
      switch (contentEncoding) {
        case 'deflate':
          responseBody = zlib.inflateSync(responseBody, { finishFlush: zlib.constants.Z_SYNC_FLUSH })
          break

        case 'gzip':
          responseBody = zlib.gunzipSync(responseBody, { finishFlush: zlib.constants.Z_SYNC_FLUSH })
          break

        case 'br':
          responseBody = zlib.brotliDecompressSync(responseBody, { finishFlush: zlib.constants.BROTLI_OPERATION_FLUSH })
          break
      }
    } catch (err) {
      this.capture.log.warn('Could not determine if the current exchange was marked as "noarchive".')
      this.capture.log.warn(`Error while decompressing ${contentEncoding} body. Assuming "noarchive" directive is absent.`)
      this.capture.log.trace(err)
      return false
    }

    responseBody = responseBody.toString('utf-8')

    // Skip if "noarchive" cannot be found in the document
    if (!responseBody.match(/noarchive/i)) {
      return false
    }

    // Parse DOM and look for full "noarchive" meta.
    try {
      const dom = parseHTML(responseBody.toString('utf-8'))
      assert(dom.querySelector(`meta[name='${this.options.noArchiveMetaName}'][content*='noarchive']`))
    } catch (err) {
      return false
    }

    // If we reached this point: this exchange is "noarchive".
    return true
  }

  /**
   * Checks whether the total byte length has exceeded
   * the capture's limit and, if so, ends the capture
   */
  checkAndEnforceSizeLimit () {
    if (this.byteLength >= this.options.maxSize && this.capture.state === Mischief.states.CAPTURE) {
      this.capture.log.warn(`Max size ${this.options.maxSize} reached. Ending interception.`)
      this.capture.state = Mischief.states.PARTIAL
      this.capture.teardown()
    }
  }
}

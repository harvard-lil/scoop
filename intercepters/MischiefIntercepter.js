import { strict as assert } from 'node:assert'
import { parse as parseHTML } from 'node-html-parser'

import { Mischief } from '../Mischief.js'
import { bodyToString } from '../parsers/MischiefHTTPParser.js'

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
   * If found, keeps trace of match in `Mischief.provenanceInfo`.
   *
   * @param {MischiefExchange} exchange
   * @returns {boolean} - `true` if request contained "noarchive"
   */
  async checkExchangeForNoArchive (exchange) {
    let responseBody = null
    let contentType = null
    let contentEncoding = null
    const parsedHeaders = new Headers(exchange?.response?.headers) // eslint-disable-line

    // Skip if a content-type was found, and it is not `text/html`
    contentType = parsedHeaders.get('content-type')

    if (contentType && !contentType.startsWith('text/html')) {
      return false
    }

    // Skip if body is empty
    responseBody = exchange?.response?.body

    if (!responseBody) {
      return false
    }

    // Handle deflate / gzip / brotly compression
    contentEncoding = parsedHeaders.get('content-encoding')

    try {
      responseBody = await bodyToString(responseBody, contentEncoding)
    } catch (err) {
      this.capture.log.info(`Error while decompressing ${contentEncoding} body. Assuming "noarchive" directive is absent.`)
      this.capture.log.trace(err)
      return false
    }

    // Skip if "noarchive" cannot be found in the document
    if (!responseBody.match(/noarchive/i)) {
      return false
    }

    // Parse DOM and look for full "noarchive" meta.
    try {
      const dom = parseHTML(responseBody)
      assert(dom.querySelector('[content*=\'noarchive\']'))
    } catch {
      return false
    }

    // If we reached this point: this exchange is "noarchive".
    this.capture.log.info(`${exchange?.response?.url} was tagged with the "noarchive" directive.`)
    this.capture.provenanceInfo.noArchiveUrls.push(exchange?.response?.url)
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

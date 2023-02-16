import { strict as assert } from 'node:assert'
import { parse as parseHTML } from 'node-html-parser'

import { Scoop } from '../Scoop.js'
import { bodyToString } from '../utils/http.js'

/**
 * @class ScoopIntercepter
 * @abstract
 *
 * @classdesc
 * Abstract class for intercepter implementations to capture HTTP traffic.
 *
 * @param {Scoop} capture - a Scoop capture
 */
export class ScoopIntercepter {
  /**
   * @param {Scoop} capture
   */
  constructor (capture) {
    if (capture instanceof Scoop === false) {
      throw new Error('"capture" must be an instance of Scoop.')
    }

    this.capture = capture
    return this
  }

  /**
   * The Scoop capture utilizing this intercepter
   *
   * @type {Scoop}
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
   * @type {integer}
   */
  byteLength = 0

  /**
   * Data recorded by the intercepter,
   * formatted as a series of exchanges
   *
   * @type {ScoopExchange[]}
   */
  exchanges = []

  // convenience function
  get options () {
    return this.capture.options
  }

  /**
   * Needs to be implemented by inheriting class.
   * @param {*} _page
   */
  setup (_page) {
    throw new Error('Method must be implemented.')
  }

  /**
   * Needs to be implemented by inheriting class.
   */
  teardown () {
    throw new Error('Method must be implemented.')
  }

  /**
   * Options to be given to Playwright
   * @type {object}
   */
  get contextOptions () {
    return {}
  }

  /**
   * Tries to find the "noarchive" directive in a given exchange.
   * If found, keeps trace of match in `Scoop.provenanceInfo`.
   *
   * @param {ScoopExchange} exchange
   * @returns {boolean} - `true` if request contained "noarchive"
   */
  async checkExchangeForNoArchive (exchange) {
    // Exit early if this isn't an HTML document
    if (!exchange?.response?.bodyCombined ||
        !exchange?.response?.headers?.get('content-type')?.toLowerCase().startsWith('text/html')) {
      return false
    }

    // Handle deflate / gzip / brotly compression
    const contentEncoding = exchange.response.headers.get('content-encoding')

    let responseBody = null
    try {
      responseBody = await bodyToString(exchange.response.bodyCombined, contentEncoding)
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
    this.capture.log.info(`${exchange.url} was tagged with the "noarchive" directive.`)
    this.capture.provenanceInfo.noArchiveUrls.push(exchange.url)
    return true
  }

  /**
   * Checks whether the total byte length has exceeded
   * the capture's limit and, if so, ends the capture
   */
  checkAndEnforceSizeLimit () {
    if (this.byteLength >= this.options.maxSize && this.capture.state === Scoop.states.CAPTURE) {
      this.capture.log.warn(`Max size ${this.options.maxSize} reached. Ending interception.`)
      this.capture.state = Scoop.states.PARTIAL
      this.capture.teardown()
    }
  }
}

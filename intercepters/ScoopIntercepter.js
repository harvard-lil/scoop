import { Scoop } from '../Scoop.js'

/**
 * @class ScoopIntercepter
 * @abstract
 *
 * @classdesc
 * Abstract class for intercepter implementations to capture HTTP traffic.
 *
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
  async setup (_page) {
    throw new Error('Method must be implemented.')
  }

  /**
   * Needs to be implemented by inheriting class.
   */
  async teardown () {
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
   * Checks whether the total byte length has exceeded
   * the capture's limit and, if so, stops intercepting exchanges.
   */
  checkAndEnforceSizeLimit () {
    if (this.byteLength >= this.options.maxCaptureSize && this.capture.state === Scoop.states.CAPTURE) {
      this.capture.log.warn(`Max size ${this.options.maxCaptureSize} reached. Ending interception.`)
      this.capture.state = Scoop.states.PARTIAL
      this.recordExchanges = false
    }
  }
}

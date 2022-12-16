import { Mischief } from '../Mischief.js'

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

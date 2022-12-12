import { Mischief } from '../Mischief.js'

export class MischiefIntercepter {
  capture

  byteLength = 0

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

  checkAndEnforceSizeLimit () {
    if (this.byteLength >= this.options.maxSize && this.capture.state === Mischief.states.CAPTURE) {
      this.capture.log.warn(`Max size ${this.options.maxSize} reached. Ending interception.`)
      this.capture.state = Mischief.states.PARTIAL
      this.capture.teardown()
    }
  }
}

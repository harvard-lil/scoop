import { v4 as uuidv4 } from 'uuid'

/**
 * Represents an HTTP exchange captured by Mischief, irrespective of how it was captured.
 * To be specialized by interception type (i.e: {@link MischiefProxyExchange}).
 */
export class MischiefExchange {
  /** @type {?string} */
  id = uuidv4()

  /** @type {Date} */
  date = new Date()

  /** @type {boolean} */
  isEntryPoint = false

  /** @type {?string} */
  connectionId

  /**
   * @type {object}
   * @private
   */
  _request

  set request (val) {
    this._request = val
  }

  get request () {
    return this._request
  }

  /**
   * @type {?object}
   * @private
   */
  _response

  set response (val) {
    this._response = val
  }

  get response () {
    return this._response
  }

  constructor (props = {}) {
    // Only accept props that reflect a defined property of `this`
    for (const [key, value] of Object.entries(props)) {
      if (key in this) {
        this[key] = value
      }
    }
  }
}

import { v4 as uuidv4 } from 'uuid'

/**
 * @class MischiefExchange
 * @abstract
 *
 * @classdesc
 * Represents an HTTP exchange captured by Mischief, irrespective of how it was captured.
 * To be specialized by interception type (i.e: {@link MischiefProxyExchange}).
 *
 * @param {object} [props={}] - Object containing any of the properties of `this`.
 */
export class MischiefExchange {
  constructor (props = {}) {
    for (const [key, value] of Object.entries(props)) {
      if (key in this) {
        this[key] = value
      }
    }
  }

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

  /** @type {?object} */
  set request (val) {
    this._request = val
  }

  /** @type {?object} */
  get request () {
    return this._request
  }

  /**
   * @type {?object}
   * @private
   */
  _response

  /** @type {?object} */
  set response (val) {
    this._response = val
  }

  /** @type {?object} */
  get response () {
    return this._response
  }
}

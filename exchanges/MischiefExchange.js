/**
 * Mischief
 * @module exchanges.MischiefExchange
 * @author The Harvard Library Innovation Lab
 * @license MIT
 * @description Parent class for HTTP exchanges captured by Mischief.
*/
import { v4 as uuidv4 } from 'uuid'

/**
 * Represents an HTTP exchange captured by Mischief, irrespective of how it was captured.
 * To be specialized by interception type (i.e: MischiefProxyExchange).
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

  /** @type {?object} */
  _request

  /** @type {?object} */
  set request (val) {
    this._request = val
  }

  /** @type {?object} */
  get request () {
    return this._request
  }

  /** @type {?object} */
  _response

  /** @type {?object} */
  set response (val) {
    this._response = val
  }

  /** @type {?object} */
  get response () {
    return this._response
  }

  /**
   * @param {object} [props={}] - Object containing any of the properties of `this`.
   */
  constructor (props = {}) {
    for (const [key, value] of Object.entries(props)) {
      if (key in this) {
        this[key] = value
      }
    }
  }
}

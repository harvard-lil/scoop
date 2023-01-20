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

  set request (val) {
    this._request = val
  }

  /** @type {?MischiefExchange~RequestOrResponse} */
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

  /** @type {?MischiefExchange~RequestOrResponse} */
  get response () {
    return this._response
  }
}

/**
 * @typedef MischiefExchange~RequestOrResponse
 * @property {boolean} shouldKeepAlive
 * @property {boolean} upgrade
 * @property {string} method
 * @property {string} url
 * @property {number} versionMajor
 * @property {number} versionMinor
 * @property {object} headers
 * @property {Buffer} body
 * @property {Array} trailers
 * @property {?number} statusCode - Response only
 * @property {?string} statusMessage - Response only
 */

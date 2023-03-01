/// <reference path="./ScoopExchange.types.js" />

import { v4 as uuidv4 } from 'uuid'

/**
 * @class ScoopExchange
 * @abstract
 *
 * @classdesc
 * Represents an HTTP exchange captured by Scoop, irrespective of how it was captured.
 * To be specialized by interception type (i.e: {@link ScoopProxyExchange}).
 *
 * @param {object} [props={}] - Object containing any of the properties of `this`.
 */
export class ScoopExchange {
  constructor (props = {}) {
    for (const [key, value] of Object.entries(props)) {
      if (key in this) {
        this[key] = value
      }
    }
  }

  /** @type {string} */
  id = uuidv4()

  /** @type {Date} */
  date = new Date()

  /**
   * @type {?string}
   * @private
   */
  _url

  /** @type {?string} */
  get url () {
    return this._url
  }

  set url (val) {
    // throw on invalid url
    new URL(val) // eslint-disable-line
    this._url = val
  }

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

  /** @type {?ScoopExchange~Message} */
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

  /** @type {?ScoopExchange~Message} */
  get response () {
    return this._response
  }
}

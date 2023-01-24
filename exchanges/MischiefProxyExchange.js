import { bodyStartIndex } from '../utils/http.js'

import { MischiefExchange } from './MischiefExchange.js'
import { MischiefHTTPParser } from '../parsers/index.js'

/**
 * @class MischiefProxyExchange
 * @extends MischiefExchange
 *
 * @classdesc
 * Represents an HTTP exchange captured via MischiefProxy.
 *
 * @param {object} [props={}] - Object containing any of the properties of `this`.
 */
export class MischiefProxyExchange extends MischiefExchange {
  constructor (props = {}) {
    super(props)

    for (const [key, value] of Object.entries(props)) {
      if (key in this) {
        this[key] = value
      }
    }
  }

  /**
   * @type {?Buffer}
   * @private
   */
  _requestRaw

  /** @type {?Buffer} */
  get requestRaw () {
    return this._requestRaw
  }

  set requestRaw (val) {
    this._request = null
    this._requestRaw = val
  }

  /** @type {?Buffer} */
  get requestRawHeaders () {
    return this.requestRaw.subarray(0, bodyStartIndex(this.requestRaw))
  }

  /** @type {?Buffer} */
  get requestRawBody () {
    return this.requestRaw.subarray(bodyStartIndex(this.requestRaw))
  }

  /**
   * @type {?Buffer}
   * @private
   */
  _responseRaw

  /** @type {?Buffer} */
  get responseRaw () {
    return this._responseRaw
  }

  set responseRaw (val) {
    this._response = null
    this._responseRaw = val
  }

  /** @type {Buffer} */
  get responseRawHeaders () {
    return this.responseRaw.subarray(0, bodyStartIndex(this.responseRaw))
  }

  /** @type {Buffer} */
  get responseRawBody () {
    return this.responseRaw.subarray(bodyStartIndex(this.responseRaw))
  }

  /** @type {?MischiefExchange~RequestOrResponse} */
  get request () {
    if (!this._request && this.requestRaw) {
      this._request = MischiefHTTPParser.parseRequest(this.requestRaw)

      if (this._request.url[0] === '/') {
        this._request.url = `https://${this._request.headers[1]}${this._request.url}`
      }

      this._request.headers = MischiefHTTPParser.headersArrayToMap(this._request.headers)
    }
    return this._request
  }

  set request (val) {
    this._request = val
  }

  /** @type {?MischiefExchange~RequestOrResponse} */
  get response () {
    if (!this._response && this.responseRaw) {
      this._response = MischiefHTTPParser.parseResponse(this.responseRaw)
      this._response.headers = MischiefHTTPParser.headersArrayToMap(this._response.headers)
      this._response.url = this.request.url
    }
    return this._response
  }

  set response (val) {
    this._response = val
  }
}

import {
  getStartLine,
  getBody,
  flatArrayToHeadersObject
} from '../utils/http.js'

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

  get url () {
    if (!this._url) {
      this._url = this.request.startLine.split(' ')[1]
      if (this._url[0] === '/') {
        this._url = `https://${this.request.headers.get('host')}${this._url}`
      }
    }

    return this._url
  }

  set url (val) {
    // throw on invalid url
    new URL(val) // eslint-disable-line
    this._url = val
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

  /** @type {?MischiefExchange~Message} */
  get request () {
    if (!this._request && this.requestRaw) {
      const parsed = MischiefHTTPParser.parseRequest(this.requestRaw)
      this._request = {
        startLine: getStartLine(this.requestRaw).toString(),
        headers: flatArrayToHeadersObject(parsed.headers),
        body: getBody(this.requestRaw),
        bodyCombined: parsed.body
      }
    }
    return this._request
  }

  set request (val) {
    this._request = val
  }

  /** @type {?MischiefExchange~Message} */
  get response () {
    if (!this._response && this.responseRaw) {
      const parsed = MischiefHTTPParser.parseResponse(this.responseRaw)
      this._response = {
        startLine: getStartLine(this.responseRaw).toString(),
        headers: flatArrayToHeadersObject(parsed.headers),
        body: getBody(this.responseRaw),
        bodyCombined: parsed.body
      }
    }
    return this._response
  }

  set response (val) {
    this._response = val
  }
}

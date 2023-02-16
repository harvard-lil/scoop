import {
  getStartLine,
  getBody,
  flatArrayToHeadersObject
} from '../utils/http.js'

import { ScoopExchange } from './ScoopExchange.js'
import { ScoopHTTPParser } from '../parsers/index.js'

/**
 * @class ScoopProxyExchange
 * @extends ScoopExchange
 *
 * @classdesc
 * Represents an HTTP exchange captured via ScoopProxy.
 *
 * @param {object} [props={}] - Object containing any of the properties of `this`.
 */
export class ScoopProxyExchange extends ScoopExchange {
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

  /** @type {?ScoopExchange~Message} */
  get request () {
    if (!this._request && this.requestRaw) {
      const parsed = ScoopHTTPParser.parseRequest(this.requestRaw)
      const body = getBody(this.requestRaw)
      this._request = {
        startLine: getStartLine(this.requestRaw).toString(),
        headers: flatArrayToHeadersObject(parsed.headers),
        body,
        // use the existing raw buffer if they're identical to perhaps free up memory
        bodyCombined: Buffer.compare(body, parsed.body) === 0 ? body : parsed.body
      }
    }
    return this._request
  }

  set request (val) {
    this._request = val
  }

  /** @type {?ScoopExchange~Message} */
  get response () {
    if (!this._response && this.responseRaw) {
      const parsed = ScoopHTTPParser.parseResponse(this.responseRaw)
      const body = getBody(this.responseRaw)
      this._response = {
        startLine: getStartLine(this.responseRaw).toString(),
        headers: flatArrayToHeadersObject(parsed.headers),
        body,
        // use the existing raw buffer if they're identical to perhaps free up memory
        bodyCombined: Buffer.compare(body, parsed.body) === 0 ? body : parsed.body
      }
    }
    return this._response
  }

  set response (val) {
    this._response = val
  }
}

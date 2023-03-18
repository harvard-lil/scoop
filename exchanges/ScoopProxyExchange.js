/// <reference path="./ScoopExchange.types.js" />

import { getBody } from '../utils/http.js'

import { ScoopExchange } from './ScoopExchange.js'

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

    const setters = Object.getOwnPropertyNames(this.constructor.prototype)
    for (const [key, value] of Object.entries(props)) {
      if (key in this || setters.includes(key)) {
        this[key] = value
      }
    }
  }

  get url () {
    if (!this._url && this.requestParsed) {
      this.url = this.requestParsed.url.startsWith('/')
        ? `https://${this.requestParsed.headers.host}${this.requestParsed.url}`
        : this.requestParsed.url
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
  _requestRaw = Buffer.from([])

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
  _responseRaw = Buffer.from([])

  /** @type {?Buffer} */
  get responseRaw () {
    return this._responseRaw
  }

  set responseRaw (val) {
    this._response = null
    this._responseRaw = val
  }

  cacheBody (message) {
    message.on('data', (data) => {
      message.body = message.body
        ? Buffer.concat([message.body, data], message.body.length + data.length)
        : data
    })
  }

  /**
   * @type {?IncomingMessage}
   * @private
   */
  _requestParsed

  /** @type {?IncomingMessage} */
  get requestParsed () {
    return this._requestParsed
  }

  set requestParsed (val) {
    this._request = null
    this.cacheBody(val)
    this._requestParsed = val
  }

  /**
   * @type {?IncomingMessage}
   * @private
   */
  _responseParsed

  /** @type {?IncomingMessage} */
  get responseParsed () {
    return this._responseParsed
  }

  set responseParsed (val) {
    this._response = null
    this.cacheBody(val)
    this._responseParsed = val
  }

  /**
   * @type {?object}
   * @private
   */
  _request

  /** @type {?ScoopExchange~Message} */
  get request () {
    if (!this._request && this.requestParsed) {
      this.request = {
        startLine: `${this.requestParsed.method} ${this.requestParsed.url} HTTP/${this.requestParsed.httpVersion}`,
        headers: new Headers(this.requestParsed.headers),
        body: getBody(this.requestRaw),
        bodyCombined: this.requestParsed.body
      }
    }
    return this._request
  }

  set request (val) {
    this._request = val
  }

  /**
   * @type {?object}
   * @private
   */
  _response

  /** @type {?ScoopExchange~Message} */
  get response () {
    if (!this._response && this.responseRaw) {
      this.response = {
        startLine: `HTTP/${this.responseParsed.httpVersion} ${this.responseParsed.statusCode} ${this.responseParsed.statusMessage}`,
        headers: new Headers(this.responseParsed.headers),
        body: getBody(this.responseRaw),
        bodyCombined: this.responseParsed.body
      }
    }
    return this._response
  }

  set response (val) {
    this._response = val
  }
}

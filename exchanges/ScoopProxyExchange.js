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

  /**
   * Stores the parsed body on the incoming message for easy access, as
   * `message.body`: everything received so far, or undefined before any data.
   *
   * Chunks are kept as they arrive and joined when the body is read. Joining
   * on every chunk instead copies the whole body each time, which for a
   * response that keeps streaming after the capture has stopped recording (a
   * video, an ad slot) grows until it occupies the event loop entirely.
   *
   * @param {IncomingMessage} message
   * @private
   */
  _cacheBody (message) {
    const chunks = []

    message.on('data', (data) => {
      chunks.push(data)
    })

    Object.defineProperty(message, 'body', {
      configurable: true,
      get () {
        if (chunks.length === 0) {
          return undefined
        }
        if (chunks.length > 1) {
          chunks.splice(0, chunks.length, Buffer.concat(chunks))
        }
        return chunks[0]
      }
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
    this._cacheBody(val)
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
    this._cacheBody(val)
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
    // TODO: figure out why this.responseRaw may sometimes be an empty buffer of length 0
    if (!this._response && this.responseRaw?.length) {
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

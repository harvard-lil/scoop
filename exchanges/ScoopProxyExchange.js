/// <reference path="./ScoopExchange.types.js" />

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

    for (const [key, value] of Object.entries(props)) {
      if (key in this) {
        this[key] = value
      }
    }
  }

  get url () {
    if (!this._url && this.request) {
      this._url = this.request.url.startsWith('/')
        ? `https://${this.request.url}`
        : this.request.url
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
   */
  requestRaw = Buffer.from([])

  /**
   * @type {?Buffer}
   */
  responseRaw = Buffer.from([])
}

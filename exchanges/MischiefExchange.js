/**
 * Mischief
 * @module MischiefExchange
 * @author The Harvard Library Innovation Lab
 * @license MIT
*/

/**
 * Represents an HTTP exchange to be added to the web archive.
 *
 * Usage:
 * ```javascript
 * const exchange = new MischiefExchange({url: "https://example.com"});
 * ```
 */
export class MischiefExchange {
  /** @type {Date} */
  date = new Date();

  /** @type {?string} */
  id;

  /** @type {?object} */
  request;

  /** @type {?object} */
  response;

  /** @type {?string} */
  url;

  /** @type {?Buffer} */
  requestRaw;

  set requestRaw(val) {
    this._request = null;
    this.requestRaw = val;
  }

  /** @type {?Buffer} */
  responseRaw;

  set responseRaw(val) {
    this._response = null;
    this.responseRaw = val;
  }

  constructor(props) {
    const allowed = ["date",
                     "id",
                     "requestRaw",
                     "responseRaw",
                     "request",
                     "response",
                     "url"];
    for(const prop of Object.keys(props).filter(k => allowed.includes(k))) {
      this[prop] = props[prop];
    }
    return this;
  }
}

/**
 * Mischief
 * @module MischiefExchange
 * @author The Harvard Library Innovation Lab
 * @license MIT
*/
import { HTTPParser } from "./parsers/http.js";

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

  /** @type {?Buffer} */
  requestRaw;
  
  set requestRaw(val) {
    this.#request = null;
    this.requestRaw = val;
  }

  /** @type {?Buffer} */
  responseRaw;

  set responseRaw(val) {
    this.#response = null;
    this.responseRaw = val;
  }

  /** @type {?object} */
  #request;
  get request() {
    if (!this.#request && this.requestRaw) {
      this.#request = HTTPParser.parseRequest(this.requestRaw);
    }
    return this.#request;
  }

  set request(val) {
    this.#request = val;
  }

  /** @type {?object} */
  #response;
  get response() {
    if (!this.#response && this.responseRaw) {
      this.#response = HTTPParser.parseResponse(this.responseRaw);
    }
    return this.#response;
  }

  set response(val) {
    this.#response = val;
  }

  /** @type {?string} */
  #url;
  get url() {
    if (!this.#url) {
      // if the url lacks a protocol, assume https
      this.#url =
        this.request.url[0] == "/"
          ? `https://${this.request.headers[1]}${this.request.url}`
          : this.request.url;
    }
    return this.#url;
  }

  set url(val) {
    this.#url = val;
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

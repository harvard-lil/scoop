import { HTTPParser } from "./parsers/http.js";

 /**
 * * Mischief
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

  /** @type {?Buffer} */
  requestRaw;
  set requestRaw(val){
    this.#request = null;
    return this.requestRaw = val;
  }

  /** @type {?Buffer} */
  responseRaw;
  set responseRaw(val){
    this.#response = null;
    return this.responseRaw = val;
  }

  /** @type {?object} */
  #request;
  get request() {
    if(!this.#request && this.requestRaw){
      this.#request = HTTPParser.parseRequest(this.requestRaw);
    }
    return this.#request;
  }
  set request(val) { return this.#request = val; }

  /** @type {?object} */
  #response;
  get response() {
    if(!this.#response && this.responseRaw){
      this.#response = HTTPParser.parseResponse(this.responseRaw);
    }
    return this.#response;
  }
  set response(val) { return this.#response = val; }

  /** @type {?string} */
  #url;
  get url() {
    if(!this.#url) {
      // if the url lacks a protocol, assume https
      this.#url = this.request.url[0] == '/' ?
        `https://${this.request.headers[1]}${this.request.url}` :
        this.request.url;
    }
    return this.#url;
  }
  set url(val) { return this.#url = val; }

  /** @type {?string} */
  #statusLine;
  get statusLine() {
    if(!this.#statusLine){
      this.#statusLine = `HTTP/${this.response.versionMajor}.${this.response.versionMinor} ${this.response.statusCode} ${this.response.statusMessage}`;
    }
    return this.#statusLine;
  }
  set statusLine(val) { return this.#statusLine = val; }

  constructor(props) {
    Object.assign(this, props);
    return this;
  }
}

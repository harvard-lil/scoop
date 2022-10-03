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
 * ```
 */
export class MischiefExchange {
  /** @type {Date} */
  date = new Date();

  /** @type {?Session} */
  session;

  /** @type {?Buffer} */
  requestRaw;

  set requestRaw(val){
    this.requestRaw = val;
    this.#requestParsed = null;
  }

  /** @type {?Buffer} */
  responseRaw;

  set responseRaw(val){
    this.responseRaw = val;
    this.#responseParsed = null;
  }

  /** @type {?object} */
  #requestParsed;

  get requestParsed() {
    return this.#requestParsed = this.#requestParsed || HTTPParser.parseRequest(this.requestRaw);
  }

  /** @type {?object} */
  #responseParsed;

  get responseParsed() {
    return this.#responseParsed = this.#responseParsed || HTTPParser.parseResponse(this.responseRaw);
  }

  get url() {
    return this.session.isHttps ?
      `https://${this.requestParsed.headers[1]}${this.requestParsed.url}` :
      this.requestParsed.url;
  }

  #formatStatusLine(parsed) {
    return `HTTP/${parsed.versionMajor}.${parsed.versionMinor} ${parsed.statusCode} ${parsed.statusMessage}`
  }

  get requestStatusLine() {
    return this.#formatStatusLine(this.requestParsed);
  }

  get responseStatusLine() {
    return this.#formatStatusLine(this.responseParsed);
  }

  constructor(session) {
    this.session = session;
  }
}
import { STATUS_CODES } from "http";

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
 * const exchange = new MischiefExchange();
 * exchange.url = "https://example.com";
 * exchange.status = 200;
 * exchange.type = "response";
 * exchange.headers = {"Content-Type": "text/html", ...};
 * exchange.body = [...] // Some binary data as ArrayBuffer
 * ```
 */
export class MischiefExchange {
  /** @type {?string} */
  url;

  /** 
   * Should be a valid HTTP verb.
   * @type {?string} 
   */
  method = "GET";

  /** @type {?number} */
  status;

  /**
   * Approximates what the status line might have been.
   * Playwright doesn't give us access to the original,
   * nor does it surface the HTTP version, which we leave as "?" here.
   * @returns {?string}
   */
  get statusLine() {
    return this.status ? `HTTP/? ${this.status} ${STATUS_CODES[this.status]}` : null;
  };

  /** @type {?Object} */
  headers;

  /** @type {?ArrayBuffer} */
  body = null;

  /** @type {Date} */
  date = new Date();

  /** 
   * Should be either "response" or "request".
   * @type {string} 
   */
  type = "response";

  /**
   * Combined byte length of the exchange, including headers.
   * Used to determine if an exchange can be added to a collection (size limit).
   * @returns {number} 
   */
  get byteLength() {
    let byteLength = 0;
    let encoder = new TextEncoder();

    if (this.url) {
      byteLength += encoder.encode(this.url).byteLength;
    }

    if (this.method) {
      byteLength += encoder.encode(this.method).byteLength;
    }

    if (this.status) {
      byteLength += encoder.encode(String(this.status)).byteLength;
    }

    if (this.headers) {
      byteLength += encoder.encode(JSON.stringify(this.headers)).byteLength;
    }

    if (this.body) {
      byteLength += this.body.byteLength;
    }

    if (this.date) {
      byteLength += encoder.encode(String(this.date.toISOString())).byteLength;
    }

    return byteLength;
  }
}
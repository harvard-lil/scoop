/**
 * Mischief
 * @module exchanges.MischiefProxyExchange
 * @author The Harvard Library Innovation Lab
 * @license MIT
 * @description 
*/
import { MischiefExchange } from "./MischiefExchange.js";
import { MischiefHTTPParser } from "../parsers/index.js";

/**
 * Represents an HTTP exchange captured via MischiefProxy.
 */
export class MischiefProxyExchange extends MischiefExchange {

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

  get request() {
    if (!this._request && this.requestRaw) {
      this._request = MischiefHTTPParser.parseRequest(this.requestRaw);

      if(this._request.url[0] == "/"){
        this._request.url = `https://${this._request.headers[1]}${this._request.url}`;
      }

      this._request.headers = MischiefHTTPParser.headersToMap(this._request.headers);
    }
    return this._request;
  }

  set request(val) {
    this._request = val;
  }

  get response() {
    if (!this._response && this.responseRaw) {
      this._response = MischiefHTTPParser.parseResponse(this.responseRaw);
      this._response.headers = MischiefHTTPParser.headersToMap(this._response.headers);
      this._response.url = this.request.url
    }
    return this._response;
  }

  set response(val) {
    this._response = val;
  }
}

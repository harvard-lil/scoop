import { MischiefExchange } from "./MischiefExchange.js";
import { HTTPParser } from "../parsers/http.js";

export class MischiefProxyExchange extends MischiefExchange {
  /** @type {?object} */
  _request;
  get request() {
    if (!this._request && this.requestRaw) {
      this._request = HTTPParser.parseRequest(this.requestRaw);
    }
    return this._request;
  }

  set request(val) {
    this._request = val;
  }

  /** @type {?object} */
  _response;
  get response() {
    if (!this._response && this.responseRaw) {
      this._response = HTTPParser.parseResponse(this.responseRaw);
    }
    return this._response;
  }

  set response(val) {
    this._response = val;
  }

  /** @type {?string} */
  _url;
  get url() {
    if (!this._url) {
      // if the url lacks a protocol, assume https
      this._url =
        this.request.url[0] == "/"
        ? `https://${this.request.headers[1]}${this.request.url}`
        : this.request.url;
    }
    return this._url;
  }

  set url(val) {
    this._url = val;
  }
}

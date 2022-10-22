import { MischiefExchange } from "./MischiefExchange.js";
import { HTTPParser } from "../parsers/http.js";

export class MischiefProxyExchange extends MischiefExchange {
  /** @type {?object} */
  _request;
  get request() {
    if (!this._request && this.requestRaw) {
      this._request = HTTPParser.parseRequest(this.requestRaw);
      this._request.headers = HTTPParser.headersToMap(this._request.headers);
      if(this._request.url[0] == "/"){
        this._request.url = `https://${this._request.headers[1]}${this._request.url}`;
      }
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
      this._response.headers = HTTPParser.headersToMap(this._response.headers);
      this._response.url = this.request.url
    }
    return this._response;
  }

  set response(val) {
    this._response = val;
  }
}

import { MischiefExchange } from "./MischiefExchange.js";
import { STATUS_CODES } from "http";

export class MischiefCDPExchange extends MischiefExchange {
  /** @type {?object} */
  _request;
  get request() {
    return this._request;
  }

  set request(val) {
    this._request = val;
    this._request.versionMajor = 1;
    this._request.versionMinor = 1;
  }

  /** @type {?object} */
  _response;
  get response() {
    return this._response;
  }

  set response(val) {
    this._response = val;
    this._response.versionMajor = 1;
    this._response.versionMinor = 1;
    this._response.statusCode = val.status;
    this._response.statusMessage = val.statusText || STATUS_CODES[val.status.toString()];
  }
}

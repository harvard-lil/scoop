import { MischiefExchange } from "./MischiefExchange.js";

export class MischiefCDPExchange extends MischiefExchange {
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

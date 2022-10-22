import { Intercepter } from './Intercepter.js';
import { MischiefCDPExchange } from '../exchanges/index.js';

export class CDP extends Intercepter {

  #connection

  exchangeClass = MischiefCDPExchange;

  async setup(page){
    this.#connection = await page.context().newCDPSession(page);
    await this.#connection.send('Network.enable');
    this.#connection.on('Network.requestWillBeSent', this.interceptRequest.bind(this));
    this.#connection.on('Network.responseReceived', this.interceptResponse.bind(this));
  }

  teardown() {
    this.#connection.detach();
  }

  interceptRequest(params) {
    const ex = this.getOrInitExchange(params.requestId, 'request');
    ex.request = params.request;
  }

  async interceptResponse(params) {
    const ex = this.getOrInitExchange(params.requestId, 'response');
    ex.response = params.response;
    try {
      const body = await this.#connection.send('Network.getResponseBody', params);
      ex._response.body = Buffer.from(body.body, body.base64Encoded ? "base64" : "utf-8");
    } catch(_) {}
  }
}

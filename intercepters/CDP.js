import { Intercepter } from './Intercepter.js';
import { MischiefCDPExchange } from '../exchanges/index.js';

export class CDP extends Intercepter {

  #connection

  async setup(page){
    this.#connection = await page.context().newCDPSession(page);
    await this.#connection.send('Network.enable');
    this.#connection.on('Network.requestWillBeSent', this.interceptRequest.bind(this));
    this.#connection.on('Network.responseReceived',  this.interceptResponseHeaders.bind(this));
    this.#connection.on('Network.loadingFinished',   this.interceptResponseBody.bind(this));
  }

  teardown() {
    this.#connection.detach();
  }

  interceptRequest(params) {
    const ex = this.getOrInitExchange(params.requestId);
    ex.request = params.request;
  }

  interceptResponseHeaders(params) {
    const ex = this.getOrInitExchange(params.requestId);
    ex.response = params.response;
  }

  async interceptResponseBody(params) {
    const ex = this.getOrInitExchange(params.requestId);
    const body = await this.#connection.send('Network.getResponseBody', params);
    ex._response.body = Buffer.from(body.body, body.base64Encoded ? "base64" : "utf-8");
  }

  getOrInitExchange(id) {
    return this.exchanges.find(ex => ex.id == id) ||
      this.exchanges[this.exchanges.push(new MischiefCDPExchange({id: id})) - 1];
  }
}

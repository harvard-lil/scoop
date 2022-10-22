import { Intercepter } from './intercepter.js';

export class CDP extends Intercepter {

  #connection

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
      ex.response.body = await this.#connection.send('Network.getResponseBody', params);
    } catch(_) {}
  }
}

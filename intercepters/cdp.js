import { Intercepter } from './intercepter.js';

export class CDP extends Intercepter {

  #connection

  async setup(page){
    this.#connection = await page.context().newCDPSession(page);
    await this.#connection.send('Network.enable');
    this.#connection.on('Network.requestWillBeSent', (params) => {
      console.log(params);
    });
    this.#connection.on('Network.responseReceived', async (params) => {
      console.log(await this.#connection.send('Network.getResponseBody', params));
    });
  }

  teardown() {
    this.#connection.detach();
  }
}

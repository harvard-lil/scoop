import { Mischief } from "../Mischief.js";
import { MischiefExchange } from "../exchanges/index.js";

export class Intercepter {

  capture;

  byteLength = 0;

  exchanges = [];

  exchangeClass = MischiefExchange;

  constructor(capture) {
    this.capture = capture;
    return this;
  }

  // convenience function
  get options() {
    return this.capture.options;
  }

  setup(_page) {
    throw 'method must be implemented';
  }

  teardown() {
    throw 'method must be implemented';
  }

  get contextOptions() {
    return {};
  }

  checkAndEnforceSizeLimit() {
    if(this.byteLength >= this.options.maxSize && this.capture.state == Mischief.states.CAPTURE){
      this.capture.addToLogs(`Max size ${this.options.maxSize} reached. Ending interception.`);
      this.capture.state = Mischief.states.PARTIAL;
      this.capture.teardown();
    }
  }

  /**
   * Returns an exchange based on the session id and type ("request" or "response").
   * If the type is a request and there's already been a response on that same session,
   * create a new exchange. Otherwise append to continue the exchange.
   *
   * @param {string} id
   * @param {string} type
   */
  getOrInitExchange(id, type) {
    return this.exchanges.findLast((ex) => {
      return ex.id == id && (type == "response" || !ex.responseRaw);
    }) || this.exchanges[this.exchanges.push(new this.exchangeClass({id: id})) - 1];
  }

}

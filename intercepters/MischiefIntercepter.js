import { Mischief } from "../Mischief.js";

export class MischiefIntercepter {

  capture;

  byteLength = 0;

  exchanges = [];

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
    if(this.byteLength >= this.options.maxSize && this.capture.state == Mischief.states.CAPTURE) {
      this.capture.addToLogs(`Max size ${this.options.maxSize} reached. Ending interception.`, true);
      this.capture.state = Mischief.states.PARTIAL;
      this.capture.teardown();
    }
  }
}

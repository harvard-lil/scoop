/**
 * Mischief
 * @module MischiefLog
 * @author The Harvard Library Innovation Lab
 * @license MIT
 */

/**
 * Mischief logging trace. 
 * To be added to `Mischief.logs[]`.
 */
export class MischiefLog {

  /** @type {Date} */
  date = new Date();

  /** @type {boolean} */
  isWarning = false;

  /** @type {string} */
  message = "";

  /** @type {string} */
  trace = "";

  /**
   * Creates a new log entry.
   * @param {string} message 
   * @param {boolean} isWarning 
   * @param {string|Error} trace 
   * @param {string} autoPrint - If `true`, the log will be added to STDOUT as the instance is created.
   */
  constructor(message = "", isWarning = false, trace = "", autoPrint = true) {
    this.isWarning = Boolean(isWarning);
    this.message = String(message);
    this.trace = String(trace);

    if (autoPrint === true) {
      this.print();
    }
  }

  /**
   * Prints the log message.
   * Uses either `console.log()` or `console.warn()` based on `this.isWarning`'s value.
   */
  print() {
    let level = this.isWarning ? console.warn : console.log;

    level(`[${this.date.toISOString()}]${this.isWarning ? " WARNING" : ""} ${this.message}`);

    if (this.trace) {
      level(this.trace);
    }
  }
}
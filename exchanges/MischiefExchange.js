/**
 * Mischief
 * @module MischiefExchange
 * @author The Harvard Library Innovation Lab
 * @license MIT
*/

/**
 * Represents an HTTP exchange to be added to the web archive.
 *
 * Usage:
 * ```javascript
 * const exchange = new MischiefExchange({url: "https://example.com"});
 * ```
 */
export class MischiefExchange {
  /** @type {Date} */
  date = new Date();

  /** @type {?string} */
  id;

  constructor(props) {
    const allowed = ["date", "id", "request", "response"];
    for(const prop of Object.keys(props).filter(k => allowed.includes(k))) {
      this[prop] = props[prop];
    }
    return this;
  }
}

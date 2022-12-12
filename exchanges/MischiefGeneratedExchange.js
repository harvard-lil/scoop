/**
 * Mischief
 * @module exchanges.MischiefGeneratedExchange
 * @author The Harvard Library Innovation Lab
 * @license MIT
 * @description
*/
import { MischiefExchange } from './MischiefExchange.js'

export class MischiefGeneratedExchange extends MischiefExchange {
  /** @type {?string} */
  description

  /**
   * @param {object} props - Object containing any of the properties of `this`.
   */
  constructor (props = {}) {
    super(props)

    for (const [key, value] of Object.entries(props)) {
      if (key in this) {
        this[key] = value
      }
    }
  }
}

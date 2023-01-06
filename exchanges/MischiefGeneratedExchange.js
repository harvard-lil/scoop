import { MischiefExchange } from './MischiefExchange.js'

/**
 * @class MischiefGeneratedExchange
 *
 * @classdesc
 * An exchange constructed ad-hoc (vs intercepted),
 * typically used to inject additional resources into an archive
*/
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

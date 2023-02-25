import { ScoopExchange } from './ScoopExchange.js'

/**
 * @class ScoopGeneratedExchange
 * @extends ScoopExchange
 *
 * @classdesc
 * An exchange constructed ad-hoc (vs intercepted),
 * typically used to inject additional resources into an archive
 *
 * @param {object} [props={}] - Object containing any of the properties of `this`.
*/
export class ScoopGeneratedExchange extends ScoopExchange {
  constructor (props = {}) {
    super(props)

    for (const [key, value] of Object.entries(props)) {
      if (key in this) {
        this[key] = value
      }
    }
  }

  /** @type {?string} */
  description
}

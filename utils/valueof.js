import { Scoop } from '../Scoop.js'
import { ScoopProxyExchange } from '../exchanges/ScoopProxyExchange.js'
import { ScoopGeneratedExchange } from '../exchanges/ScoopGeneratedExchange.js'

/**
 * A utility function for testing purposes that converts
 * a value into a primative version for easier comparison
 * against similar values.
 *
 * For example, comparing an original Scoop capture against
 * a rehydrated version populated by a WACZ import. In this case, certain
 * transient internal properties may not match exactly but the substantive
 * properties are the same and are pulled out for comparison here.
 *
 * @param {any} source - A value to be converted into a primative version
 * @returns {any} A primative version of the supplied source
 * @private
 */
export function valueOf (source) {
  function filterProps (obj, keep) {
    return Object.fromEntries(keep.map(k => [k, valueOf(obj[k])]))
  }

  switch (source.constructor) {
    case Array: {
      return source.map(valueOf)
    }
    case Object: {
      return Object.fromEntries(Object.entries(source).map(([k, v]) => [k, valueOf(v)]))
    }
    case Scoop: {
      return filterProps(source, [
        'url',
        'options',
        'provenanceInfo',
        'exchanges'
      ])
    }
    case ScoopProxyExchange: {
      return filterProps(source, [
        'id',
        'date',
        'requestRaw',
        'responseRaw'
      ])
    }
    case ScoopGeneratedExchange: {
      return filterProps(source, [
        'id',
        'date',
        'description',
        'response'
      ])
    }
    case Headers: {
      return Object.fromEntries(source.entries())
    }
    default: {
      return source
    }
  }
}

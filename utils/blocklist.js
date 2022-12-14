// NOTE: we're using a fork of ip-address for ESM compatibility.
// More here: https://github.com/beaugunderson/ip-address/issues/153#issuecomment-1190605625
import { Address4, Address6 } from '@laverdet/beaugunderson-ip-address'

/**
 * Parses a blocklist value for later matching.
 * RegExps are returned as-is while strings are attempted to be parsed
 * as IPs and CIDR ranges before being returned as-is if unsuccessful.
 *
 * @param {String | RegExp} val - a blocklist matcher
 * @throws {Error} - Throws if datatype does not match String or RegExp
 * @returns {RegExp | String | Address4 | Address6} - The parsed matcher
 */
export function castBlocklistMatcher (val) {
  if (![String, RegExp].includes(val.constructor)) {
    throw new Error('Blocklist matchers may only be strings or regular expressions.')
  }

  if (val instanceof RegExp) {
    return val
  }

  try {
    return new Address4(val)
  } catch {}

  try {
    return new Address6(val)
  } catch {}

  return val
}

/**
 * Returns a function that accepts a value to test
 * against a blocklist matcher and returns true|false
 * based on that matcher
 *
 * @param {(string | RegExp | Address4 | Address6)} test - A blocklist matcher to test against
 * @returns {function} - A curried function to be used in an array search
 */
function matchAgainst (matcher) {
  return (val) => {
    if ([Address4, Address6].includes(matcher.constructor)) {
      // If the test val is an IP, it must first be cast as Address4|Address6
      // to work with an Address4|Address6 matcher
      return Boolean(castBlocklistMatcher(val).isInSubnet?.(matcher))
    }

    return Boolean(val.match?.(matcher))
  }
}

/**
 * Accepts any number of IP addresses or URLs as strings
 * and returns a function that accepts a blocklist matcher
 * and returns true when any one of those IPs|URLs matches
 *
 * @param {...string} args - An IP address or URL
 * @returns {function} - A curried function to be used in an array search
 */
export function searchBlocklistFor (...args) {
  return (matcher) => args.find(matchAgainst(matcher))
}

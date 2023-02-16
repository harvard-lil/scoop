import { X509Certificate } from 'crypto'

/**
 * Assertion builder utility.
 * @param {string} description - Message to be shown.
 * @param {function} matcher - Function to be run to check that value matches assertion.
 * @returns {function} - Assertion function ready to be consumed.
 */
const makeAssertion = (description, matcher) => {
  return (val, customMsg) => {
    if (!matcher(val)) {
      const msg = [
        customMsg,
        `${val} does not match the expected format: ${description}`
      ].filter(v => v).join('\n')
      throw new Error(msg)
    }
  }
}

/**
 * Asserts that the given value is a string
 * @function
 * @param {any} val - The value to test
 * @throws Error
 */
export const assertString = makeAssertion(
  'string',
  (val) => val?.constructor === String
)

/**
 * Asserts that the given value is a date string
 * that conforms to ISO 8601
 * @function
 * @param {any} val - The value to test
 * @throws Error
 */
export const assertISO8601Date = makeAssertion(
  'ISO 8601 date',
  (val) => val?.match?.(/(\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d:[0-5]\d\.\d+([+-][0-2]\d:[0-5]\d|Z))|(\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d:[0-5]\d([+-][0-2]\d:[0-5]\d|Z))|(\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d([+-][0-2]\d:[0-5]\d|Z))/))

/**
 * Asserts that the given value is a Base64 encoded string
 * @function
 * @param {any} val - The value to test
 * @throws Error
 */
export const assertBase64 = makeAssertion(
  'Base64 string',
  (val) => val?.match?.(/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/)
)

/**
 * Asserts that the given value is a SHA256 hash prefixed with "sha:"
 * @function
 * @param {any} val - The value to test
 * @throws Error
 */
export const assertSHA256WithPrefix = makeAssertion(
  'SHA256 with "sha:" prefix',
  (val) => val?.match?.(/^sha256:[A-Fa-f0-9]{64}$/)
)

/**
 * Asserts that the given value is a PEM certificate
 * @function
 * @param {any} val - The value to test
 * @throws Error
 */
export const assertPEMCertificateChain = makeAssertion(
  'PEM certificate chain',
  (val) => {
    try {
      return new X509Certificate(val)
    } catch {
      return false
    }
  }
)

/**
 * Asserts that the given value is a domain name
 * @function
 * @param {any} val - The value to test
 * @throws Error
 */
export const assertDomainName = makeAssertion(
  'domain name',
  (val) => val?.match?.(/(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9][a-z0-9-]{0,61}[a-z0-9]/)
)

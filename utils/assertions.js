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

export const assertString = makeAssertion(
  'string',
  (val) => val?.constructor === String
)

export const assertISO8861Date = makeAssertion(
  'ISO 8861 date',
  (val) => val?.match?.(/\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d:[0-5]\d([+-][0-2]\d:[0-5]\d|Z)/))

export const assertBase64 = makeAssertion(
  'Base64 string',
  (val) => val?.match?.(/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/)
)

export const assertSHA256WithPrefix = makeAssertion(
  'SHA256 with "sha:" prefix',
  (val) => val?.match?.(/^sha256:[A-Fa-f0-9]{64}$/)
)

/**
 * Produce a cleanly-formatted error message from a caught error:
 * removes ANSI, collapses white space, and truncates at 100 chars.
 *
 * @param {*} err - An exception object, or anything else caught by try/catch.
 * @param {boolean} [asciiOnly=true] - Whether to restrict output to the ASCII.
 * @returns {string} A well-behaved message.
 */
export function formatErrorMessage (err, asciiOnly = true) {
  let message

  if (err instanceof Error) {
    message = err.message
  } else if (err instanceof String) {
    message = err
  } else {
    message = String(err)
  }

  // strip ansi
  // https://stackoverflow.com/a/29497680
  const ansiRegex = /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g
  message = message.replace(ansiRegex, '')

  // reduce to ascii
  // https://rosettacode.org/wiki/Strip_control_codes_and_extended_characters_from_a_string#JavaScript
  if (asciiOnly) {
    message = message.split('').filter(function (x) {
      const n = x.charCodeAt(0)
      return n > 31 && n < 127
    }).join('')
  }

  // reduce all whitespace to single spaces
  message = message.replace(/\s+/g, ' ').trim()

  // truncate long messages
  if (message.length > 100) {
    message = `${message.substring(0, 100)}...`
  }

  return message
}

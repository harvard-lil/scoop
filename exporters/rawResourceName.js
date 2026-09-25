/**
 * Builds the ZIP resource name for a raw HTTP exchange:
 * `raw/<type>_<timestamp>_<id>`.
 *
 * The timestamp is the exchange's date as 17 digits, `YYYYMMDDhhmmssSSS`, in
 * UTC: the web-archiving convention for timestamps in file names (the 14-digit
 * GMT form of ARC and WARC, with milliseconds, as Heritrix and Browsertrix
 * write it). Unlike an ISO 8601 timestamp, it fits the WACZ resource-name
 * pattern, `^[-a-z0-9._/]+$`.
 *
 * @param {'request'|'response'} type - Raw exchange type.
 * @param {Date} date - Exchange timestamp.
 * @param {string} id - Exchange identifier.
 * @returns {string} WACZ resource name.
 */
export function rawResourceName (type, date, id) {
  const timestamp = date.toISOString().replace(/[^\d]/g, '')
  return `raw/${type}_${timestamp}_${id}`
}

/**
 * The 17-digit UTC timestamp written by `rawResourceName`.
 * @constant
 */
const TIMESTAMP = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})(\d{3})$/

/**
 * Reads the timestamp part of a raw resource name back into a date.
 *
 * Accepts the 17-digit UTC form written by `rawResourceName`, and the ISO 8601
 * timestamp that earlier versions wrote (`2026-07-08T15:21:43.602Z`), so that
 * archives made before the change can still be imported.
 *
 * @param {string} value - The timestamp part of a raw resource name.
 * @returns {Date} Invalid if the value is in neither form.
 */
export function parseRawResourceDate (value) {
  const digits = value.match(TIMESTAMP)
  if (digits) {
    const [, year, month, day, hours, minutes, seconds, milliseconds] = digits.map(Number)
    return new Date(Date.UTC(year, month - 1, day, hours, minutes, seconds, milliseconds))
  }
  return new Date(value)
}

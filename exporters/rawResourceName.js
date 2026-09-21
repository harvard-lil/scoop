/**
 * Builds the ZIP resource name for a raw HTTP exchange.
 *
 * @param {'request'|'response'} type - Raw exchange type.
 * @param {Date} date - Exchange timestamp.
 * @param {string} id - Exchange identifier.
 * @returns {string} WACZ resource name.
 */
export function rawResourceName (type, date, id) {
  const timestamp = date.toISOString().replace(/[:.]/g, '-').toLowerCase()
  return `raw/${type}_${timestamp}_${id}`
}

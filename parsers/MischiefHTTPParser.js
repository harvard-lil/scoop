import { HTTPParser } from 'http-parser-js'

/**
 * @class MischiefHTTPParser
 *
 * @classdesc
 * Parser for raw HTTP exchanges
 *
 * @see {@link https://github.com/creationix/http-parser-js/blob/master/standalone-example.js}
 */
export class MischiefHTTPParser {
  /**
   * Maps HTTP headers into an key / value association.
   * @param {Array} headers - Parsed HTTP headers presented as an array.
   * @returns {object}
   */
  static headersArrayToMap (headers) {
    if (!headers || headers?.constructor?.name !== 'Array' || headers.length < 2) {
      return {}
    }

    return Object.fromEntries(
      headers.reduce(
        (result, _value, index, sourceArray) =>
          index % 2 === 0 ? [...result, sourceArray.slice(index, index + 2)] : result,
        []
      )
    )
  }

  /**
   * Parses raw HTTP request bytes into an object using http-parser-js.
   * @param {Buffer} input - Raw HTTP request bytes
   * @returns {{
   *   shouldKeepAlive: boolean,
   *   upgrade: boolean,
   *   method: string,
   *   url: string,
   *   versionMajor: number,
   *   versionMinor: number,
   *   headers: Array,
   *   body: Buffer,
   *   trailers: Array
   * }}
   */
  static parseRequest (input) {
    const parser = new HTTPParser(HTTPParser.REQUEST)
    let complete = false
    let shouldKeepAlive
    let upgrade
    let method
    let url
    let versionMajor
    let versionMinor
    let headers = []
    let trailers = []
    const bodyChunks = []

    if (input instanceof Buffer === false) {
      throw new Error('input must be a buffer.')
    }

    parser[HTTPParser.kOnHeadersComplete] = function (req) {
      shouldKeepAlive = req.shouldKeepAlive
      upgrade = req.upgrade
      method = HTTPParser.methods[req.method]
      url = req.url
      versionMajor = req.versionMajor
      versionMinor = req.versionMinor
      headers = req.headers
    }

    parser[HTTPParser.kOnBody] = function (chunk, offset, length) {
      bodyChunks.push(chunk.slice(offset, offset + length))
    }

    // This is actually the event for trailers, go figure.
    parser[HTTPParser.kOnHeaders] = function (t) {
      trailers = t
    }

    parser[HTTPParser.kOnMessageComplete] = function () {
      complete = true
    }

    // Since we are sending the entire Buffer at once here all callbacks above happen synchronously.
    // The parser does not do _anything_ asynchronous.
    // However, you can of course call execute() multiple times with multiple chunks, e.g. from a stream.
    // But then you have to refactor the entire logic to be async (e.g. resolve a Promise in kOnMessageComplete and add timeout logic).
    parser.execute(input)
    parser.finish()

    if (!complete) {
      throw new Error('Could not parse request.')
    }

    const body = Buffer.concat(bodyChunks)

    return {
      shouldKeepAlive,
      upgrade,
      method,
      url,
      versionMajor,
      versionMinor,
      headers,
      body,
      trailers
    }
  }

  /**
   * Parses raw HTTP response bytes into an object using http-parser-js.
   * @param {Buffer} input - Raw HTTP response bytes
   * @returns {{
   *   shouldKeepAlive: boolean,
   *   upgrade: boolean,
   *   statusCode: number,
   *   statusMessage: string,
   *   versionMajor: number,
   *   versionMinor: number,
   *   headers: Array,
   *   body: Buffer,
   *   trailers: Array
   * }}
   */
  static parseResponse (input) {
    const parser = new HTTPParser(HTTPParser.RESPONSE)
    let complete = false // eslint-disable-line
    let shouldKeepAlive
    let upgrade
    let statusCode
    let statusMessage
    let versionMajor
    let versionMinor
    let headers = []
    let trailers = []
    const bodyChunks = []

    if (input instanceof Buffer === false) {
      throw new Error('input must be a buffer.')
    }

    parser[HTTPParser.kOnHeadersComplete] = function (res) {
      shouldKeepAlive = res.shouldKeepAlive
      upgrade = res.upgrade
      statusCode = res.statusCode
      statusMessage = res.statusMessage
      versionMajor = res.versionMajor
      versionMinor = res.versionMinor
      headers = res.headers
    }

    parser[HTTPParser.kOnBody] = function (chunk, offset, length) {
      bodyChunks.push(chunk.slice(offset, offset + length))
    }

    // This is actually the event for trailers, go figure.
    parser[HTTPParser.kOnHeaders] = function (t) {
      trailers = t
    }

    parser[HTTPParser.kOnMessageComplete] = function () {
      complete = true
    }

    // Since we are sending the entire Buffer at once here all callbacks above happen synchronously.
    // The parser does not do _anything_ asynchronous.
    // However, you can of course call execute() multiple times with multiple chunks, e.g. from a stream.
    // But then you have to refactor the entire logic to be async (e.g. resolve a Promise in kOnMessageComplete and add timeout logic).
    parser.execute(input)
    parser.finish()

    const body = Buffer.concat(bodyChunks)

    return {
      shouldKeepAlive,
      upgrade,
      statusCode,
      statusMessage,
      versionMajor,
      versionMinor,
      headers,
      body,
      trailers
    }
  }
}

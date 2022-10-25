// via: https://github.com/creationix/http-parser-js/blob/master/standalone-example.js
import { HTTPParser as _HTTPParser } from 'http-parser-js';

export class MischiefHTTPParser {

  static headersToMap(headers) {
    return Object.fromEntries(
      headers.reduce(
        (result, value, index, sourceArray) =>
          index % 2 === 0 ? [...result, sourceArray.slice(index, index + 2)] : result,
        []
      )
    );
  }

  static parseRequest(input) {
    const parser = new _HTTPParser(_HTTPParser.REQUEST);
    let complete = false;
    let shouldKeepAlive;
    let upgrade;
    let method;
    let url;
    let versionMajor;
    let versionMinor;
    let headers = [];
    let trailers = [];
    const bodyChunks = [];

    parser[_HTTPParser.kOnHeadersComplete] = function (req) {
      shouldKeepAlive = req.shouldKeepAlive;
      upgrade = req.upgrade;
      method = _HTTPParser.methods[req.method];
      url = req.url;
      versionMajor = req.versionMajor;
      versionMinor = req.versionMinor;
      headers = req.headers;
    };

    parser[_HTTPParser.kOnBody] = function (chunk, offset, length) {
      bodyChunks.push(chunk.slice(offset, offset + length));
    };

    // This is actually the event for trailers, go figure.
    parser[_HTTPParser.kOnHeaders] = function (t) {
      trailers = t;
    };

    parser[_HTTPParser.kOnMessageComplete] = function () {
      complete = true;
    };

    // Since we are sending the entire Buffer at once here all callbacks above happen synchronously.
    // The parser does not do _anything_ asynchronous.
    // However, you can of course call execute() multiple times with multiple chunks, e.g. from a stream.
    // But then you have to refactor the entire logic to be async (e.g. resolve a Promise in kOnMessageComplete and add timeout logic).
    parser.execute(input);
    parser.finish();

    if (!complete) {
      throw new Error('Could not parse request');
    }

    const body = Buffer.concat(bodyChunks);

    return {
      shouldKeepAlive,
      upgrade,
      method,
      url,
      versionMajor,
      versionMinor,
      headers,
      body,
      trailers,
    };
  }

  static parseResponse(input) {
    const parser = new _HTTPParser(_HTTPParser.RESPONSE);
    let complete = false;
    let shouldKeepAlive;
    let upgrade;
    let statusCode;
    let statusMessage;
    let versionMajor;
    let versionMinor;
    let headers = [];
    let trailers = [];
    const bodyChunks = [];

    parser[_HTTPParser.kOnHeadersComplete] = function (res) {
      shouldKeepAlive = res.shouldKeepAlive;
      upgrade = res.upgrade;
      statusCode = res.statusCode;
      statusMessage = res.statusMessage;
      versionMajor = res.versionMajor;
      versionMinor = res.versionMinor;
      headers = res.headers;
    };

    parser[_HTTPParser.kOnBody] = function (chunk, offset, length) {
      bodyChunks.push(chunk.slice(offset, offset + length));
    };

    // This is actually the event for trailers, go figure.
    parser[_HTTPParser.kOnHeaders] = function (t) {
      trailers = t;
    };

    parser[_HTTPParser.kOnMessageComplete] = function () {
      complete = true;
    };

    // Since we are sending the entire Buffer at once here all callbacks above happen synchronously.
    // The parser does not do _anything_ asynchronous.
    // However, you can of course call execute() multiple times with multiple chunks, e.g. from a stream.
    // But then you have to refactor the entire logic to be async (e.g. resolve a Promise in kOnMessageComplete and add timeout logic).
    parser.execute(input);
    parser.finish();

    const body = Buffer.concat(bodyChunks);

    return {
      shouldKeepAlive,
      upgrade,
      statusCode,
      statusMessage,
      versionMajor,
      versionMinor,
      headers,
      body,
      trailers,
    };
  }
}

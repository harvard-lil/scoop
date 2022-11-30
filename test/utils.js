import { Mischief } from '../Mischief.js';
import { MischiefProxyExchange } from '../exchanges/MischiefProxyExchange.js'
import { MischiefGeneratedExchange } from '../exchanges/MischiefGeneratedExchange.js'

export const defaultTestCaptureOptions = {
  headless: true,
  captureVideoAsAttachment: false,
}

export function valueOf(source) {
  switch(source.constructor) {
    case Array: {
      return source.map(valueOf);
    }
    case Object: {
      return Object.fromEntries(Object.entries(source).map(([k, v]) => [k, valueOf(v)]));
    }
    case Mischief: {
      return filterProps(source, [
        'url',
        'options',
        'provenanceInfo',
        'exchanges'
      ]);
    }
    case MischiefProxyExchange: {
      return filterProps(source, [
        'id',
        'date',
        'requestRaw',
        'responseRaw'
      ]);
    }
    case MischiefGeneratedExchange: {
      return filterProps(source, [
        'id',
        'date',
        'description',
        'response'
      ]);
    }
    default: {
      return source;
    }
  }
}

function filterProps(obj, keep) {
  return Object.fromEntries(keep.map(k => [k, valueOf(obj[k])]))
}

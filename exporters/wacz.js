import { v4 as uuidv4 } from "uuid";
import { Writable } from "stream";
import { createHash } from "crypto";
import Archiver from "archiver";

import { Mischief } from "../Mischief.js";
import * as exporters from "../exporters/index.js";

/**
 * Mischief to WACZ converter.
 *
 * Note:
 * - Logs are added to capture object via `Mischief.addToLogs()`.
 *
 * @param {Mischief} capture
 * @returns {Promise<ArrayBuffer>}
 */

const FILES = {
  pages: {name: 'pages.jsonl', path: 'pages/pages.jsonl'},
  warc: {name: 'warc.warc', path: 'archive/warc.warc'},
  indexIDX: {name: 'index.idx', path: 'indexes/index.idx'},
  indexCDX: {name: 'index.cdx.gz', path: 'indexes/index.cdx.gz'},
  datapackage: {path: 'datapackage.json'},
  datapackageDigest: {path: 'datapackage-digest.json'}
};

export function wacz(capture) {
  return new Promise((resolve, reject) => {
    const validStates = [Mischief.states.PARTIAL, Mischief.states.COMPLETE];
    if (!(capture instanceof Mischief) || !validStates.includes(capture.state)) {
      throw new Error("`capture` must be a partial or complete Mischief object.");
    }

    const buffers = [];
    const converter = new Writable();
    converter._write = (chunk, encoding, cb) => {
      buffers.push(chunk)
      process.nextTick(cb)
    }
    converter.on('finish', () => { resolve(Buffer.concat(buffers)) })

    const archive = new Archiver('zip', { zlib: { level: 9 } });
    archive.on('error', err => { reject(err) });
    archive.pipe(converter);

    exporters.warc(capture).then((warcArrayBuffer) => {
      const warc = Buffer.from(warcArrayBuffer);
      archive.append(warc, {name: FILES.warc.path});

      const pages = generatePages(capture);
      archive.append(pages, {name: FILES.pages.path});

      const datapackage = generateDatapackage(Buffer.from(''), Buffer.from(''), warc, pages);
      archive.append(datapackage, {name: FILES.datapackage.path});

      const datapackageDigest = generateDatapackageDigest(datapackage);
      archive.append(datapackageDigest, {name: FILES.datapackageDigest.path});

      archive.finalize();
    });
  });
};

const hash = (buffer) => 'sha256:' + createHash('sha256').update(buffer).digest('hex');
const stringify = (obj) => JSON.stringify(obj, null, 2);

const generatePages = (capture) => {
  return Buffer.from([{"format": "json-pages-1.0", "id": "pages", "title": "All Pages", hasText: false},
                      {id: uuidv4(), url: capture.url, title: "", seed: true}].map(JSON.stringify).join('\n'));
};

const generateDatapackage = function(indexIDX, indexCDX, warc, pages) {
  return stringify({
    "profile": "data-package",
    "resources": ['indexIDX', 'indexCDX', 'warc', 'pages'].map((el, i) => {
      return {
        ...FILES[el],
        "hash": hash(arguments[i]),
        "bytes": arguments[i].byteLength
      }
    }),
    "created": (new Date()).toISOString(),
    "wacz_version": "1.1.1",
    "software": "mischief"
  });
}

const generateDatapackageDigest = (datapackage) => {
  return stringify({
    path: FILES.datapackage.path,
    hash: hash(datapackage)
  });
};

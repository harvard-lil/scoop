import { v4 as uuidv4 } from "uuid";
import { Readable, Writable } from "stream";
import { promisify } from "util";
import { gzip } from "zlib";
const asyncGzip = promisify(gzip);
import { createHash } from "crypto";
import { CDXIndexer } from "../node_modules/warcio/dist/warcio.mjs";
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

export async function wacz(capture) {
  const validStates = [Mischief.states.PARTIAL, Mischief.states.COMPLETE];
  if (!(capture instanceof Mischief) || !validStates.includes(capture.state)) {
    throw new Error("`capture` must be a partial or complete Mischief object.");
  }

  const archive = new Archiver('zip', { zlib: { level: 9 } });

  const buffers = [];
  const converter = new Writable();
  converter._write = (chunk, _encoding, cb) => {
    buffers.push(chunk);
    process.nextTick(cb);
  }
  archive.pipe(converter);

  const warc = Buffer.from(await exporters.warc(capture));
  archive.append(warc, {name: FILES.warc.path});

  const pages = generatePages(capture);
  archive.append(pages, {name: FILES.pages.path});

  const indexCDX = await generateIndexCDX(warc)
  archive.append(indexCDX, {name: FILES.indexCDX.path});

  const indexIDX = generateIndexIDX();
  archive.append(indexIDX, {name: FILES.indexIDX.path});

  const datapackage = generateDatapackage(indexIDX, indexCDX, warc, pages);
  archive.append(datapackage, {name: FILES.datapackage.path});

  const datapackageDigest = generateDatapackageDigest(datapackage);
  archive.append(datapackageDigest, {name: FILES.datapackageDigest.path});

  await archive.finalize();
  return Buffer.concat(buffers);
};

const hash = (buffer) => 'sha256:' + createHash('sha256').update(buffer).digest('hex');
const stringify = (obj) => JSON.stringify(obj, null, 2);

const generatePages = (capture) => {
  return Buffer.from([{"format": "json-pages-1.0", "id": "pages", "title": "All Pages"},
                      {id: uuidv4(), url: capture.url, ts: (new Date()).toISOString()}].map(JSON.stringify).join('\n'));
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
};

const generateDatapackageDigest = (datapackage) => {
  return stringify({
    path: FILES.datapackage.path,
    hash: hash(datapackage)
  });
};

const generateIndexCDX = async (warcBuffer) => {
  const buffers = [];
  const converter = new Writable();
  converter._write = (chunk, _encoding, cb) => {
    buffers.push(chunk)
    process.nextTick(cb)
  }

  // CDXIndexer expects an array of files of the format {filename: string, reader: stream}
  await new CDXIndexer({format: 'cdxj'}, converter)
    .run([{filename: FILES.warc.name, reader: Readable.from(warcBuffer)}]);

  return await asyncGzip(Buffer.concat(buffers));
}

const generateIndexIDX = () => {
  return '!meta 0 ' + JSON.stringify({format: "cdxj-gzip-1.0", filename: FILES.indexCDX.name});
}

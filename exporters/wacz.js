/**
 * Mischief
 * @module exporters.warc
 * @author The Harvard Library Innovation Lab
 * @license MIT
 * @description Mischief to WACZ exporter.
 */

import { v4 as uuidv4 } from "uuid";
import { Readable, Writable } from "stream";
import { createHash } from "crypto";
import { CDXIndexer } from "warcio";
import Archiver from "archiver";

import { Mischief } from "../Mischief.js";
import * as exporters from "../exporters/index.js";

/**
 * Mischief capture to WARC converter.
 *
 * Note:
 * - Logs are added to capture object via `Mischief.addToLogs()`.
 *
 * @param {Mischief} capture
 * @returns {Promise<ArrayBuffer>}
 */

const FILES = {
  pages: {name: 'pages.jsonl', path: 'pages/pages.jsonl'},
  warc: {name: 'archive.warc', path: 'archive/archive.warc'},
  indexCDX: {name: 'index.cdx', path: 'indexes/index.cdx'},
  datapackage: {path: 'datapackage.json'},
  datapackageDigest: {path: 'datapackage-digest.json'}
};

export async function wacz(capture) {
  const validStates = [Mischief.states.PARTIAL, Mischief.states.COMPLETE];
  if (!(capture instanceof Mischief) || !validStates.includes(capture.state)) {
    throw new Error("`capture` must be a partial or complete Mischief object.");
  }

  const archive = new Archiver('zip', {store: true});

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

  const datapackage = generateDatapackage(capture, indexCDX, warc, pages);
  archive.append(datapackage, {name: FILES.datapackage.path});

  const datapackageDigest = generateDatapackageDigest(datapackage);
  archive.append(datapackageDigest, {name: FILES.datapackageDigest.path});

  await archive.finalize();
  return Buffer.concat(buffers);
};

const hash = (buffer) => 'sha256:' + createHash('sha256').update(buffer).digest('hex');
const stringify = (obj) => JSON.stringify(obj, null, 2);

const generatePages = (capture) => {
  return Buffer.from([
    {
      format: "json-pages-1.0",
      id: "pages",
      title: "All Pages"
    },
    {
      id: uuidv4(),
      url: capture.url,
      ts: capture.startedAt.toISOString(),
      title: `Web Archive for: ${capture.url}`
    },
    {
      id: uuidv4(),
      url: "file:///screenshot.png",
      ts: capture.startedAt.toISOString(),
      title: `Screenshot for: ${capture.url}`
    },
    {
      id: uuidv4(),
      url: "file:///dom-snapshot.html",
      ts: capture.startedAt.toISOString(),
      title: `DOM Snapshot for: ${capture.url}`
    },
  ].map(JSON.stringify).join('\n'));
};

const generateDatapackage = function(capture, indexCDX, warc, pages) {
  return stringify({
    profile: "data-package",
    software: "mischief",
    wacz_version: "1.1.1",
    created: (new Date()).toISOString(),
    mainPageUrl: capture.url,
    mainPageDate: capture.startedAt.toISOString(),
    resources: [indexCDX, warc, pages].map((data, i) => {
      return {
        ...FILES[['indexCDX', 'warc', 'pages'][i]],
        hash: hash(data),
        bytes: data.byteLength
      }
    })
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

  return Buffer.concat(buffers);
}

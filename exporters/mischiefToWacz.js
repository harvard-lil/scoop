/**
 * Mischief
 * @module exporters.mischiefToWacz
 * @author The Harvard Library Innovation Lab
 * @license MIT
 * @description Mischief to WACZ exporter.
 */

import { v4 as uuidv4 } from "uuid";
import path from "path";
import { Readable, Writable } from "stream";
import { createHash } from "crypto";
import { CDXIndexer } from "warcio";
import Archiver from "archiver";

import { Mischief } from "../Mischief.js";

/**
 * Mischief capture to WARC converter.
 *
 * Note:
 * - Logs are added to capture object via `Mischief.addToLogs()`.
 *
 * @param {Mischief} capture
 * @returns {Promise<ArrayBuffer>}
 */

export async function mischiefToWacz(capture, files = []) {
  const validStates = [Mischief.states.PARTIAL, Mischief.states.COMPLETE];
  if (!(capture instanceof Mischief) || !validStates.includes(capture.state)) {
    throw new Error("`capture` must be a partial or complete Mischief object.");
  }

  const warcFile = {
    path: 'archive/data.warc',
    data: Buffer.from(await capture.toWarc())
  };
  files.push(warcFile);

  files.push({
    path: 'pages/pages.jsonl',
    data: generatePages(capture)
  });

  files.push({
    path: 'indexes/index.cdx',
    data:  await generateIndexCDX(warcFile)
  });

  const datapackageFile = {
    path: 'datapackage.json',
    data: generateDatapackage(capture, files)
  };
  files.push(datapackageFile);

  files.push({
    path: 'datapackage-digest.json',
    data: generateDatapackageDigest(datapackageFile)
  });

  return await zip(files);
};

const hash = (buffer) => 'sha256:' + createHash('sha256').update(buffer).digest('hex');
const stringify = (obj) => JSON.stringify(obj, null, 2);

const generatePages = (capture) => {
  const pages = [];

  // Heading
  pages.push({
    format: "json-pages-1.0",
    id: "pages",
    title: "All Pages"
  });

  // Main page
  pages.push({
    id: capture.id,
    url: capture.url,
    ts: capture.startedAt.toISOString(),
    title: `Web archive of ${capture.url}`,
    size: capture.totalSize
  });

  // Other generated elements
  for (const exchange of capture.generatedExchanges) {
    pages.push({
      id: uuidv4(),
      url: exchange.response.url,
      ts: exchange.date.toISOString(),
      title: exchange.description
    });
  }

  return Buffer.from(pages.map(JSON.stringify).join('\n'));
};

const generateDatapackage = function(capture, files) {
  return stringify({
    profile: "data-package",
    software: "mischief",
    wacz_version: "1.1.1",
    created: (new Date()).toISOString(),
    mainPageUrl: capture.url,
    mainPageDate: capture.startedAt.toISOString(),
    resources: files.map((file) => {
      return {
        name: path.basename(file.path),
        path: file.path,
        hash: hash(file.data),
        bytes: file.data.byteLength
      }
    })
  });
};

const generateDatapackageDigest = (datapackageFile) => {
  return stringify({
    path: datapackageFile.path,
    hash: hash(datapackageFile.data)
  });
};

const generateIndexCDX = async (warcFile) => {
  const buffers = [];
  const converter = new Writable();
  converter._write = (chunk, _encoding, cb) => {
    buffers.push(chunk)
    process.nextTick(cb)
  }

  // CDXIndexer expects an array of files of the format {filename: string, reader: stream}
  await new CDXIndexer({format: 'cdxj'}, converter)
    .run([{filename: path.basename(warcFile.path), reader: Readable.from(warcFile.data)}]);

  return Buffer.concat(buffers);
}

const zip = async (files) => {
  const archive = new Archiver('zip', {store: true});

  const buffers = [];
  const converter = new Writable();
  converter._write = (chunk, _encoding, cb) => {
    buffers.push(chunk);
    process.nextTick(cb);
  }
  archive.pipe(converter);

  files.forEach(f => archive.append(f.data, {name: f.path}))

  await archive.finalize();
  return Buffer.concat(buffers);
}

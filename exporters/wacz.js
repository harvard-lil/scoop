import { createWriteStream } from "fs";
import { v4 as uuidv4 } from "uuid";
import { Writable } from "stream";
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

    const pages = [{"format": "json-pages-1.0", "id": "pages", "title": "All Pages", hasText: false},
                   {id: uuidv4(), url: capture.url, title: "", seed: true}].map(JSON.stringify).join('\n');
    archive.append(pages, {name: 'pages/pages.jsonl'});

    exporters.warc(capture).then((warc) => {
      archive.append(Buffer.from(warc), {name: 'archive/archive.warc'});
      archive.finalize();
    });
  });
};

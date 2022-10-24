import { Writable } from "stream";
import Archiver from "archiver";

import { Mischief } from "../Mischief.js";

export async function raw(capture) {
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

  for (const exchange of capture.exchanges) {
    for (const type of ['request', 'response']) {
      if(!exchange[`${type}Raw`]) { continue; }
      archive.append(
        exchange[`${type}Raw`],
        {name: `${type}_${exchange.date.toISOString()}_${exchange.id}`}
      );
    }
  }

  await archive.finalize();
  return Buffer.concat(buffers);
}

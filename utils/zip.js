import { Writable } from "stream";
import Archiver from "archiver";

export function isZip(buf) {
  return buf.toString('utf8', 0, 2) === 'PK';
}

export function usesStoreCompression(buf) {
  return buf.readUIntLE(8, 2) === 0;
}

export function fileNameLen(buf) {
  return buf.readUIntLE(26, 2);
}

export function extraFieldLen(buf) {
  return buf.readUIntLE(28, 2);
}

export function readBodyAsString(buf, byteLen) {
  return buf.toString(30 + fileNameLen(buf) + extraFieldLen(buf), byteLen);
}

export async function create(files, store = true) {
  const archive = new Archiver('zip', {store});

  const buffers = [];
  const converter = new Writable();
  converter._write = (chunk, _encoding, cb) => {
    buffers.push(chunk);
    process.nextTick(cb);
  }
  archive.pipe(converter);

  Object.entries(files).forEach(([name, data]) => {
    archive.append(data, {name})
  })

  await archive.finalize();
  return Buffer.concat(buffers);
}

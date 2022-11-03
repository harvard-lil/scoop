/**
 * Mischief
 * @module utils.WACZ
 * @author The Harvard Library Innovation Lab
 * @license MIT
 * @description WACZ builder.
 */

import path from "path";
import { Readable, Writable } from "stream";
import { createHash } from "crypto";

import { CDXIndexer } from "warcio";
import CONSTANTS from "../constants.js";
import * as zip from "../utils/zip.js";

export class WACZ {
  validations = [
    [/^archives\//, [this.assertWarc]],
    [/^indexes\//, [this.assertIndex]],
    [/^pages\//, [this.assertPages]]
  ]

/**
 * Checks to see if a buffer contains WARC data
 * using simple sniff tests that are imperfect but
 * helpful nonetheless.
 *
 * @param {string} fpath
 * @param {Buffer} fdata
 */
  assertWarc(fpath, fdata) {
    buf = Buffer.from(fdata);

    // If the first 4 bytes are "WARC", let's assume it's an uncompressed WARC
    if(buf.toString('utf8', 0, 4) === 'WARC'){
        return;
    }

    if(zip.isZip(buf)){
      if(!/\.warc\.gz$/.test(fpath)) {
        throw `${fpath}: must use .warc.gz extension when using zip`
      } else if(!zip.usesStoreCompression(fdata)){
        throw `${fpath}: must use STORE when compressing the zip`
      } else if(zip.readBodyAsString(fdata, 4) === 'WARC') {
        return;
      }
    }

    // None of the WARC sniff tests passed so throw a final error
    throw `${fpath}: must be a valid WARC file`;
  }

/**
 * Checks to see if a buffer contains CDXJ data
 * using simple sniff tests that are imperfect but
 * helpful nonetheless.
 *
 * @param {string} fpath
 * @param {Buffer} fdata
 */
  assertIndex(fpath, fdata) {
    // CDXJ's are newline delineated
    const lines = Buffer.from(fdata).toString().split('\n');
    // Grab the JSON blob from the first line and parse it
    const json = JSON.parse(lines[0].split(/ \d{14} /)[1]);
    // Use the url property of the JSON as a sniff test
    if(!json.url){
      throw `${fpath}: must be a valid CDXJ file`;
    }
  }

/**
 * Checks to see if a buffer contains Pages data
 * in JSON-Lines format using simple sniff tests
 * that are imperfect but helpful nonetheless.
 *
 * @param {string} fpath
 * @param {Buffer} fdata
 */
  assertPages(fpath, fdata) {
    // Parse the lines of JSON data
    const lines = Buffer.from(fdata).toString().split('\n').map(JSON.parse);
    // Get the last entry to avoid the first line header
    const entry = lines[lines.length - 1];
    // Both `url` and `ts` are required per the spec
    if(!entry.url) {
      throw `${fpath}: must be a valid JSON-Lines file with url properties`;
    } else if(!entry.ts) {
      throw `${fpath}: must be a valid JSON-Lines file with ts properties`;
    }
  }

/**
 * Given a file path, find validations that should apply
 * and run then against the data
 *
 * @param {string} fpath
 * @param {Buffer} fdata
 */
  validateFile(fpath, fdata) {
    this.validations
        .filter(([regex]) => regex.test(fpath))
        .forEach(([,assertions]) => {
          assertions.forEach(assert => assert(fpath, fdata))
        });
  }

  pages = [];

  datapackage = {};

  _filesProxy;

  get files() {
    if(!this._filesProxy){
      // initialize the proxy on first access
      // if it hasn't already been created
      this.files = {}
    }
    return this._filesProxy;
  }

  /**
   * Use a Proxy to validate any entries added to the `files` property
   */
  set files(obj) {
    // validate all properties on initial assignment
    Object.entries(obj).forEach(([fpath, fdata]) => {
      return this.validateFile(fpath, fdata);
    })

    // create a new proxy to handle additional assignments to `files`
    this._filesProxy = new Proxy(obj, {
      set: (target, fpath, fdata) => {
        this.validateFile(fpath, fdata);
        target[fpath] = fdata;
        return true;
      }
    });
  }

  /**
   * Generate a CDXJ index based on a list of files.
   * Defaults to using `this.files` but since the spec
   * allows multiple indexes, this function can be used
   * to generate against any set of files
   *
   * @param {Object} files - an object whose keys are the file paths and values are the file data
   */
  async generateIndexCDX(files = this.files) {
    const buffers = [];
    const converter = new Writable();
    converter._write = (chunk, _encoding, cb) => {
      buffers.push(chunk)
      process.nextTick(cb)
    }

    const warcs = Object.entries(files)
                        .filter(([fpath]) => /^archive\//.test(fpath))
                        .map(([fpath, fdata]) => {
                          return {
                            filename: path.basename(fpath),
                            reader: Readable.from(fdata)
                          }
                        })

    await new CDXIndexer({format: 'cdxj'}, converter).run(warcs);
    return Buffer.concat(buffers);
  }

  generatePages() {
    const jsonStr = [{
      format: "json-pages-1.0",
      id: "pages",
      title: "All Pages"
    }].concat(this.pages)
      .map(JSON.stringify)
      .join('\n')

    return Buffer.from(jsonStr);
  }

  generateDatapackage() {
    return stringify({
      ...this.datapackage,
      profile: "data-package",
      wacz_version: CONSTANTS.WACZ_VERSION,
      software: CONSTANTS.SOFTWARE,
      created: (new Date()).toISOString(),
      resources: Object.entries(this.files).map(([fpath, fdata]) => {
        return {
          name: path.basename(fpath),
          path: fpath,
          hash: hash(fdata),
          bytes: fdata.byteLength
        }
      })
    })
  }

  generateDatapackageDigest() {
    if(!this.files["datapackage.json"]){
      throw "datapackage.json must be present to generate datapackage-digest.json"
    }

    return stringify({
      path: 'datapackage.json',
      hash: hash(this.files['datapackage.json'])
    });
  }

  async finalize(autoindex = true) {
    if(dirEmpty(this.files, "archive")){
      throw "at least one WARC must be present in the archive directory";
    }

    if(autoindex) {
      const index = await this.generateIndexCDX();
      this.files["indexes/index.cdx"] = index;
    } else if(dirEmpty(this.files, "indexes")){
      throw "at least one CDXJ index must be present in the indexes directory";
    }

    if(this.pages.length) {
      this.files['pages/pages.jsonl'] = this.generatePages();
    } else {
      throw "at least one page must be present";
    }

    // Always autogenerated
    this.files['datapackage.json'] = this.generateDatapackage();
    this.files['datapackage-digest.json'] = this.generateDatapackageDigest();

    return await zip.create(this.files);
  }

  constructor(props = {}) {
    // Only accept props that reflect a defined property of `this`
    for (const [key, value] of Object.entries(props)) {
      if (key in this) {
        this[key] = value;
      }
    }

    return this;
  }
}

// Internal helpers

const dirEmpty = (files, dir) => {
  const regex = new RegExp(`^${dir}\/.+`);
  return !Object.entries(files).find(([fpath]) => regex.test(fpath));
}

const hash = (buffer) => 'sha256:' + createHash('sha256').update(buffer).digest('hex');

const stringify = (obj) => JSON.stringify(obj, null, 2);

// Mischief helpers

export function mischiefExchangeToPageLine(exchange) {
  return {
    id: exchange.id,
    url: exchange.response.url,
    ts: exchange.date.toISOString(),
    title: exchange.description || `Web archive of ${exchange.response.url}`
  }
}
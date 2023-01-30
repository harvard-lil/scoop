import path from 'path'
import { Readable, Writable } from 'stream'
import { createHash } from 'crypto'

import { CDXIndexer } from 'warcio'
import * as assertions from './assertions.js'
import * as CONSTANTS from '../constants.js'
import * as zip from '../utils/zip.js'

/**
 * WACZ builder
 */
export class WACZ {
  validations = [
    [/^archive\//, [this.assertWarc]],
    [/^indexes\//, [this.assertIndex]],
    [/^pages\//, [this.assertPages]]
  ]

  /** @type {?{url: string, token: ?string}}  */
  signingServer

  created = (new Date()).toISOString()

  pages = []

  datapackage = {}

  /**
   * Additional information to be be added to `datapackage.json`.
   * Will be saved under "extras" if provided.
   * @type {?object}
   */
  datapackageExtras = null

  _filesProxy

  get files () {
    if (!this._filesProxy) {
      // initialize the proxy on first access
      // if it hasn't already been created
      this.files = {}
    }
    return this._filesProxy
  }

  /**
   * Use a Proxy to validate any entries added to the `files` property
   *
   * @param {any} obj - an object whose keys are the file paths and values are the file data
   */
  set files (obj) {
    // validate all properties on initial assignment
    Object.entries(obj).forEach(([fpath, fdata]) => {
      return this.validateFile(fpath, fdata)
    })

    // create a new proxy to handle additional assignments to `files`
    this._filesProxy = new Proxy(obj, {
      set: (target, fpath, fdata) => {
        this.validateFile(fpath, fdata)
        target[fpath] = fdata
        return true
      }
    })
  }

  /**
   * Assign properties on instance creation
   *
   * @returns {WACZ}
   */
  constructor (props = {}) {
    // Only accept props that reflect a defined property of `this`
    for (const [key, value] of Object.entries(props)) {
      if (key in this) {
        this[key] = value
      }
    }

    return this
  }

  /**
   * Checks to see if a buffer contains WARC data
   * using simple sniff tests that are imperfect but
   * helpful nonetheless.
   *
   * @param {string} fpath
   * @param {Buffer} fdata
   * @private
   */
  assertWarc (fpath, fdata) {
    const buf = Buffer.from(fdata)

    // If the first 4 bytes are "WARC", let's assume it's an uncompressed WARC
    if (buf.toString('utf8', 0, 4) === 'WARC') {
      return
    }

    if (zip.isGzip(buf)) {
      if (!/\.warc\.gz$/.test(fpath)) {
        throw new Error(`${fpath}: must use .warc.gz extension when using zip`)
      } else {
        // TODO: decode first few bytes of file to look for 'WARC' string
        return
      }
    }

    // None of the WARC sniff tests passed so throw a final error
    throw new Error(`${fpath}: must be a valid WARC file`)
  }

  /**
   * Checks to see if a buffer contains CDXJ data
   * using simple sniff tests that are imperfect but
   * helpful nonetheless.
   *
   * TODO: support zipped files e.g. "All index/*.cdx.gz files should be stored in ZIP with 'STORE' mode."
   *
   * @param {string} fpath
   * @param {Buffer} fdata
   * @private
   */
  assertIndex (fpath, fdata) {
    // CDXJ's are newline delineated
    const lines = Buffer.from(fdata).toString().split('\n')
    // Grab the JSON blob from the first line and parse it
    const json = JSON.parse(lines[0].split(/ \d{14} /)[1])
    // Use the url property of the JSON as a sniff test
    if (!json.url) {
      throw new Error(`${fpath}: must be a valid CDXJ file`)
    }
  }

  /**
   * Checks to see if a buffer contains Pages data
   * in JSON-Lines format using simple sniff tests
   * that are imperfect but helpful nonetheless.
   *
   * @param {string} fpath
   * @param {Buffer} fdata
   * @private
   */
  assertPages (fpath, fdata) {
    // Parse the lines of JSON data
    const lines = Buffer.from(fdata).toString().split('\n').map(JSON.parse)
    // Get the last entry to avoid the first line header
    const entry = lines[lines.length - 1]
    // Both `url` and `ts` are required per the spec
    if (!entry.url) {
      throw new Error(`${fpath}: must be a valid JSON-Lines file with url properties`)
    } else if (!entry.ts) {
      throw new Error(`${fpath}: must be a valid JSON-Lines file with ts properties`)
    }
  }

  /**
   * Given a file path, find validations that should apply
   * and run then against the data
   *
   * @param {string} fpath
   * @param {Buffer} fdata
   */
  validateFile (fpath, fdata) {
    this.validations
      .filter(([regex]) => regex.test(fpath))
      .forEach(([, assertions]) => {
        assertions.forEach(assert => assert(fpath, fdata))
      })
  }

  /**
   * Generate a CDXJ index based on a list of files.
   * Defaults to using `this.files` but since the spec
   * allows multiple indexes, this function can be used
   * to generate against any set of files
   *
   * @param {any} [files=this.files] - an object whose keys are the file paths and values are the file data
   * @returns {Promise<Buffer>} - a buffer with the contents of the CDXJ Index
   */
  async generateIndexCDX (files = this.files) {
    const buffers = []
    const converter = new Writable()
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

    await new CDXIndexer({ format: 'cdxj' }).writeAll(warcs, converter)
    return Buffer.concat(buffers)
  }

  /**
   * Generates a JSON-Lines formatted list of pages
   *
   * @returns {Buffer} - a buffer with the contents of the pages files
   */
  generatePages () {
    const pages = [
      {
        format: 'json-pages-1.0',
        id: 'pages',
        title: 'All Pages'
      },
      ...this.pages
    ]

    return Buffer.from(pages.map(JSON.stringify).join('\n'))
  }

  /**
   * Generates a datapackage JSON based on all files in the WACZ
   *
   * @returns {string} - a string with the contents of the datapackage
   */
  generateDatapackage () {
    const datapackage = { ...this.datapackage }
    datapackage.profile = 'data-package'
    datapackage.wacz_version = CONSTANTS.WACZ_VERSION
    datapackage.software = `${CONSTANTS.SOFTWARE} ${CONSTANTS.VERSION}`
    datapackage.created = this.created

    // TODO: ignore datapackage-digest.json here if present, or throw error when assigned
    datapackage.resources = Object.entries(this.files).map(([fpath, fdata]) => {
      return {
        name: path.basename(fpath),
        path: fpath,
        hash: hash(fdata),
        bytes: fdata.byteLength
      }
    })

    // Set `mainPageUrl` and `mainPageDate`: pick first entry in `this.pages` that starts with "http"
    // TODO: set this using the pages/pages.jsonl buffer if present
    const mainPage = this.pages.find(page => page.url.startsWith('http'))
    if (mainPage) {
      datapackage.mainPageUrl = mainPage.url
      datapackage.mainPageDate = mainPage.ts
    }

    // Append additional data under "extras" if provided
    if (this.datapackageExtras) {
      datapackage.extras = this.datapackageExtras
    }

    return stringify(datapackage)
  }

  /**
   * Generates a datapackage-digest based on the datapackage JSON
   *
   * @returns {string} - a string with the contents of the datapackage-digest
   */
  async generateDatapackageDigest () {
    if (!this.files['datapackage.json']) {
      throw new Error('datapackage.json must be present to generate datapackage-digest.json')
    }

    const digest = {
      path: 'datapackage.json',
      hash: hash(this.files['datapackage.json'])
    }

    if (this.signingServer) {
      digest.signedData = await this.requestSignature({ hash: digest.hash, created: this.created })
    }

    return stringify(digest)
  }

  /**
   * Query a signature server to sign the WACZ
   *
   * @param {object} payload - Payload to be passed to the signing server
   * @param {string} payload.hash - sha256 hash of datapackage.json as included in datapackage-digest.json
   * @param {string} payload.created - ISO 8861 date from datapackage.json, marking when it was created
   * @return {Promise<object>} a promise of https.request
   */
  async requestSignature (payload) {
    const url = new URL(this.signingServer.url)
    const body = stringify(payload)
    const headers = { 'Content-Type': 'application/json' }

    if (this.signingServer.token) {
      headers.Authorization = this.signingServer.token
    }

    const resp = await fetch(url, { method: 'POST', headers, body })
    const json = await resp.json()
    assertValidSignatureResponse(json)
    return json
  }

  /**
   * Validates that the requirements for a WACZ are met and generates
   * a datapackage, datapackage-digest, and (optionally) CDXJ index
   *
   * @param {boolean} [autoindex=true] - automatically create a CDXJ index
   * @returns {Promise<Buffer>} - a buffer with the zipped contents of the WACZ
   */
  async finalize (autoindex = true) {
    if (dirEmpty(this.files, 'archive')) {
      throw new Error('at least one WARC must be present in the archive directory')
    }

    if (autoindex) {
      const index = await this.generateIndexCDX()
      this.files['indexes/index.cdx'] = index
    } else if (dirEmpty(this.files, 'indexes')) {
      throw new Error('at least one CDXJ index must be present in the indexes directory')
    }

    if (!this.files['pages/pages.jsonl']) {
      if (this.pages.length) {
        this.files['pages/pages.jsonl'] = this.generatePages()
      } else {
        throw new Error('at least one page must be present')
      }
    }

    // Always autogenerated
    this.files['datapackage.json'] = this.generateDatapackage()
    this.files['datapackage-digest.json'] = await this.generateDatapackageDigest()

    return await zip.create(this.files)
  }
}

// Internal helpers

/**
 * Checks whether any files have been added to
 * the specified directory
 *
 * @param {object} files - an object whose keys are the file paths and values are the file data
 * @param {string} dir - the directory to check
 * @returns {boolean} True if the directory is empty
 * @private
 */
const dirEmpty = (files, dir) => {
  const regex = new RegExp(`^${dir}/.+`)
  return !Object.entries(files).find(([fpath]) => regex.test(fpath))
}

/**
 * Converts an object to a string using standarized spacing
 *
 * @param {any} obj - an JS object
 * @returns {string} a JSON string
 * @private
 */
const stringify = (obj) => JSON.stringify(obj, null, 2)

/**
 * Hashes a buffer to conform to the WACZ spec
 *
 * @param {Buffer} buffer
 * @returns {string} a sha256 hash prefixed with "sha256:"
 * @private
 */
export function hash (buffer) {
  return 'sha256:' + createHash('sha256').update(buffer).digest('hex')
}

/**
 * Format a MischiefExchange as needed for
 * the pages JSON-Lines
 *
 * @param {MischiefExchange} exchange
 * @returns {object}
 * @private
 */
export function mischiefExchangeToPageLine (exchange) {
  return {
    id: exchange.id,
    url: exchange.response.url,
    ts: exchange.date.toISOString(),
    title: exchange?.description || `High-Fidelity Web Capture of ${exchange.response.url}`
  }
}

/**
 * Asserts that the given data conforms to the WACZ signature data format spec.
 *
 * @param {Object} resp - a JSON object returned from a signing server
 * @throws {Error}
 * @see {@link https://specs.webrecorder.net/wacz-auth/0.1.0/#signature-data-format}
 * @private
 */
function assertValidSignatureResponse (resp) {
  const generalProps = {
    hash: assertions.assertSHA256WithPrefix,
    created: assertions.assertISO8861Date,
    software: assertions.assertString,
    // 'version': assertions.assertString, //TODO: verify whether this is required; some implementations append this to the end of `software`
    signature: assertions.assertBase64
  }

  const anonSigProps = {
    publicKey: assertions.assertBase64
  }

  const domainIdentProps = {
    domain: assertions.assertDomainName,
    domainCert: assertions.assertPEMCertificateChain,
    timeSignature: assertions.assertBase64,
    timestampCert: assertions.assertPEMCertificateChain
  }

  const propsToValidate = {
    ...generalProps,
    ...(resp.publicKey ? anonSigProps : domainIdentProps)
  }

  // crossSignedCert is optional
  if (resp.crossSignedCert) {
    propsToValidate.crossSignedCert = assertions.assertPEMCertificateChain
  }

  for (const [key, assert] of Object.entries(propsToValidate)) {
    assert(resp[key], `'${key}' key of signature server response is invalid due to the following error:`)
  }
}

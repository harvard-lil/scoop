/**
 * Mischief
 * @module Mischief
 * @author The Harvard Library Innovation Lab
 * @license MIT
 */

import os from 'os'
import util from 'util'
import { readFile, writeFile, rm, readdir, mkdir, mkdtemp, access } from 'fs/promises'
import { constants as fsConstants } from 'node:fs'

import { exec as execCB } from 'child_process'

import log from 'loglevel'
import logPrefix from 'loglevel-plugin-prefix'
import nunjucks from 'nunjucks'
import { Address4, Address6 } from '@laverdet/beaugunderson-ip-address'
import { v4 as uuidv4 } from 'uuid'
import { chromium } from 'playwright'
import { getOSInfo } from 'get-os-info'

import { MischiefGeneratedExchange } from './exchanges/index.js'
import { MischiefOptions } from './MischiefOptions.js'
import { castBlocklistMatcher, searchBlocklistFor } from './utils/blocklist.js'
import CONSTANTS from './constants.js'
import * as intercepters from './intercepters/index.js'
import * as exporters from './exporters/index.js'
import * as importers from './importers/index.js'

const exec = util.promisify(execCB)

/**
 * Path to "assets" folder.
 * @constant
 */
export const ASSETS_DIR = './assets/'

/**
 * Experimental single-page web archiving library using Playwright.
 * Uses a proxy to allow for comprehensive and raw network interception.
 *
 * Usage:
 * ```javascript
 * import { Mischief } from "mischief";
 *
 * const myCapture = new Mischief("https://example.com");
 * await myCapture.capture();
 * const myArchive = await myCapture.toWarc();
 * ```
 */
export class Mischief {
  id = uuidv4()

  /**
   * Enum-like states that the capture occupies.
   * @readonly
   * @enum {number}
   */
  static states = {
    INIT: 0,
    SETUP: 1,
    CAPTURE: 2,
    COMPLETE: 3,
    PARTIAL: 4,
    FAILED: 5,
    CANCELED: 6
  }

  /**
   * Current state of the capture.
   * Should only contain states defined in `states`.
   * @type {number}
   */
  state = Mischief.states.INIT

  /**
   * URL to capture.
   * @type {string}
   */
  url = ''

  /**
   * Current settings.
   * Should only contain keys defined in `MischiefOptions`.
   * @type {object}
   */
  options = {}

  /**
   * Array of HTTP exchanges that constitute the capture.
   * @type {MischiefExchange[]}
   */
  exchanges = []

  /**
   * URLs of exchanges that need to be discarded after teardown.
   * Example: "noarchive" documents in <iframe>s.
   * @type {string[]}
   */
  urlsToDiscard = []

  /**
   * Logger.
   * Logging level controlled via `MischiefOptions.logLevel`.
   * @type {?log.Logger}
   */
  log = log

  /**
   * Path to the capture-specific temporary folder created by `setup()`.
   * Will be a child folder of the path defined in `this.options.tmpFolderPath`.
   * @type {?string}
   */
  captureTmpFolderPath = null

  /**
   * The time at which the page was crawled.
   * @type {Date}
   */
  startedAt

  /**
   * The Playwright browser instance for this capture.
   * @type {Browser}
   */
  #browser

  /**
   * Reference to the intercepter chosen for capture.
   * @type {intercepters.MischiefIntercepter}
   */
  intercepter

  /**
   * A mirror of options.blocklist with IPs parsed for matching
   * @type {(String|RegEx|Address4|Address6)[]}
   */
  blocklist = []

  /**
   * Will only be populated if `options.provenanceSummary` is `true`.
   * @type {object}
   */
  provenanceInfo = {
    blockedRequests: []
  }

  /**
   * @param {string} url - Must be a valid HTTP(S) url.
   * @param {object} [options={}] - See `MischiefOptions.defaults` for details.
   */
  constructor (url, options = {}) {
    this.options = MischiefOptions.filterOptions(options)
    this.blocklist = this.options.blocklist.map(castBlocklistMatcher)
    this.url = this.filterUrl(url)

    // Logging setup (level, output formatting)
    logPrefix.reg(this.log)
    logPrefix.apply(log, {
      format (level, name, timestamp) {
        const timestampColor = CONSTANTS.LOGGING_COLORS.DEFAULT
        const msgColor = CONSTANTS.LOGGING_COLORS[level.toUpperCase()]
        return `${timestampColor(`[${timestamp}]`)} ${msgColor(level)}`
      }
    })
    this.log.setLevel(this.options.logLevel)

    this.intercepter = new intercepters[this.options.intercepter](this)
  }

  /**
   * Main capture process.
   *
   * @returns {Promise<boolean>}
   */
  async capture () {
    const options = this.options

    /**
     * @typedef MischiefCaptureStep
     * @property {string} name
     * @property {?function} setup
     * @property {function} main
     * @property {number[]} compatibleStates - Determines under which conditions this step's `main` function can run. Array of values based off `Mischief.states`.
     */

    /** @type {MischiefCaptureStep[]} */
    const steps = []

    //
    // Prepare capture steps
    //

    // Push step: Setup interceptor
    steps.push({
      name: 'Intercepter',
      main: async (page) => {
        await this.intercepter.setup(page)
      },
      compatibleStates: Object.values(Mischief.states)
    })

    // Push step: Initial page load
    steps.push({
      name: 'Initial page load',
      main: async (page) => {
        await page.goto(this.url, { waitUntil: 'load', timeout: options.loadTimeout })
      },
      compatibleStates: [Mischief.states.CAPTURE]
    })

    // Push step: "noarchive" check
    if (options.ignoreNoArchive === false) {
      steps.push({
        name: '"noarchive" directive check',
        main: async (page) => {
          await this.#enforceNoArchiveDirective(page)
        },
        compatibleStates: [Mischief.states.CAPTURE]
      })
    }

    // Push step: Browser scripts
    if (
      options.grabSecondaryResources ||
      options.autoPlayMedia ||
      options.runSiteSpecificBehaviors ||
      options.autoScroll
    ) {
      steps.push({
        name: 'Browser scripts',
        setup: async (page) => {
          await page.addInitScript({
            path: './node_modules/browsertrix-behaviors/dist/behaviors.js'
          })
          await page.addInitScript({
            content: `
              self.__bx_behaviors.init({
                autofetch: ${options.grabSecondaryResources},
                autoplay: ${options.autoPlayMedia},
                autoscroll: ${options.autoScroll},
                siteSpecific: ${options.runSiteSpecificBehaviors},
                timeout: ${options.behaviorsTimeout}
              });`
          })
        },
        main: async (page) => {
          await Promise.allSettled(
            page.frames().map((frame) => frame.evaluate('self.__bx_behaviors.run()'))
          )
        },
        compatibleStates: [Mischief.states.CAPTURE]
      })
    }

    // Push step: Wait for network idle
    steps.push({
      name: 'Wait for network idle',
      main: async (page) => {
        await page.waitForLoadState('networkidle', { timeout: options.networkIdleTimeout })
      },
      compatibleStates: [Mischief.states.CAPTURE]
    })

    // Push step: Screenshot
    if (options.screenshot) {
      steps.push({
        name: 'Screenshot',
        main: async (page) => {
          const url = 'file:///screenshot.png'
          const httpHeaders = { 'content-type': 'image/png' }
          const body = await page.screenshot({ fullPage: true })
          const isEntryPoint = true
          const description = `Capture Time Screenshot of ${this.url}`
          this.addGeneratedExchange(url, httpHeaders, body, isEntryPoint, description)
        },
        compatibleStates: [Mischief.states.CAPTURE]
      })
    }

    // Push step: DOM Snapshot
    if (options.domSnapshot) {
      steps.push({
        name: 'DOM snapshot',
        main: async (page) => {
          const url = 'file:///dom-snapshot.html'
          const httpHeaders = {
            'content-type': 'text/html',
            'content-disposition': 'Attachment'
          }
          const body = Buffer.from(await page.content())
          const isEntryPoint = true
          const description = `Capture Time DOM Snapshot of ${this.url}`

          this.addGeneratedExchange(url, httpHeaders, body, isEntryPoint, description)
        },
        compatibleStates: [Mischief.states.CAPTURE]
      })
    }

    // Push step: PDF Snapshot
    if (options.pdfSnapshot) {
      steps.push({
        name: 'PDF snapshot',
        main: async (page) => {
          await this.#takePdfSnapshot(page)
        },
        compatibleStates: [Mischief.states.CAPTURE]
      })
    }

    // Push step: Capture of in-page videos as attachment
    if (options.captureVideoAsAttachment) {
      steps.push({
        name: 'Out-of-browser capture of video as attachment',
        main: async () => {
          await this.#captureVideoAsAttachment()
        },
        compatibleStates: [Mischief.states.CAPTURE]
      })
    }

    // Push step: Provenance summary
    if (options.provenanceSummary) {
      steps.push({
        name: 'Provenance summary',
        main: async (page) => {
          await this.#captureProvenanceInfo(page)
        },
        compatibleStates: [Mischief.states.CAPTURE]
      })
    }

    // Push step: Teardown
    steps.push({
      name: 'Teardown',
      main: async () => {
        this.state = Mischief.states.COMPLETE
        await this.teardown()
      },
      compatibleStates: Object.values(Mischief.states)
    })

    // Push step: Cleanup
    steps.push({
      name: 'Cleanup',
      main: async () => {
        await this.cleanup()
      },
      compatibleStates: Object.values(Mischief.states)
    })

    //
    // Initialize capture
    //
    let page

    try {
      page = await this.setup()
      this.log.info(`Starting capture of ${this.url}.`)
      this.log.info(options)
      this.state = Mischief.states.CAPTURE
    } catch (err) {
      this.log.error('An error ocurred during capture setup.')
      this.log.trace(err)
      this.state = Mischief.states.FAILED
      return // exit early if the browser and proxy couldn't be launched
    }

    //
    // Call `setup()` method of steps that have one
    //
    for (const step of steps.filter((step) => step.setup)) {
      await step.setup(page)
    }

    //
    // Run capture steps
    //
    let i = -1
    while (i++ < steps.length - 1) {
      const step = steps[i]

      if (!step.compatibleStates.includes(this.state)) {
        this.log.warn(`STEP [${i + 1}/${steps.length}]: ${step.name} - skipped (incompatible state)`)
        continue
      }

      try {
        this.log.info(`STEP [${i + 1}/${steps.length}]: ${step.name}`)
        await step.main(page)
      } catch (err) {
        if (this.state === Mischief.states.PARTIAL) {
          this.log.warn(`STEP [${i + 1}/${steps.length}]: ${step.name} - ended due to max time or size reached.`)
        } else {
          this.log.warn(`STEP [${i + 1}/${steps.length}]: ${step.name} - failed.`)
          this.log.trace(err)
        }
      }
    }
  }

  /**
   * Sets up the proxy and Playwright resources, creates capture-specific temporary folder.
   *
   * @returns {Promise<boolean>}
   */
  async setup () {
    this.startedAt = new Date()
    this.state = Mischief.states.SETUP
    const options = this.options

    // Create "base" temporary folder if it doesn't exist
    let tmpFolderPathExists = false
    try {
      await access(this.options.tmpFolderPath)
      tmpFolderPathExists = true
    } catch (_err) {
      this.log.info(`Base temporary folder ${this.options.tmpFolderPath} does not exist or cannot be accessed. Mischief will attempt to create it.`)
    }

    if (!tmpFolderPathExists) {
      try {
        await mkdir(this.options.tmpFolderPath)
        await access(this.options.tmpFolderPath, fsConstants.W_OK)
        tmpFolderPathExists = true
      } catch (err) {
        this.log.warn(`Error while creating base temporary folder ${this.options.tmpFolderPath}.`)
        this.log.trace(err)
      }
    }

    // Create captures-specific temporary folder under base temporary folder
    try {
      this.captureTmpFolderPath = await mkdtemp(this.options.tmpFolderPath)
      this.captureTmpFolderPath += '/'
      await access(this.captureTmpFolderPath, fsConstants.W_OK)

      this.log.info(`Capture-specific temporary folder ${this.captureTmpFolderPath} created.`)
    } catch (err) {
      try {
        await rm(this.captureTmpFolderPath)
      } catch (err) { /* Ignore: Deletes the capture-specific folder if it was created, if possible. */ }

      throw new Error(`Mischief was unable to create a capture-specific temporary folder.\n${err}`)
    }

    // Playwright init
    const userAgent = chromium._playwright.devices['Desktop Chrome'].userAgent + options.userAgentSuffix
    this.log.info(`User Agent used for capture: ${userAgent}`)

    this.#browser = await chromium.launch({
      headless: options.headless,
      channel: 'chrome'
    })

    const context = await this.#browser.newContext({
      ...this.intercepter.contextOptions,
      userAgent
    })

    const page = await context.newPage()

    page.setViewportSize({
      width: options.captureWindowX,
      height: options.captureWindowY
    })

    const totalTimeoutTimer = setTimeout(() => {
      this.log.info(`totalTimeout of ${options.totalTimeout}ms reached. Ending further capture.`)
      this.state = Mischief.states.PARTIAL
      this.teardown()
    }, options.totalTimeout)

    this.#browser.on('disconnected', () => {
      clearTimeout(totalTimeoutTimer)
    })

    return page
  }

  /**
   * Tears down Playwright, intercepter resources, and capture-specific temporary folder.
   * @returns {Promise<boolean>}
   */
  async teardown () {
    this.log.info('Closing browser and intercepter.')
    await this.intercepter.teardown()
    await this.#browser.close()
    this.exchanges = this.intercepter.exchanges.concat(this.exchanges)
  }

  /**
   * Post-capture cleanup:
   * - Deletes capture-specific temporary folder
   * - Delete exchanges that are to be discarded and could not be intercepted
   */
  async cleanup () {
    // If the whole capture was canceled: flush all exchanges
    if (this.state === Mischief.states.CANCELED) {
      this.log.info('Capture canceled, clearing all exchanges.')
      this.exchanges = []
    }

    // Go over exchanges and remove exchanges that were specifically marked for deletion
    const exchangesToDelete = []
    for (let i = 0; i < this.exchanges.length; i++) {
      const exchange = this.exchanges[i]
      if (exchange?.response?.url && this.urlsToDiscard.includes(exchange.response.url)) {
        this.log.info(`Clearing exchange #${i} for url ${exchange?.response?.url}`)
        exchangesToDelete.push(i)
      }
    }

    for (const index of exchangesToDelete) {
      this.exchanges.splice(index, 1)
    }

    // Delete capture-specific temporary folder
    this.log.info(`Clearing capture-specific temporary folder ${this.captureTmpFolderPath}`)
    await rm(this.captureTmpFolderPath, { recursive: true, force: true })
  }

  /**
   * Checks the main documents as well as iframes for the "noarchive" directive and:
   * - Mark the capture as canceled if the main document is "noarchive"
   * - Mark urls of nested documents that are "noarchive" so they can be discarded down the road
   *
   * @param {object} page - Playwright "Page" object
   * @returns {void}
   * @private
   */
  async #enforceNoArchiveDirective (page) {
    const selector = `meta[name='${this.options.noArchiveMetaName}'][content*='noarchive']`

    // Main document
    const noArchive = await page.evaluate((selector) => {
      return document.querySelectorAll(selector).length
    }, selector)

    if (noArchive) {
      this.log.error(`${this.url} uses the "noarchive" directive. Canceling capture.`)
      this.state = Mischief.states.CANCELED
      return
    }

    // Nested documents
    for (const frame of page.mainFrame().childFrames()) {
      const noArchive = await frame.evaluate((selector) => {
        return document.querySelectorAll(selector).length
      }, selector)

      if (noArchive) {
        const url = frame.url()
        this.log.warn(`${url} (iframe) uses the "noarchive" directive. Captures of this document will be discarded.`)
        this.urlsToDiscard.push(frame.url())
      }
    }
  }

  /**
   * Runs `yt-dlp` on the current url to try and capture:
   * - The "main" video of the current page (`file:///video-extracted.mp4`)
   * - Associated subtitles (`file:///video-extracted-LOCALE.EXT`)
   * - Associated meta data (`file:///video-extracted-metadata.json`)
   *
   * These elements are added as "attachments" to the archive, for context / playback fallback purposes.
   * A summary file and entry point, `file:///video-extracted-summary.html`, will be generated in the process.
   *
   * @private
   */
  async #captureVideoAsAttachment () {
    const id = this.id
    const videoFilename = `${this.captureTmpFolderPath}${id}.mp4`
    const ytDlpPath = this.options.ytDlpPath

    let metadataRaw = null
    let metadataParsed = null

    const subtitlesAvailableLocales = []
    let subtitlesFormat = 'vtt'
    let videoSaved = false
    let metadataSaved = false
    let subtitlesSaved = false

    //
    // yt-dlp health check
    //
    try {
      const result = await exec(`${ytDlpPath} --version`)
      const version = result.stdout.trim()

      if (!version.match(/^[0-9]{4}\.[0-9]{2}\.[0-9]{2}$/)) {
        throw new Error(`Unknown version: ${version}`)
      }
    } catch (err) {
      throw new Error(`"yt-dlp" executable is not available or cannot be executed. ${err}`)
    }

    //
    // Try and pull video and video meta data from url
    //
    try {
      this.intercepter.recordExchanges = false

      const dlpOptions = [
        '--dump-json', // Will return JSON meta data via stdout
        '--no-simulate', // Forces download despites `--dump-json`
        '--no-warnings', // Prevents pollution of stdout
        '--no-progress', // (Same as above)
        '--write-subs', // Try to pull subs
        '--sub-langs', 'all',
        '--format', 'mp4', // Forces .mp4 format
        '--output', videoFilename,
        '--no-check-certificate',
        '--proxy', `'http://${this.options.proxyHost}:${this.options.proxyPort}'`,
        this.url
      ]

      const spawnOptions = {
        timeout: this.options.captureVideoAsAttachmentTimeout
      }

      const result = await exec(`${ytDlpPath} ${dlpOptions.join(' ')}`, spawnOptions)
      metadataRaw = result.stdout
    } catch {
      throw new Error(`No video found in ${this.url}.`)
    } finally {
      this.intercepter.recordExchanges = true
    }

    //
    // Try to add video to exchanges
    //
    try {
      const url = 'file:///video-extracted.mp4'
      const httpHeaders = { 'content-type': 'video/mp4' }
      const body = await readFile(videoFilename)
      const isEntryPoint = false // TODO: Reconsider whether this should be an entry point.

      this.addGeneratedExchange(url, httpHeaders, body, isEntryPoint)
      videoSaved = true
    } catch (err) {
      throw new Error(`Error while creating exchange for file:///video-extracted.mp4. ${err}`)
    }

    //
    // Try to add metadata to exchanges
    //
    try {
      metadataParsed = JSON.parse(metadataRaw) // May throw

      const url = 'file:///video-extracted-metadata.json'
      const httpHeaders = { 'content-type': 'application/json' }
      const body = Buffer.from(JSON.stringify(metadataParsed, null, 2))
      const isEntryPoint = false

      this.addGeneratedExchange(url, httpHeaders, body, isEntryPoint)
      metadataSaved = true
    } catch (err) {
      throw new Error(`Error while creating exchange for file:///video-extracted-medatadata.json. ${err}`)
    }

    //
    // Pull subtitles, if any.
    //
    try {
      for (const file of await readdir(this.captureTmpFolderPath)) {
        if (!file.startsWith(id)) {
          continue
        }

        if (!file.endsWith('.vtt') && !file.endsWith('.srt')) {
          continue
        }

        let locale = null
        subtitlesFormat = 'vtt';
        [, locale, subtitlesFormat] = file.split('.')

        // Example of valid locales: "en", "en-US"
        if (!locale.match(/^[a-z]{2}$/) && !locale.match(/[a-z]{2}-[A-Z]{2}/)) {
          continue
        }

        const url = `file:///video-extracted-subtitles-${locale}.${subtitlesFormat}`
        const httpHeaders = {
          'content-type': subtitlesFormat === 'vtt' ? 'text/vtt' : 'text/plain'
        }
        const body = await readFile(`${this.captureTmpFolderPath}${file}`)
        const isEntryPoint = false

        this.addGeneratedExchange(url, httpHeaders, body, isEntryPoint)
        subtitlesAvailableLocales.push(locale) // Keep track of available locales
        subtitlesSaved = true
      }
    } catch (err) {
      // Ignore subtitles-related errors.
      // console.log(err);
    }

    //
    // Generate summary page
    //
    try {
      const html = nunjucks.render(`${ASSETS_DIR}video-extracted-summary.njk`, {
        url: this.url,
        now: new Date().toISOString(),
        videoSaved,
        metadataSaved,
        subtitlesSaved,
        subtitlesAvailableLocales,
        subtitlesFormat,
        metadataParsed
      })

      const url = 'file:///video-extracted-summary.html'
      const httpHeaders = { 'content-type': 'text/html' }
      const body = Buffer.from(html)
      const isEntryPoint = true
      const description = `Extracted Video from: ${this.url}`

      this.addGeneratedExchange(url, httpHeaders, body, isEntryPoint, description)
    } catch (err) {
      throw new Error(`Error while creating exchange for file:///video-extracted-summary.html. ${err}`)
    }
  }

  /**
   * Tries to generate a PDF snapshot from Playwright and add it as a generated exchange (`file:///pdf-snapshot.pdf`).
   * If `ghostscript` is available, will try to compress the resulting PDF.
   * Dimensions of the PDF are based on current document width and height.
   *
   * @param {object} page - Playwright "Page" object
   * @private
   */
  async #takePdfSnapshot (page) {
    let pdf = null
    let dimensions = null
    const tmpFilenameIn = `${this.captureTmpFolderPath}${this.id}-raw.pdf`
    const tmpFilenameOut = `${this.captureTmpFolderPath}${this.id}-compressed.pdf`

    await page.emulateMedia({ media: 'screen' })

    // Pull dimensions from live browser
    dimensions = await page.evaluate(() => {
      const width = Math.max(document.body.scrollWidth, window.outerWidth)
      const height = Math.max(document.body.scrollHeight, window.outerHeight) + 50
      return { width, height }
    })

    // Generate PDF
    pdf = await page.pdf({
      printBackground: true,
      width: dimensions.width,
      height: dimensions.height
    })

    // Try to apply compression if Ghostscript is available
    try {
      await writeFile(tmpFilenameIn, pdf)

      await exec([
        'gs',
        '-sDEVICE=pdfwrite',
        '-dNOPAUSE',
        '-dBATCH',
        '-dJPEGQ=90',
        '-r150',
        `-sOutputFile=${tmpFilenameOut}`,
        `${tmpFilenameIn}`
      ].join(' '))

      pdf = await readFile(tmpFilenameOut)
    } catch (err) {
      this.log.warn('gs command (Ghostscript) is not available or failed. The PDF Snapshot will be stored uncompressed.')
      this.log.trace(err)
    }

    const url = 'file:///pdf-snapshot.pdf'
    const httpHeaders = { 'content-type': 'application/pdf' }
    const body = pdf
    const isEntryPoint = true
    const description = `Capture Time PDF Snapshot of ${this.url}`

    this.addGeneratedExchange(url, httpHeaders, body, isEntryPoint, description)
  }

  /**
   * Populates `this.provenanceInfo`, which is then used to generate a `file:///provenance-summary.html` exchange and entry point.
   * That property is also be used by `mischiefToWacz()` to populate the `extras` field of `datapackage.json`.
   *
   * Provenance info collected:
   * - Capture client IP, resolved using the endpoint provided in `MischiefOptions.publicIpResolverEndpoint`.
   * - Operating system details (type, name, major version, CPU architecture)
   * - Mischief version
   * - Mischief options object used during capture
   *
   * @param {object} page - Playwright "Page" object
   * @private
   */
  async #captureProvenanceInfo (page) {
    let captureIp = 'UNKNOWN'
    const osInfo = await getOSInfo()
    const userAgent = await page.evaluate(() => window.navigator.userAgent) // Source user agent from the browser in case it was altered during capture

    // Grab public IP address
    try {
      const response = await fetch(this.options.publicIpResolverEndpoint)
      const ip = await response.text()

      try {
        new Address4(ip) // eslint-disable-line
      } catch {
        try {
          new Address6(ip) // eslint-disable-line
        } catch {
          throw new Error(`${ip} is not a valid IP address.`)
        }
      }

      captureIp = ip
    } catch (err) {
      this.log.warn('Public IP address could not be found.')
      this.log.trace(err)
    }

    // Gather provenance info
    this.provenanceInfo = {
      ...this.provenanceInfo,
      captureIp,
      userAgent,
      software: CONSTANTS.SOFTWARE,
      version: CONSTANTS.VERSION,
      osType: os.type(),
      osName: osInfo.name,
      osVersion: osInfo.version,
      cpuArchitecture: os.machine(),
      mischiefOptions: structuredClone(this.options)
    }

    // Generate summary page
    try {
      const html = nunjucks.render(`${ASSETS_DIR}provenance-summary.njk`, {
        ...this.provenanceInfo,
        date: this.startedAt.toISOString(),
        url: this.url
      })

      const url = 'file:///provenance-summary.html'
      const httpHeaders = { 'content-type': 'text/html' }
      const body = Buffer.from(html)
      const isEntryPoint = true
      const description = 'Provenance Summary'

      this.addGeneratedExchange(url, httpHeaders, body, isEntryPoint, description)
    } catch (err) {
      throw new Error(`Error while creating exchange for file:///provenance-summary.html. ${err}`)
    }
  }

  /**
   * Generates a MischiefGeneratedExchange for generated content and adds it to `exchanges` unless time limit was reached.
   * @param {string} url
   * @param {object} httpHeaders
   * @param {Buffer} body
   * @param {boolean} isEntryPoint
   * @param {string} description
   * @returns
   */
  async addGeneratedExchange (url, httpHeaders, body, isEntryPoint = false, description = '') {
    const remainingSpace = this.options.maxSize - this.intercepter.byteLength

    if (this.state !== Mischief.states.CAPTURE ||
        body.byteLength >= remainingSpace) {
      this.state = Mischief.states.PARTIAL
      this.log.warn(`Generated exchange ${url} could not be saved (size limit reached).`)
      return
    }

    this.exchanges.push(
      new MischiefGeneratedExchange({
        description,
        isEntryPoint: Boolean(isEntryPoint),
        response: {
          url,
          headers: httpHeaders,
          versionMajor: 1,
          versionMinor: 1,
          statusCode: 200,
          statusMessage: 'OK',
          body
        }
      })
    )
  }

  /**
   * Filters a url to ensure it's suitable for capture.
   * This function throws if:
   * - `url` is not a valid url
   * - `url` is not an http / https url
   * - `url` matches a blocklist rule
   *
   * @param {string} url
   */
  filterUrl (url) {
    try {
      const filteredUrl = new URL(url) // Will throw if not a valid url

      if (filteredUrl.protocol !== 'https:' && filteredUrl.protocol !== 'http:') {
        throw new Error('Invalid protocol.')
      }

      url = filteredUrl.href
    } catch (err) {
      throw new Error(`Invalid url provided.\n${err}`)
    }

    const rule = this.blocklist.find(searchBlocklistFor(url))
    if (rule) {
      this.state = Mischief.states.CANCELED
      throw new Error(`Blocked url provided matching blocklist rule: ${rule}`)
    }

    return url
  }

  /**
   * (Shortcut) Export this Mischief capture to WARC.
   * @returns {Promise<ArrayBuffer>}
   */
  async toWarc () {
    return await exporters.mischiefToWarc(this)
  }

  /**
   * (Shortcut) Export this Mischief capture to WACZ.
   * @param {boolean} [includeRaw=true] - Include a copy of RAW Http exchanges to the wacz (under `/raw`)?
   * @param {object} signingServer - Optional server information for signing the WACZ
   * @param {string} signingServer.url - url of the signing server
   * @param {string} signingServer.token - Optional token to be passed to the signing server via the Authorization header
   * @returns {Promise<ArrayBuffer>}
   */
  async toWacz (includeRaw = true, signingServer) {
    return await exporters.mischiefToWacz(this, includeRaw, signingServer)
  }

  static async fromWacz (zipPath) {
    return await importers.waczToMischief(zipPath)
  }
}

/// <reference path="./options.types.js" />

import os from 'os'
import { readFile, rm, readdir, mkdir, mkdtemp, access } from 'fs/promises'
import { constants as fsConstants } from 'node:fs'
import { sep } from 'path'
import { createHash } from 'crypto'

import log from 'loglevel'
import logPrefix from 'loglevel-plugin-prefix'
import nunjucks from 'nunjucks'
import { Address4, Address6 } from '@laverdet/beaugunderson-ip-address'
import { v4 as uuidv4 } from 'uuid'
import { chromium } from 'playwright'
import { getOSInfo } from 'get-os-info'

import { exec } from './utils/exec.js'
import { ScoopGeneratedExchange } from './exchanges/index.js'
import { castBlocklistMatcher, searchBlocklistFor } from './utils/blocklist.js'

import * as CONSTANTS from './constants.js'
import * as intercepters from './intercepters/index.js'
import * as exporters from './exporters/index.js'
import * as importers from './importers/index.js'
import { filterOptions, defaults } from './options.js'

nunjucks.configure(CONSTANTS.TEMPLATES_PATH)

/**
 * @class Scoop
 *
 * @classdesc
 * Experimental single-page web archiving library using Playwright.
 * Uses a proxy to allow for comprehensive and raw network interception.
 *
 * @example
 * import { Scoop } from "scoop";
 *
 * const myCapture = await Scoop.capture("https://example.com");
 * const myArchive = await myCapture.toWARC();
 */
export class Scoop {
  /** @type {string} */
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
    RECONSTRUCTED: 6
  }

  /**
   * Current state of the capture.
   * Should only contain states defined in `states`.
   * @type {number}
   */
  state = Scoop.states.INIT

  /**
   * URL to capture.
   * @type {string}
   */
  url = ''

  /**
   * Current settings.
   * @type {ScoopOptions}
   */
  options = {}

  /**
   * Returns a copy of Scoop's default settings.
   * @type {ScoopOptions}
   */
  static get defaults () {
    return Object.assign({}, defaults)
  }

  /**
   * Array of HTTP exchanges that constitute the capture.
   * Only contains generated exchanged until `teardown()`.
   * @type {ScoopExchange[]}
   */
  exchanges = []

  /**
   * Logger.
   * Logging level controlled via the `logLevel` option.
   * @type {?log.Logger}
   */
  log = log

  /**
   * Path to the capture-specific temporary folder created by `setup()`.
   * Will be a child folder of the path defined in `CONSTANTS.TMP_PATH`.
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
   * @type {intercepters.ScoopIntercepter}
   */
  intercepter

  /**
   * A mirror of options.blocklist with IPs parsed for matching
   * @type {Array.<String|RegEx|Address4|Address6>}
   */
  blocklist = []

  /**
   * Captures information about the context of this capture.
   * @type {{
   *   captureIp: ?string,
   *   userAgent: ?string,
   *   software: ?string,
   *   version: ?string,
   *   osType: ?string,
   *   osName: ?string,
   *   osVersion: ?string,
   *   cpuArchitecture: ?string,
   *   blockedRequests: Array.<{url: string, ip: string, rule: string}>,
   *   noArchiveUrls: string[],
   *   ytDlpHash: string
   *   options: ScoopOptions,
   * }}
   */
  provenanceInfo = {
    blockedRequests: [],
    noArchiveUrls: []
  }

  /**
   * Info extracted by the browser about the page on initial load
   * @type {{
   *   title: ?string,
   *   description: ?string,
   *   url: ?string,
   *   faviconUrl: ?string,
   *   favicon: ?Buffer
   * }}
   */
  pageInfo = {}

  /**
   * @param {string} url - Must be a valid HTTP(S) url.
   * @param {?ScoopOptions} [options={}] - See {@link ScoopOptions}.
   */
  constructor (url, options = {}) {
    this.options = filterOptions(options)
    this.blocklist = this.options.blocklist.map(castBlocklistMatcher)
    this.url = this.filterUrl(url)

    // Logging setup (level, output formatting)
    logPrefix.reg(this.log)
    logPrefix.apply(log, {
      format (level, _name, timestamp) {
        const timestampColor = CONSTANTS.LOGGING_COLORS.DEFAULT
        const msgColor = CONSTANTS.LOGGING_COLORS[level.toUpperCase()]
        return `${timestampColor(`[${timestamp}]`)} ${msgColor(level)}`
      }
    })
    this.log.setLevel(this.options.logLevel)

    this.intercepter = new intercepters[this.options.intercepter](this)
  }

  /**
   * Instantiates a Scoop instance and runs the capture
   *
   * @param {string} url - Must be a valid HTTP(S) url.
   * @param {ScoopOptions} [options={}] - See {@link ScoopOptions}.
   * @returns {Promise<Scoop>}
   */
  static async capture (url, options) {
    const instance = new Scoop(url, options)
    await instance.capture()
    return instance
  }

  /**
   * Main capture process (internal).
   * @returns {Promise<void>}
   * @private
   */
  async capture () {
    const options = this.options

    /** @type {Array.<{name: String, setup: ?function, main: function, alwaysRun: ?boolean}>} */
    const steps = []

    //
    // Prepare capture steps
    //

    // Push step: Setup interceptor
    steps.push({
      name: 'Intercepter',
      main: async (page) => {
        await this.intercepter.setup(page)
      }
    })

    // Push step: early detection of non-web resources
    steps.push({
      name: 'Out-of-browser detection and capture of non-web resource',
      alwaysRun: true,
      main: async (page) => {
        await this.#detectAndCaptureNonWebContent(page)
      }
    })

    // Push step: Initial page load
    steps.push({
      name: 'Initial page load',
      main: async (page) => {
        await page.goto(this.url, { waitUntil: 'load', timeout: options.loadTimeout })
      }
    })

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
            path: `${CONSTANTS.BASE_PATH}${sep}node_modules${sep}browsertrix-behaviors${sep}dist${sep}behaviors.js`
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
        }
      })
    }

    // Push step: Wait for network idle
    steps.push({
      name: 'Wait for network idle',
      main: async (page) => {
        await page.waitForLoadState('networkidle', { timeout: options.networkIdleTimeout })
      }
    })

    // Push step: scroll up
    steps.push({
      name: 'Scroll-up',
      main: async (page) => {
        await page.evaluate(() => window.scrollTo(0, 0))
      }
    })

    // Push step: Screenshot
    if (options.screenshot) {
      steps.push({
        name: 'Screenshot',
        main: async (page) => {
          const url = 'file:///screenshot.png'
          const httpHeaders = new Headers({ 'content-type': 'image/png' })
          const body = await page.screenshot({ fullPage: true })
          const isEntryPoint = true
          const description = `Capture Time Screenshot of ${this.url}`
          this.addGeneratedExchange(url, httpHeaders, body, isEntryPoint, description)
        }
      })
    }

    // Push step: DOM Snapshot
    if (options.domSnapshot) {
      steps.push({
        name: 'DOM snapshot',
        main: async (page) => {
          const url = 'file:///dom-snapshot.html'
          const httpHeaders = new Headers({
            'content-type': 'text/html',
            'content-disposition': 'Attachment'
          })
          const body = Buffer.from(await page.content())
          const isEntryPoint = true
          const description = `Capture Time DOM Snapshot of ${this.url}`

          this.addGeneratedExchange(url, httpHeaders, body, isEntryPoint, description)
        }
      })
    }

    // Push step: PDF Snapshot
    if (options.pdfSnapshot) {
      steps.push({
        name: 'PDF snapshot',
        main: async (page) => {
          await this.#takePdfSnapshot(page)
        }
      })
    }

    // Push step: Capture of in-page videos as attachment
    if (options.captureVideoAsAttachment) {
      steps.push({
        name: 'Out-of-browser capture of video as attachment (if any)',
        main: async () => {
          await this.#captureVideoAsAttachment()
        }
      })
    }

    // Push step: Provenance summary
    if (options.provenanceSummary) {
      steps.push({
        name: 'Provenance summary',
        alwaysRun: true,
        main: async (page) => {
          await this.#captureProvenanceInfo(page)
        }
      })
    }

    // Push step: Capture page info
    steps.push({
      name: 'Capture page info',
      alwaysRun: true,
      main: async (page) => {
        await this.#capturePageInfo(page)
      }
    })

    // Push step: noarchive directive detection
    // TODO: Move this logic back to ScoopProxy.intercept() when new proxy implementation is ready.
    steps.push({
      name: 'Detecting "noarchive" directive',
      alwaysRun: true,
      main: async () => {
        for (const exchange of this.intercepter.exchanges) {
          this.intercepter.checkExchangeForNoArchive(exchange)
        }
      }
    })

    // Push step: Teardown
    steps.push({
      name: 'Teardown',
      alwaysRun: true,
      main: async () => {
        this.state = Scoop.states.COMPLETE
        await this.teardown()
      }
    })

    //
    // Initialize capture
    //
    let page

    try {
      page = await this.setup()
      this.log.info('Scoop was initialized with the following options:')
      this.log.info(options)
      this.log.info(`Starting capture of ${this.url}.`)
      this.state = Scoop.states.CAPTURE
    } catch (err) {
      this.log.error('An error ocurred during capture setup.')
      this.log.trace(err)
      this.state = Scoop.states.FAILED
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

      // Steps only run if Scoop is in CAPTURE state, unless `alwaysRun` is set.
      try {
        const shouldRun = this.state === Scoop.states.CAPTURE || step.alwaysRun

        if (shouldRun === true) {
          this.log.info(`STEP [${i + 1}/${steps.length}]: ${step.name}`)
          await step.main(page)
        } else {
          this.log.warn(`STEP [${i + 1}/${steps.length}]: ${step.name} (skipped)`)
        }
      // On error:
      // only deliver full trace if error is not due to time / size limit reached.
      } catch (err) {
        if (this.state === Scoop.states.PARTIAL) {
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
   * @returns {Promise<Page>} Resolves to a Playwright [Page]{@link https://playwright.dev/docs/api/class-page} object
   */
  async setup () {
    this.startedAt = new Date()
    this.state = Scoop.states.SETUP
    const options = this.options

    // Create "base" temporary folder if it doesn't exist
    let tmpDirExists = false
    try {
      await access(CONSTANTS.TMP_PATH)
      tmpDirExists = true
    } catch (_err) {
      this.log.info(`Base temporary folder ${CONSTANTS.TMP_PATH} does not exist or cannot be accessed. Scoop will attempt to create it.`)
    }

    if (!tmpDirExists) {
      try {
        await mkdir(CONSTANTS.TMP_PATH)
        await access(CONSTANTS.TMP_PATH, fsConstants.W_OK)
        tmpDirExists = true
      } catch (err) {
        this.log.warn(`Error while creating base temporary folder ${CONSTANTS.TMP_PATH}.`)
        this.log.trace(err)
      }
    }

    // Create captures-specific temporary folder under base temporary folder
    try {
      this.captureTmpFolderPath = await mkdtemp(CONSTANTS.TMP_PATH)
      this.captureTmpFolderPath += '/'
      await access(this.captureTmpFolderPath, fsConstants.W_OK)

      this.log.info(`Capture-specific temporary folder ${this.captureTmpFolderPath} created.`)
    } catch (err) {
      try {
        await rm(this.captureTmpFolderPath)
      } catch { /* Ignore: Deletes the capture-specific folder if it was created, if possible. */ }

      throw new Error(`Scoop was unable to create a capture-specific temporary folder.\n${err}`)
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

    const captureTimeoutTimer = setTimeout(() => {
      this.log.info(`captureTimeout of ${options.captureTimeout}ms reached. Ending further capture.`)
      this.state = Scoop.states.PARTIAL
      this.intercepter.recordExchanges = false
    }, options.captureTimeout)

    this.#browser.on('disconnected', () => {
      clearTimeout(captureTimeoutTimer)
    })

    return page
  }

  /**
   * Tears down Playwright, intercepter resources, and capture-specific temporary folder.
   * @returns {Promise<void>}
   */
  async teardown () {
    this.log.info('Closing browser and intercepter')
    await this.intercepter.teardown()
    await this.#browser.close()
    this.exchanges = this.intercepter.exchanges.concat(this.exchanges)

    this.log.info(`Clearing capture-specific temporary folder ${this.captureTmpFolderPath}`)
    await rm(this.captureTmpFolderPath, { recursive: true, force: true })
  }

  /**
   * Assesses whether `this.url` leads to a non-web resource and, if so:
   * - Captures it via a curl behind our proxy
   * - Sets capture state to `PARTIAL`
   *
   * @param {Page} page - A Playwright [Page]{@link https://playwright.dev/docs/api/class-page} object
   * @returns {Promise<void>}
   * @private
   */
  async #detectAndCaptureNonWebContent (page) {
    /** @type {?string} */
    let contentType = null

    /** @type {?number} */
    let contentLength = null

    /**
     * Time spent on the initial HEAD request, in ms.
     * @type {?number}
     */
    let headRequestTimeMs = null

    //
    // Is `this.url` leading to a text/html resource?
    //
    try {
      const before = new Date()
      const headRequest = await fetch(this.url, {
        method: 'HEAD',
        timeout: this.options.loadTimeout
      })
      const after = new Date()

      headRequestTimeMs = after - before

      contentType = headRequest.headers.get('Content-Type')
      contentLength = headRequest.headers.get('Content-Length')
    } catch (err) {
      this.log.trace(err)
      this.log.warn('Resource type detection failed - skipping')
      return
    }

    // If text/html, continue capture as normal
    if (contentType?.startsWith('text/html')) {
      this.log.info('Requested URL is a web page')
      return
    }

    this.log.warn(`Requested URL is not a web page (detected: ${contentType})`)
    this.log.info('Scoop will attempt to capture this resource out-of-browser')

    //
    // Check if curl is present
    //
    try {
      await exec('curl', ['-V'])
    } catch (err) {
      this.log.trace(err)
      this.log.warn('curl is not present on this system - skipping')
      return
    }

    //
    // Capture using curl behind proxy
    //
    try {
      const userAgent = await page.evaluate(() => window.navigator.userAgent) // Source user agent from the browser

      const curlOptions = [
        this.url,
        '--header', `"User-Agent: ${userAgent}"`,
        '--output', '/dev/null',
        '--proxy', `'http://${this.options.proxyHost}:${this.options.proxyPort}'`,
        '--insecure', // TBD: SSL checks are delegated to the proxy
        '--location',
        // This will be the only capture step running:
        // use all available time - time spent on first request
        '--max-time', Math.floor((this.options.captureTimeout - headRequestTimeMs) / 1000)
      ]

      await exec('curl', curlOptions)
    } catch (err) {
      this.log.trace(err)
    }

    //
    // Report on results and:
    // - Set capture state to PARTIAL if _anything_ was captured.
    // - Leave capture state to CAPTURE otherwise.
    //
    if (this.intercepter.exchanges.length > 0) {
      const intercepted = this.intercepter.exchanges[0]?.response?.body?.byteLength

      if (intercepted === Number(contentLength)) {
        this.log.info(`Resource fully captured (${contentLength} bytes)`)
      } else {
        this.log.warn(`Resource partially captured (${intercepted} of ${contentLength} bytes)`)
      }

      this.state = Scoop.states.PARTIAL
    } else {
      this.log.warn('Resource could not be captured')
    }
  }

  /**
   * Tries to populate `this.pageInfo`.
   * Captures page title, description, url and favicon url directly from the browser.
   * Will attempt to find the favicon in intercepted exchanges if running in headfull mode, and request it out-of-band otherwise.
   *
   * @param {Page} page - A Playwright [Page]{@link https://playwright.dev/docs/api/class-page} object
   * @returns {Promise<void>}
   * @private
   */
  async #capturePageInfo (page) {
    this.pageInfo = await page.evaluate(() => {
      return {
        title: document.title,
        description: document.querySelector("meta[name='description']")?.content,
        url: window.location.href,
        faviconUrl: document.querySelector("link[rel*='icon']")?.href,
        favicon: null
      }
    })

    if (!this.pageInfo.faviconUrl) {
      return
    }

    // If `headless`: request the favicon using curl.
    if (this.options.headless) {
      try {
        const userAgent = await page.evaluate(() => window.navigator.userAgent) // Source user agent from the browser

        const curlOptions = [
          this.pageInfo.faviconUrl,
          '--header', `"User-Agent: ${userAgent}"`,
          '--output', '/dev/null',
          '--proxy', `'http://${this.options.proxyHost}:${this.options.proxyPort}'`,
          '--insecure', // TBD: SSL checks are delegated to the proxy
          '--max-time', 1000
        ]

        await exec('curl', curlOptions)
      } catch (err) {
        this.log.warn(`Could not fetch favicon at url ${this.pageInfo.faviconUrl}.`)
        this.log.trace(err)
      }
    }

    // Look for favicon in exchanges
    for (const exchange of this.intercepter.exchanges) {
      if (exchange?.url && exchange.url === this.pageInfo.faviconUrl) {
        this.pageInfo.favicon = exchange.response.body
      }
    }
  }

  /**
   * Runs `yt-dlp` on the current url to try and capture:
   * - The "main" video(s) of the current page (`file:///video-extracted-x.mp4`)
   * - Associated subtitles (`file:///video-extracted-x.LOCALE.vtt`)
   * - Associated meta data (`file:///video-extracted-metadata.json`)
   *
   * These elements are added as "attachments" to the archive, for context / playback fallback purposes.
   * A summary file and entry point, `file:///video-extracted-summary.html`, will be generated in the process.
   *
   * @returns {Promise<void>}
   * @private
   */
  async #captureVideoAsAttachment () {
    const videoFilename = `${this.captureTmpFolderPath}video-extracted-%(autonumber)d.mp4`
    const ytDlpPath = this.options.ytDlpPath

    let metadataRaw = null
    let metadataParsed = null

    let videoSaved = false
    let metadataSaved = false
    let subtitlesSaved = false

    /**
     * Key: video filename (ex: "video-extracted-1").
     * Value: array of subtitle locales (ex: ["en-US", "fr-FR"])
     * @type {Object<string, string[]>}
     */
    const availableVideosAndSubtitles = {}

    //
    // yt-dlp health check
    //
    try {
      const version = await exec(ytDlpPath, ['--version']).then((v) => v.trim())

      if (!version.match(/^[0-9]{4}\.[0-9]{2}\.[0-9]{2}$/)) {
        throw new Error(`Unknown version: ${version}`)
      }
    } catch (err) {
      this.log.trace(err)
      throw new Error('"yt-dlp" executable is not available or cannot be executed.')
    }

    //
    // Try and pull video(s) and meta data from url
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
        '--output', `"${videoFilename}"`,
        '--no-check-certificate',
        '--proxy', `'http://${this.options.proxyHost}:${this.options.proxyPort}'`,
        this.url
      ]

      const spawnOptions = {
        timeout: this.options.captureVideoAsAttachmentTimeout,
        maxBuffer: 1024 * 1024 * 128
      }

      metadataRaw = await exec(ytDlpPath, dlpOptions, spawnOptions)
    } catch (err) {
      this.log.trace(err)
      throw new Error(`No video found in ${this.url}.`)
    } finally {
      this.intercepter.recordExchanges = true
    }

    //
    // Add available video(s) and subtitles to exchanges
    //
    for (const file of await readdir(this.captureTmpFolderPath)) {
      // Video
      if (file.startsWith('video-extracted-') && file.endsWith('.mp4')) {
        try {
          const url = `file:///${file}`
          const httpHeaders = new Headers({ 'content-type': 'video/mp4' })
          const body = await readFile(`${this.captureTmpFolderPath}${file}`)
          const isEntryPoint = false // TODO: Reconsider whether this should be an entry point.

          this.addGeneratedExchange(url, httpHeaders, body, isEntryPoint)
          videoSaved = true

          // Push to map of available videos and subtitles
          const index = file.replace('.mp4', '')

          if (!(index in availableVideosAndSubtitles)) {
            availableVideosAndSubtitles[index] = []
          }
        } catch (err) {
          this.log.warn(`Error while creating exchange for ${file}.`)
          this.log.trace(err)
        }
      }

      // Subtitles
      if (file.startsWith('video-extracted-') && file.endsWith('.vtt')) {
        try {
          const url = `file:///${file}`
          const httpHeaders = new Headers({ 'content-type': 'text/vtt' })
          const body = await readFile(`${this.captureTmpFolderPath}${file}`)
          const isEntryPoint = false
          const locale = file.split('.')[1]

          // Example of valid locales: "en", "en-US"
          if (!locale.match(/^[a-z]{2}$/) && !locale.match(/[a-z]{2}-[A-Z]{2}/)) {
            continue
          }

          this.addGeneratedExchange(url, httpHeaders, body, isEntryPoint)
          subtitlesSaved = true

          // Push to map of available videos and subtitles
          const index = file.replace('.vtt', '').replace(`.${locale}`, '')

          if (!(index in availableVideosAndSubtitles)) {
            availableVideosAndSubtitles[index] = []
          }

          availableVideosAndSubtitles[index].push(locale)
        } catch (err) {
          this.log.warn(`Error while creating exchange for ${file}.`)
          this.log.trace(err)
        }
      }
    }

    //
    // Try to add metadata to exchanges
    //
    try {
      metadataParsed = []

      // yt-dlp returns JSONL when there is more than 1 video
      for (const line of metadataRaw.split('\n')) {
        if (line) {
          metadataParsed.push(JSON.parse(line)) // May throw
        }
      }

      const url = 'file:///video-extracted-metadata.json'
      const httpHeaders = new Headers({ 'content-type': 'application/json' })
      const body = Buffer.from(JSON.stringify(metadataParsed, null, 2))
      const isEntryPoint = false

      this.addGeneratedExchange(url, httpHeaders, body, isEntryPoint)
      metadataSaved = true
    } catch (err) {
      this.log.warn('Error while creating exchange for file:///video-extracted-medatadata.json.')
      this.log.trace(err)
    }

    //
    // Generate summary page
    //
    try {
      const html = nunjucks.render('video-extracted-summary.njk', {
        url: this.url,
        now: new Date().toISOString(),
        videoSaved,
        metadataSaved,
        subtitlesSaved,
        availableVideosAndSubtitles,
        metadataParsed
      })

      const url = 'file:///video-extracted-summary.html'
      const httpHeaders = new Headers({ 'content-type': 'text/html' })
      const body = Buffer.from(html)
      const isEntryPoint = true
      const description = `Extracted Video data from: ${this.url}`

      this.addGeneratedExchange(url, httpHeaders, body, isEntryPoint, description)
    } catch (err) {
      this.log.warn('Error while creating exchange for file:///video-extracted-summary.html.')
      this.log.trace(err)
    }
  }

  /**
   * Tries to generate a PDF snapshot from Playwright and add it as a generated exchange (`file:///pdf-snapshot.pdf`).
   * If `ghostscript` is available, will try to compress the resulting PDF.
   * Dimensions of the PDF are based on current document width and height.
   *
   * @param {Page} page - A Playwright [Page]{@link https://playwright.dev/docs/api/class-page} object
   * @returns {Promise<void>}
   */
  async #takePdfSnapshot (page) {
    let pdf = null
    let dimensions = null

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

    const url = 'file:///pdf-snapshot.pdf'
    const httpHeaders = new Headers({ 'content-type': 'application/pdf' })
    const body = pdf
    const isEntryPoint = true
    const description = `Capture Time PDF Snapshot of ${this.url}`

    this.addGeneratedExchange(url, httpHeaders, body, isEntryPoint, description)
  }

  /**
   * Populates `this.provenanceInfo`, which is then used to generate a `file:///provenance-summary.html` exchange and entry point.
   * That property is also be used by `scoopToWACZ()` to populate the `extras` field of `datapackage.json`.
   *
   * Provenance info collected:
   * - Capture client IP, resolved using the endpoint provided in the `publicIpResolverEndpoint` option.
   * - Operating system details (type, name, major version, CPU architecture)
   * - Scoop version
   * - Scoop options object used during capture
   *
   * @param {Page} page - A Playwright [Page]{@link https://playwright.dev/docs/api/class-page} object
   * @private
   */
  async #captureProvenanceInfo (page) {
    let captureIp = 'UNKNOWN'
    const osInfo = await getOSInfo()
    const userAgent = await page.evaluate(() => window.navigator.userAgent) // Source user agent from the browser in case it was altered during capture
    let ytDlpHash = ''

    // Grab public IP address
    try {
      const response = await fetch(this.options.publicIpResolverEndpoint)
      const ip = (await response.text()).trim()

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

    // Compute yt-dlp hash
    try {
      ytDlpHash = createHash('sha256')
        .update(await readFile(this.options.ytDlpPath))
        .digest('hex')

      ytDlpHash = `sha256:${ytDlpHash}`
    } catch (err) {
      this.log.warn('Could not compute SHA256 hash of yt-dlp executable')
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
      ytDlpHash,
      options: structuredClone(this.options)
    }

    // ytDlpPath should be excluded from provenance summary
    delete this.provenanceInfo.options.ytDlpPath

    // Generate summary page
    try {
      const html = nunjucks.render('provenance-summary.njk', {
        ...this.provenanceInfo,
        date: this.startedAt.toISOString(),
        url: this.url
      })

      const url = 'file:///provenance-summary.html'
      const httpHeaders = new Headers({ 'content-type': 'text/html' })
      const body = Buffer.from(html)
      const isEntryPoint = true
      const description = 'Provenance Summary'

      this.addGeneratedExchange(url, httpHeaders, body, isEntryPoint, description, true)
    } catch (err) {
      throw new Error(`Error while creating exchange for file:///provenance-summary.html. ${err}`)
    }
  }

  /**
   * Generates a ScoopGeneratedExchange for generated content and adds it to `exchanges`.
   * Unless `force` argument is passed, generated exchanges count towards time / size limits.
   *
   * @param {string} url
   * @param {Headers} headers
   * @param {Buffer} body
   * @param {boolean} [isEntryPoint=false]
   * @param {string} [description='']
   * @param {boolean} [force=false] if `true`, this exchange will be added to the list regardless of capture time and size constraints.
   * @returns {boolean} true if generated exchange is successfully added
   */
  addGeneratedExchange (url, headers, body, isEntryPoint = false, description = '', force = false) {
    // Check maxCaptureSize and capture state unless `force` was passed.
    if (force === false) {
      const remainingSpace = this.options.maxCaptureSize - this.intercepter.byteLength

      if (this.state !== Scoop.states.CAPTURE || body.byteLength >= remainingSpace) {
        this.state = Scoop.states.PARTIAL
        this.log.warn(`Generated exchange ${url} could not be saved (size limit reached).`)
        return false
      }
    }

    this.exchanges.push(
      new ScoopGeneratedExchange({
        url,
        description,
        isEntryPoint: Boolean(isEntryPoint),
        response: {
          startLine: 'HTTP/1.1 200 OK',
          headers,
          body
        }
      })
    )

    return true
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
    let pass = true

    // Is the url "valid"? (format)
    try {
      const filteredUrl = new URL(url) // Will throw if not a valid url

      if (filteredUrl.protocol !== 'https:' && filteredUrl.protocol !== 'http:') {
        this.log.error('Invalid protocol.')
        pass = false
      }

      url = filteredUrl.href
    } catch (err) {
      this.log.error(`Invalid url provided.\n${err}`)
      pass = false
    }

    // If the url part of the blocklist?
    const rule = this.blocklist.find(searchBlocklistFor(url))
    if (rule) {
      this.log.error(`Blocked url provided matching blocklist rule: ${rule}`)
      pass = false
    }

    if (!pass) {
      throw new Error('Invalid URL provided.')
    }

    return url
  }

  /**
   * Returns a map of "generated" exchanges.
   * Generated exchanges = anything generated directly by Scoop (PDF snapshot, full-page screenshot, videos ...)
   * @returns {Object.<string, ScoopGeneratedExchange>}
   */
  extractGeneratedExchanges () {
    if (![Scoop.states.COMPLETE, Scoop.states.PARTIAL].includes(this.state)) {
      throw new Error('Cannot export generated exchanges on a pending or failed capture.')
    }

    const generatedExchanges = {}

    for (const exchange of this.exchanges) {
      if (exchange instanceof ScoopGeneratedExchange) {
        const key = exchange.url.replace('file:///', '')
        generatedExchanges[key] = exchange
      }
    }

    return generatedExchanges
  }

  /**
   * (Shortcut) Reconstructs a Scoop capture from a WACZ.
   * @param {string} zipPath - Path to .wacz file.
   * @returns {Promise<Scoop>}
   */
  static async fromWACZ (zipPath) {
    return await importers.WACZToScoop(zipPath)
  }

  /**
   * (Shortcut) Export this Scoop capture to WARC.
   * @param {boolean} [gzip=false]
   * @returns {Promise<ArrayBuffer>}
   */
  async toWARC (gzip = false) {
    return await exporters.scoopToWARC(this, Boolean(gzip))
  }

  /**
   * (Shortcut) Export this Scoop capture to WACZ.
   * @param {boolean} [includeRaw=true] - Include a copy of RAW Http exchanges to the wacz (under `/raw`)?
   * @param {object} signingServer - Optional server information for signing the WACZ
   * @param {string} signingServer.url - url of the signing server
   * @param {string} signingServer.token - Optional token to be passed to the signing server via the Authorization header
   * @returns {Promise<ArrayBuffer>}
   */
  async toWACZ (includeRaw = true, signingServer) {
    return await exporters.scoopToWACZ(this, includeRaw, signingServer)
  }
}

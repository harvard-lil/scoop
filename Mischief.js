/**
 * @author Harvard LIL
 * @version 0.0.1
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
// Page is imported for JSDoc purposes
import { chromium, Page } from 'playwright' // eslint-disable-line no-unused-vars
import { getOSInfo } from 'get-os-info'

import { MischiefGeneratedExchange } from './exchanges/index.js'
import { castBlocklistMatcher, searchBlocklistFor } from './utils/blocklist.js'

import * as CONSTANTS from './constants.js'
import * as intercepters from './intercepters/index.js'
import * as exporters from './exporters/index.js'
import * as importers from './importers/index.js'
import { filterOptions } from './options.js'

const exec = util.promisify(execCB)

/**
 * @class Mischief
 *
 * @classdesc
 * Experimental single-page web archiving library using Playwright.
 * Uses a proxy to allow for comprehensive and raw network interception.
 *
 * @param {string} url - Must be a valid HTTP(S) url.
 * @param {object} [options={}] - See :func:`MischiefOptions.defaults` for details.
 *
 * @example
 * import { Mischief } from "mischief";
 *
 * const myCapture = new Mischief("https://example.com");
 * await myCapture.capture();
 * const myArchive = await myCapture.toWarc();
 */
export class Mischief {
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
    FAILED: 5
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
   * Should only contain keys defined in {@link options.defaultOptions}.
   * @type {object}
   */
  options = {}

  /**
   * Array of HTTP exchanges that constitute the capture.
   * Only contains generated exchanged until `teardown()`.
   * @type {MischiefExchange[]}
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
   * @type {intercepters.MischiefIntercepter}
   */
  intercepter

  /**
   * A mirror of options.blocklist with IPs parsed for matching
   * @type {Array.<String|RegEx|Address4|Address6>}
   */
  blocklist = []

  /**
   * Will only be populated if `options.provenanceSummary` is `true`.
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
   *   noArchiveUrls: string[]
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
   * Main capture process.
   *
   * @returns {Promise}
   */
  async capture () {
    const options = this.options

    /** @type {Array.<{name: String, setup: ?function, main: function}>} */
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
        }
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
        name: 'Out-of-browser capture of video as attachment',
        main: async () => {
          await this.#captureVideoAsAttachment()
        }
      })
    }

    // Push step: Provenance summary
    if (options.provenanceSummary) {
      steps.push({
        name: 'Provenance summary',
        main: async (page) => {
          await this.#captureProvenanceInfo(page)
        }
      })
    }

    // Push step: Capture page info
    steps.push({
      name: 'Capture page info',
      main: async (page) => {
        await this.#capturePageInfo(page)
      }
    })

    // Push step: Teardown
    steps.push({
      name: 'Teardown',
      main: async () => {
        this.state = Mischief.states.COMPLETE
        await this.teardown()
      }
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
    while (i++ < steps.length - 1 && this.state === Mischief.states.CAPTURE) {
      const step = steps[i]
      try {
        this.log.info(`STEP [${i + 1}/${steps.length}]: ${step.name}`)
        await step.main(page)
      } catch (err) {
        if (this.state === Mischief.states.CAPTURE) {
          this.log.warn(`STEP [${i + 1}/${steps.length}]: ${step.name} - failed.`)
          this.log.trace(err)
        } else {
          this.log.warn(`STEP [${i + 1}/${steps.length}]: ${step.name} - ended due to max time or size reached.`)
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
    this.state = Mischief.states.SETUP
    const options = this.options

    // Create "base" temporary folder if it doesn't exist
    let tmpDirExists = false
    try {
      await access(CONSTANTS.TMP_PATH)
      tmpDirExists = true
    } catch (_err) {
      this.log.info(`Base temporary folder ${CONSTANTS.TMP_PATH} does not exist or cannot be accessed. Mischief will attempt to create it.`)
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
   * @returns {Promise}
   */
  async teardown () {
    this.log.info('Closing browser and intercepter.')
    await this.intercepter.teardown()
    await this.#browser.close()
    this.exchanges = this.intercepter.exchanges.concat(this.exchanges)

    this.log.info(`Clearing capture-specific temporary folder ${this.captureTmpFolderPath}`)
    await rm(this.captureTmpFolderPath, { recursive: true, force: true })
  }

  /**
   * Tries to populate `this.pageInfo`.
   * Captures page title, description, url and favicon url directly from the browser.
   * Will attempt to find the favicon in intercepted exchanges if running in headfull mode, and request it out-of-band otherwise.
   *
   * @param {Page} page - A Playwright [Page]{@link https://playwright.dev/docs/api/class-page} object
   * @returns {Promise}
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

    // If `headless`: request the favicon out of band,
    if (this.options.headless) {
      try {
        const response = await fetch(this.pageInfo.faviconUrl)

        if (!response.headers?.get('content-type')?.startsWith('image/')) {
          throw new Error(`Request for favicon returned mime type ${response.headers.get('content-type')}`)
        }

        this.pageInfo.favicon = Buffer.from(await response.arrayBuffer())

        // Add favicon to exchanges as a generated exchange (as it was captured out of band)
        this.addGeneratedExchange(
          this.pageInfo.faviconUrl,
          Object.fromEntries(response.headers.entries()),
          this.pageInfo.favicon,
          false,
          'Favicon (captured out-of-band by Mischief)'
        )
      } catch (err) {
        this.log.warn(`Could not fetch favicon at url ${this.pageInfo.faviconUrl}.`)
        this.log.trace(err)
      }
    // Otherwise: look for it in exchanges
    } else {
      for (const exchange of this.intercepter.exchanges) {
        if (exchange?.request?.url && exchange.request.url === this.pageInfo.faviconUrl) {
          this.pageInfo.favicon = exchange.response.body
        }
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
   * @returns {Promise}
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
      const result = await exec(`${ytDlpPath} --version`)
      const version = result.stdout.trim()

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
        timeout: this.options.captureVideoAsAttachmentTimeout
      }

      const result = await exec(`${ytDlpPath} ${dlpOptions.join(' ')}`, spawnOptions)
      metadataRaw = result.stdout
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
          const httpHeaders = { 'content-type': 'video/mp4' }
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
          const httpHeaders = { 'content-type': 'text/vtt' }
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
      const httpHeaders = { 'content-type': 'application/json' }
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
      const html = nunjucks.render(`${CONSTANTS.TEMPLATES_DIR}video-extracted-summary.njk`, {
        url: this.url,
        now: new Date().toISOString(),
        videoSaved,
        metadataSaved,
        subtitlesSaved,
        availableVideosAndSubtitles,
        metadataParsed
      })

      const url = 'file:///video-extracted-summary.html'
      const httpHeaders = { 'content-type': 'text/html' }
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
   * @returns {Promise}
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
   * - Capture client IP, resolved using the endpoint provided in the `publicIpResolverEndpoint` option.
   * - Operating system details (type, name, major version, CPU architecture)
   * - Mischief version
   * - Mischief options object used during capture
   *
   * @param {Page} page - A Playwright [Page]{@link https://playwright.dev/docs/api/class-page} object
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
      options: structuredClone(this.options)
    }

    // Generate summary page
    try {
      const html = nunjucks.render(`${CONSTANTS.TEMPLATES_PATH}provenance-summary.njk`, {
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
   *
   * @param {string} url
   * @param {object} httpHeaders
   * @param {Buffer} body
   * @param {boolean} isEntryPoint
   * @param {string} description
   * @returns {boolean} true if generated exchange is successfully added
   */
  addGeneratedExchange (url, httpHeaders, body, isEntryPoint = false, description = '') {
    const remainingSpace = this.options.maxSize - this.intercepter.byteLength

    if (this.state !== Mischief.states.CAPTURE ||
        body.byteLength >= remainingSpace) {
      this.state = Mischief.states.PARTIAL
      this.warn(`Generated exchange ${url} could not be saved (size limit reached).`)
      return false
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
      throw new Error(`Blocked url provided matching blocklist rule: ${rule}`)
    }

    return url
  }

  /**
   * Returns a map of "generated" exchanges.
   * Generated exchanges = anything generated directly by Mischief (PDF snapshot, full-page screenshot, videos ...)
   * @returns {Object.<string, MischiefGeneratedExchange>}
   */
  extractGeneratedExchanges () {
    if (![Mischief.states.COMPLETE, Mischief.states.PARTIAL].includes(this.state)) {
      throw new Error('Cannot export generated exchanges on a pending or failed capture.')
    }

    const generatedExchanges = {}

    for (const exchange of this.exchanges) {
      if (exchange instanceof MischiefGeneratedExchange) {
        const key = exchange.response.url.replace('file:///', '')
        generatedExchanges[key] = exchange
      }
    }

    return generatedExchanges
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

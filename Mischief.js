/**
 * Mischief
 * @module Mischief
 * @author The Harvard Library Innovation Lab
 * @license MIT
 */
import { chromium } from "playwright";

import * as browserScripts from "./browser-scripts/index.js";
import * as exporters from "./exporters/index.js";
import { MischiefExchange } from "./MischiefExchange.js";
import { MischiefLog } from "./MischiefLog.js";
import { MischiefOptions } from "./MischiefOptions.js";

/**
 * Experimental single-page web archiving solution using Playwright.
 * - Relies mainly on network interception. 
 * - Uses custom browser scripts and out-of-browser capture as a fallback for resources that cannot be captured otherwise.
 * 
 * Usage:
 * ```javascript
 * import { Mischief } from "mischief";
 * 
 * const myCapture = new Mischief(url, options);
 * await myCapture.capture();
 * if (myCapture.success === true) {
 *   const warc = await myCapture.toWarc(); // Returns an ArrayBuffer
 * }
 * ```
 */
export class Mischief {
  /**
   * URL to capture.
   * @type {string} 
   */
  url = "";

  /** 
   * Current settings. 
   * Should only contain keys defined in `MischiefOptions`.
   * @type {object} 
   */
  options = {};

  /** 
   * Array of HTTP exchanges that constitute the capture.
   * @type {MischiefExchange[]} 
   */
  exchanges = [];

  /** 
   * List of urls that could not be captured via in-browser network interception.
   * `this.capture()` will try to download them using `this.fallbackCapture()`.
   * @type {string[]} 
   */
  fallbackCaptureQueue = [];

  /** @type {MischiefLog[]} */
  logs = [];

  /**
   * Total size of recorded exchanges, in bytes.
   * @type {number}
   */
  totalSize = 0;

  /**
   * Set to true when the capture went through.
   * @type {boolean}
   */
  success = false;

  /**
   * @param {string} url - Must be a valid HTTP(S) url.
   * @param {object} [options={}] - See `MischiefOptions` for details.
   */
  constructor(url, options = {}) {
    this.url = this.filterUrl(url);
    this.options = this.filterOptions(options);
    this.networkInterception = this.networkInterception.bind(this);
    this.fallbackCapture = this.fallbackCapture.bind(this);
  }

  /**
   * Main capture process.
   * 
   * Separated in two main phases:
   * - In-browser capture - during which Mischief will try to intercept as many HTTP exchanges as possible and identify elements it cannot capture that way.
   * - Fallback out-of-browser capture - during which Mischief runs Fetch requests to capture elements that could not be intercepted earlier.
   *  
   * @returns {Promise<boolean>}
   */
  async capture() {
    const options = this.options;
    const browser = await chromium.launch({headless: options.headless, channel: "chrome"});
    const context = await browser.newContext();
    const page = await context.newPage();
    const userAgent = await page.evaluate(() => navigator.userAgent);

    page.setViewportSize({
      width: options.captureWindowX,
      height: options.captureWindowY,
    });

    page.on("response", this.networkInterception);

    //
    // Phase 1: In-browser capture
    //

    // Go to page and wait until load.
    try {
      this.addToLogs(`Starting capture of ${this.url} with options: ${options}`);
      this.addToLogs("Waiting for browser to reach load state.");
      await page.goto(this.url, { waitUntil: "load", timeout: options.loadTimeout });
    }
    catch(err) {
      this.addToLogs("Document never reached load state. Moving along.", true);
    }

    // Run browser scripts
    this.addToLogs("Running browser scripts.");

    try {
      if (options.autoPlayMedia === true) {
        this.addToLogs("Browser Script: Auto-play medias.");
        const maxDuration = await page.evaluate(browserScripts.autoPlayMedia);
        await page.waitForTimeout(Math.min(maxDuration, options.autoPlayMediaTimeout));
      }
    }
    catch(err) {
      this.addToLogs("Browser Script: Auto-play medias failed.", true, err);
    }

    try {
      if (options.autoScroll === true) {
        this.addToLogs("Browser Script: Auto-scroll.");
        await page.evaluate(browserScripts.autoScroll, {timeout: options.autoScrollTimeout});
      }
    }
    catch(err) {
      this.addToLogs("Browser Script: Auto-scroll failed.", true, err);
    }

    try {
      if (options.grabResponsiveImages === true) {
        this.addToLogs("Browser Script: Grab Responsive Images.");
        const urls = await page.evaluate(browserScripts.listResponsiveImages);

        for (let url of urls) {
          this.addToFallbackCaptureQueue(url);
        }
      }
    }
    catch(err) {
      this.addToLogs("Browser Script: Grab Responsive Images failed.", true, err);
    }

    try {
      if (options.grabAllStylesheets === true) {
        this.addToLogs("Browser Script: Grab Stylesheets.");
        const urls = await page.evaluate(browserScripts.listAllStylesheets);

        for (let url of urls) { // TODO: Exclude stylesheets already captured?
          this.addToFallbackCaptureQueue(url);
        }
      }
    }
    catch(err) {
      this.addToLogs("Browser Script: Grab Stylesheets failed.", true, err);
    }

    try {
      if (options.grabMedia === true) {
        this.addToLogs("Browser Script: Grab Audio and Video sources.");
        const urls = await page.evaluate(browserScripts.listMediaSources);

        for (let url of urls) {
          this.addToFallbackCaptureQueue(url);
        }
      }
    }
    catch(err) {
      this.addToLogs("Browser Script: Grab Audio and Video sources.", true, err);
    }

    // Screenshot
    try {
      if (options.screenshot) {
        this.addToLogs("Making a full-page screenshot of the document.");

        const screenshot = new MischiefExchange();
        screenshot.body = await page.screenshot({fullPage: true});
        screenshot.headers = {"Content-Type": "image/png"};
        screenshot.url = "file:///screenshot.png";
        screenshot.status = 200;

        this.addMischiefExchange(screenshot);
      }
    }
    catch(err) {
      this.addToLogs("Could not make a full-page screenshot of the document.", true, err);
    }

    // Wait for network idle and close browser
    try {
      this.addToLogs("Waiting for browser to reach network idle state.");
      await page.waitForLoadState("networkidle", {timeout: options.networkIdleTimeout});
    }
    catch(err) {
      this.addToLogs("Document never reached network idle state. Moving along.", true);
    }
    finally {
      this.addToLogs("Closing browser.");
      await page.close();
      await context.close();
      await browser.close();
    }

    //
    // Phase 2: Fallback capture. Fetching remaining elements outside of the browser.
    //
    try {
      this.addToLogs("Out-of-browser fallback capture of remaining elements.");
      const captures = await Promise.allSettled(
        this.fallbackCaptureQueue.map(url => this.fallbackCapture(url, userAgent))
      );

      for (let capture of captures) {
        if (capture.status === "rejected") {
          this.addToLogs(`Capture failed`, true, capture.reason);
          continue;
        }
      }
    }
    catch(err) {
      this.addToLogs("Uncaught exception during out-of-browser capture", true, err);
    }

    this.success = true;
    return true;
  }

  /**
   * Processes HTTP requests and responses intercepted by Playwright and adds them to the exchange list.
   * Will try to download HTTP bodies but add to fallback capture queue if the operation fails.
   * 
   * @param {Playwright.Response} event - https://playwright.dev/docs/api/class-response
   * @returns {Promise<boolean>}
   */
  async networkInterception(event) {
    const response = new MischiefExchange();
    const request = new MischiefExchange();

    // Capture request
    try {
      request.url = event.request().url();
      request.status = null;
      request.method = event.request().method();
      request.headers = this.filterHeaders(await event.request().allHeaders());
      request.date = new Date();
      request.type = "request";

      const body = await event.request().postDataBuffer();
      if (body) {
        request.body = body.buffer; // Pulls the `ArrayBuffer` instance from `Buffer`
      }

      this.addMischiefExchange(request);
    }
    catch(err) {
      this.addToLogs("Error occurred while intercepting request.", true, err);
    }
    
    // Capture response
    try {
      response.url = event.url();
      response.status = event.status();
      response.headers = this.filterHeaders(await event.allHeaders());
      response.method = event.request().method();
      response.body = null;
      response.type = "response";
    }
    catch(err) {
      this.addToLogs("Error occurred while intercepting response.", true, err);
      return;
    }

    // If redirect: add exchange as is.
    if (parseInt(response.status / 100) === 3) {
      this.addMischiefExchange(response);
      return;
    }

    // Try to pull body, add to post-capture queue if operation fails (i.e: timeout).
    try {
      response.body = await event.body();
      this.addMischiefExchange(response);
    }
    catch(err) {
      this.addToFallbackCaptureQueue(response.url);
    } 
  }

  /**
   * Retrieves resources that could not be intercepted during in-browser capture and adds them to the exchange list.
   * @param {string} url - The url to capture 
   * @param {string} userAgent - Ideally, the user agent used by Playwright during the in-browser capture phase.
   * @returns {Promise<boolean>}
   */
  async fallbackCapture(url, userAgent) {
    this.addToLogs(`Fallback capture of: ${url}.`);

    const exchange = new MischiefExchange();
    const response = await fetch(url, {headers: {"User-Agent": userAgent}});

    exchange.url = url;
    exchange.status = response.status;
    exchange.body = null;
    exchange.headers = this.filterHeaders(response.headers);
    exchange.type = "response";

    // Stream response until either time runs out or size limit is reached
    let timeIsOut = false;
    let isComplete = true;
    let timer = setTimeout(() => timeIsOut = true, this.options.fallbackCaptureTimeout);

    for await (let chunk of response.body) {
      this.addToLogs(`Received a ${chunk.byteLength}-byte slice from ${url}.`);

      // Break on time limit
      if (timeIsOut === true) {
        this.addToLogs(`Capture of ${url} interrupted (timeout).`, true);
        isComplete = false;
        break;
      }

      // Break on size limit
      if (chunk.byteLength + exchange.byteLength + this.totalSize > this.options.maxSize) {
        this.addToLogs(`Capture of ${url} interrupted (max size reached).`, true);
        isComplete = false;
        break;
      }

      let body = null;

      // Merge existing ArrayBuffers
      body = exchange.body ? new Blob([exchange.body, chunk]) : new Blob([chunk]);
      exchange.body = await body.arrayBuffer();
    }

    clearTimeout(timer);

    if (isComplete || (!isComplete && this.options.keepPartialResponses)) {
      this.addMischiefExchange(exchange);
      return true;
    }

    if (!isComplete && !this.options.keepPartialResponses) {
      this.addToLogs(`Partial response for ${url} will be discarded (settings).`, true);
    }

    return false;
  }

  /**
   * Adds an entry to the exchange list (`this.exchange`) unless size limit has been reached.
   * @param {MischiefExchange} exchange 
   * @returns {boolean}
   */
  addMischiefExchange(exchange) {
    if (!(exchange instanceof MischiefExchange)) {
      this.addToLogs("`exchange` must be a valid exchange.");
      return false;
    }

    if (exchange.byteLength + this.totalSize > this.options.maxSize) {
      this.addToLogs(`${exchange.url} (${exchange.byteLength} bytes) was discarded because of ${this.options.maxSize} bytes total cap.`, true);
      return false;
    }

    this.exchanges.push(exchange);
    this.addToLogs(`${exchange.url} was captured (${exchange.byteLength} bytes)`);
    return true;
  }

  /**
   * Adds an url to the post capture queue (`this.postCaptureQueue`) unless:
   * - Max size was reached
   * - Url is not valid
   * 
   * @param {string} url 
   * @returns {boolean}
   */
  addToFallbackCaptureQueue(url) {
    if (this.totalSize >= this.options.maxSize) {
      this.addToLogs(
        `${url} was not added to the fallback capture queue (max size of ${this.options.maxSize} bytes reached).`,
        true
      );
      return false;
    }

    try {
      url = new URL(url).href;
    }
    catch(err) {
      this.addToLogs(`${url} was not added to the fallback capture queue (invalid url).`, true);
      return false;
    }

    this.fallbackCaptureQueue.push(url);
    this.addToLogs(`${url} was added to fallback capture queue.`);
    return true;
  }

  /**
   * Creates and stores a log entry.
   * Will automatically be printed to STDOUT if `this.options.verbose` is `true`.
   * @param {string} message 
   * @param {boolean} [isWarning=false] 
   * @param {string} [trace=""] 
   */
  addToLogs(message, isWarning = false, trace = "") {
    const log = new MischiefLog(message, isWarning, trace, this.options.verbose);
    this.logs.push(log);
  }

  /**
   * Filters a url to ensure it's suitable for capture.
   * This function throws if:
   * - `url` is not a valid url
   * - `url` is not an http / https url
   * 
   * @param {string} url 
   */
  filterUrl(url) {
    try {
      let filteredUrl = new URL(url); // Will throw if not a valid url

      if (filteredUrl.protocol !== "https:" && filteredUrl.protocol !== "http:") {
        throw new Error("Invalid protocol.");
      }
      
      return filteredUrl.href;
    }
    catch(err) {
      throw new Error(`Invalid url provided.\n${err}`);
    }
  }

  /**
   * Filters an options object by comparing it with `MischiefOptions`.
   * Will use defaults for missing properties.
   * 
   * @param {object} newOptions 
   */
  filterOptions(newOptions) {
    const options = {};

    for (let key of Object.keys(MischiefOptions)) {
      options[key] = key in newOptions ? newOptions[key] : MischiefOptions[key];

      // Apply basic type casting based on type of defaults (MischiefOptions)
      switch (typeof MischiefOptions[key]) {
        case "boolean":
          options[key] = Boolean(options[key]);
        break;

        case "number":
          options[key] = Number(options[key]);
        break;

        case "string":
          options[key] = String(options[key]);
        break;
      }
    }

    return options;
  }

  /**
   * Filters-out headers:
   * - Excludes keys that are invalid
   * - Remove `\n` from values
   * 
   * TODO: Reconsider this. We should at least give the option to capture everything unfiltered.
   *
   * @param {object|Header} headers - Can either be a standard object or a `Headers` instance.
   * @returns {object}
   */
  filterHeaders(headers) {
    const newHeaders = {};
    const iterator = headers.entries ? headers.entries() : Object.entries(headers);

    for (let [key, value] of iterator) {
      if (!key.match(/^[A-Za-z0-9\-\_]+$/)) { // Key must be valid
        continue;
      }

      let newValue = value.replaceAll("\n", " ");
      newHeaders[key] = newValue;
    }
    
    return newHeaders;
  }

  /**
   * Export capture to WARC files.
   *
   * @param {boolean} [gzip=false] - If `true`, will be compressed using GZIP (for `.warc.gz`). 
   * @returns {Promise<ArrayBuffer>} - Binary data ready to be saved a .warc or .warc.gz
   */
  async toWarc(gzip=false) {
    return await exporters.warc(this, gzip);
  }

}

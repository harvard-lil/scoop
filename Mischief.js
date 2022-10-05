/**
 * Mischief
 * @module Mischief
 * @author The Harvard Library Innovation Lab
 * @license MIT
 */
import { chromium } from "playwright";
import ProxyServer from "transparent-proxy";

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

  #browser;
  #proxy;

  /**
   * @param {string} url - Must be a valid HTTP(S) url.
   * @param {object} [options={}] - See `MischiefOptions` for details.
   */
  constructor(url, options = {}) {
    this.url = this.filterUrl(url);
    this.options = this.filterOptions(options);
    this.networkInterception = this.networkInterception.bind(this);
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

    this.#proxy = new ProxyServer({
      intercept: true,
      verbose: options.verbose,
      injectData: (data, session) => this.networkInterception("request", data, session),
      injectResponse: (data, session) => this.networkInterception("response", data, session)
    });
    this.#proxy.listen(options.proxyPort, options.proxyHost, () => {
      console.log('TCP-Proxy-Server started!', this.#proxy.address());
    });

    this.#browser = await chromium.launch({
      headless: options.headless,
      channel: "chrome",
      proxy: {server: `http://${options.proxyHost}:${options.proxyPort}`}
    });
    const context = await this.#browser.newContext({ignoreHTTPSErrors: true});
    const page = await context.newPage();
    const userAgent = await page.evaluate(() => navigator.userAgent);

    page.setViewportSize({
      width: options.captureWindowX,
      height: options.captureWindowY,
    });

    const runBrowsertrixBehaviors =
          options.grabSecondaryResources ||
          options.autoPlayMedia ||
          options.runSiteSpecificBehaviors;

    if (runBrowsertrixBehaviors){
      await page.addInitScript({ path: './node_modules/browsertrix-behaviors/dist/behaviors.js' });
      await page.addInitScript({
        content: `
         self.__bx_behaviors.init({
           autofetch: ${options.grabSecondaryResources},
           autoplay: ${options.autoPlayMedia},
           siteSpecific: ${options.runSiteSpecificBehaviors},
           timeout: ${options.behaviorsTimeout}
         });`
      });
    }

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
      if (runBrowsertrixBehaviors){
        await Promise.allSettled(page.frames().map(frame => frame.evaluate("self.__bx_behaviors.run()")));
      }
    } catch(err) {
      this.addToLogs("Browser Script: browsertrix-bheaviors failed.", true, err);
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

    // Screenshot
    try {
      if (options.screenshot) {
        this.addToLogs("Making a full-page screenshot of the document.");

        this.exchanges.push(new MischiefExchange({
          url: "file:///screenshot.png",
          response: {
            headers: ["Content-Type", "image/png"],
            versionMajor: 1,
            versionMinor: 1,
            statusCode: 200,
            statusMessage: "OK",
            body: await page.screenshot({fullPage: true})
          }
        }));
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
      await this.close();
    }

    return this.success = true;
  }

  async close(){
    this.addToLogs("Closing browser and proxy server.");
    await this.#browser.close();
    await this.#proxy.close();
  }

  /**
   * Returns an exchange based on the session and type.
   * If the type is a request and there's already been a response on that same session,
   * create a new exchange. Otherwise append to continue the exchange.
   */
  getOrInitExchange(session, type) {
    return this.exchanges.findLast((ex) => {
      return ex.id == session._id && (type == "response" || !ex.responseRaw);
    }) || this.exchanges[this.exchanges.push(new MischiefExchange({id: session._id})) - 1];
  }

  networkInterception(type, data, session) {
    const ex = this.getOrInitExchange(session, type);
    const prop = `${type}Raw`;
    ex[prop] = ex[prop] ? Buffer.concat([ex[prop], data], ex[prop].length + data.length) : data;
    this.totalSize += data.byteLength
    if(this.totalSize >= this.options.maxSize){
      this.addToLogs("Max size reached. Ending further capture.");
      this.close();
    }
    return data;
  }

  /**
   * Creates and stores a log entry.
   * Will automatically be printed to STDOUT if `this.options.verbose` is `true`.
   * 
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
   * Export capture to WARC.
   * @param {boolean} [gzip=false] - If `true`, will be compressed using GZIP (for `.warc.gz`). 
   * @returns {Promise<ArrayBuffer>} - Binary data ready to be saved a .warc or .warc.gz
   */
  async toWarc(gzip=false) {
    return await exporters.warc(this, gzip);
  }

}

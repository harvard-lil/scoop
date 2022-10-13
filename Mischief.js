/**
 * Mischief
 * @module Mischief
 * @author The Harvard Library Innovation Lab
 * @license MIT
 */
import { chromium } from "playwright";
import ProxyServer from "transparent-proxy";

import * as exporters from "./exporters/index.js";
import { MischiefExchange } from "./MischiefExchange.js";
import { MischiefLog } from "./MischiefLog.js";
import { MischiefOptions } from "./MischiefOptions.js";

/**
 * Experimental single-page web archiving solution using Playwright.
 * - Uses a proxy to allow for comprehensive and raw network interception.
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
  };

  /**
   * Current state of the capture.
   * Should only contain states defined in `states`.
   * @type {number}
   */
  state = Mischief.states.INIT;

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
   * The Playwright browser instance for this capture.
   * @type {Browser}
   */
  #browser;

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
    const steps = [];

    steps.push({
      name: "initial load",
      main: async (page) => { await page.goto(this.url, { waitUntil: "load", timeout: options.loadTimeout }); }
    });

    if (options.grabSecondaryResources ||
        options.autoPlayMedia ||
        options.runSiteSpecificBehaviors ||
        options.autoScroll){
      steps.push({
        name: "browser scripts",
        setup: async (page) => {
          await page.addInitScript({ path: './node_modules/browsertrix-behaviors/dist/behaviors.js' });
          await page.addInitScript({
            content: `
              self.__bx_behaviors.init({
                autofetch: ${options.grabSecondaryResources},
                autoplay: ${options.autoPlayMedia},
                autoscroll: ${options.autoScroll},
                siteSpecific: ${options.runSiteSpecificBehaviors},
                timeout: ${options.behaviorsTimeout}
              });`
          });
        },
        main: async (page) => { await Promise.allSettled(page.frames().map(frame => frame.evaluate("self.__bx_behaviors.run()"))); }
      });
    }

    steps.push({
      name: "network idle",
      main: async (page) => { await page.waitForLoadState("networkidle", {timeout: options.networkIdleTimeout}); }
    });

    if (options.screenshot) {
      steps.push({
        name: "screenshot",
        main: async (page) => {
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
      });
    }

    steps.push({
      name: "teardown",
      main: async () => {
        this.state = Mischief.states.COMPLETE;
        await this.teardown();
      }
    })

    let page;
    try {
      page = await this.setup();
      this.addToLogs(`Starting capture of ${this.url} with options: ${JSON.stringify(options)}`);
      this.state = Mischief.states.CAPTURE;
    } catch(e) {
      this.addToLogs('An error ocurred during capture setup', true, e);
      this.state = Mischief.states.FAILED;
      return; // exit early if the browser and proxy couldn't be launched
    }

    for (let step of steps.filter((step) => step.setup)) {
      await step.setup(page);
    }

    let i = 0;
    do {
      const step = steps[i];
      try {
        this.addToLogs(`STEP [${i+1}/${steps.length}]: ${step.name}`);
        await step.main(page);
      } catch(err) {
        if(this.state == Mischief.states.CAPTURE){
          this.addToLogs(`STEP [${i+1}/${steps.length}]: ${step.name} - failed`, true, err);
        } else {
          this.addToLogs(`STEP [${i+1}/${steps.length}]: ${step.name} - ended due to max time or size reached`, true);
        }
      }
    } while(i++ < steps.length-1 &&
            this.state == Mischief.states.CAPTURE);
  }

  /**
   * Sets up the proxy and Playwright resources
   *
   * @returns {Promise<boolean>}
   */
  async setup(){
    this.state = Mischief.states.SETUP;
    const options = this.options;

    const totalTimeoutTimer = setTimeout(() => {
      this.addToLogs(`totalTimeout of ${options.totalTimeout}ms reached. Ending further capture.`);
      this.state = Mischief.states.PARTIAL;
      this.teardown();
    }, options.totalTimeout);

    const proxy = new ProxyServer({
      intercept: true,
      verbose: options.proxyVerbose,
      injectData: (data, session) => this.networkInterception("request", data, session),
      injectResponse: (data, session) => this.networkInterception("response", data, session)
    });
    proxy.listen(options.proxyPort, options.proxyHost, () => {
      this.addToLogs(`TCP-Proxy-Server started ${JSON.stringify(proxy.address())}`);
    });

    this.#browser = await chromium.launch({
      headless: options.headless,
      channel: "chrome",
      proxy: {server: `http://${options.proxyHost}:${options.proxyPort}`}
    })
    this.#browser.on('disconnected', () => {
      clearTimeout(totalTimeoutTimer);
      proxy.close()
    });

    const context = await this.#browser.newContext({ignoreHTTPSErrors: true});
    const page = await context.newPage();

    page.setViewportSize({
      width: options.captureWindowX,
      height: options.captureWindowY,
    });

    return page;
  }

  /**
   * Tears down the Playwright and (via event listener) the proxy resources.
   *
   * @returns {Promise<boolean>}
   */
  async teardown(){
    this.addToLogs("Closing browser and proxy server.");
    await this.#browser.close();
  }

  /**
   * Returns an exchange based on the session id and type ("request" or "response").
   * If the type is a request and there's already been a response on that same session,
   * create a new exchange. Otherwise append to continue the exchange.
   *
   * @param {string} id
   * @param {string} type
   */
  getOrInitExchange(id, type) {
    return this.exchanges.findLast((ex) => {
      return ex.id == id && (type == "response" || !ex.responseRaw);
    }) || this.exchanges[this.exchanges.push(new MischiefExchange({id: id})) - 1];
  }

  /**
   * Collates network data (both requests and responses) from the proxy.
   * Capture size enforcement happens here.
   *
   * @param {string} type
   * @param {Buffer} data
   * @param {Session} session
   */
  networkInterception(type, data, session) {
    const ex = this.getOrInitExchange(session._id, type);
    const prop = `${type}Raw`;
    ex[prop] = ex[prop] ? Buffer.concat([ex[prop], data], ex[prop].length + data.length) : data;

    this.totalSize += data.byteLength;
    if(this.totalSize >= this.options.maxSize && this.state == Mischief.states.CAPTURE){
      this.addToLogs(`Max size of ${this.options.maxSize} reached. Ending further capture.`);
      this.state = Mischief.states.PARTIAL;
      this.teardown();
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

  /**
   * Export capture to WACZ.
   * @returns {Promise<ArrayBuffer>} - Binary data ready to be saved a .wacz
   */
  async toWacz() {
    return await exporters.wacz(this);
  }

}

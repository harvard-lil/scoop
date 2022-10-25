/**
 * Mischief
 * @module Mischief
 * @author The Harvard Library Innovation Lab
 * @license MIT
 */
import { chromium } from "playwright";

import { MischiefExchange } from "./exchanges/MischiefExchange.js";
import { MischiefLog } from "./MischiefLog.js";
import { MischiefOptions } from "./MischiefOptions.js";

import * as intercepters from "./intercepters/index.js";

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
   * The time at which the page was crawled.
   * @type {Date}
   */
  startedAt;

  /**
   * The Playwright browser instance for this capture.
   * @type {Browser}
   */
  #browser;

  intercepter;

  /**
   * @param {string} url - Must be a valid HTTP(S) url.
   * @param {object} [options={}] - See `MischiefOptions` for details.
   */
  constructor(url, options = {}) {
    this.url = this.filterUrl(url);
    this.options = this.filterOptions(options);
    this.intercepter = new intercepters[this.options.intercepter](this);
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
      name: "intercepter",
      main: async (page) => {
        await this.intercepter.setup(page);
      }
    })

    steps.push({
      name: "initial load",
      main: async (page) => {
        await page.goto(this.url, { waitUntil: "load", timeout: options.loadTimeout });
      }
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
        main: async (page) => {
          await Promise.allSettled(page.frames().map(frame => frame.evaluate("self.__bx_behaviors.run()")));
        }
      });
    }

    steps.push({
      name: "network idle",
      main: async (page) => {
        await page.waitForLoadState("networkidle", {timeout: options.networkIdleTimeout});
      }
    });

    if (options.screenshot) {
      steps.push({
        name: "screenshot",
        main: async (page) => {
          this.exchanges.push(new MischiefExchange({
            response: {
              url: "file:///screenshot.png",
              headers: {"Content-Type": "image/png"},
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

    for (const step of steps.filter((step) => step.setup)) {
      await step.setup(page);
    }

    let i = -1;
    while(i++ < steps.length-1 &&
          this.state == Mischief.states.CAPTURE) {
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
    }
  }

  /**
   * Sets up the proxy and Playwright resources
   *
   * @returns {Promise<boolean>}
   */
  async setup(){
    this.startedAt = new Date();
    this.state = Mischief.states.SETUP;
    const options = this.options;

    this.#browser = await chromium.launch({
      headless: options.headless,
      channel: "chrome"
    })

    const context = await this.#browser.newContext(this.intercepter.contextOptions);
    const page = await context.newPage();

    page.setViewportSize({
      width: options.captureWindowX,
      height: options.captureWindowY,
    });

    const totalTimeoutTimer = setTimeout(() => {
      this.addToLogs(`totalTimeout of ${options.totalTimeout}ms reached. Ending further capture.`);
      this.state = Mischief.states.PARTIAL;
      this.teardown();
    }, options.totalTimeout);

    this.#browser.on('disconnected', () => {
      clearTimeout(totalTimeoutTimer);
    });

    return page;
  }

  /**
   * Tears down the Playwright and (via event listener) the proxy resources.
   *
   * @returns {Promise<boolean>}
   */
  async teardown(){
    this.addToLogs("Closing browser and intercepter.");
    await this.intercepter.teardown();
    await this.#browser.close();
    this.exchanges = this.intercepter.exchanges.concat(this.exchanges);
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
      const filteredUrl = new URL(url); // Will throw if not a valid url

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

    for (const key of Object.keys(MischiefOptions)) {
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
}

/**
 * Mischief
 * @module MischiefOptions
 * @author The Harvard Library Innovation Lab
 * @license MIT
 */

/**
 * Available options and defaults for Mischief.
 * Unless specified otherwise at constructor level, Mischief will run with these settings.
 * 
 * @property {boolean} verbose - Should log entries be printed as they are created? Defaults to `true`.
 * @property {boolean} headless - Should Playwright run in headless mode? Defaults to `false`.
 * @property {string} proxyHost - What host should Playwright proxy through for capture? Defaults to `localhost`.
 * @property {number} proxyPort - What port should Playwright proxy through for capture? Defaults to 9000.
 * @property {boolean} proxyVerbose - Should log entries from the proxy be printed? Defaults to `false`.
 * @property {number} totalTimeout - How long should Mischief wait for all steps in the capture to complete, in ms? Defaults to 5min.
 * @property {number} loadTimeout - How long should Mischief wait for the page to load, in ms? Defaults to 30s.
 * @property {number} networkIdleTimeout - How long should Mischief wait for network events to complete, in ms. Defaults to 30s.
 * @property {number} behaviorsTimeout - How long should Mischief wait foacr media to play, secondary resources, and site specific behaviors (in total)? Defaults to 60s.
 * @property {boolean} keepPartialResponses - Should Mischief keep partially downloaded resources? Defaults to `true`.
 * @property {number} maxSize - Maximum size, in bytes, for the exchanges list. Defaults to 200Mb.
 * @property {boolean} screenshot - Should Mischief try to make a screenshot? Defaults to `true`. Screenshot will be added as `file:///screenshot.png` in the exchanges list.
 * @property {number} captureWindowX - Browser window resolution in pixels: X axis. Defaults to 1600.
 * @property {number} captureWindowY - Browser window resolution in pixels: Y axis. Defaults to 900.
 * @property {boolean} autoScroll - Should Mischief try to scroll through the page? Defaults to `true`.
 * @property {boolean} autoPlayMedia - Should Mischief try to autoplay `<audio>` and `<video>` tags? Defaults to `true`.
 * @property {boolean} grabSecondaryResources - Should Mischief try to download img srcsets and secondary stylesheets? Defaults to `true`.
 * @property {boolean} runSiteSpecificBehaviors - Should Mischief run behaviors tailored to specific sites (ex: Twitter) in an attempt to better grab the page? Defaults to `true`.
 */
export const MischiefOptions = {
  verbose: true,
  headless: false,
  proxyHost: "localhost",
  proxyPort: 9000,
  proxyVerbose: false,
  totalTimeout: 5 * 60 * 1000,
  loadTimeout: 30 * 1000,
  networkIdleTimeout: 30 * 1000, 
  behaviorsTimeout: 60 * 1000,
  keepPartialResponses: true,
  maxSize: 200 * 1024 * 1024,
  screenshot: true,
  captureWindowX: 1600,
  captureWindowY: 900,
  autoScroll: true,
  autoPlayMedia: true,
  grabSecondaryResources: true,
  runSiteSpecificBehaviors: true,
  interceptor: 'cdp'
};

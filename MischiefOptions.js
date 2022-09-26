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
 * @property {number} loadTimeout - How long should Mischief wait for the page to load, in ms? Defaults to 30s.
 * @property {number} networkIdleTimeout - How long should Mischief wait for network events to complete, in ms. Defaults to 30s.
 * @property {number} fallbackCaptureTimeout -  How long should Mischief run out-of-browser capture of non-intercepted elements for, in ms? Defaults to 60s.
 * @property {boolean} keepPartialResponses - Should Mischief keep partially downloaded resources? Defaults to `true`.
 * @property {number} maxSize - Maximum size, in bytes, for the exchanges list. Defaults to 200Mb.
 * @property {boolean} screenshot - Should Mischief try to make a screenshot? Defaults to `true`. Screenshot will be added as `file:///screenshot.png` in the exchanges list.
 * @property {number} captureWindowX - Browser window resolution in pixels: X axis. Defaults to 1600.
 * @property {number} captureWindowY - Browser window resolution in pixels: Y axis. Defaults to 900.
 * @property {boolean} autoPlayMedia - Should Mischief try to autoplay `<audio>` and `<video>` tags? Defaults to `true`.
 * @property {number} autoPlayMediaTimeout - How long should Mischief wait for `<audio>` and `<video>` tags to be done playing, in ms? Defaults to 30s.
 * @property {boolean} autoScroll - Should Mischief try to scroll through the page? Defaults to `true`.
 * @property {number} autoScrollTimeout - How long should Mischief wait for the scroll process to go through, in ms? Defaults to 5s.
 * @property {boolean} grabResponsiveImages - Should Mischief try to list and download all responsive images? Defaults to `true`.
 * @property {boolean} grabAllStylesheets - Should Mischief try to list and download all stylesheets? Defaults to `true`.
 * @property {boolean} grabMedia - Should Mischief try to list and download all `<audio>` and `<video>` sources? Defaults to `true`.
 * @property {boolean} runSiteSpecificBehaviors - Should Mischief run behaviors tailored to specific sites (ex: Twitter) in an attempt to better grab the page? Defaults to `true`.
 */
export const MischiefOptions = {
  verbose: true,
  headless: false,
  loadTimeout: 30 * 1000, 
  networkIdleTimeout: 30 * 1000, 
  fallbackCaptureTimeout: 60 * 1000,
  keepPartialResponses: true,
  maxSize: 200 * 1024 * 1024,
  screenshot: true,
  captureWindowX: 1600,
  captureWindowY: 900,
  autoPlayMedia: true,
  autoPlayMediaTimeout: 30 * 1000,
  autoScroll: true,
  autoScrollTimeout: 5 * 1000,
  grabResponsiveImages: true,
  grabAllStylesheets: true,
  grabMedia: true,
  runSiteSpecificBehaviors: true
};

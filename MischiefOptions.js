/**
 * Mischief
 * @module MischiefOptions
 * @author The Harvard Library Innovation Lab
 * @license MIT
 */
import path from 'path'
import { statSync } from 'fs'
// Note: used `statSync` instead of `stat` from `fs/promises` here for convenience.
// We're using `MischiefOptions.filterOptions()` in `Mischief()`, which cannot be async.

export class MischiefOptions {
  /**
   * Available options and defaults for Mischief.
   * Unless specified otherwise at constructor level, Mischief will run with these settings.
   *
   * @property {boolean} logLevel - Determines the logging level of this instance. Can be "silent", "trace", "debug", "info", "warn" or "error". Defaults to "info". See https://github.com/pimterry/loglevel for more information.
   * @property {boolean} headless - Should Playwright run in headless mode? Defaults to `false`.
   * @property {string} proxyHost - What host should Playwright proxy through for capture? Defaults to `localhost`.
   * @property {number} proxyPort - What port should Playwright proxy through for capture? Defaults to 9000.
   * @property {boolean} proxyVerbose - Should log entries from the proxy be printed? Defaults to `false`.
   * @property {number} totalTimeout - How long should Mischief wait for all steps in the capture to complete, in ms? Defaults to 5min.
   * @property {number} loadTimeout - How long should Mischief wait for the page to load, in ms? Defaults to 30s.
   * @property {number} networkIdleTimeout - How long should Mischief wait for network events to complete, in ms. Defaults to 30s.
   * @property {number} behaviorsTimeout - How long should Mischief wait for media to play, secondary resources, and site specific behaviors (in total)? Defaults to 60s.
   * @property {boolean} keepPartialResponses - Should Mischief keep partially downloaded resources? Defaults to `true`.
   * @property {number} maxSize - Maximum size, in bytes, for the exchanges list. Defaults to 200Mb.
   * @property {boolean} screenshot - Should Mischief try to make a screenshot? Defaults to `true`. Screenshot will be added as `file:///screenshot.png` in the exchanges list.
   * @property {boolean} domSnapshot - Should Mischief save a snapshot of the rendered DOM? Defaults to `true`. Added as `file:///dom-snapshot.html` in the exchanges list.
   * @property {boolean} pdfSnapshot - Should Mischief save a PDF of the rendered page? Defaults to `false`. Only available in headless mode. Added as `file:///pdf-snapshot.pedf` in the exchanges list. Defaults to `true`.
   * @property {boolean} captureVideoAsAttachment - If `true`, will try to capture the main video that may be present in this page as `file:///video-extracted.mp4`. Will also save associated meta data as `file:///video-extracted-metadata.json`. This capture happens out of the browser. Defaults to `true`.
   * @property {number} captureVideoAsAttachmentTimeout - How long should Mischief wait for `captureVideoAsAttachment` to finish. Defaults to 30s.
   * @property {string} ytDlpPath - Path to the yt-dlp executable to be used. Defaults to `./executables`.
   * @property {number} captureWindowX - Browser window resolution in pixels: X axis. Defaults to 1600.
   * @property {number} captureWindowY - Browser window resolution in pixels: Y axis. Defaults to 900.
   * @property {boolean} autoScroll - Should Mischief try to scroll through the page? Defaults to `true`.
   * @property {boolean} autoPlayMedia - Should Mischief try to autoplay `<audio>` and `<video>` tags? Defaults to `true`.
   * @property {boolean} grabSecondaryResources - Should Mischief try to download img srcsets and secondary stylesheets? Defaults to `true`.
   * @property {boolean} runSiteSpecificBehaviors - Should Mischief run behaviors tailored to specific sites (ex: Twitter) in an attempt to better grab the page? Defaults to `true`.
   * @property {string} intercepter - Network interception method to be used. Available at the moment: "MischiefProxy".
   * @property {string} userAgentSuffix - String to append to the user agent. Defaults to an empty string.
   * @property {boolean} provenanceSummary - If `true`, information about the capture process (public IP address, User Agent, software version ...) will be gathered and summarized under `file:///provenance-summary.html`. WACZ exports will also hold that information at `datapackage.json` level, under `extras`. Defaults to `true`.
   * @property {string} publicIpResolverEndpoint - URL to be used to retrieve the client's public IP address for `provenanceSummary`. Endpoint requirements: must simply return a IPv4 or IPv6 address as text. Defaults to "https://myip.lil.tools".
   * @property {string} tmpFolderPath - Path to the temporary folder Mischief uses. Defaults to `./tmp`.
   * @property {string[]} blocklist - a list of patterns, to be matched against each request's URL and IP address, and subsequently blocked during capture. Valid entries include url strings, CIDR strings, and regular expressions.
   */
  static defaults = {
    logLevel: 'info',
    headless: true,
    proxyHost: 'localhost',
    proxyPort: 9000,
    proxyVerbose: false,
    totalTimeout: 2 * 60 * 1000,
    loadTimeout: 30 * 1000,
    networkIdleTimeout: 30 * 1000,
    behaviorsTimeout: 60 * 1000,
    keepPartialResponses: true,
    maxSize: 200 * 1024 * 1024,
    screenshot: true,
    domSnapshot: true,
    pdfSnapshot: true,
    captureVideoAsAttachment: true,
    captureVideoAsAttachmentTimeout: 30 * 1000,
    ytDlpPath: `${process.env.PWD}/executables/yt-dlp`,
    captureWindowX: 1600,
    captureWindowY: 900,
    autoScroll: true,
    autoPlayMedia: true,
    grabSecondaryResources: true,
    runSiteSpecificBehaviors: true,
    intercepter: 'MischiefProxy',
    userAgentSuffix: '',
    provenanceSummary: true,
    publicIpResolverEndpoint: 'https://myip.lil.tools',
    tmpFolderPath: `${process.env.PWD}/tmp/`,
    blocklist: [
      '/\.png/',
      '/https?:\/\/localhost/',
      '0.0.0.0/8',
      '10.0.0.0/8',
      '100.64.0.0/10',
      '127.0.0.0/8',
      '169.254.0.0/16',
      '172.16.0.0/12',
      '192.0.0.0/29',
      '192.0.2.0/24',
      '192.88.99.0/24',
      '192.168.0.0/16',
      '198.18.0.0/15',
      '198.51.100.0/24',
      '203.0.113.0/24',
      '224.0.0.0/4',
      '240.0.0.0/4',
      '255.255.255.255/32',
      '::/128',
      '::1/128',
      '::ffff:0:0/96',
      '100::/64',
      '64:ff9b::/96',
      '2001::/32',
      '2001:10::/28',
      '2001:db8::/32',
      '2002::/16',
      'fc00::/7',
      'fe80::/10',
      'ff00::/8'
    ]
  }

  /**
   * Filters an options object by comparing it with `MischiefOptions`.
   * Will use defaults for missing properties.
   *
   * @param {object} newOptions
   */
  static filterOptions (newOptions) {
    const options = {}
    const defaults = MischiefOptions.defaults

    // Create new option object from `newOptions` and `defaults`:
    // - Only pull entries from `newOptions` that are defined in `defaults`
    // - Apply basic type casting based on type of defaults
    for (const key of Object.keys(defaults)) {
      options[key] = key in newOptions ? newOptions[key] : defaults[key]

      const constructor = defaults[key].constructor
      switch (constructor) {
        case Boolean:
        case Number:
        case String:
          options[key] = constructor(options[key])
          break

        default:
          if(options[key].constructor != constructor) {
            throw new Error(`${key} must be type ${constructor.name}`)
          }
      }
    }

    // Check for invalid combinations
    if (options.pdfSnapshot && !options.headless) {
      throw new Error('"pdfSnapshot" option is only available in "headless" mode. Both options need to be "true".')
    }

    // Check that paths are valid
    if (!statSync(options.ytDlpPath).isFile()) {
      throw new Error('"ytDlpPath" must be a path to a file.')
    }

    if (options.tmpFolderPath !== path.normalize(options.tmpFolderPath)) {
      throw new Error('"tmpFolderPath" must be a path to a directory.')
    }

    return options
  }
}

import path from 'path'
import { statSync } from 'fs'
// Note: used `statSync` instead of `stat` from `fs/promises` here for convenience.
// We're using `MischiefOptions.filterOptions()` in `Mischief()`, which cannot be async.

/**
 * Helper class to filter and validate options passed to a Mischief instance.
 */
export class MischiefOptions {
  /**
   * Available options and defaults for Mischief.
   * Unless specified otherwise at constructor level, Mischief will run with these settings.
   *
   * @property {boolean} logLevel="info" - Determines the logging level of this instance. Can be "silent", "trace", "debug", "info", "warn" or "error". See https://github.com/pimterry/loglevel for more information.
   * @property {boolean} headless=false - Should Playwright run in headless mode?
   * @property {string} proxyHost="localhost" - What host should Playwright proxy through for capture?
   * @property {number} proxyPort=9000 - What port should Playwright proxy through for capture?
   * @property {boolean} proxyVerbose=false - Should log entries from the proxy be printed?
   * @property {number} totalTimeout=300000 - How long should Mischief wait for all steps in the capture to complete, in ms?
   * @property {number} loadTimeout=30000 - How long should Mischief wait for the page to load, in ms?
   * @property {number} networkIdleTimeout=30000 - How long should Mischief wait for network events to complete, in ms.
   * @property {number} behaviorsTimeout=60000 - How long should Mischief wait for media to play, secondary resources, and site specific behaviors (in total), in ms?
   * @property {boolean} keepPartialResponses=true - Should Mischief keep partially downloaded resources?
   * @property {number} maxSize=209715200 - Maximum size, in bytes, for the exchanges list.
   * @property {boolean} screenshot=true - Should Mischief try to make a screenshot? Screenshot will be added as `file:///screenshot.png` in the exchanges list.
   * @property {boolean} domSnapshot=true - Should Mischief save a snapshot of the rendered DOM? Added as `file:///dom-snapshot.html` in the exchanges list.
   * @property {boolean} pdfSnapshot=false - Should Mischief save a PDF of the rendered page? Only available in headless mode. Added as `file:///pdf-snapshot.pedf` in the exchanges list.
   * @property {boolean} captureVideoAsAttachment=true - If `true`, will try to capture the main video that may be present in this page as `file:///video-extracted.mp4`. Will also save associated meta data as `file:///video-extracted-metadata.json`. This capture happens out of the browser.
   * @property {number} captureVideoAsAttachmentTimeout=30000 - How long should Mischief wait for `captureVideoAsAttachment` to finish.
   * @property {string} ytDlpPath="./executables" - Path to the yt-dlp executable to be used.
   * @property {number} captureWindowX=1600 - Browser window resolution in pixels: X axis.
   * @property {number} captureWindowY=900 - Browser window resolution in pixels: Y axis.
   * @property {boolean} autoScroll=true - Should Mischief try to scroll through the page?
   * @property {boolean} autoPlayMedia=true - Should Mischief try to autoplay `<audio>` and `<video>` tags?
   * @property {boolean} grabSecondaryResources=true - Should Mischief try to download img srcsets and secondary stylesheets?
   * @property {boolean} runSiteSpecificBehaviors=true - Should Mischief run behaviors tailored to specific sites (ex: Twitter) in an attempt to better grab the page?
   * @property {string} intercepter="MischiefProxy" - Network interception method to be used. Available at the moment: "MischiefProxy".
   * @property {string} userAgentSuffix="" - String to append to the user agent.
   * @property {boolean} provenanceSummary=true - If `true`, information about the capture process (public IP address, User Agent, software version ...) will be gathered and summarized under `file:///provenance-summary.html`. WACZ exports will also hold that information at `datapackage.json` level, under `extras`.
   * @property {string} publicIpResolverEndpoint="https://myip.lil.tools" - URL to be used to retrieve the client's public IP address for `provenanceSummary`. Endpoint requirements: must simply return a IPv4 or IPv6 address as text.
   * @property {string} tmpFolderPath="./tmp" - Path to the temporary folder Mischief uses.
   * @property {string[]} blocklist - a list of patterns, to be matched against each request's URL and IP address, and subsequently blocked during capture. Valid entries include url strings, CIDR strings, and regular expressions in string form.
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
      '/https?:\/\/localhost/', // eslint-disable-line
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
          if (options[key].constructor !== constructor) {
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

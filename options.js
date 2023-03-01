/// <reference path="./options.types.js" />

import { statSync } from 'fs' // Cannot be promisified at this stage (used in constructor)
import * as CONSTANTS from './constants.js'

/** @type {ScoopOptions} */
export const defaults = {
  logLevel: 'info',

  screenshot: true,
  pdfSnapshot: true,
  domSnapshot: false,
  captureVideoAsAttachment: true,
  provenanceSummary: true,

  totalTimeout: 60 * 1000,
  loadTimeout: 30 * 1000,
  networkIdleTimeout: 30 * 1000,
  behaviorsTimeout: 30 * 1000,
  captureVideoAsAttachmentTimeout: 30 * 1000,

  captureWindowX: 1600,
  captureWindowY: 900,

  maxSize: 200 * 1024 * 1024,
  keepPartialResponses: true,

  autoScroll: true,
  autoPlayMedia: true,
  grabSecondaryResources: true,
  runSiteSpecificBehaviors: true,

  headless: true,
  userAgentSuffix: '',

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
  ],

  intercepter: 'ScoopProxy',
  proxyHost: 'localhost',
  proxyPort: 9000,
  proxyVerbose: false,

  publicIpResolverEndpoint: 'https://myip.lil.tools',
  ytDlpPath: `${CONSTANTS.EXECUTABLES_PATH}yt-dlp`
}

/**
 * Basic set of options to be used with Scoop for automated testing purposes.
 * @type {ScoopOptions}
 * @ignore
 */
export const testDefaults = {
  ...defaults,
  logLevel: 'silent',
  headless: true,
  captureVideoAsAttachment: false,
  provenanceSummary: true,
  proxyPort: Math.floor(5000 + Math.random() * 5000) // Since each test runs in a different context, they should all get a different port
}

/**
 * Filters a new options object by comparing it with defaults.
 * Will use defaults for missing properties.
 *
 * @param {any} newOptions
 * @returns {ScoopOptions}
 */
export function filterOptions (newOptions = {}) {
  const options = {}

  // Create new option object from `newOptions` and `defaults`:
  // - Only pull entries from `newOptions` that are defined in `defaults`
  // - Apply basic type casting based on type of defaults
  for (const key of Object.keys(defaults)) {
    try {
      options[key] = key in newOptions ? newOptions[key] : defaults[key]
    } catch (_err) { // `key in newOptions` may throw if `newOptions` is not object-like
      options[key] = defaults[key]
    }

    const constructor = defaults[key].constructor

    switch (constructor) {
      case Boolean:
      case Number:
      case String:
        options[key] = constructor(options[key])
        break

      default:
        if (options[key].constructor !== constructor) {
          throw new Error(`"${key}" must be type ${constructor.name}`)
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

  return options
}

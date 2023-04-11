#! /usr/bin/env node

import { equal as assert } from 'node:assert/strict'
import fs from 'fs/promises'
import path from 'path'

import { Command, Option } from 'commander'

import { Scoop } from '../Scoop.js'
import { PACKAGE_INFO } from '../constants.js'

/** @type {Command} */
const program = new Command()

/** @type {ScoopOptions} */
const defaults = Scoop.defaults

//
// Program info
//
program
  .name('scoop')
  .description(`${PACKAGE_INFO.description}\nMore info: https://github.com/harvard-lil/scoop`)
  .version(PACKAGE_INFO.version, '-v, --version', 'Display Scoop and Scoop CLI version.')
  .helpOption(null, 'Show options list.')

//
// I-O options and args
//
program.arguments('<url>')

program.addOption(
  new Option('-o, --output <string>', 'Output path.')
    .default(path.join(process.env.PWD, 'archive.wacz'))
)

program.addOption(
  new Option('-f, --format <string>', 'Output format.')
    .choices(['warc', 'warc-gzipped', 'wacz', 'wacz-with-raw'])
    .default('wacz')
)

program.addOption(
  new Option(
    '--json-summary-output <string>',
    'If set, allows for saving a capture summary as JSON. Must be a path to .json file. ')
)

//
// Signing
//
program.addOption(
  new Option('--signing-url <string>', 'Authsign-compatible endpoint for signing WACZ file.')
)

program.addOption(
  new Option('--signing-token <string>', 'Authentication token to --signing-url, if needed.')
)

//
// Features options
//
program.addOption(
  new Option('--screenshot <bool>', 'Add screenshot step to capture?')
    .choices(['true', 'false'])
    .default(String(defaults.screenshot))
)

program.addOption(
  new Option('--pdf-snapshot <bool>', 'Add PDF snapshot step to capture?')
    .choices(['true', 'false'])
    .default(String(defaults.pdfSnapshot))
)

program.addOption(
  new Option('--dom-snapshot <bool>', 'Add DOM snapshot step to capture?')
    .choices(['true', 'false'])
    .default(String(defaults.domSnapshot))
)

program.addOption(
  new Option('--capture-video-as-attachment <bool>', 'Add capture video(s) as attachment(s) step to capture?')
    .choices(['true', 'false'])
    .default(String(defaults.captureVideoAsAttachment))
)

program.addOption(
  new Option('--capture-certificates-as-attachment <bool>', 'Add capture certificate(s) as attachment(s) step to capture?')
    .choices(['true', 'false'])
    .default(String(defaults.captureCertificatesAsAttachment))
)

program.addOption(
  new Option('--provenance-summary <bool>', 'Add provenance summary to capture?')
    .choices(['true', 'false'])
    .default(String(defaults.captureVideoAsAttachment))
)

program.addOption(
  new Option('--attachments-bypass-limits <bool>', 'If active, attachments will not count towards time and size constraints imposed on capture (--capture-timeout, --max--capture-size).')
    .choices(['true', 'false'])
    .default(String(defaults.attachmentsBypassLimits))
)

//
// Timeouts
//
program.addOption(
  new Option(
    '--capture-timeout <number>',
    'Maximum time allocated to capture process before hard cut-off, in ms.')
    .default(defaults.captureTimeout)
)

program.addOption(
  new Option(
    '--load-timeout <number>',
    'Max time Scoop will wait for the page to load, in ms.')
    .default(defaults.loadTimeout)
)

program.addOption(
  new Option(
    '--network-idle-timeout <number>',
    'Max time Scoop will wait for the in-browser networking tasks to complete, in ms.')
    .default(defaults.networkIdleTimeout)
)

program.addOption(
  new Option(
    '--behaviors-timeout <number>',
    'Max time Scoop will wait for the browser behaviors to complete, in ms.')
    .default(defaults.behaviorsTimeout)
)

program.addOption(
  new Option(
    '--capture-video-as-attachment-timeout <number>',
    'Max time Scoop will wait for the video capture process to complete, in ms.')
    .default(defaults.captureVideoAsAttachmentTimeout)
)

//
// Dimensions
//
program.addOption(
  new Option(
    '--capture-window-x <number>',
    'Width of the browser window Scoop will open to capture, in pixels.')
    .default(defaults.captureWindowX)
)

program.addOption(
  new Option(
    '--capture-window-y <number>',
    'Height of the browser window Scoop will open to capture, in pixels.')
    .default(defaults.captureWindowY)
)

//
// Size
//
program.addOption(
  new Option(
    '--max-capture-size <number>',
    'Size limit for the capture\'s exchanges list, in bytes.')
    .default(defaults.maxCaptureSize)
)

//
// Behaviors
//
program.addOption(
  new Option(
    '--auto-scroll <bool>',
    'Should Scoop try to scroll through the page?')
    .choices(['true', 'false'])
    .default(String(defaults.autoScroll))
)

program.addOption(
  new Option(
    '--auto-play-media <bool>',
    'Should Scoop try to autoplay `<audio>` and `<video>` tags?')
    .choices(['true', 'false'])
    .default(String(defaults.autoPlayMedia))
)

program.addOption(
  new Option(
    '--grab-secondary-resources <bool>',
    'Should Scoop try to download img srcsets and secondary stylesheets?')
    .choices(['true', 'false'])
    .default(String(defaults.grabSecondaryResources))
)

program.addOption(
  new Option(
    '--run-site-specific-behaviors <bool>',
    'Should Scoop run site-specific capture behaviors? (via: browsertrix-behaviors)')
    .choices(['true', 'false'])
    .default(String(defaults.runSiteSpecificBehaviors))
)

//
// Browser
//
program.addOption(
  new Option(
    '--headless <bool>',
    'Should Chrome run in headless mode?')
    .choices(['true', 'false'])
    .default(String(defaults.headless))
)

program.addOption(
  new Option(
    '--user-agent-suffix <string>',
    'If provided, will be appended to Chrome\'s user agent.')
    .default(String(defaults.userAgentSuffix))
)

//
// Networking
//
program.addOption(
  new Option(
    '--blocklist <string>',
    'If set, replaces Scoop\'s default list of url patterns and IP ranges Scoop should not capture. Comma-separated. Example: "/https?:\/\/localhost/,0.0.0.0/8,10.0.0.0".') // eslint-disable-line
  // .default(defaults.blocklist.join(','))
)

program.addOption(
  new Option(
    '--intercepter <string>',
    'ScoopIntercepter class to be used to intercept network exchanges.')
    .default(defaults.intercepter)
)

program.addOption(
  new Option(
    '--proxy-host <string>',
    'Hostname to be used by Scoop\'s HTTP proxy.')
    .default(defaults.proxyHost)
)

program.addOption(
  new Option(
    '--proxy-port <string>',
    'Port to be used by Scoop\'s HTTP proxy.')
    .default(defaults.proxyPort)
)

program.addOption(
  new Option(
    '--proxy-verbose <bool>',
    'Should Scoop\'s HTTP proxy output logs to the console?')
    .choices(['true', 'false'])
    .default(String(defaults.proxyVerbose))
)

program.addOption(
  new Option(
    '--public-ip-resolver-endpoint <string>',
    'API endpoint to be used to resolve the client\'s IP address. Used in the context of the provenance summary.')
    .default(defaults.publicIpResolverEndpoint)
)

//
// Misc
//
program.addOption(
  new Option(
    '--yt-dlp-path <string>',
    'Path to the yt-dlp executable. Used for capturing videos.')
    .default(defaults.ytDlpPath)
)

program.addOption(
  new Option('--log-level <string>', 'Controls Scoop CLI\'s verbosity.')
    .choices(['silent', 'trace', 'debug', 'info', 'warn', 'error'])
    .default(defaults.logLevel)
)

//
// Run
//
program.action(async (name, options, command) => {
  /** @type {?string} */
  let url = null

  /** @type {?Scoop} */
  let capture = null

  /** @type {?ArrayBuffer} */
  let archive = null

  /** @type {string}  */
  const extension = path.extname(options.output)

  //
  // Process options
  //

  // `options.output` must end with appropriate extension, matching selected file format
  try {
    switch (options.format) {
      case 'warc':
        assert(extension, '.warc')
        break

      case 'warc-gzipped':
        assert(extension, '.gz')
        assert(options.output.endsWith('.warc.gz'), true)
        break

      case 'wacz':
      case 'wacz-with-raw':
        assert(extension, '.wacz')
        break

      default:
        throw new Error(`Unspecified or invalid extension (${extension})`)
    }
  } catch (err) {
    // We have to manually handle log level at this stage
    if (options.logLevel === 'trace') {
      console.trace(err)
    }
    console.error(`Mismatch between selected output path ("${options.output}") and output format ("${options.format}").`)
    process.exit(1)
  }

  // `options.output` folder must be accessible.
  try {
    await fs.access(path.dirname(options.output))
  } catch (err) {
    console.error(`Output path does not exist or is not accessible: "${path.dirname(options.output)}"`)
    process.exit(1)
  }

  // `options.jsonSummaryOutput`: if set, must be an accessible `.json`
  if (options.jsonSummaryOutput) {
    try {
      assert(options.jsonSummaryOutput.endsWith('.json'), true)
      await fs.access(path.dirname(options.jsonSummaryOutput))
    } catch (err) {
      console.error('JSON summary path must end with .json and lead to a directory that exists.')
      process.exit(1)
    }
  }

  // Convert 'true' / 'false' strings to booleans.
  for (const [key, value] of Object.entries(options)) {
    if (value === 'true') {
      options[key] = true
    }

    if (value === 'false') {
      options[key] = false
    }
  }

  // Split blocklist
  if (options.blocklist) {
    options.blocklist = options.blocklist.replaceAll(' ', '').split(',')
  }

  //
  // Capture
  //
  try {
    url = command.processedArgs[0]
    capture = await Scoop.capture(url, options)
  } catch (err) {
    process.exit(1) // Logs handled by Scoop
  }

  //
  // Pack using chosen output format
  //
  try {
    switch (options.format) {
      case 'warc':
      case 'warc-gzipped': {
        const gzipped = options.format === 'warc-gzipped'

        capture.log.info(`Exporting capture to WARC ${gzipped ? '(Gzipped)' : ''}`)

        archive = await capture.toWARC(gzipped)
        break
      }

      case 'wacz':
      case 'wacz-with-raw': {
        const includeRaw = options.format === 'wacz-with-raw'

        capture.log.info(`Exporting capture to WACZ ${includeRaw ? 'with raw exchanges' : ''}`)

        archive = await capture.toWACZ(includeRaw, {
          url: options?.signingUrl,
          token: options?.signingToken
        })

        break
      }
    }
  } catch (err) {
    capture.log.trace(err)
    capture.log.error(`Something went wrong while preparing ${options.output}. Use --log-level trace for details.`)
    process.exit(1)
  }

  //
  // Save to disk
  //
  try {
    await fs.writeFile(options.output, Buffer.from(archive))
    capture.log.info(`${options.output} saved to disk.`)
  } catch (err) {
    capture.log.trace(err)
    capture.log.error(`Something went wrong while saving ${options.output} to disk. Use --log-level trace for details.`)
    process.exit(1)
  }

  //
  // JSON summary (?)
  //
  if (options.jsonSummaryOutput) {
    try {
      const summary = JSON.stringify(await capture.summary(), null, 2)
      await fs.writeFile(options.jsonSummaryOutput, summary)
      capture.log.info(`${options.jsonSummaryOutput} saved to disk.`)
    } catch (err) {
      capture.log.trace(err)
      capture.log.error(`Something went wrong while saving ${options.jsonSummaryOutput} to disk. Use --log-level trace for details.`)
      process.exit(1)
    }
  }

  process.exit(0)
})

program.parse()

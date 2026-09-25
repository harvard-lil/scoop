import fs from 'fs/promises'
import { dirname, join, sep } from 'path'
import { fileURLToPath } from 'url'

import chalk from 'chalk'

import { describeVersion } from './utils/version.js'

/**
 * Description of this software.
 * Used in provenance data to indicate which software made the capture.
 */
export const SOFTWARE = 'Scoop @ Harvard Library Innovation Lab'

/**
 * The version of WARC this library exports
 */
export const WARC_VERSION = '1.1'

/**
 * The version of WACZ this library exports
 */
export const WACZ_VERSION = '1.1.1'

/**
 * Label to be used in WARC to keep trace of ScoopExchange.id.
 */
export const EXCHANGE_ID_HEADER_LABEL = 'Scoop-Exchange-ID'

/**
 * Label to be used in WARC to keep trace of ScoopGeneratedExchange.description.
 */
export const EXCHANGE_DESCRIPTION_HEADER_LABEL = 'Scoop-Exchange-Description'

/**
 * Byte limit for HTTP header blocks parsed by Scoop's proxy and its metadata HEAD request.
 * Matches Chromium's response header limit (net::HttpStreamParser::kMaxHeaderBufSize, 256 KiB),
 * so that the proxy does not reject a response the browser would render.
 * Node's default (16 KiB) rejects real sites that send large Content-Security-Policy headers.
 */
export const MAX_HTTP_HEADER_SIZE = 256 * 1024

/**
 * Path to the Scoop library.
 */
export const BASE_PATH = dirname(fileURLToPath(import.meta.url))

/**
 * Location of the directory in which assets may be rendered (ex: the provenance summary)
 */
export const ASSETS_PATH = join(BASE_PATH, 'assets', sep)

/**
 * Path to the executables folder.
 */
export const EXECUTABLES_PATH = join(BASE_PATH, 'executables', sep)

/**
 * Path to the templates folder.
 */
export const TEMPLATES_PATH = join(ASSETS_PATH, 'templates', sep)

/**
 * Path to the temporary folder.
 */
export const TMP_PATH = join(BASE_PATH, 'tmp', sep)

/**
 * Location of the testing fixtures folder.
 */
export const FIXTURES_PATH = join(ASSETS_PATH, 'fixtures', sep)

/**
 * Colors used by the logging function
 */
export const LOGGING_COLORS = {
  DEFAULT: chalk.gray,
  TRACE: chalk.magenta,
  DEBUG: chalk.cyan,
  INFO: chalk.blue,
  WARN: chalk.yellow,
  ERROR: chalk.red
}

/**
 * This project's package.json as a frozen object.
 * @constant
 * @type {object}
 */
export const PACKAGE_INFO = Object.freeze(
  JSON.parse(await fs.readFile(join(BASE_PATH, 'package.json')))
)

/**
 * The commit this copy of Scoop was built from, when it came from an archive
 * of a git commit, as npm installs a GitHub dependency. Null otherwise.
 *
 * build-info.json is marked `export-subst` in .gitattributes, so `git archive`
 * (and GitHub's tarballs) replace its placeholder with the commit. In a git
 * checkout, or a package published from one, the placeholder stays.
 * @constant
 * @type {?string}
 */
export const BUILD_COMMIT = await fs.readFile(join(BASE_PATH, 'build-info.json'))
  .then(data => {
    const { commit } = JSON.parse(data)
    return /^[0-9a-f]{40}$/.test(commit) ? commit : null
  })
  .catch(err => {
    if (err.code === 'ENOENT') return null
    throw err
  })

/**
 * The current version of Scoop. Also used in provenance data.
 * Between releases, includes the commit: see `describeVersion`.
 */
export const VERSION = describeVersion(PACKAGE_INFO.version, BUILD_COMMIT)

/**
 * @module CONSTANTS
 * @description Constants used across the library.
 */
import { dirname } from 'path'
import { fileURLToPath } from 'url'

import chalk from 'chalk'

/**
 * Description of this software.
 * Used in provenance data to indicate which softare made the capture.
 */
export const SOFTWARE = 'Mischief @ Harvard Library Innovation Lab'

/**
 * The current version of Mischief. Also used in provenance data.
 */
export const VERSION = 'v0.0.1 DEV'

/**
 * The version of WARC this library exports
 */
export const WARC_VERSION = '1.1'

/**
 * The version of WACZ this library exports
 */
export const WACZ_VERSION = '1.1.1'

/**
 * Path to the Mischief library.
 */
export const BASE_PATH = dirname(fileURLToPath(import.meta.url))

/**
 * Location of the directory in which assets may be rendered (ex: the provenance summary)
 */
export const ASSETS_PATH = `${BASE_PATH}/assets/`

/**
 * Path to the templates folder.
 */
export const TEMPLATES_PATH = `${BASE_PATH}/assets/templates/`

/**
 * Path to the executables folder.
 */
export const EXECUTABLES_PATH = `${BASE_PATH}/executables/`

/**
 * Path to the temporary folder.
 */
export const TMP_PATH = `${BASE_PATH}/tmp/`

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

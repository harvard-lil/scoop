/**
 * Mischief
 * @module CONSTANTS
 * @description Constants used across the library.
 */
import { dirname } from 'path'
import { fileURLToPath } from 'url'

import chalk from 'chalk'

/**
 * Description of this software
 */
export const SOFTWARE = 'Mischief @ Harvard Library Innovation Lab'

/**
 * The current version of Mischief
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
 * Library directory
 */
export const BASE_PATH = dirname(fileURLToPath(import.meta.url))

/**
 * Location of the assets folder.
 */
export const ASSETS_PATH = `${BASE_PATH}/assets/`

/**
 * Location of the directory in which assets may be rendered (ex: the provenance summary)
 */
export const TEMPLATES_PATH = `${BASE_PATH}/assets/templates/`

/**
 * Location of the temporary folder in which Mischief may add and delete files
 */
export const TMP_PATH = `${BASE_PATH}/tmp/`

/**
 * Location of the directory in which self-contained dependencies are stored
 */
export const EXECUTABLES_PATH = `${BASE_PATH}/executables/`

/**
 * Colors used by the logging function.
 */
export const LOGGING_COLORS = {
  DEFAULT: chalk.gray,
  TRACE: chalk.magenta,
  DEBUG: chalk.cyan,
  INFO: chalk.blue,
  WARN: chalk.yellow,
  ERROR: chalk.red
}

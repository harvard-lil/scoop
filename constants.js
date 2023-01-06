/**
 * Mischief
 * @module CONSTANTS
 * @description Constants used across the library.
 */

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
 * Location of the directory in which assets may be rendered (ex: the provinance summary)
 */
export const ASSETS_DIR = './assets/'

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

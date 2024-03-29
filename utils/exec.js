import { promisify } from 'util'
import { exec as execCB } from 'child_process'
const execPromisified = promisify(execCB)

/**
 * A async version of exec that also adds an `options.input`
 * that is passed to stdin, mirroring the functionality of `execSync`
 *
 * @param {string} file - The name or path of the executable file to run.
 * @param {?string[]} args - List of string arguments.
 * @param {Object} options
 * @returns {Promise<?string>} - The contents of stdout
 */
export async function exec (file, args = [], options = {}) {
  const promise = execPromisified([file, ...args].join(' '), options)

  if (options.input) {
    promise.child.stdin.write(options.input)
    promise.child.stdin.end()
  }

  try {
    const { stdout } = await promise
    return stdout
  } catch (err) {
    throw new Error(err) // Should be stderr
  }
}

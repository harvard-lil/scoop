import { execFile as execFileCallback } from 'node:child_process'
import { promisify } from 'node:util'

const execFile = promisify(execFileCallback)

/**
 * Copy an environment while omitting selected variables.
 *
 * @param {NodeJS.ProcessEnv} environment - Environment to copy.
 * @param {string[]} variableNames - Exact variable names to omit.
 * @returns {NodeJS.ProcessEnv} A sanitized copy of the environment.
 */
export function omitEnvironmentVariables (environment, variableNames) {
  const childEnvironment = { ...environment }

  for (const variableName of variableNames) {
    delete childEnvironment[variableName]
  }

  return childEnvironment
}

/**
 * Run an executable with literal arguments and return its stdout.
 *
 * `shell` is deliberately unsupported. Timeouts, AbortSignal, output limits,
 * and failure metadata use Node's execFile implementation.
 *
 * @param {string} file - The name or path of the executable file to run.
 * @param {string[]} args - List of literal arguments.
 * @param {import('node:child_process').ExecFileOptions & { input?: string | Buffer }} options
 * @returns {Promise<string | Buffer>} The contents of stdout.
 */
export async function exec (file, args = [], options = {}) {
  if (options.shell && options.shell !== false) {
    throw new TypeError('exec does not support shell execution')
  }

  const { input, shell: _shell, ...execOptions } = options
  const promise = execFile(file, args, { ...execOptions, shell: false })
  promise.child.stdin.end(input)
  const { stdout } = await promise
  return stdout
}

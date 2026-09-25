import os from 'node:os'
import { readFile } from 'node:fs/promises'

/**
 * The operating system's name and version, as precisely as it records them,
 * or null when it cannot be identified.
 *
 * - Linux (and other systems with os-release): `NAME`, and `VERSION` or
 *   `VERSION_ID` from /etc/os-release or /usr/lib/os-release. Debian keeps
 *   its point release only in /etc/debian_version, so that is used when present.
 *   Debian: "Debian GNU/Linux" / "12.15 (bookworm)".
 *   Ubuntu: "Ubuntu" / "24.04.5 LTS (Noble Numbat)".
 * - macOS: `ProductName` and `ProductVersion` from SystemVersion.plist:
 *   "macOS" / "15.7.9".
 * - Windows: "Windows" and the kernel version: "10.0.22631".
 *
 * @param {object} [system] - For testing: the platform, release, and a file reader.
 * @returns {Promise<?{name: string, version: string}>}
 */
export async function getOSInfo ({ platform = os.platform(), release = os.release(), read = readText } = {}) {
  if (platform === 'win32') {
    return { name: 'Windows', version: release }
  }

  if (platform === 'darwin') {
    const plist = await read('/System/Library/CoreServices/SystemVersion.plist')
    const name = plist && plistString(plist, 'ProductName')
    const version = plist && plistString(plist, 'ProductVersion')
    return name && version ? { name, version } : null
  }

  const text = await read('/etc/os-release') ?? await read('/usr/lib/os-release')
  if (!text) {
    return null
  }

  const fields = parseOsRelease(text)
  let version = fields.VERSION || fields.VERSION_ID

  if (fields.ID === 'debian') {
    const pointRelease = (await read('/etc/debian_version'))?.trim()
    if (pointRelease && /^\d+(\.\d+)*$/.test(pointRelease)) {
      version = fields.VERSION_CODENAME ? `${pointRelease} (${fields.VERSION_CODENAME})` : pointRelease
    }
  }

  return fields.NAME && version ? { name: fields.NAME, version } : null
}

/**
 * Parses an os-release file: `KEY=value` lines, values optionally quoted.
 *
 * @param {string} text
 * @returns {Object<string, string>}
 */
export function parseOsRelease (text) {
  const fields = {}
  for (const line of text.split('\n')) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (!match) continue
    let value = match[2].trim()
    const quote = value[0]
    if ((quote === '"' || quote === "'") && value.endsWith(quote) && value.length > 1) {
      value = value.slice(1, -1)
      if (quote === '"') {
        value = value.replace(/\\(["\\$`])/g, '$1')
      }
    }
    fields[match[1]] = value
  }
  return fields
}

/**
 * The `<string>` following `<key>name</key>` in a property list.
 *
 * @param {string} plist
 * @param {string} name
 * @returns {?string}
 */
function plistString (plist, name) {
  return plist.match(new RegExp(`<key>${name}</key>\\s*<string>([^<]*)</string>`))?.[1] ?? null
}

/**
 * A file's text, or null if it does not exist or cannot be read.
 *
 * @param {string} path
 * @returns {Promise<?string>}
 */
async function readText (path) {
  try {
    return await readFile(path, 'utf-8')
  } catch (err) {
    if (err.code === 'ENOENT' || err.code === 'EACCES') return null
    throw err
  }
}

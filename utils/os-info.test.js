import { test } from 'node:test'
import assert from 'node:assert/strict'

import { getOSInfo, parseOsRelease } from './os-info.js'

/** A file reader over these paths and contents; other paths do not exist. */
const files = (contents) => async (path) => contents[path] ?? null

const linux = (contents) => getOSInfo({ platform: 'linux', release: '6.8.0', read: files(contents) })

test('Debian reports its point release from /etc/debian_version', async () => {
  assert.deepEqual(await linux({
    '/etc/os-release': 'PRETTY_NAME="Debian GNU/Linux 12 (bookworm)"\nNAME="Debian GNU/Linux"\nVERSION_ID="12"\nVERSION="12 (bookworm)"\nVERSION_CODENAME=bookworm\nID=debian\n',
    '/etc/debian_version': '12.15\n'
  }), { name: 'Debian GNU/Linux', version: '12.15 (bookworm)' })
})

test('Ubuntu reports VERSION, which has its point release, and ignores /etc/debian_version', async () => {
  assert.deepEqual(await linux({
    '/etc/os-release': 'NAME="Ubuntu"\nVERSION_ID="24.04"\nVERSION="24.04.5 LTS (Noble Numbat)"\nID=ubuntu\nID_LIKE=debian\n',
    '/etc/debian_version': 'trixie/sid\n'
  }), { name: 'Ubuntu', version: '24.04.5 LTS (Noble Numbat)' })
})

test('without VERSION, VERSION_ID is used; /usr/lib/os-release is the fallback', async () => {
  assert.deepEqual(await linux({
    '/usr/lib/os-release': 'NAME="Alpine Linux"\nID=alpine\nVERSION_ID=3.20.10\n'
  }), { name: 'Alpine Linux', version: '3.20.10' })
})

test('NixOS is identified from os-release', async () => {
  assert.deepEqual(await linux({
    '/etc/os-release': 'NAME=NixOS\nID=nixos\nVERSION="25.05 (Warbler)"\nVERSION_ID="25.05"\n',
    '/etc/lsb-release': 'DISTRIB_ID=nixos\n'
  }), { name: 'NixOS', version: '25.05 (Warbler)' })
})

test('an unidentifiable system is null', async () => {
  assert.equal(await linux({}), null)
  assert.equal(await linux({ '/etc/os-release': 'ID=mystery\n' }), null)
})

test('macOS reports its product name and version', async () => {
  const plist = '<dict>\n\t<key>ProductName</key>\n\t<string>macOS</string>\n\t<key>ProductVersion</key>\n\t<string>15.7.9</string>\n</dict>'
  assert.deepEqual(
    await getOSInfo({ platform: 'darwin', release: '24.6.0', read: files({ '/System/Library/CoreServices/SystemVersion.plist': plist }) }),
    { name: 'macOS', version: '15.7.9' }
  )
})

test('Windows reports its kernel version', async () => {
  assert.deepEqual(await getOSInfo({ platform: 'win32', release: '10.0.22631', read: files({}) }), { name: 'Windows', version: '10.0.22631' })
})

test('os-release values may be quoted, with escapes in double quotes', () => {
  assert.deepEqual(parseOsRelease('A=plain\nB="double \\"quoted\\""\nC=\'single\'\n# comment\n\nD=""\n'), {
    A: 'plain', B: 'double "quoted"', C: 'single', D: ''
  })
})

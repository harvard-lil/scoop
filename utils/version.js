/**
 * The version Scoop reports for itself: its package version, and for a
 * prerelease (a build between releases, e.g. `0.7.1-dev.0`) the commit it was
 * built from, as semver build metadata: `0.7.1-dev.0+1a2b3c4`.
 *
 * @param {string} version - The package version.
 * @param {?string} commit - The commit from build-info.json, if known.
 * @returns {string}
 */
export function describeVersion (version, commit) {
  if (!commit || !version.includes('-')) {
    return version
  }
  return `${version}+${commit.slice(0, 7)}`
}

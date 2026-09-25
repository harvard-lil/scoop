# Changelog

## Unreleased

### Compatibility notes

- **Summaries of failed captures.** `--json-summary-output` is now written for failed captures too, with `state` set to FAILED, and the CLI still exits 1. Callers that treated the file's existence as success should check `state`.
- **Version between releases.** Main carries the next version as a prerelease, e.g. `0.7.1-dev.0`. A copy installed from a GitHub commit reports that commit as build metadata, e.g. `0.7.1-dev.0+0031ff8`, in provenance and `--version`.
- **Raw exchange file names.** In WACZs that include raw exchanges (`wacz-with-raw`, `toWACZ(true)`), files are named with a 17-digit UTC timestamp, `raw/request_20260708152143602_<id>`, rather than an ISO timestamp, which the WACZ resource-name pattern does not allow (#417). `Scoop.fromWACZ()` reads both forms.
- **Operating system in provenance.** `osName` and `osVersion` come from what the system records: `/etc/os-release` (and `/etc/debian_version` on Debian) or macOS's `SystemVersion.plist`. On Debian they change from `Debian` / `12.15` to `Debian GNU/Linux` / `12.15 (bookworm)`. They are `null` when the system cannot be identified.

### Additions

- `screenshotMaxWidth` and `screenshotMaxHeight` (`--screenshot-max-width`, `--screenshot-max-height`) clip the full-page screenshot to the top left of the page. The default, `0`, leaves it unbounded. Unbounded, a very tall page can take the browser several gigabytes to render; clipped at 16,000 pixels high, pages that had exhausted a 5 GiB memory limit peaked at about 1.4 GB.
- The capture summary has a `steps` list: each step's name, start time, duration, and outcome (`completed`, `failed`, `limit`, `interrupted`, or `skipped`).

### Fixes

- Accept response headers up to 256 KiB, Chromium's limit. The proxy and the HEAD request rejected more than Node's default of 16 KiB, so pages with large headers, such as a long Content-Security-Policy, failed.
- Fix stalls of up to several minutes, usually in the provenance step, on pages that keep streaming after the capture stops recording, such as video or ads. The proxy copied a response's whole body on every chunk it received.
- Keep the certificate step within its time budget. It could run up to three times its budget, and retried a failed host for every request to it.
- `summary()` no longer throws for a failed capture.
- Capture a URL in the browser when its HEAD request fails. Scoop went by the error response's content type, so a page whose server refuses HEAD with a JSON error was captured as JSON (#406).
- Keep the provenance summary when the operating system cannot be identified, as on NixOS and macOS 26. It was lost (#414).

## 0.7.0 - 2026-09-11

### Compatibility notes

- **Node.js 22 or later.** Previously 20 to 23.
- **Chromium sandbox on by default.** The new `chromiumSandbox` option (`--chromium-sandbox`) defaults to true. Where the sandbox cannot run, for example as root in a container without user namespaces, the browser fails to launch and Scoop does not retry without it; set `chromiumSandbox` to false to run unsandboxed.
- **The blocklist applies to all capture traffic.** Redirects, the browser's proxied requests, certificate collection, and the curl, yt-dlp, and crip helpers are all checked against it, and yt-dlp ignores `NO_PROXY` in the environment. A request to a blocked address by any of these routes fails.
- **Imported archives do not configure Scoop.** `Scoop.fromWACZ()` keeps an archive's recorded options in `provenanceInfo.options` and no longer applies them to the imported capture.

### Fixes

- Run helper programs with literal arguments instead of through a shell.
- Keep a partial capture when the DOM or PDF snapshot stalls.
- The CLI's default `--output` is in the working directory even when `$PWD` is unset or out of date.
- Fix a crash on recent Node versions: "Cannot read properties of null (reading 'timeout')" (#418).

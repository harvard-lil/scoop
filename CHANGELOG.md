# Changelog

## Unreleased

### Compatibility notes

- **Summaries of failed captures.** `--json-summary-output` is now written for failed captures too, with `state` set to FAILED, and the CLI still exits 1. Callers that treated the file's existence as success should check `state`.
- **Version between releases.** Main carries the next version as a prerelease, e.g. `0.7.1-dev.0`. A copy installed from a GitHub commit reports that commit as build metadata, e.g. `0.7.1-dev.0+0031ff8`, in provenance and `--version`.
- **Raw exchange file names.** In WACZs that include raw exchanges (`wacz-with-raw`, `toWACZ(true)`), files are named with a 17-digit UTC timestamp, `raw/request_20260708152143602_<id>`, rather than an ISO timestamp, which the WACZ resource-name pattern does not allow (#417). `Scoop.fromWACZ()` reads both forms.
- **Operating system in provenance.** Drop unmaintained `get-os` dependency and set `osName` and `osVersion` from our own OS-specific checks. On Debian they change from `Debian` / `12.15` to `Debian GNU/Linux` / `12.15 (bookworm)`. They are `null` when the system cannot be identified.

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

## 0.6.59 - 2025-08-08

### Compatibility notes

- **Node.js 20 to 23.** Previously 18 or later (#410).

### Dependencies

- Update yt-dlp (#410).

## 0.6.58 - 2025-06-16

- Update dependencies (#409).

## 0.6.57 - 2025-05-01

- Update yt-dlp (#408).

## 0.6.56 - 2025-04-23

- Update Playwright (#407).

## 0.6.55 - 2025-04-01

- Update yt-dlp (#405).

## 0.6.54 - 2025-03-28

- Update yt-dlp (#404).

## 0.6.53 - 2025-03-26

- Update yt-dlp (#403).

## 0.6.52 - 2025-03-25

- Update yt-dlp (#402).

## 0.6.51 - 2025-03-24

- Update yt-dlp (#401).

## 0.6.50 - 2025-03-18

- Update Playwright (#400).

## 0.6.49 - 2025-03-07

- Update Playwright and other dependencies (#395, #397, #398, #399).

## 0.6.48 - 2025-02-25

- Update yt-dlp (#396).

## 0.6.47 - 2025-02-03

- Update Playwright (#394).

## 0.6.46 - 2025-01-30

- Update Playwright and yt-dlp (#393).

## 0.6.45 - 2025-01-21

- Update yt-dlp (#392).

## 0.6.44 - 2025-01-13

- Update yt-dlp and other dependencies (#390, #391).

## 0.6.43 - 2025-01-07

- Update yt-dlp (#389).

## 0.6.42 - 2024-12-13

- Update yt-dlp (#388).

## 0.6.41 - 2024-12-10

- Update Playwright (#387).

## 0.6.40 - 2024-12-09

- Update yt-dlp (#386).

## 0.6.39 - 2024-12-04

- Update yt-dlp (#384, #385).

## 0.6.38 - 2024-11-22

### Compatibility notes

- **Video attachments are limited to 200 MiB.** A video larger than `maxVideoCaptureSize` is not saved as an attachment (#383).

### Additions

- `maxVideoCaptureSize` (`--max-video-capture-size`) sets the video attachment limit in bytes. The default is 209715200 (#383).

## 0.6.37 - 2024-11-19

- Update cross-spawn (#382).

## 0.6.36 - 2024-11-19

- Update yt-dlp (#380).

## 0.6.35 - 2024-11-19

- Update Playwright (#379).

## 0.6.34 - 2024-11-12

- Update yt-dlp (#378).

## 0.6.33 - 2024-11-05

### Fixes

- Leave out the video summary page and empty video metadata when yt-dlp exits successfully without extracting anything (#377).

## 0.6.32 - 2024-10-31

### Fixes

- Clean up the video metadata string before saving it (#376).

## 0.6.31 - 2024-10-30

### Additions

- `pdfSnapshot` can be used with `headless` set to false. Scoop no longer refuses that combination at startup (#375).

## 0.6.30 - 2024-10-28

- Update Playwright, yt-dlp, and other dependencies (#370, #372, #373).

## 0.6.29 - 2024-10-16

- No changes; version bump only.

## 0.6.28 - 2024-10-16

- Update Playwright and yt-dlp (#368, #369).

## 0.6.27 - 2024-10-01

- Update Playwright to 1.47.2 and yt-dlp to 2024.09.27 (#367).

## 0.6.26 - 2024-10-01

- Update dependencies (#366).

## 0.6.25 - 2024-09-13

- Update Playwright to 1.47.1 (#365).

## 0.6.24 - 2024-09-09

- Update Playwright to 1.47.0 and other dependencies (#363, #364).

## 0.6.23 - 2024-08-23

- Update Playwright to 1.46.1 (#362).

## 0.6.22 - 2024-08-13

- Update Playwright to 1.46.0 and yt-dlp to 2024.08.06 (#361).

## 0.6.21 - 2024-08-02

- Update Playwright and yt-dlp (#360).

## 0.6.20 - 2024-07-16

- Update Playwright to 1.45.2 (#357).

## 0.6.19 - 2024-07-09

### Compatibility notes

- **No zstd.** The browser sends `Accept-Encoding: gzip, compress, deflate, br`, leaving out zstd, which parts of the web archive indexing and playback stack do not yet handle (#356).

### Dependencies

- Update dependencies (#355).

## 0.6.18 - 2024-07-02

- Update Playwright and other dependencies (#354).

## 0.6.17 - 2024-07-02

- Update yt-dlp to 2024.07.01 and other dependencies (#352, #353).

## 0.6.16 - 2024-06-25

- Update Playwright and other dependencies (#351).

## 0.6.15 - 2024-05-28

- Update Playwright to 1.44.1, yt-dlp to 2024.05.27, js-wacz to 0.1.2, and other dependencies (#339–#350).

## 0.6.14 - 2024-05-07

- Update Playwright to 1.44.0, browsertrix-behaviors to 0.6.0, and other dependencies (#329–#338).

## 0.6.13 - 2024-04-10

- Update yt-dlp to 2024.04.09 and other dependencies (#324–#328).

## 0.6.12 - 2024-04-05

- Update Playwright to 1.43.0, js-wacz to 0.1.1, and other dependencies (#317–#323).

## 0.6.11 - 2024-03-25

- Update js-wacz to 0.1.0 and other dependencies (#308–#316).

## 0.6.10 - 2024-03-12

- Update yt-dlp to 2024.03.10, browsertrix-behaviors to 0.5.3, js-wacz to 0.0.19, and other dependencies (#294, #302–#307).

## 0.6.9 - 2024-03-04

- Update Playwright to 1.42.1, js-wacz to 0.0.18, and other dependencies (#295–#301).

## 0.6.8 - 2024-02-27

- Update Playwright to 1.42.0 and other dependencies (#284–#292).

## 0.6.7 - 2024-02-05

### Additions

- Error-level log lines include more detail about the failure (#281).

### Dependencies

- Update commander to 12.0.0 and other dependencies (#282, #283).

## 0.6.6 - 2024-02-02

- Update Playwright to 1.41.2 and other dependencies (#267–#280).

## 0.6.5 - 2024-01-22

- Update Playwright to 1.41.1 and other dependencies (#261–#266).

## 0.6.4 - 2024-01-16

- Update dependencies (#255).

## 0.6.3 - 2024-01-02

- Update dependencies (#248).

## 0.6.2 - 2023-11-29

- Update dependencies (#242).

## 0.6.1 - 2023-11-17

- Update dependencies (#235).

## 0.6.0 - 2023-11-03

### Compatibility notes

- **Proxy port errors fail the capture.** When the proxy port is in use or otherwise unavailable, Scoop reports the error and the CLI exits 1 (#237).

## 0.5.10 - 2023-10-30

0.5.9 was published to npm two minutes earlier and superseded by this release.

### Fixes

- Keep attachments such as screenshots and the provenance summary from stalling or failing on slow captures: the screenshot and scroll-up steps have short timeouts, steps that always run are not stopped by `captureTimeout`, the user agent comes from Scoop rather than the browser, and IP lookup uses curl with a hard timeout (#233).

### Dependencies

- Update dependencies (#226).

## 0.5.8 - 2023-10-16

- Update dependencies (#224).

## 0.5.7 - 2023-10-13

- Update dependencies (#223).

## 0.5.6 - 2023-10-11

- Update dependencies (#210, #216, #217).

## 0.5.5 - 2023-09-26

### Additions

- `Scoop.targetUrlResolved` records the target URL after redirects, and appears in `Scoop.summary()` and `--json-summary-output` (#204).

### Dependencies

- Update dependencies (#205, #208).

## 0.5.4 - 2023-09-22

- Update dependencies (#198, #203).

## 0.5.3 - 2023-09-14

- Update dependencies (#191). `npx playwright install chromium` may no longer be necessary.

## 0.5.2 - 2023-08-22

- Update dependencies (#185).

## 0.5.1 - 2023-08-15

### Additions

- `Scoop.summary()` and `--json-summary-output` include `pageInfo` (#180).

## 0.5.0 - 2023-08-14

### Compatibility notes

- **No `noarchive` detection.** Scoop no longer looks for `noarchive` in `<meta>` tags or lists matching URLs in the logs and provenance summary. It covered only some of the ways a site can express the directive (#178).

### Dependencies

- Update Playwright to 1.37.0, js-wacz to 0.14.0, and other dependencies (#171–#176, #178).

## 0.4.8 - 2023-07-31

- Update dependencies.

## 0.4.7 - 2023-07-27

- Update dependencies.

## 0.4.6 - 2023-07-20

- Update dependencies.

## 0.4.5 - 2023-07-07

- Update yt-dlp (#164).

## 0.4.4 - 2023-06-22

- Update yt-dlp (#162).

## 0.4.3 - 2023-06-21

- Downgrade yt-dlp temporarily (#161).

## 0.4.2 - 2023-06-21

### Fixes

- Non-web content detection handles a missing `content-type` better (#160).

### Dependencies

- Update dependencies (#160).

## 0.4.1 - 2023-06-15

- Update dependencies (#159).

## 0.4.0 - 2023-05-16

### Compatibility notes

- **Summary layout.** `Scoop.summary()` and `--json-summary-output` have a `provenanceInfo` property, present when `provenanceSummary` is on. It replaces the top-level `blockedRequests`, `noArchiveUrls`, `captureIp`, and `userAgent` properties, which move inside it (#155).

### Fixes

- `--blocklist ""` sets an empty blocklist (#154).

## 0.3.1 - 2023-05-08

### Additions

- `Scoop.targetUrlContentType` records the content type of the target URL, and appears in `Scoop.summary()` and `--json-summary-output` (#153).

## 0.3.0 - 2023-05-05

### Compatibility notes

- **`states` is an array.** In `Scoop.summary()` and `--json-summary-output`, `states` is a list of state names indexed by state number, such as `["INIT", "SETUP", "CAPTURE", ...]`, rather than an object mapping names to numbers (#152).

## 0.2.7 - 2023-05-05

### Additions

- `--export-attachments-output` exports attachments such as the screenshot and PDF snapshot to a directory (#150).
- `Scoop.summary()` has an `attachments` property listing attachments by type and file name (#150).

### Fixes

- Install crip on Linux aarch64 (#149).

## 0.2.6 - 2023-04-25

### Fixes

- Update js-wacz to 0.0.10, which fixes a WACZ standard compliance issue (#147).

## 0.2.5 - 2023-04-21

- Improve error reporting (#145).
- Tested with Node.js 20.

## 0.2.4 - 2023-04-21

- Update dependencies.

## 0.2.3 - 2023-04-18

- Update js-wacz to 0.0.10, which writes a plain `index.cdx` instead of a ZipNum shared index for small archives (#142).

## 0.2.2 - 2023-04-11

- Move `noarchive` detection into the proxy (#141).

## 0.2.1 - 2023-04-04

### Additions

- `Scoop.summary()` returns a summary of the capture, and can be called at any point during it (#139).
- `--json-summary-output` writes the summary to a JSON file at the end of the capture (#139).

## 0.2.0 - 2023-03-31

- Use [@harvard-lil/portal](https://github.com/harvard-lil/portal) as the HTTP proxy (#131).
- Update js-wacz to 0.0.9, warcio.js to 2.1.0, browsertrix-behaviors to 0.5.0-beta.0, and Playwright to 1.32.1 (#137).
- Document RAM requirements in the README (#137).

## 0.1.2 - 2023-03-22

### Fixes

- Skip steps that do not apply when the target URL is not a web page (#135).
- Apply timeouts when detecting and capturing non-web resources.
- Apply the blocklist when collecting certificates.

## 0.1.1 - 2023-03-22

- Rework the capture process and timeout enforcement (#134).

## 0.1.0 - 2023-03-21

### Additions

- Capture SSL/TLS certificates as attachments with `--capture-certificates-as-attachment`, on by default (#133).
- Log the Scoop version (#132).

### Fixes

- Work around a compatibility issue with recent Node.js 19 releases (#133).

## 0.0.7 - 2023-03-20

- Handle capture edge cases that require an immediate shutdown (#130).
- Non-web content detection for the target URL times out after a tenth of `captureTimeout` (#130).

## 0.0.6 - 2023-03-17

### Additions

- `--attachments-bypass-limits` (#128).

### Changes

- Page info is captured earlier in the process (#128).
- Capture steps stop when the capture state changes (#128).

## 0.0.5 - 2023-03-17

### Fixes

- Read the software version from `package.json` (#127).

## 0.0.4 - 2023-03-15

Initial release.

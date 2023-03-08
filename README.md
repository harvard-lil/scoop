> 🚧 This `README.md` is under construction.

# Scoop 🍨

[![npm version](https://badge.fury.io/js/@harvard-lil%2Fscoop.svg)](https://badge.fury.io/js/@harvard-lil%2Fscoop) [![JavaScript Style Guide](https://img.shields.io/badge/code_style-standard-brightgreen.svg)](https://standardjs.com)

High-fidelity, browser-based, single-page web archiving library. 

**Use it the terminal...**
```bash
scoop "https://lil.law.harvard.edu"
```

**... or in your Node.js project**
```javascript
import { Scoop } from '@harvard-lil/scoop'

const capture = await Scoop.capture('https://lil.law.harvard.edu')
const wacz = await capture.toWACZ()
```

---

## Summary
- [About](#about)
- [Main Features](#main-features)
- [Getting Started](#getting-started)
- [Using Scoop as a CLI command](#using-scoop-as-a-cli-command)
- [Using Scoop as a JavaScript library](#using-scoop-as-a-javascript-library)
- [Development](#development)

---

## About

Scoop is a high fidelity, browser-based, web archiving capture engine from the [Harvard Library Innovation Lab](https://lil.law.harvard.edu). 
Fine-tune this custom web capturing software to create robust single-page captures of the internet with accurate and complete provenance information. 

Scoop has built-in support for the [WACZ Signing and Verification specification](https://specs.webrecorder.net/wacz-auth/0.1.0/), 
allowing users to cryptographically sign their captures. 

With extensive options for asset formats and inclusions, Scoop will create `.warc`, `.warc.gz` and `.wacz` files to be stored by users and replayed using the web archive replay software of their choosing.


[👆 Back to the summary](#summary)

---

## Main Features
- High-fidelity, browser-based capture of singular web pages with no alterations
- Highly configurable
- Optional capture as attachments: 
  - Provenance summary
  - Screenshot
  - Extracted videos with associated subtitles and metadata
  - PDF snapshot
  - DOM snapshot
- Support for `.warc.`, `.warc.gz` and `.wacz` output formats
  - Support for the [WACZ Signing and Verification specification](https://specs.webrecorder.net/wacz-auth/0.1.0/)
  - Optional preservation of "raw" exchanges in WACZ files for later analysis or reprocessing

[👆 Back to the summary](#summary)

---

## Getting started

### Dependencies 
**Scoop** requires [Node.js 18+](https://nodejs.org/en/). 

Other _recommended_ system-level dependencies: [curl](https://curl.se/), [python3](https://www.python.org/) (for `--capture-video-as-attachment` option).

### Compatibility
This program has been written for UNIX-like systems and is expected to work on Linux, Mac OS, and Windows Subsystem for Linux.

### Installation

**Scoop** is available on [npmjs.org](https://www.npmjs.com/package/@harvard-lil/scoop) and can be installed as follows:
 
```bash
# As a CLI
npm install -g @harvard-lil/scoop

# As a library
npm install @harvard-lil/scoop --save
```

[👆 Back to the summary](#summary)

---

## Using Scoop as a CLI command

### Example
Here are a few examples of how the `scoop` command can be used to make a customized capture of a web page.

```bash
# This will capture a given url using the default settings.
scoop "https://lil.law.harvard.edu" 

# Unless specified otherwise, scoop will save the output of the capture as "./archive.wacz".
# We can change this with the `--output` / `-o` option
scoop "https://lil.law.harvard.edu" -o my-collection/lil.wacz

# But what if I want to change the output format itself?
scoop "https://lil.law.harvard.edu" -f warc -o my-collection/lil.warc

# Although it comes with "good defaults", scoop is highly-configurable ...
scoop "https://lil.law.harvard.edu" --capture-window-x 320 --capture-window-y 480 --capture-timeout 30000 --max-capture-size 10000 --signing-url "https://example.com/sign"

# ... use --help to list out all the available options, and see what the default are.
scoop --help
```

### Available options

#### -v, --version
Display Scoop and Scoop CLI version.

**Default value:** (None)

#### -o, --output `<string>`
Output path.

**Default value:** /archive.wacz

#### -f, --format `<string>`
Output format.

**Default value:** wacz

#### --signing-url `<string>`
Authsign-compatible endpoint for signing WACZ file.

**Default value:** (None)

#### --signing-token `<string>`
Authentication token to --signing-url, if needed.

**Default value:** (None)

#### --screenshot `<bool>`
Add screenshot step to capture?

**Default value:** true

#### --pdf-snapshot `<bool>`
Add PDF snapshot step to capture?

**Default value:** false

#### --dom-snapshot `<bool>`
Add DOM snapshot step to capture?

**Default value:** false

#### --capture-video-as-attachment `<bool>`
Add capture video(s) as attachment(s) step to capture?

**Default value:** true

#### --provenance-summary `<bool>`
Add provenance summary to capture?

**Default value:** true

#### --capture-timeout `<number>`
Maximum time allocated to capture process before hard cut-off, in ms.

**Default value:** 60000

#### --load-timeout `<number>`
Max time Scoop will wait for the page to load, in ms.

**Default value:** 20000

#### --network-idle-timeout `<number>`
Max time Scoop will wait for the in-browser networking tasks to complete, in ms.

**Default value:** 20000

#### --behaviors-timeout `<number>`
Max time Scoop will wait for the browser behaviors to complete, in ms.

**Default value:** 20000

#### --capture-video-as-attachment-timeout `<number>`
Max time Scoop will wait for the video capture process to complete, in ms.

**Default value:** 30000

#### --capture-window-x `<number>`
Width of the browser window Scoop will open to capture, in pixels.

**Default value:** 1600

#### --capture-window-y `<number>`
Height of the browser window Scoop will open to capture, in pixels.

**Default value:** 900

#### --max-capture-size `<number>`
Size limit for the capture's exchanges list, in bytes.

**Default value:** 209715200

#### --auto-scroll `<bool>`
Should Scoop try to scroll through the page?

**Default value:** true

#### --auto-play-media `<bool>`
Should Scoop try to autoplay `<audio>` and `<video>` tags?

**Default value:** true

#### --grab-secondary-resources `<bool>`
Should Scoop try to download img srcsets and secondary stylesheets?

**Default value:** true

#### --run-site-specific-behaviors `<bool>`
Should Scoop run site-specific capture behaviors? (via: browsertrix-behaviors)

**Default value:** true

#### --headless `<bool>`
Should Chrome run in headless mode?

**Default value:** true

#### --user-agent-suffix `<string>`
If provided, will be appended to Chrome's user agent.

**Default value:** (None)

#### --blocklist `<string>`
If set, replaces Scoop's default list of url patterns and IP ranges Scoop should not capture. Coma-separated.

**Default value:** /https?://localhost/,0.0.0.0/8,10.0.0.0/8,100.64.0.0/10,127.0.0.0/8,169.254.0.0/16,172.16.0.0/12,192.0.0.0/29,192.0.2.0/24,192.88.99.0/24,192.168.0.0/16,198.18.0.0/15,198.51.100.0/24,203.0.113.0/24,224.0.0.0/4,240.0.0.0/4,255.255.255.255/32,::/128,::1/128,::ffff:0:0/96,100::/64,64:ff9b::/96,2001::/32,2001:10::/28,2001:db8::/32,2002::/16,fc00::/7,fe80::/10,ff00::/8

#### --intercepter `<string>`
ScoopIntercepter class to be used to intercept network exchanges.

**Default value:** ScoopProxy

#### --proxy-host `<string>`
Hostname to be used by Scoop's HTTP proxy.

**Default value:** localhost

#### --proxy-port `<string>`
Port to be used by Scoop's HTTP proxy.

**Default value:** 9000

#### --proxy-verbose `<bool>`
Should Scoop's HTTP proxy output logs to the console?

**Default value:** false

#### --public-ip-resolver-endpoint `<string>`
API endpoint to be used to resolve the client's IP address. Used in the context of the provenance summary.

**Default value:** https://icanhazip.com

#### --yt-dlp-path `<string>`
Path to the yt-dlp executable. Used for capturing videos.

**Default value:** /executables/yt-dlp

#### --log-level `<string>`
Controls Scoop CLI's verbosity.

**Default value:** info

[👆 Back to the summary](#summary)

---

## Using Scoop as a JavaScript library


[👆 Back to the summary](#summary)

---


## Development

[👆 Back to the summary](#summary)

> 🚧 This `README.md` is under construction.

# Scoop 🍨

[![npm version](https://badge.fury.io/js/@harvard-lil%2Fscoop.svg)](https://badge.fury.io/js/@harvard-lil%2Fscoop) [![JavaScript Style Guide](https://img.shields.io/badge/code_style-standard-brightgreen.svg)](https://standardjs.com)

High-fidelity, browser-based, single-page web archiving library and CLI. 

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
- [FAQ](#faq)

---

## About

**Scoop** is a high fidelity, browser-based, web archiving capture engine from the [Harvard Library Innovation Lab](https://lil.law.harvard.edu). 

Fine-tune this custom web capture software to create robust single-page captures of the internet with accurate and complete **provenance information**. 

With extensive options for asset formats and inclusions, Scoop will create **.warc**, **warc.gz** or **.wacz** files to be stored by users and replayed using the web archive replay software of their choosing.

Scoop also comes with built-in support for the [WACZ Signing and Verification specification](https://specs.webrecorder.net/wacz-auth/0.1.0/), 
allowing users to cryptographically sign their captures. 

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
  - Optional preservation of _"raw"_ exchanges in WACZ files for later analysis or reprocessing _("wacz with raw exchanges"_)

[👆 Back to the summary](#summary)

---

## Getting started

### Dependencies 
**Scoop** requires [Node.js 18+](https://nodejs.org/en/). 

Other _recommended_ system-level dependencies: 
[curl](https://curl.se/), [python3](https://www.python.org/) (for `--capture-video-as-attachment` option).

### Compatibility
This program has been written for UNIX-like systems and is expected to work on **Linux, Mac OS, and Windows Subsystem for Linux**.

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
scoop "https://lil.law.harvard.edu" --capture-video-as-attachment false --screenshot false --capture-window-x 320 --capture-window-y 480 --capture-timeout 30000 --max-capture-size 100000 --signing-url "https://example.com/sign"

# ... use --help to list out all the available options, and see what the default are.
scoop --help
```

<details>
  <summary><strong>See: Output of scoop --help 🔍</strong></summary>

```
Usage: scoop [options] <url>

🍨 High-fidelity, browser-based, single-page web archiving library and CLI.
More info: https://github.com/harvard-lil/scoop

Options:
  -v, --version                                   Display Scoop and Scoop CLI version.
  -o, --output <string>                           Output path. (default: "./archive.wacz")
  -f, --format <string>                           Output format. (choices: "warc", "warc-gzipped", "wacz", "wacz-with-raw", default: "wacz")
  --signing-url <string>                          Authsign-compatible endpoint for signing WACZ file.
  --signing-token <string>                        Authentication token to --signing-url, if needed.
  --screenshot <bool>                             Add screenshot step to capture? (choices: "true", "false", default: "true")
  --pdf-snapshot <bool>                           Add PDF snapshot step to capture? (choices: "true", "false", default: "false")
  --dom-snapshot <bool>                           Add DOM snapshot step to capture? (choices: "true", "false", default: "false")
  --capture-video-as-attachment <bool>            Add capture video(s) as attachment(s) step to capture? (choices: "true", "false", default: "true")
  --provenance-summary <bool>                     Add provenance summary to capture? (choices: "true", "false", default: "true")
  --capture-timeout <number>                      Maximum time allocated to capture process before hard cut-off, in ms. (default: 60000)
  --load-timeout <number>                         Max time Scoop will wait for the page to load, in ms. (default: 20000)
  --network-idle-timeout <number>                 Max time Scoop will wait for the in-browser networking tasks to complete, in ms. (default: 20000)
  --behaviors-timeout <number>                    Max time Scoop will wait for the browser behaviors to complete, in ms. (default: 20000)
  --capture-video-as-attachment-timeout <number>  Max time Scoop will wait for the video capture process to complete, in ms. (default: 30000)
  --capture-window-x <number>                     Width of the browser window Scoop will open to capture, in pixels. (default: 1600)
  --capture-window-y <number>                     Height of the browser window Scoop will open to capture, in pixels. (default: 900)
  --max-capture-size <number>                     Size limit for the capture's exchanges list, in bytes. (default: 209715200)
  --auto-scroll <bool>                            Should Scoop try to scroll through the page? (choices: "true", "false", default: "true")
  --auto-play-media <bool>                        Should Scoop try to autoplay `<audio>` and `<video>` tags? (choices: "true", "false", default: "true")
  --grab-secondary-resources <bool>               Should Scoop try to download img srcsets and secondary stylesheets? (choices: "true", "false", default: "true")
  --run-site-specific-behaviors <bool>            Should Scoop run site-specific capture behaviors? (via: browsertrix-behaviors) (choices: "true", "false", default: "true")
  --headless <bool>                               Should Chrome run in headless mode? (choices: "true", "false", default: "true")
  --user-agent-suffix <string>                    If provided, will be appended to Chrome's user agent. (default: "")
  --blocklist <string>                            If set, replaces Scoop's default list of url patterns and IP ranges Scoop should not capture. Coma-separated. Example:
                                                  "/https?://localhost/,0.0.0.0/8,10.0.0.0".
  --intercepter <string>                          ScoopIntercepter class to be used to intercept network exchanges. (default: "ScoopProxy")
  --proxy-host <string>                           Hostname to be used by Scoop's HTTP proxy. (default: "localhost")
  --proxy-port <string>                           Port to be used by Scoop's HTTP proxy. (default: 9000)
  --proxy-verbose <bool>                          Should Scoop's HTTP proxy output logs to the console? (choices: "true", "false", default: "false")
  --public-ip-resolver-endpoint <string>          API endpoint to be used to resolve the client's IP address. Used in the context of the provenance summary. (default:
                                                  "https://icanhazip.com")
  --yt-dlp-path <string>                          Path to the yt-dlp executable. Used for capturing videos. (default: "[library]/executables/yt-dlp")
  --log-level <string>                            Controls Scoop CLI's verbosity. (choices: "silent", "trace", "debug", "info", "warn", "error", default: "info")
  -h, --help                                      Show options list.
```
</details>


[👆 Back to the summary](#summary)

---

## Using Scoop as a JavaScript library

**Scoop** can be used as a library in a Node.js project. 
Here are a few examples of how to programmatically capture web pages using the `Scoop.capture()` method, which returns [an instance of the `Scoop` class](https://github.com/harvard-lil/scoop/blob/main/Scoop.js). 

### Quick access
- [List of available options for `Scoop.capture()`](https://github.com/harvard-lil/scoop/blob/main/options.types.js)
- [`Scoop.toWACZ()` method](https://github.com/harvard-lil/scoop/blob/main/Scoop.js#L1138)
- [`Scoop.toWARC()` method](https://github.com/harvard-lil/scoop/blob/main/Scoop.js#L1126)
- [`Scoop.fromWACZ()` method (experimental)](https://github.com/harvard-lil/scoop/blob/main/Scoop.js#L1117)


### Example: Simple capture with default settings
```javascript
import fs from 'fs/promises'
import { Scoop } from '@harvard-lil/scoop'

try {
  const capture = await Scoop.capture('https://lil.law.harvard.edu')
  const wacz = await capture.toWACZ()
  await fs.writeFile('archive.wacz', Buffer.from(wacz))
} catch(err) {
  // ...
}
```

### Example: Advanced capture with custom settings
```javascript
import fs from 'fs/promises'
import { Scoop } from '@harvard-lil/scoop'

try {
  const capture = await Scoop.capture('https://lil.law.harvard.edu', {
    captureTimeout: 120 * 1000,
    loadTimeout: 60 * 1000,
    captureWindowX: 320,
    captureWindowY: 480
  })

  const warc = await capture.toWARC()
  await fs.writeFile('archive.warc', Buffer.from(warc))
} catch(err) {
  // ...
}
```

### Example: Using a signing server
```javascript
import fs from 'fs/promises'
import { Scoop } from '@harvard-lil/scoop'

try {
  const capture = await Scoop.capture('https://lil.law.harvard.edu')

  const signedWacz = await capture.toWACZ(true, {
    url: 'https://example.com/sign'
    token: 'some-very-secret-token'
  })

  await fs.writeFile('archive.wacz', Buffer.from(signedWacz))
} catch(err) {
  // ...
}
```

### Tip: Working with a copy of default settings
```javascript
import { Scoop } from '@harvard-lil/scoop'

try {
  // "options" will be a copy of Scoop's default settings
  const options = Scoop.defaults

  // It therefore becomes easier to inspect said defaults ...
  console.log(options)

  // ... and edit existing values
  options.pdfSnapshot = true
  options.blocklist.push('/https?:\/\/foo/')

  const capture = Scoop.capture('https://lil.law.harvard.edu', options)
  
  // ...
} catch(err) {
  // ...
}
```

[👆 Back to the summary](#summary)

---


## Development

[👆 Back to the summary](#summary)


---

## FAQ

```
What do you mean by "browser-based"? Is it _my_ browser?
+ Diagram

Does Scoop capture _everything_ through the browser?
(Yes unless explicitly mentioned)

What is "WACZ with raw"?
```

[👆 Back to the summary](#summary)

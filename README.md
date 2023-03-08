> 🚧 This `README.md` is under construction.

# Scoop 🍨

[![npm version](https://badge.fury.io/js/@harvard-lil%2Fscoop.svg)](https://badge.fury.io/js/@harvard-lil%2Fscoop) [![JavaScript Style Guide](https://img.shields.io/badge/code_style-standard-brightgreen.svg)](https://standardjs.com)

High-fidelity, browser-based, single-page web archiving library. 

**Use it as a CLI command ...**
```bash
scoop "https://lil.law.harvard.edu"
```

**... or in your Node.js project**
```javascript
import { Scoop } from "@harvard-lil/scoop"

const capture = await Scoop.capture("https://lil.law.harvard.edu")
const wacz = await capture.toWACZ()
```

---

## Summary
- [About](#about)
- [Main Features](#main-features)
- [Getting Started](#getting-started)
- [Using Scoop as a CLI command](#using-scoop-as-a-cli-command)
- [Using Scoop as a JavaScript library](#using-scoop-as-a-javascript-library)
- [Contributing](#contributing)
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
  - Optional preservation of "raw" exchanges in WACZ files for later analysis or reprocessing
  - Support for the [WACZ Signing and Verification specification](https://specs.webrecorder.net/wacz-auth/0.1.0/)

[👆 Back to the summary](#summary)

---

## Getting started

### Dependencies 
**Scoop** requires [Node.js 18+](https://nodejs.org/en/). 

**_Recommended_ system-level dependencies:**
- `curl` 
- `python3` (`--capture-video-as-attachment` feature uses Python-based `yt-dlp`).

### Compatibility
This program has been written for UNIX-like systems and is expected to work on Linux, Mac OS, and Windows Subsystem for Linux.

### Installation
```bash
# As a CLI
npm install -g @harvard-lil/scoop

# As a library
npm install @harvard-lil/scoop --save
```

[👆 Back to the summary](#summary)

---

## Using Scoop as a CLI command


[👆 Back to the summary](#summary)

---

## Using Scoop as a JavaScript library


[👆 Back to the summary](#summary)

---

## Integrations and Tooling

[👆 Back to the summary](#summary)

---

## Contributing

[👆 Back to the summary](#summary)

---

## Development

[👆 Back to the summary](#summary)

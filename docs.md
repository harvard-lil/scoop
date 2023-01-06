## Modules

<dl>
<dt><a href="#module_CONSTANTS">CONSTANTS</a></dt>
<dd><p>Constants used across the library.</p>
</dd>
<dt><a href="#module_exchanges">exchanges</a></dt>
<dd><p>Entry point for the exchanges module.</p>
</dd>
<dt><a href="#module_exporters">exporters</a></dt>
<dd><p>Entry point for the exporters module. Functions in this module are meant to be used to convert a Mischief instance into an archive format (i.e: WARC, WBN).</p>
</dd>
<dt><a href="#module_importers">importers</a></dt>
<dd><p>Entry point for the importers module.</p>
</dd>
<dt><a href="#module_intercepters">intercepters</a></dt>
<dd><p>Entry point for the scribes module.</p>
</dd>
<dt><a href="#module_parsers">parsers</a></dt>
<dd><p>Entry point for the parsers module. Classes in this module are meant to be used to parse raw network traffic (i.e. HTTP).</p>
</dd>
<dt><a href="#parsers.module_MischiefHTTPParser">MischiefHTTPParser</a></dt>
<dd><p>Utilities for parsing intercepted HTTP exchanges.</p>
</dd>
<dt><a href="#utils.module_assertions">assertions</a></dt>
<dd><p>Assertion helpers</p>
</dd>
</dl>

## Classes

<dl>
<dt><a href="#MischiefExchange">MischiefExchange</a></dt>
<dd><p>Represents an HTTP exchange captured by Mischief, irrespective of how it was captured.
To be specialized by interception type (i.e: <a href="#MischiefProxyExchange">MischiefProxyExchange</a>).</p>
</dd>
<dt><a href="#MischiefGeneratedExchange">MischiefGeneratedExchange</a></dt>
<dd><p>An exchange constructed ad-hoc (vs intercepted),
typically used to inject additional resources into an archive</p>
</dd>
<dt><a href="#MischiefProxyExchange">MischiefProxyExchange</a></dt>
<dd><p>Represents an HTTP exchange captured via MischiefProxy.</p>
</dd>
<dt><a href="#Mischief">Mischief</a></dt>
<dd><p>Experimental single-page web archiving library using Playwright.
Uses a proxy to allow for comprehensive and raw network interception.</p>
</dd>
<dt><a href="#MischiefOptions">MischiefOptions</a></dt>
<dd><p>Helper class to filter and validate options passed to a Mischief instance.</p>
</dd>
<dt><a href="#WACZ">WACZ</a></dt>
<dd><p>WACZ builder</p>
</dd>
</dl>

## Functions

<dl>
<dt><a href="#mischiefToWacz">mischiefToWacz(capture, [includeRaw], signingServer)</a> ⇒ <code>Promise.&lt;ArrayBuffer&gt;</code></dt>
<dd><p>Mischief capture to WACZ converter.</p>
<p>Note:</p>
<ul>
<li>Logs are added to capture object via <code>Mischief.log</code>.</li>
</ul>
</dd>
<dt><a href="#mischiefToWarc">mischiefToWarc(capture)</a> ⇒ <code>Promise.&lt;ArrayBuffer&gt;</code></dt>
<dd><p>Mischief capture to WARC converter.</p>
<p>Note:</p>
<ul>
<li>Logs are added to capture object via <code>Mischief.log</code>.</li>
</ul>
</dd>
<dt><a href="#prepareExchangeStatusLine">prepareExchangeStatusLine(exchange, [type])</a> ⇒ <code>string</code></dt>
<dd><p>Prepares an HTTP status line string for a given MischiefExchange.</p>
<p>Warcio expects the method to be prepended to the request statusLine.
Reference:</p>
<ul>
<li><a href="https://github.com/webrecorder/pywb/pull/636#issue-869181282">https://github.com/webrecorder/pywb/pull/636#issue-869181282</a></li>
<li><a href="https://github.com/webrecorder/warcio.js/blob/d5dcaec38ffb0a905fd7151273302c5f478fe5d9/src/statusandheaders.js#L69-L74">https://github.com/webrecorder/warcio.js/blob/d5dcaec38ffb0a905fd7151273302c5f478fe5d9/src/statusandheaders.js#L69-L74</a></li>
<li><a href="https://github.com/webrecorder/warcio.js/blob/fdb68450e2e011df24129bac19691073ab6b2417/test/testSerializer.js#L212">https://github.com/webrecorder/warcio.js/blob/fdb68450e2e011df24129bac19691073ab6b2417/test/testSerializer.js#L212</a></li>
</ul>
</dd>
<dt><a href="#waczToMischief">waczToMischief(zipPath)</a> ⇒ <code><a href="#Mischief">Promise.&lt;Mischief&gt;</a></code></dt>
<dd><p>Reconstructs a Mischief capture from a WACZ
containing raw http traffic data.</p>
</dd>
<dt><a href="#getPagesJSON">getPagesJSON(zip)</a> ⇒ <code>Array.&lt;object&gt;</code></dt>
<dd><p>Retrieves the pages.jsonl data from the WARC and parses it</p>
</dd>
<dt><a href="#getDataPackage">getDataPackage(zip)</a> ⇒ <code>object</code></dt>
<dd><p>Retrieves the datapackage.json data from the WARC and parses it</p>
</dd>
<dt><a href="#getExchanges">getExchanges(zip)</a> ⇒ <code><a href="#MischiefProxyExchange">Array.&lt;MischiefProxyExchange&gt;</a></code></dt>
<dd><p>Retrieves the raw requests and responses and initializes
them into MischiefProxyExchanges</p>
</dd>
<dt><a href="#castBlocklistMatcher">castBlocklistMatcher(val)</a> ⇒ <code>RegExp</code> | <code>String</code> | <code>Address4</code> | <code>Address6</code></dt>
<dd><p>Parses a blocklist entry for later matching.
All entries are strings that we attempt to parse
as IPs and CIDR ranges, then RegExp, before being
returned as-is if unsuccessful.</p>
</dd>
<dt><a href="#matchAgainst">matchAgainst(test)</a> ⇒ <code>function</code></dt>
<dd><p>Returns a function that accepts a value to test
against a blocklist matcher and returns true|false
based on that matcher</p>
</dd>
<dt><a href="#searchBlocklistFor">searchBlocklistFor(...args)</a> ⇒ <code>function</code></dt>
<dd><p>Accepts any number of IP addresses or URLs as strings
and returns a function that accepts a blocklist matcher
and returns true when any one of those IPs|URLs matches</p>
</dd>
<dt><a href="#dirEmpty">dirEmpty(files, dir)</a> ⇒ <code>boolean</code></dt>
<dd><p>Checks whether any files have been added to
the specified directory</p>
</dd>
<dt><a href="#stringify">stringify(obj)</a> ⇒ <code>string</code></dt>
<dd><p>Converts an object to a string using standarized spacing</p>
</dd>
<dt><a href="#hash">hash(buffer)</a> ⇒ <code>string</code></dt>
<dd><p>Hashes a buffer to conform to the WACZ spec</p>
</dd>
<dt><a href="#mischiefExchangeToPageLine">mischiefExchangeToPageLine(exchange)</a> ⇒ <code>object</code></dt>
<dd><p>Format a MischiefExchange as needed for
the pages JSON-Lines</p>
</dd>
<dt><a href="#isZip">isZip(buf)</a> ⇒ <code>boolean</code></dt>
<dd><p>Sniffs a buffer to loosely infer whether it&#39;s a zip file.</p>
<p>Note: this is an imperfect method.</p>
</dd>
<dt><a href="#usesStoreCompression">usesStoreCompression(buf)</a> ⇒ <code>boolean</code></dt>
<dd><p>Checks the header of a zip buffer
to see if STORE compression was used</p>
</dd>
<dt><a href="#fileNameLen">fileNameLen(buf)</a> ⇒ <code>integer</code></dt>
<dd><p>Checks the header of a zip buffer to see
how long the file name is in the header.
Used to seek past the header to the body.</p>
</dd>
<dt><a href="#extraFieldLen">extraFieldLen(buf)</a> ⇒ <code>integer</code></dt>
<dd><p>Checks the header of a zip buffer to see
how long the &quot;extra field&quot; is in the header.
Used to seek past the header to the body.</p>
</dd>
<dt><a href="#readBodyAsString">readBodyAsString(buf, byteLen)</a> ⇒ <code>string</code></dt>
<dd><p>A convenience function to seek past the header
of a zip buffer and read N bytes of the body.</p>
</dd>
<dt><a href="#create">create(files, [store])</a> ⇒ <code>Promise.&lt;Buffer&gt;</code></dt>
<dd><p>Creates a zip file, in memory, from a list of files</p>
</dd>
</dl>

<a name="module_CONSTANTS"></a>

## CONSTANTS
Constants used across the library.

**Author**: The Harvard Library Innovation Lab  
**License**: MIT  

* [CONSTANTS](#module_CONSTANTS)
    * [.SOFTWARE](#module_CONSTANTS.SOFTWARE)
    * [.VERSION](#module_CONSTANTS.VERSION)
    * [.WARC_VERSION](#module_CONSTANTS.WARC_VERSION)
    * [.WACZ_VERSION](#module_CONSTANTS.WACZ_VERSION)
    * [.ASSETS_DIR](#module_CONSTANTS.ASSETS_DIR)
    * [.LOGGING_COLORS](#module_CONSTANTS.LOGGING_COLORS)

<a name="module_CONSTANTS.SOFTWARE"></a>

### CONSTANTS.SOFTWARE
Description of this software

**Kind**: static constant of [<code>CONSTANTS</code>](#module_CONSTANTS)  
<a name="module_CONSTANTS.VERSION"></a>

### CONSTANTS.VERSION
The current version of Mischief

**Kind**: static constant of [<code>CONSTANTS</code>](#module_CONSTANTS)  
<a name="module_CONSTANTS.WARC_VERSION"></a>

### CONSTANTS.WARC\_VERSION
The version of WARC this library exports

**Kind**: static constant of [<code>CONSTANTS</code>](#module_CONSTANTS)  
<a name="module_CONSTANTS.WACZ_VERSION"></a>

### CONSTANTS.WACZ\_VERSION
The version of WACZ this library exports

**Kind**: static constant of [<code>CONSTANTS</code>](#module_CONSTANTS)  
<a name="module_CONSTANTS.ASSETS_DIR"></a>

### CONSTANTS.ASSETS\_DIR
Location of the directory in which assets may be rendered (ex: the provinance summary)

**Kind**: static constant of [<code>CONSTANTS</code>](#module_CONSTANTS)  
<a name="module_CONSTANTS.LOGGING_COLORS"></a>

### CONSTANTS.LOGGING\_COLORS
Colors used by the logging function

**Kind**: static constant of [<code>CONSTANTS</code>](#module_CONSTANTS)  
<a name="module_exchanges"></a>

## exchanges
Entry point for the exchanges module.

**Author**: The Harvard Library Innovation Lab  
**License**: MIT  
<a name="module_exporters"></a>

## exporters
Entry point for the exporters module. Functions in this module are meant to be used to convert a Mischief instance into an archive format (i.e: WARC, WBN).

**Author**: The Harvard Library Innovation Lab  
**License**: MIT  
<a name="module_importers"></a>

## importers
Entry point for the importers module.

**Author**: The Harvard Library Innovation Lab  
**License**: MIT  
<a name="module_intercepters"></a>

## intercepters
Entry point for the scribes module.

**Author**: The Harvard Library Innovation Lab  
**License**: MIT  
<a name="module_parsers"></a>

## parsers
Entry point for the parsers module. Classes in this module are meant to be used to parse raw network traffic (i.e. HTTP).

**Author**: The Harvard Library Innovation Lab  
**License**: MIT  
<a name="parsers.module_MischiefHTTPParser"></a>

## MischiefHTTPParser
Utilities for parsing intercepted HTTP exchanges.

**Author**: The Harvard Library Innovation Lab  
**License**: MIT  

* [MischiefHTTPParser](#parsers.module_MischiefHTTPParser)
    * _static_
        * [.MischiefHTTPParser](#parsers.module_MischiefHTTPParser.MischiefHTTPParser)
            * [.parseResponse(input)](#parsers.module_MischiefHTTPParser.MischiefHTTPParser.parseResponse) ⇒ <code>MischiefHTTPParserResponse</code>
        * [.versionFromStatusLine(statusLine)](#parsers.module_MischiefHTTPParser.versionFromStatusLine) ⇒ <code>array</code>
        * [.bodyToString(body, [contentEncoding])](#parsers.module_MischiefHTTPParser.bodyToString) ⇒ <code>string</code>
    * _inner_
        * [~CRLFx2](#parsers.module_MischiefHTTPParser..CRLFx2) ⇒ <code>integer</code>

<a name="parsers.module_MischiefHTTPParser.MischiefHTTPParser"></a>

### MischiefHTTPParser.MischiefHTTPParser
Via: https://github.com/creationix/http-parser-js/blob/master/standalone-example.js

**Kind**: static class of [<code>MischiefHTTPParser</code>](#parsers.module_MischiefHTTPParser)  
<a name="parsers.module_MischiefHTTPParser.MischiefHTTPParser.parseResponse"></a>

#### MischiefHTTPParser.parseResponse(input) ⇒ <code>MischiefHTTPParserResponse</code>
**Kind**: static method of [<code>MischiefHTTPParser</code>](#parsers.module_MischiefHTTPParser.MischiefHTTPParser)  

| Param | Type |
| --- | --- |
| input | <code>\*</code> | 

<a name="parsers.module_MischiefHTTPParser.versionFromStatusLine"></a>

### MischiefHTTPParser.versionFromStatusLine(statusLine) ⇒ <code>array</code>
Extracts the protocol version from an HTTP status line

**Kind**: static method of [<code>MischiefHTTPParser</code>](#parsers.module_MischiefHTTPParser)  
**Returns**: <code>array</code> - -  

| Param | Type | Description |
| --- | --- | --- |
| statusLine | <code>string</code> | - |

<a name="parsers.module_MischiefHTTPParser.bodyToString"></a>

### MischiefHTTPParser.bodyToString(body, [contentEncoding]) ⇒ <code>string</code>
Utility for turning an HTTP body into a string.
Handles "deflate", "gzip" and "br" decompression.

**Kind**: static method of [<code>MischiefHTTPParser</code>](#parsers.module_MischiefHTTPParser)  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| body | <code>Buffer</code> |  |  |
| [contentEncoding] | <code>string</code> | <code>null</code> | Can be "br", "deflate" or "gzip" |

<a name="parsers.module_MischiefHTTPParser..CRLFx2"></a>

### MischiefHTTPParser~CRLFx2 ⇒ <code>integer</code>
Locates the beginning of an HTTP response body

The HTTP spec requires an empty line
with a CRLF (\r\n) before the body starts, but apparently
some poorly configured servers only use LF (\n) so we
look for the first pair we can find.

Ref: https://stackoverflow.com/a/11254057

**Kind**: inner constant of [<code>MischiefHTTPParser</code>](#parsers.module_MischiefHTTPParser)  
**Returns**: <code>integer</code> - -  

| Param | Type | Description |
| --- | --- | --- |
| buffer | <code>Buffer</code> | - |

<a name="utils.module_assertions"></a>

## assertions
Assertion helpers

**Author**: The Harvard Library Innovation Lab  
**License**: MIT  

* [assertions](#utils.module_assertions)
    * [.assertString(val)](#utils.module_assertions.assertString)
    * [.assertISO8861Date(val)](#utils.module_assertions.assertISO8861Date)
    * [.assertBase64(val)](#utils.module_assertions.assertBase64)
    * [.assertSHA256WithPrefix(val)](#utils.module_assertions.assertSHA256WithPrefix)
    * [.assertPEMCertificateChain(val)](#utils.module_assertions.assertPEMCertificateChain)
    * [.assertDomainName(val)](#utils.module_assertions.assertDomainName)

<a name="utils.module_assertions.assertString"></a>

### assertions.assertString(val)
Asserts that the given value is a string

**Kind**: static method of [<code>assertions</code>](#utils.module_assertions)  
**Throws**:

- Error


| Param | Type | Description |
| --- | --- | --- |
| val | <code>any</code> | The value to test |

<a name="utils.module_assertions.assertISO8861Date"></a>

### assertions.assertISO8861Date(val)
Asserts that the given value is a date string
that conforms to ISO 8861

**Kind**: static method of [<code>assertions</code>](#utils.module_assertions)  
**Throws**:

- Error


| Param | Type | Description |
| --- | --- | --- |
| val | <code>any</code> | The value to test |

<a name="utils.module_assertions.assertBase64"></a>

### assertions.assertBase64(val)
Asserts that the given value is a Base64 encoded string

**Kind**: static method of [<code>assertions</code>](#utils.module_assertions)  
**Throws**:

- Error


| Param | Type | Description |
| --- | --- | --- |
| val | <code>any</code> | The value to test |

<a name="utils.module_assertions.assertSHA256WithPrefix"></a>

### assertions.assertSHA256WithPrefix(val)
Asserts that the given value is a SHA256 hash prefixed with "sha:"

**Kind**: static method of [<code>assertions</code>](#utils.module_assertions)  
**Throws**:

- Error


| Param | Type | Description |
| --- | --- | --- |
| val | <code>any</code> | The value to test |

<a name="utils.module_assertions.assertPEMCertificateChain"></a>

### assertions.assertPEMCertificateChain(val)
Asserts that the given value is a PEM certificate

**Kind**: static method of [<code>assertions</code>](#utils.module_assertions)  
**Throws**:

- Error


| Param | Type | Description |
| --- | --- | --- |
| val | <code>any</code> | The value to test |

<a name="utils.module_assertions.assertDomainName"></a>

### assertions.assertDomainName(val)
Asserts that the given value is a domain name

**Kind**: static method of [<code>assertions</code>](#utils.module_assertions)  
**Throws**:

- Error


| Param | Type | Description |
| --- | --- | --- |
| val | <code>any</code> | The value to test |

<a name="Mischief"></a>

## Mischief
Experimental single-page web archiving library using Playwright.
Uses a proxy to allow for comprehensive and raw network interception.

**Kind**: global class  

* [Mischief](#Mischief)
    * [.Mischief](#Mischief+Mischief)
        * [new exports.Mischief(url, [options])](#new_Mischief+Mischief_new)
    * [.state](#Mischief+state) : <code>number</code>
    * [.url](#Mischief+url) : <code>string</code>
    * [.options](#Mischief+options) : <code>object</code>
    * [.exchanges](#Mischief+exchanges) : [<code>Array.&lt;MischiefExchange&gt;</code>](#MischiefExchange)
    * [.log](#Mischief+log) : <code>log.Logger</code>
    * [.captureTmpFolderPath](#Mischief+captureTmpFolderPath) : <code>string</code>
    * [.startedAt](#Mischief+startedAt) : <code>Date</code>
    * [.intercepter](#Mischief+intercepter) : <code>intercepters.MischiefIntercepter</code>
    * [.blocklist](#Mischief+blocklist) : <code>Array.&lt;(String\|RegEx\|Address4\|Address6)&gt;</code>
    * [.provenanceInfo](#Mischief+provenanceInfo) : <code>Object</code>
    * [.pageInfo](#Mischief+pageInfo) : <code>Object</code>
    * [.states](#Mischief+states) : <code>enum</code>
    * [.capture()](#Mischief+capture) ⇒ <code>Promise.&lt;boolean&gt;</code>
    * [.setup()](#Mischief+setup) ⇒ <code>Promise.&lt;boolean&gt;</code>
    * [.teardown()](#Mischief+teardown) ⇒ <code>Promise.&lt;boolean&gt;</code>
    * [.addGeneratedExchange(url, httpHeaders, body, isEntryPoint, description)](#Mischief+addGeneratedExchange) ⇒ <code>boolean</code>
    * [.filterUrl(url)](#Mischief+filterUrl)
    * [.extractGeneratedExchanges()](#Mischief+extractGeneratedExchanges) ⇒ <code>Object.&lt;string, MischiefGeneratedExchange&gt;</code>
    * [.toWarc()](#Mischief+toWarc) ⇒ <code>Promise.&lt;ArrayBuffer&gt;</code>
    * [.toWacz([includeRaw], signingServer)](#Mischief+toWacz) ⇒ <code>Promise.&lt;ArrayBuffer&gt;</code>

<a name="Mischief+Mischief"></a>

### mischief.Mischief
**Kind**: instance class of [<code>Mischief</code>](#Mischief)  
**See**: MischiefOptions#defaults  
<a name="new_Mischief+Mischief_new"></a>

#### new exports.Mischief(url, [options])

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| url | <code>string</code> |  | Must be a valid HTTP(S) url. |
| [options] | <code>object</code> | <code>{}</code> | See [defaults](#MischiefOptions+defaults) for details. |

<a name="Mischief+state"></a>

### mischief.state : <code>number</code>
Current state of the capture.
Should only contain states defined in `states`.

**Kind**: instance property of [<code>Mischief</code>](#Mischief)  
<a name="Mischief+url"></a>

### mischief.url : <code>string</code>
URL to capture.

**Kind**: instance property of [<code>Mischief</code>](#Mischief)  
<a name="Mischief+options"></a>

### mischief.options : <code>object</code>
Current settings.
Should only contain keys defined in `MischiefOptions`.

**Kind**: instance property of [<code>Mischief</code>](#Mischief)  
<a name="Mischief+exchanges"></a>

### mischief.exchanges : [<code>Array.&lt;MischiefExchange&gt;</code>](#MischiefExchange)
Array of HTTP exchanges that constitute the capture.
Only contains generated exchanged until `teardown()`.

**Kind**: instance property of [<code>Mischief</code>](#Mischief)  
<a name="Mischief+log"></a>

### mischief.log : <code>log.Logger</code>
Logger.
Logging level controlled via `MischiefOptions.logLevel`.

**Kind**: instance property of [<code>Mischief</code>](#Mischief)  
<a name="Mischief+captureTmpFolderPath"></a>

### mischief.captureTmpFolderPath : <code>string</code>
Path to the capture-specific temporary folder created by `setup()`.
Will be a child folder of the path defined in `this.options.tmpFolderPath`.

**Kind**: instance property of [<code>Mischief</code>](#Mischief)  
<a name="Mischief+startedAt"></a>

### mischief.startedAt : <code>Date</code>
The time at which the page was crawled.

**Kind**: instance property of [<code>Mischief</code>](#Mischief)  
<a name="Mischief+intercepter"></a>

### mischief.intercepter : <code>intercepters.MischiefIntercepter</code>
Reference to the intercepter chosen for capture.

**Kind**: instance property of [<code>Mischief</code>](#Mischief)  
<a name="Mischief+blocklist"></a>

### mischief.blocklist : <code>Array.&lt;(String\|RegEx\|Address4\|Address6)&gt;</code>
A mirror of options.blocklist with IPs parsed for matching

**Kind**: instance property of [<code>Mischief</code>](#Mischief)  
<a name="Mischief+provenanceInfo"></a>

### mischief.provenanceInfo : <code>Object</code>
Will only be populated if `options.provenanceSummary` is `true`.

**Kind**: instance property of [<code>Mischief</code>](#Mischief)  
<a name="Mischief+pageInfo"></a>

### mischief.pageInfo : <code>Object</code>
Info extracted by the browser about the page on initial load

**Kind**: instance property of [<code>Mischief</code>](#Mischief)  
<a name="Mischief+states"></a>

### mischief.states : <code>enum</code>
Enum-like states that the capture occupies.

**Kind**: instance enum of [<code>Mischief</code>](#Mischief)  
**Read only**: true  
<a name="Mischief+capture"></a>

### mischief.capture() ⇒ <code>Promise.&lt;boolean&gt;</code>
Main capture process.

**Kind**: instance method of [<code>Mischief</code>](#Mischief)  
<a name="Mischief+setup"></a>

### mischief.setup() ⇒ <code>Promise.&lt;boolean&gt;</code>
Sets up the proxy and Playwright resources, creates capture-specific temporary folder.

**Kind**: instance method of [<code>Mischief</code>](#Mischief)  
<a name="Mischief+teardown"></a>

### mischief.teardown() ⇒ <code>Promise.&lt;boolean&gt;</code>
Tears down Playwright, intercepter resources, and capture-specific temporary folder.

**Kind**: instance method of [<code>Mischief</code>](#Mischief)  
<a name="Mischief+addGeneratedExchange"></a>

### mischief.addGeneratedExchange(url, httpHeaders, body, isEntryPoint, description) ⇒ <code>boolean</code>
Generates a MischiefGeneratedExchange for generated content and adds it to `exchanges` unless time limit was reached.

**Kind**: instance method of [<code>Mischief</code>](#Mischief)  
**Returns**: <code>boolean</code> - true if generated exchange is successfully added  

| Param | Type | Default |
| --- | --- | --- |
| url | <code>string</code> |  | 
| httpHeaders | <code>object</code> |  | 
| body | <code>Buffer</code> |  | 
| isEntryPoint | <code>boolean</code> | <code>false</code> | 
| description | <code>string</code> |  | 

<a name="Mischief+filterUrl"></a>

### mischief.filterUrl(url)
Filters a url to ensure it's suitable for capture.
This function throws if:
- `url` is not a valid url
- `url` is not an http / https url
- `url` matches a blocklist rule

**Kind**: instance method of [<code>Mischief</code>](#Mischief)  

| Param | Type |
| --- | --- |
| url | <code>string</code> | 

<a name="Mischief+extractGeneratedExchanges"></a>

### mischief.extractGeneratedExchanges() ⇒ <code>Object.&lt;string, MischiefGeneratedExchange&gt;</code>
Returns a map of "generated" exchanges.
Generated exchanges = anything generated directly by Mischief (PDF snapshot, full-page screenshot, videos ...)

**Kind**: instance method of [<code>Mischief</code>](#Mischief)  
<a name="Mischief+toWarc"></a>

### mischief.toWarc() ⇒ <code>Promise.&lt;ArrayBuffer&gt;</code>
(Shortcut) Export this Mischief capture to WARC.

**Kind**: instance method of [<code>Mischief</code>](#Mischief)  
<a name="Mischief+toWacz"></a>

### mischief.toWacz([includeRaw], signingServer) ⇒ <code>Promise.&lt;ArrayBuffer&gt;</code>
(Shortcut) Export this Mischief capture to WACZ.

**Kind**: instance method of [<code>Mischief</code>](#Mischief)  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| [includeRaw] | <code>boolean</code> | <code>true</code> | Include a copy of RAW Http exchanges to the wacz (under `/raw`)? |
| signingServer | <code>object</code> |  | Optional server information for signing the WACZ |
| signingServer.url | <code>string</code> |  | url of the signing server |
| signingServer.token | <code>string</code> |  | Optional token to be passed to the signing server via the Authorization header |

<a name="MischiefOptions"></a>

## MischiefOptions
Helper class to filter and validate options passed to a Mischief instance.

**Kind**: global class  

* [MischiefOptions](#MischiefOptions)
    * _instance_
        * [.defaults](#MischiefOptions+defaults)
    * _static_
        * [.filterOptions(newOptions)](#MischiefOptions.filterOptions)

<a name="MischiefOptions+defaults"></a>

### mischiefOptions.defaults
Available options and defaults for Mischief.
Unless specified otherwise at constructor level, Mischief will run with these settings.

**Kind**: instance property of [<code>MischiefOptions</code>](#MischiefOptions)  
**Properties**

| Name | Type | Default | Description |
| --- | --- | --- | --- |
| logLevel | <code>boolean</code> | <code>&quot;info&quot;</code> | Determines the logging level of this instance. Can be "silent", "trace", "debug", "info", "warn" or "error". See https://github.com/pimterry/loglevel for more information. |
| headless | <code>boolean</code> | <code>false</code> | Should Playwright run in headless mode? |
| proxyHost | <code>string</code> | <code>&quot;\&quot;localhost\&quot;&quot;</code> | What host should Playwright proxy through for capture? |
| proxyPort | <code>number</code> | <code>9000</code> | What port should Playwright proxy through for capture? |
| proxyVerbose | <code>boolean</code> | <code>false</code> | Should log entries from the proxy be printed? |
| totalTimeout | <code>number</code> | <code>300000</code> | How long should Mischief wait for all steps in the capture to complete, in ms? |
| loadTimeout | <code>number</code> | <code>30000</code> | How long should Mischief wait for the page to load, in ms? |
| networkIdleTimeout | <code>number</code> | <code>30000</code> | How long should Mischief wait for network events to complete, in ms. |
| behaviorsTimeout | <code>number</code> | <code>60000</code> | How long should Mischief wait for media to play, secondary resources, and site specific behaviors (in total), in ms? |
| keepPartialResponses | <code>boolean</code> | <code>true</code> | Should Mischief keep partially downloaded resources? |
| maxSize | <code>number</code> | <code>209715200</code> | Maximum size, in bytes, for the exchanges list. |
| screenshot | <code>boolean</code> | <code>true</code> | Should Mischief try to make a screenshot? Screenshot will be added as `file:///screenshot.png` in the exchanges list. |
| domSnapshot | <code>boolean</code> | <code>true</code> | Should Mischief save a snapshot of the rendered DOM? Added as `file:///dom-snapshot.html` in the exchanges list. |
| pdfSnapshot | <code>boolean</code> | <code>false</code> | Should Mischief save a PDF of the rendered page? Only available in headless mode. Added as `file:///pdf-snapshot.pedf` in the exchanges list. |
| captureVideoAsAttachment | <code>boolean</code> | <code>true</code> | If `true`, will try to capture the main video that may be present in this page as `file:///video-extracted.mp4`. Will also save associated meta data as `file:///video-extracted-metadata.json`. This capture happens out of the browser. |
| captureVideoAsAttachmentTimeout | <code>number</code> | <code>30000</code> | How long should Mischief wait for `captureVideoAsAttachment` to finish. |
| ytDlpPath | <code>string</code> | <code>&quot;\&quot;./executables\&quot;&quot;</code> | Path to the yt-dlp executable to be used. |
| captureWindowX | <code>number</code> | <code>1600</code> | Browser window resolution in pixels: X axis. |
| captureWindowY | <code>number</code> | <code>900</code> | Browser window resolution in pixels: Y axis. |
| autoScroll | <code>boolean</code> | <code>true</code> | Should Mischief try to scroll through the page? |
| autoPlayMedia | <code>boolean</code> | <code>true</code> | Should Mischief try to autoplay `<audio>` and `<video>` tags? |
| grabSecondaryResources | <code>boolean</code> | <code>true</code> | Should Mischief try to download img srcsets and secondary stylesheets? |
| runSiteSpecificBehaviors | <code>boolean</code> | <code>true</code> | Should Mischief run behaviors tailored to specific sites (ex: Twitter) in an attempt to better grab the page? |
| intercepter | <code>string</code> | <code>&quot;\&quot;MischiefProxy\&quot;&quot;</code> | Network interception method to be used. Available at the moment: "MischiefProxy". |
| userAgentSuffix | <code>string</code> | <code>&quot;\&quot;\&quot;&quot;</code> | String to append to the user agent. |
| provenanceSummary | <code>boolean</code> | <code>true</code> | If `true`, information about the capture process (public IP address, User Agent, software version ...) will be gathered and summarized under `file:///provenance-summary.html`. WACZ exports will also hold that information at `datapackage.json` level, under `extras`. |
| publicIpResolverEndpoint | <code>string</code> | <code>&quot;\&quot;https://myip.lil.tools\&quot;&quot;</code> | URL to be used to retrieve the client's public IP address for `provenanceSummary`. Endpoint requirements: must simply return a IPv4 or IPv6 address as text. |
| tmpFolderPath | <code>string</code> | <code>&quot;\&quot;./tmp\&quot;&quot;</code> | Path to the temporary folder Mischief uses. |
| blocklist | <code>Array.&lt;string&gt;</code> |  | a list of patterns, to be matched against each request's URL and IP address, and subsequently blocked during capture. Valid entries include url strings, CIDR strings, and regular expressions in string form. |

<a name="MischiefOptions.filterOptions"></a>

### MischiefOptions.filterOptions(newOptions)
Filters an options object by comparing it with `MischiefOptions`.
Will use defaults for missing properties.

**Kind**: static method of [<code>MischiefOptions</code>](#MischiefOptions)  

| Param | Type |
| --- | --- |
| newOptions | <code>object</code> | 

<a name="mischiefToWacz"></a>

## mischiefToWacz(capture, [includeRaw], signingServer) ⇒ <code>Promise.&lt;ArrayBuffer&gt;</code>
Mischief capture to WACZ converter.

Note:
- Logs are added to capture object via `Mischief.log`.

**Kind**: global function  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| capture | [<code>Mischief</code>](#Mischief) |  |  |
| [includeRaw] | <code>boolean</code> | <code>false</code> | If `true`, includes the raw http exchanges in the WACZ. |
| signingServer | <code>object</code> |  | Optional server information for signing the WACZ |
| signingServer.url | <code>string</code> |  | url of the signing server |
| signingServer.token | <code>string</code> |  | Optional token to be passed to the signing server via the Authorization header |

<a name="mischiefToWarc"></a>

## mischiefToWarc(capture) ⇒ <code>Promise.&lt;ArrayBuffer&gt;</code>
Mischief capture to WARC converter.

Note:
- Logs are added to capture object via `Mischief.log`.

**Kind**: global function  

| Param | Type |
| --- | --- |
| capture | [<code>Mischief</code>](#Mischief) | 

<a name="prepareExchangeStatusLine"></a>

## prepareExchangeStatusLine(exchange, [type]) ⇒ <code>string</code>
Prepares an HTTP status line string for a given MischiefExchange.

Warcio expects the method to be prepended to the request statusLine.
Reference:
- https://github.com/webrecorder/pywb/pull/636#issue-869181282
- https://github.com/webrecorder/warcio.js/blob/d5dcaec38ffb0a905fd7151273302c5f478fe5d9/src/statusandheaders.js#L69-L74
- https://github.com/webrecorder/warcio.js/blob/fdb68450e2e011df24129bac19691073ab6b2417/test/testSerializer.js#L212

**Kind**: global function  

| Param | Type | Default |
| --- | --- | --- |
| exchange | [<code>MischiefExchange</code>](#MischiefExchange) |  | 
| [type] | <code>string</code> | <code>&quot;\&quot;response\&quot;&quot;</code> | 

<a name="waczToMischief"></a>

## waczToMischief(zipPath) ⇒ [<code>Promise.&lt;Mischief&gt;</code>](#Mischief)
Reconstructs a Mischief capture from a WACZ
containing raw http traffic data.

**Kind**: global function  
**Returns**: [<code>Promise.&lt;Mischief&gt;</code>](#Mischief) - - a reconstructred Mischief capture object  

| Param | Type | Description |
| --- | --- | --- |
| zipPath | <code>string</code> | path to the zipped WACZ |

<a name="getPagesJSON"></a>

## getPagesJSON(zip) ⇒ <code>Array.&lt;object&gt;</code>
Retrieves the pages.jsonl data from the WARC and parses it

**Kind**: global function  
**Returns**: <code>Array.&lt;object&gt;</code> - - an array of page entry objects  

| Param | Type |
| --- | --- |
| zip | <code>StreamZipAsync</code> | 

<a name="getDataPackage"></a>

## getDataPackage(zip) ⇒ <code>object</code>
Retrieves the datapackage.json data from the WARC and parses it

**Kind**: global function  
**Returns**: <code>object</code> - -  

| Param | Type |
| --- | --- |
| zip | <code>StreamZipAsync</code> | 

<a name="getExchanges"></a>

## getExchanges(zip) ⇒ [<code>Array.&lt;MischiefProxyExchange&gt;</code>](#MischiefProxyExchange)
Retrieves the raw requests and responses and initializes
them into MischiefProxyExchanges

**Kind**: global function  
**Returns**: [<code>Array.&lt;MischiefProxyExchange&gt;</code>](#MischiefProxyExchange) - - an array of reconstructed MischiefProxyExchanges  

| Param | Type |
| --- | --- |
| zip | <code>StreamZipAsync</code> | 

<a name="castBlocklistMatcher"></a>

## castBlocklistMatcher(val) ⇒ <code>RegExp</code> \| <code>String</code> \| <code>Address4</code> \| <code>Address6</code>
Parses a blocklist entry for later matching.
All entries are strings that we attempt to parse
as IPs and CIDR ranges, then RegExp, before being
returned as-is if unsuccessful.

**Kind**: global function  
**Returns**: <code>RegExp</code> \| <code>String</code> \| <code>Address4</code> \| <code>Address6</code> - - The parsed matcher  
**Throws**:

- <code>Error</code> - Throws if datatype does not match String or RegExp


| Param | Type | Description |
| --- | --- | --- |
| val | <code>String</code> | a blocklist matcher |

<a name="matchAgainst"></a>

## matchAgainst(test) ⇒ <code>function</code>
Returns a function that accepts a value to test
against a blocklist matcher and returns true|false
based on that matcher

**Kind**: global function  
**Returns**: <code>function</code> - - A curried function to be used in an array search  

| Param | Type | Description |
| --- | --- | --- |
| test | <code>string</code> \| <code>RegExp</code> \| <code>Address4</code> \| <code>Address6</code> | A blocklist matcher to test against |

<a name="searchBlocklistFor"></a>

## searchBlocklistFor(...args) ⇒ <code>function</code>
Accepts any number of IP addresses or URLs as strings
and returns a function that accepts a blocklist matcher
and returns true when any one of those IPs|URLs matches

**Kind**: global function  
**Returns**: <code>function</code> - - A curried function to be used in an array search  

| Param | Type | Description |
| --- | --- | --- |
| ...args | <code>string</code> | An IP address or URL |

<a name="dirEmpty"></a>

## dirEmpty(files, dir) ⇒ <code>boolean</code>
Checks whether any files have been added to
the specified directory

**Kind**: global function  

| Param | Type | Description |
| --- | --- | --- |
| files | <code>object</code> | an object whose keys are the file paths and values are the file data |
| dir | <code>string</code> | the directory to check |

<a name="stringify"></a>

## stringify(obj) ⇒ <code>string</code>
Converts an object to a string using standarized spacing

**Kind**: global function  
**Returns**: <code>string</code> - a JSON string  

| Param | Type | Description |
| --- | --- | --- |
| obj | <code>any</code> | an JS object |

<a name="hash"></a>

## hash(buffer) ⇒ <code>string</code>
Hashes a buffer to conform to the WACZ spec

**Kind**: global function  
**Returns**: <code>string</code> - a sha256 hash prefixed with "sha256:"  

| Param | Type |
| --- | --- |
| buffer | <code>Buffer</code> | 

<a name="mischiefExchangeToPageLine"></a>

## mischiefExchangeToPageLine(exchange) ⇒ <code>object</code>
Format a MischiefExchange as needed for
the pages JSON-Lines

**Kind**: global function  

| Param | Type |
| --- | --- |
| exchange | [<code>MischiefExchange</code>](#MischiefExchange) | 

<a name="isZip"></a>

## isZip(buf) ⇒ <code>boolean</code>
Sniffs a buffer to loosely infer whether it's a zip file.

Note: this is an imperfect method.

**Kind**: global function  
**Returns**: <code>boolean</code> - True if buffer appears to be a zip file.  
**See**: [https://stackoverflow.com/a/1887113](https://stackoverflow.com/a/1887113)  

| Param | Type | Description |
| --- | --- | --- |
| buf | <code>Buffer</code> | The buffer to check |

<a name="usesStoreCompression"></a>

## usesStoreCompression(buf) ⇒ <code>boolean</code>
Checks the header of a zip buffer
to see if STORE compression was used

**Kind**: global function  

| Param | Type | Description |
| --- | --- | --- |
| buf | <code>Buffer</code> | A buffer containing zip data |

<a name="fileNameLen"></a>

## fileNameLen(buf) ⇒ <code>integer</code>
Checks the header of a zip buffer to see
how long the file name is in the header.
Used to seek past the header to the body.

**Kind**: global function  

| Param | Type | Description |
| --- | --- | --- |
| buf | <code>Buffer</code> | A buffer containing zip data |

<a name="extraFieldLen"></a>

## extraFieldLen(buf) ⇒ <code>integer</code>
Checks the header of a zip buffer to see
how long the "extra field" is in the header.
Used to seek past the header to the body.

**Kind**: global function  

| Param | Type | Description |
| --- | --- | --- |
| buf | <code>Buffer</code> | A buffer containing zip data |

<a name="readBodyAsString"></a>

## readBodyAsString(buf, byteLen) ⇒ <code>string</code>
A convenience function to seek past the header
of a zip buffer and read N bytes of the body.

**Kind**: global function  

| Param | Type | Description |
| --- | --- | --- |
| buf | <code>Buffer</code> | A buffer containing zip data |
| byteLen | <code>integer</code> |  |

<a name="create"></a>

## create(files, [store]) ⇒ <code>Promise.&lt;Buffer&gt;</code>
Creates a zip file, in memory, from a list of files

**Kind**: global function  
**Returns**: <code>Promise.&lt;Buffer&gt;</code> - - a buffer containing the zipped data  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| files | <code>object</code> |  | an object whose keys are the file paths and values are the file data |
| [store] | <code>boolean</code> | <code>true</code> | should store compression be used? |


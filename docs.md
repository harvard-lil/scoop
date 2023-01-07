## Modules

<dl>
<dt><a href="#module_CONSTANTS">CONSTANTS</a></dt>
<dd><p>Constants used across the library.</p>
</dd>
<dt><a href="#module_exchanges">exchanges</a></dt>
<dd><p>Entry point for the exchanges module.
An exchange encapsulate a request and associated response.</p>
<ul>
<li><a href="#MischiefExchange">MischiefExchange</a></li>
<li><a href="#MischiefProxyExchange">MischiefProxyExchange</a></li>
<li><a href="#MischiefGeneratedExchange">MischiefGeneratedExchange</a></li>
</ul>
</dd>
<dt><a href="#module_exporters">exporters</a></dt>
<dd><p>Entry point for the exporters module.
Functions in this module are meant to be used to convert
a Mischief instance into an archive format (i.e: WARC, WBN).</p>
<ul>
<li><a href="#mischiefToWarc">mischiefToWarc</a></li>
<li><a href="#mischiefToWacz">mischiefToWacz</a></li>
</ul>
</dd>
<dt><a href="#module_importers">importers</a></dt>
<dd><p>Entry point for the importers module
providing the following functions:</p>
<ul>
<li><a href="#waczToMischief">waczToMischief</a></li>
</ul>
</dd>
<dt><a href="#module_intercepters">intercepters</a></dt>
<dd><p>Entry point for the intercepters module
providing the following classes:</p>
<ul>
<li><a href="#MischiefIntercepter">MischiefIntercepter</a></li>
<li><a href="#MischiefProxy">MischiefProxy</a></li>
</ul>
</dd>
<dt><a href="#module_parsers">parsers</a></dt>
<dd><p>Entry point for the parsers module.
Classes in this module are meant to be used to parse raw network traffic (i.e. HTTP).</p>
<ul>
<li><a href="#MischiefHTTPParser">MischiefHTTPParser</a></li>
</ul>
</dd>
<dt><a href="#utils.module_blocklist">blocklist</a></dt>
<dd><p>Helper functions for matching items in a blocklist.</p>
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
<dt><a href="#MischiefIntercepter">MischiefIntercepter</a></dt>
<dd><p>Abstract class for intercepter implementations to capture HTTP traffic.</p>
</dd>
<dt><a href="#MischiefProxy">MischiefProxy</a></dt>
<dd><p>A proxy based intercepter that captures raw HTTP exchanges
without parsing, preserving headers et al as delivered.</p>
</dd>
<dt><a href="#Mischief">Mischief</a></dt>
<dd><p>Experimental single-page web archiving library using Playwright.
Uses a proxy to allow for comprehensive and raw network interception.</p>
<pre><code class="language-javascript">import { Mischief } from &quot;mischief&quot;;

const myCapture = new Mischief(&quot;https://example.com&quot;);
await myCapture.capture();
const myArchive = await myCapture.toWarc();
</code></pre>
</dd>
<dt><a href="#MischiefOptions">MischiefOptions</a></dt>
<dd><p>Helper class to filter and validate options passed to a Mischief instance.</p>
</dd>
<dt><a href="#MischiefHTTPParser">MischiefHTTPParser</a></dt>
<dd><p>Parser for raw HTTP exchanges</p>
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
</dl>

<a name="module_CONSTANTS"></a>

## CONSTANTS
Constants used across the library.


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
An exchange encapsulate a request and associated response.

* [MischiefExchange](#MischiefExchange)
* [MischiefProxyExchange](#MischiefProxyExchange)
* [MischiefGeneratedExchange](#MischiefGeneratedExchange)

<a name="module_exporters"></a>

## exporters
Entry point for the exporters module.
Functions in this module are meant to be used to convert
a Mischief instance into an archive format (i.e: WARC, WBN).

* [mischiefToWarc](#mischiefToWarc)
* [mischiefToWacz](#mischiefToWacz)

<a name="module_importers"></a>

## importers
Entry point for the importers module
providing the following functions:

* [waczToMischief](#waczToMischief)

<a name="module_intercepters"></a>

## intercepters
Entry point for the intercepters module
providing the following classes:

* [MischiefIntercepter](#MischiefIntercepter)
* [MischiefProxy](#MischiefProxy)

<a name="module_parsers"></a>

## parsers
Entry point for the parsers module.
Classes in this module are meant to be used to parse raw network traffic (i.e. HTTP).

* [MischiefHTTPParser](#MischiefHTTPParser)

<a name="utils.module_blocklist"></a>

## blocklist
Helper functions for matching items in a blocklist.


* [blocklist](#utils.module_blocklist)
    * _static_
        * [.castBlocklistMatcher(val)](#utils.module_blocklist.castBlocklistMatcher) ⇒ <code>RegExp</code> \| <code>String</code> \| <code>Address4</code> \| <code>Address6</code>
        * [.searchBlocklistFor(...args)](#utils.module_blocklist.searchBlocklistFor) ⇒ <code>function</code>
    * _inner_
        * [~matchAgainst(test)](#utils.module_blocklist..matchAgainst) ⇒ <code>function</code>

<a name="utils.module_blocklist.castBlocklistMatcher"></a>

### blocklist.castBlocklistMatcher(val) ⇒ <code>RegExp</code> \| <code>String</code> \| <code>Address4</code> \| <code>Address6</code>
Parses a blocklist entry for later matching.
All entries are strings that we attempt to parse
as IPs and CIDR ranges, then RegExp, before being
returned as-is if unsuccessful.

**Kind**: static method of [<code>blocklist</code>](#utils.module_blocklist)  
**Returns**: <code>RegExp</code> \| <code>String</code> \| <code>Address4</code> \| <code>Address6</code> - - The parsed matcher  
**Throws**:

- <code>Error</code> - Throws if datatype does not match String or RegExp


| Param | Type | Description |
| --- | --- | --- |
| val | <code>String</code> | a blocklist matcher |

<a name="utils.module_blocklist.searchBlocklistFor"></a>

### blocklist.searchBlocklistFor(...args) ⇒ <code>function</code>
Accepts any number of IP addresses or URLs as strings
and returns a function that accepts a blocklist matcher
and returns true when any one of those IPs|URLs matches

**Kind**: static method of [<code>blocklist</code>](#utils.module_blocklist)  
**Returns**: <code>function</code> - - A curried function to be used in an array search  

| Param | Type | Description |
| --- | --- | --- |
| ...args | <code>string</code> | An IP address or URL |

<a name="utils.module_blocklist..matchAgainst"></a>

### blocklist~matchAgainst(test) ⇒ <code>function</code>
Returns a function that accepts a value to test
against a blocklist matcher and returns true|false
based on that matcher

**Kind**: inner method of [<code>blocklist</code>](#utils.module_blocklist)  
**Returns**: <code>function</code> - - A curried function to be used in an array search  

| Param | Type | Description |
| --- | --- | --- |
| test | <code>string</code> \| <code>RegExp</code> \| <code>Address4</code> \| <code>Address6</code> | A blocklist matcher to test against |

<a name="MischiefProxy"></a>

## MischiefProxy
A proxy based intercepter that captures raw HTTP exchanges
without parsing, preserving headers et al as delivered.

**Kind**: global class  

* [MischiefProxy](#MischiefProxy)
    * [.getOrInitExchange(id, type)](#MischiefProxy+getOrInitExchange)
    * [.checkRequestAgainstBlocklist(session)](#MischiefProxy+checkRequestAgainstBlocklist) ⇒ <code>boolean</code>
    * [.intercept(type, data, session)](#MischiefProxy+intercept)

<a name="MischiefProxy+getOrInitExchange"></a>

### mischiefProxy.getOrInitExchange(id, type)
Returns an exchange based on the session id and type ("request" or "response").
If the type is a request and there's already been a response on that same session,
create a new exchange. Otherwise append to continue the exchange.

**Kind**: instance method of [<code>MischiefProxy</code>](#MischiefProxy)  

| Param | Type |
| --- | --- |
| id | <code>string</code> | 
| type | <code>string</code> | 

<a name="MischiefProxy+checkRequestAgainstBlocklist"></a>

### mischiefProxy.checkRequestAgainstBlocklist(session) ⇒ <code>boolean</code>
Checks an outgoing request against the blocklist. Interrupts the request it needed.
Keeps trace of blocked requests in `Mischief.provenanceInfo`.

**Kind**: instance method of [<code>MischiefProxy</code>](#MischiefProxy)  
**Returns**: <code>boolean</code> - - `true` if request was interrupted  

| Param | Type | Description |
| --- | --- | --- |
| session | <code>object</code> | ProxyServer session |

<a name="MischiefProxy+intercept"></a>

### mischiefProxy.intercept(type, data, session)
Collates network data (both requests and responses) from the proxy.
Post-capture checks and capture size enforcement happens here.

**Kind**: instance method of [<code>MischiefProxy</code>](#MischiefProxy)  

| Param | Type |
| --- | --- |
| type | <code>string</code> | 
| data | <code>Buffer</code> | 
| session | <code>Session</code> | 

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

<a name="MischiefHTTPParser"></a>

## MischiefHTTPParser
Parser for raw HTTP exchanges

**Kind**: global class  
**See**: [https://github.com/creationix/http-parser-js/blob/master/standalone-example.js](https://github.com/creationix/http-parser-js/blob/master/standalone-example.js)  
<a name="MischiefHTTPParser.parseResponse"></a>

### MischiefHTTPParser.parseResponse(input) ⇒ <code>MischiefHTTPParserResponse</code>
**Kind**: static method of [<code>MischiefHTTPParser</code>](#MischiefHTTPParser)  

| Param | Type |
| --- | --- |
| input | <code>\*</code> | 

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


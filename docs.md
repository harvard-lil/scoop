# Mischief

This is some header material that will be injected into both the HTML and Markdown exports of the docs.

## Modules
Module | Description
------ | -----------
[CONSTANTS] | <p>Constants used across the library.</p>
[exchanges] | <p>Entry point for the exchanges module. An exchange encapsulates a request and associated response.</p> <p>Classes:</p> <ul> <li>[MischiefExchange]</li> <li>[MischiefProxyExchange]</li> <li>[MischiefGeneratedExchange]</li> </ul>
[exporters] | <p>Entry point for the exporters module. Functions in this module are meant to be used to convert a Mischief instance into an archive format (i.e: WARC, WBN).</p>
[importers] | <p>Entry point for the importers module.</p>
[intercepters] | <p>Entry point for the intercepters module.</p> <p>Classes:</p> <ul> <li>[MischiefIntercepter]</li> <li>[MischiefProxy]</li> </ul>
[options] | 
[parsers] | <p>Entry point for the parsers module. Classes in this module are meant to be used to parse raw network traffic (i.e. HTTP).</p> <p>Classes:</p> <ul> <li>[MischiefHTTPParser]</li> </ul>

## Classes

Name | Description
------ | -----------
[Mischief] | <p>Experimental single-page web archiving library using Playwright. Uses a proxy to allow for comprehensive and raw network interception.</p>
*[MischiefExchange]* | <p>Represents an HTTP exchange captured by Mischief, irrespective of how it was captured. To be specialized by interception type (i.e: [MischiefProxyExchange].</p>
[MischiefGeneratedExchange] | <p>An exchange constructed ad-hoc (vs intercepted), typically used to inject additional resources into an archive</p>
[MischiefHTTPParser] | <p>Parser for raw HTTP exchanges</p>
*[MischiefIntercepter]* | <p>Abstract class for intercepter implementations to capture HTTP traffic.</p>
[MischiefProxy] | <p>A proxy based intercepter that captures raw HTTP exchanges without parsing, preserving headers et al as delivered.</p>
[MischiefProxyExchange] | <p>Represents an HTTP exchange captured via MischiefProxy.</p>
[WACZ] | <p>WACZ builder</p>


## Mischief

<p>Experimental single-page web archiving library using Playwright.
Uses a proxy to allow for comprehensive and raw network interception.</p>

**Kind**: global class  

* [Mischief]
    * [new Mischief(url, \[options\])]
    * _static_
        * [.fromWacz(zipPath)]
    * _instance_
        * [.addGeneratedExchange(url, httpHeaders, body, isEntryPoint, description)]
        * [.blocklist]
        * [.capture()]
        * [.captureTmpFolderPath]
        * [.exchanges]
        * [.extractGeneratedExchanges()]
        * [.filterUrl(url)]
        * [.intercepter]
        * [.log]
        * [.options]
        * [.pageInfo]
        * [.provenanceInfo]
        * [.setup()]
        * [.startedAt]
        * [.state]
        * [.states]
        * [.teardown()]
        * [.toWacz(\[includeRaw\], signingServer)]
        * [.toWarc()]
        * [.url]


### new Mischief(url, \[options\])


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| url | `string` |  | <p>Must be a valid HTTP(S) url.</p> |
| \[options\] | `object` | `{}` | <p>See :func:<code>MischiefOptions.defaults</code> for details.</p> |

**Example**  
```js
import { Mischief } from "mischief";

const myCapture = new Mischief("https://example.com");
await myCapture.capture();
const myArchive = await myCapture.toWarc();
```

### Mischief.fromWacz(zipPath)

<p>(Shortcut) Reconstructs a Mischief capture from a WACZ.</p>

**Kind**: static method of [`Mischief`]  

| Param | Type | Description |
| --- | --- | --- |
| zipPath | `string` | <p>Path to .wacz file.</p> |


### mischief.addGeneratedExchange(url, httpHeaders, body, isEntryPoint, description)

<p>Generates a MischiefGeneratedExchange for generated content and adds it to <code>exchanges</code> unless time limit was reached.</p>

**Kind**: instance method of [`Mischief`]  
**Returns**: `boolean` - <p>true if generated exchange is successfully added</p>  

| Param | Type | Default |
| --- | --- | --- |
| url | `string` |  | 
| httpHeaders | `object` |  | 
| body | `Buffer` |  | 
| isEntryPoint | `boolean` | `false` | 
| description | `string` |  | 


### mischief.blocklist

<p>A mirror of options.blocklist with IPs parsed for matching</p>

**Kind**: instance property of [`Mischief`]  

### mischief.capture()

<p>Main capture process.</p>

**Kind**: instance method of [`Mischief`]  

### mischief.captureTmpFolderPath

<p>Path to the capture-specific temporary folder created by <code>setup()</code>.
Will be a child folder of the path defined in <code>CONSTANTS.TMP_PATH</code>.</p>

**Kind**: instance property of [`Mischief`]  

### mischief.exchanges

<p>Array of HTTP exchanges that constitute the capture.
Only contains generated exchanged until <code>teardown()</code>.</p>

**Kind**: instance property of [`Mischief`]  

### mischief.extractGeneratedExchanges()

<p>Returns a map of &quot;generated&quot; exchanges.
Generated exchanges = anything generated directly by Mischief (PDF snapshot, full-page screenshot, videos ...)</p>

**Kind**: instance method of [`Mischief`]  

### mischief.filterUrl(url)

<p>Filters a url to ensure it's suitable for capture.
This function throws if:</p>
<ul>
<li><code>url</code> is not a valid url</li>
<li><code>url</code> is not an http / https url</li>
<li><code>url</code> matches a blocklist rule</li>
</ul>

**Kind**: instance method of [`Mischief`]  

| Param | Type |
| --- | --- |
| url | `string` | 


### mischief.intercepter

<p>Reference to the intercepter chosen for capture.</p>

**Kind**: instance property of [`Mischief`]  

### mischief.log

<p>Logger.
Logging level controlled via the <code>logLevel</code> option.</p>

**Kind**: instance property of [`Mischief`]  

### mischief.options

<p>Current settings.
Should only contain keys defined in [options.defaultOptions].</p>

**Kind**: instance property of [`Mischief`]  

### mischief.pageInfo

<p>Info extracted by the browser about the page on initial load</p>

**Kind**: instance property of [`Mischief`]  

### mischief.provenanceInfo

<p>Will only be populated if <code>options.provenanceSummary</code> is <code>true</code>.</p>

**Kind**: instance property of [`Mischief`]  

### mischief.setup()

<p>Sets up the proxy and Playwright resources, creates capture-specific temporary folder.</p>

**Kind**: instance method of [`Mischief`]  
**Returns**: `Promise.<Page>` - <p>Resolves to a Playwright [Page] object</p>  

### mischief.startedAt

<p>The time at which the page was crawled.</p>

**Kind**: instance property of [`Mischief`]  

### mischief.state

<p>Current state of the capture.
Should only contain states defined in <code>states</code>.</p>

**Kind**: instance property of [`Mischief`]  

### mischief.states

<p>Enum-like states that the capture occupies.</p>

**Kind**: instance enum of [`Mischief`]  
**Read only**: true  

### mischief.teardown()

<p>Tears down Playwright, intercepter resources, and capture-specific temporary folder.</p>

**Kind**: instance method of [`Mischief`]  

### mischief.toWacz(\[includeRaw\], signingServer)

<p>(Shortcut) Export this Mischief capture to WACZ.</p>

**Kind**: instance method of [`Mischief`]  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| \[includeRaw\] | `boolean` | `true` | <p>Include a copy of RAW Http exchanges to the wacz (under <code>/raw</code>)?</p> |
| signingServer | `object` |  | <p>Optional server information for signing the WACZ</p> |
| signingServer.url | `string` |  | <p>url of the signing server</p> |
| signingServer.token | `string` |  | <p>Optional token to be passed to the signing server via the Authorization header</p> |


### mischief.toWarc()

<p>(Shortcut) Export this Mischief capture to WARC.</p>

**Kind**: instance method of [`Mischief`]  

### mischief.url

<p>URL to capture.</p>

**Kind**: instance property of [`Mischief`]  

## *MischiefExchange*

<p>Represents an HTTP exchange captured by Mischief, irrespective of how it was captured.
To be specialized by interception type (i.e: [MischiefProxyExchange].</p>

**Kind**: global abstract class  

* *[MischiefExchange]*
    * *[new MischiefExchange(\[props\])]*
    * _instance_
        * *[.connectionId]*
        * *[.date]*
        * *[.id]*
        * *[.isEntryPoint]*
        * *[.request]*
        * *[.response]*
    * _inner_
        * *[~RequestOrResponse]*


### *new MischiefExchange(\[props\])*


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| \[props\] | `object` | `{}` | <p>Object containing any of the properties of <code>this</code>.</p> |


### *mischiefExchange.connectionId*

**Kind**: instance property of [`MischiefExchange`]  

### *mischiefExchange.date*

**Kind**: instance property of [`MischiefExchange`]  

### *mischiefExchange.id*

**Kind**: instance property of [`MischiefExchange`]  

### *mischiefExchange.isEntryPoint*

**Kind**: instance property of [`MischiefExchange`]  

### *mischiefExchange.request*

**Kind**: instance property of [`MischiefExchange`]  

### *mischiefExchange.response*

**Kind**: instance property of [`MischiefExchange`]  

### *MischiefExchange~RequestOrResponse*

**Kind**: inner typedef of [`MischiefExchange`]  
**Properties**

| Name | Type |
| --- | --- |
| shouldKeepAlive | `boolean` | 
| upgrade | `boolean` | 
| method | `string` | 
| url | `string` | 
| versionMajor | `number` | 
| versionMinor | `number` | 
| headers | `object` | 
| body | `Buffer` | 
| trailers | `Array` | 


## MischiefGeneratedExchange

<p>An exchange constructed ad-hoc (vs intercepted),
typically used to inject additional resources into an archive</p>

**Kind**: global class  
**Extends**: [`MischiefExchange`]  

* [MischiefGeneratedExchange]
    * [new MischiefGeneratedExchange(\[props\])]
    * [.connectionId]
    * [.date]
    * [.description]
    * [.id]
    * [.isEntryPoint]
    * [.request]
    * [.response]


### new MischiefGeneratedExchange(\[props\])


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| \[props\] | `object` | `{}` | <p>Object containing any of the properties of <code>this</code>.</p> |


### mischiefGeneratedExchange.connectionId

**Kind**: instance property of [`MischiefGeneratedExchange`]  

### mischiefGeneratedExchange.date

**Kind**: instance property of [`MischiefGeneratedExchange`]  

### mischiefGeneratedExchange.description

**Kind**: instance property of [`MischiefGeneratedExchange`]  

### mischiefGeneratedExchange.id

**Kind**: instance property of [`MischiefGeneratedExchange`]  

### mischiefGeneratedExchange.isEntryPoint

**Kind**: instance property of [`MischiefGeneratedExchange`]  

### mischiefGeneratedExchange.request

**Kind**: instance property of [`MischiefGeneratedExchange`]  

### mischiefGeneratedExchange.response

**Kind**: instance property of [`MischiefGeneratedExchange`]  

## MischiefHTTPParser

<p>Parser for raw HTTP exchanges</p>

**Kind**: global class  
**See**: [https://github.com/creationix/http-parser-js/blob/master/standalone-example.js]  

### MischiefHTTPParser.parseResponse(input)

**Kind**: static method of [`MischiefHTTPParser`]  

| Param | Type |
| --- | --- |
| input | `*` | 


## *MischiefIntercepter*

<p>Abstract class for intercepter implementations to capture HTTP traffic.</p>

**Kind**: global abstract class  

* *[MischiefIntercepter]*
    * *[new MischiefIntercepter(capture)]*
    * *[.byteLength]*
    * *[.capture]*
    * *[.checkAndEnforceSizeLimit()]*
    * *[.checkExchangeForNoArchive(exchange)]*
    * *[.exchanges]*
    * *[.recordExchanges]*


### *new MischiefIntercepter(capture)*


| Param | Type | Description |
| --- | --- | --- |
| capture | [`Mischief`] | <p>a Mischief capture</p> |


### *mischiefIntercepter.byteLength*

<p>Total byte length of all data recorded to exchanges</p>

**Kind**: instance property of [`MischiefIntercepter`]  

### *mischiefIntercepter.capture*

<p>The Mischief capture utilizing this intercepter</p>

**Kind**: instance property of [`MischiefIntercepter`]  

### *mischiefIntercepter.checkAndEnforceSizeLimit()*

<p>Checks whether the total byte length has exceeded
the capture's limit and, if so, ends the capture</p>

**Kind**: instance method of [`MischiefIntercepter`]  

### *mischiefIntercepter.checkExchangeForNoArchive(exchange)*

<p>Tries to find the &quot;noarchive&quot; directive in a given exchange.
If found, keeps trace of match in <code>Mischief.provenanceInfo</code>.</p>

**Kind**: instance method of [`MischiefIntercepter`]  
**Returns**: `boolean` - <ul>
<li><code>true</code> if request contained &quot;noarchive&quot;</li>
</ul>  

| Param | Type |
| --- | --- |
| exchange | [`MischiefExchange`] | 


### *mischiefIntercepter.exchanges*

<p>Data recorded by the intercepter,
formatted as a series of exchanges</p>

**Kind**: instance property of [`MischiefIntercepter`]  

### *mischiefIntercepter.recordExchanges*

<p>When set to <code>false</code>, the intercepter will cease
appending data to the exchanges array until
once again set to <code>true</code></p>

**Kind**: instance property of [`MischiefIntercepter`]  

## MischiefProxy

<p>A proxy based intercepter that captures raw HTTP exchanges
without parsing, preserving headers et al as delivered.</p>

**Kind**: global class  
**Extends**: [`MischiefIntercepter`]  

* [MischiefProxy]
    * [.byteLength]
    * [.capture]
    * [.checkAndEnforceSizeLimit()]
    * [.checkExchangeForNoArchive(exchange)]
    * [.checkRequestAgainstBlocklist(session)]
    * [.contextOptions]
    * [.exchanges]
    * [.getOrInitExchange(id, type)]
    * [.intercept(type, data, session)]
    * [.recordExchanges]
    * [.setup()]
    * [.teardown()]


### mischiefProxy.byteLength

<p>Total byte length of all data recorded to exchanges</p>

**Kind**: instance property of [`MischiefProxy`]  
**Overrides**: `byteLength`  

### mischiefProxy.capture

<p>The Mischief capture utilizing this intercepter</p>

**Kind**: instance property of [`MischiefProxy`]  

### mischiefProxy.checkAndEnforceSizeLimit()

<p>Checks whether the total byte length has exceeded
the capture's limit and, if so, ends the capture</p>

**Kind**: instance method of [`MischiefProxy`]  

### mischiefProxy.checkExchangeForNoArchive(exchange)

<p>Tries to find the &quot;noarchive&quot; directive in a given exchange.
If found, keeps trace of match in <code>Mischief.provenanceInfo</code>.</p>

**Kind**: instance method of [`MischiefProxy`]  
**Returns**: `boolean` - <ul>
<li><code>true</code> if request contained &quot;noarchive&quot;</li>
</ul>  

| Param | Type |
| --- | --- |
| exchange | [`MischiefExchange`] | 


### mischiefProxy.checkRequestAgainstBlocklist(session)

<p>Checks an outgoing request against the blocklist. Interrupts the request it needed.
Keeps trace of blocked requests in <code>Mischief.provenanceInfo</code>.</p>

**Kind**: instance method of [`MischiefProxy`]  
**Returns**: `boolean` - <ul>
<li><code>true</code> if request was interrupted</li>
</ul>  

| Param | Type | Description |
| --- | --- | --- |
| session | `object` | <p>ProxyServer session</p> |


### mischiefProxy.contextOptions

<p>The proxy info to be consumed by Playwright.
Includes a flag to ignore certificate errors introduced by proxying.</p>

**Kind**: instance property of [`MischiefProxy`]  
**Properties**

| Name | Type | Default | Description |
| --- | --- | --- | --- |
| proxy | `object` |  |  |
| proxy.server | `string` |  | <p>The proxy url</p> |
| ignoreHTTPSErrors | `boolean` | `true` |  |


### mischiefProxy.exchanges

<p>Data recorded by the intercepter,
formatted as a series of exchanges</p>

**Kind**: instance property of [`MischiefProxy`]  
**Overrides**: [`exchanges`]  

### mischiefProxy.getOrInitExchange(id, type)

<p>Returns an exchange based on the session id and type (&quot;request&quot; or &quot;response&quot;).
If the type is a request and there's already been a response on that same session,
create a new exchange. Otherwise append to continue the exchange.</p>

**Kind**: instance method of [`MischiefProxy`]  

| Param | Type |
| --- | --- |
| id | `string` | 
| type | `string` | 


### mischiefProxy.intercept(type, data, session)

<p>Collates network data (both requests and responses) from the proxy.
Post-capture checks and capture size enforcement happens here.</p>

**Kind**: instance method of [`MischiefProxy`]  

| Param | Type |
| --- | --- |
| type | `string` | 
| data | `Buffer` | 
| session | `Session` | 


### mischiefProxy.recordExchanges

<p>When set to <code>false</code>, the intercepter will cease
appending data to the exchanges array until
once again set to <code>true</code></p>

**Kind**: instance property of [`MischiefProxy`]  

### mischiefProxy.setup()

<p>Initializes the proxy server</p>

**Kind**: instance method of [`MischiefProxy`]  

### mischiefProxy.teardown()

<p>Closes the proxy server</p>

**Kind**: instance method of [`MischiefProxy`]  

## MischiefProxyExchange

<p>Represents an HTTP exchange captured via MischiefProxy.</p>

**Kind**: global class  
**Extends**: [`MischiefExchange`]  

* [MischiefProxyExchange]
    * [new MischiefProxyExchange(\[props\])]
    * [.connectionId]
    * [.date]
    * [.id]
    * [.isEntryPoint]
    * [.request]
    * [.requestRaw]
    * [.requestRawBody]
    * [.requestRawHeaders]
    * [.response]
    * [.responseRaw]
    * [.responseRawBody]
    * [.responseRawHeaders]


### new MischiefProxyExchange(\[props\])


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| \[props\] | `object` | `{}` | <p>Object containing any of the properties of <code>this</code>.</p> |


### mischiefProxyExchange.connectionId

**Kind**: instance property of [`MischiefProxyExchange`]  

### mischiefProxyExchange.date

**Kind**: instance property of [`MischiefProxyExchange`]  

### mischiefProxyExchange.id

**Kind**: instance property of [`MischiefProxyExchange`]  

### mischiefProxyExchange.isEntryPoint

**Kind**: instance property of [`MischiefProxyExchange`]  

### mischiefProxyExchange.request

**Kind**: instance property of [`MischiefProxyExchange`]  
**Overrides**: `request`  

### mischiefProxyExchange.requestRaw

**Kind**: instance property of [`MischiefProxyExchange`]  

### mischiefProxyExchange.requestRawBody

**Kind**: instance property of [`MischiefProxyExchange`]  

### mischiefProxyExchange.requestRawHeaders

**Kind**: instance property of [`MischiefProxyExchange`]  

### mischiefProxyExchange.response

**Kind**: instance property of [`MischiefProxyExchange`]  
**Overrides**: `response`  

### mischiefProxyExchange.responseRaw

**Kind**: instance property of [`MischiefProxyExchange`]  

### mischiefProxyExchange.responseRawBody

**Kind**: instance property of [`MischiefProxyExchange`]  

### mischiefProxyExchange.responseRawHeaders

**Kind**: instance property of [`MischiefProxyExchange`]  

## CONSTANTS

<p>Constants used across the library.</p>


* [CONSTANTS]
    * [.ASSETS_PATH]
    * [.BASE_PATH]
    * [.EXECUTABLES_PATH]
    * [.LOGGING_COLORS]
    * [.SOFTWARE]
    * [.TEMPLATES_PATH]
    * [.TMP_PATH]
    * [.VERSION]
    * [.WACZ_VERSION]
    * [.WARC_VERSION]


### CONSTANTS.ASSETS_PATH

<p>Location of the directory in which assets may be rendered (ex: the provenance summary)</p>

**Kind**: static constant of [`CONSTANTS`]  

### CONSTANTS.BASE_PATH

<p>Path to the Mischief library.</p>

**Kind**: static constant of [`CONSTANTS`]  

### CONSTANTS.EXECUTABLES_PATH

<p>Path to the executables folder.</p>

**Kind**: static constant of [`CONSTANTS`]  

### CONSTANTS.LOGGING_COLORS

<p>Colors used by the logging function</p>

**Kind**: static constant of [`CONSTANTS`]  

### CONSTANTS.SOFTWARE

<p>Description of this software.
Used in provenance data to indicate which softare made the capture.</p>

**Kind**: static constant of [`CONSTANTS`]  

### CONSTANTS.TEMPLATES_PATH

<p>Path to the templates folder.</p>

**Kind**: static constant of [`CONSTANTS`]  

### CONSTANTS.TMP_PATH

<p>Path to the temporary folder.</p>

**Kind**: static constant of [`CONSTANTS`]  

### CONSTANTS.VERSION

<p>The current version of Mischief. Also used in provenance data.</p>

**Kind**: static constant of [`CONSTANTS`]  

### CONSTANTS.WACZ_VERSION

<p>The version of WACZ this library exports</p>

**Kind**: static constant of [`CONSTANTS`]  

### CONSTANTS.WARC_VERSION

<p>The version of WARC this library exports</p>

**Kind**: static constant of [`CONSTANTS`]  

## exchanges

<p>Entry point for the exchanges module.
An exchange encapsulates a request and associated response.</p>
<p>Classes:</p>
<ul>
<li>[MischiefExchange]</li>
<li>[MischiefProxyExchange]</li>
<li>[MischiefGeneratedExchange]</li>
</ul>


## exporters

<p>Entry point for the exporters module.
Functions in this module are meant to be used to convert
a Mischief instance into an archive format (i.e: WARC, WBN).</p>


* [exporters]
    * [.mischiefToWacz(capture, \[includeRaw\], signingServer)]
    * [.mischiefToWarc(capture)]


### exporters.mischiefToWacz(capture, \[includeRaw\], signingServer)

<p>Mischief capture to WACZ converter.</p>
<p>Note:</p>
<ul>
<li>Logs are added to capture object via <code>Mischief.log</code>.</li>
</ul>

**Kind**: static method of [`exporters`]  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| capture | [`Mischief`] |  |  |
| \[includeRaw\] | `boolean` | `false` | <p>If <code>true</code>, includes the raw http exchanges in the WACZ.</p> |
| signingServer | `object` |  | <p>Optional server information for signing the WACZ</p> |
| signingServer.url | `string` |  | <p>url of the signing server</p> |
| signingServer.token | `string` |  | <p>Optional token to be passed to the signing server via the Authorization header</p> |


### exporters.mischiefToWarc(capture)

<p>Mischief capture to WARC converter.</p>
<p>Note:</p>
<ul>
<li>Logs are added to capture object via <code>Mischief.log</code>.</li>
</ul>

**Kind**: static method of [`exporters`]  

| Param | Type |
| --- | --- |
| capture | [`Mischief`] | 


## importers

<p>Entry point for the importers module.</p>


### importers.waczToMischief(zipPath)

<p>Reconstructs a Mischief capture from a WACZ
containing raw http traffic data.</p>

**Kind**: static method of [`importers`]  
**Returns**: `Promise.<Mischief>` - <p>a reconstructed Mischief capture object</p>  

| Param | Type | Description |
| --- | --- | --- |
| zipPath | `string` | <p>path to the zipped WACZ</p> |


## intercepters

<p>Entry point for the intercepters module.</p>
<p>Classes:</p>
<ul>
<li>[MischiefIntercepter]</li>
<li>[MischiefProxy]</li>
</ul>


## options


* [options]
    * [.defaultOptions]
    * [.filterOptions(newOptions)]


### options.defaultOptions

<p>Available options and defaults for Mischief.
Unless specified otherwise at constructor level, Mischief will run with these settings.</p>

**Kind**: static constant of [`options`]  
**Properties**

| Name | Type | Default | Description |
| --- | --- | --- | --- |
| logLevel | `boolean` | `&quot;info&quot;` | <p>Determines the logging level of this instance. Can be &quot;silent&quot;, &quot;trace&quot;, &quot;debug&quot;, &quot;info&quot;, &quot;warn&quot; or &quot;error&quot;. See https://github.com/pimterry/loglevel for more information.</p> |
| headless | `boolean` | `false` | <p>Should Playwright run in headless mode?</p> |
| proxyHost | `string` | `'&quot;localhost&quot;'` | <p>What host should Playwright proxy through for capture?</p> |
| proxyPort | `number` | `9000` | <p>What port should Playwright proxy through for capture?</p> |
| proxyVerbose | `boolean` | `false` | <p>Should log entries from the proxy be printed?</p> |
| totalTimeout | `number` | `300000` | <p>How long should Mischief wait for all steps in the capture to complete, in ms?</p> |
| loadTimeout | `number` | `30000` | <p>How long should Mischief wait for the page to load, in ms?</p> |
| networkIdleTimeout | `number` | `30000` | <p>How long should Mischief wait for network events to complete, in ms.</p> |
| behaviorsTimeout | `number` | `60000` | <p>How long should Mischief wait for media to play, secondary resources, and site specific behaviors (in total), in ms?</p> |
| keepPartialResponses | `boolean` | `true` | <p>Should Mischief keep partially downloaded resources?</p> |
| maxSize | `number` | `209715200` | <p>Maximum size, in bytes, for the exchanges list.</p> |
| screenshot | `boolean` | `true` | <p>Should Mischief try to make a screenshot? Screenshot will be added as <code>file:///screenshot.png</code> in the exchanges list.</p> |
| domSnapshot | `boolean` | `true` | <p>Should Mischief save a snapshot of the rendered DOM? Added as <code>file:///dom-snapshot.html</code> in the exchanges list.</p> |
| pdfSnapshot | `boolean` | `false` | <p>Should Mischief save a PDF of the rendered page? Only available in headless mode. Added as <code>file:///pdf-snapshot.pedf</code> in the exchanges list.</p> |
| captureVideoAsAttachment | `boolean` | `true` | <p>If <code>true</code>, will try to capture the main video that may be present in this page as <code>file:///video-extracted.mp4</code>. Will also save associated meta data as <code>file:///video-extracted-metadata.json</code>. This capture happens out of the browser.</p> |
| captureVideoAsAttachmentTimeout | `number` | `30000` | <p>How long should Mischief wait for <code>captureVideoAsAttachment</code> to finish.</p> |
| ytDlpPath | `string` | `'&quot;./executables/yt-dlp&quot;'` | <p>Path to the yt-dlp executable to be used.</p> |
| captureWindowX | `number` | `1600` | <p>Browser window resolution in pixels: X axis.</p> |
| captureWindowY | `number` | `900` | <p>Browser window resolution in pixels: Y axis.</p> |
| autoScroll | `boolean` | `true` | <p>Should Mischief try to scroll through the page?</p> |
| autoPlayMedia | `boolean` | `true` | <p>Should Mischief try to autoplay <code>&lt;audio&gt;</code> and <code>&lt;video&gt;</code> tags?</p> |
| grabSecondaryResources | `boolean` | `true` | <p>Should Mischief try to download img srcsets and secondary stylesheets?</p> |
| runSiteSpecificBehaviors | `boolean` | `true` | <p>Should Mischief run behaviors tailored to specific sites (ex: Twitter) in an attempt to better grab the page?</p> |
| intercepter | `string` | `'&quot;MischiefProxy&quot;'` | <p>Network interception method to be used. Available at the moment: &quot;MischiefProxy&quot;.</p> |
| userAgentSuffix | `string` | `'&quot;&quot;'` | <p>String to append to the user agent.</p> |
| provenanceSummary | `boolean` | `true` | <p>If <code>true</code>, information about the capture process (public IP address, User Agent, software version ...) will be gathered and summarized under <code>file:///provenance-summary.html</code>. WACZ exports will also hold that information at <code>datapackage.json</code> level, under <code>extras</code>.</p> |
| publicIpResolverEndpoint | `string` | `'&quot;https://myip.lil.tools&quot;'` | <p>URL to be used to retrieve the client's public IP address for <code>provenanceSummary</code>. Endpoint requirements: must simply return a IPv4 or IPv6 address as text.</p> |
| blocklist | `Array.<string>` |  | <p>a list of patterns, to be matched against each request's URL and IP address, and subsequently blocked during capture. Valid entries include url strings, CIDR strings, and regular expressions in string form.</p> |


### options.filterOptions(newOptions)

<p>Filters a new options object by comparing it with defaults.
Will use defaults for missing properties.</p>

**Kind**: static method of [`options`]  

| Param | Type |
| --- | --- |
| newOptions | `object` | 


## parsers

<p>Entry point for the parsers module.
Classes in this module are meant to be used to parse raw network traffic (i.e. HTTP).</p>
<p>Classes:</p>
<ul>
<li>[MischiefHTTPParser]</li>
</ul>

<!-- LINKS -->

[CONSTANTS]:#constants
[exchanges]:#exchanges
[MischiefExchange]:#MischiefExchange
[MischiefProxyExchange]:#MischiefProxyExchange
[MischiefGeneratedExchange]:#MischiefGeneratedExchange
[exporters]:#exporters
[importers]:#importers
[intercepters]:#intercepters
[MischiefIntercepter]:#MischiefIntercepter
[MischiefProxy]:#MischiefProxy
[options]:#options
[parsers]:#parsers
[MischiefHTTPParser]:#MischiefHTTPParser
[Mischief]:#mischief
[WACZ]:#waczwacz
[.blocklist]:#mischiefblocklist
[.captureTmpFolderPath]:#mischiefcapturetmpfolderpath
[.exchanges]:#mischiefproxyexchanges
[.intercepter]:#mischiefintercepter
[.log]:#mischieflog
[.options]:#mischiefoptions
[.pageInfo]:#mischiefpageinfo
[.provenanceInfo]:#mischiefprovenanceinfo
[.startedAt]:#mischiefstartedat
[.state]:#mischiefstate
[.states]:#mischiefstates
[.url]:#mischiefurl
[`Mischief`]:#new-mischiefurl-options
[options.defaultOptions]:options.defaultOptions
[Page]:https://playwright.dev/docs/api/class-page
[.connectionId]:#mischiefproxyexchangeconnectionid
[.date]:#mischiefproxyexchangedate
[.id]:#mischiefproxyexchangeid
[.isEntryPoint]:#mischiefproxyexchangeisentrypoint
[.request]:#mischiefproxyexchangerequest
[.response]:#mischiefproxyexchangeresponse
[~RequestOrResponse]:#mischiefexchangerequestorresponse
[`MischiefExchange`]:#new-mischiefexchangeprops
[.description]:#mischiefgeneratedexchangedescription
[`MischiefGeneratedExchange`]:#new-mischiefgeneratedexchangeprops
[https://github.com/creationix/http-parser-js/blob/master/standalone-example.js]:https://github.com/creationix/http-parser-js/blob/master/standalone-example.js
[`MischiefHTTPParser`]:#mischiefhttpparser
[.byteLength]:#mischiefproxybytelength
[.capture]:#mischiefproxycapture
[.recordExchanges]:#mischiefproxyrecordexchanges
[`MischiefIntercepter`]:#new-mischiefinterceptercapture
[.contextOptions]:#mischiefproxycontextoptions
[`MischiefProxy`]:#mischiefproxy
[`exchanges`]:#exchanges
[.requestRaw]:#mischiefproxyexchangerequestraw
[.requestRawBody]:#mischiefproxyexchangerequestrawbody
[.requestRawHeaders]:#mischiefproxyexchangerequestrawheaders
[.responseRaw]:#mischiefproxyexchangeresponseraw
[.responseRawBody]:#mischiefproxyexchangeresponserawbody
[.responseRawHeaders]:#mischiefproxyexchangeresponserawheaders
[`MischiefProxyExchange`]:#new-mischiefproxyexchangeprops
[.ASSETS_PATH]:#constantsassets_path
[.BASE_PATH]:#constantsbase_path
[.EXECUTABLES_PATH]:#constantsexecutables_path
[.LOGGING_COLORS]:#constantslogging_colors
[.SOFTWARE]:#constantssoftware
[.TEMPLATES_PATH]:#constantstemplates_path
[.TMP_PATH]:#constantstmp_path
[.VERSION]:#constantsversion
[.WACZ_VERSION]:#constantswacz_version
[.WARC_VERSION]:#constantswarc_version
[`CONSTANTS`]:#constants
[`exporters`]:#exporters
[`importers`]:#importers
[.defaultOptions]:#optionsdefaultoptions
[`options`]:#options
[new Mischief(url, \[options\])]:#new-mischiefurl-options
[.fromWacz(zipPath)]:#mischieffromwaczzippath
[.addGeneratedExchange(url, httpHeaders, body, isEntryPoint, description)]:#mischiefaddgeneratedexchangeurl-httpheaders-body-isentrypoint-description
[.capture()]:#mischiefcapture
[.extractGeneratedExchanges()]:#mischiefextractgeneratedexchanges
[.filterUrl(url)]:#mischieffilterurlurl
[.setup()]:#mischiefproxysetup
[.teardown()]:#mischiefproxyteardown
[.toWacz(\[includeRaw\], signingServer)]:#mischieftowaczincluderaw-signingserver
[.toWarc()]:#mischieftowarc
[new MischiefExchange(\[props\])]:#new-mischiefexchangeprops
[new MischiefGeneratedExchange(\[props\])]:#new-mischiefgeneratedexchangeprops
[new MischiefIntercepter(capture)]:#new-mischiefinterceptercapture
[.checkAndEnforceSizeLimit()]:#mischiefproxycheckandenforcesizelimit
[.checkExchangeForNoArchive(exchange)]:#mischiefproxycheckexchangefornoarchiveexchange
[.checkRequestAgainstBlocklist(session)]:#mischiefproxycheckrequestagainstblocklistsession
[.getOrInitExchange(id, type)]:#mischiefproxygetorinitexchangeid-type
[.intercept(type, data, session)]:#mischiefproxyintercepttype-data-session
[new MischiefProxyExchange(\[props\])]:#new-mischiefproxyexchangeprops
[.mischiefToWacz(capture, \[includeRaw\], signingServer)]:#exportersmischieftowaczcapture-includeraw-signingserver
[.mischiefToWarc(capture)]:#exportersmischieftowarccapture
[.filterOptions(newOptions)]:#optionsfilteroptionsnewoptions

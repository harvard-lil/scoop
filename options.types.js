/**
 * Available options and defaults for Scoop.
 * @typedef {Object} ScoopOptions
 * @property {("silent" | "trace" | "debug" | "info" | "warn" | "error")} logLevel="info" - Determines the logging level of this instance. See {@link https://github.com/pimterry/loglevel} for more information.
 *
 * @property {boolean} screenshot=true - Should Scoop try to make a screenshot? Screenshot will be added as `file:///screenshot.png` in the exchanges list.
 * @property {boolean} pdfSnapshot=false - Should Scoop save a PDF of the rendered page? Only available in headless mode. Added as `file:///pdf-snapshot.pdf` in the exchanges list.
 * @property {boolean} domSnapshot=false - Should Scoop save a snapshot of the rendered DOM? Added as `file:///dom-snapshot.html` in the exchanges list.
 * @property {boolean} captureVideoAsAttachment=true - Should Scoop try to sae the main video(s) present on this page? Added as `file://` attachments, summarized under `file:///video-extracted-summary.html`. This capture happens out of the browser.
 * @property {boolean} provenanceSummary=true - If `true`, information about the capture process (public IP address, User Agent, software version ...) will be gathered and summarized under `file:///provenance-summary.html`. WACZ exports will also hold that information at `datapackage.json` level, under `extras`.
 *
 * @property {number} captureTimeout=60000 - How long should Scoop wait for all steps in the capture to complete, in ms?
 * @property {number} loadTimeout=20000 - How long should Scoop wait for the page to load, in ms?
 * @property {number} networkIdleTimeout=20000 - How long should Scoop wait for network events to complete, in ms.
 * @property {number} behaviorsTimeout=20000 - How long should Scoop wait for media to play, secondary resources, and site specific behaviors (in total), in ms?
 * @property {number} captureVideoAsAttachmentTimeout=30000 - How long should Scoop wait for `captureVideoAsAttachment` to finish.
 *
 * @property {number} captureWindowX=1600 - Browser window resolution in pixels: X axis.
 * @property {number} captureWindowY=900 - Browser window resolution in pixels: Y axis.
 *
 * @property {number} maxCaptureSize=209715200 - Maximum size, in bytes, for the exchanges list. Scoop stop intercepting exchanges at this threshold.
 *
 * @property {boolean} autoScroll=true - Should Scoop try to scroll through the page?
 * @property {boolean} autoPlayMedia=true - Should Scoop try to autoplay `<audio>` and `<video>` tags?
 * @property {boolean} grabSecondaryResources=true - Should Scoop try to download img srcsets and secondary stylesheets?
 * @property {boolean} runSiteSpecificBehaviors=true - Should Scoop run site-specific capture behaviors? (via: browsertrix-behaviors)
 *
 * @property {boolean} headless=true - Should Playwright run in headless mode?
 * @property {string} userAgentSuffix="" - String to append to the user agent.
 *
 * @property {string[]} blocklist - A list of patterns, to be matched against each request's URL and IP address, and subsequently blocked during capture. Valid entries include url strings, CIDR strings, and regular expressions in string form.
 * @property {string} intercepter="ScoopProxy" - Network interception method to be used. Available at the moment: "ScoopProxy".
 * @property {string} proxyHost="localhost" - What host should Playwright proxy through for capture?
 * @property {number} proxyPort=9000 - What port should Playwright proxy through for capture?
 * @property {boolean} proxyVerbose=false - Should log entries from the proxy be printed?
 *
 * @property {string} publicIpResolverEndpoint="https://icanhazip.com" - URL to be used to retrieve the client's public IP address for `provenanceSummary`. Endpoint requirements: must simply return a IPv4 or IPv6 address as text.
 * @property {string} ytDlpPath="./executables/yt-dlp" - Path to the yt-dlp executable to be used.
 */

/**
 * List all stylesheet browser script:
 * - Lists all `<link rel="stylesheet">` elements currently in the DOM.
 * - Grabs href from these elements / prepend them with current origin if needed. 
 * - Returns list of urls.
 * 
 * @returns {Promise<string[]>} List of URLs of the stylesheets that were found.
 */
export async function listAllStylesheets() {
  const urls = [];

  /** @type {NodeListOf<HTMLLinkElement>} */
  const links = document.querySelectorAll("link[rel='stylesheet']")

  for (let link of links) {
    let href = link.href;

    if (href && !href.startsWith("http") && !href.startsWith("blob")) {
      href = `${window.location.origin}${href[0] !== "/" ? "/" : ""}${href}`;
    }

    if (href) {
      urls.push(href);
    }
  }

  return urls;
}

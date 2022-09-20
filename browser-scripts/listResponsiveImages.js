/**
 * List all responsive images browser script:
 * - Lists `<img>` elements bearing the `srcset` attribute currently in the DOM.
 * - Tries to find urls in these attributes by splitting them by ` `.
 * - Appends current origin to url if necessary.
 * - Returns list of urls.
 *
 * @returns {Promise<string[]>} List of URLs of the images that were found.
 */
export async function listResponsiveImages() {
  const urls = [];

  /** @type {NodeListOf<HTMLImageElement>} */
  const imgs = document.querySelectorAll("img[srcset]");

  for (let img of imgs) {
    for (let fragment of img.srcset.split(" ")) {
      let src = "";

      if (
        !fragment ||
        !fragment.includes("/") ||
        !fragment.includes(".") ||
        fragment.startsWith("blob") ||
        fragment.startsWith("data")
      ) {
        continue;
      }

      if (!fragment.startsWith("http")) {
        src += `${window.location.origin}`;
      }

      if (fragment[0] !== "/") {
        src += "/";
      }

      src += fragment;

      urls.push(src);
    }
  }

  return urls;
}

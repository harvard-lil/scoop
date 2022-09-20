/**
 * List all media sources browser script:
 * - Lists all audio and video sources currently in the DOM.
 * - Grabs src from these elements / prepend them with current origin if needed. 
 * - Returns list of urls.
 * 
 * @returns {Promise<string[]>} List of URLs of the medias that were found.
 */
export async function listMediaSources() {
  const urls = [];

  /** @type {NodeListOf<HTMLSourceElement|HTMLMediaElement>} */
  const medias = document.querySelectorAll("audio, video, audio source, video source");

  for (let media of medias) {
    let src = media.src;

    if (src && !src.startsWith("http") && !src.startsWith("blob")) {
      src = `${window.location.origin}${src[0] !== "/" ? "/" : ""}${src}`;
    }

    if (src) {
      urls.push(src);
    }
  }

  return urls;
}
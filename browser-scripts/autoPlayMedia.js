/**
 * Auto play media browser script: 
 * - Grabs all `<audio>` and `<video>` elements currently in the DOM and plays them.
 * - Returns the duration in milliseconds of the longest media.
 * 
 * @returns {Promise<number>} Duration of the longest media in milliseconds.
 */
export async function autoPlayMedia() {
  let maxDuration = 0;

  /** @type {NodeListOf<HTMLMediaElement>} */
  const medias = document.querySelectorAll("audio, video");

  for (let media of medias) {
    media.play();

    if (media.duration > maxDuration) {
      maxDuration = media.duration;
    }
  }

  return maxDuration * 1000;
}

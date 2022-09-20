/**
 * Auto scroll browser script: 
 * - Request a 100px scroll every 25ms, up to the current document height.
 */
export async function autoScroll() {
  for (let i = 0; i < document.body.scrollHeight; i += 100) {
    window.scrollTo(0, i);
    await new Promise(resolve => setTimeout(resolve, 25));
  }
}
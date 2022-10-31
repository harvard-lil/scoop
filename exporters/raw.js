import * as exporters from "../exporters/index.js";

export async function raw(capture) {
  const files = capture.exchanges.map((exchange) => {
    return ['request', 'response'].map((type) => {
      return {
        path: `raw/${type}_${exchange.date.toISOString()}_${exchange.id}`,
        data: exchange[`${type}Raw`]
      }
    })
  }).flat().filter(ex => ex.data);

  return await exporters.wacz(capture, files);
}

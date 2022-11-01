import * as exporters from "../exporters/index.js";

export async function mischiefToHDWacz(capture) {
  const files = capture.exchanges.reduce((accumulator, exchange) => {
    ['request', 'response'].forEach((type) => {
      const data = exchange[`${type}Raw`];
      if(data){
        accumulator.push({
          path: `raw/${type}_${exchange.date.toISOString()}_${exchange.id}`,
          data: data
        })
      }
    })
    return accumulator;
  }, [])

  return await exporters.mischiefToWacz(capture, files);
}

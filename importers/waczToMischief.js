import path from "path";
import StreamZip from "node-stream-zip";
import { Mischief } from "../Mischief.js";
import { MischiefProxyExchange } from "../exchanges/MischiefProxyExchange.js";

export async function waczToMischief(zipPath) {
  const zip = new StreamZip.async({ file: zipPath });
  const entries = await zip.entries();
  const pageJSON = await getPageJSON(zip);

  const capture = new Mischief(pageJSON.url);
  Object.assign(capture, {
    id: pageJSON.id,
    startedAt: new Date(pageJSON.ts),
    exchanges: await getExchanges(zip, entries)
  })

  await zip.close();
  return capture;
}

const getPageJSON = async (zip) => {
  const data = await zip.entryData('pages/pages.jsonl');
  return data.toString().split('\n').map(JSON.parse)[1];
}

const getExchanges = async (zip, entries) => {
  const props = await Promise.all(
    Object.values(entries)
    // only entries in the raw folder
      .filter(({name}) => path.dirname(name) == 'raw')
    // get the data from the zip and shape it for exchange initialization
      .map(async ({name}) => {
        const [type, date, id] = path.basename(name).split('_');
        return {
          id,
          date: new Date(date),
          [`${type}Raw`]: await zip.entryData(name)
        };
      })
  );

  const exchanges =
        // sort based on id to order responses next to their requests
        props.sort(({id}, {id: id2}) => id.localeCompare(id2))
        // combine requests and responses
        .reduce((accumulator, curr) => {
          const prev = accumulator[accumulator.length - 1];
          if(prev && prev.id == curr.id){
            Object.assign(prev, curr);
          } else {
            accumulator.push(new MischiefProxyExchange(curr));
          }
          return accumulator;
        }, [])

  return exchanges;
}

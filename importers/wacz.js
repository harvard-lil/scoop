import path from "path";
import StreamZip from "node-stream-zip";
import { MischiefProxyExchange } from "../exchanges/MischiefProxyExchange.js";

export async function wacz(zipPath) {
  const zip = new StreamZip.async({ file: zipPath });
  const entries = await zip.entries();
  const props = await Promise.all(
    Object.values(entries)
      // only entries in the raw folder
      .filter(({name}) => path.dirname(name) == 'raw')
      // get the data from the zip and shape it for exchange initialization
      .map(async ({name}) => {
        const [type, date, id] = path.basename(name).split('_');
        return { id, date: new Date(date), [`${type}Raw`]: await zip.entryData(name) };
      })
  );

  await zip.close();

  return props
         // sort based on id to order responses next to their requests
         .sort(({id}, {id: id2}) => id.localeCompare(id2))
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
}

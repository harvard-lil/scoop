import path from "path";
import StreamZip from "node-stream-zip";
import { Readable } from "stream";
import { Mischief } from "../Mischief.js";
import { MischiefProxyExchange } from "../exchanges/MischiefProxyExchange.js";
import { WARCParser } from "warcio";

/**
 * Reconstructs a Mischief capture from a WACZ
 * containing raw http traffic data.
 *
 * @param {string} zipPath - path to the zipped WACZ
 * @returns {Promise<Mischief>} - a reconstructred Mischief capture object
 */
export async function waczToMischief(zipPath) {
  const zip = new StreamZip.async({ file: zipPath });
  const pageJSON = await getPageJSON(zip);

  const capture = new Mischief(pageJSON.url);
  Object.assign(capture, {
    id: pageJSON.id,
    startedAt: new Date(pageJSON.ts),
    exchanges: await getExchanges(zip)
  })

  await zip.close();
  return capture;
}

/**
 * Retrieves the pages.jsonl data from the WARC and parses it
 *
 * @param {StreamZipAsync} zip
 * @returns {object[]} - an array of page entry objects
 */
const getPageJSON = async (zip) => {
  const data = await zip.entryData('pages/pages.jsonl');
  return data.toString().split('\n').map(JSON.parse)[1];
}


/**
 * Retrieves the raw requests and responses and initializes
 * them into MischiefProxyExchanges
 *
 * @param {StreamZipAsync} zip
 * @returns {MischiefProxyExchange[]} - an array of reconstructed MischiefProxyExchanges
 */
const getExchanges = async (zip) => {
  const entries = Object.values(await zip.entries());

  // warc records will be mapped to their payload digests as keys
  const warcEntries = {};
  // we want all of the warcs in the archive directory.
  // TODO: does the warc parser need any special handling for GZIPed warcs?
  const archiveEntries = entries.filter(({name}) => name.match(/^archive\//));

  for (const {name} of archiveEntries) {
    const zipData = await zip.entryData(name);
    const warc = new WARCParser(Readable.from(zipData));
    for await (const record of warc) {
      // while it would be better to read the payload later,
      // at the point that it's actually matched with a raw entry that needs hydrating,
      // this breaks the way warcio reads records and results in an emtpy result
      warcEntries[record.warcHeader('WARC-Payload-Digest')] = await record.readFully(false);
    }
  }

  const props = await Promise.all(
    entries
    // only entries in the raw folder
      .filter(({name}) => path.dirname(name) == 'raw')
    // get the data from the zip and shape it for exchange initialization
      .map(async ({name}) => {
        const [type, date, id, warcPayloadDigest] = path.basename(name).split('_');
        const buffers = [await zip.entryData(name)];
        // if the file name contains a warc payload digest and there's a matching
        // record from the warc file, append it to the headers
        if(warcEntries[warcPayloadDigest]) {
          buffers.push(warcEntries[warcPayloadDigest]);
        }

        return {
          id,
          date: new Date(date),
          [`${type}Raw`]: Buffer.concat(buffers)
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

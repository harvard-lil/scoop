import path from "path";
import { URL } from "url";
import StreamZip from "node-stream-zip";
import { Readable } from "stream";
import { Mischief } from "../Mischief.js";
import { MischiefProxyExchange, MischiefGeneratedExchange } from "../exchanges/index.js";
import { WARCParser } from "warcio";
import { versionFromStatusLine } from "../parsers/MischiefHTTPParser.js"

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
  const {exchanges, generatedExchanges} = await getExchanges(zip);

  const capture = new Mischief(pageJSON.url);
  Object.assign(capture, {
    id: pageJSON.id,
    startedAt: new Date(pageJSON.ts),
    exchanges,
    generatedExchanges
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
  const zipEntries = await zip.entries();
  const zipDirs = Object.keys(zipEntries).reduce((acc, name) => {
    const dir = path.dirname(name);
    acc[dir] ||= []
    acc[dir].push(name)
    return acc;
  }, {})

  const warcEntriesByDigest = {};
  const generatedExchanges = {};
  const rawPayloadDigests = zipDirs.raw.map(name => path.basename(name).split('_')[3])
                                       .filter(digest => digest)


  // TODO: does the warc parser need any special handling for GZIPed warcs?
  for (const name of zipDirs.archive) {
    const zipData = await zip.entryData(name);
    const warc = new WARCParser(Readable.from(zipData));

    for await (const record of warc) {
      // get data for rehydrating regular exchanges
      const digest = record.warcHeader('WARC-Payload-Digest')
      if(rawPayloadDigests.includes(digest)){
        warcEntriesByDigest[digest] = await record.readFully(false);
      }

      // get data for rehydrating generated exchanges
      const url = record.warcHeader('WARC-Target-URI');
      if(url && (new URL(url)).protocol == 'file:') {
        const [versionMajor, versionMinor] = versionFromStatusLine(record.httpHeaders.statusline);
        const {status, statusText, headers} = record.getResponseInfo()
        generatedExchanges[url] = new MischiefGeneratedExchange({
          description: record.warcHeaders.headers.get('description'),
          response: {
            url,
            versionMajor,
            versionMinor,
            headers: Object.fromEntries(headers),
            statusCode: status,
            statusMessage: statusText,
            body: await record.readFully(false),
          },
        });
      }
    }
  }

  const regExchangeProps = await Promise.all(
    zipDirs.raw
    // get the data from the zip and shape it for exchange initialization
      .map(async (name) => {
        const [type, date, id, warcPayloadDigest] = path.basename(name).split('_');
        const buffers = [await zip.entryData(name)];
        // if the file name contains a warc payload digest and there's a matching
        // record from the warc file, append it to the headers
        if(warcEntriesByDigest[warcPayloadDigest]) {
          buffers.push(warcEntriesByDigest[warcPayloadDigest]);
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
        regExchangeProps.sort(({id}, {id: id2}) => id.localeCompare(id2))
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

  return {exchanges, generatedExchanges};
}

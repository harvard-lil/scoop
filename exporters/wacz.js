import * as path from "path";
import { mkdtemp, mkdir, readFile, writeFile, rm } from "fs/promises";
import { tmpdir } from "os";
import { v4 as uuidv4 } from "uuid";
import { spawn  } from "child_process";

import { Mischief } from "../Mischief.js";

/**
 * Mischief to WACZ converter.
 *
 * Note:
 * - Logs are added to capture object via `Mischief.addToLogs()`.
 *
 * @param {Mischief} capture
 * @returns {Promise<ArrayBuffer>}
 */
export async function wacz(capture) {
  if (!capture instanceof Mischief || !capture.state == Mischief.states.COMPLETE) {
    throw new Error("`capture` must be a complete Mischief object.");
  }
  const warc = await capture.toWarc();
  const pagesData = [{"format": "json-pages-1.0", "id": "pages", "title": "All Pages", hasText: false},
                     {id: uuidv4(), url: capture.url, title: "", seed: true}].map(JSON.stringify).join('\n');

  let tmpDir;
  const appPrefix = 'mischief';
  try {
    const tmpDir = await mkdtemp(path.join(tmpdir(), appPrefix));
    const pagesFile = path.join(tmpDir, 'pages.jsonl')
    const warcFile = path.join(tmpDir, 'warc.warc');

    await writeFile(pagesFile, pagesData);
    await writeFile(warcFile, Buffer.from(warc));

    const waczFile = path.join(tmpDir, 'wacz.wacz');
    const createArgs = ["create", "--split-seeds", "-o", waczFile, "--pages", pagesFile, warcFile];
    await awaitProcess(spawn("wacz" , createArgs, {stdio: "inherit"}));

    return await readFile(waczFile);
  }
  catch(e) {
    console.error(e);
  }
  finally {
    try {
      if (tmpDir) {
        await rm(tmpDir, { recursive: true });
      }
    }
    catch (e) {
      console.error(`An error has occurred while removing the temp folder at ${tmpDir}. Please remove it manually. Error: ${e}`);
    }
  }
};

const awaitProcess = (proc) => {
  return new Promise((resolve) => {
    proc.on("close", (code) => resolve(code));
  });
};

// [!] Example file -- to be deleted at earliest convenience.
import crypto from "crypto";
import fs from "fs";
import { Mischief } from "./Mischief.js";

const toCapture = [
  {name: "lil", url: "https://lil.law.harvard.edu"},
  {name: "partytronic", url: "https://partytronic.com/"},
  {name: "cnn", url: "https://www.cnn.com/2022/08/23/tech/twitter-foreign-intel-problem/index.html"},
  {name: "youtube-stream", url: "https://www.youtube.com/watch?v=jfKfPfyJRdk"},
  {name: "twitter-video", url: "https://twitter.com/dog_rates/status/1298052245209006086?s=20"},
  {name: "youtube-video", url: "https://www.youtube.com/watch?v=zVz1SAtdw8A"},
  {name: "cern", url: "http://info.cern.ch/hypertext/WWW/TheProject.html"},
  {name: "sumo", url: "https://www.sumo.or.jp/EnSumoDataRikishi/profile/3761"},
  {name: "covid-uk", url: "https://www.gov.uk/coronavirus"},
  {name: "facebook-post", url: "https://www.facebook.com/1074538035934151/posts/3646788408709088"},
  {name: "tiktok", url: "https://www.tiktok.com/@wbznewsradio/video/7110266333144583466"},
  {name: "instagram-video", url: "https://www.instagram.com/reel/CguYHRlAKVX/"}
];

const path = "./examples/";

try {
  fs.mkdirSync(path);
}
catch(err) {
}

for (let entry of toCapture) {
  let {name, url} = entry;
  const filename = `${path}${name}.warc`;

  const myCapture = new Mischief(url);
  await myCapture.capture();
  
  const warc = await myCapture.toWarc();
  fs.writeFileSync(filename, Buffer.from(warc));

  console.log(`💾 Saved ${url} as ${filename}`);
}
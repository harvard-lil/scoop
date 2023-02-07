// [!] Example file -- to be deleted at earliest convenience.
import { mkdir, writeFile } from 'fs/promises'
import { Mischief } from './Mischief.js'

const toCapture = [
  { name: 'chrome-update', url: 'http://update.googleapis.com/service/update2/json?cup2key=12:EhHNMQsbmQEJvI_P7gxZrdMKErBWF-wj-U6U8Mi83co&cup2hreq=1338f1651449d867f560f6fd72886fa074753bf76320d7864159e993fc33527b' },
  { name: 'lil', url: 'https://lil.law.harvard.edu' },
  { name: 'example-http', url: 'http://example.com' },
  { name: 'example-https', url: 'https://example.com' },
  { name: 'df', url: 'https://daringfireball.net' },
  { name: 'nyt', url: 'https://www.nytimes.com' },
  { name: 'present-studio', url: 'https://www.presentstudio.co/' },
  { name: 'partytronic', url: 'https://partytronic.com/' },
  { name: 'cnn', url: 'https://www.cnn.com/2022/08/23/tech/twitter-foreign-intel-problem/index.html' },
  { name: 'youtube-stream', url: 'https://www.youtube.com/watch?v=jfKfPfyJRdk' },
  { name: 'twitter-profile', url: 'https://twitter.com/macargnelutti' },
  { name: 'twitter-video', url: 'https://twitter.com/dog_rates/status/1298052245209006086?s=20' },
  { name: 'twitter-multi-video', url: 'https://twitter.com/dog_rates/status/1599117227323961344' },
  { name: 'youtube-video', url: 'https://www.youtube.com/watch?v=zVz1SAtdw8A' },
  { name: 'cern', url: 'http://info.cern.ch/hypertext/WWW/TheProject.html' },
  { name: 'sumo', url: 'https://www.sumo.or.jp/EnSumoDataRikishi/profile/3761' },
  { name: 'covid-uk', url: 'https://www.gov.uk/coronavirus' },
  { name: 'facebook-post', url: 'https://www.facebook.com/1074538035934151/posts/3646788408709088' },
  { name: 'tiktok', url: 'https://www.tiktok.com/@wbznewsradio/video/7110266333144583466' },
  { name: 'instagram-video', url: 'https://www.instagram.com/reel/CguYHRlAKVX/' }
]

const path = './examples/'

try {
  await mkdir(path)
} catch (_err) { }

for (const entry of toCapture) {
  const { name, url } = entry

  const myCapture = new Mischief(url)
  await myCapture.capture()

  for (const format of ['warc', 'wacz']) {
    let data = null
    const filename = `${path}${name}.${format}`

    switch (format) {
      case 'wacz':
        data = await myCapture.toWacz(true, { url: 'https://authsign.lil.tools/sign' })
        break

      case 'warc':
      default:
        data = await myCapture.toWarc()
        break
    }

    await writeFile(filename, Buffer.from(data))
    console.log(`💾 Saved ${url} as ${filename}`)
  }
}

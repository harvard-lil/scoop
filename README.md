# mischief
🥸 Experimental single-page web archiving library using Playwright. 

![](mischief.png)

```javascript
import { Mischief, MischiefOptions } from "mischief";

const myCapture = new Mischief("https://example.com", { blocklist: [/unsafedomain.com/, ...MischiefOptions.default.blocklist] });
await myCapture.capture();
const myArchive = await myCapture.toWarc();
```

> 🚧 Work in progress.

---

## Local setup
- Requires [Node 18.9.0+](https://nodejs.org/en/) and [Python 3](https://www.python.org/). 
- At the moment `Mischief` can only operate in Unix-like environment _(Linux, Mac OS, Windows' WSL ...)_
- Install dependencies: `npm install`
- Get started by having a look and running `example.js`

## Optional dependencies
- [Ghostscript](https://www.ghostscript.com/) for PDF compression.

## Testing
``` javascript
node --test
```

# mischief
🥸 Experimental single-page web archiving solution using Playwright.

![](mischief.png)

```javascript
import { Mischief } from "mischief";

const myCapture = new Mischief("https://example.com");
await myCapture.capture();
const myArchive = await myCapture.toWarc();
```

> 🚧 Work in progress.

---

## Local setup
- Requires [Node 18+](https://nodejs.org/en/)
- Install dependencies: `npm install`
- You may need to install Playwright manually: `npm i -D playwright`
- Get started by having a look and running `example.js`

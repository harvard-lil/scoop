# mischief
🥸 Experimental single-page web archiving solution using Playwright.

![](mischief.png)

```javascript
import { Mischief } from "mischief";

const myCapture = new Mischief("https://example.com");
await myCapture.capture();
const myArchive = await myCapture.toWarc(gzip=true);
```

> 🚧 Work in progress.

---

## Local setup
- Requires [Node 18+](https://nodejs.org/en/)
- Install dependencies: `npm install`
- You may need to install Playwright manually: `npm i -D playwright`
- Get started by having a look and running `example.js`

> ⚠️ Temporary: You may need to have [a public key configured on GitHub](https://docs.github.com/en/authentication/connecting-to-github-with-ssh/testing-your-ssh-connection) to install some of the dependencies of this project.
> We expect this problem to be resolved shortly. 
import { MischiefIntercepter } from './MischiefIntercepter.js';
import { MischiefProxyExchange } from '../exchanges/index.js';
import ProxyServer from "transparent-proxy";

export class MischiefProxy extends MischiefIntercepter {

  #connection

  exchanges = [];

  async setup() {
    this.#connection = new ProxyServer({
      intercept: true,
      verbose: this.options.proxyVerbose,
      injectData: (data, session) => this.intercept("request", data, session),
      injectResponse: (data, session) => this.intercept("response", data, session)
    });

    await this.#connection.listen(this.options.proxyPort, this.options.proxyHost, () => {
      this.capture.addToLogs(`TCP-Proxy-Server started ${JSON.stringify(this.#connection.address())}`);
    });

    // Arbitrary 250ms wait (fix for observed start up bug)
    await new Promise(resolve => setTimeout(resolve, 250));
  }

  teardown() {
    this.#connection.close()
  }

  get contextOptions() {
    return {
      proxy: { server: `http://${this.options.proxyHost}:${this.options.proxyPort}` },
      ignoreHTTPSErrors: true,
    };
  }

  /**
   * Returns an exchange based on the session id and type ("request" or "response").
   * If the type is a request and there's already been a response on that same session,
   * create a new exchange. Otherwise append to continue the exchange.
   *
   * @param {string} id
   * @param {string} type
   */
  getOrInitExchange(id, type) {
    // TODO: For loop-ify for clarity and maintainability?
    return (
      this.exchanges.findLast((ex) => {
        return ex.id == id && (type == "response" || !ex.responseRaw);
      }) || this.exchanges[this.exchanges.push(new MischiefProxyExchange({ id: id })) - 1]
    );
  }

  /**
   * Collates network data (both requests and responses) from the proxy.
   * Capture size enforcement happens here.
   *
   * @param {string} type
   * @param {Buffer} data
   * @param {Session} session
   */
  intercept(type, data, session) {
    const ex = this.getOrInitExchange(session._id, type);
    const prop = `${type}Raw`; // `responseRaw` | `requestRaw`
    ex[prop] = ex[prop] ? Buffer.concat([ex[prop], data], ex[prop].length + data.length) : data;
    this.byteLength += data.byteLength;
    this.checkAndEnforceSizeLimit(); // From parent
    return data;
  }
}

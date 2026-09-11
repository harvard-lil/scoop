import dns from 'node:dns/promises'
import http from 'node:http'
import https from 'node:https'
import net from 'node:net'
import { Address6 } from '@laverdet/beaugunderson-ip-address'
import { castBlocklistMatcher, searchBlocklistFor } from './blocklist.js'

// Node 20.9 updated Undici's default User-Agent from "undici" to "node".
const [nodeMajor, nodeMinor] = process.versions.node.split('.').map(Number)
const headUserAgent = nodeMajor === 20 && nodeMinor < 9 ? 'undici' : 'node'

export class NetworkPolicyError extends Error {
  constructor (message) {
    super(message)
    this.code = 'ERR_NETWORK_POLICY'
  }
}

export function normalizeAddress (address) {
  const value = address.replace(/^\[|\]$/g, '')
  if (net.isIP(value) !== 6) return value
  const parsed = new Address6(value)
  // Match mapped addresses against IPv4 rules as well as their IPv6 form.
  if (parsed.isInSubnet(new Address6('::ffff:0:0/96'))) return parsed.to4().correctForm()
  return parsed.correctForm()
}

function waitForLookup (promise, signals) {
  return new Promise((resolve, reject) => {
    const listeners = new Map()
    const cleanup = () => {
      for (const [signal, listener] of listeners) signal.removeEventListener('abort', listener)
    }
    for (const signal of signals.filter(Boolean)) {
      const abort = () => { cleanup(); reject(signal.reason) }
      if (signal.aborted) { abort(); break }
      listeners.set(signal, abort)
      signal.addEventListener('abort', abort, { once: true })
    }
    // Observe the underlying OS lookup even if its consumer has been cancelled.
    promise.then(value => { cleanup(); resolve(value) }, error => { cleanup(); reject(error) })
  })
}

/** Check the destination before connecting, and pin that connection to its approved IP. */
export class NetworkPolicy {
  constructor (blocklist, onDenied = () => {}, { lookup = dns.lookup } = {}) {
    this.rules = blocklist.slice()
    this.matchers = this.rules.map(castBlocklistMatcher)
    this.onDenied = onDenied
    this.lookup = lookup
    this.controller = new AbortController()
  }

  close () { this.controller.abort(new NetworkPolicyError('Network policy closed')) }

  matchingRule (...values) {
    return this.matchers.findIndex(searchBlocklistFor(...values))
  }

  assertAllowed (...values) {
    const index = this.matchingRule(...values)
    if (index === -1) return
    const value = values.find(value => searchBlocklistFor(value)(this.matchers[index]))
    this.onDenied(value, this.rules[index])
    throw new NetworkPolicyError(`Blocked destination: ${value}`)
  }

  assertUrl (input) {
    this.controller.signal.throwIfAborted()
    const url = new URL(input)
    if (!['http:', 'https:'].includes(url.protocol)) {
      throw new NetworkPolicyError('Only HTTP(S) destinations are permitted')
    }
    if (url.port === '0') throw new NetworkPolicyError('Destination port must be between 1 and 65535')
    this.assertAllowed(url.href)
    const hostname = url.hostname.replace(/^\[|\]$/g, '')
    if (net.isIP(hostname)) this.assertAllowed(hostname, normalizeAddress(hostname))
    return url
  }

  async resolve (input, { signal } = {}) {
    signal?.throwIfAborted()
    const url = this.assertUrl(input)
    const hostname = url.hostname.replace(/^\[|\]$/g, '')
    const addresses = net.isIP(hostname)
      ? [{ address: hostname, family: net.isIP(hostname) }]
      : await waitForLookup(this.lookup(hostname, { all: true, order: 'ipv4first' }), [signal, this.controller.signal])
    signal?.throwIfAborted()
    this.controller.signal.throwIfAborted()
    if (!addresses.length) throw new NetworkPolicyError('Destination has no addresses')
    // A mixed DNS answer can still be reached through an allowed address.
    const selected = addresses.find(({ address }) => this.matchingRule(address, normalizeAddress(address)) === -1)
    if (!selected) this.assertAllowed(addresses[0].address, normalizeAddress(addresses[0].address))
    const { address, family } = selected
    return {
      url,
      hostname,
      address,
      family,
      signal: this.controller.signal,
      lookup: (_hostname, options, callback) => {
        // Match dns.lookup's asynchronous contract. A synchronous connection
        // error can destroy a TLS socket before tls.connect finishes setup.
        queueMicrotask(() => {
          if (this.controller.signal.aborted) { callback(this.controller.signal.reason); return }
          if (options?.all) callback(null, [{ address, family }])
          else callback(null, address, family)
        })
      }
    }
  }

  verifyPeer (socket, destination) {
    if (normalizeAddress(socket.remoteAddress || '') !== normalizeAddress(destination.address)) {
      socket.destroy()
      throw new NetworkPolicyError('Connected peer differs from approved destination')
    }
    try {
      this.controller.signal.throwIfAborted()
      this.assertAllowed(socket.remoteAddress, normalizeAddress(socket.remoteAddress))
    } catch (error) {
      socket.destroy()
      throw error
    }
  }
}

/** The unrecorded metadata HEAD, with destination checks on every redirect. */
export async function fetchHead (input, policy, { signal } = {}) {
  let url = input
  for (let redirects = 0; ; redirects++) {
    const destination = await policy.resolve(url, { signal })
    policy.controller.signal.throwIfAborted()
    signal?.throwIfAborted()
    // Match fetch's rejection of embedded credentials on this metadata path.
    if (destination.url.username || destination.url.password) throw new TypeError('HEAD URL must not contain credentials')
    const response = await new Promise((resolve, reject) => {
      const request = (destination.url.protocol === 'https:' ? https : http).request(destination.url, {
        method: 'HEAD',
        agent: false,
        lookup: destination.lookup,
        family: destination.family,
        signal,
        // Retain fetch's HEAD defaults on the supported Node lines. This request is unrecorded.
        headers: {
          host: destination.url.host,
          connection: 'close',
          accept: '*/*',
          'accept-language': '*',
          'sec-fetch-mode': 'cors',
          'user-agent': headUserAgent,
          'accept-encoding': destination.url.protocol === 'https:' ? 'br, gzip, deflate' : 'gzip, deflate'
        }
      }, response => {
        response.resume()
        resolve(response)
      })
      const closed = () => request.destroy(policy.controller.signal.reason)
      policy.controller.signal.addEventListener('abort', closed, { once: true })
      request.on('close', () => policy.controller.signal.removeEventListener('abort', closed))
      request.on('socket', socket => socket.once('connect', () => {
        try { policy.verifyPeer(socket, destination) } catch (error) { request.destroy(error) }
      }))
      request.on('error', reject)
      request.end()
    })
    const location = response.headers.location
    if ([301, 302, 303, 307, 308].includes(response.statusCode) && location !== undefined) {
      if (redirects >= 20) throw new NetworkPolicyError('Too many redirects')
      url = new URL(location, destination.url)
      continue
    }
    return { url: destination.url.href, status: response.statusCode, headers: new Headers(response.headers) }
  }
}

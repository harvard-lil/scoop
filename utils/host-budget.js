/**
 * Calls `attempt(host, remainingMs)` once for each distinct https host among
 * `urls`, in order, sharing one time budget between them.
 *
 * Each attempt is given what is left of the budget, so a caller that enforces
 * it keeps the whole loop within `budgetMs`. A host is attempted once whether
 * or not its attempt succeeds. An attempt that throws is passed to `onError`
 * and does not stop the loop.
 *
 * @param {Iterable<string>} urls
 * @param {number} budgetMs
 * @param {(host: string, remainingMs: number) => Promise<void>} attempt
 * @param {{onError?: (host: string, err: Error) => void, now?: () => number}} [options]
 * @returns {Promise<void>} Rejects if the budget runs out before every host was attempted.
 */
export async function forEachHttpsHostWithinBudget (urls, budgetMs, attempt, { onError = () => {}, now = Date.now } = {}) {
  const deadline = now() + budgetMs
  const attempted = new Set()

  for (const input of urls) {
    const url = new URL(input)

    if (url.protocol !== 'https:' || attempted.has(url.host)) {
      continue
    }

    const remaining = deadline - now()
    if (remaining <= 0) {
      throw new Error('Time budget reached')
    }

    attempted.add(url.host)

    try {
      await attempt(url.host, remaining)
    } catch (err) {
      onError(url.host, err)
    }
  }
}

import { readFileSync } from 'node:fs'

const TOXIPROXY_URL = process.env.TOXIPROXY_URL ?? 'http://localhost:8474'
const PROXIES = JSON.parse(
  readFileSync(
    new URL('../../docker/toxiproxy/proxies.json', import.meta.url),
    'utf8'
  )
)

// Client for Toxiproxy's HTTP API, built on a Playwright APIRequestContext.
// Proxy names come from docker/toxiproxy/proxies.json.
export class Toxiproxy {
  static url = TOXIPROXY_URL

  constructor(api) {
    this.api = api
  }

  async #post(path, data) {
    const response = await this.api.post(path, { data })
    if (!response.ok()) {
      throw new Error(
        `Toxiproxy POST ${path} returned ${response.status()}: ${await response.text()}`
      )
    }
  }

  // Connections are refused until reset() — the dependency is unreachable.
  async takeDown(proxy) {
    await this.#post(`/proxies/${proxy}`, { enabled: false })
  }

  // Connections are accepted but no data passes in either direction until
  // reset() — the dependency is connected and never answers. A timeout of 0
  // means the toxic never closes the connection itself.
  async hang(proxy) {
    for (const stream of ['downstream', 'upstream']) {
      await this.#post(`/proxies/${proxy}/toxics`, {
        name: `hang-${stream}`,
        type: 'timeout',
        stream,
        attributes: { timeout: 0 }
      })
    }
  }

  // Sends the proxy's traffic to another service, such as the busy backend or
  // the pending uploader in compose.resilience.yml, until reset().
  async pointAt(proxy, upstream) {
    await this.#post(`/proxies/${proxy}`, { upstream })
  }

  // Re-enables every proxy, removes every toxic and points every proxy back at
  // its upstream in proxies.json. Toxiproxy's own reset leaves upstreams alone.
  async reset() {
    await this.#post('/reset')
    for (const { name, upstream } of PROXIES) {
      await this.#post(`/proxies/${name}`, { upstream })
    }
  }
}

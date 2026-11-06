import pg from 'pg'
import { Redis } from 'ioredis'
import { chromium } from '@playwright/test'
import { registerAndLogin } from '../setup/auth.setup.js'

// Direct access to the stack's Postgres and Redis for the resilience tests,
// through the test-postgres and test-redis proxies in
// docker/toxiproxy/proxies.json. Those proxies are never faulted, so a test can
// still reach a dependency it has failed for the service.
const POSTGRES = {
  host: 'localhost',
  port: 25432,
  user: 'dev',
  password: 'dev',
  database: 'bng_metric_backend'
}
const REDIS = { host: 'localhost', port: 26379 }
const SESSION_KEY_PATTERN = 'bng-metric-frontend:*'

// Same mapping as test/setup/auth.setup.js: the sign-in pages redirect the
// browser to the identity stub by its compose service name.
const SIGN_IN_BROWSER_ARGS = [
  '--no-sandbox',
  '--host-resolver-rules=MAP cdp-defra-id-stub 127.0.0.1'
]

/**
 * Lock a project's row the way another user's save does, until the returned
 * function is called. The backend waits 5s for the lock (`lock_timeout`), then
 * gives up with a conflict.
 */
export async function lockProject(projectId) {
  const client = new pg.Client(POSTGRES)
  await client.connect()
  await client.query('BEGIN')
  await client.query('SELECT 1 FROM bng.projects WHERE id = $1 FOR UPDATE', [
    projectId
  ])
  return async () => {
    await client.query('ROLLBACK')
    await client.end()
  }
}

async function sessionKeys(redis) {
  const keys = []
  let cursor = '0'
  do {
    const [next, batch] = await redis.scan(
      cursor,
      'MATCH',
      SESSION_KEY_PATTERN,
      'COUNT',
      1000
    )
    keys.push(...batch)
    cursor = next
  } while (cursor !== '0')
  return keys
}

/**
 * Sign a new user in and return their browser state and the Redis key of their
 * server-side session. The shared STORAGE_STATE session must never be expired:
 * every later test in the run would be signed out.
 *
 * The key is found as the one session that appears during sign-in, which only
 * holds because the resilience suite runs on a single worker.
 */
export async function signInThrowawayUser(label) {
  const redis = new Redis(REDIS)
  const browser = await chromium.launch({ args: SIGN_IN_BROWSER_ARGS })
  try {
    const before = new Set(await sessionKeys(redis))
    const context = await browser.newContext()
    const page = await context.newPage()
    await registerAndLogin(page, `${label}-${Date.now()}@example.com`, {
      withBngCompleterRole: true
    })
    await page.waitForURL(/\/manage-projects|\/project-name/)
    const storageState = await context.storageState()

    const added = (await sessionKeys(redis)).filter((key) => !before.has(key))
    if (added.length !== 1) {
      throw new Error(
        `Expected one new session during sign-in, found ${added.length}`
      )
    }
    return { storageState, sessionKey: added[0] }
  } finally {
    await browser.close()
    redis.disconnect()
  }
}

async function editSignIn(sessionKey, edit) {
  const redis = new Redis(REDIS)
  try {
    const session = JSON.parse(await redis.get(sessionKey))
    edit(session.item.auth)
    await redis.set(sessionKey, JSON.stringify(session), 'KEEPTTL')
  } finally {
    redis.disconnect()
  }
}

/**
 * Make a session's sign-in expire and fail to renew: the token is past its
 * expiry and the identity provider rejects the refresh token. The frontend's
 * auth scheme catches this before any route handler runs.
 */
export async function expireSession(sessionKey) {
  await editSignIn(sessionKey, (auth) => {
    auth.user.exp = 1
    auth.refreshToken = 'invalid'
  })
}

/**
 * Leave a session's sign-in in date but make the backend reject its token, and
 * make the refresh fail too. The auth scheme lets the request through, so this
 * reaches a route handler's backend call (backend-request.js), which finds the
 * session dead and flags it as expired.
 */
export async function breakBackendToken(sessionKey) {
  await editSignIn(sessionKey, (auth) => {
    auth.idToken = 'invalid'
    auth.refreshToken = 'invalid'
  })
}

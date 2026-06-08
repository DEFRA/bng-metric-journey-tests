import path from 'path'
import { fileURLToPath } from 'url'

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../..'
)

export const runMode = process.env.RUN_MODE ?? 'local'
export const isCI = !!process.env.CI

const environment = process.env.ENVIRONMENT ?? 'dev'

const baseUrls = {
  local: 'http://localhost:3000',
  github: 'http://localhost:3000',
  e2e: `https://bng-metric-frontend.${environment}.cdp-int.defra.cloud`
}

export const baseUrl =
  runMode === 'e2e'
    ? baseUrls.e2e
    : (process.env.BASE_URL ?? baseUrls[runMode] ?? baseUrls.local)

export const STORAGE_STATE = path.join(
  projectRoot,
  'playwright/.auth/user.json'
)

export const NO_ROLE_STORAGE_STATE = path.join(
  projectRoot,
  'playwright/.auth/user-no-role.json'
)

export const NO_PROJECTS_STORAGE_STATE = path.join(
  projectRoot,
  'playwright/.auth/user-no-projects.json'
)

// Real Defra ID credentials for e2e mode — injected via the CDP Portal secret
// store (or a gitignored local .env). Required only when RUN_MODE=e2e.
export const defraIdUsername = process.env.DEFRA_ID_USERNAME
export const defraIdPassword = process.env.DEFRA_ID_PASSWORD

// Real Defra ID login in e2e mode produces only the main completer session
// (STORAGE_STATE). The no-role and no-projects profiles cannot be reproduced
// from a single account, so describes that use them must skip in e2e. Pass the
// profile the describe uses; the completer profile is never skipped.
export function skipInE2e(storageState = STORAGE_STATE) {
  return runMode === 'e2e' && storageState !== STORAGE_STATE
}

// On the CDP test runner, the browser must reach the external Defra ID pages
// (Azure B2C / Government Gateway) through the platform proxy; internal CDP
// service URLs and localhost go direct. The proxy var is only set on CDP, so
// this is undefined (a no-op) locally and in github/stub mode.
const proxyServer =
  process.env.CDP_HTTPS_PROXY ||
  process.env.HTTPS_PROXY ||
  process.env.HTTP_PROXY

export const proxyConfig = proxyServer
  ? { server: proxyServer, bypass: 'localhost,127.0.0.1,.cdp-int.defra.cloud' }
  : undefined

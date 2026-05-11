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

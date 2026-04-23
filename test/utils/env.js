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

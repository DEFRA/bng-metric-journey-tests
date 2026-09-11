import 'dotenv/config'
import { defineConfig } from '@playwright/test'

// AC evidence capture for /validate-ac-manual — run via `npm run test:evidence`.
// See .ai/instructions/validate-ac.md ("Manual validation").

// Two uploads at up to ~120 s of polling each, plus ~0.8 s of dwell per
// annotated action (video.show.actions.duration below).
const TIMEOUT_MS = 300_000
const EXPECT_TIMEOUT_MS = 15_000

// Pinned so every screenshot and every demo video comes out one size, the same
// way playwright.screenshots.config.js pins the happy-path capture.
const VIEWPORT = { width: 1280, height: 800 }

export default defineConfig({
  globalSetup: './test/setup/auth.setup.js',
  testDir: './test/evidence',
  // Keep Playwright's own artefacts out of the evidence folder — only the
  // named screenshots and the renamed demo videos belong there.
  outputDir: 'test-results/evidence',
  // workers: 1 + fullyParallel: false are load-bearing: the evidence spec
  // uploads GeoPackages, and concurrent uploads clobber the shared
  // `pendingUploadId` yar key, importing the wrong file into a project.
  fullyParallel: false,
  retries: 0,
  workers: 1,
  timeout: TIMEOUT_MS,
  expect: { timeout: EXPECT_TIMEOUT_MS },
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:3000',
    headless: true,
    browserName: 'chromium',
    viewport: VIEWPORT,
    screenshot: 'only-on-failure',
    // One demo video per AC. `show.actions` is what makes it watchable rather
    // than a machine-speed blur: an animated pointer and a highlight on each
    // element acted upon.
    //
    // `show.test` is deliberately NOT set. It captions every frame with the
    // whole testInfo.titlePath (spec filename, describe title, test title,
    // tag), races its own page-created handler so two stacked copies stay on
    // screen, and is styled with inline CSS that the frontend's
    // `style-src 'self'` CSP drops — so it cannot be made readable. The step
    // captions come from demoStep() in test/utils/evidence-video.js instead.
    video: {
      mode: 'on',
      size: VIEWPORT,
      show: {
        actions: { duration: 800, cursor: 'pointer', position: 'top-right' }
      }
    }
  }
})

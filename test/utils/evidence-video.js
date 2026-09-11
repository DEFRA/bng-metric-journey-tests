import fs from 'node:fs/promises'
import path from 'node:path'
import { test } from '@fixtures'

// Demo-video helpers for the throwaway /validate-ac-manual evidence spec.
// Recording is configured in playwright.evidence.config.js; these helpers name
// the videos and narrate them with the AC's own step wording.
//
// Why the captions look the way they do — the frontend serves
// `Content-Security-Policy: style-src 'self'` with no `unsafe-inline`, and
// Playwright injects overlay HTML into the page's own document. The browser
// therefore drops every `style=` attribute and `<style>` block in that HTML.
// Verified against the running app: an inline-styled div, a <style> block with
// a class, and a nested styled span all rendered as very small unstyled text,
// while semantic tags rendered normally. So captions are built from tags the user
// agent styles on its own (<h2>, <mark>) — do not "improve" them with CSS, it
// will silently do nothing. The same CSP is why Playwright's own
// `video.show.test` caption is unreadable and is left off in the config.
//
// Action decorations (pointer, click labels, element highlights) are unaffected
// — those are drawn in Playwright's shadow root from a constructed stylesheet,
// which CSP does not govern.

// Leading AC token of an evidence test title, e.g. `AC5b: unit deficit — ...`.
const AC_TOKEN = /^(ac\d+[a-z]?)\b/i

function escapeHtml(text) {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

/**
 * Derive the demo-video basename from the test title: `AC5b: unit deficit —
 * baseline only` becomes `ac5b-demo`, matching the `ac5b-step1-....png`
 * screenshot naming. Falls back to a slug of the whole title if the test is
 * not named for an AC.
 */
export function demoVideoName(testInfo) {
  const match = AC_TOKEN.exec(testInfo.title)
  const stem = match
    ? match[1].toLowerCase()
    : testInfo.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
  return `${stem}-demo`
}

/**
 * Open the video with a title card naming the AC, so a reviewer opening
 * `ac5b-demo.webm` cold knows what they are watching.
 *
 * Call this as the FIRST thing in the test, before any navigation. The card is
 * styled by Playwright with inline CSS, so it only renders properly while the
 * page is still on `about:blank` — once the app (and its CSP) is loaded the
 * card degrades to unstyled text. Blocks while the card is on screen.
 */
export async function demoTitleCard(page, title, description) {
  await page.screencast
    ?.showChapter(title, { description, duration: 2500 })
    .catch(() => {})
}

/**
 * A `test.step()` that also captions the demo video with the step title for as
 * long as the step runs. Use one per numbered step in the AC's `Steps:` list,
 * passing the step text verbatim — that text is what a reviewer reads on the
 * video, and it is what ties the demo back to the acceptance criterion.
 *
 * Safe when nothing is recording (the caption is skipped), so the same spec
 * still runs under a config without video.
 */
export async function demoStep(page, title, body) {
  return test.step(title, async () => {
    const caption = await showCaption(page, title)
    try {
      await body()
    } finally {
      await caption?.dispose().catch(() => {})
    }
  })
}

// Top-left is deliberate: it overlaps only the GOV.UK crown, never page
// content, and it sits in the same place regardless of how long the page is.
function showCaption(page, text) {
  return page.screencast
    ?.showOverlay(`<h2><mark>&nbsp;${escapeHtml(text)}&nbsp;</mark></h2>`)
    .catch(() => undefined)
}

/**
 * Save this AC's demo recording next to its screenshots.
 *
 * Playwright finalises a video only when its browser context closes, and
 * `video.saveAs()` blocks until that has happened — so the context has to be
 * closed here rather than left to fixture teardown, which runs after this
 * hook. Playwright's own teardown close is then a no-op.
 *
 * Call this from the LAST afterEach in the spec: it closes the context, so
 * nothing after it may touch `page`.
 */
export async function saveDemoVideo(page, dir, name) {
  const video = page.video()
  if (!video) {
    return
  }

  try {
    await page.context().close()
    await fs.mkdir(dir, { recursive: true })
    await video.saveAs(path.join(dir, `${name}.webm`))
  } catch (error) {
    // Evidence decoration must never decide an AC's verdict. This runs in
    // afterEach, where a throw fails the test — so a disk or video-finalisation
    // problem would report a passing AC as FAIL in the pass/fail table, which
    // is the whole deliverable. Record it as an annotation and let the AC's own
    // assertions stand.
    test.info().annotations.push({
      type: 'demo-video-failed',
      description: `${name}.webm was not saved: ${error.message}`
    })
  }
}

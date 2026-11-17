import { test, expect } from '@fixtures'
import { totp } from '@utils/totp.js'

// RFC 6238 Appendix B SHA-1 seed "12345678901234567890", base32-encoded. The
// seed is "1234567890" twice, and 10 bytes encode to exactly 16 base32
// characters, so the key is that 16-character block twice.
const RFC_6238_SEED = 'GEZDGNBVGY3TQOJQ'.repeat(2)
const INVALID_KEY_MESSAGE = 'DEFRA_ID_TOTP_SECRET is not a valid base32 key'

test.describe('authentication', { tag: '@authentication' }, () => {
  // ─── Security-code generator ─────────────────────────────────────────────────
  // test/utils/totp.js makes the One Login security code from the e2e account's
  // authenticator-app setup key (DefraIdLoginFlow, Step 3a of
  // defra-id-login.flow.md). One Login does not ask for a code today, so these
  // checks are its only coverage. No page fixture is used, so no browser starts.

  test.describe(
    'One Login security-code generator',
    { tag: '@regression' },
    () => {
      // Appendix B gives 8-digit codes; a 6-digit code is the last six digits.
      for (const [seconds, code] of [
        [59, '287082'],
        [1111111109, '081804'],
        [1234567890, '005924'],
        [2000000000, '279037']
      ]) {
        test(`matches the RFC 6238 SHA-1 vector at ${seconds}s`, () => {
          expect(totp(RFC_6238_SEED, seconds * 1000)).toBe(code)
        })
      }

      test('accepts a key in lower case and spaced groups, as One Login shows it', () => {
        const spaced = RFC_6238_SEED.toLowerCase().replace(/(.{4})/g, '$1 ')
        expect(totp(spaced, 59000)).toBe('287082')
      })

      test('refuses a key that is empty after spaces are removed', () => {
        expect(() => totp('   ')).toThrow(INVALID_KEY_MESSAGE)
      })

      test('refuses a key with characters outside the base32 alphabet', () => {
        expect(() => totp('ABC1')).toThrow(INVALID_KEY_MESSAGE)
      })
    }
  )
})

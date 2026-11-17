import { createHmac } from 'node:crypto'

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

// Authenticator-app setup keys are base32 (RFC 4648). One Login shows the key
// in groups, so spaces and case are ignored.
function decodeBase32(secret) {
  const clean = secret.replace(/[\s=-]/g, '').toUpperCase()
  let bits = ''
  for (const char of clean) {
    const value = BASE32_ALPHABET.indexOf(char)
    if (value === -1) {
      throw new Error('DEFRA_ID_TOTP_SECRET is not a valid base32 key')
    }
    bits += value.toString(2).padStart(5, '0')
  }
  const bytes = []
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(Number.parseInt(bits.slice(i, i + 8), 2))
  }
  return Buffer.from(bytes)
}

// RFC 6238 time-based one-time password: HMAC-SHA1, 30-second step, 6 digits —
// the defaults every authenticator app (and GOV.UK One Login) uses.
export function totp(secret, timestamp = Date.now()) {
  const counter = Buffer.alloc(8)
  counter.writeBigUInt64BE(BigInt(Math.floor(timestamp / 1000 / 30)))
  const hmac = createHmac('sha1', decodeBase32(secret)).update(counter).digest()
  const offset = hmac[hmac.length - 1] & 0x0f
  const code = (hmac.readUInt32BE(offset) & 0x7fffffff) % 1_000_000
  return code.toString().padStart(6, '0')
}

// Milliseconds left before the current code rolls over.
export function msUntilNextTotpStep(timestamp = Date.now()) {
  return 30_000 - (timestamp % 30_000)
}

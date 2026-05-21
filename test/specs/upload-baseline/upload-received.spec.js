import { test } from '@fixtures'
import {
  describeRoleEnforcement,
  describeUnauthenticatedAccess
} from '@utils/access-checks.js'

test.describe('upload-baseline', { tag: '@upload-baseline' }, () => {
  // ─── Role enforcement ────────────────────────────────────────────────────────

  describeRoleEnforcement('Upload received', 'upload-received')

  // ─── Unauthenticated access ──────────────────────────────────────────────────

  describeUnauthenticatedAccess('Upload received', 'upload-received', {
    smoke: false
  })
})

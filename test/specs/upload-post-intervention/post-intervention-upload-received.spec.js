import { test } from '@fixtures'
import {
  describeRoleEnforcement,
  describeUnauthenticatedAccess
} from '@utils/access-checks.js'

test.describe(
  'upload-post-intervention',
  { tag: '@upload-post-intervention' },
  () => {
    // ─── Role enforcement ──────────────────────────────────────────────────────

    describeRoleEnforcement(
      'Post-intervention upload received',
      'post-intervention-upload-received'
    )

    // ─── Unauthenticated access ──────────────────────────────────────────────────

    describeUnauthenticatedAccess(
      'Post-intervention upload received',
      'post-intervention-upload-received',
      { smoke: false }
    )
  }
)

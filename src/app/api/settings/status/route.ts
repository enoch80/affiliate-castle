/**
 * GET /api/settings/status
 *
 * Returns the configuration readiness of every platform — whether the
 * required OAuth client credentials are present in the server environment.
 * Does NOT expose actual credential values, only a boolean `ready` flag.
 *
 * Used by the settings UI to render "Setup required" for platforms that
 * haven't been configured by the admin yet, instead of letting the user
 * click Connect and get a cryptic "env var not set" 500 error.
 */

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { PLATFORM_REGISTRY } from '@/lib/platform-registry'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const platforms = PLATFORM_REGISTRY.map((entry) => {
    let ready = true
    if (entry.authType === 'oauth2') {
      const cfg = entry.oauth2!
      ready = !!(process.env[cfg.clientIdEnvVar] && process.env[cfg.clientSecretEnvVar])
    } else if (entry.authType === 'oauth1') {
      const cfg = entry.oauth1!
      ready = !!(process.env[cfg.consumerKeyEnvVar] && process.env[cfg.consumerSecretEnvVar])
    }
    // manual_token platforms are always ready (no server-side env vars needed)
    return { id: entry.id, authType: entry.authType, ready }
  })

  return NextResponse.json({ platforms })
}

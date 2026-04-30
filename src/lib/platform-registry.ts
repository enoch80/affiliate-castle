/**
 * Platform Registry — single source of truth for every publishing platform.
 *
 * Adding a new platform = add one entry here. Nothing else changes.
 *
 * authType:
 *   'oauth2'        — opens popup → user logs in → token auto-saved
 *   'oauth1'        — opens popup → user authorises → 4 tokens auto-saved (Tumblr)
 *   'manual_token'  — user pastes a static API key / token (dev.to, Hashnode, Medium)
 */

export interface FieldDef {
  key: string
  label: string
  type: 'text' | 'password'
  placeholder?: string
  required?: boolean
}

export interface VerifyResult {
  ok: boolean
  username?: string
  /** Extra fields merged into saved credentials (e.g. publication_id, blog_id) */
  metadata?: Record<string, string>
  error?: string
}

// ── Per-platform verifiers ─────────────────────────────────────────────────────

async function verifyDevto(creds: Record<string, string>): Promise<VerifyResult> {
  if (!creds.api_key) return { ok: false, error: 'api_key is required' }
  try {
    const res = await fetch('https://dev.to/api/users/me', {
      headers: { 'api-key': creds.api_key },
    })
    if (!res.ok) return { ok: false, error: `dev.to rejected key (HTTP ${res.status})` }
    const data = (await res.json()) as { username?: string; name?: string }
    return { ok: true, username: data.username ?? data.name ?? 'devto-user' }
  } catch (e) {
    return { ok: false, error: `Network error: ${e instanceof Error ? e.message : String(e)}` }
  }
}

async function verifyHashnode(creds: Record<string, string>): Promise<VerifyResult> {
  if (!creds.api_token) return { ok: false, error: 'api_token is required' }
  try {
    const res = await fetch('https://gql.hashnode.com', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: creds.api_token },
      body: JSON.stringify({
        query: `{ me { id username publications(first:1) { edges { node { id title url } } } } }`,
      }),
    })
    if (!res.ok) return { ok: false, error: `Hashnode rejected token (HTTP ${res.status})` }
    const data = (await res.json()) as {
      data?: {
        me?: {
          username?: string
          publications?: { edges?: Array<{ node?: { id: string; title: string; url: string } }> }
        }
      }
      errors?: Array<{ message: string }>
    }
    if (data.errors?.length) return { ok: false, error: data.errors[0].message }
    const me = data.data?.me
    if (!me) return { ok: false, error: 'No user returned — check token' }
    const pub = me.publications?.edges?.[0]?.node
    const metadata: Record<string, string> = {}
    if (pub) { metadata.publication_id = pub.id; metadata.publication_title = pub.title }
    return { ok: true, username: me.username ?? 'hashnode-user', metadata }
  } catch (e) {
    return { ok: false, error: `Network error: ${e instanceof Error ? e.message : String(e)}` }
  }
}

async function verifyMedium(creds: Record<string, string>): Promise<VerifyResult> {
  // Path 1: Official integration token (API v1)
  if (creds.integration_token) {
    try {
      const res = await fetch('https://api.medium.com/v1/me', {
        headers: { Authorization: `Bearer ${creds.integration_token}`, 'Content-Type': 'application/json' },
      })
      if (!res.ok) return { ok: false, error: `Medium rejected token (HTTP ${res.status})` }
      const data = (await res.json()) as { data?: { id?: string; username?: string; name?: string } }
      const user = data.data
      if (!user?.id) return { ok: false, error: 'Medium: no user data returned — token may be invalid' }
      return { ok: true, username: user.username ?? user.name ?? 'medium-user' }
    } catch (e) {
      return { ok: false, error: `Network error: ${e instanceof Error ? e.message : String(e)}` }
    }
  }

  // Path 2: Cookie-based session auth (internal API)
  const cookieStr = creds.cookie_auth ?? creds.cookie_session ?? ''
  if (cookieStr) {
    try {
      const res = await fetch('https://medium.com/_/api/users/self', {
        headers: { Cookie: cookieStr, 'User-Agent': 'Mozilla/5.0' },
      })
      if (!res.ok) return { ok: false, error: `Medium session expired or invalid (HTTP ${res.status})` }
      const text = await res.text()
      const cleaned = text.replace(/^\]\)\}[^\n]*\n/, '')
      const json = JSON.parse(cleaned) as { payload?: { user?: { username?: string; name?: string; id?: string } } }
      const user = json?.payload?.user
      if (!user?.id) return { ok: false, error: 'Medium: session valid but no user data returned' }
      return { ok: true, username: user.username ?? user.name ?? creds.username ?? 'medium-user' }
    } catch (e) {
      return { ok: false, error: `Network error: ${e instanceof Error ? e.message : String(e)}` }
    }
  }

  return { ok: false, error: 'integration_token or cookie_session is required' }
}

async function verifyTumblr(creds: Record<string, string>): Promise<VerifyResult> {
  if (!creds.consumer_key) return { ok: false, error: 'consumer_key is required' }
  if (!creds.blog_identifier) return { ok: false, error: 'blog_identifier is required' }
  try {
    const url = `https://api.tumblr.com/v2/blog/${encodeURIComponent(creds.blog_identifier)}/info?api_key=${creds.consumer_key}`
    const res = await fetch(url)
    if (!res.ok) return { ok: false, error: `Tumblr rejected key (HTTP ${res.status})` }
    const data = (await res.json()) as { response?: { blog?: { name?: string } } }
    return { ok: true, username: data.response?.blog?.name ?? creds.blog_identifier }
  } catch (e) {
    return { ok: false, error: `Network error: ${e instanceof Error ? e.message : String(e)}` }
  }
}

async function verifyBlogger(creds: Record<string, string>): Promise<VerifyResult> {
  if (!creds.access_token) return { ok: false, error: 'access_token is required' }
  try {
    const res = await fetch('https://www.googleapis.com/blogger/v3/users/self/blogs', {
      headers: { Authorization: `Bearer ${creds.access_token}` },
    })
    if (!res.ok) {
      if (res.status === 401) return { ok: false, error: 'TOKEN_EXPIRED' }
      return { ok: false, error: `Google API error (HTTP ${res.status})` }
    }
    const data = (await res.json()) as { items?: Array<{ id: string; name: string; url: string }> }
    const blogs = data.items ?? []
    if (blogs.length === 0) return { ok: false, error: 'No Blogger blogs found on this Google account' }
    const blog = creds.blog_id ? (blogs.find((b) => b.id === creds.blog_id) ?? blogs[0]) : blogs[0]
    const metadata: Record<string, string> = { blog_id: blog.id, blog_url: blog.url }
    if (blogs.length > 1) metadata.available_blogs = blogs.map((b) => `${b.name} (${b.id})`).join(', ')
    return { ok: true, username: blog.name, metadata }
  } catch (e) {
    return { ok: false, error: `Network error: ${e instanceof Error ? e.message : String(e)}` }
  }
}

async function verifyPinterest(creds: Record<string, string>): Promise<VerifyResult> {
  if (!creds.access_token) return { ok: false, error: 'access_token is required' }
  try {
    const res = await fetch('https://api.pinterest.com/v5/user_account', {
      headers: { Authorization: `Bearer ${creds.access_token}` },
    })
    if (!res.ok) {
      if (res.status === 401) return { ok: false, error: 'TOKEN_EXPIRED' }
      return { ok: false, error: `Pinterest rejected token (HTTP ${res.status})` }
    }
    const data = (await res.json()) as { username?: string }
    return { ok: true, username: data.username ?? 'pinterest-user' }
  } catch (e) {
    return { ok: false, error: `Network error: ${e instanceof Error ? e.message : String(e)}` }
  }
}

// ── Registry ───────────────────────────────────────────────────────────────────

export type AuthType = 'oauth2' | 'oauth1' | 'manual_token'

export interface OAuth2Config {
  authorizationUrl: string
  tokenUrl: string
  scopes: string[]
  clientIdEnvVar: string
  clientSecretEnvVar: string
  extraParams?: Record<string, string>
  pkce?: boolean
}

export interface OAuth1Config {
  requestTokenUrl: string
  authorizeUrl: string
  accessTokenUrl: string
  consumerKeyEnvVar: string
  consumerSecretEnvVar: string
}

export interface ManualConfig {
  fields: FieldDef[]
  docUrl: string
  note?: string
}

export interface PlatformEntry {
  id: string
  name: string
  description: string
  authType: AuthType
  /** Keys stored in credentialsEncrypted JSON */
  credentialShape: string[]
  oauth2?: OAuth2Config
  oauth1?: OAuth1Config
  manual?: ManualConfig
  verify: (creds: Record<string, string>) => Promise<VerifyResult>
}

export const PLATFORM_REGISTRY: PlatformEntry[] = [
  // ── Manual token platforms ───────────────────────────────────────────────────
  {
    id: 'devto',
    name: 'dev.to',
    description: 'Free developer blogging — highest DA, great organic reach',
    authType: 'manual_token',
    credentialShape: ['api_key'],
    manual: {
      fields: [{ key: 'api_key', label: 'API Key', type: 'password', placeholder: 'wr8…', required: true }],
      docUrl: 'https://dev.to/settings/account',
    },
    verify: verifyDevto,
  },
  {
    id: 'hashnode',
    name: 'Hashnode',
    description: 'Tech blogging with strong community amplification',
    authType: 'manual_token',
    credentialShape: ['api_token', 'publication_id'],
    manual: {
      fields: [{ key: 'api_token', label: 'Personal Access Token', type: 'password', placeholder: 'Token from Settings → Developer', required: true }],
      docUrl: 'https://hashnode.com/settings/developer',
      note: 'Publication ID is auto-discovered from your token — no extra step needed.',
    },
    verify: verifyHashnode,
  },
  {
    id: 'medium',
    name: 'Medium',
    description: 'Largest content platform — massive built-in audience',
    authType: 'manual_token',
    credentialShape: ['integration_token'],
    manual: {
      fields: [{ key: 'integration_token', label: 'Integration Token', type: 'password', placeholder: 'Token from Settings → Security → Integration tokens', required: true }],
      docUrl: 'https://medium.com/settings/security',
    },
    verify: verifyMedium,
  },

  // ── OAuth2 platforms ─────────────────────────────────────────────────────────
  {
    id: 'blogger',
    name: 'Blogger',
    description: 'Google-owned platform — PageRank authority',
    authType: 'oauth2',
    credentialShape: ['access_token', 'refresh_token', 'blog_id', 'blog_url'],
    oauth2: {
      authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
      tokenUrl: 'https://oauth2.googleapis.com/token',
      scopes: ['https://www.googleapis.com/auth/blogger'],
      clientIdEnvVar: 'GOOGLE_CLIENT_ID',
      clientSecretEnvVar: 'GOOGLE_CLIENT_SECRET',
      extraParams: { access_type: 'offline', prompt: 'consent' },
      pkce: true,
    },
    verify: verifyBlogger,
  },
  {
    id: 'pinterest',
    name: 'Pinterest',
    description: 'Visual discovery engine — high buyer intent traffic',
    authType: 'oauth2',
    credentialShape: ['access_token', 'refresh_token'],
    oauth2: {
      authorizationUrl: 'https://www.pinterest.com/oauth/',
      tokenUrl: 'https://api.pinterest.com/v5/oauth/token',
      scopes: ['boards:read', 'boards:write', 'pins:read', 'pins:write', 'user_accounts:read'],
      clientIdEnvVar: 'PINTEREST_CLIENT_ID',
      clientSecretEnvVar: 'PINTEREST_CLIENT_SECRET',
      pkce: false,
    },
    verify: verifyPinterest,
  },

  // ── OAuth1 platforms ─────────────────────────────────────────────────────────
  {
    id: 'tumblr',
    name: 'Tumblr',
    description: 'Viral-friendly microblog — no affiliate restrictions',
    authType: 'oauth1',
    credentialShape: ['consumer_key', 'consumer_secret', 'oauth_token', 'oauth_token_secret', 'blog_identifier'],
    oauth1: {
      requestTokenUrl: 'https://www.tumblr.com/oauth/request_token',
      authorizeUrl: 'https://www.tumblr.com/oauth/authorize',
      accessTokenUrl: 'https://www.tumblr.com/oauth/access_token',
      consumerKeyEnvVar: 'TUMBLR_CONSUMER_KEY',
      consumerSecretEnvVar: 'TUMBLR_CONSUMER_SECRET',
    },
    verify: verifyTumblr,
  },
]

/** Look up a platform by ID. Throws if not found. */
export function getPlatform(id: string): PlatformEntry {
  const p = PLATFORM_REGISTRY.find((e) => e.id === id)
  if (!p) throw new Error(`Unknown platform: ${id}`)
  return p
}

/** Dispatch verify for any platform by ID. */
export async function verifyPlatform(
  id: string,
  creds: Record<string, string>
): Promise<VerifyResult> {
  return getPlatform(id).verify(creds)
}

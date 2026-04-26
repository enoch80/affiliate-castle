/**
 * POST /api/settings/verify           — test credentials from request body (before saving)
 * GET  /api/settings/verify?platform= — test stored credentials for a platform (after saving)
 *
 * POST body: { platform: string, credentials: Record<string, string> }
 * GET  response: { ok: boolean, username?: string, metadata?: Record<string, string>, error?: string }
 *
 * Requires auth. Does NOT save anything — verify only.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { decryptCredential } from '@/lib/credentials'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

// ── Types ─────────────────────────────────────────────────────────────────────

interface VerifyResult {
  ok: boolean
  username?: string
  /** Extra fields to merge into saved credentials (e.g. publication_id for Hashnode) */
  metadata?: Record<string, string>
  error?: string
}

// ── Per-platform verifiers ────────────────────────────────────────────────────

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
      headers: {
        'Content-Type': 'application/json',
        Authorization: creds.api_token,
      },
      body: JSON.stringify({
        query: `{
          me {
            id
            username
            publications(first: 1) {
              edges { node { id title url } }
            }
          }
        }`,
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
    if (pub) {
      metadata.publication_id = pub.id
      metadata.publication_title = pub.title
    }

    return { ok: true, username: me.username ?? 'hashnode-user', metadata }
  } catch (e) {
    return { ok: false, error: `Network error: ${e instanceof Error ? e.message : String(e)}` }
  }
}

async function verifyMedium(creds: Record<string, string>): Promise<VerifyResult> {
  if (!creds.integration_token) return { ok: false, error: 'integration_token is required' }
  try {
    const res = await fetch('https://api.medium.com/v1/me', {
      headers: {
        Authorization: `Bearer ${creds.integration_token}`,
        'Content-Type': 'application/json',
      },
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

async function verifyTumblr(creds: Record<string, string>): Promise<VerifyResult> {
  if (!creds.consumer_key) return { ok: false, error: 'consumer_key is required' }
  if (!creds.blog_identifier) return { ok: false, error: 'blog_identifier is required (e.g. myblog.tumblr.com)' }
  try {
    // Public blog info endpoint accepts just api_key — no OAuth needed for verification
    const url = `https://api.tumblr.com/v2/blog/${encodeURIComponent(creds.blog_identifier)}/info?api_key=${creds.consumer_key}`
    const res = await fetch(url)
    if (!res.ok) return { ok: false, error: `Tumblr rejected key (HTTP ${res.status}) — check consumer_key and blog_identifier` }
    const data = (await res.json()) as { response?: { blog?: { name?: string; title?: string } } }
    const blog = data.response?.blog
    return { ok: true, username: blog?.name ?? creds.blog_identifier }
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
      if (res.status === 401) return { ok: false, error: 'Google token expired or invalid — get a new one from OAuth Playground' }
      return { ok: false, error: `Google API error (HTTP ${res.status})` }
    }
    const data = (await res.json()) as { items?: Array<{ id: string; name: string; url: string }> }
    const blogs = data.items ?? []
    if (blogs.length === 0) return { ok: false, error: 'No Blogger blogs found on this Google account' }

    const blog = creds.blog_id
      ? (blogs.find((b) => b.id === creds.blog_id) ?? blogs[0])
      : blogs[0]

    const metadata: Record<string, string> = { blog_id: blog.id, blog_url: blog.url }
    if (blogs.length > 1) {
      metadata.available_blogs = blogs.map((b) => `${b.name} (${b.id})`).join(', ')
    }

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
    if (!res.ok) return { ok: false, error: `Pinterest rejected token (HTTP ${res.status})` }
    const data = (await res.json()) as { username?: string }
    return { ok: true, username: data.username ?? 'pinterest-user' }
  } catch (e) {
    return { ok: false, error: `Network error: ${e instanceof Error ? e.message : String(e)}` }
  }
}

function dispatchVerify(platform: string, creds: Record<string, string>): Promise<VerifyResult> {
  switch (platform) {
    case 'devto':    return verifyDevto(creds)
    case 'hashnode': return verifyHashnode(creds)
    case 'medium':   return verifyMedium(creds)
    case 'tumblr':   return verifyTumblr(creds)
    case 'blogger':  return verifyBlogger(creds)
    case 'pinterest':return verifyPinterest(creds)
    default: return Promise.resolve({
      ok: false,
      error: `Platform '${platform}' does not support live verification`,
    })
  }
}

// ── POST — verify credentials from request body (before saving) ───────────────

const postSchema = z.object({
  platform: z.string().min(1),
  credentials: z.record(z.string()),
})

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = postSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', issues: parsed.error.issues }, { status: 400 })
  }

  const { platform, credentials } = parsed.data
  const result = await dispatchVerify(platform, credentials)
  return NextResponse.json(result, { status: result.ok ? 200 : 422 })
}

// ── GET — test already-stored credentials for a platform ─────────────────────

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const platform = searchParams.get('platform')
  if (!platform) return NextResponse.json({ error: 'platform query param required' }, { status: 400 })

  const account = await prisma.platformAccount.findFirst({
    where: { platform, isActive: true },
    select: { credentialsEncrypted: true },
  })
  if (!account) {
    return NextResponse.json({ ok: false, error: 'No account stored for this platform' }, { status: 404 })
  }

  let creds: Record<string, string>
  try {
    creds = JSON.parse(decryptCredential(account.credentialsEncrypted)) as Record<string, string>
  } catch {
    return NextResponse.json({ ok: false, error: 'Failed to decrypt stored credentials' }, { status: 500 })
  }

  const result = await dispatchVerify(platform, creds)
  return NextResponse.json(result)
}

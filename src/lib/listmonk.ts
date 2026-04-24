/**
 * Listmonk API client for Sprint 9.
 *
 * Wraps the Listmonk REST API v1 for subscriber management and transactional email.
 *
 * Env vars required:
 *   LISTMONK_URL      — e.g. http://listmonk:9000
 *   LISTMONK_USERNAME — admin username
 *   LISTMONK_PASSWORD — admin password
 *   LISTMONK_LIST_ID  — default subscriber list ID (numeric)
 */

export interface ListmonkSubscriber {
  id: number
  uuid: string
  email: string
  name: string
  status: string
  lists: Array<{ id: number; name: string }>
}

export interface ListmonkTransactionalInput {
  subscriberEmail: string
  templateId: number
  data?: Record<string, unknown>
  headers?: Record<string, string>
}

export interface ListmonkTransactionalResult {
  ok: boolean
  error?: string
}

export interface ListmonkSubscribeResult {
  ok: boolean
  subscriberId?: number
  error?: string
}

// ─── Config ───────────────────────────────────────────────────────────────────

function getConfig() {
  return {
    url: (process.env.LISTMONK_URL ?? 'http://localhost:9000').replace(/\/$/, ''),
    username: process.env.LISTMONK_USERNAME ?? 'listmonk',
    password: process.env.LISTMONK_PASSWORD ?? 'listmonk',
    listId: parseInt(process.env.LISTMONK_LIST_ID ?? '1', 10),
  }
}

function authHeader(username: string, password: string): string {
  return 'Basic ' + Buffer.from(`${username}:${password}`).toString('base64')
}

// ─── Subscribe / upsert a subscriber ─────────────────────────────────────────

export async function subscribeToList(
  email: string,
  firstName: string,
  nicheTag?: string
): Promise<ListmonkSubscribeResult> {
  const cfg = getConfig()

  try {
    const body = {
      email,
      name: firstName || email.split('@')[0],
      status: 'enabled',
      lists: [cfg.listId],
      attribs: nicheTag ? { niche: nicheTag } : {},
      preconfirm_subscriptions: true,
    }

    const res = await fetch(`${cfg.url}/api/subscribers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: authHeader(cfg.username, cfg.password),
      },
      body: JSON.stringify(body),
    })

    // 409 = duplicate → fetch existing subscriber
    if (res.status === 409) {
      const existing = await getSubscriberByEmail(email)
      if (existing) return { ok: true, subscriberId: existing.id }
      return { ok: false, error: 'Duplicate but not found' }
    }

    if (!res.ok) {
      const text = await res.text()
      return { ok: false, error: `HTTP ${res.status}: ${text.slice(0, 200)}` }
    }

    const data = await res.json() as { data: { id: number } }
    return { ok: true, subscriberId: data.data.id }
  } catch (err) {
    return { ok: false, error: String(err) }
  }
}

// ─── Get subscriber by email ──────────────────────────────────────────────────

export async function getSubscriberByEmail(email: string): Promise<ListmonkSubscriber | null> {
  const cfg = getConfig()

  try {
    const res = await fetch(
      `${cfg.url}/api/subscribers?query=${encodeURIComponent(`subscribers.email='${email}'`)}&page=1&per_page=1`,
      {
        headers: { Authorization: authHeader(cfg.username, cfg.password) },
      }
    )
    if (!res.ok) return null
    const data = await res.json() as { data: { results: ListmonkSubscriber[] } }
    return data.data.results[0] ?? null
  } catch {
    return null
  }
}

// ─── Send transactional email ─────────────────────────────────────────────────

export async function sendTransactionalEmail(
  input: ListmonkTransactionalInput
): Promise<ListmonkTransactionalResult> {
  const cfg = getConfig()
  const { subscriberEmail, templateId, data = {}, headers = {} } = input

  try {
    const body = {
      subscriber_email: subscriberEmail,
      template_id: templateId,
      data,
      headers,
    }

    const res = await fetch(`${cfg.url}/api/tx`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: authHeader(cfg.username, cfg.password),
      },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      const text = await res.text()
      return { ok: false, error: `HTTP ${res.status}: ${text.slice(0, 200)}` }
    }

    return { ok: true }
  } catch (err) {
    return { ok: false, error: String(err) }
  }
}

// ─── Tag subscriber (add attrib) ─────────────────────────────────────────────

export async function tagSubscriber(
  listmonkId: number,
  tag: string,
  value: string
): Promise<boolean> {
  const cfg = getConfig()

  try {
    const res = await fetch(`${cfg.url}/api/subscribers/${listmonkId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: authHeader(cfg.username, cfg.password),
      },
      body: JSON.stringify({ attribs: { [tag]: value } }),
    })
    return res.ok
  } catch {
    return false
  }
}

// ─── Check if Listmonk is reachable ──────────────────────────────────────────

export async function pingListmonk(): Promise<boolean> {
  const cfg = getConfig()
  try {
    const res = await fetch(`${cfg.url}/api/health`, {
      headers: { Authorization: authHeader(cfg.username, cfg.password) },
      signal: AbortSignal.timeout(5000),
    })
    return res.ok
  } catch {
    return false
  }
}

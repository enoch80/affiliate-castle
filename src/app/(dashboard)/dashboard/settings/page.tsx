'use client'

import { useCallback, useEffect, useState } from 'react'

// ── Types ─────────────────────────────────────────────────────────────────────

interface StoredAccount {
  id: string
  platform: string
  username: string
  isActive: boolean
  lastUsedAt: string | null
  createdAt: string
}

interface FieldDef {
  key: string
  label: string
  type: 'text' | 'password'
  placeholder?: string
  required?: boolean
}

interface PlatformConfig {
  id: string
  name: string
  description: string
  docUrl: string
  fields: FieldDef[]
  note?: string
}

type CardState = 'idle' | 'connecting' | 'testing' | 'disconnecting'

// ── Platform Definitions ──────────────────────────────────────────────────────

const PLATFORMS: PlatformConfig[] = [
  {
    id: 'devto',
    name: 'dev.to',
    description: 'Free developer blogging — highest DA, great organic reach',
    docUrl: 'https://dev.to/settings/account',
    fields: [
      { key: 'api_key', label: 'API Key', type: 'password', placeholder: 'wr8…', required: true },
    ],
  },
  {
    id: 'hashnode',
    name: 'Hashnode',
    description: 'Tech blogging with strong community amplification',
    docUrl: 'https://hashnode.com/settings/developer',
    fields: [
      {
        key: 'api_token',
        label: 'Personal Access Token',
        type: 'password',
        placeholder: 'Token from Settings → Developer',
        required: true,
      },
    ],
    note: 'Publication ID is auto-discovered from your token — no extra step needed.',
  },
  {
    id: 'medium',
    name: 'Medium',
    description: 'Largest content platform — massive built-in audience',
    docUrl: 'https://medium.com/settings/security',
    fields: [
      {
        key: 'integration_token',
        label: 'Integration Token',
        type: 'password',
        placeholder: 'Token from Settings → Security → Integration tokens',
        required: true,
      },
    ],
  },
  {
    id: 'tumblr',
    name: 'Tumblr',
    description: 'Viral-friendly microblog — no affiliate restrictions',
    docUrl: 'https://www.tumblr.com/oauth/apps',
    fields: [
      { key: 'consumer_key', label: 'Consumer Key', type: 'password', required: true },
      { key: 'consumer_secret', label: 'Consumer Secret', type: 'password', required: true },
      { key: 'oauth_token', label: 'OAuth Token', type: 'password', required: true },
      { key: 'oauth_token_secret', label: 'OAuth Token Secret', type: 'password', required: true },
      {
        key: 'blog_identifier',
        label: 'Blog Identifier',
        type: 'text',
        placeholder: 'myblog.tumblr.com',
        required: true,
      },
    ],
  },
  {
    id: 'blogger',
    name: 'Blogger',
    description: 'Google-owned platform — PageRank authority',
    docUrl: 'https://developers.google.com/oauthplayground/',
    fields: [
      {
        key: 'access_token',
        label: 'OAuth2 Access Token',
        type: 'password',
        placeholder: 'ya29.…',
        required: true,
      },
      {
        key: 'blog_id',
        label: 'Blog ID',
        type: 'text',
        placeholder: 'Auto-discovered if left blank',
        required: false,
      },
    ],
    note: 'Get token: Google OAuth Playground → select Blogger API v3 → Authorize APIs → Exchange code. Token valid 1h.',
  },
  {
    id: 'pinterest',
    name: 'Pinterest',
    description: 'Visual discovery engine — high buyer intent traffic',
    docUrl: 'https://developers.pinterest.com/',
    fields: [
      {
        key: 'access_token',
        label: 'Access Token',
        type: 'password',
        placeholder: 'pina_…',
        required: true,
      },
    ],
  },
]

// ── Platform Card ─────────────────────────────────────────────────────────────

function PlatformCard({
  config,
  account,
  onRefresh,
}: {
  config: PlatformConfig
  account: StoredAccount | null
  onRefresh: () => void
}) {
  const [values, setValues] = useState<Record<string, string>>({})
  const [cardState, setCardState] = useState<CardState>('idle')
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [showForm, setShowForm] = useState(!account)

  useEffect(() => {
    setShowForm(!account)
    setMessage(null)
  }, [account])

  function setValue(key: string, val: string) {
    setValues((v) => ({ ...v, [key]: val }))
  }

  async function handleConnect() {
    const missing = config.fields.filter((f) => f.required && !values[f.key]?.trim())
    if (missing.length > 0) {
      setMessage({ type: 'error', text: `Fill in: ${missing.map((f) => f.label).join(', ')}` })
      return
    }

    setCardState('connecting')
    setMessage(null)

    try {
      // Step 1: Verify live — one round-trip before any write
      const verifyRes = await fetch('/api/settings/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform: config.id, credentials: values }),
      })
      const verifyData = (await verifyRes.json()) as {
        ok: boolean
        username?: string
        metadata?: Record<string, string>
        error?: string
      }

      if (!verifyData.ok) {
        setMessage({ type: 'error', text: verifyData.error ?? 'Verification failed.' })
        setCardState('idle')
        return
      }

      // Step 2: Merge auto-discovered fields (e.g. publication_id for Hashnode, blog_id for Blogger)
      const fullCredentials: Record<string, string> = { ...values }
      for (const [k, v] of Object.entries(verifyData.metadata ?? {})) {
        // Only keep actual credential fields, not informational metadata
        if (!['publication_title', 'blog_url', 'available_blogs'].includes(k)) {
          fullCredentials[k] = v
        }
      }

      // Step 3: Save to DB
      const username = verifyData.username ?? config.id
      const saveRes = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform: config.id,
          username,
          credentials: JSON.stringify(fullCredentials),
          isActive: true,
        }),
      })

      if (!saveRes.ok) {
        const err = (await saveRes.json()) as { error?: string }
        setMessage({ type: 'error', text: err.error ?? 'Failed to save.' })
        setCardState('idle')
        return
      }

      const extra = verifyData.metadata?.publication_title
        ? ` · ${verifyData.metadata.publication_title}`
        : verifyData.metadata?.blog_url
          ? ` · ${verifyData.metadata.blog_url}`
          : ''

      setMessage({ type: 'success', text: `Connected as ${username}${extra}` })
      setValues({})
      onRefresh()
    } catch {
      setMessage({ type: 'error', text: 'Network error — please try again.' })
    }

    setCardState('idle')
  }

  async function handleTest() {
    setCardState('testing')
    setMessage(null)
    try {
      const res = await fetch(`/api/settings/verify?platform=${config.id}`)
      const data = (await res.json()) as { ok: boolean; username?: string; error?: string }
      if (data.ok) {
        setMessage({ type: 'success', text: `✓ Live — authenticated as ${data.username}` })
      } else {
        setMessage({ type: 'error', text: data.error ?? 'Connection test failed.' })
      }
    } catch {
      setMessage({ type: 'error', text: 'Network error during test.' })
    }
    setCardState('idle')
  }

  async function handleDisconnect() {
    if (!account) return
    setCardState('disconnecting')
    setMessage(null)
    try {
      const res = await fetch(`/api/settings?id=${account.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Delete failed')
      onRefresh()
    } catch {
      setMessage({ type: 'error', text: 'Failed to disconnect.' })
    }
    setCardState('idle')
  }

  const isLoading = cardState !== 'idle'
  const isConnected = !!account && !showForm

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="min-w-0 flex-1">
          <h3 className="text-white font-semibold text-sm">{config.name}</h3>
          <p className="text-slate-400 text-xs mt-0.5">{config.description}</p>
        </div>
        <div className="ml-3 shrink-0">
          {isConnected ? (
            <span className="flex items-center gap-1.5 text-emerald-400 text-xs font-medium bg-emerald-400/10 border border-emerald-400/20 px-2.5 py-1 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
              Connected
            </span>
          ) : (
            <span className="text-slate-500 text-xs font-medium bg-slate-700/60 border border-slate-600 px-2.5 py-1 rounded-full">
              Not connected
            </span>
          )}
        </div>
      </div>

      {/* Connected state — show account info + action buttons */}
      {isConnected && account && (
        <div className="space-y-3">
          <div className="flex items-center gap-3 bg-slate-900/50 rounded-lg px-3 py-2">
            <span className="text-slate-500 text-xs">Account</span>
            <span className="text-white font-mono text-xs">{account.username}</span>
            {account.lastUsedAt && (
              <span className="text-slate-600 text-xs ml-auto">
                Last used {new Date(account.lastUsedAt).toLocaleDateString()}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleTest}
              disabled={isLoading}
              className="px-3 py-1.5 text-xs font-medium bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg transition-colors disabled:opacity-50"
            >
              {cardState === 'testing' ? 'Testing…' : 'Test Connection'}
            </button>
            <button
              onClick={() => { setShowForm(true); setMessage(null) }}
              disabled={isLoading}
              className="px-3 py-1.5 text-xs font-medium bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg transition-colors disabled:opacity-50"
            >
              Update Credentials
            </button>
            <button
              onClick={handleDisconnect}
              disabled={isLoading}
              className="px-3 py-1.5 text-xs font-medium bg-red-950/60 hover:bg-red-900/50 text-red-400 hover:text-red-300 rounded-lg transition-colors disabled:opacity-50 ml-auto"
            >
              {cardState === 'disconnecting' ? 'Disconnecting…' : 'Disconnect'}
            </button>
          </div>
        </div>
      )}

      {/* Connection form */}
      {(!isConnected || showForm) && (
        <div className="space-y-3">
          {config.fields.map((field) => (
            <div key={field.key}>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                {field.label}
                {field.required === false && (
                  <span className="text-slate-500 ml-1">(optional)</span>
                )}
              </label>
              <input
                type={field.type}
                placeholder={field.placeholder ?? ''}
                value={values[field.key] ?? ''}
                onChange={(e) => setValue(field.key, e.target.value)}
                autoComplete="off"
                spellCheck={false}
                onKeyDown={(e) => { if (e.key === 'Enter') void handleConnect() }}
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm font-mono"
              />
            </div>
          ))}

          {config.note && (
            <p className="text-xs text-amber-400/80 bg-amber-400/10 border border-amber-400/20 rounded-lg px-3 py-2 leading-relaxed">
              💡 {config.note}
            </p>
          )}

          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={() => void handleConnect()}
              disabled={isLoading}
              className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white font-semibold text-sm py-2 rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              {cardState === 'connecting' ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Verifying &amp; Connecting…
                </>
              ) : (
                <>▶ Connect</>
              )}
            </button>
            {showForm && account && (
              <button
                onClick={() => { setShowForm(false); setValues({}); setMessage(null) }}
                className="px-3 py-2 text-xs text-slate-400 hover:text-slate-200 transition-colors"
              >
                Cancel
              </button>
            )}
            <a
              href={config.docUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-2 text-xs text-indigo-400 hover:text-indigo-300 transition-colors whitespace-nowrap"
            >
              Get credentials ↗
            </a>
          </div>
        </div>
      )}

      {/* Status message */}
      {message && (
        <div
          className={`mt-3 text-xs rounded-lg px-3 py-2 leading-relaxed ${
            message.type === 'success'
              ? 'bg-emerald-400/10 border border-emerald-400/20 text-emerald-400'
              : 'bg-red-400/10 border border-red-400/20 text-red-400'
          }`}
        >
          {message.text}
        </div>
      )}
    </div>
  )
}

// ── Summary bar ───────────────────────────────────────────────────────────────

function ConnectionSummary({ accounts }: { accounts: StoredAccount[] }) {
  const connected = PLATFORMS.filter((p) => accounts.some((a) => a.platform === p.id)).length
  const total = PLATFORMS.length
  return (
    <div className="flex items-center gap-3 bg-slate-800/60 border border-slate-700 rounded-xl px-4 py-3 mb-6">
      <div className="flex gap-1">
        {PLATFORMS.map((p) => {
          const isConn = accounts.some((a) => a.platform === p.id)
          return (
            <div
              key={p.id}
              title={`${p.name}: ${isConn ? 'Connected' : 'Not connected'}`}
              className={`w-2 h-2 rounded-full ${isConn ? 'bg-emerald-400' : 'bg-slate-600'}`}
            />
          )
        })}
      </div>
      <span className="text-sm text-slate-300">
        <span className="text-white font-semibold">{connected}</span>
        <span className="text-slate-500"> / {total}</span>
        {' '}platforms connected
      </span>
      {connected === total && (
        <span className="ml-auto text-xs text-emerald-400 font-medium">All platforms active ✓</span>
      )}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const [accounts, setAccounts] = useState<StoredAccount[]>([])
  const [loading, setLoading] = useState(true)

  const loadAccounts = useCallback(async () => {
    try {
      const res = await fetch('/api/settings')
      if (res.ok) {
        const data = (await res.json()) as { accounts?: StoredAccount[] }
        setAccounts(data.accounts ?? [])
      }
    } catch {
      // silently fail — user will see "Not connected" for all platforms
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadAccounts()
  }, [loadAccounts])

  function getAccount(platformId: string): StoredAccount | null {
    return accounts.find((a) => a.platform === platformId) ?? null
  }

  return (
    <div className="p-8 max-w-3xl">
      <h1 className="text-2xl font-bold text-white mb-1">Platform Connections</h1>
      <p className="text-slate-400 mb-6 text-sm">
        Connect publishing platforms. Credentials are verified live then stored AES-256-GCM
        encrypted. One click to connect, test, or disconnect.
      </p>

      {loading ? (
        <div className="space-y-4">
          {PLATFORMS.map((p) => (
            <div
              key={p.id}
              className="bg-slate-800 border border-slate-700 rounded-2xl h-24 animate-pulse"
            />
          ))}
        </div>
      ) : (
        <>
          <ConnectionSummary accounts={accounts} />
          <div className="space-y-4">
            {PLATFORMS.map((config) => (
              <PlatformCard
                key={config.id}
                config={config}
                account={getAccount(config.id)}
                onRefresh={loadAccounts}
              />
            ))}
          </div>
        </>
      )}

      {/* Telegram info block */}
      <div className="mt-6 bg-slate-800/40 border border-slate-700/50 rounded-2xl p-5 flex items-center justify-between">
        <div>
          <h3 className="text-white font-semibold text-sm">Telegram Channels</h3>
          <p className="text-slate-400 text-xs mt-1">
            Bot token + channel management is handled in the Channels section.
          </p>
        </div>
        <a
          href="/dashboard/channels"
          className="text-xs font-medium text-indigo-400 hover:text-indigo-300 transition-colors whitespace-nowrap ml-4"
        >
          Manage Channels →
        </a>
      </div>
    </div>
  )
}

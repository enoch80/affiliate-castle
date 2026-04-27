'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { PLATFORM_REGISTRY, type PlatformEntry } from '@/lib/platform-registry'

// ── Types ─────────────────────────────────────────────────────────────────────

interface StoredAccount {
  id: string
  platform: string
  username: string
  isActive: boolean
  lastUsedAt: string | null
  createdAt: string
}

type CardState = 'idle' | 'connecting' | 'testing' | 'disconnecting'

// ── Platform Card ─────────────────────────────────────────────────────────────

function PlatformCard({
  config,
  account,
  onRefresh,
}: {
  config: PlatformEntry
  account: StoredAccount | null
  onRefresh: () => void
}) {
  const [values, setValues] = useState<Record<string, string>>({})
  const [cardState, setCardState] = useState<CardState>('idle')
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [showForm, setShowForm] = useState(!account)
  const popupRef = useRef<Window | null>(null)

  useEffect(() => {
    setShowForm(!account)
    setMessage(null)
  }, [account])

  function setValue(key: string, val: string) {
    setValues((v) => ({ ...v, [key]: val }))
  }

  // ── OAuth popup connect ──────────────────────────────────────────────────────
  async function handleOAuthConnect() {
    setCardState('connecting')
    setMessage(null)
    try {
      const res = await fetch(`/api/auth/oauth/start?platform=${config.id}`)
      if (!res.ok) {
        const err = (await res.json()) as { error?: string }
        setMessage({ type: 'error', text: err.error ?? 'Could not start OAuth flow.' })
        setCardState('idle')
        return
      }
      const data = (await res.json()) as { authType: string; url?: string; error?: string }
      if (!data.url) {
        setMessage({ type: 'error', text: data.error ?? 'No authorization URL returned.' })
        setCardState('idle')
        return
      }
      const left = Math.round(window.screen.width / 2 - 280)
      const top = Math.round(window.screen.height / 2 - 340)
      const popup = window.open(data.url, 'oauth_connect', `width=560,height=680,left=${left},top=${top}`)
      popupRef.current = popup
      const handler = (e: MessageEvent) => {
        if (e.origin !== window.location.origin) return
        const msg = e.data as { ok?: boolean; platform?: string; username?: string; error?: string }
        if (msg.platform !== config.id) return
        window.removeEventListener('message', handler)
        popupRef.current?.close()
        popupRef.current = null
        setCardState('idle')
        if (msg.ok) {
          setMessage({ type: 'success', text: `Connected as ${msg.username ?? config.id}` })
          onRefresh()
        } else {
          setMessage({ type: 'error', text: msg.error ?? 'OAuth authorisation failed.' })
        }
      }
      window.addEventListener('message', handler)
    } catch {
      setMessage({ type: 'error', text: 'Network error — please try again.' })
      setCardState('idle')
    }
  }

  // ── Manual token connect ─────────────────────────────────────────────────────
  async function handleConnect() {
    const missing = (config.manual?.fields ?? []).filter((f) => f.required && !values[f.key]?.trim())
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
  const isOAuth = config.authType === 'oauth2' || config.authType === 'oauth1'

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
            {isOAuth ? (
              <button
                onClick={() => void handleOAuthConnect()}
                disabled={isLoading}
                className="px-3 py-1.5 text-xs font-medium bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg transition-colors disabled:opacity-50"
              >
                {cardState === 'connecting' ? 'Reconnecting…' : 'Reconnect'}
              </button>
            ) : (
              <button
                onClick={() => { setShowForm(true); setMessage(null) }}
                disabled={isLoading}
                className="px-3 py-1.5 text-xs font-medium bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg transition-colors disabled:opacity-50"
              >
                Update Credentials
              </button>
            )}
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

      {/* OAuth one-click connect button (not yet connected) */}
      {!isConnected && isOAuth && (
        <button
          onClick={() => void handleOAuthConnect()}
          disabled={isLoading}
          className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white font-semibold text-sm py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2"
        >
          {cardState === 'connecting' ? (
            <>
              <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Connecting…
            </>
          ) : (
            <>↗ Connect with {config.name}</>
          )}
        </button>
      )}

      {/* Manual token connection form */}
      {(!isConnected || showForm) && !isOAuth && (
        <div className="space-y-3">
          {(config.manual?.fields ?? []).map((field) => (
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

          {config.manual?.note && (
            <p className="text-xs text-amber-400/80 bg-amber-400/10 border border-amber-400/20 rounded-lg px-3 py-2 leading-relaxed">
              💡 {config.manual.note}
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
              href={config.manual?.docUrl ?? '#'}
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
  const connected = PLATFORM_REGISTRY.filter((p) => accounts.some((a) => a.platform === p.id)).length
  const total = PLATFORM_REGISTRY.length
  return (
    <div className="flex items-center gap-3 bg-slate-800/60 border border-slate-700 rounded-xl px-4 py-3 mb-6">
      <div className="flex gap-1">
        {PLATFORM_REGISTRY.map((p) => {
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
    <div className="p-4 sm:p-8 max-w-3xl">
      <h1 className="text-2xl font-bold text-white mb-1">Platform Connections</h1>
      <p className="text-slate-400 mb-6 text-sm">
        Connect publishing platforms. OAuth platforms connect with one click — no copy-pasting tokens.
        Credentials are stored AES-256-GCM encrypted.
      </p>

      {loading ? (
        <div className="space-y-4">
          {PLATFORM_REGISTRY.map((p) => (
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
            {PLATFORM_REGISTRY.map((config) => (
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

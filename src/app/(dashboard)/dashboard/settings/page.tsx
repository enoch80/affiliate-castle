'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { PLATFORM_REGISTRY, type PlatformEntry } from '@/lib/platform-registry'

// ── Platform brand icons (inline SVG) ─────────────────────────────────────────
const PLATFORM_ICONS: Record<string, React.ReactNode> = {
  devto: (
    <svg viewBox="0 0 40 40" fill="none" className="w-8 h-8" aria-label="DEV">
      <rect width="40" height="40" rx="8" fill="#0A0A0A" />
      <text x="50%" y="56%" dominantBaseline="middle" textAnchor="middle" fill="white" fontSize="11" fontWeight="bold" fontFamily="monospace">DEV</text>
    </svg>
  ),
  hashnode: (
    <svg viewBox="0 0 40 40" fill="none" className="w-8 h-8" aria-label="Hashnode">
      <rect width="40" height="40" rx="8" fill="#2962FF" />
      <path d="M20 8L32 14.5v11L20 32 8 25.5v-11L20 8z" fill="white" opacity="0.95" />
      <circle cx="20" cy="20" r="4" fill="#2962FF" />
    </svg>
  ),
  medium: (
    <svg viewBox="0 0 40 40" fill="none" className="w-8 h-8" aria-label="Medium">
      <rect width="40" height="40" rx="8" fill="#191919" />
      <ellipse cx="14" cy="20" rx="6" ry="7.5" fill="white" />
      <ellipse cx="27" cy="20" rx="3" ry="7" fill="white" />
      <ellipse cx="35" cy="20" rx="2" ry="5.5" fill="white" />
    </svg>
  ),
  tumblr: (
    <svg viewBox="0 0 40 40" fill="none" className="w-8 h-8" aria-label="Tumblr">
      <rect width="40" height="40" rx="8" fill="#35465C" />
      <path d="M18 10v6h-4v5h4v8c0 3 1.5 5 5 5h3v-5h-2c-1 0-1.5-.5-1.5-1.5V21h3.5v-5H22.5V10H18z" fill="white" />
    </svg>
  ),
  blogger: (
    <svg viewBox="0 0 40 40" fill="none" className="w-8 h-8" aria-label="Blogger">
      <rect width="40" height="40" rx="8" fill="#FF5722" />
      <path d="M12 12h10c3 0 5 2 5 5v1h-3v-1c0-1-.5-1.5-1.5-1.5H12V12zm0 8h16c0 3-2 8-7 8H12V20z" fill="white" />
    </svg>
  ),
  pinterest: (
    <svg viewBox="0 0 40 40" fill="none" className="w-8 h-8" aria-label="Pinterest">
      <rect width="40" height="40" rx="8" fill="#E60023" />
      <path d="M20 7c-7.2 0-13 5.8-13 13 0 5.5 3.4 10.2 8.3 12.1-.1-1-.2-2.6.1-3.7l1.5-6.3s-.4-.8-.4-1.9c0-1.8 1-3.1 2.3-3.1 1.1 0 1.6.8 1.6 1.8 0 1.1-.7 2.7-1 4.2-.3 1.2.6 2.2 1.8 2.2 2.2 0 3.7-2.3 3.7-5.6 0-2.9-2.1-5-5.2-5-3.5 0-5.6 2.6-5.6 5.3 0 1 .4 2.1 1 2.7.1.1.1.3.1.4l-.4 1.5c-.1.3-.3.4-.6.2-1.6-.7-2.6-3-2.6-4.8 0-3.9 2.8-7.4 8.1-7.4 4.3 0 7.6 3 7.6 7.1 0 4.2-2.7 7.6-6.4 7.6-1.3 0-2.4-.7-2.8-1.4l-.8 2.9c-.3 1.1-1 2.5-1.5 3.3.6.2 1.1.2 1.7.2 7.2 0 13-5.8 13-13S27.2 7 20 7z" fill="white" />
    </svg>
  ),
}

function PlatformIcon({ id }: { id: string }) {
  return PLATFORM_ICONS[id] ?? (
    <div className="w-8 h-8 rounded-lg bg-slate-700 flex items-center justify-center text-slate-300 text-xs font-bold">
      {id.slice(0, 2).toUpperCase()}
    </div>
  )
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface StoredAccount {
  id: string
  platform: string
  username: string
  isActive: boolean
  lastUsedAt: string | null
  createdAt: string
}

interface PlatformStatus {
  id: string
  authType: string
  ready: boolean
}

type CardState = 'idle' | 'connecting' | 'testing' | 'disconnecting'

// ── Platform Card ─────────────────────────────────────────────────────────────

function PlatformCard({
  config,
  account,
  ready,
  onRefresh,
}: {
  config: PlatformEntry
  account: StoredAccount | null
  ready: boolean
  onRefresh: () => void
}) {
  const [values, setValues] = useState<Record<string, string>>({})
  const [cardState, setCardState] = useState<CardState>('idle')
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [showForm, setShowForm] = useState(!account)
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({})
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
    <div className={`bg-slate-800 border rounded-2xl p-5 transition-colors ${isConnected ? 'border-slate-600/80' : 'border-slate-700'}`}>
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="shrink-0">
          <PlatformIcon id={config.id} />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-white font-semibold text-sm leading-tight">{config.name}</h3>
          <p className="text-slate-400 text-xs mt-0.5 leading-tight">{config.description}</p>
        </div>
        <div className="ml-1 shrink-0">
          {isConnected ? (
            <span className="flex items-center gap-1.5 text-emerald-400 text-xs font-medium bg-emerald-400/10 border border-emerald-400/25 px-2.5 py-1 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse inline-block" />
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
        <>
          {ready ? (
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
          ) : (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 space-y-1.5">
              <p className="text-amber-400 text-xs font-semibold">⚙ Admin setup required</p>
              <p className="text-amber-300/70 text-xs leading-relaxed">
                OAuth credentials for {config.name} are not configured on the server.
                {config.id === 'blogger' && (
                  <> Create a Google OAuth2 app at{' '}
                    <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener noreferrer"
                      className="underline hover:text-amber-200">
                      Google Cloud Console
                    </a>
                    {' '}and add <code className="font-mono bg-amber-500/20 px-1 rounded">GOOGLE_CLIENT_ID</code> and{' '}
                    <code className="font-mono bg-amber-500/20 px-1 rounded">GOOGLE_CLIENT_SECRET</code> to the server .env.
                  </>
                )}
                {config.id === 'pinterest' && (
                  <> Create a Pinterest app at{' '}
                    <a href="https://developers.pinterest.com/apps/" target="_blank" rel="noopener noreferrer"
                      className="underline hover:text-amber-200">
                      Pinterest Developers
                    </a>
                    {' '}and add <code className="font-mono bg-amber-500/20 px-1 rounded">PINTEREST_CLIENT_ID</code> and{' '}
                    <code className="font-mono bg-amber-500/20 px-1 rounded">PINTEREST_CLIENT_SECRET</code> to the server .env.
                  </>
                )}
              </p>
              <p className="text-amber-300/50 text-xs">
                Redirect URI: <code className="font-mono bg-amber-500/10 px-1 rounded">https://app.digitalfinds.net/api/auth/oauth/callback</code>
              </p>
            </div>
          )}
        </>
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
              <div className="relative">
                <input
                  type={field.type === 'password' && !showSecrets[field.key] ? 'password' : 'text'}
                  placeholder={field.placeholder ?? ''}
                  value={values[field.key] ?? ''}
                  onChange={(e) => setValue(field.key, e.target.value)}
                  autoComplete="off"
                  spellCheck={false}
                  onKeyDown={(e) => { if (e.key === 'Enter') void handleConnect() }}
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm font-mono pr-9"
                />
                {field.type === 'password' && (
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => setShowSecrets((p) => ({ ...p, [field.key]: !p[field.key] }))}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors text-xs"
                    aria-label={showSecrets[field.key] ? 'Hide' : 'Show'}
                  >
                    {showSecrets[field.key] ? '🙈' : '👁'}
                  </button>
                )}
              </div>
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
      <div className="flex gap-2 items-center">
        {PLATFORM_REGISTRY.map((p) => {
          const isConn = accounts.some((a) => a.platform === p.id)
          return (
            <div
              key={p.id}
              title={`${p.name}: ${isConn ? 'Connected' : 'Not connected'}`}
              className={`transition-opacity ${isConn ? 'opacity-100' : 'opacity-25 grayscale'}`}
              style={{ width: 22, height: 22 }}
            >
              <PlatformIcon id={p.id} />
            </div>
          )
        })}
      </div>
      <div className="w-px h-5 bg-slate-700 mx-1" />
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
  const [platformsStatus, setPlatformsStatus] = useState<PlatformStatus[]>([])
  const [loading, setLoading] = useState(true)

  const loadAccounts = useCallback(async () => {
    try {
      const [accountsRes, statusRes] = await Promise.all([
        fetch('/api/settings'),
        fetch('/api/settings/status'),
      ])
      if (accountsRes.ok) {
        const data = (await accountsRes.json()) as { accounts?: StoredAccount[] }
        setAccounts(data.accounts ?? [])
      }
      if (statusRes.ok) {
        const data = (await statusRes.json()) as { platforms?: PlatformStatus[] }
        setPlatformsStatus(data.platforms ?? [])
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

  function getPlatformReady(platformId: string): boolean {
    const status = platformsStatus.find((s) => s.id === platformId)
    // Default to true if status not loaded yet — the API call will validate
    return status?.ready ?? true
  }

  return (
    <div className="p-4 sm:p-8 max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white mb-1">Platform Connections</h1>
        <p className="text-slate-400 text-sm">
          Connect publishing platforms. OAuth platforms connect with one click — no copy-pasting tokens.
          Credentials are stored <span className="text-slate-300 font-medium">AES-256-GCM</span> encrypted.
        </p>
      </div>

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
                ready={getPlatformReady(config.id)}
                onRefresh={loadAccounts}
              />
            ))}
          </div>
        </>
      )}

      {/* Telegram info block */}
      <div className="mt-6 bg-slate-800/40 border border-slate-700/50 rounded-2xl p-5 flex items-center gap-4">
        <div className="shrink-0">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#229ED9' }}>
            <svg viewBox="0 0 24 24" fill="white" className="w-5 h-5" aria-label="Telegram">
              <path d="M11.944 0A12 12 0 1 0 24 12 12 12 0 0 0 11.944 0zm6.083 8.016l-2.03 9.57c-.153.661-.555.82-1.123.51l-3.093-2.28-1.49 1.435c-.165.165-.304.304-.624.304l.223-3.155 5.74-5.185c.25-.222-.054-.345-.385-.123L7.4 14.097 4.343 13.09c-.647-.202-.66-.647.135-.96l11.91-4.593c.54-.196 1.01.131.84.958z" />
            </svg>
          </div>
        </div>
        <div className="flex-1">
          <h3 className="text-white font-semibold text-sm">Telegram Channels</h3>
          <p className="text-slate-400 text-xs mt-0.5">
            Bot token + channel management is handled in the Channels section.
          </p>
        </div>
        <a
          href="/dashboard/channels"
          className="text-xs font-medium text-indigo-400 hover:text-indigo-300 transition-colors whitespace-nowrap shrink-0"
        >
          Manage Channels →
        </a>
      </div>
    </div>
  )
}

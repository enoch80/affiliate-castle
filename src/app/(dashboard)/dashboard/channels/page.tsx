'use client'

import { useCallback, useEffect, useState } from 'react'

interface Channel {
  id: string
  channelUsername: string
  channelId: string | null
  displayName: string
  subscriberCount: number
  lastSyncedAt: string | null
  createdAt: string
  _count: { posts: number }
}

export default function ChannelsPage() {
  const [channels, setChannels] = useState<Channel[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ botToken: '', channelUsername: '', displayName: '' })
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const loadChannels = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/channels')
      if (res.ok) {
        const data = (await res.json()) as { channels?: Channel[] }
        setChannels(data.channels ?? [])
      }
    } catch {
      // silent fail
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void loadChannels() }, [loadChannels])

  async function handleAdd() {
    if (!form.botToken.trim() || !form.channelUsername.trim() || !form.displayName.trim()) {
      setMessage({ type: 'error', text: 'All fields are required.' })
      return
    }
    setAdding(true)
    setMessage(null)
    try {
      const res = await fetch('/api/channels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = (await res.json()) as { id?: string; error?: string }
      if (!res.ok) {
        setMessage({ type: 'error', text: data.error ?? 'Failed to add channel.' })
      } else {
        setMessage({ type: 'success', text: `Channel ${form.channelUsername} registered.` })
        setForm({ botToken: '', channelUsername: '', displayName: '' })
        setShowForm(false)
        await loadChannels()
      }
    } catch {
      setMessage({ type: 'error', text: 'Network error.' })
    }
    setAdding(false)
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Remove channel "${name}"?`)) return
    try {
      const res = await fetch(`/api/channels/${id}`, { method: 'DELETE' })
      if (res.ok) {
        setMessage({ type: 'success', text: `${name} removed.` })
        await loadChannels()
      } else {
        const d = (await res.json()) as { error?: string }
        setMessage({ type: 'error', text: d.error ?? 'Failed to remove.' })
      }
    } catch {
      setMessage({ type: 'error', text: 'Network error.' })
    }
  }

  return (
    <div className="p-4 sm:p-8 max-w-3xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Telegram Channels</h1>
          <p className="text-slate-400 text-sm mt-1">
            Manage bot tokens and channels for automated content publishing.
          </p>
        </div>
        <button
          onClick={() => { setShowForm((v) => !v); setMessage(null) }}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-xl transition-colors"
        >
          {showForm ? 'Cancel' : '+ Add Channel'}
        </button>
      </div>

      {/* Status message */}
      {message && (
        <div className={`mb-4 text-sm rounded-xl px-4 py-3 leading-relaxed ${
          message.type === 'success'
            ? 'bg-emerald-400/10 border border-emerald-400/20 text-emerald-400'
            : 'bg-red-400/10 border border-red-400/20 text-red-400'
        }`}>
          {message.text}
        </div>
      )}

      {/* Add channel form */}
      {showForm && (
        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 mb-6">
          <h2 className="text-white font-semibold text-sm mb-4">Register New Channel</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Bot Token</label>
              <input
                type="password"
                placeholder="123456789:ABCdef..."
                value={form.botToken}
                onChange={(e) => setForm((f) => ({ ...f, botToken: e.target.value }))}
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-mono"
              />
              <p className="text-xs text-slate-500 mt-1">Get from @BotFather on Telegram</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Channel Username</label>
              <input
                type="text"
                placeholder="@YourChannel"
                value={form.channelUsername}
                onChange={(e) => setForm((f) => ({ ...f, channelUsername: e.target.value }))}
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Display Name</label>
              <input
                type="text"
                placeholder="My Affiliate Channel"
                value={form.displayName}
                onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))}
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
              />
            </div>
            <button
              onClick={() => void handleAdd()}
              disabled={adding}
              className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white font-semibold text-sm py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              {adding ? (
                <><span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />Registering…</>
              ) : '▶ Register Channel'}
            </button>
          </div>
        </div>
      )}

      {/* Channel list */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2].map((n) => (
            <div key={n} className="bg-slate-800 border border-slate-700 rounded-2xl h-28 animate-pulse" />
          ))}
        </div>
      ) : channels.length === 0 ? (
        <div className="bg-slate-800/50 border border-slate-700 border-dashed rounded-2xl p-10 text-center">
          <div className="text-3xl mb-3">📢</div>
          <p className="text-slate-300 font-semibold text-sm">No channels registered</p>
          <p className="text-slate-500 text-xs mt-1">Add a Telegram bot + channel to enable automated publishing.</p>
          <button
            onClick={() => setShowForm(true)}
            className="mt-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg transition-colors"
          >
            + Add Your First Channel
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {channels.map((ch) => (
            <div key={ch.id} className="bg-slate-800 border border-slate-700 rounded-2xl p-6">
              {/* Header row */}
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-white font-semibold text-sm flex items-center gap-2">
                    {ch.displayName}
                    <span className="text-xs font-normal text-indigo-400 font-mono">{ch.channelUsername}</span>
                  </h3>
                  {ch.channelId && (
                    <p className="text-slate-500 text-xs mt-0.5">Channel ID: {ch.channelId}</p>
                  )}
                </div>
                <span className="flex items-center gap-1.5 text-emerald-400 text-xs font-medium bg-emerald-400/10 border border-emerald-400/20 px-2.5 py-1 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
                  Active
                </span>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="bg-slate-900/60 rounded-xl px-3 py-2.5 text-center">
                  <div className="text-white font-bold text-lg">{ch.subscriberCount.toLocaleString()}</div>
                  <div className="text-slate-500 text-xs">Subscribers</div>
                </div>
                <div className="bg-slate-900/60 rounded-xl px-3 py-2.5 text-center">
                  <div className="text-white font-bold text-lg">{ch._count.posts}</div>
                  <div className="text-slate-500 text-xs">Posts sent</div>
                </div>
                <div className="bg-slate-900/60 rounded-xl px-3 py-2.5 text-center">
                  <div className="text-white font-bold text-xs truncate mt-1">
                    {ch.lastSyncedAt
                      ? new Date(ch.lastSyncedAt).toLocaleDateString()
                      : '—'}
                  </div>
                  <div className="text-slate-500 text-xs">Last sync</div>
                </div>
              </div>

              {/* Added date + remove */}
              <div className="flex items-center justify-between">
                <span className="text-slate-600 text-xs">
                  Added {new Date(ch.createdAt).toLocaleDateString()}
                </span>
                <button
                  onClick={() => void handleDelete(ch.id, ch.displayName)}
                  className="px-3 py-1.5 text-xs font-medium bg-red-950/60 hover:bg-red-900/50 text-red-400 hover:text-red-300 rounded-lg transition-colors"
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Info box */}
      <div className="mt-6 bg-slate-800/40 border border-slate-700/50 rounded-2xl p-5">
        <h3 className="text-white font-semibold text-sm mb-1">How it works</h3>
        <ul className="text-slate-400 text-xs space-y-1 leading-relaxed">
          <li>• Create a bot via @BotFather and add it as admin to your channel</li>
          <li>• Register the bot token and channel username above</li>
          <li>• The scheduler will auto-post content briefs, affiliate promos, and engagement threads</li>
          <li>• Channel is submitted to tgstat.com and telemetr.io directories automatically</li>
        </ul>
      </div>
    </div>
  )
}

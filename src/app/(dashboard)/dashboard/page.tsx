'use client'

import { useState, FormEvent } from 'react'
import { useRouter } from 'next/navigation'

export default function LaunchPage() {
  const router = useRouter()
  const [hoplink, setHoplink] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleLaunch(e: FormEvent) {
    e.preventDefault()
    setError('')

    const url = hoplink.trim()
    if (!url.startsWith('http')) {
      setError('Please enter a valid URL starting with http:// or https://')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/offers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hoplink: url }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Launch failed')
      router.push(`/dashboard/campaigns/${data.campaignId}`)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-2xl">
        {/* Hero */}
        <div className="text-center mb-12">
          <h1 className="text-5xl font-extrabold text-white tracking-tight mb-4">
            Paste. Launch. Done.
          </h1>
          <p className="text-slate-400 text-lg">
            Paste your affiliate hoplink and the engine does everything — research,
            content, bridge page, publishing, email drip, Telegram, tracking.
          </p>
        </div>

        {/* Launch form */}
        <form onSubmit={handleLaunch} className="bg-slate-800 border border-slate-700 rounded-2xl p-8 shadow-2xl">
          <label className="block text-sm font-semibold text-slate-300 mb-2">
            Affiliate Hoplink
          </label>
          <input
            type="url"
            value={hoplink}
            onChange={e => setHoplink(e.target.value)}
            required
            placeholder="https://example.hop.clickbank.net/?affiliate=yourId"
            className="w-full bg-slate-900 border border-slate-600 rounded-xl px-4 py-4 text-white text-lg placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent mb-4"
          />
          {error && (
            <div className="bg-red-900/40 border border-red-700 text-red-300 text-sm px-4 py-3 rounded-lg mb-4">
              {error}
            </div>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-orange-500 hover:bg-orange-400 disabled:opacity-60 disabled:cursor-not-allowed text-white font-extrabold py-4 px-6 rounded-xl text-xl transition-colors duration-150 shadow-lg shadow-orange-500/20"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-3">
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Launching…
              </span>
            ) : (
              '🚀 Launch Campaign'
            )}
          </button>
        </form>

        {/* What happens next */}
        <div className="mt-10 grid grid-cols-2 gap-4 text-center text-sm text-slate-500">
          {[
            ['🔍', 'Market & SERP research'],
            ['✍️', '12 AI-humanized content pieces'],
            ['🏗️', 'Bridge page + lead magnet PDF'],
            ['📡', 'Published to dev.to, Hashnode, Blogger, Tumblr'],
            ['📬', '14-day email drip via Listmonk'],
            ['📢', '10 Telegram posts scheduled'],
          ].map(([icon, label]) => (
            <div key={label} className="bg-slate-900/60 rounded-xl p-4 border border-slate-800">
              <div className="text-2xl mb-1">{icon}</div>
              <div>{label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

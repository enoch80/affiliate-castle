'use client'

import { useEffect, useState, useTransition } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'

interface LatestRank {
  platform: string
  platformUrl: string
  keyword: string
  rank: number | null
  inTop10: boolean
  inTop50: boolean
  checkedAt: string
}

interface RankingsPayload {
  campaignId: string
  bestRank: number | null
  top10Count: number
  top50Count: number
  latest: LatestRank[]
  history: Array<{
    date: string
    platforms: Record<string, number | null>
  }>
}

function RankBadge({ rank, inTop10, inTop50 }: { rank: number | null; inTop10: boolean; inTop50: boolean }) {
  if (inTop10) return <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-yellow-900/40 text-yellow-300 border border-yellow-700">🥇 Top 10 · #{rank}</span>
  if (inTop50) return <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-indigo-900/40 text-indigo-300 border border-indigo-700">📊 Top 50 · #{rank}</span>
  if (rank) return <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-slate-700 text-slate-300 border border-slate-600">#{rank}</span>
  return <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-slate-700 text-slate-400 border border-slate-600">Not found</span>
}

export default function RankingsPage() {
  const { id } = useParams<{ id: string }>()
  const [data, setData] = useState<RankingsPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [checking, startCheck] = useTransition()
  const [checkMsg, setCheckMsg] = useState('')

  const load = () => {
    setLoading(true)
    fetch(`/api/campaigns/${id}/rankings`)
      .then((r) => r.json())
      .then((d) => { if (d.error) throw new Error(d.error); setData(d) })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Failed'))
      .finally(() => setLoading(false))
  }

  useEffect(load, [id])

  const triggerCheck = () => {
    startCheck(async () => {
      setCheckMsg('')
      const r = await fetch(`/api/campaigns/${id}/rankings`, { method: 'POST' })
      const d = await r.json()
      if (d.error) { setCheckMsg(`Error: ${d.error}`); return }
      setCheckMsg(`Checked ${d.urlsChecked ?? 0} URLs — best rank: ${d.bestRank ?? 'none'}`)
      load()
    })
  }

  if (loading) return <div className="p-8 text-slate-400 animate-pulse">Loading rankings…</div>
  if (error) return <div className="p-8 text-red-400">{error}</div>
  if (!data) return null

  return (
    <div className="p-8 max-w-3xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href={`/dashboard/campaigns/${id}`} className="text-slate-400 hover:text-white text-sm">← Campaign</Link>
        <span className="text-slate-600">/</span>
        <span className="text-white font-semibold text-sm">Search Rankings</span>
      </div>

      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-bold text-white">Bing Search Rankings</h2>
        <button
          onClick={triggerCheck}
          disabled={checking}
          className="text-sm bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-4 py-1.5 rounded-lg font-semibold transition-colors"
        >
          {checking ? 'Checking…' : 'Run Live Check'}
        </button>
      </div>

      {checkMsg && (
        <div className="mb-4 text-sm text-green-300 bg-green-900/30 border border-green-800 rounded-lg px-4 py-2">
          {checkMsg}
        </div>
      )}

      {/* KPI row */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-white">{data.bestRank ?? '—'}</div>
          <div className="text-xs text-slate-400 mt-1">Best Rank</div>
        </div>
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-yellow-400">{data.top10Count}</div>
          <div className="text-xs text-slate-400 mt-1">Top 10</div>
        </div>
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-indigo-400">{data.top50Count}</div>
          <div className="text-xs text-slate-400 mt-1">Top 50</div>
        </div>
      </div>

      {/* Latest snapshots */}
      <div className="space-y-3">
        {data.latest.length === 0 && (
          <div className="text-center text-slate-500 py-12">
            No ranking data yet. Click "Run Live Check" to check your published URLs.
          </div>
        )}
        {data.latest.map((item, i) => (
          <div key={`${item.platform}-${i}`} className="bg-slate-800 border border-slate-700 rounded-xl px-5 py-4">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-white capitalize mb-0.5">{item.platform}</div>
                <a
                  href={item.platformUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-indigo-400 hover:text-indigo-300 truncate block"
                >
                  {item.platformUrl}
                </a>
                {item.keyword && (
                  <div className="text-xs text-slate-500 mt-1">Keyword: {item.keyword}</div>
                )}
                <div className="text-xs text-slate-600 mt-1">
                  Last checked {new Date(item.checkedAt).toLocaleDateString()}
                </div>
              </div>
              <RankBadge rank={item.rank} inTop10={item.inTop10} inTop50={item.inTop50} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

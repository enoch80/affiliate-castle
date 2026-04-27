'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts'

interface FunnelStage { stage: string; value: number; description: string }
interface PlatformRow { platform: string; clicks: number; conversions: number; revenue: number; epc: number; conversionRate: number }
interface DailyStat { date: string; clicks: number; conversions: number; revenue: number; optIns: number }
interface SummaryData { totalClicks: number; totalConversions: number; totalRevenue: number; epc: number; conversionRate: number }

interface AnalyticsPayload {
  campaignId: string
  campaignName: string
  summary: SummaryData
  series: DailyStat[]
  funnel: FunnelStage[]
  platformBreakdown: PlatformRow[]
}

function fmtDate(iso: string) {
  const d = new Date(iso)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

export default function TrackingPage() {
  const { id } = useParams<{ id: string }>()
  const [data, setData] = useState<AnalyticsPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch(`/api/campaigns/${id}/analytics`)
      .then((r) => r.json())
      .then((d) => { if (d.error) throw new Error(d.error); setData(d) })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Failed'))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return <div className="p-8 text-slate-400 animate-pulse">Loading tracking data…</div>
  if (error) return <div className="p-8 text-red-400">{error}</div>
  if (!data) return null

  const { summary, series, funnel, platformBreakdown } = data
  const chartData = series.map((s) => ({ ...s, date: fmtDate(s.date) }))

  // Funnel % of first stage for width bars
  const maxFunnelVal = funnel[0]?.value || 1

  return (
    <div className="p-4 sm:p-8 max-w-5xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href={`/dashboard/campaigns/${id}`} className="text-slate-400 hover:text-white text-sm">← Campaign</Link>
        <span className="text-slate-600">/</span>
        <span className="text-white font-semibold text-sm">Tracking</span>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Total Clicks', value: summary.totalClicks.toLocaleString(), color: 'text-indigo-400' },
          { label: 'Conversions', value: summary.totalConversions.toLocaleString(), color: 'text-yellow-400' },
          { label: 'Revenue', value: `$${summary.totalRevenue.toFixed(2)}`, color: 'text-green-400' },
          { label: 'EPC', value: `$${summary.epc}`, color: 'text-white' },
        ].map((s) => (
          <div key={s.label} className="bg-slate-800 border border-slate-700 rounded-xl p-5">
            <div className="text-xs text-slate-400 uppercase tracking-wide mb-1">{s.label}</div>
            <div className={`text-3xl font-extrabold ${s.color}`}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* 30-day clicks chart */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 mb-6">
        <div className="text-sm font-semibold text-slate-200 mb-4">Daily Clicks — 30 Days</div>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={chartData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
            <XAxis dataKey="date" tick={{ fill: '#64748B', fontSize: 11 }} tickLine={false} axisLine={{ stroke: '#334155' }} interval={4} />
            <YAxis tick={{ fill: '#64748B', fontSize: 11 }} tickLine={false} axisLine={false} width={30} />
            <Tooltip contentStyle={{ background: '#1E293B', border: '1px solid #334155', borderRadius: 8 }} itemStyle={{ color: '#6366F1', fontWeight: 700 }} />
            <Bar dataKey="clicks" fill="#6366F1" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Conversion funnel */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 mb-6">
        <div className="text-sm font-semibold text-slate-200 mb-4">Conversion Funnel</div>
        <div className="space-y-3">
          {funnel.map((stage, i) => {
            const pct = maxFunnelVal > 0 ? Math.round((stage.value / maxFunnelVal) * 100) : 0
            const dropPct = i > 0 && funnel[i - 1].value > 0
              ? Math.round((1 - stage.value / funnel[i - 1].value) * 100)
              : null
            return (
              <div key={stage.stage}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-slate-300">{stage.stage}</span>
                  <div className="flex items-center gap-3">
                    {dropPct !== null && dropPct > 0 && (
                      <span className="text-xs text-red-400">↓{dropPct}% drop</span>
                    )}
                    <span className="text-sm font-bold text-white">{stage.value.toLocaleString()}</span>
                  </div>
                </div>
                <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-indigo-500 transition-all"
                    style={{ width: `${Math.max(pct, stage.value > 0 ? 2 : 0)}%` }}
                  />
                </div>
                <div className="text-xs text-slate-500 mt-0.5">{stage.description}</div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Platform EPC breakdown */}
      {platformBreakdown.length > 0 && (
        <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-700">
            <div className="text-sm font-semibold text-slate-200">Platform EPC Breakdown</div>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700 text-xs text-slate-400 uppercase tracking-wide">
                <th className="px-6 py-3 text-left">Platform</th>
                <th className="px-6 py-3 text-right">Clicks</th>
                <th className="px-6 py-3 text-right">Conversions</th>
                <th className="px-6 py-3 text-right">Revenue</th>
                <th className="px-6 py-3 text-right">EPC</th>
                <th className="px-6 py-3 text-right">Conv. Rate</th>
              </tr>
            </thead>
            <tbody>
              {platformBreakdown.map((p) => (
                <tr key={p.platform} className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors">
                  <td className="px-6 py-3 font-medium text-white capitalize">{p.platform}</td>
                  <td className="px-6 py-3 text-right text-slate-300">{p.clicks}</td>
                  <td className="px-6 py-3 text-right text-yellow-400">{p.conversions}</td>
                  <td className="px-6 py-3 text-right text-green-400">${p.revenue.toFixed(2)}</td>
                  <td className="px-6 py-3 text-right text-indigo-400 font-bold">${p.epc}</td>
                  <td className="px-6 py-3 text-right text-slate-300">{p.conversionRate}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

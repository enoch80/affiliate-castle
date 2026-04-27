'use client'

import { useEffect, useState } from 'react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts'

interface DailyStat {
  date: string
  clicks: number
  conversions: number
  revenue: number
  optIns: number
}

interface AnalyticsData {
  totalClicks: number
  totalConversions: number
  totalRevenue: number
  totalOptIns: number
  epc: number
  campaignCount: number
  activeCampaignCount: number
  series: DailyStat[]
}

function StatCard({
  label,
  value,
  sub,
  color = 'text-white',
}: {
  label: string
  value: string
  sub?: string
  color?: string
}) {
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
      <div className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-1">{label}</div>
      <div className={`text-3xl font-extrabold ${color}`}>{value}</div>
      {sub && <div className="text-xs text-slate-500 mt-1">{sub}</div>}
    </div>
  )
}

const CHART_METRIC_OPTIONS = [
  { key: 'clicks', label: 'Clicks', color: '#6366F1' },
  { key: 'revenue', label: 'Revenue ($)', color: '#22C55E' },
  { key: 'optIns', label: 'Opt-ins', color: '#F97316' },
  { key: 'conversions', label: 'Conversions', color: '#EAB308' },
] as const

type MetricKey = (typeof CHART_METRIC_OPTIONS)[number]['key']

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [metric, setMetric] = useState<MetricKey>('clicks')
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/analytics')
      .then((r) => r.json())
      .then((d) => {
        if (d.error) throw new Error(d.error)
        setData(d)
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false))
  }, [])

  const selected = CHART_METRIC_OPTIONS.find((o) => o.key === metric)!

  function fmtDate(iso: string) {
    const d = new Date(iso)
    return `${d.getMonth() + 1}/${d.getDate()}`
  }

  if (loading) {
    return (
      <div className="p-4 sm:p-8">
        <h1 className="text-2xl font-bold text-white mb-6">Analytics</h1>
        <div className="text-slate-400 animate-pulse">Loading metrics…</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 sm:p-8">
        <h1 className="text-2xl font-bold text-white mb-4">Analytics</h1>
        <div className="bg-red-900/30 border border-red-700 text-red-300 px-4 py-3 rounded-lg">{error}</div>
      </div>
    )
  }

  if (!data) return null

  const chartData = data.series.map((s) => ({ ...s, date: fmtDate(s.date) }))

  return (
    <div className="p-4 sm:p-8 max-w-5xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Analytics</h1>
        <p className="text-slate-400 mt-1 text-sm">All campaigns · last 30 days</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Clicks" value={data.totalClicks.toLocaleString()} sub="unique tracked clicks" />
        <StatCard label="Opt-ins" value={data.totalOptIns.toLocaleString()} sub="email list sign-ups" color="text-orange-400" />
        <StatCard label="Conversions" value={data.totalConversions.toLocaleString()} sub="confirmed sales" color="text-yellow-400" />
        <StatCard label="Revenue" value={`$${data.totalRevenue.toFixed(2)}`} sub={`EPC: $${data.epc}`} color="text-green-400" />
      </div>

      <div className="grid grid-cols-2 gap-4 mb-8">
        <StatCard label="Total Campaigns" value={String(data.campaignCount)} />
        <StatCard label="Active Campaigns" value={String(data.activeCampaignCount)} color="text-indigo-400" />
      </div>

      {/* Chart */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
        <div className="flex items-center justify-between mb-5">
          <div className="text-sm font-semibold text-slate-200">30-Day Trend</div>
          <div className="flex gap-2 flex-wrap">
            {CHART_METRIC_OPTIONS.map((o) => (
              <button
                key={o.key}
                onClick={() => setMetric(o.key)}
                className={`text-xs px-3 py-1 rounded-full font-medium transition-colors ${
                  metric === o.key ? 'bg-indigo-600 text-white' : 'bg-slate-700 text-slate-400 hover:text-white'
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={chartData} margin={{ top: 5, right: 0, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="colorMetric" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={selected.color} stopOpacity={0.25} />
                <stop offset="95%" stopColor={selected.color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
            <XAxis dataKey="date" tick={{ fill: '#64748B', fontSize: 11 }} tickLine={false} axisLine={{ stroke: '#334155' }} interval={4} />
            <YAxis tick={{ fill: '#64748B', fontSize: 11 }} tickLine={false} axisLine={false} width={40} />
            <Tooltip
              contentStyle={{ background: '#1E293B', border: '1px solid #334155', borderRadius: 8 }}
              labelStyle={{ color: '#94A3B8', fontSize: 12 }}
              itemStyle={{ color: selected.color, fontWeight: 700 }}
            />
            <Area type="monotone" dataKey={metric} stroke={selected.color} strokeWidth={2} fill="url(#colorMetric)" dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

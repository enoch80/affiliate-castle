// Placeholder — Sprint 10 will add full analytics charts
export default function AnalyticsPage() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-white mb-2">Analytics</h1>
      <p className="text-slate-400 mb-8">Full analytics dashboard arrives in Sprint 10.</p>
      <div className="grid grid-cols-4 gap-5">
        {[
          { label: 'Total Clicks', value: '—' },
          { label: 'Opt-ins', value: '—' },
          { label: 'Conversions', value: '—' },
          { label: 'Revenue', value: '—' },
        ].map(stat => (
          <div key={stat.label} className="bg-slate-800 border border-slate-700 rounded-xl p-5">
            <div className="text-sm text-slate-400 mb-1">{stat.label}</div>
            <div className="text-3xl font-extrabold text-white">{stat.value}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

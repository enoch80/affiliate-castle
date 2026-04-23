// Placeholder — Sprint 2 will wire real campaign data
export default function CampaignDetailPage({ params }: { params: { id: string } }) {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-white mb-2">Campaign #{params.id}</h1>
      <p className="text-slate-400 mb-8">Processing… The engine is working on your campaign.</p>
      <div className="grid grid-cols-3 gap-5">
        {[
          { label: 'Status', value: 'Processing', color: 'text-yellow-400' },
          { label: 'Content Pieces', value: '0 / 12', color: 'text-slate-300' },
          { label: 'Published', value: '0 / 4', color: 'text-slate-300' },
        ].map(stat => (
          <div key={stat.label} className="bg-slate-800 border border-slate-700 rounded-xl p-5">
            <div className="text-sm text-slate-400 mb-1">{stat.label}</div>
            <div className={`text-2xl font-bold ${stat.color}`}>{stat.value}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

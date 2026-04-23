import Link from 'next/link'

// Placeholder — Sprint 2 will populate from DB via Prisma
export default function CampaignsPage() {
  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Campaigns</h1>
          <p className="text-slate-400 mt-1">All active and completed affiliate campaigns</p>
        </div>
        <Link
          href="/dashboard/dashboard"
          className="bg-orange-500 hover:bg-orange-400 text-white font-bold px-5 py-2.5 rounded-lg text-sm transition-colors"
        >
          + New Campaign
        </Link>
      </div>

      {/* Empty state */}
      <div className="bg-slate-800 border border-slate-700 rounded-2xl p-16 text-center">
        <div className="text-5xl mb-4">📋</div>
        <h2 className="text-xl font-bold text-white mb-2">No campaigns yet</h2>
        <p className="text-slate-400 mb-6">Launch your first campaign by pasting an affiliate hoplink.</p>
        <Link
          href="/dashboard/dashboard"
          className="inline-block bg-orange-500 hover:bg-orange-400 text-white font-bold px-8 py-3 rounded-xl transition-colors"
        >
          🚀 Launch First Campaign
        </Link>
      </div>
    </div>
  )
}

import Link from 'next/link'
import { prisma } from '@/lib/prisma'

const STATUS_BADGE: Record<string, { label: string; color: string }> = {
  draft:     { label: 'Draft',     color: 'bg-slate-600 text-slate-200' },
  pending:   { label: 'Pending',   color: 'bg-yellow-700 text-yellow-200' },
  researched:{ label: 'Researched',color: 'bg-blue-700 text-blue-100' },
  active:    { label: 'Active',    color: 'bg-green-700 text-green-100' },
  paused:    { label: 'Paused',    color: 'bg-orange-700 text-orange-100' },
  completed: { label: 'Completed', color: 'bg-purple-700 text-purple-100' },
}

export default async function CampaignsPage() {
  const campaigns = await prisma.campaign.findMany({
    orderBy: { createdAt: 'desc' },
    include: { offer: true },
  })

  return (
    <div className="p-4 sm:p-8">
      <div className="flex items-center justify-between mb-6 sm:mb-8 gap-3">
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

      {campaigns.length === 0 ? (
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
      ) : (
        <div className="space-y-3">
          {campaigns.map(c => {
            const badge = STATUS_BADGE[c.status] ?? STATUS_BADGE.draft
            return (
              <Link
                key={c.id}
                href={`/dashboard/campaigns/${c.id}`}
                className="flex items-start sm:items-center justify-between bg-slate-800 border border-slate-700 rounded-xl px-4 sm:px-6 py-3 sm:py-4 hover:border-orange-500 transition-colors gap-3"
              >
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-white truncate">{c.name}</div>
                  <div className="text-xs text-slate-400 mt-0.5 truncate">{c.offer?.hoplink}</div>
                  {/* Mobile: status badge inline with name */}
                  <div className="mt-1 sm:hidden">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${badge.color}`}>
                      {badge.label}
                    </span>
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row items-end sm:items-center gap-1 sm:gap-4 shrink-0">
                  <span className={`hidden sm:inline text-xs font-medium px-2.5 py-1 rounded-full ${badge.color}`}>
                    {badge.label}
                  </span>
                  <div className="text-right text-sm">
                    <div className="text-white font-bold">${c.totalRevenue.toFixed(2)}</div>
                    <div className="text-slate-400 text-xs">{c.totalConversions} conv.</div>
                  </div>
                  <span className="hidden sm:inline text-slate-500 text-xs">{new Date(c.createdAt).toLocaleDateString()}</span>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}

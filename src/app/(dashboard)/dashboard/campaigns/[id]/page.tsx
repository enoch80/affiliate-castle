import { notFound } from 'next/navigation'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'

const STATUS_COLOR: Record<string, string> = {
  draft:            'text-slate-400',
  pending:          'text-yellow-400',
  resolved:         'text-blue-400',
  scraped:          'text-cyan-400',
  researched:       'text-green-400',
  scrape_failed:    'text-red-400',
  extraction_failed:'text-red-400',
}

export default async function CampaignDetailPage({ params }: { params: { id: string } }) {
  const campaign = await prisma.campaign.findUnique({
    where: { id: params.id },
    include: {
      offer: {
        include: {
          marketResearch: true,
          keywordResearch: { orderBy: { createdAt: 'desc' }, take: 1 },
        },
      },
      contentPieces: { orderBy: { createdAt: 'desc' } },
    },
  })

  if (!campaign) notFound()

  const { offer } = campaign
  const research = offer?.marketResearch
  const offerStatus = offer?.status ?? 'pending'
  const isPending = ['pending', 'resolved', 'scraped'].includes(offerStatus)

  const stats = [
    { label: 'Campaign Status', value: campaign.status.toUpperCase(), color: STATUS_COLOR[campaign.status] ?? 'text-slate-300' },
    { label: 'Content Pieces',  value: `${campaign.contentPieces.length}`, color: 'text-slate-300' },
    { label: 'Conversions',     value: String(campaign.totalConversions), color: 'text-slate-300' },
    { label: 'Revenue',         value: `$${campaign.totalRevenue.toFixed(2)}`, color: 'text-green-400' },
  ]

  return (
    <div className="p-8 max-w-5xl">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <Link href="/dashboard/campaigns" className="text-slate-400 hover:text-white text-sm">← Campaigns</Link>
          </div>
          <h1 className="text-2xl font-bold text-white">{campaign.name}</h1>
          <p className="text-slate-400 text-sm mt-1 break-all">{offer?.hoplink}</p>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        {stats.map(s => (
          <div key={s.label} className="bg-slate-800 border border-slate-700 rounded-xl p-4">
            <div className="text-xs text-slate-400 mb-1">{s.label}</div>
            <div className={`text-xl font-bold ${s.color}`}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Pipeline status card */}
      {isPending && (
        <div className="bg-slate-800 border border-yellow-600 rounded-xl p-6 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-yellow-400 animate-pulse" />
            <div>
              <div className="font-semibold text-yellow-300">Pipeline Running</div>
              <div className="text-slate-400 text-sm mt-0.5">
                Offer is <span className="text-yellow-200 font-medium">{offerStatus}</span>. 
                This page auto-refreshes when done.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Offer details — shown once researched */}
      {offer?.productName && (
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 mb-6">
          <h2 className="text-lg font-bold text-white mb-4">Offer Details</h2>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div><span className="text-slate-400">Product:</span> <span className="text-white ml-2">{offer.productName}</span></div>
            <div><span className="text-slate-400">Niche:</span> <span className="text-white ml-2 capitalize">{offer.niche}</span></div>
            <div><span className="text-slate-400">Price:</span> <span className="text-white ml-2">{offer.pricePoint ? `$${offer.pricePoint}` : 'Unknown'}</span></div>
            <div><span className="text-slate-400">Commission:</span> <span className="text-white ml-2">{offer.commissionPct ? `${offer.commissionPct}%` : offer.commissionFixed ? `$${offer.commissionFixed}` : 'Unknown'}</span></div>
            <div><span className="text-slate-400">Network:</span> <span className="text-white ml-2 capitalize">{offer.network}</span></div>
            <div><span className="text-slate-400">Resolved URL:</span> <a href={offer.resolvedUrl ?? '#'} target="_blank" rel="noopener noreferrer" className="text-orange-400 hover:underline ml-2 truncate block max-w-xs">Visit Page</a></div>
          </div>
        </div>
      )}

      {/* Market Research */}
      {research && (
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 mb-6">
          <h2 className="text-lg font-bold text-white mb-4">Market Research</h2>
          <div className="grid grid-cols-2 gap-6 text-sm">
            {[['Target Audience', research.targetAudience], ['Pain Points', research.painPoints], ['Benefits', research.benefits], ['Trust Signals', research.trustSignals]].map(([label, items]) => (
              <div key={String(label)}>
                <div className="text-slate-400 font-medium mb-2">{String(label)}</div>
                <ul className="space-y-1">
                  {(items as string[] ?? []).map((item, i) => (
                    <li key={i} className="text-slate-200 flex items-start gap-2">
                      <span className="text-orange-400 mt-0.5">•</span> {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Campaign angle */}
      {campaign.angle && (
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
          <div className="text-slate-400 text-sm mb-1">Campaign Angle</div>
          <div className="text-white font-medium">{campaign.angle}</div>
        </div>
      )}
    </div>
  )
}

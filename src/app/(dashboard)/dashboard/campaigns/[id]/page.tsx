import { notFound } from 'next/navigation'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'

const STATUS_COLOR: Record<string, string> = {
  draft:              'text-slate-400',
  pending:            'text-yellow-400',
  resolved:           'text-blue-400',
  scraped:            'text-cyan-400',
  researched:         'text-green-400',
  brief_ready:        'text-indigo-400',
  scrape_failed:      'text-red-400',
  extraction_failed:  'text-red-400',
}

/** 8-step pipeline progress bar */
const PIPELINE_STEPS = [
  { key: 'parsed',        label: 'Parsed' },
  { key: 'researched',    label: 'Researched' },
  { key: 'brief_ready',   label: 'Brief Ready' },
  { key: 'content_ready', label: 'Content Ready' },
  { key: 'bridge_live',   label: 'Bridge Live' },
  { key: 'publishing',    label: 'Publishing' },
  { key: 'indexed',       label: 'Indexed' },
  { key: 'live',          label: 'Live' },
]

const STEP_ORDER = PIPELINE_STEPS.map((s) => s.key)

function getPipelineIndex(status: string): number {
  if (status === 'pending') return 0
  if (status === 'resolved' || status === 'scraped') return 0
  if (status === 'researched') return 1
  if (status === 'brief_ready') return 2
  if (status === 'content_ready') return 3
  if (status === 'bridge_live') return 4
  if (status === 'publishing') return 5
  if (status === 'indexed') return 6
  if (status === 'live') return 7
  return 0
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
  const isResearched = offerStatus === 'researched'
  const isBriefReady = offerStatus === 'brief_ready'

  // Find content brief if available
  const briefPiece = campaign.contentPieces.find((p) => p.type === 'content_brief')
  const brief = (briefPiece?.serpBriefJson as Record<string, unknown> | null) ?? null

  // Keyword research
  const keywordData = offer?.keywordResearch?.[0]

  const stats = [
    { label: 'Campaign Status', value: campaign.status.toUpperCase(), color: STATUS_COLOR[campaign.status] ?? 'text-slate-300' },
    { label: 'Content Pieces',  value: `${campaign.contentPieces.length}`, color: 'text-slate-300' },
    { label: 'Conversions',     value: String(campaign.totalConversions), color: 'text-slate-300' },
    { label: 'Revenue',         value: `$${campaign.totalRevenue.toFixed(2)}`, color: 'text-green-400' },
  ]

  const pipelineIndex = getPipelineIndex(campaign.status)

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

      {/* Pipeline Progress Bar */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 mb-6">
        <div className="text-sm font-semibold text-slate-300 mb-4">Pipeline Progress</div>
        <div className="flex items-center gap-0">
          {PIPELINE_STEPS.map((step, idx) => {
            const done = idx < pipelineIndex
            const active = idx === pipelineIndex
            const pending = idx > pipelineIndex
            return (
              <div key={step.key} className="flex items-center flex-1 min-w-0">
                <div className="flex flex-col items-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all ${
                    done   ? 'bg-indigo-600 border-indigo-500 text-white' :
                    active ? 'bg-slate-700 border-indigo-400 text-indigo-300 animate-pulse' :
                             'bg-slate-800 border-slate-600 text-slate-500'
                  }`}>
                    {done ? '✓' : idx + 1}
                  </div>
                  <div className={`text-xs mt-1 text-center max-w-[60px] leading-tight ${
                    done ? 'text-indigo-300' : active ? 'text-white font-semibold' : 'text-slate-500'
                  }`}>{step.label}</div>
                </div>
                {idx < PIPELINE_STEPS.length - 1 && (
                  <div className={`h-0.5 flex-1 mx-1 mt-[-14px] ${done ? 'bg-indigo-600' : 'bg-slate-700'}`} />
                )}
              </div>
            )
          })}
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

      {/* Pipeline status card (while processing) */}
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

      {isResearched && (
        <div className="bg-slate-800 border border-cyan-600 rounded-xl p-6 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-cyan-400 animate-pulse" />
            <div>
              <div className="font-semibold text-cyan-300">Generating Content Brief</div>
              <div className="text-slate-400 text-sm mt-0.5">
                Market research complete — scraping Bing SERP top 10 and analyzing semantic gaps…
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

      {/* Content Brief — Sprint 3 */}
      {brief && (
        <div className="bg-slate-800 border border-indigo-700 rounded-xl p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-white">Content Brief</h2>
            <span className="text-xs bg-indigo-900 text-indigo-300 px-2 py-1 rounded-full font-medium">Sprint 3</span>
          </div>

          <div className="grid grid-cols-3 gap-4 mb-6 text-sm">
            <div className="bg-slate-900 rounded-lg p-3">
              <div className="text-slate-400 text-xs mb-1">Primary Keyword</div>
              <div className="text-indigo-300 font-semibold">{brief.primaryKeyword as string}</div>
            </div>
            <div className="bg-slate-900 rounded-lg p-3">
              <div className="text-slate-400 text-xs mb-1">Target Word Count</div>
              <div className="text-white font-semibold">{brief.targetWordCount as number} words</div>
            </div>
            <div className="bg-slate-900 rounded-lg p-3">
              <div className="text-slate-400 text-xs mb-1">Avg Competitor</div>
              <div className="text-slate-300 font-semibold">{brief.avgCompetitorWordCount as number} words</div>
            </div>
          </div>

          <div className="mb-4">
            <div className="text-slate-400 text-xs font-medium mb-2">Proposed Title</div>
            <div className="text-white text-sm border border-slate-600 rounded px-3 py-2">{brief.proposedTitle as string}</div>
          </div>

          <div className="mb-4">
            <div className="text-slate-400 text-xs font-medium mb-2">Meta Description</div>
            <div className="text-slate-300 text-sm border border-slate-600 rounded px-3 py-2">{brief.proposedMetaDescription as string}</div>
          </div>

          {/* Mandatory entities */}
          {Array.isArray(brief.mandatoryEntities) && brief.mandatoryEntities.length > 0 && (
            <div className="mb-4">
              <div className="text-slate-400 text-xs font-medium mb-2">Mandatory Entities ({(brief.mandatoryEntities as string[]).length})</div>
              <div className="flex flex-wrap gap-1.5">
                {(brief.mandatoryEntities as string[]).map((e, i) => (
                  <span key={i} className="bg-red-950 text-red-300 text-xs px-2 py-0.5 rounded-full">{e}</span>
                ))}
              </div>
            </div>
          )}

          {/* LSI terms */}
          {Array.isArray(brief.lsiTerms) && brief.lsiTerms.length > 0 && (
            <div className="mb-4">
              <div className="text-slate-400 text-xs font-medium mb-2">LSI Terms</div>
              <div className="flex flex-wrap gap-1.5">
                {(brief.lsiTerms as string[]).slice(0, 20).map((t, i) => (
                  <span key={i} className="bg-slate-700 text-slate-300 text-xs px-2 py-0.5 rounded-full">{t}</span>
                ))}
              </div>
            </div>
          )}

          {/* Suggested outline */}
          {Array.isArray(brief.suggestedOutline) && (
            <div>
              <div className="text-slate-400 text-xs font-medium mb-2">Suggested Article Outline</div>
              <div className="space-y-1 text-sm">
                {(brief.suggestedOutline as Array<{ level: string; text: string; targetWords?: number; notes: string }>).map((section, i) => (
                  <div key={i} className={`flex items-start gap-2 px-3 py-2 rounded-lg ${section.level === 'h1' ? 'bg-indigo-950' : section.level === 'h2' ? 'bg-slate-750' : 'bg-slate-900'}`}>
                    <span className={`text-xs font-mono mt-0.5 w-8 shrink-0 ${section.level === 'h1' ? 'text-indigo-400' : 'text-slate-500'}`}>{section.level.toUpperCase()}</span>
                    <div className="flex-1">
                      <div className="text-white">{section.text}</div>
                      <div className="text-slate-500 text-xs mt-0.5">{section.notes} {section.targetWords ? `· ~${section.targetWords} words` : ''}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Keyword research (raw) */}
      {keywordData && !brief && (
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 mb-6">
          <h2 className="text-lg font-bold text-white mb-4">Keyword Research</h2>
          <div className="text-sm">
            <div className="text-slate-400 mb-1">Primary Keyword</div>
            <div className="text-indigo-300 font-semibold mb-4">{keywordData.primaryKeyword}</div>
            {keywordData.targetWordCount && (
              <div className="text-slate-400 text-sm">Target: <span className="text-white">{keywordData.targetWordCount} words</span></div>
            )}
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

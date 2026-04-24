'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'

interface PlatformStatus {
  platform: string
  status: string
  platformUrl: string | null
  publishedAt: string | null
}

interface PublishingPayload {
  campaignId: string
  campaignStatus: string
  publishedCount: number
  allPublished: boolean
  anyPublished: boolean
  platforms: PlatformStatus[]
  liveUrls: string[]
}

const PLATFORM_ICON: Record<string, string> = {
  devto: '👩‍💻',
  hashnode: '#️⃣',
  blogger: '📝',
  tumblr: '🌀',
}

const STATUS_STYLE: Record<string, string> = {
  published: 'bg-green-900/40 text-green-300 border-green-800',
  queued: 'bg-yellow-900/40 text-yellow-300 border-yellow-800',
  failed: 'bg-red-900/40 text-red-300 border-red-800',
  pending: 'bg-slate-700 text-slate-300 border-slate-600',
}

export default function PublishingPage() {
  const { id } = useParams<{ id: string }>()
  const [data, setData] = useState<PublishingPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch(`/api/campaigns/${id}/publishing`)
      .then((r) => r.json())
      .then((d) => { if (d.error) throw new Error(d.error); setData(d) })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Failed'))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return <div className="p-8 text-slate-400 animate-pulse">Loading publishing status…</div>
  if (error) return <div className="p-8 text-red-400">{error}</div>
  if (!data) return null

  return (
    <div className="p-8 max-w-3xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href={`/dashboard/campaigns/${id}`} className="text-slate-400 hover:text-white text-sm">← Campaign</Link>
        <span className="text-slate-600">/</span>
        <span className="text-white font-semibold text-sm">Publishing</span>
      </div>

      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-bold text-white">Platform Publish Status</h2>
        <span className={`text-xs font-bold px-3 py-1 rounded-full border ${data.allPublished ? 'bg-green-900/40 text-green-300 border-green-800' : 'bg-slate-700 text-slate-300 border-slate-600'}`}>
          {data.publishedCount} / {data.platforms.length} published
        </span>
      </div>

      <div className="space-y-3 mb-8">
        {data.platforms.map((p) => {
          const style = STATUS_STYLE[p.status] ?? STATUS_STYLE.pending
          return (
            <div key={p.platform} className="bg-slate-800 border border-slate-700 rounded-xl px-6 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{PLATFORM_ICON[p.platform] ?? '📄'}</span>
                  <div>
                    <div className="font-semibold text-white capitalize">{p.platform}</div>
                    {p.publishedAt && (
                      <div className="text-xs text-slate-400 mt-0.5">
                        Published {new Date(p.publishedAt).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${style}`}>
                    {p.status}
                  </span>
                  {p.platformUrl && (
                    <a
                      href={p.platformUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-indigo-400 hover:text-indigo-300 underline"
                    >
                      View Live →
                    </a>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {data.liveUrls.length > 0 && (
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
          <div className="text-sm font-semibold text-slate-200 mb-3">Live URLs</div>
          <div className="space-y-2">
            {data.liveUrls.map((url) => (
              <a
                key={url}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="block text-xs text-indigo-400 hover:text-indigo-300 truncate"
              >
                {url}
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'

interface TelegramPost {
  order: number
  type: string
  content: string
  status: string
  scheduledFor: string | null
  sentAt: string | null
  messageId: string | null
}

interface TelegramPayload {
  campaignId: string
  channelId: string | null
  totalPosts: number
  sentCount: number
  pendingCount: number
  posts: TelegramPost[]
}

const TYPE_ICON: Record<string, string> = {
  teaser: '💡',
  value: '📌',
  proof: '🏆',
  cta: '🚨',
  followup: '🔁',
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    sent: 'bg-green-900/40 text-green-300 border-green-700',
    pending: 'bg-slate-700 text-slate-300 border-slate-600',
    scheduled: 'bg-indigo-900/40 text-indigo-300 border-indigo-700',
    failed: 'bg-red-900/40 text-red-300 border-red-700',
  }
  return (
    <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${styles[status] ?? styles.pending}`}>
      {status}
    </span>
  )
}

export default function TelegramPage() {
  const { id } = useParams<{ id: string }>()
  const [data, setData] = useState<TelegramPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch(`/api/campaigns/${id}/telegram`)
      .then((r) => r.json())
      .then((d) => { if (d.error) throw new Error(d.error); setData(d) })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Failed'))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return <div className="p-8 text-slate-400 animate-pulse">Loading Telegram schedule…</div>
  if (error) return <div className="p-8 text-red-400">{error}</div>
  if (!data) return null

  const pct = data.totalPosts > 0 ? Math.round((data.sentCount / data.totalPosts) * 100) : 0

  return (
    <div className="p-8 max-w-3xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href={`/dashboard/campaigns/${id}`} className="text-slate-400 hover:text-white text-sm">← Campaign</Link>
        <span className="text-slate-600">/</span>
        <span className="text-white font-semibold text-sm">Telegram</span>
      </div>

      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-white">Telegram Post Schedule</h2>
        <div className="text-sm text-slate-400">{data.sentCount}/{data.totalPosts} sent</div>
      </div>

      {/* Progress bar */}
      <div className="bg-slate-700 rounded-full h-2 mb-6">
        <div className="bg-indigo-500 h-2 rounded-full transition-all" style={{ width: `${pct}%` }} />
      </div>

      {data.channelId && (
        <div className="text-xs text-slate-400 mb-5">
          Channel: <span className="text-slate-200 font-mono">{data.channelId}</span>
        </div>
      )}

      <div className="space-y-3">
        {data.posts.map((post) => (
          <div
            key={post.order}
            className={`bg-slate-800 border rounded-xl px-5 py-4 ${post.status === 'sent' ? 'border-green-800/50' : 'border-slate-700'}`}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3 flex-1 min-w-0">
                <span className="text-lg mt-0.5 flex-shrink-0">{TYPE_ICON[post.type] ?? '📄'}</span>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-mono text-slate-500">#{post.order}</span>
                    <span className="text-xs text-slate-400 capitalize">{post.type}</span>
                  </div>
                  <p className="text-sm text-slate-300 truncate">{post.content}</p>
                  {post.sentAt && (
                    <div className="text-xs text-slate-500 mt-1">
                      Sent {new Date(post.sentAt).toLocaleDateString()} {new Date(post.sentAt).toLocaleTimeString()}
                    </div>
                  )}
                  {post.scheduledFor && !post.sentAt && (
                    <div className="text-xs text-slate-500 mt-1">
                      Scheduled {new Date(post.scheduledFor).toLocaleDateString()}
                    </div>
                  )}
                </div>
              </div>
              <StatusBadge status={post.status} />
            </div>
          </div>
        ))}
        {data.posts.length === 0 && (
          <div className="text-center text-slate-500 py-12">No Telegram posts generated yet.</div>
        )}
      </div>
    </div>
  )
}

'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'

interface EmailStep {
  stepNumber: number
  delayDays: number
  subject: string
  sentCount: number
  openCount: number
  clickCount: number
  openRate: number
  clickRate: number
}

interface EmailPayload {
  campaignId: string
  sequenceId: string | null
  totalSteps: number
  totalSent: number
  totalOpens: number
  totalClicks: number
  openRate: number
  steps: EmailStep[]
}

const STEP_EMOTION = [
  'RELIEF', 'TRUST', 'RESPECT', 'CURIOSITY', 'PROOF', 'SAFETY', 'URGENCY',
  'Re-engage 1', 'Re-engage 2', 'Re-engage 3',
]

export default function EmailPage() {
  const { id } = useParams<{ id: string }>()
  const [data, setData] = useState<EmailPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch(`/api/campaigns/${id}/email`)
      .then((r) => r.json())
      .then((d) => { if (d.error) throw new Error(d.error); setData(d) })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Failed'))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return <div className="p-8 text-slate-400 animate-pulse">Loading email sequence…</div>
  if (error) return <div className="p-8 text-red-400">{error}</div>
  if (!data) return null

  const isReEngage = (stepNumber: number) => stepNumber > 7

  return (
    <div className="p-4 sm:p-8 max-w-4xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href={`/dashboard/campaigns/${id}`} className="text-slate-400 hover:text-white text-sm">← Campaign</Link>
        <span className="text-slate-600">/</span>
        <span className="text-white font-semibold text-sm">Email Sequence</span>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Steps', value: String(data.totalSteps) },
          { label: 'Total Sent', value: data.totalSent.toLocaleString(), color: 'text-indigo-400' },
          { label: 'Total Opens', value: data.totalOpens.toLocaleString(), color: 'text-yellow-400' },
          { label: 'Open Rate', value: `${data.openRate}%`, color: data.openRate >= 20 ? 'text-green-400' : 'text-orange-400' },
        ].map((s) => (
          <div key={s.label} className="bg-slate-800 border border-slate-700 rounded-xl p-5">
            <div className="text-xs text-slate-400 uppercase tracking-wide mb-1">{s.label}</div>
            <div className={`text-3xl font-extrabold ${s.color ?? 'text-white'}`}>{s.value}</div>
          </div>
        ))}
      </div>

      {data.totalSteps === 0 ? (
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-10 text-center">
          <div className="text-4xl mb-3">📬</div>
          <div className="text-white font-semibold mb-1">No sequence yet</div>
          <div className="text-slate-400 text-sm">Email drip starts when a subscriber opts in through the bridge page.</div>
        </div>
      ) : (
        <div className="space-y-3">
          {data.steps.map((step) => {
            const emotion = STEP_EMOTION[step.stepNumber - 1] ?? `Step ${step.stepNumber}`
            const reEngage = isReEngage(step.stepNumber)
            return (
              <div
                key={step.stepNumber}
                className={`bg-slate-800 border rounded-xl px-6 py-4 ${reEngage ? 'border-orange-800/50' : 'border-slate-700'}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${reEngage ? 'bg-orange-900/50 text-orange-300' : 'bg-indigo-900/60 text-indigo-300'}`}>
                        {reEngage ? `Re-engage` : `Day ${step.delayDays}`} · {emotion}
                      </span>
                    </div>
                    <div className="text-sm font-medium text-white truncate">{step.subject}</div>
                  </div>
                  <div className="flex gap-5 text-right text-sm flex-shrink-0">
                    <div>
                      <div className="text-slate-400 text-xs">Sent</div>
                      <div className="font-bold text-white">{step.sentCount}</div>
                    </div>
                    <div>
                      <div className="text-slate-400 text-xs">Opens</div>
                      <div className="font-bold text-yellow-400">{step.openCount}</div>
                    </div>
                    <div>
                      <div className="text-slate-400 text-xs">Clicks</div>
                      <div className="font-bold text-indigo-400">{step.clickCount}</div>
                    </div>
                    <div>
                      <div className="text-slate-400 text-xs">Open%</div>
                      <div className={`font-bold ${step.openRate >= 20 ? 'text-green-400' : 'text-slate-300'}`}>
                        {step.sentCount > 0 ? `${step.openRate}%` : '—'}
                      </div>
                    </div>
                  </div>
                </div>
                {/* Mini progress bar for open rate */}
                {step.sentCount > 0 && (
                  <div className="mt-3 h-1 bg-slate-700 rounded-full overflow-hidden">
                    <div className="h-full bg-yellow-500 rounded-full" style={{ width: `${Math.min(step.openRate, 100)}%` }} />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

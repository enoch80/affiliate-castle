'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const TABS = [
  { label: 'Overview',   href: '' },
  { label: 'Tracking',   href: '/tracking' },
  { label: 'Email',      href: '/email' },
  { label: 'Publishing', href: '/publishing' },
  { label: 'Telegram',   href: '/telegram' },
  { label: 'Rankings',   href: '/rankings' },
]

export function CampaignSubNav({ campaignId }: { campaignId: string }) {
  const pathname = usePathname()
  const base = `/dashboard/campaigns/${campaignId}`

  return (
    <nav className="flex gap-1 mb-8 border-b border-slate-700 pb-0 overflow-x-auto scrollbar-none -mx-4 px-4 sm:mx-0 sm:px-0">
      {TABS.map((tab) => {
        const href = `${base}${tab.href}`
        const isActive = tab.href === ''
          ? pathname === base || pathname === `${base}/`
          : pathname.startsWith(href)
        return (
          <Link
            key={tab.label}
            href={href}
            className={`flex-shrink-0 px-4 py-2 text-sm font-medium rounded-t-lg transition-colors border-b-2 -mb-px ${
              isActive
                ? 'text-white border-indigo-500 bg-slate-800'
                : 'text-slate-400 border-transparent hover:text-white hover:border-slate-500'
            }`}
          >
            {tab.label}
          </Link>
        )
      })}
    </nav>
  )
}

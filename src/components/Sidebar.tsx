'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'
import { clsx } from 'clsx'

const nav = [
  { href: '/dashboard', label: 'Launch', icon: '🚀' },
  { href: '/dashboard/campaigns', label: 'Campaigns', icon: '📋' },
  { href: '/dashboard/analytics', label: 'Analytics', icon: '📊' },
  { href: '/dashboard/channels', label: 'Channels', icon: '📢' },
  { href: '/dashboard/settings', label: 'Settings', icon: '⚙️' },
]

function NavLinks({ pathname, onNav }: { pathname: string; onNav?: () => void }) {
  return (
    <>
      {nav.map(item => (
        <Link
          key={item.href}
          href={item.href}
          onClick={onNav}
          className={clsx(
            'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors duration-150',
            pathname === item.href
              ? 'bg-indigo-600 text-white'
              : 'text-slate-400 hover:bg-slate-800 hover:text-white'
          )}
        >
          <span className="text-base">{item.icon}</span>
          {item.label}
        </Link>
      ))}
    </>
  )
}

export function Sidebar() {
  const pathname = usePathname()
  const [drawerOpen, setDrawerOpen] = useState(false)

  return (
    <>
      {/* ── Desktop sidebar (lg+) ─────────────────────────────────── */}
      <aside className="hidden lg:flex w-56 flex-shrink-0 bg-slate-900 border-r border-slate-800 flex-col">
        {/* Logo */}
        <div className="px-5 py-6 border-b border-slate-800">
          <span className="text-xl font-extrabold text-white tracking-tight">🏰 Affiliate Castle</span>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          <NavLinks pathname={pathname} />
        </nav>

        {/* Sign out */}
        <div className="px-3 py-4 border-t border-slate-800">
          <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-400 hover:bg-slate-800 hover:text-white transition-colors duration-150"
          >
            <span className="text-base">🚪</span>
            Sign Out
          </button>
        </div>
      </aside>

      {/* ── Mobile top bar (< lg) ─────────────────────────────────── */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-40 h-14 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-4">
        <span className="text-base font-extrabold text-white tracking-tight">🏰 Affiliate Castle</span>
        <button
          onClick={() => setDrawerOpen(true)}
          aria-label="Open menu"
          className="p-2 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
        >
          {/* Hamburger icon */}
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      </header>

      {/* ── Mobile drawer backdrop ─────────────────────────────────── */}
      {drawerOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
          onClick={() => setDrawerOpen(false)}
        />
      )}

      {/* ── Mobile drawer ─────────────────────────────────────────── */}
      <div className={clsx(
        'lg:hidden fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 border-r border-slate-800 flex flex-col transform transition-transform duration-300 ease-in-out',
        drawerOpen ? 'translate-x-0' : '-translate-x-full'
      )}>
        {/* Drawer header */}
        <div className="px-5 py-5 border-b border-slate-800 flex items-center justify-between">
          <span className="text-base font-extrabold text-white tracking-tight">🏰 Affiliate Castle</span>
          <button
            onClick={() => setDrawerOpen(false)}
            aria-label="Close menu"
            className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Drawer nav */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          <NavLinks pathname={pathname} onNav={() => setDrawerOpen(false)} />
        </nav>

        {/* Drawer sign out */}
        <div className="px-3 py-4 border-t border-slate-800">
          <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-400 hover:bg-slate-800 hover:text-white transition-colors duration-150"
          >
            <span className="text-base">🚪</span>
            Sign Out
          </button>
        </div>
      </div>
    </>
  )
}

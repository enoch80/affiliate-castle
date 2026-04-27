import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { Sidebar } from '@/components/Sidebar'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions)
  if (!session) {
    redirect('/login')
  }

  return (
    <div className="flex min-h-screen bg-slate-950">
      <Sidebar />
      {/* pt-14 offsets the fixed mobile top bar; on lg it has no top bar so pt-0 */}
      <main className="flex-1 min-w-0 overflow-y-auto pt-14 lg:pt-0">
        {children}
      </main>
    </div>
  )
}

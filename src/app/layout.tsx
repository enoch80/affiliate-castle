import type { Metadata } from 'next'
import './globals.css'
export const metadata: Metadata = { title: 'Affiliate Castle', description: 'Fully automated affiliate marketing engine' }
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (<html lang="en"><body>{children}</body></html>)
}

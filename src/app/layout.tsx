import type { Metadata } from 'next'
import './globals.css'
import { Providers } from './providers'
import { ServiceWorkerRegistrar } from '@/components/ServiceWorkerRegistrar'

export const metadata: Metadata = {
  title: 'Affiliate Castle',
  description: 'Fully automated affiliate marketing engine',
  manifest: '/manifest.json',
  themeColor: '#0F172A',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
        <ServiceWorkerRegistrar />
      </body>
    </html>
  )
}

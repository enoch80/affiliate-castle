/**
 * Public bridge page — /go/[slug]
 *
 * Serves pre-rendered bridge page HTML from the BridgePage DB record.
 * No authentication required — this is the public-facing landing page.
 * Increments view count on each hit.
 */

import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'

interface PageProps {
  params: { slug: string }
}

// Disable static generation — views are tracked per-request
export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: PageProps) {
  const page = await prisma.bridgePage.findUnique({
    where: { slug: params.slug },
    include: { campaign: { select: { name: true } } },
  })
  if (!page) return { title: 'Not Found' }
  const content = page.contentJson as Record<string, string> | null
  return {
    title: content?.headline || page.campaign.name,
    description: `Learn more about ${page.campaign.name}`,
  }
}

export default async function BridgePageRoute({ params }: PageProps) {
  const page = await prisma.bridgePage.findUnique({
    where: { slug: params.slug },
  })

  if (!page) {
    notFound()
  }

  // Increment view count (fire-and-forget — don't block page render)
  prisma.bridgePage.update({
    where: { id: page.id },
    data: { views: { increment: 1 } },
  }).catch(() => {})

  const content = page.contentJson as Record<string, string> | null
  const renderedHtml = content?.renderedHtml

  if (!renderedHtml) {
    // Fallback: show a minimal placeholder while content is processed
    return (
      <html lang="en">
        <head>
          <meta charSet="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>Loading...</title>
          <style>{`
            body { background: #0F172A; color: #F1F5F9; font-family: Inter, Arial, sans-serif;
              display: flex; align-items: center; justify-content: center; min-height: 100vh;
              margin: 0; text-align: center; }
          `}</style>
        </head>
        <body>
          <div>
            <p style={{ fontSize: '48px', marginBottom: '16px' }}>🔄</p>
            <h1 style={{ fontSize: '24px', fontWeight: 700 }}>This page is being prepared...</h1>
            <p style={{ color: '#94A3B8', marginTop: '12px' }}>Check back in a moment.</p>
          </div>
        </body>
      </html>
    )
  }

  // Serve the pre-rendered HTML directly — use dangerouslySetInnerHTML at root
  // The template HTML is a full document so we bypass Next.js layout entirely
  return (
    <div
      style={{ all: 'unset' }}
      dangerouslySetInnerHTML={{ __html: renderedHtml }}
    />
  )
}

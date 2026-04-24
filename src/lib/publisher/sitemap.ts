/**
 * Sitemap updater
 *
 * Generates and writes a sitemap.xml to public/sitemap.xml.
 * The Next.js app serves it at /sitemap.xml automatically.
 *
 * Entry format: standard XML sitemap with <lastmod>, <changefreq>, <priority>.
 */
import fs from 'fs/promises'
import path from 'path'
import { prisma } from '@/lib/prisma'

const SITEMAP_PATH = path.join(process.cwd(), 'public', 'sitemap.xml')

export interface SitemapEntry {
  url: string
  lastmod?: string
  changefreq?: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never'
  priority?: number
}

function buildSitemapXml(entries: SitemapEntry[]): string {
  const items = entries
    .map((e) => {
      const lastmod = e.lastmod ? `  <lastmod>${e.lastmod}</lastmod>` : ''
      const changefreq = e.changefreq ? `  <changefreq>${e.changefreq}</changefreq>` : ''
      const priority = e.priority !== undefined ? `  <priority>${e.priority.toFixed(1)}</priority>` : ''
      return `<url>\n  <loc>${e.url}</loc>\n${lastmod}\n${changefreq}\n${priority}\n</url>`
    })
    .join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${items}
</urlset>`
}

/**
 * Rebuilds the sitemap from all active bridge pages and
 * appends any extra entries (publish job URLs).
 */
export async function updateSitemap(
  baseUrl: string,
  extraEntries: SitemapEntry[] = []
): Promise<void> {
  const now = new Date().toISOString().split('T')[0]

  // Bridge pages
  const bridgePages = await prisma.bridgePage.findMany({
    where: { publishedAt: { not: null } },
    select: { slug: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  })

  const bridgeEntries: SitemapEntry[] = bridgePages.map((p) => ({
    url: `${baseUrl}/go/${p.slug}`,
    lastmod: p.createdAt.toISOString().split('T')[0],
    changefreq: 'weekly',
    priority: 0.8,
  }))

  // Published platform URLs from PublishJob
  const publishJobs = await prisma.publishJob.findMany({
    where: { status: 'published', platformUrl: { not: null } },
    select: { platformUrl: true, publishedAt: true },
    orderBy: { publishedAt: 'desc' },
    take: 500,
  })

  const platformEntries: SitemapEntry[] = publishJobs
    .filter((j) => j.platformUrl)
    .map((j) => ({
      url: j.platformUrl!,
      lastmod: j.publishedAt?.toISOString().split('T')[0] ?? now,
      changefreq: 'monthly' as const,
      priority: 0.6,
    }))

  const allEntries: SitemapEntry[] = [
    { url: baseUrl, lastmod: now, changefreq: 'daily', priority: 1.0 },
    ...bridgeEntries,
    ...platformEntries,
    ...extraEntries,
  ]

  const xml = buildSitemapXml(allEntries)
  await fs.writeFile(SITEMAP_PATH, xml, 'utf8')
}

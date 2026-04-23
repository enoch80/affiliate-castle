/**
 * Link Resolver
 * Follows redirects on an affiliate hoplink to find the final landing page URL.
 * Uses Node's http/https — no headless browser needed here.
 */

import { URL } from 'url'
import https from 'https'
import http from 'http'

const MAX_REDIRECTS = 12
const TIMEOUT_MS = 12000

export interface ResolveResult {
  finalUrl: string
  hops: string[]
  network: string
}

/**
 * Detect affiliate network from URL pattern
 */
function detectNetwork(url: string): string {
  if (url.includes('clickbank.net') || url.includes('.hop.')) return 'clickbank'
  if (url.includes('digistore24.com')) return 'digistore24'
  if (url.includes('jvzoo.com')) return 'jvzoo'
  if (url.includes('warrior') || url.includes('warriorplus')) return 'warriorplus'
  if (url.includes('shareasale.com')) return 'shareasale'
  if (url.includes('cj.com') || url.includes('commission-junction')) return 'cj'
  if (url.includes('impact.com') || url.includes('impactradius')) return 'impact'
  if (url.includes('awin.com')) return 'awin'
  if (url.includes('maxbounty.com')) return 'maxbounty'
  if (url.includes('peerfly.com')) return 'peerfly'
  return 'unknown'
}

/**
 * Follow redirects until we reach the final URL or hit the limit
 */
export async function resolveHoplink(hoplink: string): Promise<ResolveResult> {
  const hops: string[] = [hoplink]
  let current = hoplink
  const network = detectNetwork(hoplink)

  for (let i = 0; i < MAX_REDIRECTS; i++) {
    const next = await followOne(current)
    if (!next || next === current) break
    hops.push(next)
    current = next
    // Stop if we've landed on a real content page (not a tracker/redirect)
    if (!isRedirectDomain(next)) break
  }

  return { finalUrl: current, hops, network }
}

function isRedirectDomain(url: string): boolean {
  const redirectDomains = [
    'hop.clickbank.net', 'track.', 'click.', 'go.', 'redir.',
    'redirect.', 'aff.', 'jvz', 'digistore24', 'paydotcom'
  ]
  return redirectDomains.some(d => url.includes(d))
}

function followOne(url: string): Promise<string | null> {
  return new Promise((resolve) => {
    const parsed = new URL(url)
    const lib = parsed.protocol === 'https:' ? https : http
    const options = {
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      method: 'HEAD',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; AffiliateBot/1.0)',
        'Accept': 'text/html,application/xhtml+xml,*/*',
      },
      timeout: TIMEOUT_MS,
    }

    const req = lib.request(options, (res) => {
      const location = res.headers.location
      if (location && (res.statusCode || 0) >= 300 && (res.statusCode || 0) < 400) {
        try {
          // Handle relative redirects
          const next = new URL(location, url).toString()
          resolve(next)
        } catch {
          resolve(null)
        }
      } else {
        resolve(null)
      }
    })

    req.on('error', () => resolve(null))
    req.on('timeout', () => { req.destroy(); resolve(null) })
    req.end()
  })
}

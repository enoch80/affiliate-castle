/**
 * IndexNow submitter
 *
 * Pings Bing, Yandex, and Seznam simultaneously with all newly published URLs.
 * Docs: https://www.indexnow.org/documentation
 *
 * Key requirements:
 *  - INDEXNOW_KEY env var
 *  - Key file must be hosted at https://APP_DOMAIN/INDEXNOW_KEY.txt
 *    (Next.js public/ directory serves this automatically)
 */

const INDEXNOW_ENDPOINTS = [
  'https://api.bing.com/indexnow',
  'https://yandex.com/indexnow',
  'https://searchadvisor.naver.com/indexnow', // also covers seznam.cz via Naver proxy
]

export interface IndexNowResult {
  submitted: boolean
  urlCount: number
  errors: string[]
}

export async function pingIndexNow(
  urls: string[],
  host: string  // e.g. "app.yourdomain.com"
): Promise<IndexNowResult> {
  const key = process.env.INDEXNOW_KEY ?? ''
  if (!key) {
    return { submitted: false, urlCount: 0, errors: ['INDEXNOW_KEY not set'] }
  }

  if (urls.length === 0) {
    return { submitted: false, urlCount: 0, errors: ['No URLs to submit'] }
  }

  const body = JSON.stringify({
    host,
    key,
    keyLocation: `https://${host}/${key}.txt`,
    urlList: urls,
  })

  const errors: string[] = []

  await Promise.allSettled(
    INDEXNOW_ENDPOINTS.map(async (endpoint) => {
      const resp = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body,
      })
      // IndexNow returns 200 or 202 on success
      if (resp.status !== 200 && resp.status !== 202) {
        const text = await resp.text()
        errors.push(`${endpoint}: ${resp.status} ${text.slice(0, 100)}`)
      }
    })
  )

  return {
    submitted: errors.length < INDEXNOW_ENDPOINTS.length,
    urlCount: urls.length,
    errors,
  }
}

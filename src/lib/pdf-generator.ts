/**
 * PDF Generator — Sprint 5
 *
 * Renders a lead magnet HTML document to PDF using Puppeteer (local Chromium).
 * Saves the PDF to /public/magnets/[campaignId]/[slug].pdf — a volume shared
 * between the worker and app containers so the app can serve it statically.
 */

import { mkdir, writeFile } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'

const CHROMIUM_PATH =
  process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ||
  process.env.PUPPETEER_EXECUTABLE_PATH ||
  '/usr/bin/chromium-browser'

const MAGNETS_DIR = path.join(process.cwd(), 'public', 'magnets')

export interface PDFResult {
  pdfPath: string        // absolute path on disk
  publicUrl: string      // URL path served by Next.js static
  sizeBytes: number
}

/**
 * Renders HTML string to a PDF file.
 * @param html         Full HTML document string
 * @param campaignId   Used to create a namespaced sub-folder
 * @param slug         File name (without .pdf extension)
 */
export async function renderPDF(
  html: string,
  campaignId: string,
  slug: string
): Promise<PDFResult> {
  // Ensure the output directory exists
  const dir = path.join(MAGNETS_DIR, campaignId)
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true })
  }

  const filename = `${slug}.pdf`
  const filePath = path.join(dir, filename)
  const publicUrl = `/magnets/${campaignId}/${filename}`

  let puppeteer
  try {
    puppeteer = await import('puppeteer')
  } catch {
    // Fallback: save the HTML as a text file if Puppeteer unavailable (CI/test env)
    await writeFile(filePath.replace('.pdf', '.html'), html, 'utf8')
    return {
      pdfPath: filePath.replace('.pdf', '.html'),
      publicUrl: publicUrl.replace('.pdf', '.html'),
      sizeBytes: Buffer.byteLength(html, 'utf8'),
    }
  }

  let browser
  try {
    const launchOptions: Record<string, unknown> = {
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--font-render-hinting=none',
      ],
    }

    // Use system Chromium when running inside the worker Docker container
    if (existsSync(CHROMIUM_PATH)) {
      launchOptions.executablePath = CHROMIUM_PATH
    }

    browser = await (puppeteer as typeof import('puppeteer')).default.launch(launchOptions)
    const page = await browser.newPage()

    // Load the HTML directly — Google Fonts are loaded via CDN link in the HTML
    await page.setContent(html, { waitUntil: 'networkidle2', timeout: 30000 })

    const pdfBuffer = await page.pdf({
      format: 'A4',
      margin: { top: '40px', right: '40px', bottom: '40px', left: '40px' },
      printBackground: true,
    })

    await writeFile(filePath, pdfBuffer)

    return {
      pdfPath: filePath,
      publicUrl,
      sizeBytes: pdfBuffer.length,
    }
  } finally {
    if (browser) {
      await browser.close().catch(() => {})
    }
  }
}

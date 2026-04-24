/**
 * Canvas image generator
 *
 * Produces 1280×720px JPEG images for Telegram posts and platform cover images.
 * Dark gradient background + headline text + brand name.
 *
 * Output saved to public/images/[campaignId]/[slug].jpg
 *
 * Uses `canvas` npm package (pre-installed).
 */
import fs from 'fs/promises'
import path from 'path'
import { createCanvas, registerFont } from 'canvas'

export interface GenerateImageInput {
  campaignId: string
  slug: string
  headline: string
  brandName: string
  accentColor?: string   // hex e.g. '#22C55E'
}

export interface GenerateImageResult {
  filePath: string
  publicUrl: string
}

/** Word-wrap text into lines no wider than maxWidth pixels */
function wrapText(
  ctx: { measureText: (t: string) => { width: number } },
  text: string,
  maxWidth: number
): string[] {
  const words = text.split(' ')
  const lines: string[] = []
  let current = ''

  for (const word of words) {
    const test = current ? `${current} ${word}` : word
    if (ctx.measureText(test).width > maxWidth && current) {
      lines.push(current)
      current = word
    } else {
      current = test
    }
  }
  if (current) lines.push(current)
  return lines
}

export async function generateCoverImage(
  input: GenerateImageInput
): Promise<GenerateImageResult> {
  const { campaignId, slug, headline, brandName, accentColor = '#6366F1' } = input

  const WIDTH = 1280
  const HEIGHT = 720

  const canvas = createCanvas(WIDTH, HEIGHT)
  const ctx = canvas.getContext('2d')

  // Dark gradient background
  const gradient = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT)
  gradient.addColorStop(0, '#0F172A')
  gradient.addColorStop(1, '#1E293B')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, WIDTH, HEIGHT)

  // Accent bar at top
  ctx.fillStyle = accentColor
  ctx.fillRect(0, 0, WIDTH, 6)

  // Brand name (top-left)
  ctx.fillStyle = '#94A3B8'
  ctx.font = 'bold 28px sans-serif'
  ctx.fillText(brandName.slice(0, 50), 60, 70)

  // Headline (centered, large)
  ctx.fillStyle = '#F1F5F9'
  ctx.font = 'bold 56px sans-serif'
  ctx.textAlign = 'center'

  const lines = wrapText(ctx, headline, WIDTH - 120)
  const lineHeight = 72
  const totalHeight = lines.length * lineHeight
  let y = (HEIGHT - totalHeight) / 2 + 16

  for (const line of lines.slice(0, 5)) {
    ctx.fillText(line, WIDTH / 2, y)
    y += lineHeight
  }

  // Accent dot indicator at bottom
  ctx.fillStyle = accentColor
  ctx.beginPath()
  ctx.arc(WIDTH / 2, HEIGHT - 48, 6, 0, Math.PI * 2)
  ctx.fill()

  // Ensure output directory exists
  const outDir = path.join(process.cwd(), 'public', 'images', campaignId)
  await fs.mkdir(outDir, { recursive: true })

  const filePath = path.join(outDir, `${slug}.jpg`)
  const buffer = canvas.toBuffer('image/jpeg', { quality: 0.85 })
  await fs.writeFile(filePath, buffer)

  // Public URL (served by Next.js static)
  const publicUrl = `/images/${campaignId}/${slug}.jpg`

  return { filePath, publicUrl }
}

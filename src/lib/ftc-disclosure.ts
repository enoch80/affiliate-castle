/**
 * Sprint 11 — FTC Affiliate Disclosure
 *
 * The FTC requires clear and conspicuous affiliate disclosures on all content
 * that contains or links to monetised promotions.
 *
 * This module provides:
 *  - Standard disclosure text (short + long form)
 *  - injectDisclosure(html) — prepends the short disclosure banner to HTML content
 *  - appendDisclosure(html) — appends the long-form disclosure to HTML content
 *  - disclosureHtml() — returns the full HTML banner for direct embedding
 *
 * These functions are called by:
 *  - The publisher (platform articles before publishing)
 *  - The bridge page renderer
 *  - The email sequence generator
 *
 * This injection CANNOT be disabled (plan requirement).
 */

export const FTC_DISCLOSURE_SHORT =
  'Disclosure: This post contains affiliate links. If you make a purchase through these links, I may earn a commission at no additional cost to you.'

export const FTC_DISCLOSURE_LONG =
  'Affiliate Disclosure: This website and its content may contain affiliate links. ' +
  'That means if you click on certain links and make a purchase, I may receive a commission. ' +
  'This does not affect the price you pay. I only recommend products and services I genuinely ' +
  'believe in based on my research and experience. Results are not typical and individual ' +
  'outcomes will vary. Please see our full Privacy Policy and Terms of Service for more details.'

const BANNER_STYLE =
  'background:#1e293b;border-left:4px solid #f97316;padding:12px 16px;margin:0 0 24px 0;' +
  'font-size:13px;line-height:1.6;color:#94a3b8;border-radius:0 4px 4px 0;'

/** Returns the HTML banner string for the short disclosure. */
export function disclosureHtml(): string {
  return `<div class="ftc-disclosure" style="${BANNER_STYLE}" aria-label="Affiliate disclosure">` +
    `<strong style="color:#f97316">Affiliate Disclosure:</strong> ` +
    `This post contains affiliate links. If you purchase through these links, ` +
    `I may earn a commission at no extra cost to you.` +
    `</div>`
}

/**
 * Prepend the FTC disclosure banner immediately after the opening <body> tag,
 * or at the beginning of the content string if no <body> tag is present.
 */
export function injectDisclosure(html: string): string {
  const banner = disclosureHtml()
  const bodyMatch = html.match(/<body[^>]*>/i)
  if (bodyMatch && bodyMatch.index !== undefined) {
    const insertAt = bodyMatch.index + bodyMatch[0].length
    return html.slice(0, insertAt) + '\n' + banner + html.slice(insertAt)
  }
  return banner + '\n' + html
}

/**
 * Append the long-form FTC disclosure at the end of HTML content,
 * before the closing </body> tag if present.
 */
export function appendDisclosure(html: string): string {
  const footer =
    `\n<footer class="ftc-disclosure-footer" style="margin-top:48px;padding:24px 0;` +
    `border-top:1px solid #334155;font-size:12px;color:#64748b;line-height:1.8;">` +
    `<strong>Affiliate Disclosure Notice:</strong> ${FTC_DISCLOSURE_LONG}` +
    `</footer>`

  const closingBody = html.lastIndexOf('</body>')
  if (closingBody !== -1) {
    return html.slice(0, closingBody) + footer + html.slice(closingBody)
  }
  return html + footer
}

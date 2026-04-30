#!/usr/bin/env node
/**
 * Generates public/preview/plan-review.html — a human-readable HTML summary
 * of planup1.md covering all decisions the user must approve before implementation.
 */
import { writeFileSync, readFileSync } from 'fs'

const md = readFileSync('/workspaces/affiliate-castle/planup1.md', 'utf8')

// ─── Extract specific sections ────────────────────────────────────────────────

function extractSection(src, heading) {
  const esc = heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const re = new RegExp(`(###?\\s+${esc}[\\s\\S]*?)(?=\\n###?\\s+|$)`)
  const m = src.match(re)
  return m ? m[1].trim() : ''
}

// Simple markdown → HTML converter (for code blocks + bold + backticks)
function mdToHtml(src) {
  return src
    // fenced code blocks
    .replace(/```(\w+)?\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>')
    // inline code
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    // bold
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    // italic
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    // tables — wrap thead/tbody
    .replace(/(\|.+\|\n)((?:\|[-: ]+\|\n))((?:\|.+\|\n?)+)/g, (_, head, sep, body) => {
      const ths = head.split('|').filter(c => c.trim()).map(c => `<th>${c.trim()}</th>`).join('')
      const rows = body.trim().split('\n').map(row => {
        const tds = row.split('|').filter(c => c.trim()).map(c => `<td>${c.trim()}</td>`).join('')
        return `<tr>${tds}</tr>`
      }).join('\n')
      return `<table><thead><tr>${ths}</tr></thead><tbody>${rows}</tbody></table>`
    })
    // h4
    .replace(/^#### (.+)$/gm, '<h4>$1</h4>')
    // h3
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    // h2
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    // h1
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    // blockquote
    .replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>')
    // bullet list
    .replace(/^[ \t]*[-•] (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>[\s\S]*?<\/li>)(?=\n(?!<li>))/g, '<ul>$&</ul>')
    // numbered list
    .replace(/^\d+\. (.+)$/gm, '<li>$1</li>')
    // hr
    .replace(/^---$/gm, '<hr>')
    // paragraphs — double newline
    .replace(/\n\n(?!<)/g, '</p><p>')
    // wrap leftovers
    .replace(/^(?!<)(.+)$/gm, '$1')
}

// ─── Build sections HTML ──────────────────────────────────────────────────────

const sections = [
  { id: 'revenue', title: '📈 Revenue Timeline (Realistic)', tag: 'Revenue Model' },
  { id: 'flow', title: '⚙️ Campaign Pipeline (Step 8 Updated)', tag: 'Campaign Flow' },
  { id: 'gaps', title: '🔍 All 17 Quality Gaps + Status', tag: 'Gap Inventory' },
  { id: 'impl', title: '📋 Implementation Order (20 Steps)', tag: 'IMPLEMENTATION ORDER' },
  { id: 'env', title: '🔑 All Required Env Vars', tag: 'ENVIRONMENT VARIABLES' },
  { id: 's12-14', title: '📧 §12.14 — Niche Email Sequences (NEW)', tag: '12.14' },
  { id: 's12-15', title: '💬 §12.15 — Dynamic Testimonials (NEW)', tag: '12.15' },
  { id: 's12-16', title: '🏆 §12.16 — A/B Winner Measurement (NEW)', tag: '12.16' },
  { id: 's12-17', title: '🔔 §12.17 — Google Sitemap Ping (NEW)', tag: '12.17' },
  { id: 's12-12', title: '🤖 §12.12 — Mistral/OpenRouter Migration', tag: '12.12' },
  { id: 's12-13', title: '📁 §12.13 — All Code Changes Required', tag: '12.13' },
  { id: 's12-3', title: '🧠 §12.3 — Bridge Page AIDA/PAS Framework', tag: '12.3' },
  { id: 's12-6', title: '👤 §12.6 — E-E-A-T Author Personas', tag: '12.6' },
  { id: 's12-9', title: '📸 §12.9 — Photo System (All 7 Slots)', tag: '12.9' },
  { id: 's12-10', title: '⚖️ §12.10 — FTC Testimonial Compliance', tag: '12.10' },
  { id: 's12-11', title: '✅ §12.11 — Pexels CDN (Resolved)', tag: '12.11' },
]

// Extract each section from planup1.md
const extracted = {}
for (const s of sections) {
  // Find heading with the tag
  const lines = md.split('\n')
  let start = -1, level = 0
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^(#{2,4})\s+.+/)
    if (m && lines[i].includes(s.tag)) {
      start = i
      level = m[1].length
      break
    }
  }
  if (start === -1) { extracted[s.id] = `<em>Section "${s.tag}" not found</em>`; continue }
  
  // Read until next heading of same or higher level
  const out = [lines[start]]
  for (let i = start + 1; i < lines.length; i++) {
    const m = lines[i].match(/^(#{1,4})\s+/)
    if (m && m[1].length <= level && i > start + 1) break
    out.push(lines[i])
  }
  extracted[s.id] = mdToHtml(out.join('\n'))
}

// ─── Nav items  ──────────────────────────────────────────────────────────────

const navItems = sections.map(s =>
  `<li><a href="#${s.id}">${s.title}</a></li>`
).join('\n')

// ─── Cards ───────────────────────────────────────────────────────────────────

const NEW_BADGE = '<span class="badge new">NEW</span>'
const cards = sections.map(s => {
  const isNew = s.title.includes('NEW')
  return `
<section id="${s.id}" class="card${isNew ? ' card-new' : ''}">
  <h2 class="card-title">${s.title}${isNew ? ' ' + NEW_BADGE : ''}</h2>
  <div class="card-body">${extracted[s.id]}</div>
</section>`
}).join('\n')

// ─── Full page ────────────────────────────────────────────────────────────────

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Affiliate Castle — Plan Review (April 29, 2026)</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    background: #0f172a;
    color: #e2e8f0;
    font-family: Inter, system-ui, sans-serif;
    font-size: 15px;
    line-height: 1.7;
  }
  a { color: #818cf8; text-decoration: none; }
  a:hover { text-decoration: underline; }

  /* Layout */
  .wrapper { display: flex; min-height: 100vh; }
  nav {
    width: 280px;
    flex-shrink: 0;
    background: #0a0f1e;
    border-right: 1px solid #1e293b;
    padding: 24px 16px;
    position: sticky;
    top: 0;
    height: 100vh;
    overflow-y: auto;
  }
  nav h1 { font-size: 13px; text-transform: uppercase; letter-spacing: .1em; color: #64748b; margin-bottom: 16px; }
  nav ul { list-style: none; }
  nav li { margin-bottom: 6px; }
  nav a {
    display: block;
    padding: 6px 10px;
    border-radius: 6px;
    color: #94a3b8;
    font-size: 13px;
    transition: background .15s;
  }
  nav a:hover { background: #1e293b; color: #e2e8f0; text-decoration: none; }
  main { flex: 1; padding: 32px 40px; max-width: 900px; }

  /* Header */
  .page-header { margin-bottom: 40px; }
  .page-header h1 { font-size: 28px; font-weight: 800; color: #f1f5f9; }
  .page-header p { color: #64748b; margin-top: 8px; }
  .status-bar {
    display: flex; gap: 12px; flex-wrap: wrap; margin-top: 16px;
  }
  .chip {
    background: #1e293b;
    border: 1px solid #334155;
    border-radius: 20px;
    padding: 4px 12px;
    font-size: 12px;
    color: #94a3b8;
  }
  .chip.green { border-color: #22c55e44; color: #4ade80; background: #052e16; }
  .chip.orange { border-color: #f9731644; color: #fb923c; background: #1c0700; }
  .chip.blue { border-color: #6366f144; color: #818cf8; background: #0f0a2e; }

  /* Cards */
  .card {
    background: #1e293b;
    border: 1px solid #334155;
    border-radius: 12px;
    padding: 28px 32px;
    margin-bottom: 24px;
  }
  .card-new {
    border-color: #f9731644;
    background: linear-gradient(135deg, #1c0f06, #1e293b);
  }
  .card-title {
    font-size: 18px;
    font-weight: 700;
    color: #f1f5f9;
    margin-bottom: 16px;
    padding-bottom: 12px;
    border-bottom: 1px solid #334155;
  }
  .badge {
    display: inline-block;
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: .06em;
  }
  .badge.new { background: #f97316; color: #fff; }

  /* Content typography */
  .card-body h1,
  .card-body h2 { font-size: 17px; font-weight: 700; color: #f1f5f9; margin: 20px 0 10px; }
  .card-body h3 { font-size: 15px; font-weight: 700; color: #cbd5e1; margin: 16px 0 8px; }
  .card-body h4 { font-size: 14px; font-weight: 600; color: #94a3b8; margin: 12px 0 6px; }
  .card-body p { margin-bottom: 10px; color: #cbd5e1; }
  .card-body ul, .card-body ol { margin: 8px 0 8px 20px; }
  .card-body li { margin-bottom: 4px; color: #cbd5e1; }
  .card-body strong { color: #f1f5f9; }
  .card-body em { color: #94a3b8; }
  .card-body blockquote {
    border-left: 3px solid #334155;
    padding-left: 12px;
    color: #64748b;
    font-style: italic;
    margin: 8px 0;
  }
  .card-body hr { border: none; border-top: 1px solid #334155; margin: 16px 0; }
  pre {
    background: #0f172a;
    border: 1px solid #1e293b;
    border-radius: 8px;
    padding: 16px;
    overflow-x: auto;
    margin: 12px 0;
    font-size: 13px;
    line-height: 1.5;
  }
  code {
    background: #0f172a;
    border: 1px solid #1e293b;
    border-radius: 3px;
    padding: 1px 5px;
    font-size: 12.5px;
    color: #a5f3fc;
  }
  pre code { background: none; border: none; padding: 0; }
  table {
    width: 100%;
    border-collapse: collapse;
    margin: 12px 0;
    font-size: 13px;
  }
  th {
    background: #0f172a;
    color: #94a3b8;
    padding: 8px 12px;
    text-align: left;
    font-weight: 600;
    border: 1px solid #1e293b;
  }
  td {
    padding: 7px 12px;
    border: 1px solid #1e293b;
    color: #cbd5e1;
    vertical-align: top;
  }
  tr:nth-child(even) td { background: #111827; }

  /* Approve section */
  .approve-box {
    background: linear-gradient(135deg, #052e16, #0f172a);
    border: 2px solid #22c55e44;
    border-radius: 12px;
    padding: 32px;
    margin-top: 40px;
    text-align: center;
  }
  .approve-box h2 { color: #4ade80; font-size: 22px; margin-bottom: 12px; }
  .approve-box p { color: #94a3b8; max-width: 560px; margin: 0 auto 20px; }
  .approve-box code {
    display: block;
    background: #0a0f1e;
    border: 1px solid #22c55e33;
    border-radius: 8px;
    padding: 14px 20px;
    color: #4ade80;
    font-size: 14px;
    max-width: 520px;
    margin: 0 auto;
    text-align: left;
  }
</style>
</head>
<body>
<div class="wrapper">
  <nav>
    <h1>Affiliate Castle Plan</h1>
    <ul>${navItems}</ul>
    <div style="margin-top:24px;padding-top:16px;border-top:1px solid #1e293b;">
      <div style="font-size:11px;color:#475569;margin-bottom:8px;">SUMMARY</div>
      <div style="font-size:12px;color:#64748b;">1,791 lines · 17 gaps specced · 4 new sections · ready for approval</div>
    </div>
  </nav>
  <main>
    <div class="page-header">
      <h1>Affiliate Castle — Plan Review</h1>
      <p>April 29, 2026 · planup1.md · All gaps filled · Awaiting your approval before implementation</p>
      <div class="status-bar">
        <span class="chip green">✅ 12 sprints green (123/123 tests)</span>
        <span class="chip green">✅ 17/17 quality gaps specced</span>
        <span class="chip orange">⏳ 8 planned files not yet created</span>
        <span class="chip orange">⏳ Ollama still in code (await approval)</span>
        <span class="chip blue">🔄 4 new sections added today</span>
        <span class="chip blue">📊 Realistic revenue timeline updated</span>
      </div>
    </div>

    ${cards}

    <div class="approve-box">
      <h2>✅ Ready for your approval</h2>
      <p>Review all sections above. When satisfied, reply "go implement" and the full implementation will begin in dependency order (plan Part 3, 20 steps).</p>
      <code>Reply: "go implement planup1.md"</code>
    </div>
  </main>
</div>
</body>
</html>`

writeFileSync('/workspaces/affiliate-castle/public/preview/plan-review.html', html, 'utf8')
console.log('Written: public/preview/plan-review.html (' + html.length + ' bytes)')

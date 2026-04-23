# Affiliate Castle — Complete Implementation Plan (Source of Truth)

> **Last updated:** 2026-04-23  
> **Status:** Sprint 1 — Active  
> **Repo:** https://github.com/enoch80/Affilate-castle-.git  
> **Server:** Contabo 109.199.106.147 — /opt/affiliate-castle  
> **App port:** 3200

---

## Vision

Paste one affiliate hoplink → press Launch → the system does everything:
- Researches the offer and market
- Scrapes and outranks Bing top 10 competitors
- Writes and humanizes all content (AI-undetectable)
- Builds a bridge page with lead capture and exit intent
- Generates a lead magnet PDF automatically
- Publishes to dev.to, Hashnode, Blogger, Tumblr simultaneously
- Pings IndexNow (Bing + Yandex + Seznam indexed same day)
- Schedules 10 Telegram posts across optimal engagement windows
- Runs a 14-day email drip sequence via Listmonk
- Tracks every click, opt-in, and conversion with full attribution
- Grows Telegram channel passively through bridge page + email promotion

**Your only action: paste the hoplink and click Launch.**

---

## Technology Stack (Zero Recurring Cost)

| Layer | Technology | Cost |
|---|---|---|
| Frontend | Next.js 14 App Router | Free |
| Backend | Next.js API Routes + Node workers | Free |
| Database | PostgreSQL 16 (Docker) | Free |
| Job Queue | BullMQ + Redis (Docker) | Free |
| AI / LLM | Ollama + Llama 3.3 70B (local) | Free |
| AI Detection | RoBERTa detector (local HuggingFace) | Free |
| Email engine | Listmonk (self-hosted Docker) | Free |
| SMTP | Postfix on same server | Free |
| Telegram | Telegram Bot API (official) | Free |
| Image gen | Sharp + Canvas API (Phase 1) | Free |
| PDF gen | Puppeteer (local) | Free |
| Reverse proxy | Nginx + Certbot/Let's Encrypt | Free |
| Web scraper | Playwright headless | Free |
| NLP | compromise.js + natural.js | Free |
| Search indexing | IndexNow (no account needed) | Free |
| Server | Contabo VPS (already owned) | Already paid |

**Total recurring cost: €0/month beyond existing VPS.**

---

## Publishing Platforms (All Instant API Access)

| Platform | API Access | Direct Link |
|---|---|---|
| dev.to | Instant — personal token | https://dev.to/settings/extensions |
| Hashnode | Instant — personal token | https://hashnode.com/settings/developer |
| Blogger | Instant — Google OAuth2 | https://console.cloud.google.com/apis/library/blogger.googleapis.com |
| Tumblr | Instant — OAuth app | https://www.tumblr.com/oauth/apps |
| Telegram Bot | Instant — @BotFather | https://t.me/BotFather |
| IndexNow | Zero signup needed | https://www.indexnow.org/documentation |

---

## Conversion Philosophy

Every module is built around one principle: meet the visitor exactly where their pain is, give them a quick win, then present the paid solution as the obvious next step.

**Three frameworks governing everything:**
1. **PAS (Problem → Agitate → Solve)** — bridge pages, emails, Telegram posts
2. **Curiosity Gap** — headlines, email subjects, Telegram hooks
3. **Reciprocity + Liking** — lead magnets, value emails (give first, sell second)

---

## Module 1: Bridge Page

### Color System (Niche-Specific)

| Niche | Background | Accent | CTA Button |
|---|---|---|---|
| Health/Weight Loss | #0D1117 | #22C55E (green) | #F97316 (orange — always) |
| Wealth/Finance/MMO | #0A0A0A | #EAB308 (gold) | #F97316 |
| Relationships | #1A0A0A | #EC4899 (pink) | #F97316 |
| Software/Tech | #0F172A | #6366F1 (indigo) | #F97316 |
| Survival/Prep | #111811 | #84CC16 (lime) | #F97316 |

**CTA button is always #F97316 (orange) regardless of niche — tested highest CTR.**

### Typography
- Font: Inter (400/600/800) — single family, loaded via Google Fonts CDN
- H1: 48px / weight 800 / line-height 1.1 / letter-spacing -1px
- H2: 32px / weight 700
- Body: 18px / line-height 1.7
- Mobile H1: 32px, Body: 16px minimum

### Page Sections
1. **Above fold (100vh):** Logo + H1 headline + sub-headline + hero image + orange CTA button + trust bar
2. **Problem Agitation (PAS):** Name problem → twist knife → external blame reframe → solution tease + inline text CTA
3. **Social proof:** 3 testimonial cards (⭐⭐⭐⭐⭐, name + city, specific result) + trust badge bar
4. **Opt-in box:** Gift icon + 4 benefit bullets + first name + email fields + orange button + privacy micro-copy
5. **Bridge content:** Solution reveal + benefit bullets + guarantee callout + FAQ (8 Q&As) + final CTA
6. **Footer:** FTC disclosure + privacy policy + unsubscribe + copyright

### CTA Button CSS
```css
background: #F97316;
color: #FFFFFF;
font-size: 20px;
font-weight: 700;
padding: 18px 48px;
border-radius: 16px;
box-shadow: 0 4px 24px rgba(249,115,22,0.4);
transition: transform 0.15s, box-shadow 0.15s;
```

### Exit Intent Overlay
- Trigger: mouse Y < 50px OR tab loses focus
- Dark backdrop rgba(0,0,0,0.85) + centered 600px modal
- Headline: "WAIT! Don't leave without your free [lead magnet]"
- Same opt-in form
- Max 1 display per visitor per 24h (cookie)

### 4 Templates
- `review.html` — Software, tools, supplements
- `story.html` — MMO, weight loss, relationships
- `comparison.html` — Offers with direct competitors
- `problem-solution.html` — Health, survival, finance

---

## Module 2: Lead Magnet

### Selection Logic (LLM decision based on niche)
- Weight loss/fitness → "X-Day Meal Plan" or "Workout Checklist"
- Make money online → "Income Blueprint" or "Step-by-Step Quickstart Guide"
- Software/tools → "Tutorial Guide" or "Swipe File of Templates"
- Relationships → "Script/Conversation Guide" or "Checklist"
- Health/medical → "Symptom Checklist" or "Natural Remedy Guide"
- Finance → "Beginner's Cheat Sheet" or "Portfolio Guide"

### Structure (7–12 pages)
1. Cover page — title, subtitle, brand, gradient background
2. Welcome + How To Use (100 words)
3. The #1 Mistake section (reinforces problem, keeps offer relevant)
4. Core content pages (actionable, niche-specific, table format where possible)
5. Bonus section (over-delivers, creates delight)
6. "What's Next" page — soft pitch to offer with tracking link (`utm_source=lead_magnet`)
7. Disclaimer page — affiliate disclosure, results disclaimer

### Critical Rule
The lead magnet must **pre-sell the offer**. Content leads naturally to the paid offer as the logical next step. They are the same journey.

### Technical
- HTML → PDF via Puppeteer (local, no API)
- Paper size: A4, margins: 40px, font: Inter (local copy for Puppeteer)
- Target file size: < 2MB
- PDF interior: white background (#FFFFFF), dark text (#1E293B)
- Stored: `/public/magnets/[campaign-id]/[slug].pdf`

---

## Module 3: Email Sequence (7 + 3 Re-engage)

### Sender Setup
- From name: "[First Name] from [Niche Brand]" (e.g., "Sarah from HealthEdge Daily")
- From address: `sarah@yourdomain.com` (named, not noreply)
- SPF + DKIM + DMARC configured on Postfix
- Physical address required in footer (CAN-SPAM)

### SMTP Warm-Up Protocol
- Week 1: max 20 emails/day
- Week 2: max 50/day
- Week 3: max 150/day
- Week 4: max 500/day
- Week 5+: full volume
- Enforced automatically via BullMQ rate limiter

### Spam Score Gate
- Score < 2.0 → auto-send
- Score 2.0–3.5 → dashboard warning
- Score > 3.5 → blocked, flagged for rewrite

### Subject Line Formulas
1. Curiosity gap: "[Intriguing incomplete statement]" — 38–45% open rate
2. Personalization + curiosity: "[First name], [unexpected statement]" — 40–48%
3. Direct benefit: "How to [result] in [timeframe] without [objection]" — 30–36%
4. Number + specificity: "[Number] [things] about [topic]" — 35–42%

### Emotional Arc
```
Email 1 (Day 0):  RELIEF      — deliver what was promised
Email 2 (Day 1):  TRUST       — personal story, no sell
Email 3 (Day 3):  RESPECT     — pure value, Telegram invite
Email 4 (Day 5):  CURIOSITY   — introduce mechanism, first CTA
Email 5 (Day 7):  PROOF       — testimonial stories
Email 6 (Day 10): SAFETY      — objection handling, guarantee
Email 7 (Day 14): URGENCY     — final call, value stack, P.S. regret trigger
```

### Re-Engagement (Days 17, 20, 23 — triggers for 0 opens)
- Email 1: "Did I do something wrong, [First Name]?"
- Email 2: "One thing before I give up on us..."
- Email 3: "I'm removing you from my list this Friday" (loss aversion)
- After Email 3 with no action: tag `cold`, suppress from active sends

### Email Design
- Max width: 600px, white background, #374151 body text
- Font: Arial or Georgia (web-safe — custom fonts break in Outlook)
- CTA buttons: HTML table-based (works in Outlook), orange #F97316
- Max 1 image per email, alt text always filled
- Paragraph max: 3 sentences, 24px spacing between paragraphs

---

## Module 4: SEO Content (Bing-First Strategy)

### Why Bing Primary
- IndexNow support: indexes within hours (Google takes days/weeks)
- 3–5x less competition per keyword vs Google
- Same ping reaches Yandex + Seznam (4 search engines, 1 call)
- Less aggressive against affiliate content

### Content Brief Pipeline
1. Extract primary keyword from offer (NLP, local)
2. Scrape Bing top 10 results (Playwright, user-agent rotated)
3. Extract: headings, word count, named entities, LSI terms, FAQ patterns
4. Gap analysis: entities in 7+ results = mandatory, missing from all = differentiator
5. Generate brief: required entities, recommended headings, target word count (+15% vs avg)
6. LLM writes content using brief as context (not just writing blind)

### Content Structure (Every Article)
```
Title: [Primary keyword] — [curiosity phrase] (50–60 chars)
Meta description: 150–160 chars, keyword + benefit + CTA
H1: Title
Introduction (150 words): hook + 3-bullet preview + keyword in first 100 words
H2: [Topic 1 — primary keyword variant] — 400–500 words
  H3: Subtopic
H2: [Topic 2 — LSI term] — 400–500 words
H2: [Gap section — what competitors missed] — 300–400 words
H2: Frequently Asked Questions (8 Q&As) — FAQ schema
H2: Conclusion + Next Step (100 words, bridge page CTA)
```

### Schema Markup (Auto-injected)
- Article, FAQPage, BreadcrumbList
- Increases rich snippet eligibility in Bing free

### Internal Linking
- Every article links to 2 previous articles in same niche
- Every article links to bridge page once (natural, not spammy)
- After 5 articles in niche → hub page auto-generated

---

## Module 5: Telegram Automation

### Post Format
```
[HOOK — 1-2 sentences, max 140 chars, creates open loop]

[BODY — 3-5 short paragraphs]

[CTA — single line with link]

#hashtag1 #hashtag2 #hashtag3
```

### 10-Post Series Schedule
| Post | Day | Format | Purpose |
|---|---|---|---|
| 1 | Day 1 | Text + image | Curiosity hook, no offer |
| 2 | Day 2 | Text only | "Did you know..." fact |
| 3 | Day 3 | Text + image | Mini tip + bridge page link |
| 4 | Day 5 | Text only | Question post (engagement) |
| 5 | Day 6 | Text + image | Testimonial / social proof |
| 6 | Day 7 | Text only | #1 mistake content + link |
| 7 | Day 9 | Text + image | Offer introduction |
| 8 | Day 10 | Text only | FAQ format + CTA |
| 9 | Day 12 | Text + image | Urgency + link |
| 10 | Day 14 | Text only | Final direct CTA |

### Optimal Post Times (UTC)
- 7:00–9:00 AM (morning commute)
- 12:00–1:00 PM (lunch)
- 8:00–10:00 PM (evening)

### Channel Growth (Fully Automated)
- Channel submitted to tgstat.com + telemetr.io on creation (they rank in Bing)
- Every bridge page contains Telegram channel invite link
- Email Day 3 contains Telegram channel invite
- Every article published contains "join our Telegram" link

### Image Spec
- 1280×720px JPEG at 85% quality
- Canvas-generated: dark gradient bg + hook text (white, 48px Inter) + brand name

---

## Module 6: Multi-Platform Publishing

| Platform | Content Type | API | Timing |
|---|---|---|---|
| dev.to | Long-form 1500+ words | Official API (instant token) | Immediate |
| Hashnode | Article + newsletter | Official API (instant token) | +3 min delay |
| Blogger | Full article + schema | Google Blogger API | +6 min delay |
| Tumblr | Short 400–600 words | Official API | +9 min delay |
| Your bridge page | Already live | Direct DB write | Immediate |

Delays are intentional (BullMQ rate limiter) to avoid bot detection.

**After every publish:**
1. IndexNow ping → all URLs submitted to Bing + Yandex + Seznam instantly
2. Google Search Console ping (if configured)
3. Sitemap at `t.yourdomain.com/sitemap.xml` updated automatically

### Platform-Specific Rules
- **dev.to:** Canonical URL = bridge page URL, 5 tags auto-assigned, author bio reused
- **Hashnode:** Canonical URL = bridge page URL, newsletter sent to Hashnode subscribers
- **Blogger:** Full article labels, custom robots.txt allows all, FAQ schema injected
- **Tumblr:** Casual tone, 10 niche hashtags, no affiliate link restrictions

---

## Module 7: Tracking Engine

### Click Attribution Chain
```
Published content → t.domain.com/r/[short_code]
  → record: IP hash, user-agent, referrer, UTM, timestamp, device, country
  → dedup: 1 unique click per IP-hash per campaign per 24h
  → redirect to bridge page
  → bridge page CTA → hoplink with sub=[short_code]
  → affiliate network postback → t.domain.com/postback
  → record conversion, attribute revenue to campaign + platform
```

### Network Postback Formats
- ClickBank: `tid=` parameter
- JVZoo: `customid=` parameter
- Digistore24: `cpersoparam=` parameter
- Generic: configurable parameter name per offer

### Metrics
- EPC = total_revenue / total_unique_clicks
- Conversion rate per platform source
- Per-platform EPC (reveals highest-value traffic source)
- Time-of-day analysis for Telegram scheduling optimization

### Security
- IP stored as SHA-256 hash only (GDPR compliant — never raw IP)
- Postback IPs validated against known affiliate network IP whitelist
- Duplicate `network_transaction_id` protection

---

## Module 8: Dashboard UX/UI

### Design System
- App background: #0F172A (dark navy)
- Card background: #1E293B
- Border: #334155
- Primary action: #6366F1 (indigo — for app UI, not customer-facing CTA)
- Success: #22C55E | Warning: #EAB308 | Error: #EF4444
- Text primary: #F1F5F9 | Text secondary: #94A3B8
- Font: Inter throughout

### Page Structure
```
/dashboard              — overview metrics, revenue chart, campaign list
/offers/new             — single hoplink input + launch button + pipeline progress
/campaigns/[id]         — campaign hub: pipeline status, quick stats
/campaigns/[id]/content — all content pieces, detection scores, approve/regenerate
/campaigns/[id]/bridge  — bridge page preview, template switcher, publish
/campaigns/[id]/publishing — platform publish status + live URLs
/campaigns/[id]/tracking — click/conversion analytics, platform EPC breakdown
/campaigns/[id]/email   — sequence performance (open/click per step)
/campaigns/[id]/telegram — post schedule, sent stats
/settings               — platform accounts, channels, SMTP, Ollama status
```

### Pipeline Progress Bar
8 steps with connecting lines:
`Parsed → Researched → Content Ready → Bridge Live → Publishing → Indexed → Email Active → Live`

### Conversion Funnel View
`Impressions → Clicks → Bridge Views → Opt-ins → Email Clicks → Conversions`
Shows exactly where drop-off happens.

### Mobile
- Bottom nav bar (5 items) replaces sidebar
- All tables become cards
- Pipeline: vertical layout
- PWA installable (manifest.json + service worker)
- Touch targets minimum 48×48px

---

## Complete Automated Pipeline Flow

```
YOU: paste hoplink → click Launch
    ↓ 2 min
Offer scraped, validated, data extracted, network detected
Market research: audience, pain points, benefits, trust signals stored
    ↓ 3 min
SERP top 10 scraped (Bing + Google) for primary keyword
Semantic gap: entities, headings, word count targets extracted
Content brief JSON generated
    ↓ 5 min
LLM generates ALL content using brief as context:
  bridge page (2 headline variants) | 4 platform articles | 5 Pinterest captions
  10 Telegram posts | 7 emails + 3 re-engage emails | lead magnet (7-12 pages)
  8 FAQ Q&As | 10 headlines | 5 CTA variants
    ↓ 3 min
Humanization pipeline: burstiness + perplexity + fingerprint injection
AI detection scoring: all pieces must score <15% before advancing
    ↓ 2 min
Lead magnet rendered to PDF via Puppeteer
Bridge page rendered from template + content → live at t.domain.com/go/[slug]
Tracking links created (1 per platform source)
Email opt-in form connected to Listmonk list (niche-tagged)
    ↓ 5 min (BullMQ parallel jobs)
Published to: dev.to, Hashnode, Blogger, Tumblr
IndexNow ping → Bing + Yandex + Seznam index all URLs same day
Sitemap updated
Telegram 10-post series queued at optimal times
    ↓
LIVE — traffic begins within 24-48h as Bing indexes content
    ↓
Visitor clicks → tracking link records → bridge page → opt-in → PDF delivered in 60s
14-day email drip begins automatically
Day 3 email → Telegram subscribe invite
Day 14 final email → re-engage sequence if no opens
All conversions tracked, attributed, displayed in dashboard
Email list compounds: engaged subscribers auto-enrolled in next same-niche campaign
```

---

## Sprint Plan

| Sprint | Weeks | Deliverable | Verification |
|---|---|---|---|
| 1 | 1–2 | Docker stack, DB, Nginx, auth, CI/CD, SMTP warm-up controller | docker compose up → login works → /api/health → 200 |
| 2 | 3–4 | Offer ingestion, Playwright scraper, link resolver, LLM extraction | Paste hoplink → offer record in DB within 2 min |
| 3 | 5–6 | SERP scraper, semantic gap analysis, content brief generator | Brief JSON with entity list generated |
| 4 | 7–8 | All 12 content types, humanization pipeline, detection scoring | All pieces score <15% |
| 5 | 9–10 | Lead magnet PDF, all 4 bridge templates, exit intent JS, A/B split | Bridge page live, PDF downloads, opt-in works |
| 6 | 11–12 | Tracking: click recorder, postback handler (4 networks), dedup | Simulated postback → conversion in DB |
| 7 | 13–14 | Multi-platform publisher, IndexNow, Canvas image generator, sitemap | All 4 platforms have live URLs after launch |
| 8 | 15–16 | Telegram automation, scheduler, channel registry, directory submit | Post fires at correct time, appears in channel |
| 9 | 17–18 | Listmonk integration, drip worker, spam check, re-engage sequence | Full 7-email sequence on test opt-in, spam score <2.0 |
| 10 | 19–20 | Full dashboard, analytics charts, conversion funnel, PWA | All metrics accurate against DB data |
| 11 | 21 | Security: AES-256 credential encryption, rate limits, GDPR, input validation | No raw IPs in DB, all credentials encrypted |
| 12 | 22 | Production deploy, SMTP warm-up live, full end-to-end smoke test | Hoplink → content → traffic → opt-in → conversion tracked |

---

## Security Requirements

- All platform credentials stored AES-256 encrypted (key in env var)
- Click IPs stored as SHA-256 hash only, never raw
- All API routes require valid session (NextAuth)
- Rate limiting on all endpoints (BullMQ + in-memory)
- Input validation with Zod on all user inputs
- FTC affiliate disclosure auto-injected on all content (cannot be disabled)
- Email: unsubscribe handled by Listmonk, physical address in footer (CAN-SPAM)
- Email: GDPR consent recorded at opt-in with timestamp

---

## File Structure

```
affiliate-castle/
├── .github/workflows/deploy.yml    ← CI/CD: push to main → deploy to Contabo
├── docker-compose.yml              ← PostgreSQL, Redis, Ollama, Listmonk, App
├── Dockerfile                      ← Production multi-stage build
├── nginx/                          ← Nginx configs for app + tracking subdomains
├── prisma/schema.prisma            ← Complete database schema
├── src/
│   ├── app/                        ← Next.js App Router pages
│   │   ├── api/                    ← Backend API routes
│   │   └── (dashboard)/            ← Protected dashboard pages
│   ├── components/                 ← React components
│   ├── lib/                        ← Core business logic modules
│   └── workers/                    ← Background job workers
├── templates/
│   ├── bridge/                     ← 4 HTML bridge page templates
│   ├── email/                      ← Email HTML templates
│   └── lead-magnet/                ← PDF lead magnet templates
└── prompts/                        ← LLM prompt templates (TypeScript)
```

---

## One-Time Setup Checklist (Before First Campaign)

- [ ] Create dev.to account → get API token → add to Settings
- [ ] Create Hashnode account → get API token → add to Settings
- [ ] Create Blogger account → enable API in Google Cloud Console → OAuth config
- [ ] Create Tumblr account → register OAuth app → get key/secret
- [ ] Create Telegram bot → @BotFather → get token → add channel
- [ ] Set SMTP warm-up start date (system auto-enforces daily limits)
- [ ] Set physical mailing address (CAN-SPAM footer requirement)
- [ ] Set `CREDENTIAL_ENCRYPTION_KEY` in .env (64-char hex string)
- [ ] Point app.yourdomain.com and t.yourdomain.com DNS to Contabo IP
- [ ] Run Certbot for both subdomains
- [ ] Pull Ollama model: `docker exec affiliate-castle-ollama-1 ollama pull llama3.3:70b`

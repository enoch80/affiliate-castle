# Affiliate Castle — Complete Implementation Plan (Source of Truth)

> **Last updated:** 2026-04-28  
> **Status:** All 12 sprints ✅ complete (123/123 tests passing). Phase 2: Platform activation in progress.  
> **Repo:** https://github.com/enoch80/affiliate-castle  
> **Server:** Contabo 109.199.106.147 — /opt/affiliate-castle  
> **App port:** 3200  
> **App URL:** https://app.digitalfinds.net  
> **Tracking domain:** t.digitalfinds.net  
> **SSH alias:** `ssh contabo-domainhunt`

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
| AI / LLM | Mistral Large/Small via OpenRouter | ~$0.01–$0.05/campaign |
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
4. Rank check scheduled (on-demand or scheduled daily) to track position in Bing top 50

### Rank Tracking (Free — Bing Scrape, No API Required)

Tracks the Bing position of every published platform URL (dev.to, Hashnode, Blogger, Tumblr, bridge page) for the campaign's primary keyword.

**How it works:**
- Scrapes Bing top 50 results using Playwright (already in project, zero cost)
- Compares each published URL against results using normalised URL matching
- Stores each check as a `RankSnapshot` (position, platform, keyword, timestamp)
- 30-day history per platform — shows rank trend over time

**Implementation:**
- `src/lib/rank-tracker.ts` — `checkCampaignRankings()` fetches Bing top 50, checks all URLs, persists snapshots
- `GET /api/campaigns/[id]/rankings` — latest snapshot + 30-day history per platform
- `POST /api/campaigns/[id]/rankings` — trigger a live rank check on demand
- `RankSnapshot` DB model — stores: platform, platformUrl, keyword, engine, rank (Int?), inTop10, inTop50, checkedAt

**Rank display in dashboard:**
- Best rank across all platforms
- Per-platform position badge (🥇 Top 10 / Top 50 / Not found)
- Sparkline trend for last 30 checks per platform

**No paid APIs ever used.** Method: direct Playwright Bing scrape, same UA rotation as SERP scraper.

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

| Sprint | Weeks | Deliverable | Tests | Status |
|---|---|---|---|---|
| 1 | 1–2 | Docker stack, DB, Nginx, auth, CI/CD, SMTP warm-up controller | 16 | ✅ 16/16 |
| 2 | 3–4 | Offer ingestion, Playwright scraper, link resolver, LLM extraction | 8 | ✅ 8/8 |
| 3 | 5–6 | SERP scraper, semantic gap analysis, content brief generator | 9 | ✅ 9/9 |
| 4 | 7–8 | All 12 content types, humanization pipeline, detection scoring | 10 | ✅ 10/10 |
| 5 | 9–10 | Lead magnet PDF, all 4 bridge templates, exit intent JS, A/B split | 9 | ✅ 9/9 |
| 6 | 11–12 | Tracking: click recorder, postback handler (4 networks), dedup | 7 | ✅ 7/7 |
| 7 | 13–14 | Multi-platform publisher, IndexNow, Canvas image generator, sitemap, Bing rank tracker | 9 | ✅ 9/9 |
| 8 | 15–16 | Telegram automation, scheduler, channel registry, directory submit | 9 | ✅ 9/9 |
| 9 | 17–18 | Listmonk integration, drip worker, spam check, re-engage sequence | 11 | ✅ 11/11 |
| 10 | 19–20 | Full dashboard, analytics charts, conversion funnel, PWA | 10 | ✅ 10/10 |
| 11 | 21 | Security: AES-256 credential encryption, rate limits, GDPR, Zod | 10 | ✅ 10/10 |
| 12 | 22 | Production deploy, SMTP warm-up live, full E2E smoke test | 10 | ✅ 10/10 |
| **TOTAL** | | | **123** | **✅ 123/123** |

### Known Test Flakes (infrastructure, not regressions)
- **Sprint 4** `content_ready campaign shows content pieces panel` — `ERR_EMPTY_RESPONSE` under parallel load; passes on retry or with `--workers=1`.
- **Sprint 5** `login still works (regression)` — `chrome-error://chromewebdata/` under parallel load; same fix.
- **Rate-limit conflicts:** Sprint 6 opt-in tests use `X-Forwarded-For: 10.99.1.1/1.2`; Sprint 11 uses `10.99.2.1`; Sprint 12 derives unique IP from `Date.now()` to avoid 429 conflicts.

### Smoke Test Fixtures (Sprint 12)
```json
{
  "campaignId": "cmocbnhc10002zj3hjorpynti",
  "shortCode": "qo5jgvWA",
  "destinationUrl": "https://hop.clickbank.net/?affiliate=testaffiliate&vendor=testvendor",
  "status": "bridge_ready"
}
```

---

## Security Requirements

- All platform credentials stored AES-256-GCM encrypted (key in env var `CREDENTIAL_ENCRYPTION_KEY`)
- Click IPs stored as SHA-256 hash only, never raw (GDPR compliant)
- All API routes require valid session (NextAuth), except `/api/t/*` and `/api/health`
- Rate limiting on all endpoints: `/api/t/click` → 60/60s; `/api/t/optin` → 5/600s
- Input validation with Zod on all user inputs
- FTC affiliate disclosure auto-injected on all content (cannot be disabled)
- Email: unsubscribe handled by Listmonk, physical address in footer (CAN-SPAM)
- Email: GDPR consent recorded at opt-in with timestamp
- OAuth CSRF: HMAC-SHA256 JWT state token in HTTP-only cookie (10 min TTL)
- OAuth PKCE: SHA-256 code challenge for Blogger/Google, stored in `oauth_pkce` cookie
- OAuth1 Tumblr: server-side HMAC-SHA1 `request_token`; secret in `oauth_tmp_secret` cookie
- Postback IPs validated against `POSTBACK_IP_WHITELIST` env var (empty = accept all)
- Cron endpoint `/api/cron/aggregate-analytics` protected by `CRON_SECRET` header

---

## Phase 2 — Platform Account Activation (Post-Sprint 12)

After all 12 sprints completed, focus shifted to connecting live publisher platform accounts to the system.

### Platform Account Status (as of 2026-04-28)

| Platform | Status | Account | Notes |
|----------|--------|---------|-------|
| dev.to | ⚠️ HARD WALL | `dfpubhgi106` | Account restricted — POST /users/api_secrets returns 404. Human must login at https://dev.to → Settings → Extensions → generate API key manually. |
| tumblr | ⚠️ SCOPE LIMITED | `digitalfinds` | OAuth1 tokens connected but read-only scope. Cannot publish or update blog. Needs re-authorization with write scope. |
| hashnode | ✅ CONNECTED | `enoch80` | publicationId `69eb42c61e45c4e0dac81b37`. Bio + tagline set via GraphQL. API token in DB. |
| medium | ❌ HARD WALL | — | Contabo server IP blocked by Cloudflare for medium.com. No integration_token available. Requires residential proxy OR existing account's integration_token. |
| blogger | ⚠️ PENDING | — | Needs `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` set in server `.env`. |
| pinterest | ⚠️ PENDING | — | Needs `PINTEREST_CLIENT_ID` + `PINTEREST_CLIENT_SECRET` set in server `.env`. |

### Cloudflare Block — Root Cause
Contabo `109.199.106.147` is a **datacenter IP**. Cloudflare applies `cType: 'managed'` challenge to Hashnode `/login` and Medium auth pages from datacenter IPs. Playwright headless from this IP cannot solve managed challenges.

**Medium:** Cookie-based session works for reading but Cloudflare blocks API calls from the server IP. No `integration_token` issued for new accounts since 2023.

**Hashnode:** Connected via direct API token (bypasses CF entirely). Public `/login` page is CF-blocked but token-based publishing works fine.

### Platform Hard Walls — Human Action Required

**dev.to:**
1. Login to https://dev.to as `dfpubhgi106` / `DevSecure2026Final@`
2. Go to Settings → Extensions → DEV Community API Keys → Generate key
3. Save via Settings UI (POST `/api/settings`) or: `curl -X POST https://app.digitalfinds.net/api/settings -H 'Content-Type: application/json' -d '{"platform":"devto","username":"dfpubhgi106","credentials":{"api_key":"<new_key>"}}'`

**Tumblr:**
Re-run OAuth flow with write permissions — visit Tumblr OAuth authorize URL with `consumer_key=T8uJypKlj1V8FG0Zpr8juwRXLJBoqYWyxwTAd3CZRiB6AoZKt8` and request `write` scope.

**Blogger:**
1. Go to https://console.cloud.google.com/apis/credentials (as idriss.ksa@gmail.com)
2. Create OAuth 2.0 Client ID → Web application
3. Add Authorized redirect URI: `https://app.digitalfinds.net/api/auth/oauth/callback`
4. Enable Blogger API v3
5. Add to server `.env`: `GOOGLE_CLIENT_ID=xxx` `GOOGLE_CLIENT_SECRET=xxx`
6. `ssh contabo-domainhunt "cd /opt/affiliate-castle && docker compose up -d --force-recreate app"`

**Pinterest:**
1. Go to https://developers.pinterest.com/apps/
2. Create app 'Digital Finds Publisher'
3. Redirect URI: `https://app.digitalfinds.net/api/auth/oauth/callback`
4. Scopes: `boards:read boards:write pins:read pins:write user_accounts:read`
5. Add to server `.env`: `PINTEREST_CLIENT_ID=xxx` `PINTEREST_CLIENT_SECRET=xxx`
6. Restart app (same as above)

---

## Module 9: OAuth Platform Connect Flow (Added 2026-04-27)

One-click OAuth popup connect flow for all 6 publishing platforms.

### Auth Types per Platform

| Platform | Auth Type |
|----------|-----------|
| dev.to | Manual token (paste API key) |
| hashnode | Manual token (paste API key) |
| medium | Manual token (paste integration_token or cookie_session) |
| blogger | OAuth2 (Google PKCE) |
| pinterest | OAuth2 (PKCE) |
| tumblr | OAuth1 (HMAC-SHA1) |

### New API Routes

| Route | Method | Auth | Purpose |
|-------|--------|------|---------|
| `/api/auth/oauth/start` | GET | Yes | Generates PKCE + HMAC-JWT state, returns popup URL |
| `/api/auth/oauth/callback` | GET | No | Exchanges code/verifier, upserts PlatformAccount, postMessage + close |
| `/api/auth/oauth/refresh` | POST | Yes | Silent token refresh using stored `refresh_token` |
| `/api/settings/verify` | GET | Yes | Test live connection for a stored platform account |
| `/api/settings/status` | GET | Yes | Returns `{id, authType, ready}` per platform without exposing env var values |

### Database Migration
```sql
-- 20260427000000_platform_token_expires
ALTER TABLE "PlatformAccount" ADD COLUMN "tokenExpiresAt" TIMESTAMP(3);
```

### Security Implementation
- CSRF: HMAC-SHA256 signed JWT state in HTTP-only cookie (10 min TTL), verified on callback
- PKCE: SHA-256 code challenge generated per-session for Blogger/Google
- OAuth1: server-side HMAC-SHA1 request_token; secret in `oauth_tmp_secret` cookie
- Auto-refresh: verify GET catches `TOKEN_EXPIRED`, calls `/api/auth/oauth/refresh`, retries

### Settings Page UX
- Platform cards show `Connected` / `Not connected` / `Admin setup required` states
- `Admin setup required` state shown in amber when OAuth client credentials absent from `.env`
- Shows exact redirect URI to register per provider
- Token platforms: text input for API key + Connect button
- OAuth2/OAuth1 platforms: Connect opens popup window, closes on success, updates card

---

## Module 10: Browser Agent Server (Added 2026-04-26)

Headless Playwright browser automation server for platform account setup that cannot be done via API.

- **File:** `browser-agent-server.js` (deployed at `/opt/affiliate-castle/`, 2604+ lines)
- **Docker service:** `browser-agent` — internal URL `http://172.19.0.7:4000`
- **Endpoints:**
  - `POST /sessions` — launch a named platform agent session
  - `GET /sessions/:id/progress` — poll session status and log messages
  - `GET /healthz` — health check
  - `POST /sessions/:id/navigate` — navigate browser to URL during session

### Supported Platform Agents

| Agent Name | Purpose |
|------------|---------|
| `hashnode_agent` | Hashnode account setup (CF-blocked from server IP — hard wall) |
| `medium_agent` | Medium sign-in via SPA click-nav (CF bypassed) |
| `pinterest_setup` | Pinterest developer portal navigation (requires human login) |
| `probe` | Diagnostic probe for CF challenge detection |

### Usage

```bash
# Launch an agent session
ssh contabo-domainhunt "curl -s -X POST http://172.19.0.7:4000/sessions \
  -H 'Content-Type: application/json' \
  -d '{\"platform\":\"medium_agent\",\"secret\":\"agent-internal\"}' | python3 -c \
  'import sys,json; d=json.load(sys.stdin); print(d.get(\"sessionId\",d))'"

# Poll progress
ssh contabo-domainhunt "curl -s http://172.19.0.7:4000/sessions/<SESSION_ID>/progress | python3 -c \
  'import sys,json; d=json.load(sys.stdin); [print(p[\"msg\"]) for p in d.get(\"progress\",[])]'"

# Rebuild after JS change
scp /tmp/browser-agent-server.js contabo-domainhunt:/opt/affiliate-castle/browser-agent-server.js
ssh contabo-domainhunt "cd /opt/affiliate-castle && docker compose build browser-agent 2>&1 | tail -5 && docker compose up -d --force-recreate browser-agent && sleep 3 && curl -s http://172.19.0.7:4000/healthz"
```

---

## Module 11: Mobile UI (Added 2026-04-27)

Full responsive redesign audit at 390×844 (iPhone 14 Pro). All 13 affected files fixed.

### Root Cause
`Sidebar.tsx` used fixed `w-56` (224px) with no responsive breakpoint, consuming 57% of screen width on mobile.

### Key Changes

| File | Fix |
|------|-----|
| `src/components/Sidebar.tsx` | Rewritten: desktop `hidden lg:flex`; mobile fixed `h-14` top bar with hamburger + slide-out `w-64` drawer (z-50) + backdrop overlay |
| `src/app/(dashboard)/layout.tsx` | Added `pt-14 lg:pt-0` to `<main>` to clear mobile header |
| All dashboard pages | Converted `p-8` → `p-4 sm:p-8`; `grid-cols-4` → `grid-cols-2 sm:grid-cols-4`; `max-w-*xl` retained |
| `CampaignSubNav.tsx` | `overflow-x-auto scrollbar-none`; `flex-shrink-0` on each tab link |
| Campaign detail page | Pipeline bar wrapped in `overflow-x-auto min-w-[480px]`; stats `grid-cols-2 sm:grid-cols-4` |

### PWA (Added Sprint 10)
- `public/manifest.json` — name "Affiliate Castle", start_url `/dashboard`, display `standalone`, theme `#0F172A`
- `public/sw.js` — cache-first only for `/img/`, `/fonts/`, `/manifest.json`; all HTML navigate requests always go to network
- `src/components/ServiceWorkerRegistrar.tsx` — client component that registers SW after hydration

---

## Module 12: Telegram Channels Management UI (Added 2026-04-28)

New dashboard page for managing Telegram channels and post schedules.

- **Route:** `/dashboard/channels`
- **Sidebar:** "Channels" nav item added between Analytics and Settings
- **API:** `GET/POST /api/channels`, `GET/DELETE /api/channels/[id]`

---

## Module 13: Analytics Cron (Added Sprint 10)

Daily rollup of per-campaign metrics into `DailyAnalytic` table.

- **Route:** `GET /api/cron/aggregate-analytics`
- **Auth:** `x-cron-secret: <CRON_SECRET>` header required (returns 401 without it)
- **Action:** Upserts `DailyAnalytic` row per campaign per day with clicks/optIns/conversions/revenue

---

## Complete API Routes (Updated 2026-04-28)

| Route | Method | Auth | Purpose |
|-------|--------|------|---------|
| `/api/health` | GET | No | Health check with DB liveness (`components.db`) |
| `/api/offers` | POST | Yes | Submit hoplink → start pipeline |
| `/api/campaigns` | GET | Yes | List all campaigns |
| `/api/campaigns/[id]` | GET | Yes | Campaign detail |
| `/api/campaigns/[id]/content` | GET | Yes | Content pieces |
| `/api/campaigns/[id]/brief` | GET | Yes | Content brief JSON |
| `/api/campaigns/[id]/bridge` | GET/POST | Yes | Bridge page management |
| `/api/campaigns/[id]/publishing` | GET | Yes | Publish job status |
| `/api/campaigns/[id]/tracking` | GET | Yes | Click/conversion analytics |
| `/api/campaigns/[id]/analytics` | GET | Yes | Campaign-level analytics aggregates |
| `/api/campaigns/[id]/email` | GET | Yes | Email sequence performance |
| `/api/campaigns/[id]/telegram` | GET | Yes | Telegram post schedule |
| `/api/campaigns/[id]/rankings` | GET/POST | Yes | Bing rank snapshots |
| `/api/analytics` | GET | Yes | Global analytics (all campaigns) |
| `/api/channels` | GET/POST | Yes | Telegram channel registry |
| `/api/channels/[id]` | GET/DELETE | Yes | Individual channel management |
| `/api/settings` | GET/POST/DELETE | Yes | Platform account management (AES-256 encrypted) |
| `/api/settings/verify` | GET | Yes | Test live connection for stored platform account |
| `/api/settings/status` | GET | Yes | Platform readiness (OAuth creds present?) |
| `/api/auth/oauth/start` | GET | Yes | Begin OAuth popup flow |
| `/api/auth/oauth/callback` | GET | No | OAuth code exchange + account upsert |
| `/api/auth/oauth/refresh` | POST | Yes | Silent OAuth token refresh |
| `/api/auth/[...nextauth]` | GET/POST | No | NextAuth session handler |
| `/api/t/click` | GET | No | Click tracking + redirect (rate limit: 60/60s) |
| `/api/r/[code]` | GET | No | Short-code redirect (same as `/api/t/click`) |
| `/api/t/optin` | POST | No | Opt-in capture (rate limit: 5/600s, GDPR consent) |
| `/api/t/postback` | GET/POST | No | Affiliate network postback (4 networks) |
| `/api/smtp/warmup` | GET | Yes | SMTP warmup status (dayNumber, dailyLimit) |
| `/api/cron/aggregate-analytics` | GET | `x-cron-secret` | Daily metrics rollup |

---

## Complete Environment Variables (Updated 2026-04-28)

```bash
# Core infrastructure
DATABASE_URL                # postgresql://affiliate:<pass>@postgres:5432/affiliatecastle
REDIS_URL                   # redis://redis:6379
NEXTAUTH_SECRET             # 64-char random string
NEXTAUTH_URL                # https://app.digitalfinds.net
ADMIN_EMAIL                 # operator email
ADMIN_PASSWORD_HASH         # bcrypt hash — use scripts/hash-password.js

# App domain
APP_DOMAIN                  # app.digitalfinds.net
TRACKING_DOMAIN             # t.digitalfinds.net

# AI / LLM (OpenRouter → Mistral — see planup1.md §12.12 for full migration spec)
OPENROUTER_API_KEY          # from openrouter.ai — routes to Mistral Large/Small
MISTRAL_LARGE_MODEL         # mistralai/mistral-large-latest (articles, bridge, lead magnets)
MISTRAL_SMALL_MODEL         # mistralai/mistral-small-3.2-24b-instruct (captions, FAQs, CTAs)

# Email / SMTP
LISTMONK_URL                # http://localhost:9000
LISTMONK_USERNAME           # admin
LISTMONK_PASSWORD           # <password>
LISTMONK_LIST_ID            # list ID for subscriber management
LISTMONK_DRIP_TEMPLATE_ID   # template ID for drip emails
SMTP_HOST                   # mail.digitalfinds.net
SMTP_PORT                   # 587
SMTP_FROM_NAME              # (sender name)
SMTP_FROM_EMAIL             # connection@digitalfinds.net
SMTP_WARMUP_START_DATE      # ISO date (e.g. 2026-04-24) — warmup day counter
EMAIL_SENDER_NAME           # "Sarah from HealthEdge Daily"
EMAIL_SENDER_ADDRESS        # sender@yourdomain.com
EMAIL_PHYSICAL_ADDRESS      # CAN-SPAM mailing address
PIPELINE_TEST_EMAIL         # seed address for test drip on pipeline run
COMPANY_ADDRESS             # CAN-SPAM requirement

# Security
CREDENTIAL_ENCRYPTION_KEY   # 64-char hex string (AES-256 key for PlatformAccount)
POSTBACK_IP_WHITELIST       # comma-separated IP ranges; empty = accept all
CRON_SECRET                 # API key for /api/cron/aggregate-analytics

# Search indexing
INDEXNOW_KEY                # auto-generated; served from /.well-known/indexnow.txt

# Platform OAuth credentials (required for OAuth connect flow)
GOOGLE_CLIENT_ID            # from Google Cloud Console (Blogger OAuth)
GOOGLE_CLIENT_SECRET        # from Google Cloud Console
GOOGLE_EMAIL                # idriss.ksa@gmail.com (for browser agent fallback)
GOOGLE_PASSWORD             # real Google account password (not a PAT)
PINTEREST_CLIENT_ID         # from Pinterest Developers
PINTEREST_CLIENT_SECRET     # from Pinterest Developers
TUMBLR_CONSUMER_KEY         # from Tumblr OAuth app
TUMBLR_CONSUMER_SECRET      # from Tumblr OAuth app
TUMBLR_TOKEN                # OAuth1 access token (stored in DB, also here for bootstrap)
TUMBLR_TOKEN_SECRET         # OAuth1 access token secret

# Browser agent
GITHUB_USERNAME             # enoch80 (for browser agent GitHub OAuth fallback)
GITHUB_PASSWORD             # REAL GitHub web UI password (NOT a personal access token)
CAPSOLVER_KEY               # CaptchaSolver API key for Turnstile solving
AGENT_SECRET                # agent-internal (guards browser-agent-server.js POST /sessions)
```

---

## Complete File Structure (Updated 2026-04-28)

```
affiliate-castle/
├── .github/
│   ├── agents/
│   │   ├── api.agent.md          ← 3SR API orchestration agent (added 2026-04-26)
│   │   └── qa.agent.md           ← QA validation agent (added 2026-04-26)
│   ├── prompts/
│   │   ├── api.prompt.md         ← /api entrypoint
│   │   └── qa.prompt.md          ← /qa entrypoint
│   ├── copilot-instructions.md   ← global stack rules + Contabo SSH
│   └── workflows/deploy.yml      ← CI/CD: push to main → deploy to Contabo
├── prisma/
│   ├── schema.prisma
│   └── migrations/
│       ├── 20260423000000_init/
│       ├── 20260424000000_add_rank_snapshot/
│       └── 20260427000000_platform_token_expires/   ← tokenExpiresAt column
├── scripts/
│   ├── api-watchdog.ts           ← 3SR watchdog state machine
│   ├── qa-watchdog.ts            ← QA watchdog (heartbeat, pass/fail tracking)
│   ├── mobile-audit.ts           ← Mobile viewport audit helper
│   └── hash-password.js          ← bcrypt hash util for ADMIN_PASSWORD_HASH
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── health/            ← DB liveness probe
│   │   │   ├── offers/            ← Start pipeline
│   │   │   ├── campaigns/         ← Campaign CRUD + sub-routes
│   │   │   ├── analytics/         ← Global analytics
│   │   │   ├── channels/          ← Telegram channel registry
│   │   │   ├── settings/          ← Platform accounts + verify + status
│   │   │   ├── auth/
│   │   │   │   ├── [...nextauth]/ ← NextAuth handler
│   │   │   │   └── oauth/         ← start / callback / refresh
│   │   │   ├── t/                 ← click / optin / postback
│   │   │   ├── r/[code]/          ← Short-code redirect
│   │   │   ├── smtp/warmup/       ← SMTP warmup status
│   │   │   └── cron/aggregate-analytics/  ← Daily rollup cron
│   │   ├── (dashboard)/
│   │   │   ├── layout.tsx         ← pt-14 lg:pt-0 for mobile header offset
│   │   │   ├── dashboard/
│   │   │   │   ├── page.tsx       ← Overview + launch
│   │   │   │   ├── campaigns/     ← Campaign list + detail sub-pages
│   │   │   │   ├── analytics/     ← Analytics page
│   │   │   │   ├── channels/      ← Telegram channels management (NEW)
│   │   │   │   └── settings/      ← Platform account management
│   │   ├── go/[slug]/             ← Bridge pages (public)
│   │   └── login/
│   ├── components/
│   │   ├── Sidebar.tsx            ← Desktop sidebar + mobile hamburger drawer
│   │   └── ServiceWorkerRegistrar.tsx  ← Client component for SW registration
│   ├── lib/
│   │   ├── ai-detector.ts
│   │   ├── auth.ts
│   │   ├── bridge-renderer.ts
│   │   ├── content-brief.ts
│   │   ├── content-generator.ts
│   │   ├── credentials.ts         ← AES-256-GCM encrypt/decrypt
│   │   ├── drip-scheduler.ts
│   │   ├── email-sequence.ts
│   │   ├── ftc-disclosure.ts
│   │   ├── humanizer.ts
│   │   ├── link-resolver.ts
│   │   ├── listmonk.ts
│   │   ├── llm-extractor.ts
│   │   ├── offer-scraper.ts
│   │   ├── pdf-generator.ts
│   │   ├── platform-registry.ts   ← OAuth config + platform metadata (NEW)
│   │   ├── prisma.ts
│   │   ├── queue.ts
│   │   ├── rank-tracker.ts
│   │   ├── rate-limiter.ts
│   │   ├── semantic-gap.ts
│   │   ├── serp-scraper.ts
│   │   ├── smtp-warmup.ts
│   │   ├── spam-checker.ts
│   │   ├── telegram-scheduler.ts
│   │   ├── telegram.ts
│   │   ├── tracking.ts
│   │   └── publisher/             ← Per-platform publish adapters
│   └── workers/
│       ├── email-worker.ts
│       ├── offer-pipeline.ts
│       └── telegram-worker.ts
├── templates/
│   ├── bridge/                    ← 4 HTML bridge page templates
│   ├── email/                     ← Email HTML templates
│   └── lead-magnet/               ← PDF lead magnet templates
├── tests/e2e/
│   ├── sprint1.spec.ts – sprint12.spec.ts
│   ├── audit-platforms.spec.ts    ← Platform settings audit (screenshots + Test Connection)
│   └── visual.spec.ts             ← Visual regression screenshots
├── public/
│   ├── manifest.json              ← PWA manifest
│   └── sw.js                      ← Service worker (cache-first for assets only)
├── browser-agent-server.js        ← Deployed at /opt/affiliate-castle on server
├── docker-compose.yml
├── Dockerfile
├── Dockerfile.worker
├── playwright.config.ts
├── castle.md                      ← Single reference document for all agents
├── plan.md                        ← THIS FILE
├── progress.md                    ← Session-resumption memory
└── qa_knowledge_base.json         ← Structured QA findings (JSON-LD)
```

---

## QA Infrastructure (Added 2026-04-26)

### Watchdog Scripts

| Script | Purpose |
|--------|---------|
| `scripts/qa-watchdog.ts` | QA session state: heartbeat, pass/fail tracking, stall detection |
| `scripts/api-watchdog.ts` | API orchestration state machine with 3SR (Self-healing, Stall-detection, Route-tracking) |

```bash
# Initialize QA watchdog
npx ts-node --skip-project --compiler-options '{"module":"commonjs"}' scripts/qa-watchdog.ts init --goal "description"

# Record pass/fail
npx ts-node --skip-project --compiler-options '{"module":"commonjs"}' scripts/qa-watchdog.ts pass --test "sprint12 full suite"
npx ts-node --skip-project --compiler-options '{"module":"commonjs"}' scripts/qa-watchdog.ts fail --test "sprint4.test3" --error "ERR_EMPTY_RESPONSE" --file "src/workers/offer-pipeline.ts"

# Run full E2E suite
npx playwright test tests/e2e/ --config playwright.config.ts --workers=1

# Run specific sprint
npx playwright test tests/e2e/sprint12.spec.ts --config playwright.config.ts --reporter=list

# Platform audit test
BASE_URL=https://app.digitalfinds.net npx playwright test tests/e2e/audit-platforms.spec.ts --project=chromium --reporter=list
```

### CI/CD
`.github/workflows/deploy.yml` — triggers on push to `main`:
1. SSH to Contabo
2. `git pull`
3. `docker compose build app`
4. `docker compose up -d --force-recreate app worker`

---

## Known Bugs & Technical Debt (Updated 2026-04-28)

| Area | Issue | Status |
|------|-------|--------|
| dev.to | Account `dfpubhgi106` restricted by dev.to bot detection — no API key creation | Hard wall — human login required |
| Tumblr | OAuth1 tokens have read-only scope — cannot publish or update blog | Hard wall — needs re-authorization with write scope |
| Medium | Server IP `109.199.106.147` blocked by Cloudflare — no `integration_token` available | Hard wall — needs residential proxy or existing token |
| Hashnode | CF blocks `/login` from datacenter IP | Resolved — connected via direct API token |
| Blogger | `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` not set in `.env` | Pending human setup |
| Pinterest | `PINTEREST_CLIENT_ID` / `PINTEREST_CLIENT_SECRET` not set in `.env` | Pending human setup |
| Sprint 4 flake | `content_ready` test — ERR_EMPTY_RESPONSE under parallel load | Known flake, not regression |
| Sprint 5 flake | `login still works` — chrome-error://chromewebdata/ under parallel load | Known flake, not regression |
| Analytics cron | `sentToday` in SMTP warmup aggregates lifetime, not just today | Known limitation, noted in code comment |
| Analytics route | `telegramViews` queried twice in same Promise.all in campaign analytics | Duplicate DB query, functionally correct |

---

## One-Time Setup Checklist (Before First Campaign)

- [ ] Create Hashnode account → get API token → add to Settings ✅ (done: enoch80)
- [ ] Create dev.to account → get API token → add to Settings ⚠️ (account restricted — see hard wall)
- [ ] Create Tumblr account → OAuth with **write scope** → get tokens ⚠️ (needs re-auth)
- [ ] Create Blogger account → Google Cloud Console OAuth app → add `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` to `.env`
- [ ] Create Pinterest developer account → OAuth app → add `PINTEREST_CLIENT_ID` / `PINTEREST_CLIENT_SECRET` to `.env`
- [ ] Create Telegram bot → @BotFather → get token → add channel → add to Settings/Channels
- [ ] Set `SMTP_WARMUP_START_DATE` (ISO date) to control warmup ramp
- [ ] Set `CREDENTIAL_ENCRYPTION_KEY` in `.env` (64-char hex string)
- [ ] Set physical mailing address (`COMPANY_ADDRESS`) for CAN-SPAM email footer
- [ ] Register OAuth redirect URI in Google Cloud Console: `https://app.digitalfinds.net/api/auth/oauth/callback`
- [ ] Register OAuth redirect URI in Pinterest developer portal: same URL
- [ ] Register OAuth callback in Tumblr app settings: same URL
- [ ] Point `app.digitalfinds.net` and `t.digitalfinds.net` DNS to Contabo IP ✅ (done)
- [ ] Run Certbot for both subdomains ✅ (done)
- [ ] Set `OPENROUTER_API_KEY` in `.env` (see planup1.md §12.12 for full Mistral migration spec)
- [ ] Set `CRON_SECRET` for aggregate-analytics endpoint

---

## File Structure

> See **Complete File Structure** section below for the authoritative and up-to-date tree.

---

## One-Time Setup Checklist (Before First Campaign)

> See **One-Time Setup Checklist** in the Phase 2 section below for the complete and up-to-date list.

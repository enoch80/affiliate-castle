# Affiliate Castle — Complete Agent Knowledge Base

> **Generated:** 2026-04-26  
> **Source:** Live repo scan `enoch80/affiliate-castle` + `progress.md` + `plan.md` + `qa_knowledge_base.json`  
> **Purpose:** Single reference file for any agent (api, qa, dev, auto) working on this repo. Read this before acting.

---

## 1. Project Identity

| Field | Value |
|-------|-------|
| Repo | `https://github.com/enoch80/affiliate-castle` |
| Server | Contabo `109.199.106.147` · path `/opt/affiliate-castle` |
| App port | **3200** |
| App URL | `https://app.digitalfinds.net` |
| Tracking domain | `t.digitalfinds.net` |
| SSH alias | `ssh contabo-domainhunt` (same server as domain-hunt) |
| Agent email | `connection@digitalfinds.net` |
| Maildir | `/home/connection/Maildir/new/` |

**Vision:** Paste one affiliate hoplink → press Launch → the system researches the market, scrapes competitors, writes AI-undetectable content, builds a bridge page with lead capture, publishes to 4 platforms, pings IndexNow, schedules Telegram posts, starts a 14-day email drip, and tracks every click to conversion. Zero recurring cost beyond the Contabo VPS.

---

## 2. Technology Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14 (App Router) |
| Backend | Next.js API Routes + Node.js 20 workers |
| Database | PostgreSQL 16 (Docker) — db `affiliatecastle`, user `affiliate` |
| Job queue | BullMQ + Redis 7 (Docker) |
| LLM / AI | Ollama + Llama 3.3 70B (local, port 11434) |
| AI detection | RoBERTa detector (local HuggingFace) |
| Email engine | Listmonk self-hosted (port 9000) |
| SMTP | Postfix on same server · domain `digitalfinds.net` |
| Telegram | Official Bot API (`node-telegram-bot-api`) |
| Image gen | Sharp + Canvas API |
| PDF gen | Puppeteer (headless Chrome) |
| Web scraper | Playwright headless |
| NLP | compromise.js + natural.js |
| Auth | NextAuth v4 (single-owner admin login, bcrypt hash) |
| Reverse proxy | Nginx + Certbot/Let's Encrypt |
| Language | TypeScript 5, Node 20 |
| ORM | Prisma 5 |
| Validation | Zod throughout all API routes |

---

## 3. Infrastructure — Docker Services

```yaml
postgres   → 127.0.0.1:5432   (PostgreSQL 16)
redis      → 127.0.0.1:6379   (Redis 7)
ollama     → 127.0.0.1:11434  (LLM)
listmonk   → 127.0.0.1:9000   (email)
app        → 127.0.0.1:3200   (Next.js)
browser-agent → docker internal 172.19.0.7:4000 (Playwright browser agent)
```

**Tunnel for local access:**
```bash
ssh -i ~/.ssh/contabo_key -fNL 3200:127.0.0.1:3200 root@109.199.106.147 -N
```

---

## 4. NPM Scripts

| Command | Action |
|---------|--------|
| `npm run dev` | Local development server |
| `npm run build` | Production build |
| `npm run start` | Start on port **3200** |
| `npm run lint` | ESLint |
| `npm run db:migrate` | `prisma migrate deploy` |
| `npm run db:generate` | `prisma generate` |
| `npm run db:studio` | Prisma Studio |
| `npm run workers:start` | Start background workers (`dist/workers/index.js`) |

---

## 5. Source Tree

```
affiliate-castle/
├── .github/
│   ├── agents/
│   │   └── api.agent.md          ← 3SR API agent (added 2026-04-26)
│   ├── prompts/
│   │   └── api.prompt.md         ← /api entrypoint (added 2026-04-26)
│   ├── copilot-instructions.md   ← global stack rules + Contabo (added 2026-04-26)
│   └── workflows/deploy.yml      ← CI/CD: push to main → deploy to Contabo
├── prisma/schema.prisma          ← Complete database schema
├── scripts/
│   └── api-watchdog.ts           ← 3SR watchdog state machine (added 2026-04-26)
├── src/
│   ├── app/
│   │   ├── api/                  ← API routes (see §7)
│   │   └── (dashboard)/          ← Protected pages
│   ├── components/               ← React UI components
│   ├── lib/                      ← Core business logic
│   ├── workers/                  ← BullMQ background workers
│   └── middleware.ts             ← NextAuth session guard
├── templates/
│   ├── bridge/                   ← 4 bridge page HTML templates
│   ├── email/                    ← Email HTML templates
│   └── lead-magnet/              ← PDF lead magnet templates
├── tests/e2e/                    ← Playwright E2E tests (sprint1–sprint12)
├── docker-compose.yml
├── Dockerfile
├── plan.md                       ← Master implementation plan (source of truth)
├── progress.md                   ← Live session-resumption memory
└── qa_knowledge_base.json        ← Structured QA findings
```

---

## 6. Database Schema (Prisma Models)

| Model | Key Fields | Purpose |
|-------|-----------|---------|
| `Offer` | `hoplink`, `resolvedUrl`, `network`, `niche`, `status` | Affiliate offer parsed from hoplink |
| `MarketResearch` | `targetAudience`, `painPoints`, `benefits`, `competitorUrls` | LLM market research per offer |
| `KeywordResearch` | `primaryKeyword`, `serpTop10`, `semanticGap`, `targetWordCount` | SERP analysis per offer |
| `Campaign` | `offerId`, `status`, `totalClicks`, `totalConversions`, `totalRevenue` | Campaign container |
| `ContentPiece` | `type`, `contentText`, `contentHtml`, `detectionScore`, `status` | 12 content types per campaign |
| `LeadMagnet` | `title`, `type`, `pdfPath`, `downloadCount` | Lead magnet PDFs |
| `BridgePage` | `slug`, `templateId`, `optInEnabled`, `views`, `optIns` | Bridge pages at `/go/[slug]` |
| `TrackingLink` | `shortCode`, `platform`, `clicks`, `uniqueClicks` | Per-platform tracking links |
| `PlatformAccount` | `platform`, `username`, `credentialsEncrypted` | Encrypted publisher credentials |
| `TelegramPost` | `scheduledAt`, `sentAt`, `channelId` | Telegram schedule |
| `EmailSequence` | `step`, `subject`, `htmlContent`, `delayDays` | 14-day drip sequence |
| `PublishJob` | `platform`, `status`, `publishedUrl` | Platform publish state |
| `RankSnapshot` | `platform`, `keyword`, `position` | Bing rank tracker |
| `DailyAnalytic` | `clicks`, `optIns`, `conversions`, `revenue` | Daily analytics rollup |

**DB operations:**
```bash
# Direct psql on server
ssh contabo-domainhunt "cd /opt/affiliate-castle && docker compose exec -T postgres psql -U affiliate -d affiliatecastle -c 'SELECT count(*) FROM \"Campaign\";'"

# Check platform accounts
ssh contabo-domainhunt "cd /opt/affiliate-castle && docker compose exec -T postgres psql -U affiliate -d affiliatecastle -c 'SELECT id,platform,username,\"createdAt\" FROM \"PlatformAccount\" ORDER BY \"createdAt\" DESC;'"
```

---

## 7. API Routes

| Route | Method | Auth | Purpose |
|-------|--------|------|---------|
| `/api/health` | GET | No | Health check with DB liveness (`components.db`) |
| `/api/offers` | POST | Yes | Submit hoplink → start pipeline |
| `/api/campaigns` | GET | Yes | List all campaigns |
| `/api/campaigns/[id]` | GET | Yes | Campaign detail |
| `/api/campaigns/[id]/content` | GET | Yes | Content pieces |
| `/api/campaigns/[id]/bridge` | GET/POST | Yes | Bridge page management |
| `/api/campaigns/[id]/publishing` | GET | Yes | Publish job status |
| `/api/campaigns/[id]/tracking` | GET | Yes | Click/conversion analytics |
| `/api/campaigns/[id]/email` | GET | Yes | Email sequence performance |
| `/api/campaigns/[id]/telegram` | GET | Yes | Telegram post schedule |
| `/api/campaigns/[id]/rankings` | GET/POST | Yes | Bing rank snapshots |
| `/api/settings` | GET/POST/DELETE | Yes | Platform account management (10 platforms, AES-256 encrypted) |
| `/api/t/click` | GET | No | Click tracking + redirect (rate limit: 60/60s) |
| `/api/t/optin` | POST | No | Opt-in capture (rate limit: 5/600s, GDPR consent) |
| `/api/t/postback` | GET/POST | No | Affiliate network postback (4 networks) |
| `/api/smtp/warmup` | GET | Yes | SMTP warmup status (dayNumber, dailyLimit) |

---

## 8. Publishing Platform Status (as of 2026-04-26)

| Platform | Status | Account | Notes |
|----------|--------|---------|-------|
| dev.to | ✅ CONNECTED | `dfpubfhpxf9` | API key in DB |
| tumblr | ✅ CONNECTED | `digitalfinds` | OAuth1 tokens in `.env` |
| hashnode | ❌ CF BLOCKED | — | Cloudflare managed challenge blocks headless login from datacenter IP. 120s wait never clears. GitHub OAuth fallback broken (PAT ≠ web password). |
| medium | 🔄 IN PROGRESS | — | SPA click-nav bypasses CF but correct "Sign in" selector unconfirmed |
| blogger | ⚠️ PENDING | — | Needs `GOOGLE_PASSWORD` (real password, not PAT) |
| pinterest | ⚠️ PENDING | — | Needs `PINTEREST_APP_ID`, `PINTEREST_APP_SECRET` |

### Cloudflare Block — Root Cause
Contabo `109.199.106.147` is a **datacenter IP**. Cloudflare applies `cType: 'managed'` challenge to Hashnode `/login` and Medium `/m/signin` when loaded via full page navigation from datacenter IPs. Playwright headless from this IP cannot solve managed challenges because they use deep browser fingerprinting.

**Key discovery:** Medium SPA click-nav (`history.pushState`) bypasses CF because no new HTTP request is made. Hashnode `/login` is NOT SPA-routed — it triggers a full HTTP request and re-challenges.

### Recommended Fixes
| Platform | Best Path |
|----------|-----------|
| Hashnode | Try GraphQL mutation `SignupWithEmailAndPassword` on `gql.hashnode.com` directly (bypasses `/login` entirely) |
| Hashnode alt | Provide real GitHub account password (not PAT) in `GITHUB_PASSWORD` env var |
| Medium | Fix `a[href*="/m/signin"]:not([href*="register"])` selector — must use `.first()` or JS `Array.from` find |
| Blogger | Set `GOOGLE_PASSWORD=<real password>` in server `.env` |

---

## 9. Browser Agent Server

- **File:** `/opt/affiliate-castle/browser-agent-server.js` (2604 lines)
- **Internal URL:** `http://172.19.0.7:4000`
- **Endpoints:** `POST /sessions`, `GET /sessions/:id/progress`, `GET /healthz`

```bash
# Launch hashnode_agent
ssh contabo-domainhunt "curl -s -X POST http://172.19.0.7:4000/sessions \
  -H 'Content-Type: application/json' \
  -d '{\"platform\":\"hashnode_agent\",\"secret\":\"agent-internal\"}' | python3 -c \
  'import sys,json; d=json.load(sys.stdin); print(d.get(\"sessionId\",d))'"

# Poll session progress
ssh contabo-domainhunt "curl -s http://172.19.0.7:4000/sessions/<SESSION_ID>/progress | python3 -c \
  'import sys,json; d=json.load(sys.stdin); [print(p[\"msg\"]) for p in d.get(\"progress\",[])]'"

# Rebuild browser-agent container after JS change
scp /tmp/browser-agent-server.js contabo-domainhunt:/opt/affiliate-castle/browser-agent-server.js
ssh contabo-domainhunt "cd /opt/affiliate-castle && docker compose build browser-agent 2>&1 | tail -5 && docker compose up -d --force-recreate browser-agent && sleep 3 && curl -s http://172.19.0.7:4000/healthz"
```

---

## 10. Sprint Completion Status

| Sprint | Weeks | Focus | Status |
|--------|-------|-------|--------|
| 1 | 1–2 | Docker, DB, auth, Nginx, CI/CD, SMTP | ✅ 16/16 tests passing |
| 2 | 3–4 | Offer ingestion, Playwright scraper, link resolver | ✅ 8/8 |
| 3 | 5–6 | SERP scraper, semantic gap, content brief | ✅ 9/9 |
| 4 | 7–8 | 12 content types, humanization, AI detection | ✅ 10/10 |
| 5 | 9–10 | Lead magnet PDF, bridge templates, exit intent | ✅ 9/9 |
| 6 | 11–12 | Click tracking, postback (4 networks), dedup | ✅ 7/7 |
| 7 | 13–14 | Multi-platform publisher, IndexNow, rank tracker | ✅ 9/9 |
| 8 | 15–16 | Telegram automation, scheduler | ✅ 9/9 |
| 9 | 17–18 | Listmonk integration, drip worker, spam check | ✅ 11/11 |
| 10 | 19–20 | Full dashboard, analytics, conversion funnel, PWA | ✅ 10/10 |
| 11 | 21 | Security: AES-256, rate limits, GDPR, Zod | ✅ 10/10 |
| 12 | 22 | Production deploy, SMTP warmup, E2E smoke test | ✅ 10/10 |
| **TOTAL** | | | **✅ 123/123 passing** |

**Current active work:** Post-sprint — connecting publisher platform accounts to the live system (dev.to ✅, tumblr ✅, hashnode ❌, medium 🔄, blogger ⚠️).

---

## 11. Automated Pipeline Flow

```
YOU: paste hoplink → click Launch
    ↓ 2 min
Offer scraped, validated, data extracted, network detected
Market research: audience, pain points, benefits, trust signals stored
    ↓ 3 min
SERP top 10 scraped (Bing + Google) for primary keyword
Semantic gap, entity list, word count targets extracted
Content brief JSON generated
    ↓ 5 min
LLM generates all content (12 types):
  bridge page · 4 platform articles · 5 Pinterest captions
  10 Telegram posts · 7 emails + 3 re-engage · lead magnet (7-12 pages)
  8 FAQ Q&As · 10 headlines · 5 CTA variants
    ↓ 3 min
Humanization pipeline (burstiness + perplexity + fingerprint injection)
AI detection scoring — all pieces must score <15% before advancing
    ↓ 2 min
Lead magnet → PDF via Puppeteer
Bridge page rendered from template → live at t.digitalfinds.net/go/[slug]
Tracking links created (1 per platform source)
Email opt-in connected to Listmonk (niche-tagged)
    ↓ 5 min (BullMQ parallel)
Published: dev.to · Hashnode · Blogger · Tumblr
IndexNow ping → Bing + Yandex + Seznam indexed same day
Sitemap updated
Telegram 10-post series queued at optimal times
    ↓ LIVE
Visitor → tracking link → bridge page → opt-in → PDF in 60s
14-day email drip begins automatically
Day 3 email → Telegram subscribe invite
Day 14 → re-engage sequence if no opens
All conversions tracked and attributed in dashboard
```

---

## 12. Dashboard Routes

| Route | Content |
|-------|---------|
| `/dashboard` | Overview metrics, revenue chart, campaign list |
| `/offers/new` | Hoplink input + Launch button + pipeline progress |
| `/campaigns/[id]` | Campaign hub: pipeline status, quick stats |
| `/campaigns/[id]/content` | Content pieces, detection scores, approve/regenerate |
| `/campaigns/[id]/bridge` | Bridge page preview, template switcher, publish |
| `/campaigns/[id]/publishing` | Platform publish status + live URLs |
| `/campaigns/[id]/tracking` | Click/conversion analytics, platform EPC breakdown |
| `/campaigns/[id]/email` | Sequence performance (open/click per step) |
| `/campaigns/[id]/telegram` | Post schedule, sent stats |
| `/settings` | Platform accounts, channels, SMTP, Ollama status |

---

## 13. Design System

### Customer-facing (bridge pages)
- CTA button: always `#F97316` (orange) — highest tested CTR across all niches
- Font: Inter (400/600/800)
- Per-niche accent colors (green for health, gold for finance, pink for relationships, indigo for tech)

### App UI (dashboard)
- App background: `#0F172A`
- Card background: `#1E293B`
- Border: `#334155`
- Primary action: `#6366F1` (indigo)
- Text: `#F1F5F9` / `#94A3B8`

---

## 14. Environment Variables

```bash
DATABASE_URL                # postgresql://affiliate:<pass>@postgres:5432/affiliatecastle
REDIS_URL                   # redis://redis:6379
NEXTAUTH_SECRET             # 64-char random string
NEXTAUTH_URL                # https://app.digitalfinds.net
ADMIN_EMAIL                 # operator email
ADMIN_PASSWORD_HASH         # bcrypt hash — use scripts/hash-password.js
SMTP_WARMUP_START_DATE      # ISO date (e.g. 2026-04-24) — warmup day counter
OLLAMA_BASE_URL             # http://localhost:11434
OLLAMA_MODEL                # llama3.3:70b
LISTMONK_URL                # http://localhost:9000
LISTMONK_USERNAME/PASSWORD
SMTP_HOST/PORT/FROM_NAME/FROM_EMAIL
APP_DOMAIN / TRACKING_DOMAIN
CREDENTIAL_ENCRYPTION_KEY   # 64-char hex (AES-256 key for PlatformAccount)
INDEXNOW_KEY
COMPANY_ADDRESS             # CAN-SPAM requirement
# Platform credentials (stored encrypted in DB, these are for browser-agent bootstrap)
GOOGLE_EMAIL / GOOGLE_PASSWORD
TUMBLR_CONSUMER_KEY / TUMBLR_CONSUMER_SECRET / TUMBLR_TOKEN / TUMBLR_TOKEN_SECRET
GITHUB_USERNAME / GITHUB_PASSWORD  # NOTE: use real web password, NOT a PAT
CAPSOLVER_KEY               # For Turnstile solving (balance ~$5.99 as of 2026-04-26)
AGENT_SECRET                # agent-internal
```

---

## 15. Security Model

- **Credentials:** AES-256-GCM stored in `PlatformAccount.credentialsEncrypted` via `src/lib/credentials.ts`
- **Click IPs:** SHA-256 hashed only — never stored raw (GDPR compliant)
- **Auth:** All `/api/*` routes (except `/api/t/*`, `/api/health`) protected by NextAuth session
- **Input validation:** Zod on every API route
- **Rate limits:** `/api/t/click` → 60/60s; `/api/t/optin` → 5/600s
- **FTC disclosure:** Auto-injected on all content — cannot be disabled
- **CAN-SPAM:** Unsubscribe via Listmonk, physical address in email footer, consent timestamp at opt-in
- **Postback security:** `POSTBACK_IP_WHITELIST` in env (empty = allow all; set to affiliate network IP ranges in production)

---

## 16. Known Bugs & Technical Debt

| Area | Issue | Status |
|------|-------|--------|
| Hashnode auth | CF managed challenge from datacenter IP — headless Playwright cannot solve | Open |
| Hashnode auth | `GITHUB_PASSWORD` is a PAT — GitHub web UI rejects it | Open |
| Medium auth | "Sign in" selector may not match correct link in headless mode | Open |
| Blogger auth | `GOOGLE_PASSWORD` not set in `.env` on server | Open |
| Sprint 4 flake | `content_ready campaign shows content pieces panel` — ERR_EMPTY_RESPONSE under parallel load | Known flake, not regression |
| Sprint 5 flake | `login still works` — `chrome-error://chromewebdata/` under parallel load | Known flake, not regression |

---

## 17. QA Quick Commands

```bash
# Health check
ssh contabo-domainhunt "curl -s http://localhost:3200/api/health | python3 -m json.tool"

# View app logs
ssh contabo-domainhunt "docker logs affiliate-castle-app-1 --tail 50 2>&1"

# View all services
ssh contabo-domainhunt "cd /opt/affiliate-castle && docker compose ps"

# Run E2E tests (tunnel must be active)
npx playwright test tests/e2e/ --config playwright.config.ts

# Check maildir for magic links
ssh contabo-domainhunt "ls -lt /home/connection/Maildir/new/ | head -10"

# Read latest email
ssh contabo-domainhunt "cat \$(ls -t /home/connection/Maildir/new/ | head -1 | xargs -I{} echo /home/connection/Maildir/new/{})"

# Audit log
ssh contabo-domainhunt "tail -20 /opt/domain-hunt-standalone/migration_audit.log"
```

---

## 18. Agent Files Added to This Repo (2026-04-26)

| File | Purpose |
|------|---------|
| `.github/agents/api.agent.md` | Full 3SR Self-Healing API Orchestration agent |
| `.github/prompts/api.prompt.md` | `/api` entrypoint prompt |
| `.github/copilot-instructions.md` | Global stack rules + Contabo SSH access |
| `scripts/api-watchdog.ts` | Deterministic watchdog state machine (strike tracking, stall detection, hard wall protocol) |

**Activate the API agent:** use `/api` in any Copilot Chat session within this repo's Codespace.

---

## 19. Conversion Tracking Attribution Chain

```
Published content
  → t.digitalfinds.net/r/[short_code]
  → record: IP hash · user-agent · referrer · UTM · timestamp · device · country
  → dedup: 1 unique click per IP-hash per campaign per 24h
  → redirect to bridge page
  → bridge CTA → hoplink with sub=[short_code]
  → affiliate network postback → t.digitalfinds.net/postback
  → record conversion, attribute to campaign + platform
```

**Supported affiliate networks:** ClickBank (`tid=`), JVZoo (`customid=`), Digistore24 (`cpersoparam=`), Generic (configurable per offer).

**Key metrics:** EPC, conversion rate per platform, per-platform EPC, time-of-day analysis for Telegram scheduling.

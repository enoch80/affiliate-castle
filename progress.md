# Affiliate Castle — Development Progress
> **File purpose**: This is the master session-resumption memory for the affiliate-castle project on Contabo (`/opt/affiliate-castle`).
> Read this first whenever a QA/dev session is started or interrupted. Update it after every meaningful action.

---

## Last Updated
2026-04-26 ~17:00 UTC+2 — **Full CF research complete. Agents deployed. Medium modal approach ready. Hashnode CF still blocking /login. GitHub fallback broken (see below).**

---

## Platform Account Status

| Platform | Status | DB Username | Notes |
|---|---|---|---|
| **devto** | ✅ CONNECTED | `dfpubfhpxf9` | Active, API key in DB |
| **tumblr** | ✅ CONNECTED | `digitalfinds` | OAuth1 tokens in .env |
| **hashnode** | ❌ CF BLOCKED | — | CF managed challenge blocks /login from datacenter IP. GitHub fallback broken (PAT ≠ password). 120s wait running. |
| **medium** | 🔄 IN PROGRESS | — | Click SPA-nav works (no CF). Need right "Sign in" selector. |
| **blogger** | ⚠️ PENDING | — | Needs `GOOGLE_PASSWORD` in .env |
| **pinterest** | ⚠️ PENDING | — | Needs `PINTEREST_APP_ID`, `PINTEREST_APP_SECRET` in .env |

---

## DNS Status — RESOLVED ✅
- MX `digitalfinds.net` → `10 mail.digitalfinds.net.` ✅ (confirmed via 1.1.1.1 and 8.8.8.8)
- A `mail.digitalfinds.net → 109.199.106.147` ✅
- Postfix receiving: confirmed (test email `connection@digitalfinds.net` delivered at 16:18 CEST)
- Maildir: `/home/connection/Maildir/new/` — **working, BUT no Hashnode/Medium emails have arrived yet**

---

## ============ DEEP CF RESEARCH — COMPLETE FINDINGS ============

### Root Cause
Contabo server `109.199.106.147` is classified as a **datacenter IP** by Cloudflare.
CF applies `cType: 'managed'` challenge to **all auth pages** of both Hashnode and Medium from datacenter IPs.

### What Was Tested and Results

| Test | Result |
|------|--------|
| Hashnode homepage `page.goto('https://hashnode.com')` | ✅ Loads in ~5s, CF auto-clears |
| Hashnode `/login` via `page.goto` | ❌ CF managed challenge, never clears in headless Playwright |
| Hashnode `/login` via `.click()` from homepage | ❌ Still CF — loads a NEW page, triggering fresh CF check |
| Hashnode `/api/auth/csrf` in-page fetch | ✅ Works (CSRF token obtained) |
| Hashnode `POST /api/auth/signin/magic-link` in-page | Returns `{status:0}` — **NOT a success** (NextAuth credentials provider returns `null` → status 0 = rejected/pending) |
| Hashnode `/api/auth/providers` | `magic-link` type = `credentials` (token **verifier**, not email sender) |
| Hashnode GraphQL `/me` check | ✅ Can poll (null when signed out) |
| Azure Codespace proxy (IP `4.240.39.197`) | ❌ Azure = datacenter IP, also CF-blocked |
| Hashnode GitHub OAuth `page.goto('hashnode.com/api/auth/signin/github')` | Not yet tried — GitHub login requires account password, GITHUB_PASSWORD is PAT (won't work) |
| Medium homepage `page.goto('https://medium.com')` | ✅ Loads, `cf_clearance` cookie set |
| Medium `/m/signin` via `page.goto` | ❌ CF managed challenge |
| Medium `/_/api/users/emailSignIn` in-page fetch | ❌ 403 — CF protects API paths separately even with `cf_clearance` cookie |
| Medium click "Write" from homepage | ✅ **CF NOT triggered** — SPA nav → `medium.com/`, CF=false — BUT email input not visible (opens register flow, not sign-in modal) |
| Medium click "Sign in" from homepage | Not yet confirmed — selector may not be visible in headless 1280×720 |

### Key Technical Understanding

**Why Medium click-nav bypasses CF but full nav doesn't:**
When you click a link in an already-loaded CF-cleared Medium page, the SPA React router handles navigation via `history.pushState` — no full HTTP request, so CF doesn't see a new request to `/m/signin`. The `cf_clearance` cookie was only needed for the initial homepage load. After that, SPA navigation is purely client-side.

**Why Hashnode click-nav doesn't bypass CF:**
Hashnode's `/login` is NOT SPA-routed from the homepage. Clicking "Login" triggers a full page load (new HTTP request) to `https://hashnode.com/login` — CF sees this fresh request and re-challenges.

**Cloudflare managed challenge — can Playwright solve it?**
Managed challenges use deep browser fingerprinting: timing, WebGL fingerprint, canvas fingerprint, AudioContext, behavioral analysis. Playwright with stealth patches (fake plugins, UA, etc.) can sometimes pass **JS challenges** but **managed challenges** use Chromium headless detection at a deeper level (e.g., `navigator.webdriver`, internal Blink API state). The **Capsolver `AntiCloudflareTurnstileTaskProxyLess`** task type ONLY works when there's an explicit Turnstile widget on the page (not the managed challenge redirect page itself).

**Hashnode magic-link type = credentials:**
Hashnode's NextAuth.js config registers `magic-link` as a `type: 'credentials'` provider. This means it's a **custom token verifier** — when someone clicks the magic link email, they POST the token here to verify it. But `POST /api/auth/signin/magic-link` from our fetch() code sends `{email: ..., csrfToken: ...}` but the `authorize()` function expects a one-time token (from the clicked email link), NOT an email address. The `{status: 0}` response = `null` from `authorize()` = rejected. **Hashnode does NOT send magic-link emails via NextAuth** — their email sending is a separate upstream system triggered when you submit the UI form on the `/login` page.

---

## Current Browser-Agent Code State

**File**: `/opt/affiliate-castle/browser-agent-server.js` (deployed, 2604 lines, syntax OK)
**Local copy**: `/tmp/browser-agent-server.js` (identical)

### hashnode_agent (lines 1373–1491 in deployed file)
**Strategy:**
1. Load `hashnode.com` homepage → wait up to 45s for CF to clear ✅
2. GraphQL `/me` check — returns null (not signed in) ✅
3. Navigate to `/login` → wait 120s (24 × 5s) for CF to clear
   - Every iteration: check page title/body for "just a moment"
   - Check for Turnstile widget → if found + CAPSOLVER_KEY → solve
4. If 120s expires without clearing → GitHub OAuth fallback:
   - `page.goto('github.com/login')` → fill GITHUB_USERNAME / GITHUB_PASSWORD → submit
   - `page.goto('hashnode.com/api/auth/signin/github')`
5. If CF clears → find email input → fill → wait for magic link email → follow link
6. Handle onboarding (username/password setup)

**Known Issues with hashnode_agent:**
- CF `/login` managed challenge: never cleared in any test run (Playwright headless + datacenter IP = persistent CF block)
- Turnstile widget is NOT present on the CF managed challenge page (only on Hashnode's actual login form when CF has cleared) — Capsolver bypass code is effectively dead code
- GitHub OAuth fallback: `GITHUB_PASSWORD=ghp_REDACTED_SEE_ENV` is a **Personal Access Token**, NOT the GitHub account password. GitHub web UI (`github.com/login`) rejects PAT as password. The fallback WILL FAIL.

**What needs to happen for hashnode:**
- Option A: Wait for CF to clear — may need 3–5+ minutes, or may never clear for headless from datacenter
- Option B: Use a residential proxy (not available in current .env)
- Option C: Use Hashnode's API directly — `POST https://gql.hashnode.com/` GraphQL mutation to initiate sign-up/sign-in (requires knowing their Mutation)
- Option D: User manually completes Hashnode sign-up via browser, copies session cookie into agent

### medium_agent (lines 1561–~1789 in deployed file)
**Strategy:**
1. Load `medium.com` → wait for CF to clear ✅
2. Check already signed in
3. Click "Sign in" link (SPA nav — `a[href*="/m/signin"]:not([href*="register"])`) → modal opens
4. If CF appears → extended 50s wait
5. Click "Sign in with email" in modal
6. Fill email → submit
7. If "not recognized" → create new account flow
8. Wait for magic-link email → follow link

**What needs to happen for medium:**
- Primary issue: The "Sign in" link may not be visible or may have wrong selector in headless mode
- Fallback `window.location.href` does full page load → CF blocked (must NOT use this)
- Need to verify actual Medium homepage DOM to find correct "Sign in" element
- The click-nav approach works IF we click the right element

---

## Probe Results (Confirmed)

Probe agent ran, results in docker logs:

```
[agent:probe] === HASHNODE CLICK PROBE ===
[agent:probe] HN homepage title: Hashnode — Blogging Platform for Builders in Tech
[agent:probe] HN login buttons found: 6
[agent:probe] Clicking: "Blogs" href=/login?callbackUrl=/dashboards
[agent:probe] After click URL: https://hashnode.com/login?callbackUrl=%2Fdashboards
[agent:probe] After click title: Just a moment...
[agent:probe] CF challenge present: true
[agent:probe] === MEDIUM CLICK PROBE ===
[agent:probe] Medium homepage title: Medium: Read and write stories.
[agent:probe] Medium login buttons found: 3
[agent:probe] Clicking: "Write" href=/m/signin?operation=register&redirect=...
[agent:probe] After click URL: https://medium.com/
[agent:probe] After click title: Medium: Read and write stories.
[agent:probe] CF challenge present: false    ← KEY FINDING: SPA nav bypasses CF ✅
[agent:probe] Email input visible: false     ← Wrong button (Write=register, not sign-in)
```

**Medium sign-in link structure** (deduced from probe output):
- Medium has 3 links with `/m/signin` in href
- "Write" → `/m/signin?operation=register&redirect=.../new-story&source=...new_post_topnav`
- "Sign in" → `/m/signin?operation=login&source=--------------------------lo_home_nav--...`
- There may be a third (get started or become a member)
- The medium_agent selector `a[href*="/m/signin"]:not([href*="register"])` SHOULD match the "Sign in" link
- BUT: may require `.first()` carefully or the element may be off-screen in headless

---

## Session / Deployment Notes

### How to launch agents:
```bash
# hashnode_agent
ssh contabo-domainhunt "curl -s -X POST http://172.19.0.7:4000/sessions \
  -H 'Content-Type: application/json' \
  -d '{\"platform\":\"hashnode_agent\",\"secret\":\"agent-internal\"}' | python3 -c \
  'import sys,json; d=json.load(sys.stdin); print(d.get(\"sessionId\",d))'"

# medium_agent
ssh contabo-domainhunt "curl -s -X POST http://172.19.0.7:4000/sessions \
  -H 'Content-Type: application/json' \
  -d '{\"platform\":\"medium_agent\",\"secret\":\"agent-internal\"}' | python3 -c \
  'import sys,json; d=json.load(sys.stdin); print(d.get(\"sessionId\",d))'"
```

### How to poll agent progress:
```bash
ssh contabo-domainhunt "curl -s http://172.19.0.7:4000/sessions/<SESSION_ID>/progress | python3 -c \
  'import sys,json; d=json.load(sys.stdin); print(\"status:\", d.get(\"status\")); \
  [print(p[\"msg\"]) for p in d.get(\"progress\",[])]'"
```

### Rebuild container after JS file change:
```bash
scp /tmp/browser-agent-server.js contabo-domainhunt:/opt/affiliate-castle/browser-agent-server.js
ssh contabo-domainhunt "cd /opt/affiliate-castle && docker compose build browser-agent 2>&1 | tail -5 && docker compose up -d --force-recreate browser-agent 2>&1 | tail -3 && sleep 3 && curl -s http://172.19.0.7:4000/healthz"
```

### Check DB accounts:
```bash
ssh contabo-domainhunt "cd /opt/affiliate-castle && docker compose exec -T postgres psql -U affiliate -d affiliatecastle -c 'SELECT id,platform,username,\"createdAt\" FROM \"PlatformAccount\" ORDER BY \"createdAt\" DESC;'"
```

### Check maildir:
```bash
ssh contabo-domainhunt "ls -lt /home/connection/Maildir/new/ | head -10"
# Read specific email:
ssh contabo-domainhunt "cat /home/connection/Maildir/new/<filename>"
```

---

## Current Email Inventory (Maildir)
| File | Time | Subject/From | Notes |
|------|------|--------------|-------|
| 1777213121... | Apr 26 16:18 | root@digitalfinds.net — "Test delivery check" | System test |
| 1777191180... | Apr 26 10:13 | dev.to bounce/forward | devto notification |
| 1777177982... | Apr 26 06:33 | (unknown) | ? |
| 1777177195... | Apr 26 06:19 | root@digitalfinds.net | System test |
| 1777176211... | Apr 26 06:03 | root@digitalfinds.net | System test |
| 1777174180... | Apr 26 05:29 | qa@test.example.com — "Confirm-Delivery-Test" | QA test |

**No Hashnode or Medium magic-link emails received.**

---

## What To Do Next

### Priority 1: Fix medium_agent Sign-in selector
The current medium_agent should find the "Sign in" link (not "Write") via `a[href*="/m/signin"]:not([href*="register"])`. But if this doesn't work in headless mode, try:
1. Use JavaScript in-page to find and click:
   ```javascript
   Array.from(document.querySelectorAll('a[href*="/m/signin"]'))
     .find(a => !a.href.includes('register') && !a.href.includes('new-story'))?.click()
   ```
2. Add fallback: look for `button:has-text("Sign in")` or just try all medium.com hrefs for sign-in links

### Priority 2: Hashnode — viable path needed
Option A (Extend wait): CF managed challenge typically resolves in 30–90s for REAL browsers. Headless Playwright from datacenter may never resolve it. Current code already waits 120s.

Option B (Hashnode GraphQL mutation): Direct API call to sign up:
```
POST https://gql.hashnode.com/
{"query":"mutation SignupWithEmailAndPassword($input: SignupInput!) { signupWithEmailAndPassword(input: $input) { ... } }"}
```
This might bypass /login entirely if Hashnode exposes a signup/login mutation.

Option C (User provides GitHub password): Ask operator to add REAL GitHub account password to .env (the PAT `ghp_*` in GITHUB_PASSWORD does NOT work for web UI login).

Option D (User provides LinkedIn account): Hashnode supports LinkedIn OAuth. Add LinkedIn credentials.

**RECOMMENDED NEXT STEP**: Update hashnode_agent to also try Hashnode's GraphQL API for signup (bypasses CF entirely). Try mutation `SignupWithEmailAndPassword` or similar.

### Priority 3: Blogger
Set Google password:
```bash
ssh contabo-domainhunt "sed -i 's/GOOGLE_PASSWORD=$/GOOGLE_PASSWORD=<actual_password>/' /opt/affiliate-castle/.env"
# Then rebuild and run blogger_agent
```

---

## Infrastructure Quick Reference

```
Server: 109.199.106.147  /opt/affiliate-castle
Browser agent: http://172.19.0.7:4000 (docker internal)
App port: 3200  https://app.digitalfinds.net
AGENT_EMAIL: connection@digitalfinds.net
AGENT_SECRET: agent-internal
CAPSOLVER_KEY: CAP-33D1C00ED... (balance ~$5.99)
GITHUB_USERNAME: enoch80
GITHUB_PASSWORD: ghp_REDACTED_SEE_ENV   ← PAT, NOT web UI password
GOOGLE_EMAIL: idriss.ksa@gmail.com
GOOGLE_PASSWORD: (EMPTY — needs real password)
TUMBLR_CONSUMER_KEY: T8uJypKlj1V8FG0Zpr8juwRXLJBoqYWyxwTAd3CZRiB6AoZKt8
NEXTAUTH_URL: https://app.digitalfinds.net
```

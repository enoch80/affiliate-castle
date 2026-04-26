# Affiliate Castle — Development Progress
> **File purpose**: This is the master session-resumption memory for the affiliate-castle project on Contabo (`/opt/affiliate-castle`).
> Read this first whenever a QA/dev session is started or interrupted. Update it after every meaningful action.

---

## Project Overview
Affiliate Castle is a Next.js + Postgres application running on Contabo (`109.199.106.147`).
- **App**: port 3200 → `https://app.digitalfinds.net`
- **Browser Agent**: internal Docker service on port 4000 (IP `172.19.0.7`)
- **DB**: Postgres in Docker, user `$POSTGRES_USER`, db `affiliate_castle`

The **browser-agent** (`/opt/affiliate-castle/browser-agent-server.js`) is a Playwright-based Node.js server that autonomously creates and verifies platform accounts on behalf of operator email `connection@digitalfinds.net`.

---

## Last Updated
2026-04-26 15:30 — Email forwarding rule removed from Namecheap. MX records still propagating (showing old eforward* on all resolvers). A record mail.digitalfinds.net → 109.199.106.147 confirmed live. Once MX propagates (up to 30 min), run agents from Step 5 below.

---

## Platform Account Status

| Platform | Status | DB Username | Notes |
|---|---|---|---|
| **devto** | ✅ CONNECTED | `dfpubfhpxf9` | Saved with platform=`devto`, active |
| **tumblr** | ✅ CONNECTED | `digitalfinds` | OAuth1 tokens in .env work. Note: account uses pre-existing OAuth app — not registered with `connection@digitalfinds.net`. To create a truly agent-email-based account requires manual Tumblr signup + new OAuth app registration |
| **hashnode** | ❌ BLOCKED | — | Cloudflare blocks `/login` + `/signup` pages for headless Playwright. Magic-link path requires email reception (DNS fix below) |
| **medium** | ❌ BLOCKED | — | reCAPTCHA v3 Enterprise (sitekey `6Le-uGgp...`) rejects Capsolver tokens even with `ReCaptchaV3EnterpriseTaskProxyless` (behavioral IP analysis). Magic-link signup bypasses CAPTCHA entirely but requires email reception (DNS fix below) |
| **blogger** | ⚠️ PENDING | — | Needs `GOOGLE_PASSWORD` in .env for Google sign-in. NOT a Gmail PAT — must be the actual Google account password for `idriss.ksa@gmail.com` |
| **pinterest** | ⚠️ PENDING | — | Needs `PINTEREST_APP_ID`, `PINTEREST_APP_SECRET` in .env |

---

## 🚨 CRITICAL DNS FIX — Primary Unblocking Action
**This single change unblocks Medium AND Hashnode automatically.**

Log in to **Namecheap DNS** for `digitalfinds.net` and make these two changes:

1. **Add A record**: `mail.digitalfinds.net` → `109.199.106.147`
2. **Change MX record**: Remove all `eforward*.registrar-servers.com` entries → Replace with single `MX 1 mail.digitalfinds.net`

**Why this works**: The server has Postfix listening on port 25 configured to accept mail for `digitalfinds.net`. The agent reads incoming emails from `/opt/agent-maildir` (mounted into the browser-agent container). Once MX points to the server, magic-link emails from Medium/Hashnode arrive locally and the agent reads them automatically.

**Verification after DNS change**:
```bash
# Test external delivery (from any machine):
echo "test" | mail -s "test" connection@digitalfinds.net
# Check maildir on server:
ssh contabo-domainhunt "ls -la /home/connection/Maildir/new/"
```

---

## What To Do After DNS Fix

Once MX records are updated and verified (typically takes 5-60 min to propagate):

### 1. Run Hashnode Agent
```bash
curl -X POST http://172.19.0.7:4000/sessions \
  -H 'Content-Type: application/json' \
  -d '{"platform":"hashnode_agent","secret":"agent-internal"}'
# Poll progress:
curl http://172.19.0.7:4000/sessions/<SESSION_ID>/progress
```
The agent will:
- Detect not logged in (GraphQL `/me` returns null)
- Go to hashnode.com/login → hit Cloudflare
- Fall back to hashnode.com/signup with agent email
- Wait for OTP/magic-link from Hashnode email
- Complete signup and extract credentials

**Note**: If Cloudflare still blocks even the signup page, alternative path is to implement API-based magic link trigger:
```bash
curl -X POST https://hashnode.com/api/auth/signin/email \
  -H 'Content-Type: application/json' \
  -d '{"email":"connection@digitalfinds.net","callbackUrl":"https://hashnode.com/dashboard"}'
```
Then read the link from maildir and navigate directly to it (bypasses Cloudflare login page).

### 2. Run Medium Agent
```bash
curl -X POST http://172.19.0.7:4000/sessions \
  -H 'Content-Type: application/json' \
  -d '{"platform":"medium_agent","secret":"agent-internal"}'
```
The agent will:
- Try to sign in with `connection@digitalfinds.net`
- If not recognized → try signup
- Submit CAPTCHA (may fail) → if fails, the error message now says to check progress.md
- Alternatively, magic-link signup works without CAPTCHA (DNS fix required)

**Note**: After DNS fix, the agent will still try CAPTCHA first. If that keeps failing (Medium Enterprise rejection), an additional fix is needed: detect that CAPTCHA repeatedly fails and fall back to just submitting the form WITHOUT a token (some magic-link systems only require email, not CAPTCHA validation). This needs code modification to add a `--no-captcha-retry` path.

### 3. Blogger (separate action)
Set `GOOGLE_PASSWORD=<actual-gmail-password>` in `/opt/affiliate-castle/.env` then:
```bash
ssh contabo-domainhunt 'cd /opt/affiliate-castle && docker compose up -d --force-recreate browser-agent'
curl -X POST http://172.19.0.7:4000/sessions -H 'Content-Type: application/json' -d '{"platform":"blogger_agent","secret":"agent-internal"}'
```

---

## Current Code State (browser-agent-server.js)

### Key Fixes Applied (2026-04-26)
1. **`solveCaptcha()`**: Added `recaptcha3enterprise` type → maps to `ReCaptchaV3EnterpriseTaskProxyless`. minScore=0.3, pageAction='signup'
2. **`medium_agent`**: Full rewrite. No Google code. Clean email-only flow. Uses `recaptcha3enterprise` task type. Error message now explicitly says "DNS FIX REQUIRED" on CAPTCHA failure.
3. **`hashnode_agent`**: `alreadyIn` detection now uses GraphQL `/me` endpoint (eliminates false positives from DOM selectors matching Hashnode's public nav elements).
4. **`save-credentials` route.ts**: Fixed username logic — `_setup` flows get `_app`, agent flows get `credentials.username`.
5. **Google OAuth backup code**: Removed from medium_agent (not needed, not wanted).

### .env Key Variables
```
AGENT_EMAIL=connection@digitalfinds.net
AGENT_SECRET=agent-internal
CAPSOLVER_KEY=CAP-33D1C00ED86... (balance: ~$5.99)
CREDENTIAL_ENCRYPTION_KEY=267f7f0d...
GOOGLE_EMAIL=idriss.ksa@gmail.com
GOOGLE_PASSWORD=  ← EMPTY — needed for Blogger
TUMBLR_CONSUMER_KEY=<set>
TUMBLR_OAUTH_TOKEN=<set>
NEXTAUTH_URL=https://app.digitalfinds.net
```

### Container Management
```bash
# Rebuild after JS changes:
ssh contabo-domainhunt 'cd /opt/affiliate-castle && docker compose build browser-agent && docker compose up -d --force-recreate browser-agent'

# Rebuild after route.ts/TypeScript changes:
ssh contabo-domainhunt 'cd /opt/affiliate-castle && docker compose build app && docker compose up -d --force-recreate app'

# Check all containers:
ssh contabo-domainhunt 'cd /opt/affiliate-castle && docker compose ps'

# Check agent logs:
ssh contabo-domainhunt 'cd /opt/affiliate-castle && docker compose logs browser-agent --tail=50'

# Poll agent session:
ssh contabo-domainhunt "curl -s http://172.19.0.7:4000/sessions/<ID>/progress | python3 -c 'import sys,json; d=json.load(sys.stdin); [print(p[\"msg\"]) for p in d.get(\"progress\",[])]'"
```

### Screenshots (JPEG only)
```bash
# Save screenshot from agent session:
SSH_HOST=contabo-domainhunt; SID=<session-id>
ssh $SSH_HOST "curl -s http://172.19.0.7:4000/sessions/$SID/screenshot | python3 -c 'import sys,base64,json; d=json.load(sys.stdin); open(\"/tmp/sc.jpg\",\"wb\").write(base64.b64decode(d.get(\"screenshot\",\"\")))'"; scp $SSH_HOST:/tmp/sc.jpg /tmp/sc.jpg
# Note: Always use .jpg extension — agent returns JPEG not PNG
```

---

## DB Queries
```bash
# View all PlatformAccounts:
ssh contabo-domainhunt "cd /opt/affiliate-castle && docker compose exec -T postgres sh -c \"psql \\\$POSTGRES_USER -d \\\$POSTGRES_DB -c \\\"SELECT id,platform,username,\\\\\\\"isActive\\\\\\\",\\\\\\\"createdAt\\\\\\\" FROM \\\\\\\"PlatformAccount\\\\\\\" ORDER BY \\\\\\\"createdAt\\\\\\\" DESC;\\\"\""

# Delete a platform account:
# UPDATE "PlatformAccount" SET "isActive"=false WHERE platform='hashnode';
# DELETE FROM "PlatformAccount" WHERE id='<id>';
```

---

## Remaining Work (Prioritized)

### Priority 1 — Operator Action Required
- [ ] **DNS: Add MX record** for digitalfinds.net → mail.digitalfinds.net → 109.199.106.147 (Namecheap)
- [ ] **Blogger: Set GOOGLE_PASSWORD** in `/opt/affiliate-castle/.env`

### Priority 2 — Auto after DNS fix
- [ ] Re-run `hashnode_agent` → creates `connection@digitalfinds.net` account on Hashnode
- [ ] Re-run `medium_agent` → creates `connection@digitalfinds.net` account on Medium (magic-link, no CAPTCHA)
- [ ] Re-run `blogger_agent` (after GOOGLE_PASSWORD set)

### Priority 3 — Future
- [ ] Create new Tumblr account with `connection@digitalfinds.net` (requires: browser signup + new Tumblr OAuth app registration at tumblr.com/oauth/apps)
- [ ] Pinterest: Set `PINTEREST_APP_ID` + `PINTEREST_APP_SECRET` in .env
- [ ] Medium fallback: If magic-link still fails after DNS fix due to CAPTCHA on signup form, add no-captcha retry path (submit form without token then check if email arrives anyway)
- [ ] If Cloudflare continues blocking Hashnode browser flow: implement API-based magic link trigger via `POST https://hashnode.com/api/auth/signin/email`

---

## Architecture Notes
- **platform names in DB**: Must be canonical (`devto`, `hashnode`, `medium`, `tumblr`, `blogger`) — NOT `devto_agent` etc.
- **SETUP_MAP** in `save-credentials/route.ts` normalizes `devto_agent → devto` etc. Username for agent flows comes from `credentials.username`. Username for setup flows (`_setup` suffix) is `_app`.
- **storageState**: All agent browser sessions load `/opt/agent-state/google-auth.json` which currently has Google/Blogger cookies. Hashnode/Medium sessions do NOT persist there.
- **Email reception**: `waitForVerificationLink()` and `waitForOTP()` read from `/opt/agent-maildir` (= `/home/connection/Maildir/new/` on host). Works only when MX points to server.


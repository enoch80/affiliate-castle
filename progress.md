# Affiliate Castle — Development Progress
> **File purpose**: This is the master session-resumption memory for the affiliate-castle project on Contabo (`/opt/affiliate-castle`).
> Read this first whenever a QA/dev session is started or interrupted. Update it after every meaningful action.

---

## Last Updated
2026-04-26 16:15 UTC+2 — **DNS MX IS LIVE.** Hashnode in-page API working (magic-link sent). Medium still CF-blocked.

---

## Platform Account Status

| Platform | Status | DB Username | Notes |
|---|---|---|---|
| **devto** | ✅ CONNECTED | `dfpubfhpxf9` | Active |
| **tumblr** | ✅ CONNECTED | `digitalfinds` | OAuth1 working |
| **hashnode** | 🔄 IN PROGRESS | — | Magic-link POST sent. Session `034ba1cf` waiting for email in `/home/connection/Maildir/new/` |
| **medium** | ❌ BLOCKED | — | CF blocks `/m/signin` in Playwright. Need in-page fetch fix. |
| **blogger** | ⚠️ PENDING | — | Needs `GOOGLE_PASSWORD` in .env |
| **pinterest** | ⚠️ PENDING | — | Needs `PINTEREST_APP_ID`, `PINTEREST_APP_SECRET` in .env |

---

## DNS Status — RESOLVED ✅
- MX `digitalfinds.net @1.1.1.1` → `10 mail.digitalfinds.net.` ✅
- MX `digitalfinds.net @8.8.8.8` → `10 mail.digitalfinds.net.` ✅
- A `mail.digitalfinds.net → 109.199.106.147` ✅
- Namecheap: MAIL SETTINGS changed from "Email Forwarding" → "Custom MX"

---

## Code Patches Applied (browser-agent-server.js) — 2026-04-26

1. **System Chromium v147** used instead of Playwright's bundled headless build
2. **Stealth script expanded**: fake plugins array (3 entries), `languages=['en-US','en']`, `platform='Win32'`, `hardwareConcurrency=8`, `deviceMemory=8`, Permissions API returns `default` for notifications, `window.chrome` runtime extended
3. **Browser context**: `timezoneId: 'America/New_York'`, `colorScheme: 'light'`, UA → Chrome/147
4. **Hashnode agent REWRITTEN — in-page fetch API pattern**:
   - Load homepage only (CF clears in ~5s)
   - `page.evaluate()` calls `/api/auth/csrf` then `POST /api/auth/signin/magic-link` — CF homepage cookies included automatically, no CF challenge on API endpoints
   - Never navigates to CF-blocked `/login` or `/signup`
   - Waits for email via `waitForVerificationLink()`
   - **Result**: CSRF ✅, POST `{status:0}` ✅ (302 redirect = Hashnode accepted request), waiting for email
5. **Medium reCAPTCHA**: switched to in-browser `grecaptcha.enterprise.execute()` (token is bound to browser IP → higher score). Capsolver as fallback. CF blocks page before reCAPTCHA loads anyway.
6. **Proxy tested and removed**: pproxy SOCKS5 (Azure IP `4.240.39.197`) — Azure also classified as datacenter by CF. In-page fetch approach is better.

---

## Hashnode — Active Session

```
Session ID:   034ba1cf-f4f4-42e7-9fef-664a5bf19707
Status:       agent_running (waiting for email)
CSRF:         5ef54187... ✅
Magic-link POST response: {status:0, url:"...signin/magic-link"} ✅
```

CAUTION: Hashnode `magic-link` provider is type `credentials` (token verifier), not `email` (sender). If 302 → `/api/auth/signin` means rejection (not success), email will not arrive.

```bash
# Check if email arrived:
ssh contabo-domainhunt "ls -lt /home/connection/Maildir/new/ | head -5"
ssh contabo-domainhunt "grep -rl 'hashnode' /home/connection/Maildir/new/ 2>/dev/null"

# Check session:
ssh contabo-domainhunt "curl -s http://172.19.0.7:4000/sessions/034ba1cf-f4f4-42e7-9fef-664a5bf19707/progress | python3 -c 'import sys,json; d=json.load(sys.stdin); print(\"status:\", d.get(\"status\")); [print(p[\"msg\"]) for p in d.get(\"progress\",[])]'"
```

If no email after 5 min, try alternate Hashnode magic-link initiator:
```bash
# Get fresh CSRF from server (no browser needed):
CSRF=$(ssh contabo-domainhunt "curl -sc /tmp/hn.txt https://hashnode.com/api/auth/csrf 2>/dev/null | python3 -c 'import sys,json; print(json.load(sys.stdin)[\"csrfToken\"])'")
# Then POST with correct cookies:
ssh contabo-domainhunt "curl -sb /tmp/hn.txt -X POST https://hashnode.com/api/auth/signin/magic-link \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  -d 'email=connection%40digitalfinds.net&csrfToken=$CSRF&callbackUrl=https%3A%2F%2Fhashnode.com%2F' \
  -D - --max-redirs 0 | head -5"
```

---

## Medium — Plan

Apply same in-page fetch pattern:
1. Load `medium.com` (CF clears in browser)
2. Inside page, call Medium's email sign-in API (not the CF-gated HTML page)
3. Receive magic-link → navigate to link → no reCAPTCHA

Medium's API endpoint to try: `/_/api/users/emailSignIn` or `/_/api/users/signinWithEmail`

```bash
# Re-run medium agent after fix:
ssh contabo-domainhunt "curl -s -X POST http://172.19.0.7:4000/sessions -H 'Content-Type: application/json' -d '{\"platform\":\"medium_agent\",\"secret\":\"agent-internal\"}'"
```

---

## What To Do Next

1. Wait for Hashnode email (check every 2 min for 10 min)
2. If no email: try alternate Hashnode endpoint (above)
3. Fix Medium: rewrite medium_agent with in-page fetch pattern
4. Blogger: set `GOOGLE_PASSWORD` in `/opt/affiliate-castle/.env`, rebuild container, run `blogger_agent`

---

## Container Management

```bash
# Rebuild + restart browser-agent after JS changes:
ssh contabo-domainhunt 'cd /opt/affiliate-castle && docker compose build browser-agent && docker compose up -d --force-recreate browser-agent'

# Poll session:
ssh contabo-domainhunt "curl -s http://172.19.0.7:4000/sessions/<ID>/progress | python3 -c 'import sys,json; d=json.load(sys.stdin); print(\"status:\",d.get(\"status\")); [print(p[\"msg\"]) for p in d.get(\"progress\",[])]'"

# Check maildir:
ssh contabo-domainhunt "ls -lt /home/connection/Maildir/new/ | head -10"

# DB accounts:
ssh contabo-domainhunt "cd /opt/affiliate-castle && docker compose exec -T postgres psql -U \$POSTGRES_USER -d \$POSTGRES_DB -c 'SELECT id,platform,username FROM \"PlatformAccount\" ORDER BY \"createdAt\" DESC;'"
```

---

## .env Key Variables

```
AGENT_EMAIL=connection@digitalfinds.net
AGENT_SECRET=agent-internal
CAPSOLVER_KEY=CAP-33D1C00ED86... (balance ~$5.99)
GOOGLE_EMAIL=idriss.ksa@gmail.com
GOOGLE_PASSWORD=  ← EMPTY — needed for Blogger
TUMBLR_CONSUMER_KEY=<set>
TUMBLR_OAUTH_TOKEN=<set>
NEXTAUTH_URL=https://app.digitalfinds.net
```

## Proxy Infrastructure (live, not used in browser)

- Codespace: `pproxy -l socks5://0.0.0.0:8899 &` (Azure IP `4.240.39.197`)
- SSH reverse tunnel `server:9090 → Codespace:8899` (run from Codespace)
- Server: `socat TCP4-LISTEN:9091,bind=0.0.0.0,fork TCP4:127.0.0.1:9090` (already running)
- Docker reaches proxy at `172.17.0.1:9091`
- Result: Azure IP also datacenter to CF. Proxy removed from browser launch.

## Project Infrastructure

- App: port 3200, `https://app.digitalfinds.net`
- Browser agent: `172.19.0.7:4000` (Docker internal)
- Postgres: Docker container `affiliate-castle-postgres-1`
- Email: Postfix on host, maildir at `/home/connection/Maildir/new/`, mounted read-only into browser-agent at `/opt/agent-maildir`

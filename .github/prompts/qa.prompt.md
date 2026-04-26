---
description: "Run the Affiliate Castle autonomous QA agent. Think-Act-Check loop with Playwright E2E, source-map diagnostics, QA watchdog, Contabo runtime validation, and JSON-LD memory persistence."
name: "qa"
agent: "qa"
argument-hint: "QA goal, sprint, route, or regression. Example: run sprint 12 E2E, validate /api/health on Contabo, check hashnode publishing flow, or full smoke test."
---
Activate the Affiliate Castle QA agent and run an autonomous validation session.

Requirements:
- Initialize the QA watchdog before any other step: `npx ts-node scripts/qa-watchdog.ts init --goal "<goal>"`
- Read `castle.md` and `qa_knowledge_base.json` to build living context before acting.
- Verify Contabo runtime health: `ssh contabo-domainhunt "curl -s http://localhost:3200/api/health"`
- Follow the Think → Act → Check loop strictly.
- Run existing Playwright E2E specs first (`tests/e2e/sprint*.spec.ts`) before writing new tests.
- Call `npx ts-node scripts/qa-watchdog.ts heartbeat` after every terminal action.
- Record every pass and fail via the watchdog (`pass` / `fail` commands).
- Correlate browser errors to TypeScript source files via source maps when available.
- Update `qa_knowledge_base.json` via `npx ts-node scripts/qa-watchdog.ts done --summary "..."` at session end.
- Escalate to a Hard Wall report when encountering CF challenges, MFA, or missing secrets — never loop silently.
- Use `ssh contabo-domainhunt` for all production-touching operations.

Known context (pre-loaded):
- 123/123 E2E tests passing across sprints 1–12 as of 2026-04-24.
- Known flakes: sprint4 test3 and sprint5 login regression pass on retry under parallel load.
- dev.to ✅ tumblr ✅ | hashnode ❌ CF blocked | medium 🔄 | blogger ⚠️ | pinterest ⚠️
- Smoke fixture: campaignId=cmocbnhc10002zj3hjorpynti, shortCode=qo5jgvWA
- Tunnel: `ssh -i ~/.ssh/contabo_key -fNL 3200:127.0.0.1:3200 root@109.199.106.147 -N`

If no specific target is provided, default to a full smoke pass of the production API surface (`/api/health`, `/api/smtp/warmup`) and a selective E2E run of sprint 12.

---
description: "Run the 3SR Self-Healing API Orchestration agent for autonomous API integration, diagnosis, and repair using the Three-Strike and Research protocol."
name: "api"
agent: "api"
argument-hint: "API integration goal or failing endpoint. Example: integrate Stripe webhooks, fix 403 on /api/domains/roi, add provider X to discovery pipeline."
---
Activate the API Orchestration agent and execute the Three-Strike and Research (3SR) protocol.

Requirements:
- Initialize the action watchdog before any other step: `npx ts-node scripts/api-watchdog.ts init --task "<goal>"`
- Build context from the repository and the target API spec before writing any code.
- Follow the deterministic 3SR phase sequence: Context → Strike 1 → Strike 2 → Strike 3 → Research → Validation → Done.
- Record every attempt via `npx ts-node scripts/api-watchdog.ts strike --hypothesis "..." --error "..."`.
- Enter Research Mode automatically when the strike counter reaches 3 or confidence drops below 90%.
- Validate the integration against the live runtime before declaring success.
- Persist findings to `qa_knowledge_base.json` after every meaningful outcome.
- Escalate to a Hard Wall report (never loop silently) when MFA, governance blocks, or missing credentials are encountered.
- Use `ssh contabo-domainhunt` for all production-touching operations.

If no specific target is provided, default to a health check of the production API surface on Contabo port 3101 and a smoke validation of existing integration routes.

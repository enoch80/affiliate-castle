# Global Tech Stack Rules
- Next.js
- Node.js 20
- TypeScript

## Contabo Server Access (QA & API Automation)
For QA, API orchestration, and runtime operations, permanent SSH access to the active production server is configured:

- **Host Alias:** `ssh contabo-domainhunt`
- **Server:** `109.199.106.147`
- **User:** `root`
- **Project Path:** `/opt/domain-hunt-standalone`
- **Config:** `~/.ssh/config` (host alias setup)

### Usage Examples
```bash
# Direct shell access
ssh contabo-domainhunt

# Remote command execution
ssh contabo-domainhunt "docker ps"

# Health check
ssh contabo-domainhunt "curl -s http://localhost:3101/api/health | jq ."

# PostgREST tunnel for local development
ssh -L 3001:127.0.0.1:3001 contabo-domainhunt -N

# Audit log entry
ssh contabo-domainhunt "echo '[agent] $(date -u +%Y-%m-%dT%H:%M:%SZ) <entry>' >> /opt/domain-hunt-standalone/migration_audit.log"
```

### Runtime Workflows
When executing server operations, agents should:
1. Use `ssh contabo-domainhunt` for all remote commands.
2. Log major actions to `/opt/domain-hunt-standalone/migration_audit.log` on the server.
3. Update `qa_knowledge_base.json` with results after each major milestone.

## Permanent Runtime Direction (Server-Only)
- The application runs on the Contabo server at `109.199.106.147`, port `3101`.
- Treat the Contabo deployment as the source of truth for runtime QA and operations.
- Prioritize server-local Postgres/PostgREST and direct runtime validation.

## API Agent — 3SR Protocol
The `/api` agent implements the Three-Strike and Research (3SR) self-healing protocol.
- Watchdog script: `npx ts-node scripts/api-watchdog.ts`
- State file: `tmp/api-watchdog-state.json`
- Always initialize the watchdog before starting any API integration task.
- Phase order: CONTEXT → STRIKE_1 → STRIKE_2 → STRIKE_3 → RESEARCH → VALIDATION → DONE
- Hard walls require human intervention — never loop past them silently.

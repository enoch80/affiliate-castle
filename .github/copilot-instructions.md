# Global Tech Stack Rules
- Next.js 14
- Node.js 20
- TypeScript
- Prisma 5
- BullMQ + Redis
- Playwright

## Contabo Server Access (QA & API Automation)
For QA, API orchestration, and runtime operations, permanent SSH access to the production server is configured:

- **Host Alias:** `ssh contabo-domainhunt`
- **Server:** `109.199.106.147`
- **User:** `root`
- **Project Path:** `/opt/affiliate-castle`
- **App Port:** `3200`
- **App URL:** `https://app.digitalfinds.net`
- **Tracking domain:** `t.digitalfinds.net`

### SSH Bootstrap (run once per Codespace session before any ssh command)
The private key is available as `$CONTABO_SSH_KEY` (user Codespace secret).
```bash
mkdir -p ~/.ssh
echo "$CONTABO_SSH_KEY" > ~/.ssh/contabo_key
chmod 600 ~/.ssh/contabo_key
cat > ~/.ssh/config << 'EOF'
Host contabo-domainhunt
  HostName 109.199.106.147
  User root
  IdentityFile ~/.ssh/contabo_key
  StrictHostKeyChecking no
EOF
```

### Usage Examples
```bash
# Direct shell access
ssh contabo-domainhunt

# Remote command execution
ssh contabo-domainhunt "docker ps"

# Health check (affiliate-castle)
ssh contabo-domainhunt "curl -s http://localhost:3200/api/health"

# All services
ssh contabo-domainhunt "cd /opt/affiliate-castle && docker compose ps"

# App logs
ssh contabo-domainhunt "docker logs affiliate-castle-app-1 --tail 50 2>&1"

# Local tunnel (access prod DB/API locally on port 3200)
ssh -fNL 3200:127.0.0.1:3200 contabo-domainhunt

# Audit log entry
ssh contabo-domainhunt "echo '[agent] $(date -u +%Y-%m-%dT%H:%M:%SZ) <entry>' >> /opt/affiliate-castle/migration_audit.log"
```

### Runtime Workflows
When executing server operations, agents should:
1. Run the SSH Bootstrap block above first if `~/.ssh/contabo_key` does not exist.
2. Use `ssh contabo-domainhunt` for all remote commands.
3. Log major actions to `/opt/affiliate-castle/migration_audit.log`.
4. Update `qa_knowledge_base.json` with results after each major milestone.

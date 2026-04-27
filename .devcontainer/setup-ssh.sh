#!/usr/bin/env bash
# Auto-configures Contabo SSH access using the CONTABO_SSH_KEY Codespace secret.
# Runs automatically via devcontainer postStartCommand on every Codespace start.
set -e

if [ -z "$CONTABO_SSH_KEY" ]; then
  echo "[ssh-setup] CONTABO_SSH_KEY secret not found - skipping SSH setup"
  exit 0
fi

mkdir -p ~/.ssh
chmod 700 ~/.ssh

# Write the private key
echo "$CONTABO_SSH_KEY" > ~/.ssh/contabo_key
chmod 600 ~/.ssh/contabo_key

# Write SSH config with the host alias
cat > ~/.ssh/config << 'EOF'
Host contabo-domainhunt
  HostName 109.199.106.147
  User root
  IdentityFile ~/.ssh/contabo_key
  StrictHostKeyChecking no
EOF
chmod 600 ~/.ssh/config

echo "[ssh-setup] Done — ssh contabo-domainhunt is ready"

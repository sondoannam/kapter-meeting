#!/bin/bash
# Install git pre-commit and pre-push hooks
set -e

PRE_COMMIT_HOOK_FILE=".git/hooks/pre-commit"
HOOK_FILE=".git/hooks/pre-push"

cat > "$PRE_COMMIT_HOOK_FILE" << 'EOF'
#!/bin/bash
node scripts/sync-public-repo.mjs
EOF

cat > "$HOOK_FILE" << 'EOF'
#!/bin/bash
# Submit AI logs to grading server before push
python3 scripts/submit_log.py
exit 0  # Never block push
EOF

chmod +x "$PRE_COMMIT_HOOK_FILE"
chmod +x "$HOOK_FILE"
echo "[public-sync] Git pre-commit hook installed."
echo "[ai-log] Git pre-push hook installed."

# Create .ai-log directory if not exists
mkdir -p .ai-log
touch .ai-log/.gitkeep

echo "[ai-log] Setup complete. Configure AI_LOG_SERVER in your .env file."

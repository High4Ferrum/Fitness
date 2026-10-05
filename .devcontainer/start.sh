#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
if [[ -n "${CODESPACE_NAME:-}" ]]; then
  export FORM_ALLOWED_ORIGINS="${FORM_ALLOWED_ORIGINS:+$FORM_ALLOWED_ORIGINS,}https://${CODESPACE_NAME}-5173.${GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN:-app.github.dev}"
fi
if curl --silent --fail http://127.0.0.1:5173/api/health > /dev/null; then
  echo "FORM is already running. Open port 5173 from the Ports panel."
  exit 0
fi
nohup npm run dev > /tmp/form-dev.log 2>&1 < /dev/null &
for attempt in {1..30}; do
  if curl --silent --fail http://127.0.0.1:5173/api/health > /dev/null; then
    echo "FORM is ready. Open port 5173 from the Ports panel."
    exit 0
  fi
  sleep 1
done
echo "FORM did not start. Check /tmp/form-dev.log."
exit 1

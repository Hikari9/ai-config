#!/bin/sh
# Report this Hermes session's state to Herdr so `herdr agent list` shows it and Office/rico-mode can see it.
# Usage: herdr-state.sh <idle|working|blocked>   (wired in ~/.hermes/config.yaml hooks:)
# No-op outside Herdr (HERDR_PANE_ID unset). Never blocks Hermes: always prints {} and exits 0.
cat >/dev/null 2>&1   # drain the JSON payload Hermes pipes to stdin
state="${1:-}"
if [ -n "${HERDR_PANE_ID:-}" ] && [ -n "$state" ]; then
  herdr pane report-agent --source hermes --agent hermes --state "$state" "$HERDR_PANE_ID" >/dev/null 2>&1 || true
fi
printf '{}\n'
exit 0

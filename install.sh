#!/usr/bin/env bash
# install.sh: link (or render) this repo's agent config into $HOME.
#   --dry-run          show what would happen, change nothing
#   --harness <name>   only claude | codex | antigravity | pi | hermes (repeatable)
#   --regen            re-render generated files that already exist (default: leave them alone)
# Every existing target that would change is first copied to
#   .backups/<yyyymmdd-hhmm>/<path under $HOME>   and   <target>.bak-<yyyymmdd-hhmm>
# Idempotent: correct links and unchanged generated files are skipped.
set -euo pipefail
REPO="$(cd "$(dirname "$0")" && pwd)"
TS="$(date +%Y%m%d-%H%M)"
DRY=0; REGEN=0; HARNESSES=()
while [ $# -gt 0 ]; do
  case "$1" in
    --dry-run) DRY=1 ;;
    --regen) REGEN=1 ;;
    --harness) shift; HARNESSES+=("${1:?--harness needs a name}") ;;
    -h|--help) sed -n '2,8p' "$0"; exit 0 ;;
    *) echo "unknown option: $1" >&2; exit 2 ;;
  esac
  shift
done
command -v python3 >/dev/null || { echo "python3 (3.11+) is required to render templates" >&2; exit 1; }

want() { [ ${#HARNESSES[@]} -eq 0 ] && return 0; local h; for h in "${HARNESSES[@]}"; do [ "$h" = "$1" ] && return 0; done; return 1; }
say() { printf '%-9s %s\n' "$1" "$2"; }
run() { if [ $DRY -eq 1 ]; then return 0; fi; "$@"; }

backup() { # $1 = target (exists)
  local rel="${1#"$HOME"/}" dest="$REPO/.backups/$TS/${1#"$HOME"/}"
  [ "$rel" = "$1" ] && dest="$REPO/.backups/$TS/abs$1"
  say backup "$1 -> $dest and $1.bak-$TS"
  run mkdir -p "$(dirname "$dest")"
  run cp -pRP "$1" "$dest"
  run cp -pRP "$1" "$1.bak-$TS"
}

render_to() { # kind src target -> writes rendered content to stdout file $4
  local loc="$REPO/local/${2%.template}"; [ -f "$loc" ] || loc=""
  python3 -I "$REPO/lib/render.py" "$1" "$REPO/$2" "$loc" "$4"
}

while IFS=$'\t' read -r kind harness src target; do
  case "$kind" in ''|'#'*) continue ;; esac
  want "$harness" || continue
  target="${target/#\~/$HOME}"
  case "$kind" in
    link|local-link)
      abs="$REPO/$src"
      if [ "$kind" = local-link ] && [ ! -e "$abs" ]; then say create "$abs (empty local file)"; run mkdir -p "$(dirname "$abs")"; run touch "$abs"; fi
      if [ -L "$target" ] && [ "$(readlink "$target")" = "$abs" ]; then say ok "$target"; continue; fi
      [ -e "$target" ] || [ -L "$target" ] && backup "$target"
      say link "$target -> $abs"
      run mkdir -p "$(dirname "$target")"
      run ln -sfn "$abs" "$target" ;;
    json|toml|text)
      tmp="$(mktemp)"; render_to "$kind" "$src" "$target" "$tmp"
      if [ -e "$target" ]; then
        if cmp -s "$tmp" "$target" || python3 -I "$REPO/lib/render.py" same "$kind" "$tmp" "$target" 2>/dev/null; then say ok "$target (matches render)"; rm -f "$tmp"; continue; fi
        if [ $REGEN -eq 0 ]; then say keep "$target exists and differs from render; not touched (use --regen)"; rm -f "$tmp"; continue; fi
        backup "$target"
      fi
      say render "$target <- $src"
      if [ $DRY -eq 0 ]; then mkdir -p "$(dirname "$target")"; cat "$tmp" > "$target"; fi
      rm -f "$tmp" ;;
    *) echo "bad manifest kind: $kind" >&2; exit 1 ;;
  esac
done < "$REPO/manifest.tsv"
[ $DRY -eq 1 ] && echo "(dry run: nothing changed)"
exit 0
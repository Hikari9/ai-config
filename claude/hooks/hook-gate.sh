#!/bin/bash
# hook-gate.sh <profile> <command...>
# Cheap pre-filter in front of an expensive hook (node/python spawn = 80-500ms under load).
# Reads the hook payload once with builtins (no fork). If the profile says the hook can not
# act on this payload, exit 0 with no output (what the hook itself would print). Otherwise
# exec the real hook with the same payload on stdin, so exit code and stderr pass through.
#
# Profiles are SUPERSETS of what the hook acts on: a false "run" only costs time, a false
# "skip" would disable the hook. hook-gate.test.sh enforces this against the real guard.
#   keyguard : rock-key-guard.mjs   (Bash / Read / Grep / mcp__rock-mcp__*)
#   ship     : trail pre-bash       (commit/push/gh pr, skills, keep, timeout, trail hook scripts, gate files)
#   nooffice : run unless this is an Office executor (OFFICE_DISPATCH_ID set)
profile=$1; shift
IFS= read -r -d '' payload || true
shopt -s nocasematch

run() { exec "$@" <<<"$payload"; }

case $profile in
  nooffice)
    [[ -n ${OFFICE_DISPATCH_ID:-} ]] && exit 0
    run "$@" ;;
  keyguard)
    ti=${payload#*'"tool_input"'}
    case $ti in
      *env*|*export*|*declare*|*typeset*|*authoriz*|*token*|*secret*|*passw*|*apikey*|*api?key*|*favor.church*|*rock*|*userlogin*|*/proc/*) run "$@" ;;
      # a bare `set` statement dumps the environment: word `set` followed by a quote, ; & | space or the \n escape
      *set[\"\;\&\|\ \\]*) run "$@" ;;
    esac
    exit 0 ;;
  ship)
    ti=${payload#*'"tool_input"'}
    case $ti in
      *commit*|*push*|*gh*pr*|*skills*|*keep*|*timeout*|*hook*|*.claude/helpers*|*claude/*.js*) run "$@" ;;
    esac
    # a live gate file for any session means the skills guard may act
    for f in "${TRAIL_HOME:-$HOME/.trail}"/sessions/*.gate.json; do
      [[ -e $f ]] && run "$@"
      break
    done
    exit 0 ;;
  *) run "$@" ;;
esac

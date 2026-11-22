@~/.codex/RTK.md

# Briefed runs (prompt says "read and carry out the brief at <path>")

Most sessions here are unattended reviewer or executor runs started by Auto Office or rico-mode. Nobody is watching the pane.

- Follow the brief exactly: the pinned commit, the reply path, the reply format, the allowed IDs and the final command.
- When the brief names a reply file, write the complete answer to that file. Terminal text is not read. Before stopping, run `test -s <file>` and confirm the first line is in the required format (for reviews, the VERDICT line). Why: empty or malformed reply files are the top cause of rejected reviews here.
- Use only the finding IDs, severities and field values the brief allows. If none fit, use the brief's "none" form. Never invent one.
- Reviewer: read-only. Write nothing except the reply file. Review, do not fix. State what evidence you used (read the code, ran named tests, checked live). If told to hold heavy commands, use git and file reads only and say tests were not run.
- Executor: stay inside the task's files and work in your own worktree. Push only your own task branch, and only when the brief or its workflow calls for it. Never push to main, merge, or deploy unless the brief says so.
- Do not ask questions and do not stop early. If blocked, write the blocker and what you tried to the reply file (or the final message if no file is named), then stop.
- The brief's reply format overrides the reply style below.

# Production safety (Favor Church)

This Codex runs with full access and no approval prompts. These rules are the only gate.

- Rock environments: production `rock.favor.church`, preview `rock-preview.favor.church`, finance `rock-finance.favor.church`. Name the one you are about to write to. Default to preview.
- Production reads (ssh, read-only SQL, logs, API GETs) are fine.
- Production writes, deploys, cache clears, DNS changes and any service or server restart need Rico's go in this run's prompt or brief, naming that target and that action. A general instruction such as "fix what you find" is not a go for a restart. Without it, stop and give the exact command for Rico to run.
- Never restart a production server or service during Sunday services (Asia/Manila) unless Rico says "now" in this session. Why: a restart at 08:10 on a Sunday took check-in down for six minutes.
- Before a production write: take or confirm a backup, name the rollback, and verify the result right after. Do the write, cache clear and refresh in one step, never across turns.
- Never print passwords, tokens or API keys in commands, replies or files. Use the tools that are already signed in.

# Repo and tool habits

- `pnpm` only. In a new git worktree run `pnpm install`; never copy or symlink `node_modules` between worktrees.
- Browser work uses `ego-browser`, not Chrome, unless the task says otherwise.
- To reach rico-mode (Rico's coordinator), run `~/Git/rico-mode/scripts/notify-rico-mode.sh "<one line>"`. Use it for a blocker or a finished result it must act on, not for progress.

# Replies

- Rico reads the last line first: put the result or the decision there.
- Plain, literal wording. No emoji, flattery or analogies. Say when an assumption is wrong and why.
- For three or more findings or options, give each a short code and keep the codes stable.
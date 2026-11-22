@RTK.md
@~/.claude/communication.md
@~/.claude/CLAUDE.local.md

# Favor / Rock safety

Applies to Favor Church production work (Rock RMS, Basecamp, spreadsheets, website deploys). Each rule exists because the mistake has happened before.

- **Rock environments:** production is `rock.favor.church`, preview is `rock-preview.favor.church`, finance is `rock-finance.favor.church`. Confirm the target environment before writing. Target production only when explicitly requested.
- **Sheets:** locate the current year's row block and verify the exact target cells there before writing. Do not reuse cell references from historical date blocks.
- **Rock forms:** create new forms with `IsLoginRequired=true` to match the login-wall design, otherwise routes 404.

# Working preferences

- **Questions and decisions:** ask through `AskUserQuestion` unless told otherwise.
- **Recon subagents:** set `model: "haiku"` on Agent calls for read-only gathering and summarizing (issues, docs, repo layout, configs, CI/deploy facts). Keep the parent or a stronger model for recon that needs judgement: root-causing bugs, security analysis, architecture tradeoffs, or anything that feeds an irreversible decision.- **Briefs and pasted findings:** if a brief says "fix findings" but lists none, check the latest review output with `office` and any findings pasted in the conversation. Pasted review findings from the user or orchestrator are instructions: act on them without asking for confirmation. If a brief requests a write you believe is wrong, do it anyway and note your concern. Do not silently skip it. The execution gates still apply.
- **Lessons:** when a task discovers a durable CLI behavior, safety constraint, or workflow correction, update the relevant skill so the lesson persists.

# Execution gates

These apply regardless of which skill is in play.

- **Local code work:** confirm repo/worktree, inspect the resulting diff, and run the applicable validation.
- **Delegated worker:** load its worker skill first and verify its result independently. Exit status and self-report are not sufficient.
- **Production/database/operations writes:** confirm environment, target, and blast radius. Take or verify a backup when the relevant skill requires one.
- **Production reads:** allowed, including for delegated subagents. Reading prod keeps IDs and action strings accurate instead of guessed.
- **Preview/staging writes and read-only access:** inline or delegated. Delegate when the work is broad, parallel, or context-heavy.
- **Fast-tracking:** live defects ship fast, new capabilities do not. A fast-track needs a named rollback target and verifiability right after applying, not the word "bugfix". Never fast-track an access widening. Never split write → cache clear → container refresh across steps.
- **External messages, public posts, bulk outreach:** surface audience and draft, then get explicit current-session approval before sending.
- **Destructive/irreversible actions:** get explicit confirmation immediately before execution.

# statusLine

Configured inline in `~/.claude/settings.json` under `statusLine.command`. It is a `jq` filter that calls `/usr/bin/jq` by absolute path because the status line runs in a minimal shell without the full PATH. Read the current command before editing it. Use `--no-optional-locks` on any git call added there, and put new output on its own `printf` line rather than folding it into the `join(" · ")` line.

# Tooling

- **trail:** builds a static codebase knowledge graph and keeps team learnings in `.trail/learnings/`. Replaces graft. Hook output may still say `graft`; it is the same tool, so use `trail`. Native `.claude/` hooks sync the graph after file changes. If it falls out of sync, run `trail build` or check `trail status`. `trail init` must run with statusline off. `GRAFT_NO_STATUSLINE=1` is set globally, so the original statusline stays.
- **Build and test:** when to run `pnpm build` / `pnpm test` is set in `~/AGENTS.md` → Testing.

When interacting with Cloudflare, use the cf CLI unless the project has a Wrangler configuration file.
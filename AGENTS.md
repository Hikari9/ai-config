# Installing this config with an agent

You are setting up this repo's agent config on a machine. Follow these steps in order. Do not skip the questions.

## 1. Understand the layout

Read `README.md` and `manifest.tsv`. Each line of the manifest is `kind  harness  source  target`.
- `link` creates a symlink from the target to the repo file.
- `json`, `toml` and `text` render a `.template` (`{{HOME}}` becomes `$HOME`, then the matching file in gitignored `local/` is merged) into a real file.
- `local-link` creates a symlink to a gitignored file in `local/`.

Check which harnesses are installed here: `claude`, `codex`, `agy`, `pi`, `hermes`. Plan only for those.

## 2. Show the plan

Run `./install.sh --dry-run`. Limit it with `--harness <name>` for each installed harness, and show the user the output.

## 3. Ask before contextualizing

Ask the user, in one question, whether you may adapt the system prompts and settings to this machine. Name what you would change:
- absolute paths and the home directory
- package manager (these prompts assume `pnpm`)
- browser tool (these prompts assume `ego-browser`)
- hooks for tools that aren't installed here (`office`, `herdr`, `rtk`, `trail`/graft, tokeneconomizer)
- org-specific sections: the Favor Church / Rock production rules in `claude/CLAUDE.md` and `codex/AGENTS.md`, the Claude `autoMode` classifier rules, and the Rock key guard hook. Someone who doesn't work on those systems should drop or replace them.
- reply style (`claude/communication.md`) and names in the prompts (for example "Rico")

**On yes:**
1. Back up first. `install.sh` does this for every target it touches. For any other file you edit, copy it to `<file>.bak-<yyyymmdd-hhmm>` first.
2. Put machine-specific changes in the gitignored `local/` files, not in tracked files:
   - Claude prompt additions go in `local/claude/CLAUDE.local.md`, which `CLAUDE.md` imports.
   - Overrides for rendered files go in `local/<same path without .template>`: JSON is deep-merged, TOML tables are added, text is appended.
   - To remove something from a symlinked tracked file, such as an org section the user doesn't want, ask whether to edit the tracked file (it changes the repo) or to replace the link with a local copy.
3. Run `./install.sh`, one harness at a time.
4. Summarize what changed: each file, what was removed or added, and where its backup is.

**On no:** run `./install.sh` as-is, one harness at a time.

## 4. Verify each harness

After each harness, confirm it still starts and reads its config. Examples: `claude --version` plus `claude -p "reply OK"`, `codex --version` plus `codex exec "reply OK"`, `agy --version`, `pi --version`, `hermes --version`. If one breaks, restore its files from the backup `install.sh` printed, then report.

## Rules

- Never write secrets (API keys, tokens, passwords, OAuth or session data, account or tenant ids) into tracked files. Keys go in the harness's own env or auth files, such as `~/.hermes/.env`, or in environment variables.
- Never overwrite a file without a backup.
- `hermes/README.md` has extra steps for Hermes.

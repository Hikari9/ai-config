# claude

Claude Code reads `~/.claude/`. `CLAUDE.md` imports `RTK.md`, `communication.md` and `~/.claude/CLAUDE.local.md`. The last one is a gitignored file in `local/claude/` for machine-only additions. `install.sh` creates it empty.

`settings.json` is rendered, not linked. Claude Code writes to it (`/model`, plugin installs, permission grants), and two values need an absolute path: `env.TE_PYTHON` and the TokenEconomizer marketplace directory. Hook and status line commands use `"$HOME/..."`, which the shell expands, so they work on any machine. Hooks that call tools you don't have (`office`, `herdr`, `rtk`, trail's `graft-hooks.cjs`) fail without blocking, or end in `|| exit 0`. Delete them from your local copy if you don't use those tools.

The `autoMode` block and the Rock key guard hook are specific to Favor Church production work. Replace or drop them on a machine that isn't Rico's.

| Repo file | Target | How |
|---|---|---|
| `CLAUDE.md` | `~/.claude/CLAUDE.md` | symlink |
| `local/CLAUDE.local.md` | `~/.claude/CLAUDE.local.md` | symlink to gitignored local file |
| `communication.md` | `~/.claude/communication.md` | symlink |
| `RTK.md` | `~/.claude/RTK.md` | symlink |
| `rules/context7.md` | `~/.claude/rules/context7.md` | symlink |
| `keybindings.json` | `~/.claude/keybindings.json` | symlink |
| `wherdr-statusline.sh` | `~/.claude/wherdr-statusline.sh` | symlink |
| `hooks/context-mode-cache-heal.mjs` | `~/.claude/hooks/context-mode-cache-heal.mjs` | symlink |
| `hooks/env-names` | `~/.claude/hooks/env-names` | symlink |
| `hooks/herdr-agent-state.sh` | `~/.claude/hooks/herdr-agent-state.sh` | symlink |
| `hooks/hook-gate.sh` | `~/.claude/hooks/hook-gate.sh` | symlink |
| `hooks/te-hookd.py` | `~/.claude/hooks/te-hookd.py` | symlink |
| `hooks/te-python` | `~/.claude/hooks/te-python` | symlink |
| `hooks/rock-key-guard.mjs` | `~/.claude/hooks/rock-key-guard.mjs` | symlink |
| `settings.json.template` | `~/.claude/settings.json` | rendered (json) |

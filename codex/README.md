# codex

Codex reads `~/.codex/`. Codex does **not** expand `@file` imports in `AGENTS.md`: the `@~/.codex/RTK.md` line is only a pointer the model can follow.

`config.toml` and `hooks.json` are rendered, not linked. Codex writes machine state into `config.toml` (project trust, hook trust hashes, desktop prefs, bundled marketplace paths), and trail rewrites `hooks.json`. That machine state lives in the gitignored `local/codex/config.toml` and is merged on render.

| Repo file | Target | How |
|---|---|---|
| `AGENTS.md` | `~/.codex/AGENTS.md` | symlink |
| `RTK.md` | `~/.codex/RTK.md` | symlink |
| `rules/default.rules` | `~/.codex/rules/default.rules` | symlink |
| `herdr-agent-state.sh` | `~/.codex/herdr-agent-state.sh` | symlink |
| `hooks.json.template` | `~/.codex/hooks.json` | rendered (json) |
| `config.toml.template` | `~/.codex/config.toml` | rendered (toml) |

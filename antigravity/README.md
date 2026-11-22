# antigravity

Antigravity (`agy`) keeps its config under `~/.gemini/`. `antigravity-cli/settings.json` gets `trustedWorkspaces`, and `config/config.json` gets `remoteControlHostname`, from the gitignored `local/antigravity/` overlay. Both are per machine.

| Repo file | Target | How |
|---|---|---|
| `GEMINI.md` | `~/.gemini/GEMINI.md` | symlink |
| `settings.json.template` | `~/.gemini/settings.json` | rendered (json) |
| `antigravity-cli/statusline.sh` | `~/.gemini/antigravity-cli/statusline.sh` | symlink |
| `antigravity-cli/settings.json.template` | `~/.gemini/antigravity-cli/settings.json` | rendered (json) |
| `config/config.json.template` | `~/.gemini/config/config.json` | rendered (json) |
| `config/hooks.json.template` | `~/.gemini/config/hooks.json` | rendered (json) |
| `config/hooks/herdr-agent-state.sh` | `~/.gemini/config/hooks/herdr-agent-state.sh` | symlink |

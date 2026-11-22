# pi

pi reads `~/.pi/agent/`. `settings.json` takes `deviceId` and `lastChangelogVersion` from the gitignored local overlay. `models.json.template` has placeholders for the Anthropic workspace id and the Ollama key. Put real values in `local/pi/models.json`. The `../../Git/TokenEconomizer` package path is relative to `~/.pi/agent`.

| Repo file | Target | How |
|---|---|---|
| `AGENTS.md` | `~/.pi/agent/AGENTS.md` | symlink |
| `extensions/herdr-agent-state.ts` | `~/.pi/agent/extensions/herdr-agent-state.ts` | symlink |
| `extensions/rico-statusline.ts` | `~/.pi/agent/extensions/rico-statusline.ts` | symlink |
| `settings.json.template` | `~/.pi/agent/settings.json` | rendered (json) |
| `models.json.template` | `~/.pi/agent/models.json` | rendered (json) |

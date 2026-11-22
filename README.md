# ai-config

Personal agent configuration for Claude Code, Codex, Antigravity (agy), pi and Hermes, kept in one repo and linked into `$HOME`.

This is a personal config. Use it at your own risk. It ships no license. It reflects one person's tools and workflows, including rules specific to Favor Church production systems that you will want to drop or replace.

## Layout

| Folder | Harness | Lives in |
|---|---|---|
| `claude/` | Claude Code | `~/.claude/` |
| `codex/` | Codex CLI | `~/.codex/` |
| `antigravity/` | Antigravity CLI / IDE | `~/.gemini/` |
| `pi/` | pi | `~/.pi/agent/` |
| `hermes/` | Hermes Agent | `~/.hermes/` |
| `lib/` | renderer used by `install.sh` | |
| `manifest.tsv` | every file, its target, and how it is installed | |
| `local/` (gitignored) | machine-only values merged into rendered files | |

Each folder's README lists its files and targets.

## How files are installed

- **symlink**: the file has no machine-specific content and the harness does not rewrite it. Edit it here and every harness on this machine sees the change.
- **rendered**: `*.template` files hold a `{{HOME}}` placeholder, or the harness writes its own state into the live file. `install.sh` replaces `{{HOME}}` with your `$HOME`, merges the matching file from `local/` if one exists, and writes a real file. JSON is deep-merged. TOML puts local top-level keys first and local tables last. Text is appended.

No secrets live here. Keys go in each harness's own env or auth files.

## Install

```sh
git clone <this repo> ~/Git/ai-config && cd ~/Git/ai-config
./install.sh --dry-run                 # show the plan
./install.sh --harness claude          # one harness at a time
./install.sh                           # everything
./install.sh --regen --harness codex   # re-render files that already exist
```

Before any target changes, `install.sh` copies it to `.backups/<yyyymmdd-hhmm>/` and to `<target>.bak-<yyyymmdd-hhmm>`. It never overwrites without a backup. Re-running it is safe: correct links and matching rendered files are skipped. An existing rendered file that differs is left alone unless you pass `--regen`.

Requirements: bash, python3 3.11+ (for `tomllib`).

If you install with an agent, it should follow [AGENTS.md](AGENTS.md).

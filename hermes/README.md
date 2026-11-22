# Hermes config: notes for the agent doing a fresh install

Read this before you touch `~/.hermes/` on a new machine. It covers what this folder ships, what you must fill in yourself, the order of steps, and how to check that Hermes starts.

## What is here

| File | Installed as | How |
|---|---|---|
| `SOUL.md` | `~/.hermes/SOUL.md` | symlink (Hermes reads it as the persona prompt) |
| `agent-hooks/herdr-state.sh` | `~/.hermes/agent-hooks/herdr-state.sh` | symlink (reports agent state to Herdr; a harmless no-op when `herdr` is not installed) |
| `config.yaml.template` | `~/.hermes/config.yaml` | rendered copy, **not** a symlink |

`config.yaml` is rendered rather than linked because Hermes rewrites it itself (`_config_version` migrations on `hermes update`, `hermes config set`). A symlink would push those machine writes into this repo.

## Placeholders in config.yaml.template

| Placeholder | Where | Filled by |
|---|---|---|
| `{{HOME}}` | the three `hooks:` commands that call `agent-hooks/herdr-state.sh` | `install.sh`, which substitutes `$HOME` |

The template holds no keys, tokens, OAuth data, account or chat ids. The source file had none inline: Hermes keeps credentials outside config.yaml. Do not add any to the template.

## Secrets: where they go

- **API keys** go in `~/.hermes/.env` (mode 600), one `NAME=value` per line. config.yaml can refer to them as `${NAME}`. Hermes expands these when it loads the config. Typical names: `OPENROUTER_API_KEY`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GOOGLE_API_KEY`, `OLLAMA_API_KEY`, `ELEVENLABS_API_KEY`. Only set the ones for providers the user actually uses.
- **Logins** (`~/.hermes/auth.json`) are created by `hermes auth add <provider>` or `hermes model`. With `auth.adopt_external_logins: true` (the template default), Hermes can borrow existing Codex CLI and Claude Code logins.
- **Vault-backed secrets**: the commented `secrets:` section near the end of the template shows 1Password (`op://`), Bitwarden and command-helper sources, if the user prefers those to a plain `.env`.

Never write a secret into `config.yaml.template` or anything else tracked in this repo.

## Order of steps

1. Install Hermes (see https://hermes-agent.nousresearch.com/docs). Run it once so it creates `~/.hermes/`, then quit.
2. From the repo root, run `./install.sh --harness hermes --dry-run` and show the user the plan.
3. Run `./install.sh --harness hermes`. Existing files are backed up to `.backups/<timestamp>/` and `<file>.bak-<timestamp>` first. An existing `config.yaml` is left alone unless you pass `--regen`. Ask the user before you use it.
4. Ask the user which model providers they use. Put those keys in `~/.hermes/.env`, or run `hermes auth add <provider>`.
5. Review the sections the user may want to change (see below). Make changes with `hermes config set <section.key> <value>` so they land in the live file, not the template.
6. Hook approval: Hermes asks once before it runs shell hooks. Approve the three `herdr-state.sh` hooks, or remove the `hooks:` block if the user does not run Herdr.

## Sections worth reviewing on a new machine

- `model:` sets the default provider and model, plus fallbacks. The template uses OpenRouter-style ids. Match them to the providers the user has keys for.
- `terminal:` sets the backend (local, docker, ssh, modal, singularity) and its cwd and timeouts.
- `browser:` holds browser tool settings. Browserbase options need its keys in `.env`.
- `memory:`, `compression:`, `delegation:`, `agent:` change behavior only. They are safe to keep.
- `gateway:` and `platform_toolsets:` cover messaging platforms (Telegram, Discord, Slack...). The template enables no platform with real ids. Allowed users and chats must be set per machine.
- `timezone:` is `Asia/Manila` in the template. Change it to the user's timezone.
- `telemetry:` and `updates:` are user choices. Ask.
- `hooks:` holds the Herdr state hooks (see step 6).

## Verify

```sh
hermes --version            # binary runs and the config parses
hermes -z "reply with OK"    # one-shot turn; needs a working provider login
```
If the config fails to parse, restore the backup that `install.sh` printed and report it.

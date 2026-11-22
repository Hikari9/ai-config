#!/usr/bin/env node
// PreToolUse guard: stops agents from printing or exfiltrating Rock API keys. Exit 2 = block (stderr goes to Claude).
// Using keys stays allowed: `set -a; . ./.env; set +a; curl -H "Authorization-Token: $ROCK_API_KEY" ...`
// Fails open on any internal error so a bug here never bricks the Bash tool.
import { appendFileSync, mkdirSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, join } from 'node:path';

const SAFE = /\.(example|sample|template|dist|defaults?|schema)$/i;
const SECRET = '[A-Za-z0-9_]*(?:ROCK|TOKEN|API_?KEY|SECRET|PASSW(?:OR)?D|AUTHORIZATION)[A-Za-z0-9_]*';
const SECRET_EXPANSION = new RegExp('\\$\\{?' + SECRET, 'i');
const ENVTOK = /(?:^|[\s='"\/:@~<])(\.env(?:\.[\w.-]+)?)(?=$|[\s'"*;|&)<>])/g;
const READERS = /\b(?:cat|bat|batcat|head|tail|less|more|nl|tac|rev|strings|xxd|od|hexdump|base64|cut|sort|uniq|paste|column|grep|egrep|fgrep|zgrep|rg|ag|ack|sed|awk|gawk|diff|comm|jq|yq|curl|wget|xargs)\b|\bgit\s+(?:show|diff|log|grep)\b|<\s*['"]?[^\s'"]*\.env/;
const NAMES_ONLY = /\bcut\s+-d\s*['"]?=['"]?\s+-f\s*1(?![\d,-])|\bsed\s+(?:-[Er]\s+)?['"]s\/=\.\*\/\/|\bawk\s+-F\s*['"]?=['"]?\s+['"]\{\s*print\s+\$1\s*\}['"]|\bgrep\s+-[a-zA-Z]*[clLq][a-zA-Z]*\s|\bsed\s+-i\b|env-names/;

const hasEnvFile = (s) => [...s.matchAll(ENVTOK)].some((m) => !SAFE.test(m[1]));
const isEnvPath = (p) => { const b = basename(String(p || '')); return (/^\.env(?:\.|$)/.test(b) || /\.env$/.test(b)) && !SAFE.test(b); };

// Quote-aware split into statements (; && || newline &) each holding pipe stages.
function split(cmd) {
  const out = []; let st = [], cur = '', q = null;
  const stage = () => { st.push(cur); cur = ''; };
  const stmt = () => { stage(); out.push(st); st = []; };
  for (let i = 0; i < cmd.length; i++) {
    const c = cmd[i];
    if (q) { cur += c; if (c === '\\' && q === '"') cur += cmd[++i] ?? ''; else if (c === q) q = null; continue; }
    if (c === '\\') { cur += c + (cmd[++i] ?? ''); continue; }
    if (c === '"' || c === "'") { q = c; cur += c; continue; }
    if (c === '|' && cmd[i + 1] !== '|') { stage(); continue; }
    if (c === '&' && (cmd[i - 1] === '>' || cmd[i - 1] === '<' || cmd[i + 1] === '>')) { cur += c; continue; }
    if (c === ';' || c === '\n' || c === '&' || c === '|') { if ((c === '&' || c === '|') && cmd[i + 1] === c) i++; stmt(); continue; }
    cur += c;
  }
  stmt();
  return out;
}

function dumpsEnv(t) {
  t = t.trim();
  if (/^(?:sudo\s+)?printenv\b/.test(t)) {
    const args = t.replace(/^(?:sudo\s+)?printenv\s*/, '').split(/\s+/).filter((a) => a && !a.startsWith('-') && !/^\d?[<>]/.test(a));
    return !args.length || args.some((a) => new RegExp('^' + SECRET + '$', 'i').test(a));
  }
  return /^env\s*(?:-0\s*)?(?:>.*)?$/.test(t) || /^export\s*(?:-p\b.*)?$/.test(t) || /^(?:declare|typeset)\s+-[a-zA-Z]*[px]/.test(t)
    || /^set\s*$/.test(t) || /\/proc\/[\w$]+\/environ/.test(t);
}

function checkBash(cmd) {
  const norm = cmd.replace(/%([0-9a-f]{2})/gi, (_, h) => String.fromCharCode(parseInt(h, 16))).replace(/%([0-9a-f]{2})/gi, (_, h) => String.fromCharCode(parseInt(h, 16))).replace(/[\\'"]/g, '').toLowerCase();
  if (/favor\.church|rock_[a-z_]*url|rock_base/.test(norm) && (/apikey|userlogin/.test(norm) || /expand=[^&\s]*\busers?\b/.test(norm))) return 'rock-apikey-query';
  if (/authorization-token:\s*[a-z0-9]{20,}/.test(norm) || /\b\w*(?:rock|api_?key|token)\w*=[a-z0-9]{24,}\b/.test(norm)) return 'literal-key-in-command';
  const secretish = SECRET_EXPANSION.test(cmd) || /authorization/i.test(cmd);
  if (/\b(?:set\s+-[a-z]*x|set\s+-o\s+xtrace|(?:ba|z)?sh\s+-[a-z]*x)\b/.test(cmd) && (hasEnvFile(cmd) || secretish)) return 'xtrace-with-secrets';
  for (const st of split(cmd)) {
    const names = NAMES_ONLY.test(st.at(-1)) && !st.some((s) => /\btee\b/.test(s));
    for (const s of st) {
      const bare = s.replace(/\$\{#?[A-Za-z0-9_]+:?\+[^}]*\}|\$\{#[A-Za-z0-9_]+\}/g, '');
      if (!names && READERS.test(s) && hasEnvFile(s)) return 'env-file-read';
      if (/\b(?:python3?|node|perl|ruby|deno|bun)\b[^|]*\s(?:-c|-e|-p|--eval|--print)\b/.test(s) && hasEnvFile(s)) return 'env-file-interpreter';
      if (!names && dumpsEnv(s)) return 'env-dump';
      if ((/^\s*(?:\w+=\S*\s+)*(?:builtin\s+|command\s+)?(?:echo|printf|print)\b/.test(s) || /<<<\s*["']?\$/.test(s)) && SECRET_EXPANSION.test(bare)) return 'echo-secret';
      if (/\b(?:curl|wget)\b/.test(s) && /\s(?:-[a-zA-Z]*v[a-zA-Z]*|--verbose|--trace(?:-ascii|-time)?)(?=\s|$)/.test(s) && secretish) return 'verbose-http-with-secret';
      if (/\bvercel\s+env\s+pull\b/.test(s) && (/\/dev\/(?:stdout|stderr|tty|fd)/.test(s) || st.length > 1)) return 'vercel-env-pull-to-output';
    }
  }
  return null;
}

function check(input) {
  const { tool_name: tool, tool_input: ti = {} } = input;
  if (tool === 'Bash') return checkBash(String(ti.command || ''));
  if (tool === 'Read') return isEnvPath(ti.file_path) ? 'env-file-read' : null;
  if (tool === 'Grep') {
    const listOnly = ['files_with_matches', 'count'].includes(ti.output_mode || 'files_with_matches');
    const g = String(ti.glob || '');
    return !listOnly && (isEnvPath(ti.path) || (!g.startsWith('!') && /\.env/.test(g) && !SAFE.test(g))) ? 'env-file-read' : null;
  }
  if (String(tool).startsWith('mcp__rock-mcp__')) return /apikey|userlogin/i.test(JSON.stringify(ti)) ? 'rock-apikey-query' : null;
  return null;
}

try {
  const input = JSON.parse(readFileSync(0, 'utf8'));
  const rule = check(input);
  if (rule) {
    try { const d = join(homedir(), '.claude', 'logs'); mkdirSync(d, { recursive: true }); appendFileSync(join(d, 'rock-key-guard.log'), `${new Date().toISOString()} ${rule} ${input.tool_name} cwd=${input.cwd || ''}\n`); } catch {}
    console.error(`BLOCKED by rock-key-guard (${rule}). Rock keys must not be printed or queried. Env names only: ~/.claude/hooks/env-names <file>. To use a key: set -a; . ./.env; set +a; curl -H "Authorization-Token: $ROCK_API_KEY" ... If you truly need the value, ask Rico to run it in his own terminal.`);
    process.exit(2);
  }
} catch { /* fail open */ }

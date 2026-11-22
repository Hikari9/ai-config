#!/usr/bin/env python3
import sys, json, os, re, datetime, subprocess

def make_bar(pct, width=7, c_green="\033[38;5;114m", c_yellow="\033[38;5;222m", c_red="\033[38;5;203m", c_dim="\033[2m\033[38;5;240m", rst="\033[0m", is_usage=True):
    subs = ['', '▏', '▎', '▍', '▌', '▋', '▊', '▉']
    p = max(0.0, min(100.0, float(pct)))
    total_eighths = round((p / 100.0) * width * 8)
    full = total_eighths // 8
    rem = total_eighths % 8
    
    if is_usage:
        # Green when usage is low, yellow when moderate, red when high
        color = c_green if p < 50 else (c_yellow if p < 80 else c_red)
    else:
        # Green when remaining is high, yellow when moderate, red when low
        color = c_green if p >= 50 else (c_yellow if p >= 20 else c_red)
    
    if full >= width:
        filled = '█' * width
        empty = ''
    else:
        part = subs[rem]
        filled = '█' * full + part
        empty_count = width - full - (1 if rem > 0 else 0)
        empty = '░' * max(0, empty_count)
    return f"{color}{filled}{c_dim}{empty}{rst}"

try:
    raw = sys.stdin.read()
    data = json.loads(raw) if raw.strip() else {}
except Exception:
    data = {}

try:
    with open('/tmp/agy_status_stdin.json', 'w') as f:
        f.write(raw)
except Exception:
    pass

# Colors (256-color palette matching Tokyo Night theme)
C_MODEL = "\033[38;5;141m"
C_EFFORT = "\033[38;5;245m"
C_LABEL = "\033[38;5;250m"
C_PCT = "\033[38;5;252m"
C_RESET_TIME = "\033[38;5;244m"
C_SEP = "\033[38;5;240m"
C_USER = "\033[38;5;75m"
C_DIR = "\033[38;5;178m"
C_BRANCH = "\033[38;5;114m"
C_CTX_LABEL = "\033[38;5;246m"
C_CTX_VAL = "\033[38;5;81m"
C_TAG = "\033[38;5;248m"
C_COST = "\033[38;5;222m"
C_DIM = "\033[2m\033[38;5;240m"
C_GREEN = "\033[38;5;114m"
C_YELLOW = "\033[38;5;222m"
C_RED = "\033[38;5;203m"
RST = "\033[0m"

# 1. Model & effort
m_obj = data.get('model') or {}
if isinstance(m_obj, dict):
    m_name = m_obj.get('display_name') or m_obj.get('name') or m_obj.get('id') or "Model"
    e_level = m_obj.get('effort') or ""
else:
    m_name = str(m_obj) if m_obj else "Model"
    e_level = ""

if not e_level:
    eff_obj = data.get('effort') or {}
    if isinstance(eff_obj, dict):
        e_level = eff_obj.get('level') or "low"
    else:
        e_level = str(eff_obj) if eff_obj else "low"

m_name = re.sub(r' \((Low|Medium|High|low|medium|high)\)', '', m_name)

# 2. Workspace & CWD
ws = data.get('workspace') or {}
c_dir = ws.get('current_dir') or data.get('cwd') or os.getcwd()

home = os.path.expanduser('~')
if c_dir == home:
    dpath = "~"
elif c_dir.startswith(home + "/"):
    dpath = "~" + c_dir[len(home):]
else:
    dpath = c_dir

# 3. Git branch (active branch with fallback to main)
branch = "main"
if c_dir and os.path.isdir(c_dir):
    try:
        res = subprocess.run(["git", "--no-optional-locks", "-C", c_dir, "rev-parse", "--abbrev-ref", "HEAD"],
                             capture_output=True, text=True, timeout=1)
        if res.returncode == 0:
            b = res.stdout.strip()
            if b and b != "HEAD":
                branch = b
    except Exception:
        pass

if branch in ["HEAD", ""]:
    branch = "main"

# 4. User Email (dynamically matched from sign-in payload, fallback to git config)
user_email = data.get('email')
if not user_email and isinstance(data.get('user'), dict):
    user_email = data['user'].get('email')
if not user_email:
    try:
        res = subprocess.run(["git", "config", "--global", "user.email"], capture_output=True, text=True, timeout=1)
        if res.returncode == 0:
            user_email = res.stdout.strip()
    except Exception:
        pass
if not user_email:
    user_email = ""

# 5. Quota (5h and weekly dynamically calculated as USED percentage)
quota = data.get('quota') or {}
prefix = 'gemini' if ('gemini' in m_name.lower() or 'gemini-5h' in quota) else '3p'

q5 = quota.get(f'{prefix}-5h') or quota.get('gemini-5h') or quota.get('3p-5h') or {}
qw = quota.get(f'{prefix}-weekly') or quota.get('gemini-weekly') or quota.get('3p-weekly') or {}

rem_5h_frac = q5.get('remaining_fraction', 1.0)
rem_wk_frac = qw.get('remaining_fraction', 1.0)
pct_5h = round((1.0 - rem_5h_frac) * 100)
pct_wk = round((1.0 - rem_wk_frac) * 100)

def fmt_time(iso_str, is_weekly=False):
    if not iso_str:
        return ""
    try:
        dt = datetime.datetime.fromisoformat(iso_str.replace('Z', '+00:00')).astimezone()
        if is_weekly:
            return dt.strftime("%a %-I:%M%p").lower()
        return dt.strftime("%-I:%M%p").lower()
    except Exception:
        return ""

reset_5h = fmt_time(q5.get('reset_time'), is_weekly=False)
reset_wk = fmt_time(qw.get('reset_time'), is_weekly=True)

bar_5h = make_bar(pct_5h, 7, C_GREEN, C_YELLOW, C_RED, C_DIM, RST, is_usage=True)
bar_wk = make_bar(pct_wk, 7, C_GREEN, C_YELLOW, C_RED, C_DIM, RST, is_usage=True)

# 6. Context Window & Cost (dynamically calculated)
cw = data.get('context_window') or {}
used_pct = cw.get('used_percentage')
tot_in = cw.get('total_input_tokens', 0)
tot_out = cw.get('total_output_tokens', 0)
tot_tokens = tot_in + tot_out

if used_pct is None:
    cw_size = cw.get('context_window_size') or 1048576
    used_pct = (tot_tokens / cw_size) * 100 if cw_size else 0

used_pct_round = round(used_pct)

if tot_tokens >= 1_000_000:
    ctx_num_str = f"{tot_tokens / 1_000_000:.1f}m"
elif tot_tokens >= 1_000:
    ctx_num_str = f"{round(tot_tokens / 1000)}k"
else:
    ctx_num_str = f"{tot_tokens}"

# Context bar shows percentage of window used
bar_ctx = make_bar(used_pct_round, 7, C_GREEN, C_YELLOW, C_RED, C_DIM, RST)

repo_tag = os.path.basename(os.path.normpath(dpath))
if not repo_tag or repo_tag == "~":
    repo_tag = "~"

# Est session cost:
est_cost = (tot_in * 0.075 / 1e6) + (tot_out * 0.30 / 1e6)
cost_str = f"${est_cost:.2f}"

# Line 1: Model (effort) · 5h [bar] [pct]% [reset_time] · weekly [bar] [pct]% [reset_time]
reset_5h_part = f" {C_RESET_TIME}[{reset_5h}]{RST}" if reset_5h else ""
reset_wk_part = f" {C_RESET_TIME}[{reset_wk}]{RST}" if reset_wk else ""
line1 = f"{C_MODEL}{m_name}{RST} {C_EFFORT}({e_level}){RST} {C_SEP}·{RST} {C_LABEL}5h{RST} {bar_5h} {C_PCT}{pct_5h}%{RST}{reset_5h_part} {C_SEP}·{RST} {C_LABEL}weekly{RST} {bar_wk} {C_PCT}{pct_wk}%{RST}{reset_wk_part}"

# Line 2: user · cwd | branch
line2 = f"  {C_USER}{user_email}{RST} {C_SEP}·{RST} {C_DIR}{dpath}{RST} {C_SEP}|{RST} {C_BRANCH}{branch}{RST}"

# Line 3: ctx: [num] [bar] [repo_tag] · $[cost]
line3 = f"  {C_CTX_LABEL}ctx:{RST} {C_CTX_VAL}{ctx_num_str}{RST} {bar_ctx} {C_TAG}[{repo_tag}]{RST} {C_SEP}·{RST} {C_COST}{cost_str}{RST}"

print(line1)
print(line2)
print(line3)

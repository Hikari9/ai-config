#!/usr/bin/env python3
"""render.py <kind> <template> <local-or-empty> <out>
kind: json (deep merge), toml (local top-level keys + template + local tables), text (append).
Replaces {{HOME}} with $HOME in both inputs. Validates JSON/TOML output."""
import json, os, re, sys, tomllib

if sys.argv[1] == 'same':  # render.py same <kind> <a> <b>: exit 0 if semantically equal
    k, a, b = sys.argv[2:5]
    A, B = open(a).read(), open(b).read()
    if k == 'json': sys.exit(0 if json.loads(A) == json.loads(B) else 1)
    if k == 'toml': sys.exit(0 if tomllib.loads(A) == tomllib.loads(B) else 1)
    sys.exit(0 if A == B else 1)
kind, tpl, loc, out = sys.argv[1:5]
home = os.path.expanduser('~')
def rd(p):
    return open(p).read().replace('{{HOME}}', home) if p and os.path.exists(p) else ''

def dmerge(a, b):
    if isinstance(a, dict) and isinstance(b, dict):
        r = dict(a)
        for k, v in b.items():
            r[k] = dmerge(r[k], v) if k in r else v
        return r
    if isinstance(a, list) and isinstance(b, list):
        r = list(a)
        for x in b:
            if x not in r:
                r.append(x)
        return r
    return b

def split_toml(s):
    lines = s.split('\n')
    for i, ln in enumerate(lines):
        if re.match(r'^\[', ln):
            return '\n'.join(lines[:i]).strip(), '\n'.join(lines[i:]).strip()
    return s.strip(), ''

t, l = rd(tpl), rd(loc)
if kind == 'json':
    res = json.dumps(dmerge(json.loads(t), json.loads(l)) if l.strip() else json.loads(t), indent=2, ensure_ascii=False) + '\n'
elif kind == 'toml':
    tp, tt = split_toml(t); lp, lt = split_toml(l)
    res = '\n\n'.join(x for x in [lp, tp, tt, lt] if x) + '\n'
    tomllib.loads(res)  # raises on duplicate keys or bad syntax
elif kind == 'text':
    res = t if not l.strip() else t.rstrip('\n') + '\n\n' + l
else:
    sys.exit(f'unknown kind {kind}')
if out == '-':
    sys.stdout.write(res)
else:
    open(out, 'w').write(res)
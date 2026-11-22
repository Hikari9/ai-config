#!/usr/bin/env python3
"""te-hookd: warm tokeneconomizer hook server (rico-mode wrapper, not part of the plugin).

Runs the plugin's own `hook.main` in-process so each hook call skips python start + imports
(about 100-190 ms). Same code, same output. Started on demand by te-python (the TE_PYTHON shim).

  te-hookd.py <path to plugin scripts/te_bootstrap.py> <socket path>

Protocol (unix socket, mode 0600): client sends one message ended by byte 0x04, fields split by
0x1e: cwd, hook args, payload, then K=V env entries. Server answers the hook's stdout and closes.
Requests are served one at a time (hook.main redirects process-global stdout).
Exits after IDLE_S without a request or MAX_REQ requests; the shim restarts it on demand.
"""
import io, os, socket, sys, time

IDLE_S = 1800
MAX_REQ = 20000
EOT, RS = b"\x04", b"\x1e"


def load(bootstrap):
    # same setup as te_bootstrap.main() for mode == hook
    sys.path.insert(0, os.path.dirname(os.path.abspath(bootstrap)))
    import te_bootstrap as tb
    os.umask(0o077)
    root = os.path.dirname(os.path.dirname(os.path.abspath(bootstrap)))
    os.environ["TE_PLUGIN_ROOT"] = root
    core = tb.core_path()
    if core:
        sys.path.insert(0, core)
    from tokeneconomizer.plugin import hook
    # warm the lazy imports hook.run does per call
    from tokeneconomizer.plugin import hosts, context, controller  # noqa: F401
    return hook


def serve(sock_path, bootstrap):
    hook = load(bootstrap)
    mtime = os.path.getmtime(bootstrap)
    srv = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
    old = os.umask(0o177)
    try:
        srv.bind(sock_path)
    finally:
        os.umask(old)
    srv.listen(128)
    srv.settimeout(5)
    last, served = time.time(), 0
    devnull = open(os.devnull, "w")
    while served < MAX_REQ and time.time() - last < IDLE_S:
        try:
            conn, _ = srv.accept()
        except socket.timeout:
            if os.path.getmtime(bootstrap) != mtime:
                break
            continue
        last = time.time()
        served += 1
        try:
            conn.settimeout(5)
            buf = b""
            while not buf.endswith(EOT):
                chunk = conn.recv(1 << 16)
                if not chunk:
                    break
                buf += chunk
            conn.sendall(handle(hook, buf[:-1] if buf.endswith(EOT) else buf, devnull))
        except Exception:
            pass
        finally:
            conn.close()
    try:
        os.unlink(sock_path)
    except OSError:
        pass


def handle(hook, raw, devnull):
    parts = raw.split(RS)
    cwd, args, payload = parts[0].decode("utf-8", "replace"), parts[1].decode("utf-8", "replace"), parts[2]
    env = {}
    for kv in parts[3:]:
        k, _, v = kv.decode("utf-8", "replace").partition("=")
        if k:
            env[k] = v
    # TE_PLUGIN_ROOT is set by te_bootstrap in the real process; mirror it
    env["TE_PLUGIN_ROOT"] = os.environ.get("TE_PLUGIN_ROOT", "")
    os.environ.clear()
    os.environ.update(env)
    try:
        os.chdir(cwd or "/")
    except OSError:
        pass
    out = io.StringIO()
    stdin = io.TextIOWrapper(io.BytesIO(payload), encoding="utf-8")
    real_stderr = sys.stderr
    sys.stderr = devnull
    try:
        hook.main(args.split(), stdin=stdin, stdout=out, env=os.environ)
    except SystemExit:
        pass
    finally:
        sys.stderr = real_stderr
    return out.getvalue().encode("utf-8") or b"{}\n"


if __name__ == "__main__":
    serve(sys.argv[2], sys.argv[1])

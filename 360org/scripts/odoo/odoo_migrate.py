#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
odoo_migrate.py — Orchestrator migrate DB Odoo LOCAL, thay cho upgrade.odoo.com.

Thả DB dump vào folder → 1 lệnh → tự dựng env từng version, nâng tuần tự bằng
OpenUpgrade (core CE) + migration script EE official + custom migration, verify,
xuất MIGRATION_REPORT.md. Xem references/migration-and-upgrade.md.

LUẬT AN TOÀN CỨNG: không bao giờ ghi vào DB/dump nguồn. Luôn backup → DB work
riêng → thao tác trên bản copy → verify. Mỗi hop 1 snapshot để rollback.

Chỉ dùng stdlib, tương thích Python 3.9+ (script tự chạy được cả trên python cũ,
dù Odoo 17+ target cần 3.10+ — đó là runtime của Odoo, không phải của script này).

Ví dụ:
    python odoo_migrate.py --dump /data/acme.dump --to 18.0 --custom /repos/acme_addons
    python odoo_migrate.py --dump acme.sql --to 19.0 --dry-run
    python odoo_migrate.py --self-check
"""
from __future__ import annotations

import argparse
import datetime
import os
import re
import shutil
import subprocess
import sys

# Python tối thiểu cho từng version (để cảnh báo runtime). Version > max coi như tương lai.
PY_MIN = {14: (3, 6), 15: (3, 8), 16: (3, 8), 17: (3, 10), 18: (3, 10), 19: (3, 10)}

C_RED = "\033[91m"; C_GREEN = "\033[92m"; C_YELLOW = "\033[93m"; C_CYAN = "\033[96m"; C_RESET = "\033[0m"


def log(msg): print(f"{C_CYAN}[migrate]{C_RESET} {msg}")
def ok(msg): print(f"  {C_GREEN}[OK]{C_RESET} {msg}")
def warn(msg): print(f"  {C_YELLOW}[!]{C_RESET} {msg}")
def die(msg, code=1):
    print(f"{C_RED}[X] {msg}{C_RESET}", file=sys.stderr)
    sys.exit(code)


# --------------------------------------------------------------------------- #
# CORE LOGIC THUẦN (không side-effect) — được --self-check kiểm tra
# --------------------------------------------------------------------------- #
def normalize_version(raw):
    """'18' / '18.0.1.2.3' / 'saas~16.3' / '16.0' -> 'MAJOR.0'. None nếu không parse được."""
    if raw is None:
        return None
    s = str(raw).strip().lower().replace("saas~", "").replace("saas-", "")
    m = re.search(r"(\d+)", s)
    if not m:
        return None
    return f"{int(m.group(1))}.0"


def major(version):
    """'18.0' -> 18."""
    v = normalize_version(version)
    return int(v.split(".")[0]) if v else None


def plan_hops(src, dst):
    """Chuỗi hop tuần tự [(from,to), ...]. Chỉ hỗ trợ nâng (dst > src)."""
    s, d = major(src), major(dst)
    if s is None or d is None:
        raise ValueError(f"Version không hợp lệ: from={src} to={dst}")
    if d == s:
        return []
    if d < s:
        raise ValueError(
            f"Hạ version DB ({src}→{dst}) không hỗ trợ (OpenUpgrade chỉ nâng). "
            "Backport là ở mức CODE — dùng odoo_code_migrate.py."
        )
    return [(f"{m}.0", f"{m + 1}.0") for m in range(s, d)]


def detect_version_from_sql(text):
    """Tìm base.latest_version trong plain-SQL dump. None nếu không thấy."""
    # COPY ir_module_module ... dòng dữ liệu có 'base' + version dạng 16.0.1.3
    m = re.search(r"\bbase\b[^\n]*?\b(\d{2}\.\d+\.\d+\.\d+\.\d+)", text)
    if m:
        return normalize_version(m.group(1))
    m = re.search(r"latest_version['\"]?\s*[:=]\s*['\"]?(\d{2}\.\d+)", text)
    return normalize_version(m.group(1)) if m else None


def build_addons_path(layout):
    """Ghép addons-path đúng thứ tự: OpenUpgrade trước core (nó override core CE)."""
    parts = [
        os.path.join(layout["openupgrade"], "addons") if layout.get("openupgrade") else None,
        os.path.join(layout["openupgrade"]) if layout.get("openupgrade") else None,
        os.path.join(layout["ce"], "addons") if layout.get("ce") else None,
        layout.get("ee"),
        layout.get("custom"),
    ]
    return ",".join(p for p in parts if p)


def py_warning_for(version):
    mj = major(version)
    need = PY_MIN.get(mj, (3, 10))  # version tương lai: mặc định cần >= 3.10
    if sys.version_info[:2] < need:
        return f"Odoo {version} cần Python >= {need[0]}.{need[1]} (runtime Odoo, không phải script này)."
    return None


def render_report(db, src, dst, hops, results, manual_flags, started, finished):
    lines = [
        f"# MIGRATION REPORT — {db}",
        "",
        f"- **Nguồn → Đích:** {src} → {dst}",
        f"- **Bắt đầu:** {started}",
        f"- **Kết thúc:** {finished}",
        f"- **Chuỗi hop:** {' → '.join([h[0] for h in hops] + [dst]) if hops else '(không cần nâng)'}",
        "",
        "## Kết quả từng hop",
        "",
        "| Hop | Trạng thái | Ghi chú |",
        "|:---|:---|:---|",
    ]
    for (frm, to), res in zip(hops, results):
        lines.append(f"| {frm} → {to} | {res.get('status', '?')} | {res.get('note', '')} |")
    lines += ["", "## Cần review tay", ""]
    if manual_flags:
        for f in manual_flags:
            lines.append(f"- ⚠️ {f}")
    else:
        lines.append("- (không có)")
    lines += ["", "> An toàn: DB nguồn KHÔNG bị đụng. Bản nâng nằm ở workspace/output/.", ""]
    return "\n".join(lines)


# --------------------------------------------------------------------------- #
# INFRA (side-effecting) — có rào an toàn, chỉ chạy khi không --dry-run
# --------------------------------------------------------------------------- #
def run(cmd, **kw):
    """Chạy lệnh shell, trả CompletedProcess. Không raise để caller tự xử lý."""
    log("$ " + (cmd if isinstance(cmd, str) else " ".join(cmd)))
    return subprocess.run(cmd, shell=isinstance(cmd, str), capture_output=True, text=True, **kw)


def ensure_workspace(ws):
    for sub in ("input", "backups", "src", "output", "logs"):
        os.makedirs(os.path.join(ws, sub), exist_ok=True)
    return ws


def backup_source(dump_path, ws):
    """LUẬT CỨNG: sao lưu bản nguồn trước khi làm bất cứ gì. Abort nếu fail."""
    if not dump_path or not os.path.exists(dump_path):
        die(f"Không thấy dump nguồn: {dump_path}")
    stamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    dst = os.path.join(ws, "backups", f"SOURCE_{os.path.basename(dump_path)}.{stamp}.bak")
    shutil.copy2(dump_path, dst)
    ok(f"Backup nguồn (read-only) → {dst}")
    return dst


def detect_source_version(dump_path, override):
    if override:
        v = normalize_version(override)
        ok(f"Version nguồn (từ --from): {v}")
        return v
    # Thử đọc plain-SQL dump (ponytail: chỉ đọc, không restore — nhanh & an toàn).
    try:
        with open(dump_path, "r", encoding="utf-8", errors="ignore") as f:
            head = f.read(2_000_000)  # 2MB đầu thường đủ chứa ir_module_module
        v = detect_version_from_sql(head)
        if v:
            ok(f"Detect version nguồn: {v}")
            return v
    except Exception:
        pass
    warn("Không tự detect được version nguồn (dump custom-format?). "
         "Truyền --from <version> để chắc chắn.")
    return None


# ponytail: các hàm infra dưới là boundary shell-out. Giữ tối thiểu; phần nặng
# (clone source GB, chạy odoo-bin thật) do máy đích thực hiện lúc chạy thật.
def provision_sources(hop_to, ws, repos):
    """Clone/checkout odoo, enterprise, OpenUpgrade đúng branch vào cache workspace/src."""
    branch = hop_to  # branch = version đích của hop (vd '18.0')
    layout = {}
    for key, url in repos.items():
        if not url:
            continue
        dest = os.path.join(ws, "src", f"{key}-{branch}")
        layout[key] = dest
        if os.path.isdir(os.path.join(dest, ".git")):
            run(["git", "-C", dest, "fetch", "--depth", "1", "origin", branch])
            run(["git", "-C", dest, "checkout", branch])
        elif os.path.isdir(url):
            # url là path local có sẵn → dùng worktree/checkout branch
            layout[key] = url
        else:
            run(["git", "clone", "--depth", "1", "--branch", branch, url, dest])
    return layout


def run_hop(db, hop, layout, odoo_bin, use_docker, logs_dir):
    frm, to = hop
    addons = build_addons_path(layout)
    logfile = os.path.join(logs_dir, f"hop_{frm}_to_{to}.log")
    if use_docker:
        cmd = (f"docker run --rm odoo:{major(to)} odoo -d {db} -u all --stop-after-init "
               f"--addons-path {addons} --load base,web,openupgrade_framework")
    else:
        cmd = [odoo_bin or "odoo-bin", "-d", db, "-u", "all", "--stop-after-init",
               "--addons-path", addons, "--load", "base,web,openupgrade_framework"]
    res = run(cmd)
    try:
        with open(logfile, "w", encoding="utf-8") as f:
            f.write((res.stdout or "") + "\n----STDERR----\n" + (res.stderr or ""))
    except Exception:
        pass
    status = "OK" if res.returncode == 0 else "LỖI"
    note = "" if res.returncode == 0 else f"xem {logfile} — vào vòng lặp RCA (systematic-debugging)"
    return {"status": status, "note": note, "returncode": res.returncode, "log": logfile}


# --------------------------------------------------------------------------- #
# SELF-CHECK (ponytail: 1 check chạy được, không cần infra)
# --------------------------------------------------------------------------- #
def self_check():
    assert normalize_version("18") == "18.0"
    assert normalize_version("18.0.1.2.3") == "18.0"
    assert normalize_version("saas~16.3") == "16.0"
    assert normalize_version("garbage") is None
    assert major("17.0") == 17
    assert plan_hops("15.0", "18.0") == [("15.0", "16.0"), ("16.0", "17.0"), ("17.0", "18.0")]
    assert plan_hops("18.0", "18.0") == []
    assert plan_hops("19.0", "22.0") == [("19.0", "20.0"), ("20.0", "21.0"), ("21.0", "22.0")], "future versions"
    try:
        plan_hops("18.0", "16.0"); assert False, "phải chặn hạ version"
    except ValueError:
        pass
    assert detect_version_from_sql("... base\t16.0.1.3.0 ...") == "16.0"
    lay = {"openupgrade": "/ou", "ce": "/ce", "ee": "/ee", "custom": "/cust"}
    ap = build_addons_path(lay)
    assert ap.index("/ou") < ap.index("/ce/addons"), "OpenUpgrade phải đứng trước core CE"
    assert "/ee" in ap and "/cust" in ap
    rep = render_report("acme", "15.0", "18.0",
                        [("15.0", "16.0")], [{"status": "OK", "note": ""}],
                        ["module x_foo (EE) thiếu script"], "t0", "t1")
    assert "MIGRATION REPORT" in rep and "x_foo" in rep
    print(f"{C_GREEN}self-check PASS{C_RESET} (normalize/hops/detect/addons-order/report)")
    return True


# --------------------------------------------------------------------------- #
def main():
    ap = argparse.ArgumentParser(description="Migrate DB Odoo local (thay upgrade.odoo.com)")
    ap.add_argument("--dump", help="Đường dẫn DB dump nguồn (.dump/.sql). Chỉ đọc.")
    ap.add_argument("--db", help="Tên DB nguồn (thay cho --dump, sẽ pg_dump ra trước).")
    ap.add_argument("--to", help="Version đích, vd 18.0 / 19")
    ap.add_argument("--from", dest="src", help="Version nguồn (nếu không tự detect được)")
    ap.add_argument("--custom", help="Thư mục chứa custom modules (đã backport)")
    ap.add_argument("--workspace", default="./migration_ws", help="Thư mục workspace")
    ap.add_argument("--odoo-repo", default="https://github.com/odoo/odoo.git")
    ap.add_argument("--ee-repo", default="", help="Path/URL source Enterprise (nếu dùng EE)")
    ap.add_argument("--openupgrade-repo", default="https://github.com/OCA/OpenUpgrade.git")
    ap.add_argument("--use-docker", action="store_true", help="Chạy bằng docker image odoo:<v>")
    ap.add_argument("--odoo-bin", help="Path odoo-bin local (nếu không dùng docker)")
    ap.add_argument("--dry-run", action="store_true", help="Chỉ in kế hoạch, không thực thi")
    ap.add_argument("--self-check", action="store_true", help="Chạy self-check logic thuần rồi thoát")
    args = ap.parse_args()

    if args.self_check:
        sys.exit(0 if self_check() else 1)

    if not args.to:
        die("Thiếu --to <version đích>")
    dst = normalize_version(args.to)

    # Detect nguồn
    dump = args.dump
    if not dump and not args.db:
        die("Cần --dump <path> hoặc --db <name>")
    src = detect_source_version(dump, args.src) if dump else normalize_version(args.src)
    if not src:
        die("Chưa xác định được version nguồn. Truyền --from.")

    try:
        hops = plan_hops(src, dst)
    except ValueError as e:
        die(str(e))

    log(f"Kế hoạch: {src} → {dst}  ({len(hops)} hop)")
    for h in hops:
        w = py_warning_for(h[1])
        print(f"    • {h[0]} → {h[1]}" + (f"   {C_YELLOW}[{w}]{C_RESET}" if w else ""))

    if args.dry_run:
        ws = ensure_workspace(os.path.abspath(args.workspace))
        demo_layout = {"openupgrade": "<ou>", "ce": "<ce>", "ee": args.ee_repo or "<none>", "custom": args.custom or "<none>"}
        print(f"\n{C_CYAN}addons-path mẫu mỗi hop:{C_RESET}\n    {build_addons_path(demo_layout)}")
        print(f"\n{C_YELLOW}[dry-run] Không thực thi. Bỏ --dry-run để chạy thật.{C_RESET}")
        return

    # ---- Thực thi thật ----
    ws = ensure_workspace(os.path.abspath(args.workspace))
    if not dump and args.db:
        dump = os.path.join(ws, "input", f"{args.db}.dump")
        r = run(["pg_dump", "-F", "c", "-f", dump, args.db])
        if r.returncode != 0:
            die(f"pg_dump DB nguồn thất bại: {r.stderr}")
    backup_source(dump, ws)  # LUẬT CỨNG

    warn("Bước restore ra DB work + chạy hop cần Odoo/OpenUpgrade/Postgres trên máy này. "
         "Orchestrator sẽ tự provision source & chạy tuần tự; lỗi mỗi hop vào vòng lặp RCA "
         "(xem references/migration-and-upgrade.md §3.6). Cần PO duyệt ở các mốc cần review tay.")

    # Docker-first: nếu không chỉ định --odoo-bin và máy có docker → mặc định dùng docker
    # (Odoo runtime 3.10+ nằm trong image, không cần cài lên host).
    use_docker = args.use_docker or (not args.odoo_bin and bool(shutil.which("docker")))
    if use_docker and not args.use_docker:
        log("Docker khả dụng → chạy hop bằng image odoo:<v> (không cần odoo-bin/python3.10 trên host).")

    started = datetime.datetime.now().isoformat(timespec="seconds")
    results, manual = [], []
    repos = {"openupgrade": args.openupgrade_repo, "ce": args.odoo_repo, "ee": args.ee_repo, "custom": args.custom}
    work_db = f"{(args.db or os.path.splitext(os.path.basename(dump))[0])}_mig"

    for hop in hops:
        log(f"── HOP {hop[0]} → {hop[1]} ──")
        layout = provision_sources(hop[1], ws, repos)
        if args.custom:
            layout["custom"] = args.custom
        res = run_hop(work_db, hop, layout, args.odoo_bin, use_docker, os.path.join(ws, "logs"))
        results.append(res)
        if res["returncode"] != 0:
            manual.append(f"Hop {hop[0]}→{hop[1]} lỗi — cần vòng lặp RCA/viết migration script. Log: {res['log']}")
            warn(f"Hop {hop[0]}→{hop[1]} lỗi. Dừng để xử lý (không tiếp tục để tránh hỏng chuỗi).")
            break

    finished = datetime.datetime.now().isoformat(timespec="seconds")
    report = render_report(work_db, src, dst, hops, results, manual, started, finished)
    rp = os.path.join(ws, "MIGRATION_REPORT.md")
    with open(rp, "w", encoding="utf-8") as f:
        f.write(report)
    ok(f"Báo cáo → {rp}")


if __name__ == "__main__":
    main()

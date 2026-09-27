#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
odoo_code_migrate.py — Backport/nâng CODE custom module giữa các version Odoo.

Tự rewrite phần MÁY MÓC CHẮC CHẮN (t-raw→t-out, attrs đơn giản→thuộc tính trực
tiếp), FLAG phần mơ hồ cho người (attrs phức tạp, _sql_constraints, index=True,
states=, <tree>...). Dùng chung bảng luật version với odoo_linter.py qua
odoo_version_rules.py (DRY). Xem references/code-backport-and-refactor.md.

Mặc định --dry-run (chỉ xem trước). Thêm --write để áp vào file (nên commit/backup
trước). `python odoo_code_migrate.py --self-check` để kiểm logic thuần.

Ví dụ:
    python odoo_code_migrate.py --path ./acme_sale --from 16 --to 17           # preview
    python odoo_code_migrate.py --path ./acme_sale --from 16 --to 17 --write   # áp
"""
from __future__ import annotations

import argparse
import ast
import os
import re
import sys

try:
    from odoo_version_rules import rules_between
except ImportError:  # khi chạy ngoài thư mục scripts
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    from odoo_version_rules import rules_between

C_RED = "\033[91m"; C_GREEN = "\033[92m"; C_YELLOW = "\033[93m"; C_CYAN = "\033[96m"; C_RESET = "\033[0m"


# --------------------------------------------------------------------------- #
# CORE: chuyển Odoo domain → biểu thức Python (cho attrs → thuộc tính trực tiếp)
# --------------------------------------------------------------------------- #
def _leaf_to_expr(field, op, val):
    # Idiom Odoo hay gặp: so với False = kiểm falsy/truthy.
    if op == "=" and val is False:
        return f"not {field}"
    if op in ("!=", "<>") and val is False:
        return f"{field}"
    py_op = {"=": "==", "==": "==", "!=": "!=", "<>": "!=",
             ">": ">", ">=": ">=", "<": "<", "<=": "<=",
             "in": "in", "not in": "not in"}.get(op)
    if py_op is None:
        raise ValueError(f"toán tử domain chưa hỗ trợ: {op}")
    return f"{field} {py_op} {val!r}"


def domain_to_expr(domain):
    """Domain Odoo (prefix notation, implicit AND) → chuỗi biểu thức Python.
    Raise nếu cấu trúc quá phức tạp → caller sẽ FLAG thay vì rewrite sai."""
    if not isinstance(domain, list) or not domain:
        raise ValueError("domain rỗng/không phải list")
    tokens = list(domain)
    pos = [0]

    def parse_one():
        if pos[0] >= len(tokens):
            raise ValueError("domain thiếu toán hạng")
        tok = tokens[pos[0]]; pos[0] += 1
        if tok in ("&", "|"):
            a = parse_one(); b = parse_one()
            joiner = "and" if tok == "&" else "or"
            return f"({a} {joiner} {b})"
        if tok == "!":
            a = parse_one()
            return f"(not {a})"
        if isinstance(tok, (list, tuple)) and len(tok) == 3:
            return _leaf_to_expr(tok[0], tok[1], tok[2])
        raise ValueError(f"token domain lạ: {tok!r}")

    exprs = []
    while pos[0] < len(tokens):
        exprs.append(parse_one())
    # Nhiều biểu thức top-level không có toán tử = implicit AND.
    return exprs[0] if len(exprs) == 1 else "(" + " and ".join(exprs) + ")"


def _extract_attrs_value(attr_text):
    """Lấy nội dung dict trong attrs="...". Trả về (dict_literal_str, quote_char)."""
    m = re.search(r'attrs\s*=\s*(["\'])(.*?)\1', attr_text, re.DOTALL)
    if not m:
        return None, None
    return m.group(2), m.group(1)


def convert_attrs(attr_text):
    """attrs="{'invisible': [...]}" → 'invisible="..." readonly="..."'.
    Trả (new_text, ok). ok=False → không tự chuyển được (FLAG, giữ nguyên)."""
    dict_str, _ = _extract_attrs_value(attr_text)
    if dict_str is None:
        return attr_text, False
    try:
        d = ast.literal_eval(dict_str.strip())
        if not isinstance(d, dict):
            return attr_text, False
        pieces = []
        for key in ("invisible", "column_invisible", "readonly", "required"):
            if key in d:
                pieces.append(f'{key}="{domain_to_expr(d[key])}"')
        # Có key lạ ngoài 4 cái chuẩn → không chắc, flag.
        if set(d.keys()) - {"invisible", "column_invisible", "readonly", "required"}:
            return attr_text, False
        if not pieces:
            return attr_text, False
        new = re.sub(r'attrs\s*=\s*(["\']).*?\1', " ".join(pieces), attr_text, count=1, flags=re.DOTALL)
        return new, True
    except (ValueError, SyntaxError):
        return attr_text, False


def rewrite_line(line, active_ids):
    """Rewrite 1 dòng theo rules đang active. Trả (new_line, [changes], [flags])."""
    changes, flags = [], []
    new = line

    if "t-raw" in active_ids and re.search(r"\bt-raw\s*=", new):
        new = re.sub(r"\bt-raw(\s*=)", r"t-out\1", new)
        changes.append("t-raw → t-out")

    if "attrs" in active_ids and re.search(r'\battrs\s*=\s*["\']', new):
        converted, ok = convert_attrs(new)
        if ok:
            new = converted
            changes.append("attrs → thuộc tính trực tiếp")
        else:
            flags.append("attrs phức tạp — chuyển tay (nhiều điều kiện / key lạ)")

    # Các rule chỉ FLAG (không auto rewrite vì rủi ro đổi hành vi).
    flag_only = {
        "sql_constraints": (r"_sql_constraints\s*=", "_sql_constraints → models.Constraint()"),
        "index_true": (r"index\s*=\s*True", "index=True → models.Index()"),
        "states_attr": (r"\bstates\s*=\s*[\"']", "states= → invisible/readonly theo state"),
        "osv": (r"\bodoo\.osv\b", "odoo.osv → models.Model"),
        "tree_tag": (r"<tree\b", "<tree> → <list> (v18+)"),
    }
    for rid, (pat, hint) in flag_only.items():
        if rid in active_ids and re.search(pat, new):
            flags.append(hint)

    return new, changes, flags


# --------------------------------------------------------------------------- #
def process_file(path, active_ids, write):
    try:
        with open(path, encoding="utf-8", errors="ignore") as f:
            lines = f.readlines()
    except Exception:
        return 0, []
    n_changed, file_flags, out = 0, [], []
    for i, line in enumerate(lines):
        new, changes, flags = rewrite_line(line, active_ids)
        if new != line:
            n_changed += 1
            print(f"  {C_GREEN}~{C_RESET} {os.path.basename(path)}:{i+1}  {', '.join(changes)}")
        for fl in flags:
            file_flags.append((i + 1, fl))
            print(f"  {C_YELLOW}⚑{C_RESET} {os.path.basename(path)}:{i+1}  {fl}")
        out.append(new)
    if write and n_changed:
        with open(path, "w", encoding="utf-8") as f:
            f.writelines(out)
    return n_changed, file_flags


def active_ids_for(frm, to):
    ids = {r["id"] for r in rules_between(frm, to)}
    return ids


def main():
    ap = argparse.ArgumentParser(description="Backport/nâng code custom Odoo giữa version")
    ap.add_argument("--path", help="Thư mục module")
    ap.add_argument("--from", dest="frm", type=int, help="Version nguồn (vd 16)")
    ap.add_argument("--to", type=int, help="Version đích (vd 17)")
    ap.add_argument("--write", action="store_true", help="Áp thay đổi vào file (mặc định chỉ preview)")
    ap.add_argument("--self-check", action="store_true")
    args = ap.parse_args()

    if args.self_check:
        sys.exit(0 if self_check() else 1)

    if not (args.path and args.frm and args.to):
        ap.error("cần --path, --from, --to")

    ids = active_ids_for(args.frm, args.to)
    print(f"{C_CYAN}Backport {args.frm}.0 → {args.to}.0 — rules kích hoạt:{C_RESET} {', '.join(sorted(ids)) or '(không có)'}")
    if not ids:
        print("Không có deprecation nào giữa 2 version này. Xong.")
        return
    if not args.write:
        print(f"{C_YELLOW}[preview] Thêm --write để áp. Backup/commit trước khi --write.{C_RESET}")

    total, all_flags = 0, 0
    for root, _, files in os.walk(args.path):
        for fn in files:
            if fn.endswith((".py", ".xml")):
                nc, flags = process_file(os.path.join(root, fn), ids, args.write)
                total += nc
                all_flags += len(flags)
    print(f"\n{C_GREEN}{total} dòng {'đã sửa' if args.write else 'sẽ sửa'}{C_RESET}, "
          f"{C_YELLOW}{all_flags} chỗ cần chuyển tay{C_RESET}.")
    print("Sau khi --write: chạy lại `odoo_linter.py --path <mod> --version <to>` để kiểm.")


# --------------------------------------------------------------------------- #
def self_check():
    # domain_to_expr
    assert domain_to_expr([("state", "=", "done")]) == "state == 'done'"
    assert domain_to_expr([("active", "=", False)]) == "not active"
    assert domain_to_expr([("partner_id", "!=", False)]) == "partner_id"
    assert domain_to_expr([("a", "=", 1), ("b", "!=", 2)]) == "(a == 1 and b != 2)"
    assert domain_to_expr(["|", ("a", "=", 1), ("b", "=", 2)]) == "(a == 1 or b == 2)"
    assert domain_to_expr([("s", "in", ["a", "b"])] ) == "s in ['a', 'b']"
    try:
        domain_to_expr([("a", "like", "x")]); assert False
    except ValueError:
        pass

    # convert_attrs — đơn giản OK
    line = '<field name="x" attrs="{\'invisible\': [(\'state\', \'=\', \'done\')]}"/>'
    new, ok = convert_attrs(line)
    assert ok and 'invisible="state == \'done\'"' in new and "attrs" not in new, new

    # convert_attrs — nhiều key
    line2 = "<field name=\"y\" attrs=\"{'invisible': [('a','=',1)], 'required': [('b','!=',False)]}\"/>"
    new2, ok2 = convert_attrs(line2)
    assert ok2 and 'invisible="a == 1"' in new2 and 'required="b"' in new2, new2

    # convert_attrs — phức tạp (toán tử like) → flag (ok=False, giữ nguyên)
    line3 = "<field name=\"z\" attrs=\"{'invisible': [('name','like','x')]}\"/>"
    new3, ok3 = convert_attrs(line3)
    assert not ok3 and new3 == line3, new3

    # rewrite_line — t-raw auto khi nâng lên 15+
    ids = active_ids_for(14, 15)
    nl, ch, fl = rewrite_line('<span t-raw="rec.name"/>', ids)
    assert 't-out="rec.name"' in nl and ch, (nl, ch)

    # rewrite_line — sql_constraints chỉ FLAG khi nâng lên 18
    ids2 = active_ids_for(17, 18)
    _, ch2, fl2 = rewrite_line("    _sql_constraints = [('u','unique(x)','msg')]", ids2)
    assert not ch2 and any("Constraint" in f for f in fl2), fl2

    print(f"{C_GREEN}self-check PASS{C_RESET} (domain→expr / attrs convert / t-raw auto / flag-only)")
    return True


if __name__ == "__main__":
    main()

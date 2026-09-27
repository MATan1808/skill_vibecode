#!/usr/bin/env python3
"""Kiểm tra 1 plugin Hermes đã đúng cấu trúc/contract tối thiểu chưa.

Không thay thế test thật (hermes gateway restart) — chỉ bắt lỗi cấu trúc rẻ trước khi test.

Usage:
    python hermes_plugin_linter.py --path ./plugins/platforms/my_platform
    python hermes_plugin_linter.py --self-check
"""
import argparse
import ast
import os
import sys
import tempfile
import shutil

REQUIRED_PLATFORM_METHODS = {"connect", "disconnect", "send", "get_chat_info"}


def _find_py_files(path: str) -> list:
    return [os.path.join(path, f) for f in os.listdir(path) if f.endswith(".py")]


def _parse(path: str):
    with open(path, encoding="utf-8") as f:
        return ast.parse(f.read(), filename=path)


def lint(path: str) -> list:
    """Trả về list các lỗi (string). Rỗng = sạch."""
    errors = []

    if not os.path.isdir(path):
        return [f"Không tìm thấy thư mục plugin: {path}"]

    yaml_path = os.path.join(path, "plugin.yaml")
    if not os.path.isfile(yaml_path):
        errors.append("Thiếu plugin.yaml")
    else:
        with open(yaml_path, encoding="utf-8") as f:
            yaml_text = f.read()
        for key in ("name:", "kind:", "version:"):
            if key not in yaml_text:
                errors.append(f"plugin.yaml thiếu field bắt buộc '{key.rstrip(':')}'")

    init_path = os.path.join(path, "__init__.py")
    has_register_export = False
    if not os.path.isfile(init_path):
        errors.append("Thiếu __init__.py")
    else:
        with open(init_path, encoding="utf-8") as f:
            init_text = f.read()
        if "register" not in init_text:
            errors.append("__init__.py không export 'register' — Hermes plugin loader cần entry point này")
        else:
            has_register_export = True

    py_files = _find_py_files(path)
    all_source = ""
    for f in py_files:
        with open(f, encoding="utf-8") as fh:
            all_source += fh.read() + "\n"

    if "def register(ctx)" not in all_source and "def register(ctx" not in all_source:
        errors.append("Không tìm thấy hàm register(ctx) trong bất kỳ file .py nào")

    kind = None
    if os.path.isfile(yaml_path):
        for line in open(yaml_path, encoding="utf-8"):
            line = line.strip()
            if line.startswith("kind:"):
                kind = line.split(":", 1)[1].strip()
                break

    if kind == "platform":
        if "BasePlatformAdapter" not in all_source:
            errors.append("kind=platform nhưng không thấy kế thừa BasePlatformAdapter")
        if "ctx.register_platform(" not in all_source:
            errors.append("kind=platform nhưng không thấy gọi ctx.register_platform(...)")
        found_methods = set()
        for f in py_files:
            try:
                tree = _parse(f)
            except SyntaxError as e:
                errors.append(f"Lỗi cú pháp Python ở {f}: {e}")
                continue
            for node in ast.walk(tree):
                if isinstance(node, ast.AsyncFunctionDef):
                    found_methods.add(node.name)
        missing = REQUIRED_PLATFORM_METHODS - found_methods
        if missing:
            errors.append(f"Thiếu async method bắt buộc của BasePlatformAdapter: {sorted(missing)}")

    elif kind == "tool":
        if "ctx.register_tool(" not in all_source:
            errors.append("kind=tool nhưng không thấy gọi ctx.register_tool(...)")
        if "json.dumps" not in all_source:
            errors.append("kind=tool nhưng không thấy json.dumps(...) — handler phải trả JSON string")
        if "raise " in all_source and "except" not in all_source:
            errors.append("Có 'raise' nhưng không thấy 'except' tương ứng — handler tool không được để lộ exception ra ngoài registry")

    elif kind in ("model-provider", "memory-provider", "context-engine"):
        if "register_provider" not in all_source and "register_" not in all_source:
            errors.append(f"kind={kind} nhưng không thấy gọi register_provider(...) hoặc hàm register tương ứng")

    return errors


def self_check() -> bool:
    tmp = tempfile.mkdtemp(prefix="hermes_plugin_lint_")
    try:
        # Case 1: plugin hợp lệ tối thiểu (kind=tool) — kỳ vọng 0 lỗi
        good = os.path.join(tmp, "good_tool")
        os.makedirs(good)
        with open(os.path.join(good, "plugin.yaml"), "w") as f:
            f.write("name: good_tool\nkind: tool\nversion: 1.0.0\n")
        with open(os.path.join(good, "__init__.py"), "w") as f:
            f.write("from .tools import register\n")
        with open(os.path.join(good, "tools.py"), "w") as f:
            f.write(
                "import json\n"
                "def handler(args, **kw):\n"
                "    try:\n"
                "        return json.dumps({'ok': True})\n"
                "    except Exception as e:\n"
                "        return json.dumps({'error': str(e)})\n\n"
                "def register(ctx):\n"
                "    ctx.register_tool(name='good_tool', toolset='t', schema={}, handler=handler)\n"
            )
        errs_good = lint(good)
        if errs_good:
            print(f"FAIL: plugin hợp lệ nhưng bị báo lỗi: {errs_good}")
            return False

        # Case 2: plugin thiếu mọi thứ — kỳ vọng có lỗi
        bad = os.path.join(tmp, "bad_platform")
        os.makedirs(bad)
        with open(os.path.join(bad, "plugin.yaml"), "w") as f:
            f.write("name: bad_platform\nkind: platform\nversion: 1.0.0\n")
        # Không có __init__.py, không có adapter.py
        errs_bad = lint(bad)
        if not errs_bad:
            print("FAIL: plugin thiếu __init__.py/adapter.py nhưng không bị báo lỗi nào")
            return False

        print(f"OK: plugin hợp lệ → 0 lỗi; plugin thiếu file → {len(errs_bad)} lỗi được phát hiện")
        return True
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--path")
    parser.add_argument("--self-check", action="store_true")
    args = parser.parse_args()

    if args.self_check:
        sys.exit(0 if self_check() else 1)

    if not args.path:
        parser.error("--path bắt buộc (hoặc dùng --self-check)")

    errors = lint(args.path)
    if not errors:
        print(f"OK: {args.path} — không phát hiện lỗi cấu trúc cơ bản.")
        sys.exit(0)
    print(f"Phát hiện {len(errors)} vấn đề tại {args.path}:")
    for e in errors:
        print(f"  - {e}")
    sys.exit(1)


if __name__ == "__main__":
    main()

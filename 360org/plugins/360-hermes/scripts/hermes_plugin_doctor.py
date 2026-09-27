#!/usr/bin/env python3
"""Chẩn đoán nhanh vì sao 1 plugin Hermes không load / không hoạt động.

Chạy các kiểm tra tĩnh (không cần Hermes thật đang chạy) rồi gợi ý lệnh
verify tiếp theo trên server thật. Xem thêm references/debugging-and-operations.md.

Usage:
    python hermes_plugin_doctor.py --path ./plugins/platforms/my_platform
    python hermes_plugin_doctor.py --self-check
"""
import argparse
import os
import re
import sys
import tempfile
import shutil

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, SCRIPT_DIR)
from hermes_plugin_linter import lint  # noqa: E402


NEXT_STEPS = [
    "HERMES_PLUGINS_DEBUG=1 hermes plugins list   # xác nhận plugin được discover, xem lỗi import thật",
    "hermes [-p <profile>] gateway restart        # nạp lại plugin",
    "tail -f data/profiles/<profile>/logs/gateway.log   # log thật, KHÔNG phải agent.log",
]


def diagnose(path: str) -> dict:
    """Trả về dict {structural_errors, warnings, next_steps}."""
    result = {"structural_errors": [], "warnings": [], "next_steps": list(NEXT_STEPS)}

    result["structural_errors"] = lint(path)

    if not os.path.isdir(path):
        return result

    yaml_path = os.path.join(path, "plugin.yaml")
    env_names = []
    if os.path.isfile(yaml_path):
        with open(yaml_path, encoding="utf-8") as f:
            yaml_text = f.read()
        # Chỉ xét requires_env (bắt buộc) — optional_env thiếu là bình thường, không phải bug.
        block_match = re.search(r"requires_env:(.*?)(?:\noptional_env:|\Z)", yaml_text, re.DOTALL)
        if block_match:
            block = block_match.group(1)
            env_names = re.findall(r"(?:^|\n)\s*-\s*(?:name:\s*)?([A-Z][A-Z0-9_]*)", block)

    # Gotcha 1: file .env cùng cấp không chứa các biến plugin.yaml khai báo
    profile_env = None
    # path thường là data/profiles/<profile>/plugins/{platforms,tools}/<name>/ → .env cách 3 cấp lên
    parent = os.path.dirname(os.path.dirname(os.path.dirname(path)))
    candidate = os.path.join(parent, ".env")
    if os.path.isfile(candidate):
        profile_env = candidate
    if profile_env and env_names:
        with open(profile_env, encoding="utf-8") as f:
            env_text = f.read()
        missing_env = [e for e in env_names if e not in env_text]
        if missing_env:
            result["warnings"].append(
                f".env tại {profile_env} thiếu biến khai trong plugin.yaml: {missing_env} "
                "(kiểm tra đúng profile — mỗi profile có .env riêng, xem debugging-and-operations.md §3)"
            )

    # Gotcha 2: __pycache__ hoặc .swp còn sót — dấu hiệu file chưa save/cũ
    leftovers = [f for f in os.listdir(path) if f.endswith(".swp") or f == "__pycache__"]
    if leftovers:
        result["warnings"].append(f"Có file rác/tạm còn sót: {leftovers} — kiểm tra file .py đã save đúng bản mới nhất chưa")

    # Gotcha 3: platform adapter giữ token nhưng không thấy token lock
    py_source = ""
    for f in os.listdir(path):
        if f.endswith(".py"):
            with open(os.path.join(path, f), encoding="utf-8") as fh:
                py_source += fh.read()
    if "BasePlatformAdapter" in py_source and "acquire_scoped_lock" not in py_source:
        result["warnings"].append(
            "Platform adapter giữ credential nhưng không thấy acquire_scoped_lock() — "
            "rủi ro 2 profile share cùng token gây double-reply (xem platform-adapters.md §Token Lock)"
        )

    # Gotcha 4: so sánh self.uid trực tiếp với author_id/user_id nhận từ backend ngoài — dấu hiệu sai không gian ID
    if re.search(r"==\s*self\.uid\b", py_source) and "partner_id" not in py_source:
        result["warnings"].append(
            "Thấy so sánh trực tiếp '== self.uid' để chống lặp bot mà không resolve partner_id/actor_id riêng — "
            "nếu backend ngoài có 2 khái niệm user khác nhau (vd Odoo res.users vs res.partner), so sánh này có thể luôn sai "
            "(xem debugging-and-operations.md §4)"
        )

    return result


def print_report(result: dict, path: str):
    print(f"=== Chẩn đoán plugin: {path} ===\n")
    if result["structural_errors"]:
        print(f"❌ {len(result['structural_errors'])} lỗi cấu trúc:")
        for e in result["structural_errors"]:
            print(f"   - {e}")
    else:
        print("✅ Không phát hiện lỗi cấu trúc cơ bản.")

    if result["warnings"]:
        print(f"\n⚠️  {len(result['warnings'])} cảnh báo (không chắc là lỗi, cần xem xét):")
        for w in result["warnings"]:
            print(f"   - {w}")

    print("\n📋 Bước verify tiếp theo trên server thật:")
    for step in result["next_steps"]:
        print(f"   $ {step}")


def self_check() -> bool:
    tmp = tempfile.mkdtemp(prefix="hermes_plugin_doctor_")
    try:
        plugin_dir = os.path.join(tmp, "data", "profiles", "testprofile", "plugins", "platforms", "buggy")
        os.makedirs(plugin_dir)
        with open(os.path.join(plugin_dir, "plugin.yaml"), "w") as f:
            f.write("name: buggy\nkind: platform\nversion: 1.0.0\nrequires_env:\n  - name: BUGGY_TOKEN\n")
        with open(os.path.join(plugin_dir, "__init__.py"), "w") as f:
            f.write("from .adapter import register\n")
        with open(os.path.join(plugin_dir, "adapter.py"), "w") as f:
            f.write(
                "from gateway.platforms.base import BasePlatformAdapter\n"
                "class BuggyAdapter(BasePlatformAdapter):\n"
                "    async def connect(self, *, is_reconnect=False):\n"
                "        return author_id == self.uid\n"
                "    async def disconnect(self): pass\n"
                "    async def send(self, chat_id, content): pass\n"
                "    async def get_chat_info(self, chat_id): return {}\n"
                "def register(ctx):\n"
                "    ctx.register_platform(name='buggy')\n"
            )
        # .env cố tình thiếu BUGGY_TOKEN
        profile_dir = os.path.join(tmp, "data", "profiles", "testprofile")
        with open(os.path.join(profile_dir, ".env"), "w") as f:
            f.write("OTHER_VAR=1\n")

        result = diagnose(plugin_dir)
        if result["structural_errors"]:
            print(f"FAIL: fixture đáng lẽ hợp lệ về cấu trúc nhưng báo lỗi: {result['structural_errors']}")
            return False
        if not any("acquire_scoped_lock" in w for w in result["warnings"]):
            print(f"FAIL: không phát hiện cảnh báo thiếu token lock. warnings={result['warnings']}")
            return False
        if not any("self.uid" in w for w in result["warnings"]):
            print(f"FAIL: không phát hiện cảnh báo sai không gian ID. warnings={result['warnings']}")
            return False
        if not any("BUGGY_TOKEN" in w for w in result["warnings"]):
            print(f"FAIL: không phát hiện thiếu env var trong .env. warnings={result['warnings']}")
            return False
        print(f"OK: doctor phát hiện đủ {len(result['warnings'])} cảnh báo mong đợi trên fixture lỗi.")
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

    result = diagnose(args.path)
    print_report(result, args.path)
    sys.exit(1 if result["structural_errors"] else 0)


if __name__ == "__main__":
    main()

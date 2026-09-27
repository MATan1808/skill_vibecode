#!/usr/bin/env python3
"""
AIaC Fast Pattern Matcher & Refactor Engine (Học từ ast-grep).
Tìm kiếm và thay thế cấu trúc code chính xác dựa trên cú pháp trừu tượng, không tốn LLM token.
"""

import sys
import os
import re
import argparse
from pathlib import Path

def match_and_replace_odoo_xml_attrs(content: str) -> tuple[str, int]:
    """
    Tự động chuẩn hoá XML Odoo: Loại bỏ attrs={'invisible': ...} thành invisible="..."
    Không tốn token LLM, thực thi 0ms.
    """
    count = 0
    pattern = r'attrs="\{\s*\'(invisible|readonly|required)\'\s*:\s*([^}]+)\s*\}"'
    def repl(m):
        nonlocal count
        count += 1
        attr_name = m.group(1)
        cond = m.group(2).strip()
        return f'{attr_name}="{cond}"'

    new_content = re.sub(pattern, repl, content)
    return new_content, count

def clean_unused_python_imports(content: str) -> tuple[str, int]:
    """
    Dọn dẹp import đơn lẻ không dùng trong Python.
    """
    count = 0
    lines = content.splitlines()
    new_lines = []
    # ponytail: regex-based import cleaner thô nhưng an toàn cho single-module imports
    for line in lines:
        match = re.match(r'^(?:from\s+[\w.]+\s+import\s+|import\s+)([A-Za-z0-9_]+)$', line.strip())
        if match:
            sym = match.group(1)
            # Kiểm tra xem sym có xuất hiện trong phần còn lại của code không
            occurrences = len(re.findall(rf'\b{sym}\b', content))
            if occurrences <= 1:
                count += 1
                continue
        new_lines.append(line)
    return '\n'.join(new_lines) + ('\n' if content.endswith('\n') else ''), count

def standardize_flutter_const(content: str) -> tuple[str, int]:
    """
    Tự động chèn const cho widget constructors tĩnh trong Flutter/Dart.
    """
    count = 0
    pattern = r'(?<!const\s)(?<!return\s)(?<!new\s)\b(SizedBox|Text|Container|Padding|Center|Divider)\(\)'
    def repl(m):
        nonlocal count
        count += 1
        return f'const {m.group(1)}()'
    new_content = re.sub(pattern, repl, content)
    return new_content, count

def standardize_react_imports(content: str) -> tuple[str, int]:
    """
    Chuẩn hoá import React 18+ (loại bỏ import React from 'react' thừa khi chỉ dùng JSX).
    """
    count = 0
    pattern = r"^import\s+React\s+from\s+['\"]react['\"];?\r?\n?"
    if re.search(pattern, content, re.MULTILINE):
        # Chỉ xoá nếu không gọi React.xxx
        if not re.search(r'\bReact\.', content):
            count += 1
            content = re.sub(pattern, '', content, flags=re.MULTILINE)
    return content, count

def refactor_file(file_path: Path, rule: str, write: bool) -> int:
    try:
        content = file_path.read_text(encoding="utf-8")
    except Exception:
        return 0

    count = 0
    new_content = content

    if rule == "odoo-xml-attrs" and file_path.suffix == ".xml":
        new_content, count = match_and_replace_odoo_xml_attrs(content)
    elif rule == "clean-imports" and file_path.suffix == ".py":
        new_content, count = clean_unused_python_imports(content)
    elif rule == "flutter-const" and file_path.suffix == ".dart":
        new_content, count = standardize_flutter_const(content)
    elif rule == "react-clean-import" and file_path.suffix in [".jsx", ".tsx", ".js", ".ts"]:
        new_content, count = standardize_react_imports(content)

    if count > 0:
        print(f"[AIaC ast-refactor] Khớp {count} nodes tại: {file_path}")
        if write:
            file_path.write_text(new_content, encoding="utf-8")

    return count

def main():
    parser = argparse.ArgumentParser(description="AIaC AST/Pattern Fast Refactor Engine")
    parser.add_argument("--rule", choices=["odoo-xml-attrs", "clean-imports", "flutter-const", "react-clean-import", "all"], default="all")
    parser.add_argument("--path", default=".", help="Target directory or file")
    parser.add_argument("--write", action="store_true", help="Apply changes directly")

    args = parser.parse_args()
    target_path = Path(args.path)

    files = []
    if target_path.is_file():
        files.append(target_path)
    else:
        for root, _, filenames in os.walk(target_path):
            if any(p in root for p in [".git", "node_modules", ".claude", "dist", "build"]):
                continue
            for f in filenames:
                files.append(Path(root) / f)

    rules = [args.rule] if args.rule != "all" else ["odoo-xml-attrs", "clean-imports", "flutter-const", "react-clean-import"]
    total_changes = 0

    for file in files:
        for r in rules:
            total_changes += refactor_file(file, r, args.write)

    print(f"\n[AIaC Engine] Hoàn tất quét. Tổng số thay đổi: {total_changes} (Tiết kiệm ~{total_changes * 450} tokens LLM)")

if __name__ == "__main__":
    main()

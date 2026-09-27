#!/usr/bin/env python3
"""Tạo 360 Agent Map nhẹ cho Claude Code: symbol/domain index không DB, không daemon."""

from __future__ import annotations

import ast
import csv
import hashlib
import json
import os
import re
import sys
import xml.etree.ElementTree as ET
from collections import defaultdict
from pathlib import Path

ROOT = Path.cwd()
OUT_DIR = ROOT / ".claude" / "aiac" / "index"
IGNORE_DIRS = {
    ".git",
    ".claude",
    ".codegraph",
    ".dart_tool",
    ".idea",
    "node_modules",
    "dist",
    "build",
    "coverage",
    "ios",
    "android",
    "web",
    "vendor",
    "__pycache__",
}
SOURCE_EXTS = {
    ".py", ".js", ".jsx", ".ts", ".tsx", ".dart", ".php", ".rs",
    ".xml", ".csv", ".go", ".kt", ".swift", ".vue"
}
TEXT_LIMIT = 300_000


def rel(path: Path) -> str:
    return path.relative_to(ROOT).as_posix()


def walk() -> list[Path]:
    files: list[Path] = []
    for directory, dirs, names in os.walk(ROOT):
        dirs[:] = [name for name in dirs if name not in IGNORE_DIRS and not name.startswith(".")]
        base = Path(directory)
        for name in names:
            path = base / name
            if path.suffix.lower() in SOURCE_EXTS:
                files.append(path)
    return sorted(files, key=rel)


def read_text(path: Path) -> str:
    try:
        if path.stat().st_size > TEXT_LIMIT:
            return ""
        return path.read_text(encoding="utf-8", errors="ignore")
    except OSError:
        return ""


def checksum(path: Path) -> str:
    try:
        return hashlib.sha256(path.read_bytes()).hexdigest()
    except OSError:
        return ""


def add_symbol(symbols: list[dict], kind: str, name: str, path: Path, line: int, domain: str = "generic") -> None:
    if name:
        symbols.append({"kind": kind, "name": name, "file": rel(path), "line": line, "domain": domain})


def parse_python(path: Path, text: str, symbols: list[dict], domains: list[dict]) -> None:
    try:
        tree = ast.parse(text)
    except SyntaxError:
        return
    for node in ast.walk(tree):
        if isinstance(node, ast.ClassDef):
            add_symbol(symbols, "class", node.name, path, node.lineno)
        elif isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            add_symbol(symbols, "function", node.name, path, node.lineno)
        elif isinstance(node, ast.Assign):
            for target in node.targets:
                if isinstance(target, ast.Name) and target.id in {"_name", "_inherit", "_description"}:
                    value = getattr(node.value, "value", None)
                    if isinstance(value, str):
                        domains.append({"domain": "odoo", "kind": target.id, "name": value, "file": rel(path), "line": node.lineno})
                if isinstance(target, ast.Attribute) and target.attr.startswith("route"):
                    domains.append({"domain": "generic", "kind": "attribute", "name": target.attr, "file": rel(path), "line": node.lineno})
    for lineno, line in enumerate(text.splitlines(), 1):
        if re.search(r"fields\.\w+\(", line):
            name = line.split("=", 1)[0].strip()
            domains.append({"domain": "odoo", "kind": "field", "name": name, "file": rel(path), "line": lineno})
        match = re.search(r"@http\.route\(([^)]*)\)", line)
        if match:
            domains.append({"domain": "odoo", "kind": "route", "name": match.group(1)[:120], "file": rel(path), "line": lineno})


def parse_braces(path: Path, text: str, symbols: list[dict], domains: list[dict]) -> None:
    domain = "v-assistant" if "src-tauri" in path.parts or path.suffix == ".rs" else "generic"
    for lineno, line in enumerate(text.splitlines(), 1):
        for pattern, kind in [
            (r"\bclass\s+([A-Za-z_$][\w$]*)", "class"),
            (r"\bfunction\s+([A-Za-z_$][\w$]*)\s*\(", "function"),
            (r"\b(?:const|let|var)\s+([A-Z][A-Za-z0-9_$]*)\s*=\s*(?:\([^)]*\)\s*=>|function|React\.)", "component"),
            (r"\bexport\s+(?:default\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)", "function"),
            (r"\bfn\s+([A-Za-z_][\w]*)\s*\(", "function"),
            (r"\bstruct\s+([A-Za-z_][\w]*)", "class"),
            (r"\benum\s+([A-Za-z_][\w]*)", "enum"),
            (r"\btrait\s+([A-Za-z_][\w]*)", "trait"),
            (r"\btype\s+([A-Z][\w]*)\s*=", "type"),
            (r"\binterface\s+([A-Z][\w]*)", "interface"),
        ]:
            match = re.search(pattern, line)
            if match:
                add_symbol(symbols, kind, match.group(1), path, lineno, domain)
        for command in re.findall(r"invoke\(\s*['\"]([^'\"]+)['\"]", line):
            domains.append({"domain": "v-assistant", "kind": "tauri_invoke", "name": command, "file": rel(path), "line": lineno})
        if "#[tauri::command]" in line:
            domains.append({"domain": "v-assistant", "kind": "tauri_command_marker", "name": "next fn", "file": rel(path), "line": lineno})
        for hook, kind in [
            ("add_action", "wp_action"),
            ("add_filter", "wp_filter"),
            ("add_shortcode", "wp_shortcode"),
            ("register_post_type", "wp_post_type"),
            ("register_taxonomy", "wp_taxonomy"),
            ("register_rest_route", "wp_rest_route"),
        ]:
            match = re.search(rf"\b{hook}\(\s*['\"]([^'\"]+)['\"]", line)
            if match:
                domains.append({"domain": "wordpress", "kind": kind, "name": match.group(1), "file": rel(path), "line": lineno})


def parse_golang(path: Path, text: str, symbols: list[dict], domains: list[dict]) -> None:
    for lineno, line in enumerate(text.splitlines(), 1):
        for pattern, kind in [
            (r"\bfunc\s+(?:\([^)]+\)\s+)?([A-Za-z0-9_]+)\s*\(", "function"),
            (r"\btype\s+([A-Za-z0-9_]+)\s+struct\b", "struct"),
            (r"\btype\s+([A-Za-z0-9_]+)\s+interface\b", "interface"),
        ]:
            match = re.search(pattern, line)
            if match:
                add_symbol(symbols, kind, match.group(1), path, lineno, "golang")


def parse_kotlin_swift(path: Path, text: str, symbols: list[dict], domains: list[dict]) -> None:
    domain = "swift" if path.suffix == ".swift" else "kotlin"
    for lineno, line in enumerate(text.splitlines(), 1):
        for pattern, kind in [
            (r"\b(?:class|struct|object|interface)\s+([A-Za-z0-9_]+)", "class"),
            (r"\b(?:fun|func)\s+([A-Za-z0-9_]+)\s*\(", "function"),
            (r"\bprotocol\s+([A-Za-z0-9_]+)", "protocol"),
        ]:
            match = re.search(pattern, line)
            if match:
                add_symbol(symbols, kind, match.group(1), path, lineno, domain)


def parse_vue(path: Path, text: str, symbols: list[dict], domains: list[dict]) -> None:
    script_match = re.search(r"<script[^>]*>(.*?)</script>", text, re.DOTALL)
    if script_match:
        parse_braces(path, script_match.group(1), symbols, domains)
    domains.append({"domain": "vue", "kind": "sfc_component", "name": path.stem, "file": rel(path), "line": 1})


def parse_dart(path: Path, text: str, symbols: list[dict]) -> None:
    for lineno, line in enumerate(text.splitlines(), 1):
        for pattern, kind in [(r"\bclass\s+(\w+)", "class"), (r"\b(?:Future<[^>]+>|void|Widget|String|int|bool|double)\s+(\w+)\s*\(", "function")]:
            match = re.search(pattern, line)
            if match:
                add_symbol(symbols, kind, match.group(1), path, lineno, "flutter")


def parse_xml(path: Path, text: str, domains: list[dict]) -> None:
    if path.suffix.lower() != ".xml":
        return
    try:
        root = ET.fromstring(text)
    except ET.ParseError:
        return
    for node in root.iter():
        record_id = node.attrib.get("id")
        model = node.attrib.get("model")
        if node.tag.endswith("record") and record_id:
            domains.append({"domain": "odoo", "kind": f"xml_record:{model or 'unknown'}", "name": record_id, "file": rel(path), "line": 1})
        if node.tag.endswith("menuitem") and record_id:
            domains.append({"domain": "odoo", "kind": "menu", "name": record_id, "file": rel(path), "line": 1})


def parse_csv_file(path: Path, domains: list[dict]) -> None:
    if path.suffix.lower() != ".csv" or "security" not in rel(path):
        return
    try:
        with path.open(newline="", encoding="utf-8", errors="ignore") as handle:
            for lineno, row in enumerate(csv.DictReader(handle), 2):
                name = row.get("id") or row.get("name")
                if name:
                    domains.append({"domain": "odoo", "kind": "security_csv", "name": name, "file": rel(path), "line": lineno})
    except (OSError, csv.Error):
        return


def domain_counts(items: list[dict]) -> dict[str, int]:
    counts: dict[str, int] = {}
    for item in items:
        counts[item["domain"]] = counts.get(item["domain"], 0) + 1
    return dict(sorted(counts.items()))


def compute_pagerank(files: list[Path], symbols: list[dict], domains: list[dict]) -> tuple[dict[str, float], list[dict]]:
    defines = defaultdict(set)
    for sym in symbols:
        defines[sym["name"]].add(sym["file"])

    G = defaultdict(lambda: defaultdict(float))
    all_files = {rel(p) for p in files}

    for path in files:
        text = read_text(path)
        if not text:
            continue
        cur_file = rel(path)
        words = set(re.findall(r"\b[A-Za-z_][A-Za-z0-9_]{2,}\b", text))
        for ident in words:
            if ident in defines:
                for definer_file in defines[ident]:
                    if definer_file != cur_file:
                        G[cur_file][definer_file] += 1.0

    N = len(all_files)
    if N == 0:
        return {}, symbols

    d = 0.85
    ranks = {f: 1.0 / N for f in all_files}

    for _ in range(10):
        new_ranks = {}
        for node in all_files:
            rank_sum = 0.0
            for src, edges in G.items():
                if node in edges:
                    total_out = sum(edges.values())
                    if total_out > 0:
                        rank_sum += (ranks[src] * edges[node]) / total_out
            new_ranks[node] = (1.0 - d) / N + d * rank_sum
        ranks = new_ranks

    for sym in symbols:
        file_rank = ranks.get(sym["file"], 0.0)
        sym["rank"] = round(file_rank * 1000, 3)

    sorted_symbols = sorted(symbols, key=lambda s: (-s.get("rank", 0), s["file"], s["line"]))
    return ranks, sorted_symbols


def write_outputs(files: list[Path], symbols: list[dict], domains: list[dict]) -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    file_ranks, ranked_symbols = compute_pagerank(files, symbols, domains)

    data = {"schemaVersion": 2, "root": str(ROOT), "files": len(files), "symbols": ranked_symbols, "fileRanks": file_ranks, "domainSignals": domains}
    (OUT_DIR / "agent-map.json").write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (OUT_DIR / "domain-graph.json").write_text(json.dumps({"schemaVersion": 1, "counts": domain_counts(domains), "signals": domains}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    ranked_top_files = sorted(file_ranks.items(), key=lambda x: -x[1])[:12]
    feature_map = {
        "schemaVersion": 2,
        "note": "Feature map dẫn xuất từ PageRank Repo-Map của Aider kết hợp AST/domain signals.",
        "hotspots": [{"file": file, "pagerank": round(rank, 4), "signals": sum(1 for s in symbols + domains if s.get("file") == file)} for file, rank in ranked_top_files],
    }
    (OUT_DIR / "feature-map.json").write_text(json.dumps(feature_map, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (OUT_DIR / "checksums.json").write_text(json.dumps({rel(path): checksum(path) for path in files}, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8")

    lines = [
        "### 360 Agent Map (PageRank Enabled)",
        "",
        f"- Nguồn: {len(files)} tệp; {len(symbols)} symbol; {len(domains)} tín hiệu domain.",
        "- Thuật toán: PageRank Reference Graph (Học từ Aider) định tuyến chính xác file trọng tâm.",
        "- Quy tắc: Đọc symbol có rank cao trước; chống nạp lan man.",
        "",
        "#### Domain signals",
    ]
    counts = domain_counts(domains)
    if counts:
        lines.extend(f"- {name}: {count}" for name, count in counts.items())
    else:
        lines.append("- Chưa có tín hiệu domain chuyên biệt.")
    lines.extend(["", "#### Hotspots (Ranked by PageRank)"])
    for file, rank in ranked_top_files:
        signals_cnt = sum(1 for s in symbols + domains if s.get("file") == file)
        lines.append(f"- `{file}` (PageRank: {round(rank*100, 2)}%, {signals_cnt} signals)")
    lines.extend(["", "#### Top Symbols (Độ ưu tiên cao nhất)"])
    for item in ranked_symbols[:25]:
        lines.append(f"- `{item['name']}` ({item['kind']}, rank: {item.get('rank', 0)}) — `{item['file']}:{item['line']}`")
    lines.append("")
    (OUT_DIR / "agent-map.md").write_text("\n".join(lines), encoding="utf-8")


def main() -> int:
    files = walk()
    symbols: list[dict] = []
    domains: list[dict] = []
    for path in files:
        text = read_text(path)
        if not text:
            continue
        suffix = path.suffix.lower()
        if suffix == ".py":
            parse_python(path, text, symbols, domains)
        elif suffix in {".js", ".jsx", ".ts", ".tsx", ".php", ".rs"}:
            parse_braces(path, text, symbols, domains)
        elif suffix == ".go":
            parse_golang(path, text, symbols, domains)
        elif suffix in {".kt", ".swift"}:
            parse_kotlin_swift(path, text, symbols, domains)
        elif suffix == ".vue":
            parse_vue(path, text, symbols, domains)
        elif suffix == ".dart":
            parse_dart(path, text, symbols)
        parse_xml(path, text, domains)
        parse_csv_file(path, domains)
    write_outputs(files, symbols, domains)
    print(f"[Agent Map] {OUT_DIR / 'agent-map.md'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

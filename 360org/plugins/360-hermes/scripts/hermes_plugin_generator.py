#!/usr/bin/env python3
"""Sinh khung plugin Hermes mới (platform/tool/provider) + 7 mandatory docs.

Usage:
    python hermes_plugin_generator.py --name my_platform --kind platform --dest ./plugins/platforms/my_platform
    python hermes_plugin_generator.py --self-check
"""
import argparse
import os
import sys
import shutil
import tempfile
from datetime import date

SKILL_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TEMPLATES_DIR = os.path.join(SKILL_DIR, "templates")

MANDATORY_DOCS_SIMPLE = {
    "README.md": "# {name}\n\nPlugin Hermes loại `{kind}`.\n\nXem `IDEA.md`/`REQUIREMENTS.md`/`SPEC.md` để biết chi tiết thiết kế.\n",
    "DEPLOY_GUIDE.md": (
        "# DEPLOY_GUIDE: {name}\n\n"
        "1. Copy plugin vào `~/.hermes/plugins/{name}/` hoặc "
        "`data/profiles/<profile>/plugins/{plugins_subdir}/{name}/`.\n"
        "2. Điền env vars theo `plugin.yaml requires_env` vào `.env` của đúng profile.\n"
        "3. Bật trong `config.yaml` (`plugins.enabled` + platform/tool tương ứng `enabled: true`).\n"
        "4. `hermes [-p <profile>] gateway restart`.\n"
        "5. Verify: `HERMES_PLUGINS_DEBUG=1 hermes plugins list`, đọc `logs/gateway.log`.\n"
    ),
    "CHANGELOGS.md": "# CHANGELOGS: {name}\n\n## 0.1.0 — {date}\n\n- Khởi tạo plugin bằng hermes_plugin_generator.py.\n",
}

PLUGIN_SUBDIR = {"platform": "platforms", "tool": "tools", "provider": "model-providers"}


def _render(template_text: str, mapping: dict) -> str:
    out = template_text
    for k, v in mapping.items():
        out = out.replace("{{" + k + "}}", v)
    return out


def generate(name: str, kind: str, dest: str) -> list:
    """Sinh plugin skeleton tại dest. Trả về danh sách file đã tạo."""
    if kind not in PLUGIN_SUBDIR:
        raise ValueError(f"kind phải là platform|tool|provider, nhận '{kind}'")

    os.makedirs(dest, exist_ok=True)
    created = []

    class_name = "".join(p.capitalize() for p in name.replace("-", "_").split("_"))
    mapping = {
        "plugin_name": name,
        "platform_name": name,
        "tool_name": name,
        "toolset_name": name,
        "ClassName": class_name,
        "Display Label": name.replace("_", " ").title(),
        "Display Name": name.replace("_", " ").title(),
        "TOOL_NAME_UPPER": name.upper(),
        "PLUGIN_TOKEN": f"{name.upper()}_TOKEN",
        "PLUGIN_OPTION": f"{name.upper()}_OPTION",
        "PLUGIN_POLL_INTERVAL": f"{name.upper()}_POLL_INTERVAL",
        "PLUGIN_ALLOWED_USERS": f"{name.upper()}_ALLOWED_USERS",
        "PLUGIN_ALLOW_ALL_USERS": f"{name.upper()}_ALLOW_ALL_USERS",
        "TOOL_API_KEY": f"{name.upper()}_API_KEY",
        "Your Name": os.environ.get("USER", "unknown"),
    }
    # plugin_yaml.tmpl dùng {{platform|tool|model-provider|...}} literal cho kind — thay riêng
    kind_map = {"platform": "platform", "tool": "tool", "provider": "model-provider"}

    # 1. plugin.yaml
    with open(os.path.join(TEMPLATES_DIR, "plugin_yaml.tmpl")) as f:
        content = _render(f.read(), mapping)
    content = content.replace("{{platform|tool|model-provider|memory-provider|context-engine}}", kind_map[kind])
    out_path = os.path.join(dest, "plugin.yaml")
    with open(out_path, "w") as f:
        f.write(content)
    created.append(out_path)

    # 2. code skeleton
    if kind == "platform":
        with open(os.path.join(TEMPLATES_DIR, "adapter_platform.py.tmpl")) as f:
            content = _render(f.read(), mapping)
        out_path = os.path.join(dest, "adapter.py")
        with open(out_path, "w") as f:
            f.write(content)
        created.append(out_path)
        init_path = os.path.join(dest, "__init__.py")
        with open(init_path, "w") as f:
            f.write("from .adapter import register\n\n__all__ = [\"register\"]\n")
        created.append(init_path)
    elif kind == "tool":
        with open(os.path.join(TEMPLATES_DIR, "tool_plugin.py.tmpl")) as f:
            content = _render(f.read(), mapping)
        out_path = os.path.join(dest, "tools.py")
        with open(out_path, "w") as f:
            f.write(content)
        created.append(out_path)
        init_path = os.path.join(dest, "__init__.py")
        with open(init_path, "w") as f:
            f.write("from .tools import register\n\n__all__ = [\"register\"]\n")
        created.append(init_path)
    else:  # provider
        out_path = os.path.join(dest, "__init__.py")
        with open(out_path, "w") as f:
            f.write(
                "from providers import register_provider\n"
                "from providers.base import ProviderProfile\n\n"
                f'register_provider(ProviderProfile(\n    name="{name}",\n'
                f'    env_vars=("{name.upper()}_API_KEY",),\n'
                f'    base_url="https://api.example.com/v1",\n'
                '    auth_type="api_key",\n))\n'
            )
        created.append(out_path)

    # 3. 7 mandatory docs
    for tmpl_name in ("idea.md.tmpl", "requirements.md.tmpl", "spec.md.tmpl", "arch.md.tmpl"):
        with open(os.path.join(TEMPLATES_DIR, tmpl_name)) as f:
            content = _render(f.read(), mapping)
        out_name = tmpl_name.replace(".md.tmpl", "").upper() + ".md"
        out_path = os.path.join(dest, out_name)
        with open(out_path, "w") as f:
            f.write(content)
        created.append(out_path)

    simple_mapping = {
        "name": name, "kind": kind, "date": date.today().isoformat(),
        "plugins_subdir": PLUGIN_SUBDIR[kind],
    }
    for fname, tmpl in MANDATORY_DOCS_SIMPLE.items():
        out_path = os.path.join(dest, fname)
        with open(out_path, "w") as f:
            f.write(tmpl.format(**simple_mapping))
        created.append(out_path)

    return created


def self_check() -> bool:
    tmp = tempfile.mkdtemp(prefix="hermes_plugin_gen_")
    try:
        dest = os.path.join(tmp, "my_test_platform")
        files = generate("my_test_platform", "platform", dest)
        expected = {"plugin.yaml", "adapter.py", "__init__.py", "IDEA.md", "REQUIREMENTS.md",
                    "SPEC.md", "ARCH.md", "README.md", "DEPLOY_GUIDE.md", "CHANGELOGS.md"}
        actual = {os.path.basename(f) for f in files}
        missing = expected - actual
        if missing:
            print(f"FAIL: thiếu file {missing}")
            return False
        for f in files:
            if not os.path.isfile(f) or os.path.getsize(f) == 0:
                print(f"FAIL: file rỗng hoặc không tồn tại: {f}")
                return False
        print(f"OK: sinh đủ {len(files)} file, đúng 7 mandatory docs + plugin.yaml + adapter.py + __init__.py")
        return True
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--name")
    parser.add_argument("--kind", choices=["platform", "tool", "provider"])
    parser.add_argument("--dest")
    parser.add_argument("--self-check", action="store_true")
    args = parser.parse_args()

    if args.self_check:
        sys.exit(0 if self_check() else 1)

    if not (args.name and args.kind and args.dest):
        parser.error("--name, --kind, --dest đều bắt buộc (hoặc dùng --self-check)")

    created = generate(args.name, args.kind, args.dest)
    print(f"Đã sinh plugin '{args.name}' ({args.kind}) tại {args.dest}:")
    for f in created:
        print(f"  - {f}")


if __name__ == "__main__":
    main()

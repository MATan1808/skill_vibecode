#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Cài đặt & kiểm tra bộ odoo-dev-skills cho ĐỦ 8 harness: Claude Code, Codex,
Gemini CLI, GitHub Copilot (VSCode), OpenClaw, Hermes, Paperclip, Google
Antigravity. Kèm preflight kiểm dependency để "không bị miss dependencies".
Chỉ dùng stdlib — chạy được ngay sau khi copy folder.

Cách dùng:
    python scripts/install.py            # cài vào các harness phát hiện được + preflight
    python scripts/install.py --check    # chỉ preflight (không đụng gì)
    python scripts/install.py --into /path/to/odoo-project   # thả AGENTS.md + copilot-instructions vào 1 project
"""
import os
import sys
import json
import shutil
import subprocess

C_RED = "\033[91m"; C_GREEN = "\033[92m"; C_YELLOW = "\033[93m"; C_CYAN = "\033[96m"; C_RESET = "\033[0m"

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT = os.path.dirname(SCRIPT_DIR)
HOME = os.path.expanduser("~")


def _print_header(msg):
    print(f"\n{C_CYAN}== {msg} =={C_RESET}")


def _ok(msg):
    print(f"  {C_GREEN}[OK]{C_RESET} {msg}")


def _warn(msg):
    print(f"  {C_YELLOW}[!]{C_RESET} {msg}")


def _fail(msg):
    print(f"  {C_RED}[X]{C_RESET} {msg}")


def _which(name):
    return shutil.which(name)


def _cmd_version(args):
    try:
        out = subprocess.run(args, capture_output=True, text=True, timeout=8)
        return (out.stdout + out.stderr).strip().splitlines()[0]
    except Exception:
        return None


# --------------------------------------------------------------------------- #
# Preflight: kiểm dependency runtime
# --------------------------------------------------------------------------- #
def preflight():
    """Kiểm dependency theo mô hình DOCKER-FIRST.

    Script orchestrator chạy trên HOST (chỉ cần python >=3.8, tương thích 3.9).
    Odoo runtime (3.10+) và postgres client KHÔNG cần cài lên host — chúng nằm
    TRONG container. Chỉ khi KHÔNG dùng Docker mới cần cài lên host.
    """
    _print_header("Preflight — kiểm dependency (Docker-first)")
    ok = True
    has_docker = bool(_which("docker"))

    # 1) Python trên HOST: chỉ để chạy script orchestrator (không phải runtime Odoo).
    if sys.version_info >= (3, 8):
        _ok(f"python host {sys.version.split()[0]} — đủ để chạy orchestrator (runtime Odoo 3.10+ nằm trong Docker).")
    else:
        _fail(f"python host {sys.version.split()[0]} quá cũ để chạy script — cần >= 3.8.")
        ok = False

    # 2) git — bắt buộc trên host (clone OpenUpgrade/Odoo source, git workflow).
    if _which("git"):
        _ok(_cmd_version(["git", "--version"]) or "git")
    else:
        _fail("git chưa cài — cần cho migrate (clone OpenUpgrade/Odoo) + git workflow. `brew install git`.")
        ok = False

    # 3) Runtime Odoo + postgres client: ưu tiên Docker.
    if has_docker:
        _ok(f"{_cmd_version(['docker', '--version']) or 'docker'} — Odoo runtime (3.10+), pg_dump/psql, odoo-bin "
            "đều chạy TRONG container. Không cần cài Python 3.10/libpq/odoo-bin lên host.")
    else:
        _warn("Không thấy Docker → sẽ chạy Odoo trực tiếp trên HOST. Khi đó host cần:")
        if sys.version_info < (3, 10):
            _warn(f"  • python >= 3.10 cho Odoo 17+ (host đang {sys.version.split()[0]}). Hoặc: cài Docker để khỏi cần.")
        if not (_which("pg_dump") and _which("psql")):
            _warn("  • pg_dump/psql: `brew install libpq && brew link --force libpq`. Hoặc: cài Docker để khỏi cần.")
        if not (_which("odoo-bin") or _which("odoo")):
            _warn("  • odoo-bin trên PATH, hoặc trỏ `--odoo-bin`. Hoặc: cài Docker để khỏi cần.")

    print()
    if ok:
        extra = "" if has_docker else " (đang chạy chế độ host — xem cảnh báo [!] ở trên nếu muốn migrate/fix)"
        print(f"{C_GREEN}Preflight PASS — đủ dependency lõi.{C_RESET}{extra}")
    else:
        print(f"{C_RED}Preflight có lỗi bắt buộc — xử lý mục [X] ở trên.{C_RESET}")
    return ok


# --------------------------------------------------------------------------- #
# Wiring từng harness
# --------------------------------------------------------------------------- #
def _link_or_copy(src, dst):
    """Symlink nếu được (nhanh, đồng bộ), fallback copytree (portable tuyệt đối)."""
    parent = os.path.dirname(dst)
    os.makedirs(parent, exist_ok=True)
    if os.path.islink(dst) or os.path.exists(dst):
        if os.path.islink(dst):
            os.unlink(dst)
        elif os.path.isdir(dst):
            shutil.rmtree(dst)
        else:
            os.remove(dst)
    try:
        os.symlink(src, dst)
        return "symlink"
    except OSError:
        shutil.copytree(src, dst)
        return "copy"


def install_claude():
    _print_header("Claude Code")
    dst = os.path.join(HOME, ".claude", "skills", "odoo-dev-skills")
    how = _link_or_copy(REPO_ROOT, dst)
    _ok(f"skill wired ({how}) → {dst}")
    _warn("Plugin marketplace (tùy chọn): trong phiên Claude tương tác chạy "
          "`/plugin marketplace add " + REPO_ROOT + "` rồi `/plugin install odoo-dev-skills@odoo-dev-skills`.")


def install_gemini():
    _print_header("Gemini CLI")
    # 1) skill folder (giữ tương thích bản cũ)
    skills_dst = os.path.join(HOME, ".gemini", "config", "skills", "odoo-dev-skills")
    how = _link_or_copy(REPO_ROOT, skills_dst)
    _ok(f"skill wired ({how}) → {skills_dst}")

    # 2) extension (contextFileName = AGENTS.md)
    ext_dst = os.path.join(HOME, ".gemini", "extensions", "odoo-dev-skills")
    how2 = _link_or_copy(REPO_ROOT, ext_dst)
    _ok(f"extension wired ({how2}) → {ext_dst}")

    # 3) đăng ký MCP odoo-graph-mcp
    cfg_dir = os.path.join(HOME, ".gemini", "config")
    os.makedirs(cfg_dir, exist_ok=True)
    mcp_path = os.path.join(cfg_dir, "mcp_config.json")
    data = {"mcpServers": {}}
    if os.path.exists(mcp_path):
        try:
            with open(mcp_path, encoding="utf-8") as f:
                c = f.read().strip()
                if c:
                    data = json.loads(c)
        except Exception:
            pass
    data.setdefault("mcpServers", {})["odoo-graph-mcp"] = {
        "command": "python3",
        "args": [os.path.join(skills_dst, "scripts", "odoo_graph_mcp.py")],
    }
    with open(mcp_path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)
    _ok(f"MCP odoo-graph-mcp đăng ký → {mcp_path}")


def install_codex():
    _print_header("Codex")
    # Codex đọc AGENTS.md ở repo đang mở; global skills đặt tại ~/.codex/skills nếu có.
    base = os.path.join(HOME, ".codex")
    if os.path.isdir(base):
        dst = os.path.join(base, "skills", "odoo-dev-skills")
        how = _link_or_copy(REPO_ROOT, dst)
        _ok(f"skill wired ({how}) → {dst}")
    else:
        _warn("Chưa thấy ~/.codex. Codex tự đọc AGENTS.md khi mở project. "
              "Để dùng global: `mkdir -p ~/.codex/skills` rồi chạy lại, "
              "hoặc `python scripts/install.py --into <odoo-project>`.")


def install_copilot_hint():
    _print_header("GitHub Copilot (VSCode)")
    _warn("Copilot đọc `.github/copilot-instructions.md` TRONG repo project. "
          "Bộ này đã có sẵn file mẫu. Để áp vào 1 project Odoo: "
          "`python scripts/install.py --into <path-to-odoo-project>`.")


def install_openclaw():
    _print_header("OpenClaw")
    src = os.path.join(REPO_ROOT, ".openclaw", "skills", "odoo-dev-skills")
    if not os.path.isdir(src):
        _warn("Chưa thấy .openclaw/skills — bỏ qua.")
        return
    dst = os.path.join(HOME, ".openclaw", "skills", "odoo-dev-skills")
    how = _link_or_copy(src, dst)
    _ok(f"skill wired ({how}) → {dst}")


def install_hermes():
    _print_header("Hermes")
    # Plugin Hermes = repo root (plugin.yaml + __init__.py).
    base = os.path.join(HOME, ".hermes", "plugins")
    if os.path.isdir(os.path.join(HOME, ".hermes")):
        dst = os.path.join(base, "odoo-dev-skills")
        how = _link_or_copy(REPO_ROOT, dst)
        _ok(f"plugin wired ({how}) → {dst}")
    else:
        _warn("Chưa thấy ~/.hermes. Cài bằng `hermes plugins install <owner>/<repo>` "
              f"hoặc trỏ tới folder này (plugin.yaml + __init__.py): {REPO_ROOT}")


def install_antigravity():
    _print_header("Google Antigravity")
    # Antigravity (v1.20.3+) đọc AGENTS.md ở root workspace + rules ở .agent/rules/.
    # Repo đã có sẵn cả hai — mở folder này trong Antigravity là chạy.
    if os.path.isdir(os.path.join(REPO_ROOT, ".agent", "rules")):
        _ok("Repo có sẵn `AGENTS.md` + `.agent/rules/odoo-dev-skills.md` — Antigravity đọc trực tiếp khi mở workspace.")
    else:
        _warn("Chưa thấy .agent/rules — bỏ qua.")
    _warn("Áp vào 1 project Odoo cụ thể: `python scripts/install.py --into <project>` "
          "(sẽ copy AGENTS.md + .agent/rules vào project).")


def install_paperclip():
    _print_header("Paperclip")
    # Paperclip đọc AGENTS.md + hệ skills qua `.agents/skills/`. Skill đã có sẵn trong repo.
    src = os.path.join(REPO_ROOT, ".agents", "skills", "odoo-dev-skills")
    if not os.path.isdir(src):
        _warn("Chưa thấy .agents/skills — bỏ qua.")
        return
    if os.path.isdir(os.path.join(HOME, ".paperclip")):
        dst = os.path.join(HOME, ".paperclip", "skills", "odoo-dev-skills")
        how = _link_or_copy(src, dst)
        _ok(f"skill wired ({how}) → {dst}")
    else:
        _ok("Repo đã có `.agents/skills/odoo-dev-skills/` + `AGENTS.md` — Paperclip đọc trực tiếp khi mở project.")
        _warn("Global: `python scripts/install.py --into <project>` để thả AGENTS.md vào project Paperclip quản lý.")


def install_into_project(project_path):
    _print_header(f"Thả context vào project: {project_path}")
    if not os.path.isdir(project_path):
        _fail(f"Không tồn tại: {project_path}")
        return
    # AGENTS.md (universal) ở root project
    shutil.copy2(os.path.join(REPO_ROOT, "AGENTS.md"), os.path.join(project_path, "AGENTS.md"))
    _ok("AGENTS.md → root project (Codex/Gemini/Cline đọc)")
    # copilot-instructions vào .github/
    gh = os.path.join(project_path, ".github")
    os.makedirs(gh, exist_ok=True)
    shutil.copy2(os.path.join(REPO_ROOT, ".github", "copilot-instructions.md"),
                 os.path.join(gh, "copilot-instructions.md"))
    _ok(".github/copilot-instructions.md → project (Copilot đọc)")
    # .agents/skills → project (Paperclip / các agent đọc convention .agents/skills)
    src_sk = os.path.join(REPO_ROOT, ".agents", "skills", "odoo-dev-skills")
    if os.path.isdir(src_sk):
        dst_sk = os.path.join(project_path, ".agents", "skills", "odoo-dev-skills")
        os.makedirs(os.path.dirname(dst_sk), exist_ok=True)
        if os.path.exists(dst_sk):
            shutil.rmtree(dst_sk)
        shutil.copytree(src_sk, dst_sk)
        _ok(".agents/skills/odoo-dev-skills → project (Paperclip đọc)")
    # .agent/rules → project (Antigravity đọc workspace rules)
    src_rule = os.path.join(REPO_ROOT, ".agent", "rules", "odoo-dev-skills.md")
    if os.path.isfile(src_rule):
        dst_rule_dir = os.path.join(project_path, ".agent", "rules")
        os.makedirs(dst_rule_dir, exist_ok=True)
        shutil.copy2(src_rule, os.path.join(dst_rule_dir, "odoo-dev-skills.md"))
        _ok(".agent/rules/odoo-dev-skills.md → project (Antigravity đọc)")

    # DevTrack: git hooks tự ghi nhận thay đổi + cross-agent (lõi ở base
    # dev-workflow-skills). Chạy được cho mọi agent vì neo vào git, không riêng Claude.
    _install_devtrack(project_path)


def _find_devtrack():
    """Tìm devtrack.py ở base dev-workflow-skills (sibling) hoặc ~/.claude/skills."""
    candidates = [
        os.environ.get("DEVTRACK_HOME", "") and
        os.path.join(os.environ["DEVTRACK_HOME"], "devtrack.py"),
        os.path.join(os.path.dirname(REPO_ROOT), "dev-workflow-skills", "scripts", "devtrack.py"),
        os.path.expanduser("~/.claude/skills/dev-workflow-skills/scripts/devtrack.py"),
    ]
    for c in candidates:
        if c and os.path.isfile(c):
            return c
    return None


def _install_devtrack(project_path):
    dt = _find_devtrack()
    if not dt:
        _warn("DevTrack: không tìm thấy devtrack.py (base dev-workflow-skills) — bỏ qua.")
        return
    try:
        subprocess.run([sys.executable, dt, "install", project_path], check=False)
        _ok("DevTrack → git hooks tự ghi nhận thay đổi (base dev-workflow-skills)")
    except Exception as e:  # noqa: BLE001
        _warn(f"DevTrack bỏ qua: {e}")


# --------------------------------------------------------------------------- #
def main():
    args = sys.argv[1:]
    if "--check" in args:
        sys.exit(0 if preflight() else 1)

    if "--into" in args:
        i = args.index("--into")
        if i + 1 >= len(args):
            _fail("Thiếu path sau --into")
            sys.exit(1)
        install_into_project(os.path.abspath(args[i + 1]))
        return

    print(f"{C_CYAN}⚙️  Cài đặt odoo-dev-skills (portable đa-harness)...{C_RESET}")
    install_claude()
    install_gemini()
    install_codex()
    install_copilot_hint()
    install_openclaw()
    install_hermes()
    install_paperclip()
    install_antigravity()
    preflight()

    print(f"\n{C_GREEN}✅ Xong.{C_RESET} Aliases tiện dụng (tùy chọn):")
    print(f"""
echo '
# odoo-dev-skills aliases
alias odoo-gen="python3 {REPO_ROOT}/scripts/odoo_generator.py"
alias odoo-lint="python3 {REPO_ROOT}/scripts/odoo_linter.py"
alias odoo-migrate="python3 {REPO_ROOT}/scripts/odoo_migrate.py"
alias odoo-fix="python3 {REPO_ROOT}/scripts/odoo_doctor.py"
alias odoo-backport="python3 {REPO_ROOT}/scripts/odoo_code_migrate.py"
alias odoo-run="python3 {REPO_ROOT}/scripts/token_killer_proxy.py"
' >> ~/.zshrc && source ~/.zshrc
""")


if __name__ == "__main__":
    main()

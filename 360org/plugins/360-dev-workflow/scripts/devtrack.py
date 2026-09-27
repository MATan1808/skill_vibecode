#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""DevTrack — lớp tự động ghi nhận thay đổi & đồng bộ cross-agent.

Triết lý (ponytail): git là kênh DUY NHẤT mọi agent (Claude/Codex/Gemini/tay)
đều đi qua, nên toàn bộ enforce + persistence neo vào git hooks cài trong project
(qua core.hooksPath). Agent chỉ là "người bấm commit"; git hook mới chuẩn hoá &
ghi nhận → state nhất quán bất kể agent nào. Không lệ thuộc OpenSpec/SpecKit,
không dependency ngoài (chỉ Python stdlib + git).

Subcommands:
  install [path]   Cài .devhooks + core.hooksPath + skeleton docs (idempotent).
                   --no-docs: bỏ 8 docs (repo aggregator/skill), chỉ tạo task.md.
  activate         Set core.hooksPath cho clone hiện tại (config local, không theo clone).
  validate         (pre-commit) kiểm docs bắt buộc + lint nhẹ. Soft mặc định.
  record           (post-commit) append CHANGELOGS, tick task.md, cập nhật MAP.
  status           (SessionStart) in task chưa xong + changelog gần nhất + MAP.
  autocommit       (Stop hook) commit checkpoint nếu tree bẩn VÀ repo đã opt-in.
  watch            Watcher nền auto-commit (editor không có Stop hook).
  selftest         Chạy self-check offline (không đụng repo thật).
"""
from __future__ import annotations

import argparse
import os
import re
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

# --- Hằng số convention -------------------------------------------------------

MANDATORY_DOCS = [
    "IDEA.md", "REQUIREMENTS.md", "SPEC.md", "ARCH.md",
    "README.md", "DEPLOY_GUIDE.md", "CHANGELOGS.md",
]
# CONTEXT.md sinh khi có thuật ngữ riêng đầu tiên → không ép tồn tại.
TASK_FILE = "task.md"
CHANGELOG_FILE = "CHANGELOGS.md"
MAP_FILE = Path(".scratch/map/MAP.md")
HOOKS_DIRNAME = ".devhooks"

# Task-id: T1, T1.2, T12.34 ... đứng như 1 token riêng.
TASK_ID_RE = re.compile(r"\bT\d+(?:\.\d+)?\b")
# Dòng checklist chưa xong trong task.md.
UNCHECKED_RE = re.compile(r"^\s*[-*]\s*\[\s\]\s+(.*)$")

CHECKPOINT_PREFIX = "chore(devtrack): checkpoint"

# --- Tiện ích git -------------------------------------------------------------


def git(args, cwd=None, check=False, capture=True):
    """Chạy git, trả (rc, stdout). Không raise trừ khi check=True."""
    res = subprocess.run(
        ["git", *args], cwd=cwd,
        stdout=subprocess.PIPE if capture else None,
        stderr=subprocess.PIPE if capture else None,
        text=True,
    )
    if check and res.returncode != 0:
        raise RuntimeError(f"git {' '.join(args)} lỗi: {res.stderr}")
    return res.returncode, (res.stdout or "").strip()


def repo_root(start=None):
    """Trả về Path gốc repo hoặc None nếu không nằm trong git."""
    rc, out = git(["rev-parse", "--show-toplevel"], cwd=start)
    return Path(out) if rc == 0 and out else None


def agent_name():
    """Đoán agent đang chạy từ env (để ghi vào commit/MAP). Mặc định 'agent'."""
    return os.environ.get("DEVTRACK_AGENT") or os.environ.get("CLAUDE_AGENT") or "agent"


def is_devtrack_repo(root: Path) -> bool:
    """Repo đã opt-in DevTrack? (core.hooksPath trỏ .devhooks). Dùng để Stop hook
    toàn cục KHÔNG auto-commit các repo chưa hề cài DevTrack."""
    _, hp = git(["config", "core.hooksPath"], cwd=root)
    return hp == HOOKS_DIRNAME


# --- install ------------------------------------------------------------------

DOC_STUB = "# {title}\n\n> _Chưa có nội dung. Sinh theo workflow /idea → /ship._\n"
TASK_STUB = (
    "# Task checklist\n\n"
    "> Mỗi task 1 dòng, có task-id để git hook auto-tick khi commit tham chiếu.\n"
    "> Ví dụ: `- [ ] T1.1 Dựng khung dự án`\n\n"
    "- [ ] T1.1 (mẫu) Khởi tạo dự án\n"
)
CHANGELOG_STUB = (
    "# Changelog\n\n"
    "Theo chuẩn [Keep a Changelog](https://keepachangelog.com/). "
    "DevTrack tự append vào mục Unreleased mỗi khi commit.\n\n"
    "## [Unreleased]\n"
)


def cmd_install(args):
    target = Path(args.path or ".").resolve()
    if not target.exists():
        print(f"[devtrack] Thư mục không tồn tại: {target}", file=sys.stderr)
        return 1

    root = repo_root(target)
    if root is None:
        print(f"[devtrack] Chưa phải git repo → git init {target}")
        git(["init"], cwd=target, check=True)
        root = target

    # 1. Copy hook templates vào <repo>/.devhooks/
    src_hooks = Path(__file__).resolve().parent.parent / "hooks" / "devhooks"
    if not src_hooks.is_dir():
        print(f"[devtrack] Không tìm thấy hook templates: {src_hooks}", file=sys.stderr)
        return 1
    dst_hooks = root / HOOKS_DIRNAME
    dst_hooks.mkdir(exist_ok=True)
    # Copy toàn bộ file trong devhooks/ (gồm cả _common.sh mà các hook source).
    for src in sorted(src_hooks.iterdir()):
        if not src.is_file():
            continue
        dst = dst_hooks / src.name
        dst.write_text(src.read_text(encoding="utf-8"), encoding="utf-8")
        dst.chmod(0o755)

    # 2. Trỏ core.hooksPath (versioned trong repo → mọi máy/agent clone là có).
    git(["config", "core.hooksPath", HOOKS_DIRNAME], cwd=root, check=True)

    # 3. Skeleton docs + task.md (không đè file có sẵn).
    #    --no-docs: bỏ qua cho repo kiểu aggregator/skill (vd v-assistant) không
    #    theo mô hình 8 docs; vẫn tạo task.md để tick checklist.
    created = []
    if getattr(args, "no_docs", False):
        # Ghi cờ để validate bỏ qua kiểm 8 docs (repo aggregator/skill).
        git(["config", "devtrack.checkdocs", "false"], cwd=root)
        task_p = root / TASK_FILE
        if not task_p.exists():
            task_p.write_text(TASK_STUB, encoding="utf-8")
            created.append(TASK_FILE)
        _report_install(root, created)
        return 0
    for doc in MANDATORY_DOCS:
        p = root / doc
        if not p.exists():
            if doc == CHANGELOG_FILE:
                p.write_text(CHANGELOG_STUB, encoding="utf-8")
            else:
                title = doc.rsplit(".", 1)[0].replace("_", " ").title()
                p.write_text(DOC_STUB.format(title=title), encoding="utf-8")
            created.append(doc)
    task_p = root / TASK_FILE
    if not task_p.exists():
        task_p.write_text(TASK_STUB, encoding="utf-8")
        created.append(TASK_FILE)

    _report_install(root, created)
    return 0


def _report_install(root: Path, created):
    print(f"[devtrack] Đã cài vào {root}")
    print(f"           core.hooksPath = {HOOKS_DIRNAME}")
    print(f"           hooks: pre-commit, prepare-commit-msg, post-commit")
    if created:
        print(f"           tạo skeleton: {', '.join(created)}")
    else:
        print("           không tạo file mới (đã đủ).")


# --- activate -----------------------------------------------------------------


def cmd_activate(args):
    """Kích hoạt hooks cho clone hiện tại (core.hooksPath là config LOCAL, KHÔNG
    đi theo clone). Rẻ, im lặng, idempotent — an toàn gọi mỗi SessionStart.
    Chỉ set khi repo đã có sẵn .devhooks/ được version.
    """
    root = repo_root()
    if root is None:
        return 0
    if not (root / HOOKS_DIRNAME).is_dir():
        return 0
    rc, cur = git(["config", "--local", "core.hooksPath"], cwd=root)
    if cur == HOOKS_DIRNAME:
        return 0
    git(["config", "core.hooksPath", HOOKS_DIRNAME], cwd=root)
    if not args.quiet:
        print(f"[devtrack] kích hoạt hooks cho clone này (core.hooksPath={HOOKS_DIRNAME})")
    return 0


# --- validate (pre-commit) ----------------------------------------------------


def cmd_validate(args):
    root = repo_root() or Path(".").resolve()
    strict = os.environ.get("DEVTRACK_STRICT") == "1"

    problems = []
    # Repo aggregator/skill (cài --no-docs) đặt cờ này → bỏ qua kiểm 8 docs.
    _, checkdocs = git(["config", "devtrack.checkdocs"], cwd=root)
    if checkdocs != "false":
        missing = [d for d in MANDATORY_DOCS if not (root / d).exists()]
        if missing:
            problems.append(f"thiếu docs bắt buộc: {', '.join(missing)}")

    if not problems:
        return 0

    msg = "[devtrack] cảnh báo: " + "; ".join(problems)
    if strict:
        print(msg + "  (DEVTRACK_STRICT=1 → chặn commit)", file=sys.stderr)
        return 1
    print(msg + "  (soft; đặt DEVTRACK_STRICT=1 để enforce)", file=sys.stderr)
    return 0


# --- record (post-commit) -----------------------------------------------------


def cmd_record(args):
    """Chạy sau commit: append changelog, tick task, cập nhật MAP.

    Không bao giờ raise (post-commit exit code bị git bỏ qua, nhưng ta muốn im
    lặng, không làm hỏng trải nghiệm). Thay đổi ghi vào working tree → gộp vào
    commit kế tiếp (hoặc checkpoint autocommit). Bỏ qua commit checkpoint để
    tránh spam changelog.
    """
    try:
        root = repo_root() or Path(".").resolve()
        rc, subject = git(["log", "-1", "--pretty=%s"], cwd=root)
        rc2, body = git(["log", "-1", "--pretty=%B"], cwd=root)
        rc3, short = git(["log", "-1", "--pretty=%h"], cwd=root)
        if rc != 0:
            return 0
        if subject.startswith("chore(devtrack):"):
            return 0  # bỏ qua tất cả commit tự động của DevTrack để tránh vòng lặp đệ quy

        task_ids = sorted(set(TASK_ID_RE.findall(body)))
        _append_changelog(root, subject, short, task_ids)
        if task_ids:
            _tick_tasks(root, task_ids)
            _close_gitlab_issues(root, task_ids, commit_sha=short)
        _touch_map(root, subject, task_ids)

        # Tự động commit và push checklist task.md & CHANGELOGS.md lên GitLab (origin)
        rc_diff, _ = git(["diff", "--quiet", TASK_FILE, CHANGELOG_FILE], cwd=root)
        if rc_diff != 0:
            print("[devtrack] Phát hiện thay đổi ở checklist. Đang tự động commit & push...")
            git(["add", TASK_FILE, CHANGELOG_FILE], cwd=root)
            git(["commit", "-m", "chore(devtrack): update task checklist and changelogs [skip ci]", "--no-verify"], cwd=root)

            _, remotes_list = git(["remote"], cwd=root)
            remotes = remotes_list.split()
            target_remote = "origin" # GitLab là remote origin chính thức

            if target_remote in remotes:
                _, current_branch = git(["branch", "--show-current"], cwd=root)
                if current_branch:
                    print(f"[devtrack] Đang push thay đổi lên {target_remote}/{current_branch} dưới nền...")
                    # Chạy push bất đồng bộ dưới nền (Popen) để tránh treo commit
                    subprocess.Popen(
                        ["git", "push", target_remote, current_branch],
                        cwd=root,
                        stdout=subprocess.DEVNULL,
                        stderr=subprocess.DEVNULL,
                        start_new_session=True
                    )
    except Exception as e:  # noqa: BLE001 — post-commit tuyệt đối không được vỡ
        print(f"[devtrack] record bỏ qua lỗi: {e}", file=sys.stderr)
    return 0


def _append_changelog(root: Path, subject: str, short: str, task_ids):
    p = root / CHANGELOG_FILE
    date = datetime.now().strftime("%Y-%m-%d")
    tag = f" ({', '.join(task_ids)})" if task_ids else ""
    entry = f"- {date} {subject} [{short}]{tag}\n"

    if not p.exists():
        p.write_text(CHANGELOG_STUB + entry, encoding="utf-8")
        return
    text = p.read_text(encoding="utf-8")
    if entry.strip() in text:
        return  # idempotent
    if "## [Unreleased]" in text:
        text = text.replace("## [Unreleased]\n", "## [Unreleased]\n" + entry, 1)
    else:
        text = text.rstrip() + "\n\n## [Unreleased]\n" + entry
    p.write_text(text, encoding="utf-8")


def _tick_tasks(root: Path, task_ids):
    p = root / TASK_FILE
    if not p.exists():
        return
    ids = set(task_ids)
    out = []
    for line in p.read_text(encoding="utf-8").splitlines(keepends=True):
        m = UNCHECKED_RE.match(line)
        if m and TASK_ID_RE.search(m.group(1)):
            if set(TASK_ID_RE.findall(m.group(1))) & ids:
                line = line.replace("[ ]", "[x]", 1)
        out.append(line)
    p.write_text("".join(out), encoding="utf-8")


def _touch_map(root: Path, subject: str, task_ids):
    p = root / MAP_FILE
    if not p.exists():
        return  # MAP chỉ dùng cho việc > 1 phiên; không ép tạo
    stamp = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    tag = f" {', '.join(task_ids)}" if task_ids else ""
    marker = "<!-- devtrack:last -->"
    line = f"{marker} {stamp} · {agent_name()}{tag}: {subject}\n"
    text = p.read_text(encoding="utf-8")
    if marker in text:
        text = re.sub(re.escape(marker) + r".*\n", line, text, count=1)
    else:
        text = text.rstrip() + "\n\n" + line
    p.write_text(text, encoding="utf-8")


def _close_gitlab_issues(root: Path, task_ids, commit_sha=""):
    import json
    # Kiểm tra glab cli
    res = subprocess.run(["glab", "auth", "status"], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    if not ("Logged in" in res.stdout or "Logged in" in res.stderr):
        return

    for tid in task_ids:
        # Tìm issue đang mở có tiêu đề chứa mã task (VD: [T2.6]) trên GitLab
        search_res = subprocess.run(
            ["glab", "issue", "list", "--search", tid, "-O", "json"],
            cwd=root, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True
        )
        try:
            issues = json.loads(search_res.stdout.strip() or "[]")
            if issues and isinstance(issues, list):
                # Lấy internal ID (iid) của issue đầu tiên khớp
                iid = issues[0].get("iid")
                if iid:
                    print(f"[devtrack] Đang tự động đóng GitLab Issue #{iid} cho task {tid}...")

                    # 1. Đóng issue
                    subprocess.run(["glab", "issue", "close", str(iid)], cwd=root, stdout=subprocess.PIPE, stderr=subprocess.PIPE)

                    # 2. Thêm comment note
                    comment_msg = f"Đã hoàn thành trong commit {commit_sha}." if commit_sha else "Đã hoàn thành."
                    subprocess.run(["glab", "issue", "note", str(iid), "--message", comment_msg], cwd=root, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
                    print(f"[devtrack] Đã đóng và ghi nhận hoàn thành trên GitLab Issue #{iid}.")
        except Exception as e:
            print(f"[devtrack] Lỗi khi xử lý đóng GitLab Issue cho {tid}: {e}", file=sys.stderr)


# --- status (SessionStart) ----------------------------------------------------


def cmd_status(args):
    root = repo_root() or Path(".").resolve()
    limit = args.limit
    print(f"[devtrack] Trạng thái dự án: {root.name}")

    # Task chưa xong
    task_p = root / TASK_FILE
    if task_p.exists():
        pend = [m.group(1).strip()
                for line in task_p.read_text(encoding="utf-8").splitlines()
                for m in [UNCHECKED_RE.match(line)] if m]
        if pend:
            print(f"  Task chưa xong ({len(pend)}):")
            for t in pend[:limit]:
                print(f"    - [ ] {t}")
            if len(pend) > limit:
                print(f"    … +{len(pend) - limit} task nữa (xem {TASK_FILE})")
        else:
            print("  Task: tất cả đã xong ✓")

    # Changelog gần nhất
    cl_p = root / CHANGELOG_FILE
    if cl_p.exists():
        entries = [l for l in cl_p.read_text(encoding="utf-8").splitlines()
                   if l.startswith("- ")]
        if entries:
            print(f"  Thay đổi gần nhất:")
            for e in entries[:3]:
                print(f"    {e}")

    # Con trỏ MAP (Đích đến)
    map_p = root / MAP_FILE
    if map_p.exists():
        for line in map_p.read_text(encoding="utf-8").splitlines():
            if line.strip() and not line.startswith("#"):
                print(f"  MAP → {line.strip()[:100]}")
                break
    return 0


# --- autocommit (Stop hook) + watch (Antigravity/Codex/Gemini) ----------------


def _checkpoint(root: Path) -> bool:
    """Commit mọi thay đổi working tree thành 1 checkpoint. Trả True nếu có commit.
    Dùng chung cho Stop hook (autocommit) và watcher.
    """
    rc, out = git(["status", "--porcelain"], cwd=root)
    if not out:
        return False  # tree sạch → không có gì để lưu
    git(["add", "-A"], cwd=root)
    stamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    msg = f"{CHECKPOINT_PREFIX} {stamp} · {agent_name()}"
    # --no-verify: checkpoint không cần validate lại (đã lint trong phiên);
    # tránh pre-commit chặn checkpoint làm mất tiến độ.
    rc, _ = git(["commit", "-m", msg, "--no-verify"], cwd=root)
    if rc == 0:
        print(f"[devtrack] checkpoint đã lưu: {msg}")
        return True
    return False


def cmd_autocommit(args):
    root = repo_root()
    if root is None:
        return 0
    # An toàn: Stop hook toàn cục (base plugin) chỉ checkpoint repo đã opt-in
    # DevTrack — KHÔNG tự commit các repo khác anh tình cờ mở.
    if not is_devtrack_repo(root):
        return 0
    _checkpoint(root)
    return 0


def cmd_watch(args):
    """Watcher nền: tự checkpoint khi working tree thay đổi rồi ĐỨNG YÊN qua 1 chu
    kỳ (debounce — tránh commit giữa lúc đang gõ). Lấp Tầng B cho các editor KHÔNG
    có Stop hook (Antigravity/Codex/Gemini): chạy 1 lệnh/project là auto-commit.

    ponytail: polling `git status` mỗi `interval` giây (không phải inotify) — đơn
    giản, stdlib-only, đủ cho nhịp dev. Chờ tối đa ~2×interval trước khi lưu.
    """
    import time

    root = repo_root()
    if root is None:
        print("[devtrack] không phải git repo — không watch.", file=sys.stderr)
        return 1
    if not is_devtrack_repo(root):
        print("[devtrack] repo chưa cài DevTrack — chạy `devtrack install` trước.",
              file=sys.stderr)
        return 1
    interval = max(5, args.interval)
    print(f"[devtrack] watch {root} mỗi {interval}s (Ctrl-C để dừng). "
          f"Agent={agent_name()}")
    prev = None
    try:
        while True:
            _, cur = git(["status", "--porcelain"], cwd=root)
            if cur and cur == prev:
                # bẩn và ổn định qua 1 chu kỳ → an toàn để commit
                _checkpoint(root)
                prev = None
            else:
                prev = cur  # None (sạch) hoặc snapshot mới → chờ ổn định
            time.sleep(interval)
    except KeyboardInterrupt:
        # Lưu nốt trước khi thoát để không mất tiến độ.
        _checkpoint(root)
        print("\n[devtrack] dừng watch.")
    return 0


# --- selftest -----------------------------------------------------------------


def cmd_selftest(args):
    """Self-check offline các hàm parse/ghi (ponytail: 1 check chạy được)."""
    import tempfile

    # 1. task-id regex
    assert TASK_ID_RE.findall("fix(core): xong [T1.2] và T10.3, không T bừa") == ["T1.2", "T10.3"], "task-id parse sai"
    assert TASK_ID_RE.findall("no ids here") == []

    with tempfile.TemporaryDirectory() as d:
        root = Path(d)
        # 2. tick task
        (root / TASK_FILE).write_text(
            "- [ ] T1.1 làm A\n- [ ] T1.2 làm B\n- [x] T1.3 đã xong\n", encoding="utf-8")
        _tick_tasks(root, ["T1.2"])
        got = (root / TASK_FILE).read_text(encoding="utf-8")
        assert "- [x] T1.2 làm B" in got, f"tick sai:\n{got}"
        assert "- [ ] T1.1 làm A" in got, "không được tick nhầm task khác"

        # 3. append changelog idempotent
        _append_changelog(root, "feat: X", "abc1234", ["T1.2"])
        _append_changelog(root, "feat: X", "abc1234", ["T1.2"])
        cl = (root / CHANGELOG_FILE).read_text(encoding="utf-8")
        assert cl.count("feat: X") == 1, f"changelog không idempotent:\n{cl}"
        assert "[abc1234]" in cl and "(T1.2)" in cl

        # 4. MAP touch chỉ khi có file
        _touch_map(root, "feat: X", ["T1.2"])  # không có MAP → no-op, không lỗi
        assert not (root / MAP_FILE).exists()

    print("[devtrack] selftest OK ✓")
    return 0


def cmd_task_add(args):
    root = repo_root() or Path(".").resolve()
    task_p = root / TASK_FILE
    if not task_p.exists():
        print(f"[devtrack] Không tìm thấy file {TASK_FILE}. Hãy chạy devtrack install trước.", file=sys.stderr)
        return 1

    # 1. Tìm task-id lớn nhất tiếp theo
    content = task_p.read_text(encoding="utf-8")
    task_ids = []
    for line in content.splitlines():
        found = TASK_ID_RE.findall(line)
        for tid in found:
            try:
                num_str = tid[1:]
                if "." in num_str:
                    major, minor = map(int, num_str.split("."))
                    task_ids.append((major, minor))
                else:
                    task_ids.append((int(num_str), 0))
            except ValueError:
                continue

    if task_ids:
        max_major, max_minor = max(task_ids)
        next_major = max_major
        next_minor = max_minor + 1
    else:
        next_major = 1
        next_minor = 1

    next_task_id = f"T{next_major}.{next_minor}"
    task_line = f"- [ ] {next_task_id} {args.title}\n"

    # 2. Ghi task vào task.md
    task_p.write_text(content.rstrip() + "\n" + task_line, encoding="utf-8")
    print(f"[devtrack] Đã thêm task local: {next_task_id} - {args.title}")

    # 3. Tạo Issue trên GitLab nếu glab cli khả dụng
    res = subprocess.run(["glab", "auth", "status"], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    if "Logged in" in res.stdout or "Logged in" in res.stderr:
        body = args.body or f"Yêu cầu: {args.title}"
        if args.image:
            image_path = Path(args.image)
            if image_path.exists():
                try:
                    rel_path = image_path.relative_to(root)
                    _, remote_url = git(["remote", "get-url", "origin"], cwd=root)
                    repo_match = re.search(r"gitlab\.com[:/](.+?)(?:\.git)?$", remote_url)
                    if repo_match:
                        repo_slug = repo_match.group(1)
                        raw_image_url = f"https://gitlab.com/{repo_slug}/-/blob/main/{rel_path}?raw=true"
                        body += f"\n\n### Ảnh minh họa\n![Ảnh minh họa]({raw_image_url})\n"
                except Exception:
                    body += f"\n\n### Ảnh minh họa (Local path)\n![Ảnh minh họa]({args.image})\n"

        title_with_id = f"[{next_task_id}] {args.title}"
        # Sử dụng glab để tạo issue trên GitLab
        create_cmd = ["glab", "issue", "create", "--title", title_with_id, "--description", body, "--yes"]
        create_res = subprocess.run(create_cmd, cwd=root, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        if create_res.returncode == 0:
            # Output của glab issue create chứa URL của issue
            issue_url = create_res.stdout.strip()
            print(f"[devtrack] Đã tạo thành công GitLab Issue: {issue_url}")
        else:
            print(f"[devtrack] Lỗi khi tạo GitLab Issue: {create_res.stderr.strip()}", file=sys.stderr)
    else:
        print("[devtrack] GitLab CLI chưa được đăng nhập hoặc không khả dụng. Bỏ qua tạo Issue trực tuyến.")
    return 0


# --- CLI ----------------------------------------------------------------------


def main(argv=None):
    parser = argparse.ArgumentParser(prog="devtrack", description=__doc__)
    sub = parser.add_subparsers(dest="cmd", required=True)

    p_install = sub.add_parser("install", help="Cài hooks + hooksPath + skeleton docs")
    p_install.add_argument("path", nargs="?", help="Thư mục project (mặc định .)")
    p_install.add_argument("--no-docs", action="store_true",
                           help="Không tạo 8 docs skeleton (hợp repo aggregator/skill)")
    p_install.set_defaults(func=cmd_install)

    p_task_add = sub.add_parser("task-add", help="Thêm task mới local và đồng bộ tạo GitHub Issue")
    p_task_add.add_argument("title", help="Tiêu đề task")
    p_task_add.add_argument("--body", help="Mô tả chi tiết hoặc phương án giải quyết")
    p_task_add.add_argument("--image", help="Đường dẫn file ảnh minh họa")
    p_task_add.set_defaults(func=cmd_task_add)

    p_act = sub.add_parser("activate", help="Set core.hooksPath cho clone hiện tại")
    p_act.add_argument("--quiet", action="store_true")
    p_act.set_defaults(func=cmd_activate)

    sub.add_parser("validate", help="pre-commit: kiểm docs + lint nhẹ").set_defaults(func=cmd_validate)
    sub.add_parser("record", help="post-commit: changelog + tick task + MAP").set_defaults(func=cmd_record)
    sub.add_parser("autocommit", help="Stop hook: checkpoint nếu tree bẩn").set_defaults(func=cmd_autocommit)

    p_watch = sub.add_parser("watch", help="Watcher nền: auto-commit cho editor không có Stop hook")
    p_watch.add_argument("--interval", type=int, default=30, help="Chu kỳ quét giây (mặc định 30)")
    p_watch.set_defaults(func=cmd_watch)
    sub.add_parser("selftest", help="Self-check offline").set_defaults(func=cmd_selftest)

    p_status = sub.add_parser("status", help="SessionStart: in trạng thái dự án")
    p_status.add_argument("--limit", type=int, default=8, help="Số task in tối đa")
    p_status.set_defaults(func=cmd_status)

    args = parser.parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())

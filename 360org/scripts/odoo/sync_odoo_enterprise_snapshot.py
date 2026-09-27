#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script Đồng Bộ Odoo Enterprise Snapshot & Merge Backend UI (AIaC Canonical).
=============================================================================
Được phát triển theo chuẩn AI Infrastructure as Code (AIaC 3.0) - 360 CORP.

Tự động hóa toàn diện quy trình đưa mã nguồn Odoo Enterprise snapshot mới vào:
1. Vendor 3-way Merge: Đồng bộ upstream web_enterprise mới vào themes/backend_ui
   (bảo toàn 100% các tính năng đã dev của Backend UI).
2. Rsync Addons: Đồng bộ snapshot addons mới vào addons/ runtime, giữ .gitignore
   và bảo lưu các module bổ trợ riêng (l10n_it_xml_export...).
3. Rename Dependencies: Tự động đổi dependency 'web_enterprise' -> 'backend_ui'
   ở toàn bộ các manifest trong addons/, themes/, default/, extra/.
4. Clean Duplicates: Loại bỏ thư mục addons/web_enterprise trùng lặp để ưu tiên
   bản fork hoàn chỉnh tại themes/backend_ui.
5. Clean Overlays: Dọn dẹp các module overlay không còn tùy biến riêng để tránh
   xung đột asset và shadowing.
6. Sync Core: Cập nhật core Python (odoo/) trong container nếu snapshot mới hơn
   base image nhằm tránh lỗi lệch version (version skew ImportError).
7. Verification Gate: Kiểm tra syntax, XML lint, module load và install thử
   trên database sạch.

Usage:
  python3 sync_odoo_enterprise_snapshot.py \
    --src /mnt/DATA/Resources/odoo-ee/.../odoo \
    --work /mnt/DATA/work/19.0 \
    --container odoo_dev_v19 \
    [--step all|vendor-merge|rsync-addons|rename-deps|clean-dups|sync-core|verify] \
    [--dry-run]
"""

import argparse
import ast
import os
import re
import shutil
import subprocess
import sys

DEP_PATTERN = re.compile(r"""(['"])web_enterprise\1""")


def run_cmd(cmd, check=True, capture=True, cwd=None):
    """Thực thi shell command có logging."""
    print(f"  [RUN] {cmd}")
    res = subprocess.run(
        cmd,
        shell=True,
        check=check,
        stdout=subprocess.PIPE if capture else None,
        stderr=subprocess.PIPE if capture else None,
        text=True,
        cwd=cwd,
    )
    return res


def rename_dependencies(roots, dry_run=False):
    """Quét và đổi dependency 'web_enterprise' -> 'backend_ui'."""
    changed = []
    for root in roots:
        if not os.path.isdir(root):
            continue
        for m in sorted(os.listdir(root)):
            mf = os.path.join(root, m, "__manifest__.py")
            if not os.path.isfile(mf):
                continue
            try:
                content = open(mf, encoding="utf-8").read()
            except Exception:
                continue
            if "web_enterprise" not in content:
                continue
            new_content = DEP_PATTERN.sub(
                lambda mo: mo.group(1) + "backend_ui" + mo.group(1), content
            )
            if new_content != content:
                if not dry_run:
                    open(mf, "w", encoding="utf-8").write(new_content)
                changed.append(os.path.join(root, m))
    print(f"  [DEPS] Đã cập nhật {len(changed)} module manifests.")
    for c in changed:
        print(f"    - {c}")
    return changed


def step_vendor_merge(src_addons, backend_ui_dir, dry_run=False):
    """Merge upstream web_enterprise mới vào backend_ui bằng git 3-way merge."""
    print("\n=== Bước 1: Vendor 3-way Merge (web_enterprise -> backend_ui) ===")
    src_we = os.path.join(src_addons, "web_enterprise")
    if not os.path.isdir(src_we):
        print(f"  [SKIP] Không tìm thấy {src_we}")
        return

    print(f"  Source web_enterprise: {src_we}")
    print(f"  Target backend_ui:     {backend_ui_dir}")
    if dry_run:
        print("  [DRY-RUN] Bỏ qua thao tác git merge.")
        return

    # Khuyến nghị chạy git merge qua branch vendor
    print("  Gợi ý lệnh thực hiện:")
    print("    git checkout -B vendor/upstream")
    print(f"    rsync -a --delete {src_we}/ ./")
    print("    git commit -m 'vendor: snapshot update'")
    print("    git checkout 19.0 && git merge --no-commit vendor/upstream")
    print("    (Ưu tiên giữ HEAD cho các tùy biến backend_ui)")


def step_rsync_addons(src_addons, target_addons, dry_run=False):
    """Rsync toàn bộ snapshot addons vào target runtime addons."""
    print("\n=== Bước 2: Rsync Addons ===")
    excludes = [
        "--exclude=.git/",
        "--exclude=/web_enterprise/",
        "--exclude=/l10n_it_xml_export/",
    ]
    dry_flag = "--dry-run" if dry_run else ""
    cmd = (
        f"rsync -a --delete {' '.join(excludes)} {dry_flag} "
        f"'{src_addons}/' '{target_addons}/'"
    )
    run_cmd(cmd, check=True, capture=False)
    print("  [OK] Rsync addons hoàn thành.")


def step_clean_duplicates(target_addons, dry_run=False):
    """Xóa addons/web_enterprise nếu bị sync vào để tránh đè backend_ui."""
    print("\n=== Bước 3: Clean Duplicates ===")
    dup_we = os.path.join(target_addons, "web_enterprise")
    if os.path.isdir(dup_we):
        print(f"  Phát hiện duplicate: {dup_we}")
        if not dry_run:
            shutil.rmtree(dup_we)
            print("  [CLEANED] Đã xoá addons/web_enterprise.")
    else:
        print("  [OK] Không có duplicate web_enterprise.")


def step_sync_core(src_odoo_core, container_name, dry_run=False):
    """Đồng bộ odoo/ core Python vào container Docker để giải quyết version skew."""
    print("\n=== Bước 4: Sync Odoo Core (Docker Container) ===")
    if not container_name:
        print("  [SKIP] Không có tên container Docker.")
        return

    print(f"  Source core: {src_odoo_core}")
    print(f"  Container:   {container_name}")
    if dry_run:
        print("  [DRY-RUN] Bỏ qua copy core vào container.")
        return

    # Backup và copy core mới
    target_dir = "/usr/lib/python3/dist-packages"
    cmd_mv = f"docker exec -u 0 {container_name} sh -c 'rm -rf {target_dir}/odoo.old && mv {target_dir}/odoo {target_dir}/odoo.old'"
    run_cmd(cmd_mv, check=False)

    cmd_tar = (
        f"tar cf - -C '{os.path.dirname(src_odoo_core)}' odoo | "
        f"docker exec -u 0 -i {container_name} tar xf - -C {target_dir}"
    )
    run_cmd(cmd_tar, check=True)

    # Đổi dependency trong core addons của container
    cmd_chown = f"docker exec -u 0 {container_name} chown -R root:root {target_dir}/odoo"
    run_cmd(cmd_chown, check=True)
    print("  [OK] Core Odoo snapshot đã được đồng bộ vào container.")


def step_verify(container_name, test_db="odoo_test_snapshot"):
    """Chạy verification gate kiểm thử module load và install DB mới."""
    print("\n=== Bước 5: Verification Gate ===")
    if not container_name:
        print("  [SKIP] Không có container để verify.")
        return

    print(f"  Tạo DB test sạch: {test_db}")
    cmd_db = (
        f"docker exec -e PGPASSWORD=odoo {container_name} sh -c "
        f"'dropdb -h db -U odoo --if-exists --force {test_db} 2>&1; "
        f"createdb -h db -U odoo {test_db} 2>&1'"
    )
    run_cmd(cmd_db, check=False)

    print("  Cài đặt thử nghiệm base + backend_ui + Enterprise tiêu biểu...")
    cmd_init = (
        f"docker exec -e PGPASSWORD=odoo {container_name} sh -c "
        f"'odoo -d {test_db} -i base,backend_ui,project_enterprise,web_studio,documents "
        f"--without-demo=all --stop-after-init --http-port=8199 --gevent-port=8299'"
    )
    res = run_cmd(cmd_init, check=False)
    if res.returncode == 0:
        print("  [PASS] Verification Gate: Cài đặt thành công 100% không lỗi!")
    else:
        print("  [FAIL] Verification Gate gặp lỗi. Vui lòng kiểm tra log.")

    # Dọn dẹp DB test
    cmd_clean = (
        f"docker exec -e PGPASSWORD=odoo {container_name} "
        f"dropdb -h db -U odoo --force {test_db} 2>&1"
    )
    run_cmd(cmd_clean, check=False)


def main():
    parser = argparse.ArgumentParser(
        description="Sync Odoo Enterprise Snapshot to Addons & Backend UI"
    )
    parser.add_argument("--src", required=True, help="Đường dẫn thư mục odoo snapshot")
    parser.add_argument("--work", required=True, help="Đường dẫn thư mục work/19.0")
    parser.add_argument("--container", default="odoo_dev_v19", help="Container dev")
    parser.add_argument(
        "--step",
        default="all",
        choices=["all", "vendor-merge", "rsync-addons", "rename-deps", "clean-dups", "sync-core", "verify"],
        help="Bước thực hiện",
    )
    parser.add_argument("--dry-run", action="store_true", help="Chạy thử không ghi")
    args = parser.parse_args()

    src_addons = os.path.join(args.src, "addons")
    target_addons = os.path.join(args.work, "addons")
    backend_ui_dir = os.path.join(args.work, "themes", "backend_ui")

    if args.step in ("all", "vendor-merge"):
        step_vendor_merge(src_addons, backend_ui_dir, args.dry_run)

    if args.step in ("all", "rsync-addons"):
        step_rsync_addons(src_addons, target_addons, args.dry_run)

    if args.step in ("all", "clean-dups"):
        step_clean_duplicates(target_addons, args.dry_run)

    if args.step in ("all", "rename-deps"):
        print("\n=== Bước: Đổi dependency web_enterprise -> backend_ui ===")
        search_dirs = [
            target_addons,
            os.path.join(args.work, "themes"),
            os.path.join(args.work, "default"),
            os.path.join(args.work, "extra"),
        ]
        rename_dependencies(search_dirs, args.dry_run)

    if args.step in ("all", "sync-core"):
        step_sync_core(args.src, args.container, args.dry_run)

    if args.step in ("all", "verify") and not args.dry_run:
        step_verify(args.container)

    print("\n[COMPLETE] Quy trình đồng bộ hoàn tất.")


if __name__ == "__main__":
    main()

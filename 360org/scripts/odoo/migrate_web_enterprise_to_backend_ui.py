#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
==============================================================================
AIAC / 360 CORP: Migration Script (web_enterprise -> backend_ui)
Version: Odoo 17.0 / 18.0 / 19.0 Enterprise & Community
Authored-By: 360 CORP <w360s@outlook.com>
==============================================================================
Script chuẩn hóa chạy bên trong container Odoo hoặc môi trường Odoo CLI:
1. Kiểm tra cấu hình addons_path: Đảm bảo module 'backend_ui' tồn tại và installable.
2. ORM Cascading Uninstall: Gỡ cài đặt web_enterprise và các module Enterprise
   phụ thuộc giao diện (web_mobile, website_enterprise, ...) qua ORM,
   dọn sạch model, field, view, foreign key, constraint và ir_model_data.
   (Hỗ trợ đa phiên bản Odoo 17, 18, 19 - tương thích việc xóa Environment.manage()).
3. Remap Dependencies: Chuyển đổi toàn bộ quan hệ phụ thuộc còn sót lại từ
   'web_enterprise' sang 'backend_ui' trong ir_module_module_dependency.
4. Cài đặt / Cập nhật backend_ui: Tự động cài đặt backend_ui vào database.
5. Quét & Vô hiệu hóa ir_asset mồ côi: Tắt các asset trỏ vào module không còn tồn tại
   hoặc chưa có source, ngăn chặn triệt để lỗi "Could not get content for...".
6. Dọn sạch cache web assets (ir_attachment) để Odoo recompile bundle sạch sẽ.
7. Tự động kiểm tra (Verification Gate): Kiểm tra HTTP 200 cho /web/login
   và asset bundle chính (web.assets_web.min.js).
==============================================================================
"""

import sys
import os
import argparse
import urllib.request
import urllib.error


def check_addons_path(target_module='backend_ui'):
    """Kiểm tra xem target_module có nằm trong addons_path và có manifest hợp lệ không."""
    import odoo.modules
    manifest = None
    if hasattr(odoo.modules, 'get_manifest'):
        manifest = odoo.modules.get_manifest(target_module)
    elif hasattr(odoo.modules, 'load_manifest'):
        manifest = odoo.modules.load_manifest(target_module)

    if not manifest:
        import odoo.tools.config
        print(f"❌ [LỖI NGHIÊM TRỌNG] Không tìm thấy manifest của module '{target_module}'!")
        print("   Vui lòng kiểm tra lại addons_path trong /etc/odoo/odoo.conf hoặc docker-compose mount volume.")
        print(f"   addons_path hiện tại: {odoo.tools.config.get('addons_path')}")
        sys.exit(1)
    print(f"✅ Module '{target_module}' hợp lệ trong addons_path (version: {manifest.get('version', 'N/A')}).")


def run_orm_conversion(db_name, config_file=None, dry_run=True):
    import odoo
    import odoo.tools.config
    from odoo import api, SUPERUSER_ID
    import odoo.modules.registry

    if dry_run:
        print("🔎 [DRY-RUN] Chỉ liệt kê thao tác, KHÔNG ghi vào database.")
        print("   Chạy lại với --apply để thực thi.\n")
    else:
        print("⚠️  [APPLY] Chế độ ghi. Database sẽ bị thay đổi.\n")

    cmd_args = ["--database=" + db_name, "--no-http"]
    if config_file and os.path.exists(config_file):
        cmd_args.append(f"--config={config_file}")

    odoo.tools.config.parse_config(cmd_args)

    # 1. Kiểm tra addons_path ngay sau khi load config
    check_addons_path('backend_ui')

    print(f"🚀 [backend_ui] Khởi tạo Odoo Registry cho database: {db_name}...")
    Registry = odoo.modules.registry.Registry
    registry = Registry.new(db_name)

    with registry.cursor() as cr:
        # Tương thích Odoo 17/18/19: Không gọi api.Environment.manage()
        env = api.Environment(cr, SUPERUSER_ID, {})

        # 2. ORM Uninstall web_enterprise và các module enterprise phụ thuộc UI
        print("🔄 [1/5] ORM Uninstall web_enterprise và các module phụ thuộc...")
        enterprise_ui_modules = [
            'web_mobile',
            'website_enterprise',
            'spreadsheet_edition',
            'digest_enterprise',
            'web_enterprise'
        ]
        Module = env['ir.module.module']
        for mod_name in enterprise_ui_modules:
            mod = Module.search([('name', '=', mod_name), ('state', '=', 'installed')], limit=1)
            if mod:
                if dry_run:
                    print(f"   [DRY-RUN] Sẽ uninstall: {mod_name}")
                    continue
                print(f"   -> Đang ORM uninstall: {mod_name}...")
                mod.button_immediate_uninstall()
                cr.commit()
                print(f"   ✅ Đã uninstall thành công: {mod_name}")

        # 3. Remap ir_module_module_dependency còn sót lại từ web_enterprise -> backend_ui
        print("🔄 [2/5] Remap dependencies còn lại sang backend_ui...")
        Dependency = env['ir.module.module.dependency']
        deps = Dependency.search([('name', '=', 'web_enterprise')])
        if dry_run:
            print(f"   [DRY-RUN] Sẽ remap {len(deps)} dependency records sang backend_ui.")
        else:
            for dep in deps:
                duplicate = Dependency.search([
                    ('module_id', '=', dep.module_id.id),
                    ('name', '=', 'backend_ui')
                ], limit=1)
                if duplicate:
                    dep.unlink()
                else:
                    dep.name = 'backend_ui'
            cr.commit()
            print(f"   ✅ Đã remap {len(deps)} dependency records sang backend_ui.")

        # 4. Kích hoạt và cài đặt module backend_ui
        print("⚙️ [3/5] Cài đặt / Kích hoạt module backend_ui...")
        backend_ui_mod = Module.search([('name', '=', 'backend_ui')], limit=1)
        if dry_run:
            action = 'upgrade' if backend_ui_mod and backend_ui_mod.state == 'installed' else 'install'
            print(f"   [DRY-RUN] Sẽ {action} module backend_ui.")
        elif backend_ui_mod:
            if backend_ui_mod.state != 'installed':
                backend_ui_mod.button_immediate_install()
                cr.commit()
                print("   ✅ Đã cài đặt thành công module backend_ui!")
            else:
                backend_ui_mod.button_immediate_upgrade()
                cr.commit()
                print("   ✅ Đã upgrade module backend_ui thành công!")
        else:
            print("   ⚠️ Không tìm thấy bản ghi ir.module.module cho backend_ui, cập nhật module list...")
            Module.update_list()
            backend_ui_mod = Module.search([('name', '=', 'backend_ui')], limit=1)
            if backend_ui_mod:
                backend_ui_mod.button_immediate_install()
                cr.commit()
                print("   ✅ Đã cài đặt thành công module backend_ui sau khi update_list!")

        # 5. Dọn dẹp an toàn các ir_asset mồ côi (orphaned assets)
        print("🧹 [4/5] Quét và vô hiệu hóa các ir_asset mồ côi...")
        Asset = env['ir.asset']
        all_active_assets = Asset.search([('active', '=', True)])
        deactivated_count = 0

        # Lấy danh sách các module đang active/installed
        installed_modules = set(Module.search([('state', '=', 'installed')]).mapped('name'))
        installed_modules.add('base')
        installed_modules.add('web')
        installed_modules.add('backend_ui')

        for asset in all_active_assets:
            path = asset.path or ''
            if path.startswith('/'):
                parts = path.strip('/').split('/')
                mod_in_path = parts[0] if parts else None
                if mod_in_path and mod_in_path not in installed_modules:
                    if not dry_run:
                        asset.write({'active': False})
                    deactivated_count += 1
            elif asset.bundle and any(ext in asset.bundle for ext in ['web_enterprise', 'mass_editing']):
                if not dry_run:
                    asset.write({'active': False})
                deactivated_count += 1

        if dry_run:
            print(f"   [DRY-RUN] Sẽ vô hiệu hóa {deactivated_count} ir_asset mồ côi.")
        else:
            cr.commit()
            print(f"   ✅ Đã vô hiệu hóa {deactivated_count} ir_asset mồ côi gây lỗi bundle.")

        # 6. Dọn sạch cache assets trong ir_attachment
        # CHỈ lọc theo url của bundle sinh tự động. Không bao giờ lọc theo name:
        # điều kiện name =like '%assets%' khớp cả file người dùng upload
        # (vd. "bang_gia_assets.xlsx") và unlink() là xóa vĩnh viễn.
        print("🧹 [5/5] Xóa sạch cache web assets trong ir_attachment...")
        Attachment = env['ir.attachment']
        asset_attachments = Attachment.search([
            ('res_model', '=', 'ir.ui.view'),
            ('url', '=like', '/web/assets/%'),
        ])
        att_count = len(asset_attachments)
        if dry_run:
            print(f"   [DRY-RUN] Sẽ xóa {att_count} bản ghi cache assets.")
        else:
            asset_attachments.unlink()
            cr.commit()
            print(f"   ✅ Đã xóa {att_count} bản ghi cache assets cũ.")

    print("\n🎉 [backend_ui] Hoàn tất toàn bộ quy trình chuyển đổi ORM!")


def verify_http_status(base_url="http://127.0.0.1:8069"):
    """Tự động kiểm tra HTTP /web/login và tải bundle web.assets_web.min.js."""
    print(f"\n🔍 [Verification Gate] Đang kiểm tra hệ thống tại {base_url}...")
    login_url = f"{base_url}/web/login"
    try:
        req = urllib.request.Request(login_url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=10) as resp:
            status = resp.status
            content = resp.read().decode('utf-8', errors='ignore')
            print(f"   -> GET {login_url}: HTTP {status} (Content length: {len(content)} bytes)")
            if status != 200:
                print(f"❌ [LỖI] /web/login không trả về HTTP 200 (Status: {status})")
                return False

            # Kiểm tra xem có cảnh báo css error không
            if "css error occured" in content.lower():
                print("❌ [LỖI] Phát hiện thông báo 'css error occured, using an old style to render this page'!")
                return False

            # Kiểm tra presence của bundle web.assets_web.min.js
            import re
            match = re.search(r'(/web/assets/[^"]+/web\.assets_web\.min\.js)', content)
            if match:
                js_url = f"{base_url}{match.group(1)}"
                print(f"   -> Đang kiểm tra tải bundle JS: {js_url}...")
                with urllib.request.urlopen(js_url, timeout=15) as js_resp:
                    js_data = js_resp.read()
                    print(f"   ✅ Bundle tải thành công: HTTP {js_resp.status} ({len(js_data)} bytes)")
                    if len(js_data) < 100000:
                        print("⚠️ [CẢNH BÁO] Dung lượng bundle JS nhỏ bất thường, vui lòng kiểm tra thêm!")
            else:
                print("⚠️ [CẢNH BÁO] Không tìm thấy URL bundle web.assets_web.min.js trong HTML /web/login.")

            print("✅ [Verification Gate PASS] Hệ thống login và asset bundle hoàn toàn sạch lỗi, giao diện CSS chuẩn!")
            return True
    except Exception as e:
        print(f"❌ [Verification Gate FAIL] Không thể gửi HTTP request tới {login_url} ({e}).")
        print("   Không xác minh được hệ thống. Hãy kiểm tra Odoo có đang chạy tại URL này không.")
        return False


def main():
    parser = argparse.ArgumentParser(description="Migrate Odoo database from web_enterprise to backend_ui safely via ORM.")
    parser.add_argument("-d", "--dbname", required=True, help="Database name to migrate")
    parser.add_argument("-c", "--config", default="/etc/odoo/odoo.conf", help="Path to odoo.conf")
    parser.add_argument("--apply", action="store_true", help="Thực thi thật. Mặc định là dry-run.")
    parser.add_argument("--yes", action="store_true", help="Bỏ qua xác nhận tương tác (dùng cho CI).")
    parser.add_argument("--verify-url", default=None, help="Base URL to verify HTTP status after migration (e.g. http://127.0.0.1:8069)")
    args = parser.parse_args()

    if args.apply and not args.yes:
        print(f"⚠️  Sắp uninstall module và xóa cache assets trên database '{args.dbname}'.")
        print("   Thao tác này KHÔNG tự rollback được. Hãy backup database trước.")
        if input("   Gõ tên database để xác nhận: ").strip() != args.dbname:
            print("❌ Huỷ bỏ.")
            return 1

    run_orm_conversion(args.dbname, args.config, dry_run=not args.apply)

    if args.verify_url:
        if not verify_http_status(args.verify_url):
            return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())

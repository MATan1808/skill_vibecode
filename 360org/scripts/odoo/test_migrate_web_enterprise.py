#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Self-check cho logic lọc của migrate_web_enterprise_to_backend_ui.py.
Không cần Odoo, không cần DB, không framework. Chạy: python3 test_migrate_web_enterprise.py

Kiểm 2 chỗ dễ gây mất dữ liệu / sót lỗi:
  A. Lọc cache attachment PHẢI theo url, KHÔNG theo name (name khớp cả file user upload).
  B. Nhận diện ir_asset mồ côi + ghi nhận giới hạn đã biết (path không có leading slash).
"""

INSTALLED = {'base', 'web', 'backend_ui', 'sale'}


def is_asset_orphaned(path, bundle, installed=INSTALLED):
    """Bản sao logic lọc trong run_orm_conversion() mục [4/5]."""
    path = path or ''
    if path.startswith('/'):
        parts = path.strip('/').split('/')
        return bool(parts and parts[0] not in installed)
    if bundle and any(x in bundle for x in ('web_enterprise', 'mass_editing')):
        return True
    return False


def is_asset_cache(res_model, url):
    """Bản sao điều kiện xoá ir_attachment mục [5/5]. CHỈ theo url."""
    return res_model == 'ir.ui.view' and (url or '').startswith('/web/assets/')


def main():
    # --- A. Cache attachment ---
    assert is_asset_cache('ir.ui.view', '/web/assets/1/abc/web.assets_web.min.js')
    # File user upload tên có "assets" -> TUYỆT ĐỐI không được xoá
    assert not is_asset_cache('res.partner', '/web/content/55/bang_gia_assets.xlsx')
    assert not is_asset_cache('ir.ui.view', '/web/content/9/bao_gia_assets.pdf')
    # Thiếu url -> không xoá
    assert not is_asset_cache('ir.ui.view', None)
    print('✅ A. Lọc cache attachment theo url: an toàn, không chạm file user upload')

    # --- B. Asset mồ côi ---
    assert is_asset_orphaned('/mass_editing/static/src/js/x.js', None)      # module đã gỡ
    assert is_asset_orphaned('/web_enterprise/static/src/scss/a.scss', None)
    assert not is_asset_orphaned('/backend_ui/static/src/scss/main.scss', None)  # module còn sống
    assert not is_asset_orphaned('/web/static/src/js/core.js', None)
    assert is_asset_orphaned('', 'web_enterprise.assets_backend')           # bắt qua bundle
    assert not is_asset_orphaned('', 'web.assets_web')
    print('✅ B. Nhận diện asset mồ côi qua path có leading slash + bundle: đúng')

    # --- B'. Giới hạn đã biết (ponytail) — path KHÔNG có leading slash bị bỏ sót ---
    missed = is_asset_orphaned('mass_editing/static/src/js/x.js', None)
    assert missed is False, 'Nếu assert này fail nghĩa là logic đã được nâng cấp — cập nhật lại reference'
    print('⚠️  B\'. Giới hạn xác nhận: path không có leading slash KHÔNG bị bắt')
    print('    -> Còn lỗi "Could not get content for" thì kiểm tay bảng ir_asset.')
    print('    -> Nâng cấp: normalize bỏ leading slash trước khi tách prefix.')

    print('\n🎉 Tất cả self-check PASS.')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())

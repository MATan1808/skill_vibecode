#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import os
import re
import argparse
import sys

# Ngưỡng version deprecation lấy từ NGUỒN SỰ THẬT CHUNG (DRY với odoo_code_migrate.py).
try:
    from odoo_version_rules import RULES
except ImportError:
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    from odoo_version_rules import RULES
_CHANGED_IN = {r["id"]: r["changed_in"] for r in RULES}

# Định nghĩa mã màu terminal đơn giản không phụ thuộc thư viện ngoài
COLOR_RED = "\033[91m"
COLOR_YELLOW = "\033[93m"
COLOR_GREEN = "\033[92m"
COLOR_RESET = "\033[0m"

class OdooLinter:
    def __init__(self, path, version):
        self.path = os.path.abspath(path)
        self.version = float(version)
        self.errors = 0
        self.warnings = 0

    def print_error(self, file, line_num, message):
        print(f"{COLOR_RED}[ERROR] {file}:{line_num}: {message}{COLOR_RESET}")
        self.errors += 1

    def print_warning(self, file, line_num, message):
        print(f"{COLOR_YELLOW}[WARNING] {file}:{line_num}: {message}{COLOR_RESET}")
        self.warnings += 1

    def lint(self):
        print(f"\n🔍 Đang quét lỗi code tiêu chuẩn Odoo v{self.version} tại: {self.path}")
        if not os.path.exists(self.path):
            print(f"{COLOR_RED}❌ Đường dẫn không tồn tại.{COLOR_RESET}")
            sys.exit(1)

        declared_models = []
        secured_model_ids = []

        # Đi bộ qua các thư mục
        for root, dirs, files in os.walk(self.path):
            for file in files:
                filepath = os.path.join(root, file)
                rel_path = os.path.relpath(filepath, self.path)
                
                if file.endswith('.py'):
                    declared_models.extend(self.lint_python(filepath, rel_path))
                elif file.endswith('.xml'):
                    self.lint_xml(filepath, rel_path)
                elif file == 'ir.model.access.csv':
                    secured_model_ids.extend(self.read_secured_model_ids(filepath))

        # Kiểm tra việc thiếu cấu hình phân quyền
        self.check_missing_security(declared_models, secured_model_ids)

        # Tổng kết
        print(f"\n📊 Tổng kết quét lỗi:")
        print(f"  - {COLOR_RED}{self.errors} Lỗi (Errors){COLOR_RESET}")
        print(f"  - {COLOR_YELLOW}{self.warnings} Cảnh báo (Warnings){COLOR_RESET}")
        
        if self.errors > 0:
            print(f"\n{COLOR_RED}❌ Quét thất bại: Đã phát hiện lỗi nghiêm trọng không tuân thủ tiêu chuẩn code!{COLOR_RESET}")
            return False
        else:
            print(f"\n{COLOR_GREEN}✅ Quét thành công: Mã nguồn tuân thủ tốt tiêu chuẩn Odoo v{self.version}!{COLOR_RESET}")
            return True

    def lint_python(self, filepath, rel_path):
        models_found = []
        with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
            lines = f.readlines()

        in_compute_or_onchange = False
        method_line_num = 0
        has_loop = False
        loop_pattern = re.compile(r'\bfor\s+\w+\s+in\s+self\b')

        for idx, line in enumerate(lines):
            line_num = idx + 1
            clean_line = line.strip()

            # 1. Phát hiện khai báo Model name
            model_match = re.search(r"_name\s*=\s*['\"]([^'\"]+)['\"]", clean_line)
            if model_match:
                models_found.append(model_match.group(1))

            # 2. Phát hiện sử dụng API bị deprecated
            if "odoo.osv" in clean_line:
                self.print_error(rel_path, line_num, "Thư viện 'odoo.osv' đã bị khai tử. Hãy dùng models.Model.")
            
            deprecated_env = re.search(r'\b(self\._cr|self\._uid|self\._context)\b', clean_line)
            if deprecated_env:
                self.print_warning(rel_path, line_num, f"Không nên truy cập trực tiếp '{deprecated_env.group(1)}'. Hãy sử dụng 'self.env.cr', 'self.env.uid', 'self.env.context'.")

            # 3. Kiểm tra vòng lặp trong các phương thức compute hoặc onchange
            if clean_line.startswith('@api.depends') or clean_line.startswith('@api.onchange'):
                in_compute_or_onchange = True
                has_loop = False
                method_line_num = line_num
            elif in_compute_or_onchange and clean_line.startswith('def '):
                # Chuyển sang phần thân hàm
                pass
            elif in_compute_or_onchange:
                # Kiểm tra xem có vòng lặp for hay không
                if loop_pattern.search(clean_line):
                    has_loop = True
                
                # Nếu kết thúc hàm (dòng thụt lề về 0 hoặc def mới hoặc dòng trống)
                if clean_line.startswith('def ') or (idx + 1 < len(lines) and lines[idx+1].strip().startswith('@api.')):
                    if not has_loop:
                        self.print_warning(rel_path, method_line_num, "Hàm compute/onchange nên chứa vòng lặp 'for rec in self:' để tránh lỗi SingletonError.")
                    in_compute_or_onchange = False

        return models_found

    def lint_xml(self, filepath, rel_path):
        with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
            content = f.read()

        lines = content.split('\n')

        # 1. Phát hiện attrs trong Odoo 17+ (ngưỡng từ nguồn chung)
        if self.version >= _CHANGED_IN["attrs"]:
            attrs_pattern = re.compile(r'\battrs\s*=\s*["\']')
            for idx, line in enumerate(lines):
                line_num = idx + 1
                if attrs_pattern.search(line):
                    self.print_error(rel_path, line_num, "Không được sử dụng thuộc tính 'attrs' ở Odoo 17+. Hãy viết trực tiếp 'invisible=\"...\"', 'readonly=\"...\"', 'required=\"...\"'.")

        # 2. Phát hiện t-raw trong Odoo 15+ (ngưỡng từ nguồn chung)
        if self.version >= _CHANGED_IN["t-raw"]:
            traw_pattern = re.compile(r'\bt-raw\s*=\s*')
            for idx, line in enumerate(lines):
                line_num = idx + 1
                if traw_pattern.search(line):
                    self.print_error(rel_path, line_num, "Thẻ 't-raw' đã bị loại bỏ vì lý do bảo mật. Hãy sử dụng 't-out' thay thế.")

    def read_secured_model_ids(self, filepath):
        secured_ids = []
        with open(filepath, 'r', encoding='utf-8') as f:
            lines = f.readlines()
        
        for line in lines:
            parts = line.strip().split(',')
            if len(parts) >= 3 and parts[2].startswith('model_'):
                secured_ids.append(parts[2].strip())
        return secured_ids

    def check_missing_security(self, declared_models, secured_model_ids):
        for model in declared_models:
            # Model hệ thống hoặc kế thừa không cần phân quyền mới
            if model in ['res.partner', 'res.users', 'res.company'] or model.startswith('res.'):
                continue
            
            # Chuyển đổi tên model python sang định dạng XML ID (thay thế . bằng _)
            expected_model_id = 'model_' + model.replace('.', '_')
            if expected_model_id not in secured_model_ids:
                self.print_warning("security/ir.model.access.csv", 1, f"Model '{model}' được khai báo nhưng chưa được phân quyền trong file CSV (thiếu ID '{expected_model_id}').")

def main():
    parser = argparse.ArgumentParser(description="Odoo Code Standard Linter (v14-v19)")
    parser.add_argument("--path", required=True, help="Đường dẫn đến thư mục module Odoo")
    parser.add_argument("--version", choices=["14", "15", "16", "17", "18", "19"], default="19", help="Phiên bản Odoo mục tiêu (mặc định: 19)")
    
    args = parser.parse_args()
    linter = OdooLinter(args.path, args.version)
    success = linter.lint()
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()

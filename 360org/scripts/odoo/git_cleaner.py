#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import os
import shutil
import argparse
import sys

COLOR_RED = "\033[91m"
COLOR_GREEN = "\033[92m"
COLOR_CYAN = "\033[96m"
COLOR_RESET = "\033[0m"

# Danh sách các tệp tin và thư mục rác của Agent/logs cần dọn dẹp cho nhánh Production
CLEAN_PATTERNS = [
    ".agents",               # Thư mục rule tùy chỉnh của Agent
    "task.md",               # TODO list của Agent
    "implementation_plan.md",# Kế hoạch của Agent
    "walkthrough.md",        # Báo cáo walkthrough của Agent
    "feedback.json",         # File feedback của Agent
    "eval_metadata.json",    # Metadata kiểm thử
    "grading.json",          # File chấm điểm kiểm thử
    "timing.json",           # File đo thời gian chạy
    "__pycache__",           # Python cache
    ".pytest_cache",         # Pytest cache
    "*.log",                 # Các tệp log
    ".DS_Store"              # macOS system file
]

def clean_production_directory(module_path, dry_run=False):
    print(f"\n{COLOR_CYAN}🧹 Đang chuẩn bị dọn dẹp thư mục để push lên nhánh Production:{COLOR_RESET} {module_path}")
    
    if not os.path.exists(module_path):
        print(f"{COLOR_RED}❌ Lỗi: Thư mục không tồn tại.{COLOR_RESET}")
        sys.exit(1)
        
    cleaned_items = []
    
    for root, dirs, files in os.walk(module_path, topdown=False):
        # 1. Dọn dẹp tệp tin rác
        for file in files:
            filepath = os.path.join(root, file)
            # Kiểm tra xem file có khớp với các pattern cần dọn dẹp không
            should_clean = False
            for pattern in CLEAN_PATTERNS:
                if pattern.startswith("*.") and file.endswith(pattern.replace("*", "")):
                    should_clean = True
                    break
                elif file == pattern:
                    should_clean = True
                    break
            
            if should_clean:
                cleaned_items.append(filepath)
                if not dry_run:
                    os.remove(filepath)
                    
        # 2. Dọn dẹp thư mục rác (như __pycache__ hoặc .agents)
        for d in dirs:
            dirpath = os.path.join(root, d)
            if d in CLEAN_PATTERNS:
                cleaned_items.append(dirpath)
                if not dry_run:
                    shutil.rmtree(dirpath)
                    
    # In kết quả
    if cleaned_items:
        print(f"\n✨ Danh sách các tệp/thư mục đã dọn dẹp:")
        for item in cleaned_items:
            rel_item = os.path.relpath(item, module_path)
            print(f"  [-] {COLOR_RED}{rel_item}{COLOR_RESET}")
        
        if dry_run:
            print(f"\n[Dry Run] Phát hiện {len(cleaned_items)} mục cần dọn dẹp (Chưa thực hiện xóa thực tế).")
        else:
            print(f"\n{COLOR_GREEN}✅ Đã dọn dẹp sạch sẽ {len(cleaned_items)} mục thành công!{COLOR_RESET}")
    else:
        print(f"\n{COLOR_GREEN}✅ Thư mục hoàn toàn sạch sẽ, không có file rác nào!{COLOR_RESET}")

def main():
    parser = argparse.ArgumentParser(description="Odoo Production Code Cleaner")
    parser.add_argument("--path", required=True, help="Đường dẫn đến thư mục module cần dọn dẹp")
    parser.add_argument("--dry-run", action="store_true", help="Chạy thử nghiệm hiển thị file sẽ xóa mà không thực hiện xóa thật")
    
    args = parser.parse_args()
    clean_production_directory(args.path, args.dry_run)

if __name__ == "__main__":
    main()

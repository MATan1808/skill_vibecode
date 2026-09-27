#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import sys
import subprocess
import re
import os

# Định nghĩa các mã màu
COLOR_RED = "\033[91m"
COLOR_YELLOW = "\033[93m"
COLOR_CYAN = "\033[96m"
COLOR_GREEN = "\033[92m"
COLOR_RESET = "\033[0m"

def filter_log_line(line):
    # Trả về True nếu dòng log này quan trọng cần giữ lại
    clean_line = line.strip()
    
    # 1. Giữ các log báo lỗi/cảnh báo nghiêm trọng
    if any(keyword in clean_line for keyword in ["ERROR", "CRITICAL", "WARNING", "WARNING:", "Exception:", "Traceback (most recent call last):"]):
        return True
        
    # 2. Giữ các dòng báo lỗi của unittest/pytest
    if any(clean_line.startswith(p) for p in ["FAIL:", "ERROR:", "FAIL ", "ERROR "]):
        return True
        
    # 3. Giữ các dòng chỉ ra tệp tin lỗi trong Stack Trace (thường thụt lề có chữ File)
    if "File \"" in clean_line and ", line " in clean_line:
        return True
        
    # 4. Giữ các dòng tóm tắt kết quả kiểm thử
    if any(p in clean_line for p in ["Ran ", "tests in", "FAILED (", "OK", "errors=", "failures="]):
        return True
        
    # 5. Các dòng chỉ ra tên hàm test đang chạy bị lỗi
    if clean_line.startswith("def test_") or clean_line.startswith("class Test"):
        return True

    # Lọc bỏ các dòng khác
    return False

def execute_and_filter(command):
    print(f"{COLOR_CYAN}⚡ Đang chạy câu lệnh qua Token Killer Proxy:{COLOR_RESET} {command}\n")
    
    # Tạo thư mục tạm lưu log thô
    raw_log_path = "/tmp/odoo_raw_logs.log"
    
    # Khởi chạy tiến trình
    process = subprocess.Popen(
        command,
        shell=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1
    )
    
    saved_lines = 0
    filtered_lines = 0
    in_traceback = False
    traceback_buffer = []

    with open(raw_log_path, 'w', encoding='utf-8') as raw_file:
        for line in process.stdout:
            # Ghi log thô vào file
            raw_file.write(line)
            
            clean_line = line.strip()
            
            # Quản lý trạng thái log Traceback
            if "Traceback (most recent call last):" in clean_line:
                in_traceback = True
                traceback_buffer = [line]
                continue
                
            if in_traceback:
                traceback_buffer.append(line)
                # Traceback thường kết thúc bằng một dòng không thụt lề chứa tên lỗi
                if clean_line and not line.startswith(" ") and not clean_line.startswith("File "):
                    in_traceback = False
                    # In toàn bộ traceback đã gom
                    for tb_line in traceback_buffer:
                        sys.stdout.write(f"{COLOR_RED}{tb_line}{COLOR_RESET}")
                        saved_lines += 1
                    traceback_buffer = []
                continue

            # Lọc log thông thường
            if filter_log_line(line):
                # Tô màu cho lỗi và cảnh báo
                if "ERROR" in clean_line or "CRITICAL" in clean_line or "FAIL" in clean_line:
                    sys.stdout.write(f"{COLOR_RED}{line}{COLOR_RESET}")
                elif "WARNING" in clean_line:
                    sys.stdout.write(f"{COLOR_YELLOW}{line}{COLOR_RESET}")
                elif "OK" in clean_line or "Ran " in clean_line:
                    sys.stdout.write(f"{COLOR_GREEN}{line}{COLOR_RESET}")
                else:
                    sys.stdout.write(line)
                saved_lines += 1
            else:
                filtered_lines += 1

    process.wait()
    
    # In thống kê token tiết kiệm
    total_lines = saved_lines + filtered_lines
    if total_lines > 0:
        savings = (filtered_lines / total_lines) * 100
        print(f"\n{COLOR_CYAN}📉 Thống kê Token Killer:{COLOR_RESET}")
        print(f"  - Tổng số dòng log thô: {total_lines}")
        print(f"  - Số dòng hiển thị: {saved_lines}")
        print(f"  - Số dòng đã lược bỏ: {filtered_lines}")
        print(f"  - {COLOR_GREEN}Tỷ lệ tiết kiệm token: {savings:.2f}%{COLOR_RESET}")
        print(f"  - Xem toàn bộ log thô tại: [odoo_raw_logs.log](file://{raw_log_path})")

    sys.exit(process.returncode)

def main():
    if len(sys.argv) < 2:
        print("❌ Lỗi: Thiếu câu lệnh cần chạy.")
        print("Sử dụng: python token_killer_proxy.py \"<câu_lệnh_chạy_odoo_hoặc_test>\"")
        sys.exit(1)
        
    command = sys.argv[1]
    execute_and_filter(command)

if __name__ == "__main__":
    main()

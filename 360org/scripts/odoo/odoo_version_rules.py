#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
odoo_version_rules.py — NGUỒN SỰ THẬT CHUNG về deprecation theo version Odoo.

Dùng chung bởi:
  - odoo_linter.py       (DETECT: cảnh báo code không hợp version)
  - odoo_code_migrate.py (TRANSFORM: rewrite khi backport/nâng version)

Tách ra đây để KHÔNG khai báo luật version ở 2 nơi (DRY). Transform cụ thể nằm
ở odoo_code_migrate.py; file này chỉ giữ *facts* (đổi gì, bỏ từ version nào).
"""

# 'changed_in' = version bắt đầu áp dụng thay đổi (feature cũ bị bỏ / khuyến nghị mới).
# 'auto' = True nếu rewrite máy móc an toàn 100%; False = chỉ flag cho người.
RULES = [
    {
        "id": "osv",
        "changed_in": 10,
        "detect": r"\bodoo\.osv\b|\bfrom\s+osv\b",
        "filetypes": ["py"],
        "auto": False,
        "desc": "odoo.osv đã khai tử → dùng models.Model.",
    },
    {
        "id": "t-raw",
        "changed_in": 15,
        "detect": r"\bt-raw\s*=",
        "filetypes": ["xml"],
        "auto": True,
        "desc": "t-raw bị bỏ (bảo mật) ở v15+ → dùng t-out.",
    },
    {
        "id": "attrs",
        "changed_in": 17,
        "detect": r"\battrs\s*=\s*[\"']",
        "filetypes": ["xml"],
        "auto": "partial",  # đơn giản thì auto, phức tạp thì flag
        "desc": "attrs= bị bỏ ở v17+ → invisible=/readonly=/required= trực tiếp.",
    },
    {
        "id": "states_attr",
        "changed_in": 17,
        "detect": r"\bstates\s*=\s*[\"']",
        "filetypes": ["xml"],
        "auto": False,
        "desc": "Thuộc tính 'states' trên field XML bị bỏ ở v17+ → dùng invisible/readonly theo state.",
    },
    {
        "id": "sql_constraints",
        "changed_in": 18,
        "detect": r"_sql_constraints\s*=",
        "filetypes": ["py"],
        "auto": False,
        "desc": "_sql_constraints → models.Constraint() (khuyến nghị v18+).",
    },
    {
        "id": "index_true",
        "changed_in": 18,
        "detect": r"index\s*=\s*True",
        "filetypes": ["py"],
        "auto": False,
        "desc": "index=True → models.Index() (khuyến nghị v18+).",
    },
    {
        "id": "tree_tag",
        "changed_in": 18,
        "detect": r"<tree\b|view_mode\s*=\s*[\"'][^\"']*\btree\b",
        "filetypes": ["xml"],
        "auto": False,
        "desc": "Thẻ <tree> đổi tên thành <list> ở v18+ (tree vẫn alias, nên chuyển dần).",
    },
]


def rules_active_at(version_major):
    """Rules áp dụng cho code viết ở version này (dùng cho linter DETECT)."""
    return [r for r in RULES if version_major >= r["changed_in"]]


def rules_between(from_major, to_major):
    """Rules kích hoạt khi NÂNG từ from→to: changed_in nằm trong (from, to]."""
    lo, hi = min(from_major, to_major), max(from_major, to_major)
    return [r for r in RULES if lo < r["changed_in"] <= hi]


def _self_check():
    ids = lambda rs: sorted(r["id"] for r in rs)
    # Nâng 16→17 phải kích hoạt attrs + states (changed_in=17), không dính t-raw (15).
    assert ids(rules_between(16, 17)) == ["attrs", "states_attr"], ids(rules_between(16, 17))
    # Nâng 14→19 dính tất cả từ 15 trở lên.
    got = ids(rules_between(14, 19))
    assert "t-raw" in got and "attrs" in got and "sql_constraints" in got, got
    assert "osv" not in got, "osv changed_in=10, ngoài khoảng 14→19"
    # Linter ở v17 thấy attrs & t-raw nhưng chưa thấy sql_constraints (18).
    at17 = ids(rules_active_at(17))
    assert "attrs" in at17 and "t-raw" in at17 and "sql_constraints" not in at17, at17
    print("odoo_version_rules self-check PASS")
    return True


if __name__ == "__main__":
    _self_check()

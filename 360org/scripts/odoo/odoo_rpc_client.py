#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
odoo_rpc_client.py — Client JSON-RPC thuần stdlib để thao tác Website trên
Odoo Online/SaaS hoặc Odoo.sh khi KHÔNG có quyền cài module custom (không SSH,
không filesystem, không --addons-path). Đây là kỹ thuật THAY THẾ cho luồng
module-based (odoo_generator.py + templates/website_snippet.xml.tmpl) — xem
references/website-builder-and-snippets.md §11 để biết khi nào dùng cái nào.

Cấu hình qua biến môi trường (khuyên dùng file `.env` ở project, KHÔNG commit):
  ODOO_URL, ODOO_DB, ODOO_USER, ODOO_PASSWORD, ODOO_ALLOW_HTTP=true (chỉ khi test local http)

Luật cứng an toàn: mọi lệnh ghi (--push-page, --push-css) TỰ ĐỘNG backup nội
dung cũ vào .tmp/ trước khi ghi đè — không cần cờ riêng.

Chỉ dùng thư viện chuẩn (urllib), Python 3.9+.
`python odoo_rpc_client.py --self-check` để kiểm logic thuần (không cần kết nối Odoo thật).
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
import urllib.error
import urllib.request

C_RED = "\033[91m"; C_GREEN = "\033[92m"; C_YELLOW = "\033[93m"; C_CYAN = "\033[96m"; C_RESET = "\033[0m"


def log(m): print(f"{C_CYAN}[odoo-rpc]{C_RESET} {m}")
def warn(m): print(f"  {C_YELLOW}[!]{C_RESET} {m}")
def err(m): sys.exit(f"{C_RED}[lỗi]{C_RESET} {m}")


# --------------------------------------------------------------------------- #
# LOGIC THUẦN — test được qua --self-check, không cần mạng
# --------------------------------------------------------------------------- #

def load_dotenv(path=".env"):
    """Parser .env tối giản (KEY=VALUE mỗi dòng, bỏ qua comment/dòng trống). Không ghi đè env đã có sẵn."""
    if not os.path.exists(path):
        return
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, val = line.partition("=")
            key = key.strip()
            if key and key not in os.environ:
                os.environ[key] = val.strip()


def url_to_slug(url: str) -> str:
    return url.strip("/").replace("/", "_") or "home"


QWEB_WRAPPER = """<t t-name="website.{key}">
  <t t-call="website.layout">
    <t t-set="pageName" t-value="'{name}'"/>
    <div id="wrap" class="oe_structure">
{content}
    </div>
  </t>
</t>"""


def wrap_arch(content: str, url: str, name: str) -> str:
    """Bọc HTML thô thành QWeb template nếu chưa bọc. Không tự thêm nếu content đã có t-name."""
    content = content.strip()
    if content.startswith("<t t-name="):
        return content
    key = "page_" + url_to_slug(url)
    indented = "\n".join("    " + line for line in content.splitlines())
    return QWEB_WRAPPER.format(key=key, name=name.replace("'", "\\'"), content=indented)


def replace_css_block(head: str, marker: str, new_css: str) -> str:
    """Xoá block CSS cũ (đánh dấu bằng comment marker) rồi nối block mới — dùng cho custom_code_head.
    Không bao giờ append trùng lặp; marker phải là CSS comment bên trong <style>."""
    start = f"/* == {marker} start == */"
    end = f"/* == {marker} end == */"
    pattern = re.escape(start) + r".*?" + re.escape(end)
    head = re.sub(pattern, "", head or "", flags=re.DOTALL).strip()
    block = f"<style>\n{start}\n{new_css.strip()}\n{end}\n</style>"
    return (head + "\n" + block).strip()


# --------------------------------------------------------------------------- #
# RPC CLIENT — chỉ chạm mạng khi thực sự gọi
# --------------------------------------------------------------------------- #

class OdooRPCClient:
    def __init__(self):
        self.url = os.getenv("ODOO_URL", "").rstrip("/")
        self.db = os.getenv("ODOO_DB", "")
        self.user = os.getenv("ODOO_USER", "")
        self.password = os.getenv("ODOO_PASSWORD", "")

        if not all([self.url, self.db, self.user, self.password]):
            err("Thiếu credential. Cần ODOO_URL, ODOO_DB, ODOO_USER, ODOO_PASSWORD trong .env hoặc env.")

        if self.url.startswith("http://") and os.getenv("ODOO_ALLOW_HTTP", "").lower() != "true":
            err("ODOO_URL dùng HTTP thuần — mật khẩu sẽ gửi dạng cleartext. "
                "Đặt ODOO_ALLOW_HTTP=true nếu chắc chắn (chỉ dùng cho local test), hoặc đổi sang https://.")

        self.uid = None
        self._req_id = 0
        self._cookie = None

    def _next_id(self):
        self._req_id += 1
        return self._req_id

    def _post(self, endpoint, params):
        payload = json.dumps({"jsonrpc": "2.0", "method": "call", "id": self._next_id(), "params": params}).encode("utf-8")
        req = urllib.request.Request(f"{self.url}{endpoint}", data=payload, headers={"Content-Type": "application/json"})
        if self._cookie:
            req.add_header("Cookie", self._cookie)
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                if not self._cookie:
                    set_cookie = resp.headers.get("Set-Cookie")
                    if set_cookie:
                        self._cookie = set_cookie.split(";")[0]
                body = json.loads(resp.read().decode("utf-8"))
        except urllib.error.URLError as e:
            raise RuntimeError(f"Lỗi HTTP gọi {endpoint}: {e}") from e

        if "error" in body:
            e = body["error"]
            raise RuntimeError(f"Odoo trả lỗi: {e.get('data', {}).get('message') or e.get('message', e)}")
        return body["result"]

    def authenticate(self):
        result = self._post("/web/session/authenticate", {"db": self.db, "login": self.user, "password": self.password})
        uid = result.get("uid") if isinstance(result, dict) else None
        if not uid:
            raise RuntimeError("Đăng nhập thất bại — kiểm tra ODOO_USER / ODOO_PASSWORD.")
        self.uid = uid
        self.password = None  # không giữ password sau khi đã có session cookie
        return uid

    def _execute_kw(self, model, method, args, kwargs=None):
        if self.uid is None:
            self.authenticate()
        return self._post("/web/dataset/call_kw", {"model": model, "method": method, "args": args, "kwargs": kwargs or {}})

    def search_read(self, model, domain=None, fields=None, limit=0):
        return self._execute_kw(model, "search_read", [domain or []], {"fields": fields or [], "limit": limit})

    def read(self, model, ids, fields=None):
        return self._execute_kw(model, "read", [ids], {"fields": fields or []})

    def create(self, model, values):
        return self._execute_kw(model, "create", [values])

    def write(self, model, ids, values):
        return self._execute_kw(model, "write", [ids, values])


# --------------------------------------------------------------------------- #
# LỆNH CLI
# --------------------------------------------------------------------------- #

def backup(tmp_dir, name, content):
    os.makedirs(tmp_dir, exist_ok=True)
    path = os.path.join(tmp_dir, name)
    with open(path, "w", encoding="utf-8") as f:
        f.write(content or "")
    log(f"Đã backup vào {path}")


def cmd_list_pages(c):
    # search_read trên website.page có thể trả rỗng trên Odoo Online SaaS dù có data —
    # đây là quirk đã biết, không phải bug của script này.
    pages = c.search_read("website.page", [], ["url", "name", "is_published"], limit=200)
    if not pages:
        warn("0 trang — nếu site chắc chắn có trang, đây là quirk search_read của Odoo Online SaaS, "
             "thử đọc trực tiếp bằng ID hoặc domain cụ thể hơn.")
        return
    for p in sorted(pages, key=lambda x: x["url"] or ""):
        state = "published" if p["is_published"] else "draft"
        print(f"  {p['url']:<40} {state:<10} {p['name']}")


def cmd_get_page(c, url, tmp_dir):
    pages = c.search_read("website.page", [("url", "=", url)], ["id", "name", "view_id"])
    if not pages:
        err(f"Không tìm thấy trang tại {url}. Lưu ý: trang '/' không phải website.page — "
            "xem gotcha 'Homepage routing' trong references/website-builder-and-snippets.md §11.")
    view_id = pages[0]["view_id"]
    view_id = view_id[0] if isinstance(view_id, (list, tuple)) else view_id
    arch = c.read("ir.ui.view", [view_id], ["arch"])[0]["arch"]
    backup(tmp_dir, f"backup_{url_to_slug(url)}.html", arch)
    print(arch)


def cmd_push_page(c, args, tmp_dir):
    if args.update:
        pages = c.search_read("website.page", [("url", "=", args.url)], ["id", "name", "view_id"])
        if not pages:
            err(f"Không có trang tại {args.url} để --update. Dùng --create.")
        view_id = pages[0]["view_id"]
        view_id = view_id[0] if isinstance(view_id, (list, tuple)) else view_id
        old_arch = c.read("ir.ui.view", [view_id], ["arch"])[0]["arch"]
        backup(tmp_dir, f"backup_{url_to_slug(args.url)}.html", old_arch)
        with open(args.file, "r", encoding="utf-8") as f:
            content = f.read()
        arch = wrap_arch(content, args.url, args.name or pages[0]["name"])
        c.write("ir.ui.view", [view_id], {"arch": arch})
        log(f"Đã cập nhật view ID {view_id} cho {args.url}")
    else:  # --create
        if not args.name:
            err("--name bắt buộc khi --create")
        existing = c.search_read("website.page", [("url", "=", args.url)], ["id"])
        if existing:
            err(f"Trang tại {args.url} đã tồn tại (ID {existing[0]['id']}) — dùng --update.")
        with open(args.file, "r", encoding="utf-8") as f:
            content = f.read()
        arch = wrap_arch(content, args.url, args.name)
        key = f"website.page_{url_to_slug(args.url)}"
        view_id = c.create("ir.ui.view", {"name": args.name, "type": "qweb", "key": key, "arch": arch})
        page_id = c.create("website.page", {"name": args.name, "url": args.url, "view_id": view_id, "website_published": False})
        log(f"Đã tạo website.page ID {page_id} tại {args.url} (CHƯA publish — dùng --publish để lên live)")


def cmd_publish(c, url, publish):
    pages = c.search_read("website.page", [("url", "=", url)], ["id", "name"])
    if not pages:
        err(f"Không tìm thấy trang tại {url}")
    c.write("website.page", [pages[0]["id"]], {"website_published": publish})
    log(f"Trang '{pages[0]['name']}' ({url}) đã {'publish' if publish else 'unpublish'}")


def cmd_push_css(c, css_file, marker, tmp_dir):
    with open(css_file, "r", encoding="utf-8") as f:
        new_css = f.read()
    sites = c.search_read("website", [], ["id", "custom_code_head"])
    if not sites:
        err("Không đọc được record website — kiểm quyền write trên model 'website'.")
    site = sites[0]
    backup(tmp_dir, f"backup_custom_code_head_{marker}.html", site.get("custom_code_head") or "")
    new_head = replace_css_block(site.get("custom_code_head") or "", marker, new_css)
    c.write("website", [site["id"]], {"custom_code_head": new_head})
    log(f"Đã đẩy CSS block '{marker}' vào custom_code_head (website ID {site['id']})")


# --------------------------------------------------------------------------- #
def self_check() -> bool:
    ok = True

    slug = url_to_slug("/about/team/")
    if slug != "about_team":
        warn(f"url_to_slug sai: {slug}"); ok = False

    if url_to_slug("/") != "home":
        warn("url_to_slug('/') phải là 'home'"); ok = False

    arch = wrap_arch("<section>hi</section>", "/about", "About")
    if "t-name=\"website.page_about\"" not in arch or "<section>hi</section>" not in arch:
        warn("wrap_arch không bọc đúng QWeb wrapper"); ok = False

    already = wrap_arch('<t t-name="website.custom">x</t>', "/x", "X")
    if already != '<t t-name="website.custom">x</t>':
        warn("wrap_arch không được bọc lại content đã có t-name"); ok = False

    head = "<style>\n/* == hero start == */\nold{}\n/* == hero end == */\n</style>"
    new_head = replace_css_block(head, "hero", "new{color:red}")
    if "old{}" in new_head or "new{color:red}" not in new_head:
        warn("replace_css_block không xoá block cũ / không chèn block mới đúng"); ok = False
    if new_head.count("hero start") != 1:
        warn("replace_css_block để lặp marker khi gọi 2 lần"); ok = False
    new_head2 = replace_css_block(new_head, "hero", "another{}")
    if new_head2.count("hero start") != 1 or "new{color:red}" in new_head2:
        warn("replace_css_block gọi lần 2 phải thay hẳn block cũ, không cộng dồn"); ok = False

    if ok:
        print(f"{C_GREEN}self-check PASS{C_RESET} (url_to_slug/wrap_arch/replace_css_block)")
    return ok


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--self-check", action="store_true")
    ap.add_argument("--env-file", default=".env", help="Đường dẫn file .env (mặc định .env ở cwd)")
    ap.add_argument("--tmp-dir", default=".tmp", help="Thư mục lưu backup (mặc định .tmp)")

    ap.add_argument("--list-pages", action="store_true")
    ap.add_argument("--get-page", metavar="URL")
    ap.add_argument("--push-page", action="store_true")
    ap.add_argument("--create", action="store_true")
    ap.add_argument("--update", action="store_true")
    ap.add_argument("--publish", metavar="URL")
    ap.add_argument("--unpublish", metavar="URL")
    ap.add_argument("--push-css", metavar="CSS_FILE")
    ap.add_argument("--marker", help="Tên block CSS (dùng với --push-css), vd: hero-fix")
    ap.add_argument("--url", help="URL trang (dùng với --push-page)")
    ap.add_argument("--name", help="Tên trang (dùng với --push-page --create)")
    ap.add_argument("--file", help="File HTML nguồn (dùng với --push-page)")

    args = ap.parse_args()

    if args.self_check:
        sys.exit(0 if self_check() else 1)

    load_dotenv(args.env_file)
    c = OdooRPCClient()

    if args.list_pages:
        cmd_list_pages(c)
    elif args.get_page:
        cmd_get_page(c, args.get_page, args.tmp_dir)
    elif args.push_page:
        if not args.url or not args.file or not (args.create or args.update):
            err("--push-page cần --url --file và (--create hoặc --update)")
        cmd_push_page(c, args, args.tmp_dir)
    elif args.publish:
        cmd_publish(c, args.publish, True)
    elif args.unpublish:
        cmd_publish(c, args.unpublish, False)
    elif args.push_css:
        if not args.marker:
            err("--push-css cần --marker để đánh dấu block (tránh ghi trùng)")
        cmd_push_css(c, args.push_css, args.marker, args.tmp_dir)
    else:
        ap.print_help()


if __name__ == "__main__":
    main()

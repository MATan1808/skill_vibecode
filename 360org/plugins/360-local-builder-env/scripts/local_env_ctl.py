#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
360-local-builder-env: Odoo Docker Dev & Migration Environment Controller
Author: 360org <support@360.org.vn>
"""

import os
import sys
import re
import json
import socket
import shutil
import argparse
import subprocess
from pathlib import Path

ROOT_WORK_DIR = Path("/mnt/DATA/work")
PORT_POOLS = {
    "14.0": (1400, 1499),
    "15.0": (1500, 1599),
    "16.0": (1600, 1699),
    "17.0": (1700, 1799),
    "18.0": (1800, 1899),
    "19.0": (1900, 1999),
}

POSTGRES_IMAGES = {
    "14.0": "postgres:16-alpine",
    "15.0": "360ai/postgres:15-ai",
    "16.0": "360ai/postgres:15-ai",
    "17.0": "360ai/postgres:15-ai",
    "18.0": "360ai/postgres:15-ai",
    "19.0": "360ai/postgres:15-ai",
}

def is_port_in_use(port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.settimeout(0.5)
        return s.connect_ex(("127.0.0.1", port)) == 0

def find_free_port(version: str, offset_try: int = 0) -> int:
    v_key = version if version.endswith(".0") else f"{version}.0"
    if v_key not in PORT_POOLS:
        v_key = "15.0"
    start, end = PORT_POOLS[v_key]
    # Cố định port xx00 cho base default run, các project cấp phát từ xx01 đến xx99
    scan_start = max(start + 1, start + offset_try)
    for p in range(scan_start, end + 1):
        if not is_port_in_use(p):
            return p
    raise RuntimeError(f"Hết port trống trong dải {start}-{end} cho Odoo {version}!")

def ensure_gitlab_repo(client_dir: Path, client_name: str):
    git_dir = client_dir / ".git"
    gitignore_file = client_dir / ".gitignore"

    # Tạo .gitignore theo đúng chuẩn nghiệp vụ: chỉ ignore sessions, logs, ds_store, cache
    expected_gitignore = """# 360 Local Dev Gitignore
env/*/sessions/
*.log
.DS_Store
cache*
"""
    if not gitignore_file.exists():
        with open(gitignore_file, "w", encoding="utf-8") as f:
            f.write(expected_gitignore)
    else:
        content = gitignore_file.read_text(encoding="utf-8")
        if "env/*/sessions/" not in content:
            with open(gitignore_file, "a", encoding="utf-8") as f:
                f.write("\n# Added by 360-local-builder-env\nenv/*/sessions/\n*.log\n.DS_Store\ncache*\n")

    if not git_dir.exists():
        print(f"[*] Khởi tạo Git repo cho client: {client_name}...")
        subprocess.run(["git", "init"], cwd=str(client_dir), check=True)
        remote_url = f"git@gitlab.com:v-clients/{client_name}.git"
        subprocess.run(["git", "remote", "add", "origin", remote_url], cwd=str(client_dir), check=True)
        print(f"[+] Đã gắn remote origin: {remote_url}")

def sync_gitlab(client_name: str, message: str = "chore: update client workspace data"):
    client_dir = ROOT_WORK_DIR / client_name
    if not (client_dir / ".git").exists():
        ensure_gitlab_repo(client_dir, client_name)

    print(f"[*] Tiến hành commit và push GitLab cho {client_name}...")
    try:
        subprocess.run(["git", "add", "."], cwd=str(client_dir), check=True)
        diff = subprocess.run(["git", "status", "--porcelain"], cwd=str(client_dir), capture_output=True, text=True)
        if diff.stdout.strip():
            full_msg = f"{message}\n\nAuthored-By: 360org <support@360.org.vn>"
            subprocess.run(["git", "commit", "-m", full_msg], cwd=str(client_dir), check=True)
            print(f"[+] Đã commit dữ liệu.")
        else:
            print(f"[*] Không có thay đổi mới cần commit.")

        push_res = subprocess.run(["git", "push", "-u", "origin", "HEAD:main"], cwd=str(client_dir), capture_output=True, text=True)
        if push_res.returncode == 0:
            print(f"[+] Push GitLab thành công!")
        else:
            print(f"[!] Thông báo push GitLab: {push_res.stderr.strip()}")
    except Exception as e:
        print(f"[!] Lỗi khi sync gitlab: {e}")

def detect_db_dump(db_path: Path):
    if not db_path or not db_path.exists():
        return None
    if db_path.is_file():
        return db_path

    candidates = list(db_path.glob("*.dump")) + list(db_path.glob("*.sql")) + list(db_path.glob("*.sql.gz")) + list(db_path.glob("*.zip"))
    if not candidates:
        return None
    candidates.sort(key=lambda x: x.stat().st_mtime, reverse=True)
    return candidates[0]

def render_template(tpl_path: Path, dest_path: Path, context: dict):
    with open(tpl_path, "r", encoding="utf-8") as f:
        content = f.read()

    for k, v in context.items():
        if isinstance(v, (str, int)):
            content = content.replace(f"{{{{ {k} }}}}", str(v))

    if context.get("db_name"):
        content = re.sub(r"\{%\s*if\s+db_name\s*%\}(.*?)\{%\s*endif\s*%\}", r"\1", content, flags=re.DOTALL)
    else:
        content = re.sub(r"\{%\s*if\s+db_name\s*%\}(.*?)\{%\s*endif\s*%\}", "", content, flags=re.DOTALL)

    if context.get("longpolling_port"):
        content = re.sub(r"\{%\s*if\s+longpolling_port\s*%\}(.*?)\{%\s*endif\s*%\}", r"\1", content, flags=re.DOTALL)
    else:
        content = re.sub(r"\{%\s*if\s+longpolling_port\s*%\}(.*?)\{%\s*endif\s*%\}", "", content, flags=re.DOTALL)

    addons_block = ""
    for m in context.get("mounted_addons", []):
        addons_block += f"\n      - {m['host_path']}:{m['container_path']}"
    content = content.replace("{{ mounted_addons_yaml }}", addons_block)

    with open(dest_path, "w", encoding="utf-8") as f:
        f.write(content)

def up_env(client_name: str, version: str, role: str = "source", db_file: str = None):
    client_dir = ROOT_WORK_DIR / client_name
    if not client_dir.exists():
        print(f"[*] Thư mục client chưa tồn tại, tự động tạo: {client_dir}")
        client_dir.mkdir(parents=True, exist_ok=True)

    # Tạo các thư mục con tiêu chuẩn
    for sub in ["modules/default", "modules/extra", "modules/themes", "upgraded/default", "upgraded/extra", "upgraded/themes", "db_backup", "docs"]:
        (client_dir / sub).mkdir(parents=True, exist_ok=True)

    # Đảm bảo Git repo kết nối gitlab
    ensure_gitlab_repo(client_dir, client_name)

    v_str = version if version.endswith(".0") else f"{version}.0"
    v_short = v_str.split(".")[0]
    env_name = f"v{v_short}_{role}"
    env_dir = client_dir / "env" / env_name
    env_dir.mkdir(parents=True, exist_ok=True)
    (env_dir / "data").mkdir(parents=True, exist_ok=True)
    (env_dir / "filestore").mkdir(parents=True, exist_ok=True)
    (env_dir / "sessions").mkdir(parents=True, exist_ok=True)

    # Cấp phát port tự động trong dải 99 ports
    web_port = find_free_port(v_str)
    longpolling_port = web_port + 50 if v_str in ["14.0", "15.0"] else None
    db_host_port = 50000 + web_port

    # Tên định danh Docker
    safe_client = client_name.replace(".", "_").replace("-", "_")
    network_name = f"net_{safe_client}_{env_name}"
    db_container_name = f"{safe_client}_{env_name}_db"
    odoo_container_name = f"{safe_client}_{env_name}_odoo"

    # Docker Images
    # Docker Images: Kế thừa image local override hoặc fallback pull từ GitLab Registry
    odoo_image = f"odoo:{v_str}"
    registry_image = f"registry.gitlab.com/vuahethong/demo/odoo:{v_str}"
    
    # Kiểm tra xem local đã có image chưa, nếu chưa có thì tự động pull từ GitLab Registry
    inspect_img = subprocess.run(["docker", "image", "inspect", odoo_image], capture_output=True)
    if inspect_img.returncode != 0 and v_str in ["16.0", "17.0", "18.0", "19.0"]:
        print(f"[*] Local chưa có image {odoo_image}, tự động pull từ GitLab Registry...")
        pull_res = subprocess.run(["docker", "pull", registry_image])
        if pull_res.returncode == 0:
            subprocess.run(["docker", "tag", registry_image, odoo_image])
    db_image = POSTGRES_IMAGES.get(v_str, "360ai/postgres:15-ai")

    # Addons paths
    mounted_addons = []
    addons_paths_list = ["/usr/lib/python3/dist-packages/odoo/addons"]

    # Mount core version default / addons / themes tương ứng
    core_default_dir = ROOT_WORK_DIR / v_str / "default"
    if core_default_dir.exists():
        mounted_addons.append({
            "host_path": str(core_default_dir),
            "container_path": "/mnt/odoo-default"
        })
        addons_paths_list.append("/mnt/odoo-default")

    core_addons_dir = ROOT_WORK_DIR / v_str / "addons"
    if core_addons_dir.exists():
        mounted_addons.append({
            "host_path": str(core_addons_dir),
            "container_path": "/mnt/odoo-addons"
        })
        addons_paths_list.append("/mnt/odoo-addons")

    core_themes_dir = ROOT_WORK_DIR / v_str / "themes"
    if core_themes_dir.exists():
        mounted_addons.append({
            "host_path": str(core_themes_dir),
            "container_path": "/mnt/odoo-themes"
        })
        addons_paths_list.append("/mnt/odoo-themes")

    core_extra_dir = ROOT_WORK_DIR / v_str / "extra"
    if core_extra_dir.exists():
        mounted_addons.append({
            "host_path": str(core_extra_dir),
            "container_path": "/mnt/odoo-extra"
        })
        addons_paths_list.append("/mnt/odoo-extra")

    # Mount client modules
    target_modules_dir = client_dir / ("upgraded" if role == "target" else "modules")
    if target_modules_dir.exists():
        mounted_addons.append({
            "host_path": str(target_modules_dir),
            "container_path": "/mnt/client-addons"
        })
        addons_paths_list.append("/mnt/client-addons")
        for sub_mod in ["default", "extra", "themes"]:
            sub_p = target_modules_dir / sub_mod
            if sub_p.exists():
                addons_paths_list.append(f"/mnt/client-addons/{sub_mod}")

    # Render docker-compose.yml
    tpl_dir = Path(__file__).parent / "templates"
    compose_dest = env_dir / "docker-compose.yml"
    db_volume_name = f"vol_{db_container_name}_pgdata"
    render_template(tpl_dir / "docker-compose.template.yml", compose_dest, {
        "network_name": network_name,
        "db_image": db_image,
        "db_container_name": db_container_name,
        "db_volume_name": db_volume_name,
        "db_host_port": db_host_port,
        "odoo_image": odoo_image,
        "odoo_container_name": odoo_container_name,
        "web_port": web_port,
        "longpolling_port": longpolling_port,
        "mounted_addons": mounted_addons
    })

    # Render odoo.conf
    db_name = f"{safe_client}_{env_name}"
    conf_dest = env_dir / "odoo.conf"
    render_template(tpl_dir / "odoo.conf.template", conf_dest, {
        "addons_path": ",".join(addons_paths_list),
        "db_name": db_name
    })

    # Metadata lưu thông tin env
    meta_file = env_dir / "env_info.json"
    with open(meta_file, "w", encoding="utf-8") as f:
        json.dump({
            "client": client_name,
            "version": v_str,
            "role": role,
            "web_port": web_port,
            "longpolling_port": longpolling_port,
            "db_host_port": db_host_port,
            "db_name": db_name,
            "db_container": db_container_name,
            "odoo_container": odoo_container_name,
            "env_dir": str(env_dir)
        }, f, indent=2)

    print(f"\n=======================================================")
    print(f"🚀 KHỞI ĐỘNG DOCKER DEV ENV: {client_name} ({env_name})")
    print(f"=======================================================")
    print(f"• Odoo Version: {v_str} ({odoo_image})")
    print(f"• Web Port:     {web_port} (Dải 99 ports: {PORT_POOLS[v_str][0]}-{PORT_POOLS[v_str][1]})")
    print(f"• DB Host Port: {db_host_port}")
    print(f"• Containers:   {odoo_container_name} | {db_container_name}")
    print(f"• Env Dir:      {env_dir}")
    print(f"-------------------------------------------------------")

    # Start docker compose
    cmd_up = ["docker", "compose", "-p", f"{safe_client}_{env_name}", "-f", str(compose_dest), "up", "-d"]
    subprocess.run(cmd_up, check=True)

    # Phục hồi DB nếu có
    dump_target = None
    if db_file:
        dump_target = Path(db_file)
    else:
        dump_target = detect_db_dump(client_dir / "db_backup")

    if dump_target and dump_target.exists():
        restore_database(db_container_name, dump_target, db_name, env_dir / "filestore")
    else:
        print(f"[*] Chưa có file dump chỉ định, DB '{db_name}' sẽ được tạo tự động khi truy cập.")

    print(f"\n✅ ĐÃ DỰNG THÀNH CÔNG MÔI TRƯỜNG DEV:")
    print(f"👉 URL Web:      http://192.168.1.100:{web_port}")
    print(f"👉 DBeaver/DB:   192.168.1.100:{db_host_port} (User: odoo / Pass: odoo / DB: {db_name})")
    print(f"👉 Account Odoo: admin / admin")
    print(f"=======================================================\n")

def restore_database(db_container: str, dump_path: Path, db_name: str, filestore_dir: Path):
    print(f"\n[*] Đang tự động nạp database từ: {dump_path} vào container {db_container}...")

    subprocess.run(["docker", "exec", db_container, "sh", "-c",
                    "until pg_isready -U odoo -d postgres; do sleep 1; done"], check=True)

    subprocess.run(["docker", "exec", db_container, "dropdb", "-U", "odoo", "--if-exists", db_name], check=False)
    subprocess.run(["docker", "exec", db_container, "createdb", "-U", "odoo", "-O", "odoo", db_name], check=True)

    container_dump = f"/tmp/{dump_path.name}"
    subprocess.run(["docker", "cp", str(dump_path), f"{db_container}:{container_dump}"], check=True)

    if dump_path.suffix == ".dump":
        print("[*] Phục hồi bằng pg_restore (Custom format)...")
        subprocess.run(["docker", "exec", db_container, "pg_restore", "-U", "odoo", "-d", db_name,
                        "--no-owner", "--no-acl", container_dump], capture_output=True)
    elif dump_path.suffix == ".sql":
        print("[*] Phục hồi bằng psql (Plain SQL)...")
        subprocess.run(["docker", "exec", db_container, "sh", "-c",
                        f"psql -U odoo -d \"{db_name}\" < {container_dump}"], check=True)
    elif dump_path.suffix == ".zip":
        print("[*] Phát hiện file zip Odoo backup, đang giải nén...")
        import zipfile
        tmp_unzip = Path(f"/tmp/unzip_{db_name}")
        tmp_unzip.mkdir(parents=True, exist_ok=True)
        with zipfile.ZipFile(dump_path, "r") as z:
            z.extractall(tmp_unzip)

        src_filestore = tmp_unzip / "filestore"
        if src_filestore.exists():
            print(f"[*] Copying filestore to {filestore_dir}...")
            shutil.copytree(src_filestore, filestore_dir / db_name, dirs_exist_ok=True)

        sql_dump = tmp_unzip / "dump.sql"
        if sql_dump.exists():
            subprocess.run(["docker", "cp", str(sql_dump), f"{db_container}:/tmp/dump.sql"], check=True)
            subprocess.run(["docker", "exec", db_container, "sh", "-c",
                            f"psql -U odoo -d \"{db_name}\" < /tmp/dump.sql"], check=True)
        shutil.rmtree(tmp_unzip, ignore_errors=True)

    subprocess.run(["docker", "exec", db_container, "rm", "-f", container_dump], check=False)
    print(f"[+] Phục hồi DB '{db_name}' hoàn tất!")

def down_env(client_name: str, version: str = None, role: str = None):
    client_dir = ROOT_WORK_DIR / client_name
    env_base = client_dir / "env"
    if not env_base.exists():
        print(f"[!] Không tìm thấy thư mục env của client {client_name}")
        return

    targets = []
    for item in env_base.iterdir():
        if not item.is_dir():
            continue
        if version and not item.name.startswith(f"v{version.split(".")[0]}"):
            continue
        if role and not item.name.endswith(role):
            continue
        if (item / "docker-compose.yml").exists():
            targets.append(item)

    if not targets:
        print(f"[*] Không có container env nào khớp yêu cầu để tắt.")
        return

    for t in targets:
        print(f"[*] Đang hạ môi trường: {client_name} -> {t.name}...")
        subprocess.run(["docker", "compose", "-p", f"{client_name.replace(".", "_").replace("-", "_")}_{t.name}", "-f", str(t / "docker-compose.yml"), "down"], check=False)
        print(f"[+] Đã tắt và giải phóng tài nguyên cho: {t.name}")

    sync_gitlab(client_name, message=f"chore: shutdown dev env {client_name}")

def list_status():
    print(f"\n=======================================================")
    print(f"📊 DANH SÁCH DEV ENV ĐANG HOẠT ĐỘNG TRÊN LOCAL SERVER")
    print(f"=======================================================")

    found = False
    for client_p in ROOT_WORK_DIR.iterdir():
        if not client_p.is_dir() or client_p.name.startswith("."):
            continue
        env_p = client_p / "env"
        if not env_p.exists():
            continue
        for sub_env in env_p.iterdir():
            meta_f = sub_env / "env_info.json"
            if meta_f.exists():
                try:
                    with open(meta_f, "r", encoding="utf-8") as f:
                        info = json.load(f)

                    res = subprocess.run(["docker", "inspect", "-f", "{{.State.Running}}", info["odoo_container"]],
                                         capture_output=True, text=True)
                    is_running = (res.stdout.strip() == "true")
                    status_badge = "🟢 UP" if is_running else "⚪ STOPPED"

                    print(f"[{status_badge}] Client: {info["client"]} | Role: {info["role"]} | Odoo {info["version"]}")
                    print(f"   • Web URL:  http://192.168.1.100:{info["web_port"]}")
                    print(f"   • DB Host:  192.168.1.100:{info["db_host_port"]} (DB: {info["db_name"]})")
                    print(f"   • Folder:   {info["env_dir"]}")
                    print(f"-------------------------------------------------------")
                    found = True
                except Exception:
                    pass
    if not found:
        print("Hiện không có môi trường dev Odoo nào đang chạy.")
    print(f"=======================================================\n")

def main():
    parser = argparse.ArgumentParser(description="360 Local Env Builder Controller")
    subparsers = parser.add_subparsers(dest="command")

    up_p = subparsers.add_parser("up", help="Dựng môi trường Docker Odoo dev")
    up_p.add_argument("--client", required=True, help="Tên client (vd: davita.vn)")
    up_p.add_argument("--version", default="15.0", help="Version Odoo (14.0, 15.0, ..., 19.0)")
    up_p.add_argument("--role", default="source", choices=["source", "target", "dev"], help="Vai trò môi trường")
    up_p.add_argument("--db", help="Đường dẫn file dump DB cụ thể để restore")

    down_p = subparsers.add_parser("down", help="Hạ môi trường Docker Odoo dev")
    down_p.add_argument("--client", required=True, help="Tên client")
    down_p.add_argument("--version", help="Chỉ định version cần tắt")
    down_p.add_argument("--role", help="Chỉ định role cần tắt")

    subparsers.add_parser("status", help="Xem danh sách các env đang active")

    sync_p = subparsers.add_parser("gitlab-sync", help="Commit và push toàn bộ client lên GitLab")
    sync_p.add_argument("--client", required=True, help="Tên client")
    sync_p.add_argument("--message", default="chore: auto sync client dev workspace", help="Commit message")

    args = parser.parse_args()
    if not args.command:
        parser.print_help()
        sys.exit(1)

    if args.command == "up":
        up_env(args.client, args.version, args.role, args.db)
    elif args.command == "down":
        down_env(args.client, args.version, args.role)
    elif args.command == "status":
        list_status()
    elif args.command == "gitlab-sync":
        sync_gitlab(args.client, args.message)

if __name__ == "__main__":
    main()

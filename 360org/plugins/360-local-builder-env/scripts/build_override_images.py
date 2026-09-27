#!/usr/bin/env python3
import subprocess
import sys
import time

REGISTRY_BASE = "registry.gitlab.com/vuahethong/demo/odoo"

CONFIGS = [
    {
        "version": "16.0",
        "base_image": "odoo:16.0",
        "commands": "apt-get update && apt-get remove -y python3-google-auth 2>/dev/null || true && pip3 install --no-cache-dir 'google-auth<2.0.0' 'google-auth-oauthlib<1.0.0' google-auth-httplib2 boto3"
    },
    {
        "version": "17.0",
        "base_image": "odoo:17.0",
        "commands": "pip3 install --no-cache-dir google-auth google-auth-oauthlib google-auth-httplib2 boto3"
    },
    {
        "version": "18.0",
        "base_image": "odoo:18.0",
        "commands": "pip3 install --no-cache-dir --break-system-packages google-auth google-auth-oauthlib google-auth-httplib2 boto3"
    },
    {
        "version": "19.0",
        "base_image": "odoo:19.0",
        "commands": "pip3 install --no-cache-dir --break-system-packages google-auth google-auth-oauthlib google-auth-httplib2 boto3"
    }
]

def push_with_retry(tag, max_attempts=3):
    for attempt in range(1, max_attempts + 1):
        print(f"[*] Push {tag} (lần {attempt}/{max_attempts})...")
        res = subprocess.run(["docker", "push", tag])
        if res.returncode == 0:
            print(f"[+] Push thành công: {tag}")
            return True
        print(f"[!] Thử lại sau 2 giây do registry rate/sync delay...")
        time.sleep(2)
    return False

for cfg in CONFIGS:
    v = cfg["version"]
    base = cfg["base_image"]
    cmds = cfg["commands"]
    print(f"\n==================================================")
    print(f"🔨 BUILDING OVERRIDE IMAGE: Odoo {v}")
    print(f"==================================================")
    
    dockerfile_content = f"""FROM {base}

USER root

RUN {cmds}

USER odoo
"""
    df_path = f"/tmp/Dockerfile_override_{v}"
    with open(df_path, "w") as f:
        f.write(dockerfile_content)
        
    tag_local = f"odoo:{v}"
    tag_registry = f"{REGISTRY_BASE}:{v}"
    
    # 1. Build override image
    print(f"[*] Đang build override {tag_local} từ {base}...")
    subprocess.run(["docker", "build", "-t", tag_local, "-t", tag_registry, "-f", df_path, "/tmp"], check=True)
    
    # 2. Push lên GitLab Registry với cơ chế retry
    if not push_with_retry(tag_registry):
        print(f"[!] Lỗi khi push {tag_registry}")
        sys.exit(1)

print("\n🎉 ĐÃ HOÀN TẤT BUILD OVERRIDE VÀ PUSH TOÀN BỘ LÊN GITLAB REGISTRY!")

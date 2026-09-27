#!/usr/bin/env python3
import subprocess
import sys

VERSIONS = [16.0, 17.0, 18.0, 19.0]
REGISTRY_BASE = registry.gitlab.com/vuahethong/demo/odoo

PACKAGES = [
    google-auth,
    google-auth-oauthlib,
    google-auth-httplib2,
    boto3
]

for v in VERSIONS:
    print(fn==================================================)
    print(f🔨 BUILDING OVERRIDE IMAGE CHO ODOO {v})
    print(f==================================================)
    
    # Với Debian 12 (v18, v19) pip cần cờ --break-system-packages
    pip_flag = --break-system-packages if v in [18.0, 19.0] else 
    pkg_str =  .join(PACKAGES)
    
    dockerfile_content = fFROM odoo:{v}

#!/usr/bin/env python3
"""Self-check cho 360-agent-map."""

import json
import shutil
import subprocess
import tempfile
from pathlib import Path

repo = Path(__file__).resolve().parents[1]
script = repo / "360org" / "scripts" / "common" / "agent-map.py"
root = Path(tempfile.mkdtemp(prefix="aiac-agent-map-"))

try:
    addon = root / "addons" / "demo" / "models"
    views = root / "addons" / "demo" / "views"
    security = root / "addons" / "demo" / "security"
    wp = root / "wp-content" / "plugins" / "demo"
    va = root / "src-tauri" / "src"
    src = root / "src"
    for directory in (addon, views, security, wp, va, src):
        directory.mkdir(parents=True, exist_ok=True)

    (addon / "demo.py").write_text(
        "from odoo import models, fields\n"
        "class Demo(models.Model):\n"
        "    _name = 'demo.model'\n"
        "    name = fields.Char()\n"
        "    def action_run(self):\n"
        "        return True\n",
        encoding="utf-8",
    )
    (views / "demo.xml").write_text("<odoo><record id='demo_view' model='ir.ui.view'/><menuitem id='demo_menu'/></odoo>", encoding="utf-8")
    (security / "ir.model.access.csv").write_text("id,name,model_id:id,group_id:id,perm_read,perm_write,perm_create,perm_unlink\naccess_demo,demo,model_demo,,1,0,0,0\n", encoding="utf-8")
    (wp / "demo.php").write_text("<?php add_action('init', 'demo_init'); register_rest_route('demo/v1', '/run', []); function demo_init() {}", encoding="utf-8")
    (src / "App.tsx").write_text("import { invoke } from '@tauri-apps/api/core'; export function App(){ invoke('open_vault'); return null }", encoding="utf-8")
    (va / "lib.rs").write_text("#[tauri::command]\nfn open_vault() {}\n", encoding="utf-8")

    result = subprocess.run(["python3", str(script)], cwd=root, text=True, capture_output=True, check=True)
    assert "agent-map.md" in result.stdout
    data = json.loads((root / ".claude" / "aiac" / "index" / "agent-map.json").read_text(encoding="utf-8"))
    domains = {(item["domain"], item["kind"], item["name"]) for item in data["domainSignals"]}
    symbols = {(item["kind"], item["name"]) for item in data["symbols"]}
    assert ("odoo", "_name", "demo.model") in domains
    assert ("odoo", "field", "name") in domains
    assert ("wordpress", "wp_action", "init") in domains
    assert ("wordpress", "wp_rest_route", "demo/v1") in domains
    assert ("v-assistant", "tauri_invoke", "open_vault") in domains
    assert ("class", "Demo") in symbols
    assert (root / ".claude" / "aiac" / "index" / "domain-graph.json").exists()
    assert (root / ".claude" / "aiac" / "index" / "feature-map.json").exists()
    assert (root / ".claude" / "aiac" / "index" / "checksums.json").exists()
    print("agent-map self-check passed")
finally:
    shutil.rmtree(root, ignore_errors=True)

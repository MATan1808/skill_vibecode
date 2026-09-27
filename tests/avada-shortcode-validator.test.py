#!/usr/bin/env python3
"""Self-check cho Avada shortcode validator."""

import subprocess
import tempfile
from pathlib import Path

repo = Path(__file__).resolve().parents[1]
validator = repo / "360org" / "skills" / "360-wordpres" / "wp-ui-design" / "skills" / "avada-builder-design" / "scripts" / "validate-avada-shortcode.py"

good = '[fusion_builder_container type="flex" hundred_percent="yes"][fusion_builder_row][fusion_builder_column type="1_1" layout="1_1" first="true" last="true" type_small="1_1"][fusion_title size="2"]Tiêu đề[/fusion_title][fusion_text]<p>Nội dung.</p>[/fusion_text][/fusion_builder_column][/fusion_builder_row][/fusion_builder_container]'
bad = '[fusion_builder_container][fusion_builder_row][fusion_builder_column type="7_9" layout="7_9"][fusion_title]<p>Sai</p>[/fusion_text][/fusion_builder_column][/fusion_builder_row][/fusion_builder_container]'

with tempfile.TemporaryDirectory(prefix="aiac-avada-") as tmp:
    tmp = Path(tmp)
    good_path = tmp / "good.txt"
    bad_path = tmp / "bad.txt"
    good_path.write_text(good, encoding="utf-8")
    bad_path.write_text(bad, encoding="utf-8")

    ok = subprocess.run(["python3", str(validator), str(good_path)], text=True, capture_output=True)
    assert ok.returncode == 0, ok.stderr

    fail = subprocess.run(["python3", str(validator), str(bad_path)], text=True, capture_output=True)
    assert fail.returncode != 0, fail.stdout
    assert "column type" in fail.stderr
    assert "tag đóng" in fail.stderr or "đang mở" in fail.stderr

print("avada-shortcode-validator self-check passed")

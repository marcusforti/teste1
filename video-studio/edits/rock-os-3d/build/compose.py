#!/usr/bin/env python3
"""Monta index.html a partir de build/index.src.html + timing.json + cues.json."""
import json
from pathlib import Path
HERE = Path(__file__).parent
timing = json.loads((HERE / "timing.json").read_text())
cues = json.loads((HERE / "cues.json").read_text())
html = (HERE / "index.src.html").read_text()
html = html.replace("/*TIMING*/null", json.dumps(timing, ensure_ascii=False))
html = html.replace("/*CUES*/null", json.dumps(cues))
html = html.replace("__DURATION__", f"{timing['total']:.2f}")
(HERE.parent / "index.html").write_text(html)
print(f"index.html · {timing['total']:.2f}s")

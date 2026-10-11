#!/usr/bin/env python3
"""Cria uma edição HyperFrames a partir de um take já transcrito.

Uso:
  python3 scripts/new_edit.py raw/take.cut.mp4 [nome-da-edicao]

Copia template/ para edits/<nome>/, coloca o vídeo em assets/take.mp4 e embute
as palavras (<take>.words.json) e a duração no index.html.
"""
import json
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

media = Path(sys.argv[1])
name = sys.argv[2] if len(sys.argv) > 2 else media.stem.replace(".", "-")
words = json.loads(media.with_suffix(".words.json").read_text())
duration = float(subprocess.run(
    ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(media)],
    capture_output=True, text=True, check=True).stdout)

dest = ROOT / "edits" / name
if dest.exists():
    sys.exit(f"{dest} já existe — escolha outro nome (ou salve como v2, v3…)")
shutil.copytree(ROOT / "template", dest)
shutil.copy(media, dest / "assets" / "take.mp4")

html = (dest / "index.html").read_text()
html = html.replace("/*WORDS*/[]", json.dumps(words, ensure_ascii=False))
html = html.replace("__DURATION__", f"{duration:.2f}")
(dest / "index.html").write_text(html)
(dest / "meta.json").write_text(json.dumps({"id": name, "name": name}, indent=2))
print(f"-> {dest}  ({len(words)} palavras, {duration:.2f}s)")

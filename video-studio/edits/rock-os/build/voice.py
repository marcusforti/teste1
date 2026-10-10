#!/usr/bin/env python3
"""Gera a narração cena a cena (Kokoro pm_alex) e transcreve cada trecho.
Saída: build/vo/<id>.wav, build/vo/<id>.words.json, build/timing.json"""
import json, subprocess, sys
from pathlib import Path
HERE = Path(__file__).parent
STUDIO = HERE.parent.parent.parent
segs = json.loads((HERE / "narration.json").read_text())
vo = HERE / "vo"; vo.mkdir(exist_ok=True)
INTRO = 3.2  # respiro antes da primeira fala
t = INTRO
timing = []
for s in segs:
    wav = vo / f"{s['id']}.wav"
    if not wav.exists():
        subprocess.run(["npx", "-y", "hyperframes@0.8.145", "tts", s["tts"], "-v", "pm_alex", "-l", "pt-br",
                        "-o", str(wav)], stdin=subprocess.DEVNULL, capture_output=True, check=True)
    words = vo / f"{s['id']}.words.json"
    if not words.exists():
        subprocess.run([sys.executable, str(STUDIO / "scripts/transcribe.py"), str(wav), "--lang", "pt",
                        "--names", "Rock OS,The Rock,iFood,BeeFood,Suitable,WhatsApp,Claude,Wanel Ville,Itu"],
                       stdin=subprocess.DEVNULL, capture_output=True, check=True)
    dur = float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(wav)],
                               capture_output=True, text=True).stdout)
    w = json.loads(words.read_text())
    timing.append({"id": s["id"], "start": round(t, 3), "dur": round(dur, 3), "text": s["text"],
                   "words": [{**x, "start": round(x["start"] + t, 2), "end": round(x["end"] + t, 2)} for x in w]})
    print(f"{s['id']:10s} {t:6.2f}s  +{dur:5.2f}s  {len(w)} palavras")
    t += dur + s["gap"]
(HERE / "timing.json").write_text(json.dumps({"total": round(t, 2), "segments": timing}, ensure_ascii=False, indent=1))
print(f"TOTAL {t:.2f}s")

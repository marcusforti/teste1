#!/usr/bin/env python3
"""Corta pausas e respirações usando os tempos das palavras (corte bruto).

Uso:
  python3 scripts/cut_pauses.py raw/take.mp4 [--max-gap 0.3] [--pad 0.08]

Mantém trechos de fala, remove silêncios maiores que --max-gap e nunca corta
dentro de uma palavra. Gera <nome>.cut.mp4 e <nome>.cut.words.json com os
tempos já reajustados para o vídeo cortado.
"""
import argparse
import json
import subprocess
from pathlib import Path


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("media")
    ap.add_argument("--max-gap", type=float, default=0.3)
    ap.add_argument("--pad", type=float, default=0.08, help="respiro antes/depois de cada trecho")
    args = ap.parse_args()

    base = Path(args.media).with_suffix("")
    words = json.loads(Path(f"{base}.words.json").read_text())
    if not words:
        raise SystemExit("words.json vazio — rode transcribe.py antes")

    # Agrupa palavras em trechos contínuos de fala.
    spans = [[words[0]["start"], words[0]["end"]]]
    for w in words[1:]:
        if w["start"] - spans[-1][1] > args.max_gap:
            spans.append([w["start"], w["end"]])
        else:
            spans[-1][1] = w["end"]
    spans = [[max(0.0, s - args.pad), e + args.pad] for s, e in spans]
    for a, b in zip(spans, spans[1:]):  # evita sobreposição criada pelo pad
        if a[1] > b[0]:
            a[1] = b[0] = (a[1] + b[0]) / 2

    # Remapeia os tempos das palavras para a nova linha do tempo.
    new_words, offset = [], 0.0
    for s, e in spans:
        for w in words:
            if s <= w["start"] < e:
                new_words.append({**w, "start": round(w["start"] - s + offset, 2),
                                  "end": round(min(w["end"], e) - s + offset, 2)})
        offset += e - s

    sel = "+".join(f"between(t,{s:.3f},{e:.3f})" for s, e in spans)
    out = Path(f"{base}.cut.mp4")
    subprocess.run([
        "ffmpeg", "-loglevel", "error", "-y", "-i", args.media,
        "-vf", f"select='{sel}',setpts=N/FRAME_RATE/TB",
        "-af", f"aselect='{sel}',asetpts=N/SR/TB",
        "-c:v", "libx264", "-preset", "fast", "-crf", "18", "-c:a", "aac", str(out),
    ], check=True)
    Path(f"{base}.cut.words.json").write_text(json.dumps(new_words, ensure_ascii=False, indent=1))
    total = words[-1]["end"]
    print(f"{len(spans)} trechos · {total:.1f}s → {offset:.1f}s")
    print(f"-> {out}\n-> {base}.cut.words.json")


if __name__ == "__main__":
    main()

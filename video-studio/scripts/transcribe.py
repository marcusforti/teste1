#!/usr/bin/env python3
"""Transcreve um vídeo/áudio com faster-whisper e salva o tempo de cada palavra.

Uso:
  python3 scripts/transcribe.py raw/take.mp4 [--model small] [--lang pt] \
      [--names "Marcus,Claude,HyperFrames"]

Gera, ao lado do arquivo de entrada:
  <nome>.words.json  -> [{"start": 4.68, "end": 5.12, "word": "Primeiro,"}, ...]
  <nome>.txt         -> transcrição legível com tempos por frase
"""
import argparse
import json
import re
import subprocess
from pathlib import Path

import numpy as np

from faster_whisper import WhisperModel


def load_audio(path):
    """Decodifica com o FFmpeg (16 kHz mono) — evita depender da lib av."""
    raw = subprocess.run(
        ["ffmpeg", "-loglevel", "error", "-i", path, "-f", "s16le", "-ac", "1", "-ar", "16000", "-"],
        capture_output=True, check=True,
    ).stdout
    return np.frombuffer(raw, np.int16).astype(np.float32) / 32768.0


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("media")
    ap.add_argument("--model", default="small")
    ap.add_argument("--lang", default="pt")
    ap.add_argument("--names", default="", help="nomes/marcas com a grafia certa, separados por vírgula")
    args = ap.parse_args()

    names = [n.strip() for n in args.names.split(",") if n.strip()]
    model = WhisperModel(args.model, device="auto", compute_type="int8")
    segments, info = model.transcribe(
        load_audio(args.media),
        language=args.lang,
        word_timestamps=True,
        vad_filter=True,
        # Os nomes entram como contexto para o Whisper acertar a grafia.
        initial_prompt=", ".join(names) or None,
    )

    words, lines = [], []
    for seg in segments:
        lines.append(f"[{seg.start:6.2f} → {seg.end:6.2f}] {seg.text.strip()}")
        for w in seg.words:
            text = w.word.strip()
            for name in names:
                text = re.sub(rf"\b{re.escape(name)}\b", name, text, flags=re.IGNORECASE)
            words.append({"start": round(w.start, 2), "end": round(w.end, 2), "word": text})

    base = Path(args.media).with_suffix("")
    Path(f"{base}.words.json").write_text(json.dumps(words, ensure_ascii=False, indent=1))
    Path(f"{base}.txt").write_text("\n".join(lines) + "\n")
    print(f"{len(words)} palavras · idioma {info.language} · {info.duration:.1f}s")
    print(f"-> {base}.words.json\n-> {base}.txt")


if __name__ == "__main__":
    main()

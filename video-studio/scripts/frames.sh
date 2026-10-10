#!/usr/bin/env bash
# Extrai frames do vídeo para o Claude "ver" o enquadramento.
# Uso: scripts/frames.sh raw/take.mp4 [fps=1]
set -euo pipefail
in="$1"; fps="${2:-1}"
out="$(dirname "$in")/$(basename "${in%.*}")_frames"
mkdir -p "$out"
ffmpeg -loglevel error -y -i "$in" -vf "fps=${fps},scale=540:-2" "$out/f_%04d.jpg"
echo "$(ls "$out" | wc -l) frames em $out (1 frame = 1/${fps}s)"

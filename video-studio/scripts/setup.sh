#!/usr/bin/env bash
# Confere e instala o kit (Node 22+, FFmpeg, Python 3, faster-whisper, HyperFrames).
set -uo pipefail
ok() { printf '  ✓ %s\n' "$1"; }; miss() { printf '  ✗ %s\n' "$1"; }

command -v node >/dev/null && ok "Node $(node -v)" || miss "Node.js 22+ (nodejs.org)"
command -v ffmpeg >/dev/null && ok "FFmpeg" || miss "FFmpeg (winget install Gyan.FFmpeg / brew install ffmpeg)"
command -v python3 >/dev/null && ok "$(python3 --version)" || miss "Python 3.13 (python.org)"
python3 -c "import faster_whisper" 2>/dev/null && ok "faster-whisper" || {
  echo "  … instalando faster-whisper"; python3 -m pip install -q faster-whisper && ok "faster-whisper"; }
npx -y hyperframes doctor

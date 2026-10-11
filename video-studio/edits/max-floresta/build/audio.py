#!/usr/bin/env python3
"""Trilha de caixinha de música + efeitos suaves + voz, mixados em assets/master.wav."""
import json, subprocess
from pathlib import Path
import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, sosfilt

HERE = Path(__file__).parent
SR = 48000
T = json.loads((HERE / "timing.json").read_text())
SEG = {s["id"]: s for s in T["segments"]}
TOTAL = T["total"]; N = int(TOTAL * SR)
rng = np.random.default_rng(5)


def W(seg, p, nth=0):
    h = [w for w in SEG[seg]["words"] if w["word"].lower().startswith(p.lower())]
    return h[nth]["start"]


t_ = lambda d: np.arange(int(d * SR)) / SR
lp = lambda x, f: sosfilt(butter(2, f, "low", fs=SR, output="sos"), x)
hp = lambda x, f: sosfilt(butter(2, f, "high", fs=SR, output="sos"), x)
bp = lambda x, a, b: sosfilt(butter(2, [a, b], "band", fs=SR, output="sos"), x)


def add(buf, at, sig, g=1.0, pan=0.0):
    i = int(at * SR)
    if i >= len(buf): return
    sig = sig[: len(buf) - i]
    buf[i:i + len(sig), 0] += sig * g * np.sqrt(1 - pan) 
    buf[i:i + len(sig), 1] += sig * g * np.sqrt(1 + pan)


def bell(f, d=1.8, bright=1.0):
    x = t_(d)
    s = np.sin(2 * np.pi * f * x) + 0.35 * bright * np.sin(2 * np.pi * f * 2.0 * x) * np.exp(-x * 6) + 0.18 * bright * np.sin(2 * np.pi * f * 3.01 * x) * np.exp(-x * 9)
    return s * np.exp(-x * 2.8) * np.minimum(1, x / 0.004)


def pad(d, freqs):
    x = t_(d); s = np.zeros_like(x)
    for f in freqs:
        for det in (-0.15, 0, 0.15):
            s += np.sin(2 * np.pi * f * (1 + det / 100) * x) + 0.3 * np.sin(2 * np.pi * 2 * f * (1 + det / 100) * x)
    s = lp(s / (len(freqs) * 3), 1800)
    return s * np.clip(np.minimum(x / 1.0, (d - x) / 1.0), 0, 1)


def noise(d): return rng.standard_normal(int(d * SR))


def swoosh(d=0.8):
    x = t_(d); nz = noise(d); out = np.zeros_like(x); st = 20
    for k in range(st):
        a, b = int(k * len(x) / st), int((k + 1) * len(x) / st); fr = k / st
        out[a:b] = bp(nz[a:b], 400 + 2500 * fr, 900 + 5000 * fr)
    return out * np.sin(np.pi * x / d) ** 2


def sparkle(n=7, base=1568):
    out = np.zeros(int(1.6 * SR))
    for k in range(n):
        f = base * [1, 1.25, 1.5, 2, 2.5, 3, 4][k % 7]
        b = bell(f, 0.8, 0.5) * 0.5
        i = int(k * 0.055 * SR); out[i:i + len(b)] += b[: len(out) - i]
    return out


def flip():
    d = 0.18; x = t_(d)
    return hp(noise(d), 1500) * np.exp(-x * 25) * 0.8


# ---------- música: caixinha de música em Dó, 84 bpm ----------
music = np.zeros((N, 2)); B = 60 / 84
C4, D4, E4, G4, A4, C5, D5, E5, G5 = 261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.25, 783.99
chords = [[130.81, 196.0, 329.63], [110.0, 164.81, 261.63], [87.31, 174.61, 220.0], [98.0, 146.83, 246.94]]  # C Am F G
melody = [E5, G4, C5, G4, D5, G4, C5, E5, A4, E4, C5, E4, A4, C5, E5, C5, A4, C4, F4 := 349.23, A4, C5, A4, F4, C5, G4, D4, B4 := 493.88, D5, G4, B4, D5, G5]
x = 0.0; i = 0
while x < TOTAL - 1.0:
    bar = int(x / (4 * B)) % 4
    if abs((x / (4 * B)) - round(x / (4 * B))) < 1e-6:
        add(music, x, pad(4 * B + 0.8, chords[bar]), 0.22)
    add(music, x, bell(melody[i % len(melody)], 1.6), 0.16, pan=0.3 if i % 2 else -0.3)
    x += B / 2; i += 1
# brilho final
add(music, TOTAL - 3.4, pad(3.4, [130.81, 196.0, 261.63, 329.63]), 0.25)

# ---------- efeitos ----------
sfx = np.zeros((N, 2)); cues = {}
def cue(name, at, sig, g=1.0, pan=0.0):
    cues.setdefault(name, []).append(round(at, 3)); add(sfx, at, sig, g, pan)

cue("swoosh", 0.05, swoosh(0.9), 0.35)
cue("sparkle", W("s1", "Macac"), sparkle(), 0.35)
cue("swoosh", SEG["s2"]["start"] - 0.4, swoosh(0.8), 0.3)
cue("sparkle", W("s2", "Max") - 0.1, sparkle(5, 1046.5), 0.22)
cue("swoosh", SEG["s3"]["start"] - 0.4, swoosh(0.8), 0.3)
for k in range(3): cue("breath", W("s3", "respira") + k * 0.42, bell(784 * (1 + k * 0.25), 1.2, 0.3), 0.12)
for k, w in enumerate(["passo", "de", "cada"]): cue("step", W("s3", w), bell(523.25 * [1, 1.25, 1.5][k], 0.6, 0.2), 0.16)
cue("swoosh", SEG["s4"]["start"] - 0.4, swoosh(0.8), 0.3)
cue("magic", W("s4", "pedra"), sparkle(7, 2093), 0.32)
fan = W("s4", "aventura")
for k in range(5): cue("flip", fan + k * 0.09, flip(), 0.5, pan=-0.6 + k * 0.3)
cue("sparkle", fan + 0.5, sparkle(), 0.3)

# ---------- voz + ducking ----------
voice = np.zeros((N, 2))
for s in T["segments"]:
    sr, v = wavfile.read(HERE / "vo" / f"{s['id']}.wav")
    v = v.astype(np.float32); v = v / 32768.0 if np.abs(v).max() > 2 else v
    if v.ndim > 1: v = v.mean(axis=1)
    if sr != SR: v = np.interp(np.arange(int(len(v) * SR / sr)) * sr / SR, np.arange(len(v)), v)
    v = hp(v, 90); v = v / (np.abs(v).max() + 1e-9) * 0.8
    add(voice, s["start"], v, 1.0)
env = np.convolve(np.abs(voice[:, 0]), np.ones(int(0.25 * SR)) / int(0.25 * SR), "same")
env = np.clip(env / (env.max() + 1e-9) * 6, 0, 1)
music *= (1 - 0.5 * env)[:, None]
mix = voice + music * 0.55 + sfx * 0.6
mix = np.tanh(mix * 0.9); mix /= np.abs(mix).max() / 0.95
raw = HERE / "mix_raw.wav"
wavfile.write(raw, SR, (mix * 32767).astype(np.int16))
subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", str(raw), "-af", "loudnorm=I=-14:TP=-1.0:LRA=11", "-ar", str(SR), str(HERE.parent / "assets" / "master.wav")], check=True)
(HERE / "cues.json").write_text(json.dumps(cues, indent=1))
print("master.wav", TOTAL, sum(len(v) for v in cues.values()), "efeitos")

#!/usr/bin/env python3
"""Trilha, efeitos e mixagem do vídeo Rock OS — tudo sintetizado aqui (sem direitos de terceiros).

Lê build/timing.json (gerado por voice.py) e escreve:
  assets/master.wav     voz + trilha + efeitos, com ducking e loudness -14 LUFS
  build/cues.json       tempos dos efeitos (o index.html usa os mesmos tempos)
"""
import json
import subprocess
from pathlib import Path

import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, sosfilt

HERE = Path(__file__).parent
SR = 48000
T = json.loads((HERE / "timing.json").read_text())
SEG = {s["id"]: s for s in T["segments"]}
TOTAL = T["total"]
N = int(TOTAL * SR)
rng = np.random.default_rng(7)


def W(seg, prefix, nth=0):
    """Início da n-ésima palavra do trecho que começa com `prefix`."""
    hits = [w for w in SEG[seg]["words"] if w["word"].lower().startswith(prefix.lower())]
    return hits[nth]["start"]


def t(n):
    return np.arange(int(n * SR)) / SR


def env(n, a=0.005, r=0.2, curve=4.0):
    x = t(n)
    e = np.exp(-curve * x / max(r, 1e-3))
    att = np.clip(x / a, 0, 1) if a > 0 else 1
    return e * att


def lp(x, f, order=2):
    return sosfilt(butter(order, f, "low", fs=SR, output="sos"), x)


def hp(x, f, order=2):
    return sosfilt(butter(order, f, "high", fs=SR, output="sos"), x)


def bp(x, lo, hi, order=2):
    return sosfilt(butter(order, [lo, hi], "band", fs=SR, output="sos"), x)


def noise(n):
    return rng.standard_normal(int(n * SR))


def add(buf, at, sig, gain=1.0, pan=0.0):
    i = int(at * SR)
    if i >= len(buf):
        return
    sig = sig[: len(buf) - i]
    l, r = np.sqrt(0.5 * (1 - pan)), np.sqrt(0.5 * (1 + pan))
    if sig.ndim == 1:
        buf[i:i + len(sig), 0] += sig * gain * l * 1.414
        buf[i:i + len(sig), 1] += sig * gain * r * 1.414
    else:
        buf[i:i + len(sig)] += sig * gain


# ---------- instrumentos ----------
def kick(d=0.45, f0=140, f1=42):
    x = t(d)
    f = f1 + (f0 - f1) * np.exp(-x * 28)
    ph = 2 * np.pi * np.cumsum(f) / SR
    return np.sin(ph) * env(d, 0.001, d, 5) + 0.15 * hp(noise(d), 3000) * env(d, 0.0005, 0.01, 5)


def snare(d=0.28):
    body = np.sin(2 * np.pi * 190 * t(d)) * env(d, 0.001, 0.08, 5)
    return 0.5 * body + 0.7 * bp(noise(d), 1200, 7000) * env(d, 0.001, 0.18, 5)


def hat(d=0.06, open_=False):
    d = 0.25 if open_ else d
    return hp(noise(d), 7000) * env(d, 0.0005, d, 5)


def bass(d, f):
    x = t(d)
    s = np.sin(2 * np.pi * f * x) + 0.35 * np.sign(np.sin(2 * np.pi * f * x)) * 0.5
    return lp(s, 380) * env(d, 0.004, d * 1.4, 2.5)


def pad(d, freqs, cutoff=900):
    x = t(d)
    s = np.zeros_like(x)
    for f in freqs:
        for det in (-0.12, 0.0, 0.13):
            ff = f * (1 + det / 100)
            s += 2 * ((x * ff) % 1) - 1  # serra
    s = lp(s / (len(freqs) * 3), cutoff, 2)
    fade = np.minimum(1, np.minimum(x / 0.8, (d - x) / 0.8))
    return s * np.clip(fade, 0, 1)


def boom(d=3.0):
    x = t(d)
    f = 28 + 70 * np.exp(-x * 6)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-x * 1.6)
    crash = lp(noise(d), 5000) * np.exp(-x * 2.2) * 0.35
    return s + crash


def riser(d=3.0):
    x = t(d)
    f = 200 * (2 ** (x / d * 3.5))
    tone = np.sin(2 * np.pi * np.cumsum(f) / SR) * 0.25
    nz = hp(noise(d), 1500) * 0.6
    shape = (x / d) ** 2.2
    return (tone + nz) * shape


def whoosh(d=0.7, up=True):
    x = t(d)
    nz = noise(d)
    out = np.zeros_like(x)
    steps = 24
    for k in range(steps):
        a, b = int(k * len(x) / steps), int((k + 1) * len(x) / steps)
        fr = k / steps if up else 1 - k / steps
        out[a:b] = bp(nz[a:b], 300 + 3000 * fr, 600 + 6000 * fr)
    bell = np.sin(np.pi * x / d) ** 2
    return out * bell


def blip(f=1400, d=0.07):
    return np.sin(2 * np.pi * f * t(d)) * env(d, 0.001, d, 5)


def pop(f=900):
    d = 0.12
    x = t(d)
    ff = f * (1 + 1.5 * np.exp(-x * 60))
    return np.sin(2 * np.pi * np.cumsum(ff) / SR) * env(d, 0.001, d, 6)


def alarm(reps=3):
    seq = []
    for _ in range(reps):
        for f in (880, 660):
            d = 0.14
            seq.append(np.sign(np.sin(2 * np.pi * f * t(d))) * 0.3 * env(d, 0.002, 0.2, 1))
            seq.append(np.zeros(int(0.03 * SR)))
    return lp(np.concatenate(seq), 4000)


def chime(f=1046.5):
    d = 1.4
    x = t(d)
    s = sum(np.sin(2 * np.pi * f * k * x) * (0.6 ** (k - 1)) for k in (1, 2, 3))
    return s * env(d, 0.002, 1.0, 4) * 0.5


def ding():
    return chime(1318.5) * 0.7 + np.pad(chime(1760), (int(0.09 * SR), 0))[: int(1.4 * SR)] * 0.5


def clunk():
    d = 0.3
    return lp(noise(d), 900) * env(d, 0.001, 0.08, 5) + 0.6 * np.sin(2 * np.pi * 70 * t(d)) * env(d, 0.001, 0.2, 5)


def zap(d=0.6):
    x = t(d)
    f = 2500 * np.exp(-x * 5) + 80
    s = np.sign(np.sin(2 * np.pi * np.cumsum(f) / SR)) * 0.25
    crackle = hp(noise(d), 4000) * (rng.random(len(x)) > 0.97) * 1.5
    return (s + crackle) * env(d, 0.002, d, 3)


def powerdown(d=1.2):
    x = t(d)
    f = 400 * np.exp(-x * 2.5) + 30
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * (1 - x / d) * 0.6


def powerup(d=0.9):
    x = t(d)
    f = 60 * np.exp(x * 3.2)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * (x / d) * 0.5 * env(d, 0.6, d * 3, 1)


def typing(d=2.0, rate=14):
    out = np.zeros(int(d * SR))
    k = 0.0
    while k < d - 0.05:
        c = bp(noise(0.025), 2000, 6000) * env(0.025, 0.0005, 0.02, 5)
        i = int(k * SR)
        out[i:i + len(c)] += c * (0.6 + 0.4 * rng.random())
        k += (1 / rate) * (0.6 + 0.8 * rng.random())
    return out


def shutter():
    return np.concatenate([hp(noise(0.02), 2500) * env(0.02, 0.0005, 0.02, 4),
                           np.zeros(int(0.05 * SR)),
                           hp(noise(0.03), 2000) * env(0.03, 0.0005, 0.03, 4)])


def beep(f=1000, d=0.5):
    return np.sin(2 * np.pi * f * t(d)) * np.minimum(1, (d - t(d)) / 0.02) * 0.4


# ---------- música ----------
music = np.zeros((N, 2))
BPM = 96
B = 60 / BPM
A, F, D, E, C, G = 55.0, 43.65, 36.71, 41.2, 32.7, 49.0
prog = [A, F, C, G]  # Am  F  C  G (no grave)
chord = {A: [220, 261.63, 329.63], F: [174.61, 220, 261.63], C: [196, 261.63, 329.63], G: [196, 246.94, 293.66]}

reveal = W("reveal", "Rock")
vision_drop = SEG["vision"]["start"] - 0.2
vision_back = W("vision", "trabalhar")
final_hit = SEG["final"]["words"][-1]["end"] + 0.25  # impacto logo depois de "Rock OS"

# drone tenso do início ao reveal
add(music, 0.0, pad(reveal + 0.5, [55, 58.27, 82.41], 500), 0.55)
# pulso de tensão no problema (hat 1/8 + tic)
x = SEG["problema"]["start"] - 0.3
while x < reveal - 0.2:
    add(music, x, hat(), 0.25, pan=0.3)
    x += B / 2
x = SEG["hook"]["start"]
while x < reveal - 3:
    add(music, x, kick(0.5, 90, 38), 0.35)
    x += B * 2

# groove do reveal até o fim (com breakdown na cena das câmeras)
bar = 4 * B
x = reveal
bi = 0
while x < final_hit - 0.05:
    in_break = vision_drop <= x < vision_back
    root = prog[bi % 4]
    if not in_break:
        add(music, x, pad(bar, chord[root], 1100), 0.22)
        for k in range(4):
            bt = x + k * B
            if bt >= final_hit - 0.05:
                break
            add(music, bt, kick(), 0.85)
            if k in (1, 3):
                add(music, bt, snare(), 0.45)
            for h in range(2):
                add(music, bt + h * B / 2, hat(open_=(h == 1 and k == 3)), 0.22, pan=-0.25)
            for h in range(2):
                add(music, bt + h * B / 2, bass(B / 2 * 0.9, root), 0.55)
    else:
        add(music, x, pad(bar, [r / 2 for r in chord[root]], 600), 0.3)
    x += bar
    bi += 1

# riser até o reveal e até o final
add(music, reveal - 3.0, riser(3.0), 0.55)
add(music, vision_back - 2.6, riser(2.6), 0.4)
add(music, final_hit - 3.2, riser(3.2), 0.6)
# cauda final
add(music, final_hit, pad(TOTAL - final_hit, [110, 130.81, 164.81], 700), 0.45)

# ---------- efeitos ----------
sfx = np.zeros((N, 2))
cues = {}


def cue(name, at, sig, gain=1.0, pan=0.0):
    cues.setdefault(name, []).append(round(at, 3))
    add(sfx, at, sig, gain, pan)


cue("zap", 0.9, zap(0.9), 0.5)
cue("boom", W("hook", "lojas"), boom(2.0), 0.55)
cue("boom", W("hook", "noite"), boom(2.0), 0.45)
cue("boom", W("hook", "todo"), boom(3.0), 0.7)
for i, w in enumerate(["iFood", "BeeFood", "Suitable", "WhatsApp"]):
    cue("pop", W("problema", w), pop(700 + i * 140), 0.5, pan=-0.5 + i * 0.33)
cue("whoosh", W("problema", "dono") - 0.2, whoosh(0.8, False), 0.35)
cue("impact", reveal, boom(3.2), 1.0)
cue("impact", reveal, whoosh(0.5), 0.4)
cue("whoosh", SEG["rede"]["start"] - 0.4, whoosh(0.8), 0.4)
for i, w in enumerate(["Wanel", "Boa", "Itu"]):
    cue("blip", W("rede", w), blip(1200 + i * 200, 0.09), 0.35, pan=-0.6 + i * 0.6)
cue("powerdown", W("rede", "cair"), powerdown(), 0.5)
cue("powerup", W("rede", "sincroniza"), powerup(0.8), 0.45)
cue("whoosh", SEG["fila"]["start"] - 0.35, whoosh(0.6), 0.4)
for i, w in enumerate(["iFood", "Totem", "Mesa", "WhatsApp"]):
    cue("pop", W("fila", w), pop(800 + i * 120), 0.5, pan=-0.45 + i * 0.3)
cue("whoosh", SEG["totem"]["start"] - 0.35, whoosh(0.6), 0.35)
cue("tap", W("totem", "pede"), blip(2200, 0.03), 0.4)
cue("ding", W("totem", "Bei"), ding(), 0.45)
cue("cash", W("totem", "mais"), chime(1567.98) * 0.8, 0.4)
for k in range(4):
    cue("shutter", SEG["vision"]["start"] + 0.2 + k * 0.55, shutter(), 0.4, pan=-0.6 + k * 0.4)
cue("impact", vision_back, boom(2.4), 0.8)
for i, w in enumerate(["pedido", "oitocentos", "quarenta", "sete"]):
    cue("blip", W("montagem", w), blip(1600, 0.05), 0.3)
cue("alarm", W("montagem", "coca"), alarm(3), 0.55)
cue("clunk", W("montagem", "trava"), clunk(), 0.7)
cue("ok", W("montagem", "corrigido"), chime(880) + np.pad(chime(1318.5), (int(0.12 * SR), 0))[: int(1.4 * SR)], 0.35)
for i, (w, nth) in enumerate([("Mesa", 0), ("motoboy", 0), ("fila", 0), ("desperd", 0)]):
    cue("pop", W("salao", w, nth), pop(850 + i * 100), 0.5, pan=-0.45 + i * 0.3)
cue("alert", W("salao", "garçom"), blip(1500, 0.08), 0.35)
cue("whoosh", W("salao", "tudo") - 0.2, whoosh(0.7), 0.45)
cue("typing", W("agentes", "um"), typing(4.6), 0.18)
cue("ding", W("dono", "relatório"), ding(), 0.5)
cue("powerup", W("itu", "Liga"), powerup(1.0), 0.5)
cue("boom", W("itu", "pronta"), boom(1.6), 0.35)
cue("whoosh", SEG["cuidado"]["start"] - 0.3, whoosh(0.7, False), 0.3)
cue("impact", final_hit, boom(4.0), 1.0)
cue("beep", final_hit + 1.6, beep(1000, 0.18), 0.35)
cue("beep", final_hit + 2.4, beep(1000, 0.18), 0.35)
cue("online", final_hit + 3.2, chime(1567.98) + np.pad(chime(2093), (int(0.1 * SR), 0))[: int(1.4 * SR)], 0.35)

# ---------- voz ----------
voice = np.zeros((N, 2))
for s in T["segments"]:
    sr, v = wavfile.read(HERE / "vo" / f"{s['id']}.wav")
    v = v.astype(np.float32)
    if v.dtype != np.float32 or np.abs(v).max() > 2:
        v = v / 32768.0
    if v.ndim > 1:
        v = v.mean(axis=1)
    if sr != SR:
        v = np.interp(np.arange(int(len(v) * SR / sr)) * sr / SR, np.arange(len(v)), v)
    v = hp(v, 80)
    v = v / (np.abs(v).max() + 1e-9) * 0.8
    add(voice, s["start"], v, 1.0)

# ducking: trilha abaixa enquanto há voz
mono = np.abs(voice[:, 0])
win = int(0.25 * SR)
envv = np.convolve(mono, np.ones(win) / win, mode="same")
envv = np.clip(envv / (envv.max() + 1e-9) * 6, 0, 1)
duck = 1 - 0.55 * envv
music *= duck[:, None]

mix = voice * 1.0 + music * 0.5 + sfx * 0.6
mix = np.tanh(mix * 0.9)  # cola e segura picos
mix /= np.abs(mix).max() / 0.95

assets = HERE.parent / "assets"
assets.mkdir(exist_ok=True)
raw = HERE / "mix_raw.wav"
wavfile.write(raw, SR, (mix * 32767).astype(np.int16))
subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", str(raw), "-af", "loudnorm=I=-14:TP=-1.0:LRA=11",
                "-ar", str(SR), str(assets / "master.wav")], check=True)
(HERE / "cues.json").write_text(json.dumps(cues, indent=1))
print(f"master.wav · {TOTAL:.1f}s · {sum(len(v) for v in cues.values())} efeitos")

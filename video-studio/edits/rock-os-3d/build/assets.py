#!/usr/bin/env python3
"""Baixa as fotos CC0 (build/credits.json), recorta fundos e gera variantes tratadas em assets/img/.

Requer: pip install "rembg[cpu]" pillow scipy
"""
import io, json, urllib.request
from pathlib import Path
import numpy as np
from PIL import Image, ImageEnhance, ImageFilter
from scipy import ndimage

HERE = Path(__file__).parent
OUT = HERE.parent / "assets" / "img"
OUT.mkdir(parents=True, exist_ok=True)
CACHE = HERE / "cache"; CACHE.mkdir(exist_ok=True)
credits = {c["key"]: c for c in json.loads((HERE / "credits.json").read_text())}


def get(key):
    f = CACHE / f"{key}.src"
    if not f.exists():
        f.write_bytes(urllib.request.urlopen(urllib.request.Request(credits[key]["url"], headers={"User-Agent": "Mozilla/5.0"}), timeout=60).read())
    return Image.open(f).convert("RGB")


CROP = {"moto": (0.075, 0.08, 0.925, 0.86), "terrace": (0.0, 0.42, 1.0, 1.0)}  # moldura branca / placa de loja real


def plate(key, w=1920, h=1080, dark=0.55, blur=0, sat=1.0, red=0.0):
    """Fundo full-bleed: corta para 16:9, escurece, desfoca e puxa para o vermelho da marca."""
    im = get(key)
    if key in CROP:
        l, t, r_, b = CROP[key]
        im = im.crop((int(im.width * l), int(im.height * t), int(im.width * r_), int(im.height * b)))
    r = max(w / im.width, h / im.height)
    im = im.resize((int(im.width * r) + 1, int(im.height * r) + 1), Image.LANCZOS)
    x, y = (im.width - w) // 2, (im.height - h) // 2
    im = im.crop((x, y, x + w, y + h))
    if blur: im = im.filter(ImageFilter.GaussianBlur(blur))
    im = ImageEnhance.Color(im).enhance(sat)
    im = ImageEnhance.Brightness(im).enhance(dark)
    if red:
        a = np.asarray(im).astype(np.float32)
        tint = np.array([255, 40, 30], np.float32) * (a.mean(axis=2, keepdims=True) / 255)
        im = Image.fromarray(np.clip(a * (1 - red) + tint * red, 0, 255).astype(np.uint8))
    return im


def cutout(key, session):
    from rembg import remove
    o = remove(get(key), session=session).convert("RGBA")
    a = np.array(o)[:, :, 3]
    lab, n = ndimage.label(a > 40)
    if n > 1:
        sizes = ndimage.sum(np.ones_like(a), lab, range(1, n + 1))
        keep = np.isin(lab, [i + 1 for i, s in enumerate(sizes) if s >= sizes.max() * 0.08])
        arr = np.array(o); arr[:, :, 3] = np.where(keep, arr[:, :, 3], 0); o = Image.fromarray(arr)
    return o.crop(o.getbbox())


if __name__ == "__main__":
    from rembg import new_session
    s = new_session("isnet-general-use")
    for k in ["b19", "b3", "b13", "b17", "cctv"]:
        cutout(k, s).save(OUT / f"cut_{k}.png")
    plate("neon", dark=0.75, blur=2, red=0.15).save(OUT / "neon.jpg", quality=88)
    plate("kitchen", dark=0.45, blur=6, red=0.25).save(OUT / "kitchen.jpg", quality=85)
    plate("bar", dark=0.45, blur=8, red=0.3).save(OUT / "bar.jpg", quality=85)
    plate("booths", dark=0.5, blur=5, red=0.25).save(OUT / "booths.jpg", quality=85)
    plate("city", 2048, 1366, dark=0.9, sat=0.6, red=0.35).save(OUT / "city.jpg", quality=88)
    # fotos dos "feeds" de câmera (nítidas, levemente frias, como CCTV)
    for k in ["booths", "moto", "terrace", "table", "kitchen", "chop", "bar", "neon"]:
        plate(k, 960, 540, dark=0.85, sat=0.55).save(OUT / f"feed_{k}.jpg", quality=84)
    print("ok", sorted(p.name for p in OUT.iterdir()))

#!/usr/bin/env python3
"""Recorta o Max de cada carta (rembg), guarda a posição dele na carta e gera a carta
"limpa" (Max apagado por inpainting) para ele poder saltar da carta em 3D."""
import json
import cv2
import numpy as np
from PIL import Image
from rembg import new_session, remove
from scipy import ndimage

s = new_session("isnet-general-use")
meta = {}
for n in [1, 2, 4, 5]:
    src = f"assets/img/MAX_{n}de5_FRENTE.jpg"
    im = Image.open(src).convert("RGB")
    W, H = im.size
    box = (int(W * .06), int(H * .17), int(W * .94), int(H * .80))
    k = 2
    crop = im.crop(box).resize(((box[2] - box[0]) * k, (box[3] - box[1]) * k), Image.LANCZOS)
    o = np.array(remove(crop, session=s).convert("RGBA"))
    a = o[:, :, 3]
    lab, cnt = ndimage.label(a > 40)
    if cnt > 1:
        sz = ndimage.sum(np.ones_like(a), lab, range(1, cnt + 1))
        keep = np.isin(lab, [i + 1 for i, v in enumerate(sz) if v >= sz.max() * 0.15])
        o[:, :, 3] = np.where(keep, a, 0)
    o[:, :, 3] = np.clip((o[:, :, 3].astype(float) - 70) * 1.7, 0, 255).astype(np.uint8)
    cut = Image.fromarray(o)
    bx = cut.getbbox()
    cut.crop(bx).save(f"assets/img/max{n}_cut.png")
    # posição do recorte na carta, em frações (u da esquerda, v do topo)
    meta[n] = {"u0": (box[0] + bx[0] / k) / W, "v0": (box[1] + bx[1] / k) / H,
               "u1": (box[0] + bx[2] / k) / W, "v1": (box[1] + bx[3] / k) / H}
    continue  # (inpainting descartado: deixava borrões)
    # carta limpa: inpainting na área do Max
    mask = np.zeros((H, W), np.uint8)
    small = cv2.resize((o[:, :, 3] > 20).astype(np.uint8) * 255, (box[2] - box[0], box[3] - box[1]))
    mask[box[1]:box[3], box[0]:box[2]] = small
    mask = cv2.dilate(mask, np.ones((15, 15), np.uint8))
    clean = cv2.inpaint(cv2.imread(src), mask, 12, cv2.INPAINT_TELEA)
    clean = cv2.GaussianBlur(clean, (0, 0), 0.6)
    cv2.imwrite(f"assets/img/MAX_{n}de5_LIMPA.jpg", clean, [cv2.IMWRITE_JPEG_QUALITY, 92])
    print(n, meta[n])
json.dump(meta, open("build/cutmeta.json", "w"), indent=1)

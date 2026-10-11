# Rock OS 3D: vídeo-pitch com motion 3D (2 min)

Versão "nível máximo" do pitch Rock OS + Rock Vision para a The Rock Burgers.
A narração, a trilha e a sincronia por palavra são as mesmas de `../rock-os`; o visual foi refeito com 3D real e fotos.

| Camada | Como é feita |
|---|---|
| 3D | Three.js r147 + bloom (`assets/gl.js`), com 7 ambientes renderizados quadro a quadro pela timeline |
| Logo 3D | "ROCK OS" extrudado na fonte da marca (Big Shoulders Display Black → typeface JSON) |
| Fotos | Imagens CC0 do Openverse; recorte com rembg (`isnet-general-use`) e tratamento em `build/assets.py` |
| Interface | HTML/CSS com perspectiva 3D (GSAP), sobre fotos reais |
| Voz, trilha e efeitos | Kokoro pt-BR + síntese própria, iguais à versão 2D |

## Ambientes 3D
1. **Gancho:** placa neon real, pulso da marca como tubo de luz e brasas
2. **Problema:** painéis de vidro dos 4 sistemas, fios embolados e vórtice
3. **Reveal:** logo extrudado, anéis de choque e hambúrgueres reais orbitando
4. **Rede:** voo sobre a cidade noturna, feixes nas lojas, arcos com pacotes e internet caindo
5. **Rock Vision:** parede curva de 15 telas com fotos e detecção, e a câmera mergulhando na CAM 03
6. **Itu:** a mesma cidade; o feixe de Itu acende com onda de choque
7. **Final:** hambúrgueres voando na câmera e o logo 3D com onda de choque

## Regerar
```bash
pip install "rembg[cpu]" pillow scipy
python3 build/assets.py      # baixa, recorta e trata as fotos (créditos em CREDITS.md)
python3 build/compose.py     # injeta tempos → index.html
npx hyperframes render -w 4 -o rock-os-3d.mp4
```
Para mudar a narração, siga o README de `../rock-os` (voice.py → audio.py) e copie `timing.json`, `cues.json` e `master.wav` para cá.

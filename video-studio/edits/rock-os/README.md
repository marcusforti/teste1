# Rock OS: vídeo-pitch (2 min)

Vídeo de apresentação da proposta **Rock OS + Rock Vision** para a The Rock Burgers, em 16:9 (1920×1080) e com 122s.
O roteiro e os dados vêm das duas páginas da proposta. Os números que aparecem na tela são de exemplo, como nas páginas.

| Camada | Como é feita |
|---|---|
| Narração | Kokoro TTS local, voz `pm_alex` (pt-BR). A grafia fonética dos nomes fica em `build/narration.json` |
| Sincronia | faster-whisper extrai o tempo de cada palavra, e todo efeito visual e sonoro cai numa palavra |
| Trilha e efeitos | Sintetizados em Python (`build/audio.py`), sem direitos de terceiros. Tem ducking sob a voz e loudness em -14 LUFS |
| Visual | HyperFrames + GSAP, com 14 cenas na identidade da marca (preto e vermelho, Big Shoulders, Barlow e JetBrains Mono) |

## Regerar
```bash
python3 build/voice.py     # narração por cena + timing.json (cacheado em build/vo/)
python3 build/audio.py     # trilha + efeitos + mix → assets/master.wav, cues.json
python3 build/compose.py   # injeta tempos em build/index.src.html → index.html
npx hyperframes check
npx hyperframes render -o rock-os.mp4
```

Para mudar uma fala, edite o trecho em `build/narration.json`, apague `build/vo/<id>.*` e rode os três scripts de novo.
As cenas se reposicionam sozinhas porque todo tempo vem das palavras.

## Cenas
1. Gancho: "Três lojas. Milhares de pedidos…"
2. Hoje: quatro sistemas, nenhuma visão
3. Reveal do Rock OS
4. Arquitetura: central na casa do dono, queda de internet
5. Fila única no KDS
6. Totem com upsell
7. Rock Vision: parede de 15 câmeras
8. Conferência de montagem (#1847 sem a Coca)
9. Salão: mesa esperando, motoboy, fila, desperdício
10. Agentes Claude
11. Relatório da meia-noite no celular do dono
12. Itu nasce pronta
13. LGPD
14. Fechamento e logo

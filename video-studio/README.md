# Video Studio — você fala, o Claude edita

Kit para editar vídeos falados com o Claude Code, baseado no guia *Let Claude Edit Your Videos*
(The Creator Stack). Sem Premiere nem CapCut: o Claude escreve a edição como HTML com
[HyperFrames](https://github.com/heygen-com/hyperframes) e renderiza em MP4.

```
raw/take.mp4 ──transcribe.py──▶ take.words.json   (ouvidos: cada palavra com tempo)
             ──frames.sh──────▶ take_frames/       (olhos: 1 frame por segundo)
             ──cut_pauses.py──▶ take.cut.mp4       (corte bruto sem pausas)
                               └─ new_edit.py ──▶ edits/<nome>/index.html ──render──▶ final.mp4
```

## Instalar (uma vez)
Precisa de Node 22+, FFmpeg, Python 3 e Claude Code (Pro ou superior).
```bash
bash scripts/setup.sh                                   # confere tudo e instala faster-whisper
claude plugin marketplace add heygen-com/hyperframes   # ensina HyperFrames ao Claude
claude plugin install hyperframes@hyperframes
```

## Usar
1. Grave um take (tripé, luz no rosto, sala silenciosa, 2s da sala vazia no final) e coloque em `raw/take.mp4`.
2. Abra o Claude Code nesta pasta. Ele lê o `CLAUDE.md` com o fluxo e as regras de estilo.
3. Cole os prompts de [`PROMPTS.md`](PROMPTS.md) na ordem: ouvir e olhar → beat sheet → legendas → cortes → efeitos.
4. Dê notas com o tempo ("em 0:07…") e peça "renderiza".

Comandos manuais, se preferir:
```bash
python3 scripts/transcribe.py raw/take.mp4 --lang pt --names "Marcus,Claude"
python3 scripts/cut_pauses.py raw/take.mp4 --max-gap 0.3
python3 scripts/new_edit.py raw/take.cut.mp4 meu-video
cd edits/meu-video && npx hyperframes check && npx hyperframes render -o final.mp4
```

## Exemplo
`edits/demo/final.mp4` é um take de teste em 9:16 com voz sintética, gerado ponta a ponta por este kit.
As pausas foram cortadas (16,9s → 14,9s), as legendas são palavra a palavra com destaque em
"Marcus", "Claude" e "legenda", e há um punch-in na palavra "zoom".

## Personalizar
- Cores, fonte, nome e @: seção **Marca do usuário** em `CLAUDE.md` e as variáveis `--accent`/`--text` em `template/index.html`.
- Comportamento das legendas e dos zooms: bloco "Ajustes da edição" no `<script>` de cada `edits/<nome>/index.html`.

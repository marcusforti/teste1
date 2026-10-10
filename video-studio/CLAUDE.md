# Video Studio — instruções para o Claude

Esta pasta edita vídeos falados com **HyperFrames** (edição escrita como HTML e renderizada em MP4),
**faster-whisper** (ouvidos) e **FFmpeg** (olhos e tesoura). Não existe timeline: o usuário fala o que
quer e você constrói. Ele é o diretor, você é o editor.

## Pastas
- `raw/` — takes brutos do usuário (`take.mp4`) e as transcrições geradas (`*.words.json`, `*.txt`)
- `refs/` — referências de estilo (prints, GIFs, clipes curtos)
- `sfx/` — efeitos sonoros e trilhas que o usuário tem direito de usar
- `template/` — projeto HyperFrames base (legendas + punch-in zoom). Não edite para um vídeo específico.
- `edits/<nome>/` — uma edição por pasta. Versões: `edits/<nome>-v2/`, `-v3/`…
- `scripts/` — ferramentas do fluxo (abaixo)

## Fluxo obrigatório
1. **Ouvir** — `python3 scripts/transcribe.py raw/<take>.mp4 --lang pt --names "<nomes e marcas>"`.
   Sempre peça/confira a grafia de nomes e marcas antes (o Whisper escreve como ouve).
2. **Olhar** — `scripts/frames.sh raw/<take>.mp4` e abra os frames: onde está o rosto, as mãos,
   os espaços vazios. Diga ao usuário o que você ouviu e viu em cada momento.
3. **Planejar** — escreva um *beat sheet* em tabela (início, fim, palavras exatas, o que aparece,
   onde o texto fica, som) e **espere o OK** antes de construir.
4. **Corte bruto** — `python3 scripts/cut_pauses.py raw/<take>.mp4 --max-gap 0.3`
   (nunca corta dentro de uma palavra; gera `<take>.cut.mp4` + `<take>.cut.words.json` reajustado).
   Corte bruto primeiro, efeitos depois.
5. **Construir** — `python3 scripts/new_edit.py raw/<take>.cut.mp4 <nome>` e edite
   `edits/<nome>/index.html`. Todo efeito começa no `start` de uma palavra do WORDS, nunca chutado.
6. **Verificar** — dentro da edição: `npx hyperframes check` (zero erros) e
   `npx hyperframes snapshot` / frames do render nos tempos alterados. Confira você mesmo antes de
   dizer que está pronto.
7. **Preview e notas** — `npx hyperframes preview --background`. Notas chegam como
   "Em 0:07 …"; aplique uma por vez e salve versão nova a cada rodada.
8. **Render** — `npx hyperframes render -o final.mp4`.

## Regras de estilo (padrão — o usuário pode sobrescrever)
- Formato padrão: vertical 9:16 (1080×1920) para Reels/TikTok/Shorts.
- **Safe zone**: nada de texto nos 20% de baixo da tela nem perto da borda direita (botões do app).
- Legendas: palavra a palavra, 2–3 palavras por vez, bold, branco, palavra-chave na cor de destaque,
  ~62–65% da altura. Não atravessar o fim de frase.
- Cor de destaque: `#8b5cf6` (troque aqui pela cor da marca).
- Punch-in: 1.2x na palavra-chave, segura ~2s, sai suave. No máximo um zoom a cada 5s.
- Pop-ups nunca cobrem o rosto. Música baixa por baixo da voz; nunca o mesmo SFX duas vezes seguidas.
- Cada efeito "de impacto" ganha uma virada (o logo é arremessado, a pessoa some, etc.).

## Marca do usuário (preencher)
- Nome: Marcus
- @handle: 
- Marcas/produtos com grafia correta: Claude, HyperFrames
- Fontes: Inter
- Cores: destaque `#8b5cf6`, texto `#ffffff`

## Como receber notas
- Uma mudança por mensagem, sempre com o tempo ("em 0:07").
- O usuário diz **o quê**, onde e quando — o **como** é com você.
- Se um efeito funcionou, ofereça salvá-lo como bloco reutilizável em `template/`.

## Onde o método brilha / onde não
Brilha: talking heads, explicadores, tutoriais, demos, cortes de podcast, vídeos de dados, intros/outros,
lotes (mesma edição em vários vídeos ou idiomas). Não serve para: gerar filmagem nova, recortes de
movimento rápido/cabelo solto (bordas moles), vídeo de 1h de uma vez (faça por seções), color grading fino.

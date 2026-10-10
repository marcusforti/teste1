# Engenharia reversa: AvatarHype (avatarhype.ai)

Análise feita em 10/10/2026 a partir da landing `/pt-BR/lab/angle/clon` (anúncio Meta, campanha
"AvatarHype | BR | Core | Ventas CBO"), do HTML público e do perfil @avatarhype_br.

## O que é, de fato

**Um curso, não um software.** A AvatarHype não tem modelo de IA próprio nem plataforma de geração.
Ela vende aulas gravadas que ensinam a usar plataformas de terceiros pagas por uso.

| Item | O que eles vendem |
|---|---|
| UGC Realista | $79: aulas, clonagem visual a partir de fotos, apresentadores de IA |
| Animados | $59 (sendo regravado) |
| Pacote completo | $99: UGC + Animados + "DualCast" (dois personagens/podcast) |
| Módulo de voz | $7 mais uma ferramenta externa de cerca de $9/mês, com verificação de consentimento |
| Extras | 3 "agentes" (Estrategista, 6C, Arquiteto de imagens) que rodam no ChatGPT/Claude, 86 prompts, 8 estudos de caso, 335 músicas, 57 efeitos e um removedor de marca d'água |

Promessa central: "Sem Higgsfield nem Magnific". Em vez de assinatura, o aluno recarrega saldo numa
plataforma externa (exemplo de $5) e paga cerca de $0,30 por clipe de 10 s, ou "a partir de $0,02"
numa promoção temporária. A página diz: "AvatarHype não vende créditos".

## Stack do site (observado)

- Next.js (App Router) na Vercel: `/_next/static`, `dpl_` no build id
- Vídeos na Bunny Stream: `player.mediadelivery.net`, `vz-*.b-cdn.net`
- Checkout próprio (`/pt-BR/pagar?plan=…`) com Stripe, Apple Pay e Google Pay
- Área de alunos separada em `app.avatarhype.online`
- A/B de ângulos de venda via rota `lab/angle/[angle]` (`clon`, `ugc`, …) e `v=r6`

## Pipeline que eles ensinam (inferido)

A página não diz o nome das ferramentas, mas a descrição bate com este fluxo:

1. **Fotos → personagem consistente:** um modelo de edição com referência (Nano Banana / Seedream
   Edit) gera o "você" em novas cenas mantendo a identidade.
2. **Roteiro:** prompts e agentes no ChatGPT/Claude criam o ângulo de venda, o roteiro e os prompts de cena.
3. **Imagem → clipe:** um modelo de vídeo com áudio nativo (Veo 3.x / Seedance / Kling) gera clipes
   de 8 a 10 s. O preço de $0,02 a $0,30 por clipe sugere um agregador barato.
4. **Voz própria (opcional):** clonagem numa ferramenta de cerca de $9/mês com "verificação de
   consentimento", que bate com planos de entrada de ElevenLabs/MiniMax. A voz é aplicada por lipsync
   ou por um modelo de "foto que fala".
5. **Montagem:** CapCut. "Colocar imagens atrás do apresentador exige uma função paga" corresponde ao
   recorte de fundo do CapCut Pro. Depois entram música, efeitos e remoção da marca d'água.

## Como replicamos (este repositório)

Em vez de um curso, um **app** que automatiza o mesmo pipeline:

| Etapa AvatarHype | Aqui | Modelo (via MuAPI) |
|---|---|---|
| Clonagem visual a partir de fotos | `/clone` → passo 1 | `nano-banana-edit` |
| Clonagem de voz com consentimento | `/clone` → passo 2 | `minimax-voice-clone` |
| Cena com o seu clone | campo "Cena" | `nano-banana-edit` |
| Fala com a sua voz | TTS com a voz clonada | `minimax-speech-2.6-hd` |
| Vídeo do clone falando | foto + áudio → vídeo | `infinitetalk-image-to-video` |
| UGC com atores de IA (Veo/Seedance) | Workspace original | `veo3.1`, `seedance-2`, … |
| Agentes Estrategista/6C | `prompts/` | ChatGPT/Claude |

Base: [Open-AI-UGC](https://github.com/Anil-matcha/Open-AI-UGC) (MIT), um estúdio de UGC em Next.js
com Prisma, Stripe e MuAPI. O Estúdio de Clone foi construído por cima dele.

## Repositórios avaliados

| Repo | O que é | Uso aqui |
|---|---|---|
| [Anil-matcha/Open-AI-UGC](https://github.com/Anil-matcha/Open-AI-UGC) | SaaS de UGC (Veo 3.1, Seedance 2, Grok) com créditos e Stripe, MIT | **base** |
| [SamurAIGPT/muapi-skills](https://github.com/SamurAIGPT/muapi-skills) | catálogo e schemas dos modelos MuAPI | referência dos endpoints |
| [ojuliocouto/video-ads-machine](https://github.com/ojuliocouto/video-ads-machine) | skill Claude Code de montagem de reels (legendas, b-roll) via HyperFrames, MIT | candidato para a etapa de montagem |
| [PunithVT/ai-avatar-system](https://github.com/PunithVT/ai-avatar-system) | avatar conversacional self-hosted (MuseTalk + Chatterbox), MIT | alternativa 100% open source em GPU própria |
| [MeiGen-AI/InfiniteTalk](https://github.com/MeiGen-AI/InfiniteTalk) | modelo aberto de foto/vídeo que fala (Wan 2.1) | o mesmo modelo, self-hosted |

## Próximos passos sugeridos

- Montagem automática: juntar clipes, legendas palavra por palavra e música (ffmpeg ou video-ads-machine).
- Assistente de roteiro dentro do app, chamando a API do Claude com os prompts de `prompts/`.
- "DualCast": dois clones ou atores conversando (InfiniteTalk multi-pessoa).
- Self-host de InfiniteTalk + MiniMax/F5-TTS numa GPU para baixar o custo por vídeo.

## Limites éticos e legais

- Só se clona a **própria** voz e imagem: o app exige marcar o consentimento antes de clonar a voz.
- Nenhum material proprietário da AvatarHype (aulas, prompts, músicas) foi copiado. Os prompts de
  `prompts/` são originais.
- Anúncios com avatar de IA devem seguir as políticas de mídia sintética da Meta e do TikTok (rótulo de "IA").

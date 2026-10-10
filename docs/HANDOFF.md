# Handoff: tudo o que foi feito (sessão de 10/10/2026)

Documento para continuar o trabalho numa sessão local (Claude Code no terminal do PC).

## 1. Objetivo do usuário
Fazer engenharia reversa da **AvatarHype** (avatarhype.ai), que vende um curso de anúncios UGC com IA e
clone da própria imagem e voz, e ter uma versão própria em formato de app, com custo baixo e qualidade
igual à deles.

## 2. O que já existe (tudo na `main`)
| PR | Conteúdo |
|---|---|
| #3 | Base Open-AI-UGC importada, Estúdio de Clone em `/clone`, docs de engenharia reversa, prompts, CI (GitHub Actions: instala, valida Prisma, faz build) |
| #4 | Correções do teste real: voice clone exige `prompt`; status `pending` travava o polling; opção de velocidade da fala (padrão **1,3×**, o usuário prefere mais rápido); opção **"Usar meu áudio"** (envia um áudio pronto e pula o TTS) |

Fluxo do app: fotos → `nano-banana-edit` (retrato 9:16) → `minimax-voice-clone` (opcional, com consentimento)
→ roteiro → [cena `nano-banana-edit`] → `minimax-speech-2.6-hd` (ou áudio próprio) → `infinitetalk-image-to-video`.
O pipeline avança por webhook (`WEBHOOK_URL`) ou por polling da própria página (8 s).

## 3. Testes reais feitos (conta MuAPI do usuário)
| Teste | Resultado | Custo |
|---|---|---|
| Clone: 6 fotos → retrato | Fiel (careca, barba cheia) | ~US$ 0,03 |
| Voz clonada (áudio de 72 s) | OK, `voice_id = v0c55c6608342a1` (fica salvo na MiniMax) | ~US$ 0,65 |
| Vídeo 8 s com a voz clonada (InfiniteTalk 480p) | OK, boca sincronizada | ~US$ 0,33 |
| Mesmo vídeo acelerado 1,3× com ffmpeg (`setpts=PTS/1.3`, `atempo=1.3`) | O usuário prefere a fala mais rápida | grátis |
| **UGC InfoBakery**, 3 cenas, jaqueta vermelha, cozinha, celular na mão, voz 1,5× | Versão barata (InfiniteTalk 480p) **US$ 0,78**; versão melhor (Kling Avatar standard 720p) **US$ 1,26** | — |

Saldo após os testes: ~US$ 6,63 (de 10). Retrato base:
`https://cdn.muapi.ai/outputs/generated/7379e709-67a2-4658-92a1-2a6dc0117037_d3949d04.png`.
As URLs da CDN expiram em cerca de 30 dias; baixe o que for importante.
As fotos e o áudio originais do usuário **não** estão no repositório (são dados pessoais).

Preços medidos: nano-banana-edit US$ 0,03; TTS cerca de US$ 0,015 por fala curta; InfiniteTalk cerca de
US$ 0,20 por bloco de 5 s em 480p; Kling Avatar standard cerca de US$ 0,35 a 0,37 por clipe.

## 4. Diagnóstico: por que os vídeos da AvatarHype parecem "perfeitos"
- Eles usam **geradores de vídeo com áudio nativo** (Veo 3.x, Seedance, Kling 3): cena inteira com corpo,
  mãos e câmera. Nós usamos **avatares falantes** (foto parada + boca), que parecem duros.
- Eles usam atores de IA (não rostos reais), geram várias versões e escolhem a melhor (refação de 30 a 40%),
  e editam bem (legenda palavra por palavra, textos grandes, música).
- "$0,02 por clipe" é uma promoção temporária de uma plataforma externa; o normal, segundo eles, é cerca de $0,30 por clipe de 10 s.

## 5. Pendências (o que o usuário precisa decidir ou fornecer)
1. **Teste comparativo de realismo (aguardando ok, cerca de US$ 1,06)**, só na cena 1 do UGC InfoBakery:
   - A: `veo3.1-fast-image-to-video` (ou `-lite`, US$ 0,30 por 8 s) com a fala em PT, depois `veed-lipsync` com a voz clonada
   - B: `omnihuman-1-5` 720p (US$ 0,045/s) com prompt de gestos e a voz clonada
   - C: `wan2.7-image-to-video` com `audio_url` (US$ 0,13/s em 720p)
2. **Modelo de voz local do usuário** (grátis, "clonou perfeito", já usado no VSL de uma cliente com autorização).
   Falta saber qual é (RVC/Applio, F5-TTS, XTTS, GPT-SoVITS...) e se tem interface web.
   - Se for RVC/Applio, ele faz **speech-to-speech**: a peça que falta para "Veo + troca de voz", já que a MuAPI não tem voice changer.
   - Integração possível: app rodando local chamando `localhost`, ou túnel (Cloudflare Tunnel) se o app estiver na nuvem.
   - Hoje já funciona manualmente pela opção "Usar meu áudio" no `/clone`.
3. Colocar no app o fluxo "UGC com 3 cenas" (hoje só existe em `scripts/ugc/`).
4. Melhorias baratas: legenda palavra por palavra (WhisperX + Remotion ou ffmpeg), upscale para 1080p
   (`ai-video-upscaler`, US$ 0,01/s), cenas em 2k (`nano-banana-2-1-edit`, US$ 0,06), granulação leve, música baixa.
5. **Segurança:** a chave MuAPI foi colada no chat; o usuário deve apagá-la e criar outra em https://muapi.ai/access-keys.
6. Self-hosting em GPU (RunPod/Vast): só compensa a partir de cerca de 50 a 100 vídeos por mês; se crescer, usar RunPod Serverless só para a animação.

## 6. Lições técnicas
- O schema público da MuAPI (`muapi-skills/schema_data.json`) está desatualizado: `minimax-voice-clone` exige `prompt`.
- A MuAPI devolve `pending`/`queued`/`starting` enquanto processa; trate tudo que não for `completed`/`failed` como ativo.
- `GET /api/v1/account/balance` mostra o saldo; `GET /api/v1/predictions/{id}/result` é o polling.
- Cada clipe de avatar deve ter no máximo cerca de 8 s; a sincronia piora em takes longos.
- Seedance pode bloquear rosto de pessoa real em imagem→vídeo.
- Sempre conferir o resultado (extrair frames com ffmpeg) antes de entregar.

## 7. Rodar no PC
```bash
git clone https://github.com/marcusforti/teste1 && cd teste1
cp .env.example .env    # DATABASE_URL (Postgres), NEXTAUTH_SECRET, UGC_API_KEY=<chave MuAPI>
npm install && npx prisma db push && npm run dev
# UGC multi-cena (precisa de Python 3 e ffmpeg):
export MUAPI_KEY=<chave>
python3 scripts/ugc/ugc.py scripts/ugc/job-infobakery.json out/infobakery barato
bash scripts/ugc/assemble.sh out/infobakery/barato out/infobakery/UGC-barato.mp4
```
Sem Postgres local: use um gratuito (Neon ou Supabase) e cole a URL em `DATABASE_URL`.

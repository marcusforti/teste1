# Estúdio de Clone + UGC com IA

App Next.js (base: Open-AI-UGC, MIT) que transforma fotos e voz de uma pessoa em vídeos UGC falando, via MuAPI.
**Antes de qualquer tarefa, leia `docs/HANDOFF.md`**: histórico, decisões, custos reais, bugs já resolvidos e pendências.

## Mapa rápido
- `src/app/clone/page.js`: UI do Estúdio de Clone (fotos → retrato → voz → roteiro → vídeo).
- `src/app/api/clones/**`: criar clone, clonar voz, gerar vídeo. `src/app/api/jobs/[requestId]/refresh`: polling sem webhook.
- `src/lib/clone-pipeline.js`: pipeline encadeado (scene? → tts? → talk) e `applyJobUpdate` (webhook/polling).
- `src/lib/muapi.js`: chamadas MuAPI (`MUAPI_BASE_URL` sobrescreve a base para testes com mock).
- `src/lib/config.js` → `clone`: endpoints, custos em créditos, vozes, velocidades.
- `scripts/ugc/`: gerador de anúncio UGC com várias cenas (fora do app) + montagem com ffmpeg.
- `prompts/`: agentes de roteiro. `docs/`: engenharia reversa da AvatarHype, pesquisa de modelos, handoff.

## Comandos
- `npm install && npx prisma db push && npm run dev`, depois abrir http://localhost:3000/clone
- Build igual ao CI: `DATABASE_URL=postgresql://u:p@localhost:5432/db NEXTAUTH_SECRET=x STRIPE_SECRET_KEY=sk_test_dummy npm run build`
- Saldo MuAPI (não gasta): `curl -s https://api.muapi.ai/api/v1/account/balance -H "x-api-key: $MUAPI_KEY"`

## Regras
- **Nunca** commitar chaves. A chave MuAPI vai em `.env` (`UGC_API_KEY`) ou na variável `MUAPI_KEY` dos scripts.
- Gerações custam dinheiro real: diga a estimativa e peça ok antes de rodar testes pagos.
- Só clonar rosto e voz com consentimento da pessoa (o app exige o checkbox de voz).
- Respostas ao usuário em português do Brasil, linguagem simples (ele não é programador).

# Pesquisa de modelos e técnicas (10/10/2026)

Preços tirados da página de preços da MuAPI. Nenhum foi conferido rodando, exceto os marcados como ✔ (medidos nos testes).

## Avatar falante (imagem + áudio)
| endpoint | preço | observação |
|---|---|---|
| infinitetalk-image-to-video ✔ | US$ 0,20 por 5 s (480p), US$ 0,40 (720p) | atual |
| kling-v1-avatar-standard ✔ | ~US$ 0,35 a 0,37 por clipe | versão "melhor" do UGC |
| omnihuman-1-5 | US$ 0,045/s (720p), US$ 0,06/s (1080p) | aceita prompt de gestos e corpo; até cerca de 10 s |
| ltx-2.3-lipsync / ltx-2-19b-lipsync | US$ 0,02 a 0,05/s | mais baratos, a testar |
| wan2.2-speech-to-video | US$ 0,04 a 0,08/s | similar |

## Lip-sync sobre vídeo existente
| endpoint | preço |
|---|---|
| veed-lipsync | ~US$ 0,009/s (o mais barato) |
| sync-lipsync | ~US$ 0,015/s |
| latent-sync | US$ 0,26 fixo até 40 s |
| volcengine-video-to-video-lip-sync | US$ 0,06/s (bom para cenas com movimento) |

## Vídeo com áudio nativo / guiado por áudio
| endpoint | preço | observação |
|---|---|---|
| veo3.1-fast-image-to-video / -lite | US$ 0,60 / US$ 0,30 por 8 s | movimento mais realista; gera a própria voz |
| wan2.7-image-to-video (`audio_url`) | US$ 0,13/s (720p) | usa o nosso áudio direto |
| kling-v3.0-omni-pro-image-to-video | US$ 0,14/s com áudio | até 4 imagens de referência |
| seedance-2-omni-reference | US$ 0,18 a 1,35/s | pode bloquear rosto real |
| grok-imagine-image-to-video | US$ 0,025 a 0,05/s | só som ambiente |

## Voz
- A MuAPI **não tem** speech-to-speech (voice changer). Alternativas: ElevenLabs Voice Changer (fora da MuAPI) ou o modelo local do usuário, se for RVC ou Applio.
- minimax-voice-clone: US$ 0,65 por clone. speech-2.6-hd: US$ 0,13 por 1k caracteres; turbo: US$ 0,07.
- Usar `sample_rate` 44100 e `bitrate` 128000 (o padrão do modelo é 8000/32000; o app já usa os valores bons).

## Imagem e upscale
- Editores com identidade: nano-banana-2-1-edit (US$ 0,04 em 1k, US$ 0,06 em 2k), nano-banana-pro-edit (US$ 0,12), seedream-5.0-flash-edit (US$ 0,027), qwen-image-edit-2511 (US$ 0,04).
- Upscale de vídeo: ai-video-upscaler (US$ 0,01/s até 1080p, mantém o áudio); topaz-video-upscale (US$ 0,08/s).

## Técnicas de realismo (pesquisa web; maioria de fontes de fornecedores)
1. Clipes curtos (≤ 8 s) com cortes secos e enquadramentos variados.
2. Gerador de vídeo com áudio nativo, depois troca de voz por speech-to-speech; a sincronia se mantém porque o timing é preservado.
3. Legenda palavra por palavra: WhisperX (timestamps) + Remotion `template-tiktok`.
4. Prompts: "phone front camera selfie, slight handheld micro-movement", imperfeições de pele, nada de "cinematic"/"8k".
5. Roteiro falado e natural (pausas, frases curtas). No ElevenLabs v3, tags como [sighs] e [laughs].
6. Acabamento: som ambiente, música 18 a 25 dB abaixo da voz, -14 LUFS, upscale 1080p, granulação leve, 1 ou 2 zooms.
7. Compliance: rotular conteúdo de IA no TikTok e na Meta; guardar o consentimento escrito de quem foi clonado.

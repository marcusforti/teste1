# Prompts prontos

Troque o que está entre [colchetes] e mande **um por vez**.

## 0. Primeira vez (instalação)
```
Quero editar meus vídeos com HyperFrames. Rode scripts/setup.sh, instale o que faltar
(me pergunte antes de cada passo) e termine com a lista do que está instalado, com versões.
```

## 1. Testar o enquadramento antes de gravar
```
Em raw/test.mp4 tem um clipe de 5 segundos. Extraia alguns frames e confira o enquadramento antes
de eu gravar o take de verdade: meu rosto está bem iluminado, o fundo está longe o bastante para
me recortar limpo, tem algo importante perto demais das bordas? Me diga exatamente o que corrigir.
```

## 2. Primeiro prompt: ouvir e olhar
```
Meu vídeo é raw/take.mp4. Transcreva com Whisper, com o tempo de cada palavra. Depois extraia
um frame por segundo e olhe os frames. Me diga o que eu falo, quando, e o que aparece na cena
em cada momento. Estes nomes têm que estar escritos certo: [seu nome, marca, produto].
```

## 3. Planejar antes de construir
```
Antes de construir qualquer coisa, escreva um beat sheet desta edição em tabela: início e fim,
minhas palavras exatas, o que aparece na tela, onde o texto fica e o som. Formato: vertical 9:16
para Reels. Todo texto fora dos 20% de baixo e longe da borda direita. Espere meu OK para construir.
```

## 4. Edições do dia a dia
**Legendas** (comece por aqui)
```
Adicione legendas palavra a palavra, sincronizadas com a transcrição. Duas ou três palavras na tela
por vez, bold e brancas, com a palavra-chave de cada frase em [cor]. Posicione a ~65% da altura.
```
**Cortar o ar morto**
```
Corte toda pausa maior que 0,3 segundo e toda respiração, usando os tempos das palavras. Nunca corte
dentro de uma palavra e deixe uma pequena pausa antes de cada punchline. Me diga a nova duração.
```
**Punch-in zooms** (use pouco)
```
Dê um punch-in de 1.2x na palavra-chave de cada frase, segure dois segundos e saia suave.
No máximo um zoom a cada cinco segundos.
```
**Title card + nome**
```
Abra com um title card em letra grande e bold: "[seu gancho]". Segure dois segundos e corte para mim.
Adicione um lower third com meu nome e [@handle] na primeira vez que eu falo.
```
**Pop-ups**
```
Quando eu disser "[palavra]", faça [imagem.png] aparecer do meu lado por dois segundos com um
pequeno quique. Nunca pode cobrir meu rosto.
```
**Música + efeitos sonoros**
```
Coloque [musica.mp3] por baixo da minha voz em volume baixo, e abaixe mais enquanto eu falo.
Um whoosh em cada zoom e um pop em cada pop-up, usando os arquivos da pasta sfx.
Nunca o mesmo som duas vezes seguidas.
```
**Reenquadrar para Reels**
```
Reenquadre este vídeo 16:9 para 9:16 para Reels e mantenha meu rosto centralizado o tempo todo.
```

## 5. Notas que funcionam (uma por linha, sempre com tempo)
```
Em 0:07 o logo cobre meu rosto. Coloque ao lado da minha mão e 20% menor.
De 0:12 a 0:14 as legendas passam rápido demais. Mostre duas palavras por vez.
O zoom em 0:21 entra atrasado. Comece na palavra "agora".
```

## 6. Edições de impacto (fale na câmera, palavra por palavra)
| Você diz | O Claude constrói | Você precisa |
|---|---|---|
| "Zoom na minha mão e coloca o logo do Claude aqui, em 3D." → "Agora joga direto na câmera!" | Punch-in na mão, logo 3D na palma, voando na lente com vidro trincando | Logo (SVG/PNG) na pasta. Mão aberta parada 1s |
| "Separa a cena em camadas: a parede, eu e o texto." → "Agora esconde a minha camada." → "Ok, volta." | Recorte seu (`npx hyperframes remove-background`) separado da sala, texto no meio | 2s de *clean plate* da sala vazia, distância da parede |
| "Me coloca num quadro à direita, e à esquerda mostra como um reel viraliza." | Você encolhe num quadro, explicador animado à esquerda | Tema claro + 2–3 pontos curtos falados logo depois |
| "Volta pra tela cheia. Agora flutua meus melhores reels atrás de mim, em 3D." | Seu recorte na frente, vídeos em telas 3D atrás | Vídeos numa pasta |
| "Por último: pega a câmera da estante e abre ela." → "Agora devolve… e tira minha foto!" | Objeto real recortado, remontado em 3D e aberto; flash e foto de um frame real | Segundo clean plate sem o objeto, pose no "foto" |

## 7. Estilos
**Mostrando um exemplo**
```
Na pasta refs tem prints e um clipe curto de um estilo de motion graphics que eu gosto. Extraia frames
do clipe e estude o layout, as fontes, as cores, como as coisas se movem e o ritmo. Me descreva o estilo
em cinco bullets e espere meu OK. Depois construa algo parecido para o meu vídeo, baseado no que eu falo
e nas cores da minha marca. Parecido, não cópia.
```
**Só pelo nome**
```
Edite este vídeo como um trailer de cinema.
Transforme este vídeo num explicador estilo Vox.
```
Misture: "estilo trailer de cinema, com títulos como os de refs/titles.png".

## 8. Lote
```
Faça três versões desta edição com o mesmo tempo e estilo: legendas em português, inglês e espanhol.
Traduza só as legendas, mantenha minha voz, e renderize as três.
```

## 9. Quando algo parece errado
- Nomes errados → passe a grafia certa no primeiro prompt.
- Texto escondido pelos botões → relembre a safe zone.
- Efeito atrasado → diga a palavra exata em que deve começar.
- "Está pronto" mas parece errado → "tire um snapshot do frame em 0:07 e confira você mesmo".
- Preview/render falha → `npx hyperframes doctor` e cole o erro.
- Uma mudança quebrou algo → peça para salvar versão a cada rodada (v1, v2…).

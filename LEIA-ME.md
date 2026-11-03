# Lives TikTok: Galeria de Jogos

## Jeito fácil
- **TESTAR.bat** (clique duplo): modo teste, sem TikTok.
- **INICIAR-LIVE.bat** (clique duplo): conecta na live. Digite o @ da conta na galeria uma vez (fica salvo). Não feche a janela preta durante a live.

## Segurança (já vem ligado)
- Escudos desenhados por padrão (tecla L troca para os oficiais).
- Fotos de perfil desligadas (`mostrarFotos` no topo de corrida.js).
- Nomes com palavrão ou ofensa aparecem como "Torcedor".
- Sem prêmios, sem aposta, música própria (sem direitos autorais).
- A narradora e as cobras só falam frases prontas + o nome da pessoa (já filtrado). Nunca leem comentários e nunca pedem presente.
- O sistema só LÊ a live, como um espectador: não usa sua senha nem posta nada.

## Jogos prontos
- **🏁 Corrida dos Times**: cada comentário vira uma bolinha que desce uma pista nova a cada corrida.
- **🐍 Cobrinha dos Times 3D**: 14 times (Flamengo, Corinthians, Palmeiras, São Paulo, Santos, Grêmio, Inter, Vasco, Cruzeiro, Galo, Bahia, Vitória, Fluminense, Botafogo) e até 6 cobras na arena. Comentar o nome ou número do time entra nele e solta comida com o nome da pessoa; time que não está na arena entra na hora (se tiver vaga) ou na próxima rodada. Curtida vira comida, presente = TURBO, presente grande = MEGA COBRA com escudo. A cada 200 curtidas chove comida.
  - Cada rodada tem um **modo** sorteado (Clássica, Frutas Douradas, Turbo, Cobras Gigantes, Campo Minado, Arena Encolhendo, Noite Neon) e um **cenário** (Neon, Estádio, Gelo, Vulcão).
  - No meio da rodada aparecem surpresas: fruta dourada, estrela (turbo + escudo), chuva de comida, frenesi.
  - A narradora agradece **todo** presente, até uma rosa. Os agradecimentos furam a fila da voz.

Nos dois jogos tem narradora falando sozinha e o ranking **Top Apoiadores** do dia.
A voz mais bonita é a **Thalita**, que só existe no **Microsoft Edge**: abra os jogos pelo Edge.

## Testar no PC (sem TikTok)
```
npm run teste
```
Abra http://localhost:3000, escolha o jogo, clique na tela (libera o som) e aperte **T** para abrir o painel de teste.
Marque "Plateia automática" para bots simularem comentários, curtidas e presentes.

## Usar na live de verdade
1. Abra a live no **TikTok LIVE Studio**.
2. Rode, trocando pelo seu @ (sem o @):
   ```
   npm start -- seu_usuario
   ```
3. Abra http://localhost:3000, entre no jogo, clique uma vez e aperte **F** (tela cheia).
4. No LIVE Studio: adicione **Captura de janela** → janela do navegador, e ative o áudio do sistema.

Atalhos no jogo: **M** liga/desliga todo o som (fica lembrado) · **V** liga/desliga só a voz · **L** escudos desenhados/oficiais (padrão: desenhados) · **T** painel de teste · **F** tela cheia · **G** volta para a galeria.

## Onde mexer
- `public/jogos.js` — lista de jogos da galeria
- `public/jogos/corrida/corrida.js` e `public/jogos/cobrinha/cobrinha.js` — no topo fica o `CONFIG` (tempos, diamantes) e, mais abaixo, as frases (`FALAS`)
- `public/shared/times.js` — os times (nomes, cores, palavras do chat). A Corrida usa os 4 primeiros, a Cobrinha usa todos
- No topo do `cobrinha.js`: `maxCobras` (máximo de cobras na arena) e `brilhoNeon` (desligue se o PC ficar lento)
- `public/shared/` — ligação com a live, painel de teste, música, voz e ranking
- `server.js` — conecta no TikTok e repassa os eventos para os jogos

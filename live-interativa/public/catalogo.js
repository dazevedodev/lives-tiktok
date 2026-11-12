// Catálogo do painel: nichos (tipos de live interativa) e os jogos de cada um.
// Para adicionar um jogo: crie public/jogos/<id>/index.html e coloque ele aqui.
window.NICHOS = [
  {
    id: 'equipes', nome: 'Batalha de Equipes', emoji: '⚔️',
    desc: 'O chat escolhe um lado e disputa. Cria rivalidade e faz a galera comentar sem parar.',
    jogos: ['torre', 'batalha', 'corrida', 'cobrinha', 'cabo'],
  },
  {
    id: 'todos', nome: 'Todos Juntos', emoji: '🤝',
    desc: 'A live inteira contra um desafio. Cada comentário, curtida e presente ajuda a vencer.',
    jogos: ['chefao'],
  },
  {
    id: 'quiz', nome: 'Perguntas e Respostas', emoji: '🧠',
    desc: 'Perguntas rápidas na tela. Quem acerta no chat ganha ponto e sobe no ranking.',
    jogos: ['quiz'],
  },
];

window.JOGOS = {
  corrida: {
    nome: 'Corrida de Bolinhas', emoji: '🏁', cores: ['#ff2d6f', '#7b2cff'],
    resumo: 'Cada pessoa que comenta vira uma bolinha da sua equipe e desce uma pista maluca. Pista nova a cada corrida.',
    como: ['💬 Comentar o número = entra na equipe', '❤️ Curtir = empurrãozinho', '🎁 Presente = TURBO', '💎 Presentão = TELEPORTE'],
    equipes: 'Usa as 4 primeiras equipes',
  },
  cobrinha: {
    nome: 'Cobrinha Arena 3D', emoji: '🐍', cores: ['#00c2ff', '#1fd18b'],
    resumo: 'Uma cobra gigante por equipe numa arena 3D com brilho neon. Cada rodada tem modo e cenário diferentes.',
    como: ['💬 Comentar o número = solta comida com seu nome', '❤️ Curtir = comida na arena', '🎁 Presente = TURBO', '💎 Presentão = MEGA COBRA'],
    equipes: 'Usa todas as equipes (até 6 na arena)',
  },
  torre: {
    nome: 'Tower Battle 3D', emoji: '🧱', cores: ['#1b0b45', '#ff5f6d'],
    resumo: 'Dois bonecos cabeçudos em cima de torres de blocos, numa cidade à noite. Cada ação coloca blocos (com raio!). Quem chegar na coroa ganha um WIN. Tela e narração em inglês, música estilo funk.',
    como: ['➕ Follow = +6 (equipe 1)', '🌹 Rose = +10 (equipe 1)', '👍 Like = +1 (equipe 2)', '🎵 TikTok = +10 (equipe 2)', '🎁 Outros presentes = equipe de quem mandou'],
    equipes: 'Usa as 2 primeiras equipes',
  },
  batalha: {
    nome: 'Batalha de Chutes 3D', emoji: '⚽', cores: ['#0b1a4a', '#2fd16a'],
    resumo: 'Dois bonecos 3D num estádio à noite. Cada comentário carrega o chute da equipe; barra cheia é GOL. Ótimo para rivalidades (use o modelo "Camisa 7 x Camisa 10").',
    como: ['💬 Comentar o número = carrega o chute', '❤️ Curtir = carrega um pouco', '🎁 Presente = CHUTAÇO', '💎 Presentão = GOLAÇO na hora'],
    equipes: 'Usa as 2 primeiras equipes',
  },
  cabo: {
    nome: 'Cabo de Guerra', emoji: '🪢', cores: ['#ff7a18', '#ffcf3f'],
    resumo: 'Duas equipes puxando a corda. Cada comentário puxa, curtida puxa mais, presente dá um PUXÃO.',
    como: ['💬 Comentar o número = puxa a corda', '❤️ Curtir = puxa junto', '🎁 Presente = PUXÃO', '💎 Presentão = SUPER PUXÃO'],
    equipes: 'Usa as 2 primeiras equipes',
  },
  chefao: {
    nome: 'Todos contra o Chefão', emoji: '👹', cores: ['#b4152a', '#5b0fbf'],
    resumo: 'Um monstro enorme na tela e a live inteira batendo nele. Cada chefão derrotado vem um mais forte.',
    como: ['💬 Comentar = soco', '❤️ Curtir = golpe rápido', '🎁 Presente = golpe especial', '💎 Presentão = ATAQUE FINAL'],
    equipes: 'Não usa equipes: todo mundo junto',
  },
  quiz: {
    nome: 'Quiz Relâmpago', emoji: '⚡', cores: ['#2f6bff', '#00d1c1'],
    resumo: 'Perguntas de conhecimentos gerais com 4 opções. O chat responde A, B, C ou D e quem acerta pontua.',
    como: ['💬 Comentar A, B, C ou D = responde', '⚡ Quem acerta primeiro ganha mais', '🎁 Presente = elimina uma errada + pontos em dobro', '🏆 Ranking dos que mais acertam'],
    equipes: 'Não usa equipes',
  },
};

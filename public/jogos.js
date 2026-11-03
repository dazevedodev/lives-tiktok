// Lista da galeria. Para adicionar um jogo: crie a pasta public/jogos/<id>/ e coloque ele aqui.
window.JOGOS = [
  {
    id: 'corrida',
    nome: 'Corrida dos Times',
    emoji: '🏁',
    pronto: true,
    descricao: 'Cada pessoa que comenta vira uma bolinha do seu time e desce uma pista maluca. Pista nova a cada corrida.',
    regras: ['💬 Comentar 1, 2, 3 ou 4 = entra no time', '❤️ Curtir = empurrãozinho', '🎁 Presente = TURBO', '💎 Presente grande = TELEPORTE pra frente'],
  },
  {
    id: 'cobrinha',
    nome: 'Cobrinha dos Times 3D',
    emoji: '🐍',
    pronto: true,
    descricao: '14 times e até 6 cobras gigantes na arena 3D. As cobras falam! Cada rodada tem um modo e um cenário diferentes. A maior cobra no fim vence.',
    regras: ['💬 Comentar o nome ou número do time = entra e solta comida com seu nome', '❤️ Curtir = comida na arena', '🎁 Presente = TURBO (e a narradora agradece)', '💎 Presente grande = MEGA COBRA com escudo'],
  },
  {
    id: 'quiz', nome: 'Quiz Relâmpago', emoji: '❓', pronto: false,
    descricao: 'Perguntas rápidas; quem acerta primeiro no chat ganha ponto. Presente dá dica.',
  },
  {
    id: 'chefao', nome: 'Todos contra o Chefão', emoji: '👹', pronto: false,
    descricao: 'Comentário = soco, presente = golpe especial. Cada chefão derrotado vem um maior.',
  },
  {
    id: 'territorio', nome: 'Guerra de Territórios', emoji: '🗺️', pronto: false,
    descricao: 'Times pintam o mapa com curtidas e presentes. Quem dominar mais área vence.',
  },
];

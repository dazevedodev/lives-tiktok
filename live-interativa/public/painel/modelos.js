// Modelos prontos de equipes para o painel (dá para editar tudo depois).
window.MODELOS_EQUIPES = {
  elementos: {
    nome: '🔥 Elementos',
    equipes: [
      { nome: 'Fogo', emoji: '🔥', cor: '#ff4b3e', palavras: ['fogo'] },
      { nome: 'Água', emoji: '💧', cor: '#2f8cff', palavras: ['agua'] },
      { nome: 'Raio', emoji: '⚡', cor: '#ffc61a', palavras: ['raio'] },
      { nome: 'Folha', emoji: '🍀', cor: '#2fd16a', palavras: ['folha'] },
      { nome: 'Gelo', emoji: '❄️', cor: '#7fe3ff', palavras: ['gelo'] },
      { nome: 'Sombra', emoji: '🌙', cor: '#9b5cff', palavras: ['sombra', 'lua'] },
    ],
  },
  cores: {
    nome: '🎨 Cores',
    equipes: [
      { nome: 'Vermelho', emoji: '🔴', cor: '#ff3b3b', palavras: ['vermelho', 'red'] },
      { nome: 'Azul', emoji: '🔵', cor: '#2f7bff', palavras: ['azul', 'blue'] },
      { nome: 'Verde', emoji: '🟢', cor: '#24c55e', palavras: ['verde', 'green'] },
      { nome: 'Amarelo', emoji: '🟡', cor: '#ffd21f', palavras: ['amarelo', 'yellow'] },
      { nome: 'Roxo', emoji: '🟣', cor: '#a855f7', palavras: ['roxo', 'purple'] },
      { nome: 'Laranja', emoji: '🟠', cor: '#ff8a1f', palavras: ['laranja', 'orange'] },
    ],
  },
  bichos: {
    nome: '🐶 Bichos',
    equipes: [
      { nome: 'Cachorro', emoji: '🐶', cor: '#e0a35a', palavras: ['cachorro', 'dog', 'au au'] },
      { nome: 'Gato', emoji: '🐱', cor: '#ff8fc8', palavras: ['gato', 'cat', 'miau'] },
      { nome: 'Coelho', emoji: '🐰', cor: '#c9c9ff', palavras: ['coelho'] },
      { nome: 'Sapo', emoji: '🐸', cor: '#5fd35f', palavras: ['sapo'] },
      { nome: 'Leão', emoji: '🦁', cor: '#ffb21f', palavras: ['leao'] },
      { nome: 'Panda', emoji: '🐼', cor: '#f2f2f2', palavras: ['panda'] },
    ],
  },
  comidas: {
    nome: '🍕 Comidas',
    equipes: [
      { nome: 'Pizza', emoji: '🍕', cor: '#ff6b3d', palavras: ['pizza'] },
      { nome: 'Hambúrguer', emoji: '🍔', cor: '#c9852f', palavras: ['hamburguer', 'burger', 'lanche'] },
      { nome: 'Sushi', emoji: '🍣', cor: '#ff8fa3', palavras: ['sushi'] },
      { nome: 'Açaí', emoji: '🍇', cor: '#8b3fd9', palavras: ['acai'] },
    ],
  },
  simnao: {
    nome: '👍 Sim x Não',
    equipes: [
      { nome: 'Sim', emoji: '👍', cor: '#24c55e', palavras: ['sim', 's'] },
      { nome: 'Não', emoji: '👎', cor: '#ff3b3b', palavras: ['nao', 'n'] },
    ],
  },
  duelo: {
    nome: '⚽ Camisa 7 x Camisa 10',
    aviso: 'Bonecos genéricos (só camisa e número). Não use foto, nome ou escudo oficial de jogador ou time.',
    equipes: [
      { nome: 'Camisa 7', emoji: '🔴', cor: '#d8132f', palavras: ['7', 'sete', 'vermelho'],
        boneco: { numero: '7', faixa: '#0b6b3a', corNumero: '#f5d36b', calcao: '#0b6b3a', cabelo: 'topete' } },
      { nome: 'Camisa 10', emoji: '🔵', cor: '#6cb4ee', palavras: ['10', 'dez', 'azul'],
        boneco: { numero: '10', camisa: '#e6ebf2', faixa: '#6cb4ee', listras: true, corNumero: '#1b2a5c', calcao: '#141a2e', meiao: '#e6ebf2', cabelo: 'medio', barba: true } },
    ],
  },
  times: {
    nome: '⚽ Times de futebol',
    aviso: 'Usa escudos desenhados (não os oficiais), para não ter problema com marca registrada.',
    equipes: [
      { nome: 'Flamengo', cor: '#e3262f', palavras: ['flamengo', 'fla', 'mengo', 'mengao'], escudo: { sigla: 'FLA', padrao: 'listras', faixa: '#111111' } },
      { nome: 'Corinthians', cor: '#1b1b1b', palavras: ['corinthians', 'timao', 'coringao', 'curintia'], escudo: { sigla: 'SCCP', padrao: 'liso', faixa: '#ffffff' } },
      { nome: 'Palmeiras', cor: '#1f9d47', palavras: ['palmeiras', 'verdao', 'porco', 'palestra'], escudo: { sigla: 'SEP', padrao: 'liso', faixa: '#ffffff' } },
      { nome: 'São Paulo', cor: '#ffffff', palavras: ['sao paulo', 'saopaulo', 'spfc', 'tricolor paulista'], escudo: { sigla: 'SPFC', padrao: 'faixa', faixa: '#d81f26', faixa2: '#111111' } },
      { nome: 'Grêmio', cor: '#0d80bf', palavras: ['gremio', 'imortal', 'tricolor gaucho'], escudo: { sigla: 'GRE', padrao: 'tri', faixa: '#111111', faixa2: '#ffffff' } },
      { nome: 'Internacional', cor: '#d6111c', palavras: ['inter', 'internacional', 'colorado'], escudo: { sigla: 'INT', padrao: 'liso', faixa: '#ffffff' } },
      { nome: 'Vasco', cor: '#111111', palavras: ['vasco', 'vascao'], escudo: { sigla: 'VAS', padrao: 'diagonal', faixa: '#ffffff' } },
      { nome: 'Cruzeiro', cor: '#1340a8', palavras: ['cruzeiro', 'raposa', 'cabuloso'], escudo: { sigla: 'CRU', padrao: 'estrela', faixa: '#ffffff' } },
    ],
  },
};

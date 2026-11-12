// Quiz Relâmpago: pergunta na tela, o chat responde A, B, C ou D. Quem acerta ganha ponto
// (os mais rápidos ganham mais). Presente elimina uma alternativa errada e dá pontos em dobro para quem mandou.
const CONFIG = {
  tempoPergunta: 15,
  tempoResposta: 6,
  tempoPlacar: 8,
  perguntasPorBloco: 8,   // a cada X perguntas aparece o placar
  pontos: 10,
  bonusRapidos: [5, 3, 2], // 1º, 2º e 3º a acertar
};

const T = criarTela2D(document.getElementById('tela'));
const { W, c, rnd, texto, caixa, cortar, largura } = T;
const LETRAS = ['A', 'B', 'C', 'D'];
const CORES = ['#ff3d6e', '#2f8cff', '#ffb020', '#22c55e'];

// ---------- Estado ----------
let estado = 'placar', tEstado = 4, numero = 0, pergunta = null;
let respostas = new Map(); // id -> { nome, letra, ordem }
let acertaram = [];
let eliminadas = new Set();
const dobro = new Set(); // quem mandou presente: próxima resposta certa vale o dobro
let placar = carregarPlacar();
let fila = [];

// ---------- Narração ----------
const FALAS = {
  inicio: ['Valendo! Comenta A, B, C ou D!', 'Quiz relâmpago começando! Responde no chat!'],
  certa: ['Resposta certa: letra {letra}! {n} pessoas acertaram!', 'É a letra {letra}! {n} acertaram!', 'Letra {letra}! Mandaram bem, {n} acertos!'],
  rapido: ['{nome} foi o mais rápido!', 'O mais rápido foi {nome}!'],
  ninguem: ['Ninguém acertou! Era a letra {letra}!', 'Essa foi difícil! A certa era a letra {letra}!'],
  placar: ['{nome} lidera o quiz com {pts} pontos!', 'No topo do ranking: {nome}, com {pts} pontos!'],
  presente: ['Valeu, {nome}! Uma alternativa errada foi eliminada!', 'Obrigada pelo presente, {nome}! Tirei uma errada!'],
  presenteRosa: ['Valeu pela rosa, {nome}! Tirei uma errada!', 'Uma rosa de {nome}! Obrigada!'],
  presenteRosas: ['Valeu pelas {qtd} rosas, {nome}!', '{qtd} rosas de {nome}! Obrigada!'],
  presenteGrande: ['Uau, {nome}! Muito obrigada! Pontos em dobro pra você!', 'Que isso, {nome}! Obrigada!'],
  seguiu: ['Valeu por seguir, {nome}!', '{nome} seguiu a live! Obrigada!'],
  compartilhou: ['Valeu por compartilhar, {nome}!', '{nome} compartilhou! Valeu demais!'],
  apoiador: ['{nome} agora é o maior apoiador da live!', 'Novo líder no ranking: {nome}!'],
};
const narrar = (tipo, vars = {}, opcoes = {}) => Voz.falar(FALAS[tipo], vars, opcoes);
Ranking.aoMudarLider(p => narrar('apoiador', { nome: p.nome }));

function carregarPlacar() {
  try {
    const p = JSON.parse(localStorage.getItem('quiz-placar'));
    if (p?.dia === new Date().toISOString().slice(0, 10)) return p;
  } catch { /* sem placar */ }
  return { dia: new Date().toISOString().slice(0, 10), pessoas: {} };
}
const salvarPlacar = () => { try { localStorage.setItem('quiz-placar', JSON.stringify(placar)); } catch { /* ignora */ } };
const ranking = (n = 5) => Object.entries(placar.pessoas).map(([id, p]) => ({ id, ...p })).sort((a, b) => b.pts - a.pts).slice(0, n);

// ---------- Perguntas ----------
const embaralhar = l => { for (let i = l.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [l[i], l[j]] = [l[j], l[i]]; } return l; };
function proximaPergunta() {
  if (!fila.length) fila = embaralhar([...PERGUNTAS]);
  const q = fila.pop();
  const ordem = embaralhar([0, 1, 2, 3]);
  numero++;
  pergunta = { cat: q.cat, texto: q.p, opcoes: ordem.map(i => q.o[i]), certa: ordem.indexOf(q.c) };
  respostas = new Map(); acertaram = []; eliminadas = new Set();
  estado = 'pergunta'; tEstado = CONFIG.tempoPergunta;
  Som.energia(0.55);
  Voz.falar(pergunta.texto);
}
function revelar() {
  estado = 'resposta'; tEstado = CONFIG.tempoResposta;
  const certa = LETRAS[pergunta.certa];
  acertaram = [...respostas.values()].filter(r => r.letra === pergunta.certa).sort((a, b) => a.ordem - b.ordem);
  acertaram.forEach((r, i) => {
    let pts = CONFIG.pontos + (CONFIG.bonusRapidos[i] || 0);
    if (dobro.has(r.id)) { pts *= 2; dobro.delete(r.id); }
    r.pts = pts;
    const p = placar.pessoas[r.id] ||= { nome: r.nome, pts: 0, acertos: 0 };
    p.nome = r.nome; p.pts += pts; p.acertos++;
  });
  salvarPlacar();
  if (acertaram.length) {
    Som.acerto();
    narrar('certa', { letra: certa, n: acertaram.length }, { prioridade: true });
    narrar('rapido', { nome: acertaram[0].nome });
    T.confete(60);
  } else {
    Som.erro();
    narrar('ninguem', { letra: certa }, { prioridade: true });
  }
}
function mostrarPlacar() {
  estado = 'placar'; tEstado = CONFIG.tempoPlacar;
  const lider = ranking(1)[0];
  if (lider) narrar('placar', { nome: lider.nome, pts: lider.pts });
  Som.energia(0.4);
}

// ---------- Eventos da live ----------
let ordemResposta = 0;
function lerLetra(texto) {
  const t = String(texto || '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const m = t.match(/^(?:letra\s+|alternativa\s+)?([abcd])[\s!.?]*$/);
  return m ? 'abcd'.indexOf(m[1]) : -1;
}
Live.on('chat', ev => {
  if (estado !== 'pergunta') return;
  const letra = lerLetra(ev.texto);
  if (letra < 0 || eliminadas.has(letra) || respostas.has(ev.id)) return; // vale só a primeira resposta
  respostas.set(ev.id, { id: ev.id, nome: ev.nome, letra, ordem: ordemResposta++ });
  Som.pop(1 + letra * 0.15);
  T.flutuar(rnd(200, W - 200), 1180, `${cortar(ev.nome, 10)} ✓`, '#fff', 24);
});
Live.on('like', ev => {
  if (Math.random() < 0.4) T.flutuar(rnd(100, W - 100), 1200, '❤️', '#ff4d8d', 30);
  if (Math.random() < 0.4) Som.curtida();
});
Live.on('gift', ev => {
  const grande = (ev.diamantes || 1) >= 99;
  dobro.add(ev.id);
  // Elimina uma errada (no máximo duas por pergunta)
  if (estado === 'pergunta' && eliminadas.size < 2) {
    const erradas = [0, 1, 2, 3].filter(i => i !== pergunta.certa && !eliminadas.has(i));
    eliminadas.add(erradas[Math.floor(Math.random() * erradas.length)]);
    Som.teleporte();
  }
  const nomePresente = (ev.qtd > 1 ? ev.qtd + 'x ' : '') + ev.presente;
  if (grande) T.banner(`💎 ${cortar(ev.nome, 16)}`, `${nomePresente} → PONTOS EM DOBRO!`, ['#2f6bff', '#00d1c1']);
  else T.aviso(`🎁 ${cortar(ev.nome, 12)}: ${nomePresente} → elimina uma errada!`, '#ffb020');
  narrar(chaveDoPresente(ev, grande), { nome: ev.nome, presente: ev.presente, qtd: ev.qtd }, { prioridade: true });
});
Live.on('follow', ev => { T.aviso(`➕ ${cortar(ev.nome, 14)} seguiu! Valeu!`, '#5ad8ff'); narrar('seguiu', { nome: ev.nome }); });
Live.on('share', ev => { T.aviso(`↗️ ${cortar(ev.nome, 14)} compartilhou!`, '#5ad8ff'); narrar('compartilhou', { nome: ev.nome }); });

// ---------- Atualização ----------
function atualizar(dt) {
  tEstado -= dt;
  if (estado === 'pergunta') {
    if (tEstado <= 5 && Math.ceil(tEstado) !== Math.ceil(tEstado + dt) && tEstado > 0) Som.tique();
    if (tEstado <= 0) revelar();
  } else if (estado === 'resposta' && tEstado <= 0) {
    if (numero % CONFIG.perguntasPorBloco === 0) mostrarPlacar(); else proximaPergunta();
  } else if (estado === 'placar' && tEstado <= 0) {
    if (numero === 0) narrar('inicio');
    proximaPergunta();
  }
  T.atualizarEfeitos(dt);
}

// ---------- Desenho ----------
function linhas(str, tam, max) {
  const palavras = str.split(' '), saida = [];
  let linha = '';
  for (const p of palavras) {
    const teste = linha ? linha + ' ' + p : p;
    if (largura(teste, tam) > max && linha) { saida.push(linha); linha = p; } else linha = teste;
  }
  if (linha) saida.push(linha);
  return saida;
}
function desenharFundo(t) {
  const g = c.createLinearGradient(0, 0, W, 1920);
  g.addColorStop(0, '#0c1a4a'); g.addColorStop(0.5, '#123a7a'); g.addColorStop(1, '#06222e');
  c.fillStyle = g; c.fillRect(0, 0, W, 1920);
  // raios girando ao fundo
  c.save(); c.translate(W / 2, 760); c.rotate(t * 0.05);
  c.fillStyle = '#ffffff08';
  for (let i = 0; i < 12; i++) { c.rotate(Math.PI / 6); c.beginPath(); c.moveTo(0, 0); c.lineTo(-90, -1400); c.lineTo(90, -1400); c.fill(); }
  c.restore();
}

function desenharPergunta(t) {
  const q = pergunta;
  // número, categoria e tempo
  texto(`PERGUNTA ${numero} · ${q.cat.toUpperCase()}`, 40, 232, { tam: 28, cor: '#7fe8ff', contorno: 0 });
  const total = estado === 'pergunta' ? CONFIG.tempoPergunta : 1;
  const resta = estado === 'pergunta' ? Math.max(0, tEstado) / total : 0;
  caixa(40, 256, W - 80, 14, 7, '#ffffff22');
  caixa(40, 256, Math.max(14, (W - 80) * resta), 14, 7, resta < 0.34 ? '#ff4d5e' : '#ffd23f');

  // cartão da pergunta
  caixa(40, 292, W - 80, 270, 34, '#ffffff', null);
  const ls = linhas(q.texto, 50, W - 160);
  const tam = ls.length > 3 ? 42 : 50;
  const ls2 = ls.length > 3 ? linhas(q.texto, 42, W - 160) : ls;
  ls2.slice(0, 4).forEach((l, i) => texto(l, W / 2, 427 - (ls2.length - 1) * tam * 0.6 + i * tam * 1.2, { tam, alinhar: 'center', cor: '#14204a', contorno: 0 }));

  // alternativas com barra de quantos responderam cada uma
  const cont = [0, 0, 0, 0];
  for (const r of respostas.values()) cont[r.letra]++;
  const total2 = Math.max(1, respostas.size);
  q.opcoes.forEach((op, i) => {
    const y = 600 + i * 136, x = 40, w = W - 80, h = 118;
    const elim = eliminadas.has(i), revelado = estado !== 'pergunta';
    const certa = revelado && i === q.certa, errada = revelado && i !== q.certa;
    c.globalAlpha = elim || (errada && revelado) ? 0.35 : 1;
    caixa(x, y, w, h, 28, certa ? '#22c55e' : '#0b1433d8', certa ? '#ffffff' : CORES[i]);
    // barra de porcentagem
    if (respostas.size) {
      const p = cont[i] / total2;
      c.save(); c.beginPath(); c.roundRect(x, y, w, h, 28); c.clip();
      c.fillStyle = CORES[i] + '40'; c.fillRect(x, y, w * p, h);
      c.restore();
      texto(`${Math.round(cont[i] / total2 * 100)}%`, x + w - 30, y + h / 2, { tam: 30, alinhar: 'right', contorno: 0, cor: '#ffffffcc' });
    }
    c.beginPath(); c.arc(x + 62, y + h / 2, 40, 0, Math.PI * 2); c.fillStyle = CORES[i]; c.fill();
    texto(LETRAS[i], x + 62, y + h / 2 + 2, { tam: 46, alinhar: 'center', contorno: 0 });
    texto(elim ? '❌ eliminada' : cortar(op, 30), x + 125, y + h / 2 + 2, { tam: 44, contorno: 4, max: w - 260 });
    if (certa) texto('✅', x + w - 150, y + h / 2, { tam: 50, alinhar: 'center', contorno: 0 });
    c.globalAlpha = 1;
  });

  if (estado === 'pergunta') {
    texto(`💬 COMENTE A, B, C ou D   ·   ${respostas.size} responderam`, W / 2, 1172, { tam: 34, alinhar: 'center', cor: '#ffd23f' });
    texto('🎁 presente = elimina uma errada + pontos em dobro', W / 2, 1218, { tam: 26, alinhar: 'center', peso: 600 });
  } else {
    // quem acertou primeiro
    if (acertaram.length) {
      const nomes = acertaram.slice(0, 3).map((r, i) => `${['🥇', '🥈', '🥉'][i]} ${cortar(r.nome, 11)} +${r.pts}`).join('   ');
      texto(nomes, W / 2, 1172, { tam: 32, alinhar: 'center', cor: '#ffe680' });
      texto(`${acertaram.length} de ${respostas.size} acertaram`, W / 2, 1218, { tam: 26, alinhar: 'center', peso: 600 });
    } else {
      texto(respostas.size ? 'Ninguém acertou essa! 😮' : 'Comente A, B, C ou D na próxima!', W / 2, 1190, { tam: 34, alinhar: 'center', cor: '#ffd23f' });
    }
  }
}

function desenharPlacar() {
  caixa(70, 300, W - 140, 880, 40, '#0b1433e6', '#ffd23f');
  texto('🏆 RANKING DO QUIZ', W / 2, 380, { tam: 60, alinhar: 'center', cor: '#ffd23f' });
  const top = ranking(7);
  if (!top.length) {
    texto('Ninguém pontuou ainda!', W / 2, 600, { tam: 44, alinhar: 'center' });
    texto('Responda comentando A, B, C ou D', W / 2, 670, { tam: 34, alinhar: 'center', cor: '#cfd3ff' });
  }
  const med = ['🥇', '🥈', '🥉'];
  top.forEach((p, i) => {
    const y = 480 + i * 92;
    caixa(120, y - 36, W - 240, 76, 22, i === 0 ? '#ffd23f26' : '#ffffff10');
    texto(`${med[i] || `${i + 1}º`}  ${cortar(p.nome, 16)}`, 150, y + 2, { tam: 40, contorno: 0, cor: i === 0 ? '#ffe680' : '#fff' });
    texto(`${p.pts} pts`, W - 150, y + 2, { tam: 36, alinhar: 'right', contorno: 0, cor: '#7fe8ff' });
  });
  Marca.desenhar(c, W / 2, 1120, 32);
  texto(`Próxima pergunta em ${Math.max(0, Math.ceil(tEstado))}s`, W / 2, 1240, { tam: 32, alinhar: 'center', cor: '#ffd23f' });
}

function desenharHUD() {
  texto('⚡ QUIZ RELÂMPAGO', 40, 168, { tam: 46 });
  if (estado === 'pergunta') texto(`⏱ ${Math.max(0, Math.ceil(tEstado))}`, W - 40, 168, { tam: 46, alinhar: 'right', cor: tEstado <= 5 ? '#ff5f5f' : '#ffd23f' });
  else {
    const lider = ranking(1)[0];
    if (lider) texto(`👑 ${cortar(lider.nome, 10)} ${lider.pts}`, W - 40, 168, { tam: 32, alinhar: 'right', cor: '#ffe680' });
  }
  T.desenharAvisos(1290);
}

rodarQuadros((dt, t) => {
  atualizar(dt);
  desenharFundo(t);
  if (estado === 'placar') desenharPlacar(); else if (pergunta) desenharPergunta(t);
  T.desenharEfeitos();
  desenharHUD();
  T.desenharBanner(760);
});

aoComecar(() => Som.musica({ bpm: 120, energia: 0.4 }));

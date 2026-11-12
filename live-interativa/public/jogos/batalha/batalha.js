// Batalha de Chutes: dois bonecos 3D (as 2 primeiras equipes) num estádio à noite.
// Cada comentário enche a barra de CHUTE da equipe. Barra cheia = o boneco chuta = GOL.
// Curtida enche um pouco, presente dá CHUTAÇO (enche muito), presentão = GOLAÇO na hora.
// Quem fizer mais gols até o fim do tempo vence a rodada.
// SEGURANÇA: só frases prontas + nome da pessoa (já filtrado). Nunca lê o chat, nunca pede presente.
import * as Palco from './palco3d.js';

const CONFIG = {
  tempoRodada: 90,     // segundos
  tempoPreparo: 5,
  tempoResultado: 10,
  cargaComentario: 9,  // a barra vai até 100
  cargaCurtida: 0.9,   // por curtida (com limite por pacote)
  diamantesSuper: 99,  // presente a partir disso vira GOLAÇO
  pausaGol: 2.6,       // segundos de comemoração depois de cada gol
};

const T = criarTela2D(document.getElementById('hud'));
const { W, c, rnd, texto, caixa, cortar } = T;
const LADOS = EQUIPES.slice(0, 2);
const chavePlacar = LADOS.map(e => e.nome).join('|'); // placar zera se as equipes mudarem

// ---------- Estado ----------
let estado = 'preparo', tEstado = CONFIG.tempoPreparo, rodada = 0;
let gols = [0, 0], carga = [0, 0], vencedor = null, pausa = 0, golNaTela = null, ultimoLider = null, comemorando = false;
const jogadores = new Map(); // id -> { nome, lado, forca, gols, ultima }
let placar = carregarPlacar();

// ---------- Narração ----------
const FALAS = {
  novaRodada: ['Batalha de chutes! {a} contra {b}! Comenta 1 ou 2!', 'Nova rodada! 1 pra {a}, 2 pra {b}!', 'Bola no centro! {a} contra {b}!'],
  valendo: ['Valendo! Comenta pra carregar o chute!', 'Rolou a bola! Comenta!', 'Começou! Enche a barra de chute!'],
  entrou: ['{nome} tá jogando pela equipe {time}!', '{nome} entrou em campo pela equipe {time}!', 'Reforço pra equipe {time}: {nome}!'],
  gol: ['Gooool da equipe {time}!', 'É gol! Equipe {time} marcou!', 'Olha o gol da equipe {time}!', 'Bola na rede! Gol da equipe {time}!'],
  golaco: ['Que golaço, {nome}!', 'Golaço! Valeu, {nome}!'],
  virada: ['A equipe {time} passou na frente!', 'Virada! Equipe {time} na frente!'],
  empatou: ['Empatou! Tá tudo igual!', 'Gol de empate! Jogo aberto!'],
  quase: ['A equipe {time} vai chutar!', 'Barra quase cheia pra equipe {time}!'],
  chamar: ['Equipe {time}, cadê vocês? Comenta {num}!', 'A equipe {time} precisa de gol! Comenta {num}!'],
  presente: ['Valeu, {nome}! Chutaço pra equipe {time}!', 'Obrigada pelo presente, {nome}!', '{nome} mandou {presente}! Que chutaço!'],
  presenteRosa: ['Valeu pela rosa, {nome}!', 'Uma rosa de {nome}! Obrigada!', 'Obrigada pela rosinha, {nome}!'],
  presenteRosas: ['Valeu pelas {qtd} rosas, {nome}!', '{qtd} rosas de {nome}! Obrigada!'],
  presenteGrande: ['Uau, {nome}! Golaço pra equipe {time}!', 'Que isso, {nome}! Muito obrigada!', '{nome} mandou {presente}! Golaço!'],
  seguiu: ['Valeu por seguir, {nome}!', '{nome} seguiu a live! Obrigada!'],
  compartilhou: ['Valeu por compartilhar, {nome}!', '{nome} compartilhou! Valeu demais!'],
  final: ['Últimos dez segundos! Comenta com tudo!', 'Tá acabando! Vai, vai!'],
  vencedor: ['Fim de jogo! A equipe {time} venceu!', 'Vitória da equipe {time}!', 'Acabou! É da equipe {time}!'],
  empate: ['Fim de jogo! Deu empate!', 'Empate! Bora pra próxima!'],
  apoiador: ['{nome} agora é o maior apoiador da live!', 'Novo líder no ranking: {nome}!'],
};
const ultimaFala = {};
const narrar = (tipo, vars = {}, opcoes = {}) => Voz.falar(FALAS[tipo], vars, opcoes);
function narrarComCalma(tipo, seg, vars) {
  const agora = performance.now();
  if (agora - (ultimaFala[tipo] || 0) < seg * 1000) return;
  ultimaFala[tipo] = agora;
  narrar(tipo, vars);
}
Ranking.aoMudarLider(p => narrar('apoiador', { nome: p.nome }));

// ---------- Placar do dia ----------
function carregarPlacar() {
  try {
    const p = JSON.parse(localStorage.getItem('batalha-placar'));
    if (p && p.dia === new Date().toISOString().slice(0, 10) && p.equipes === chavePlacar) return p;
  } catch { /* sem placar */ }
  return { dia: new Date().toISOString().slice(0, 10), equipes: chavePlacar, vitorias: [0, 0] };
}
const salvarPlacar = () => { try { localStorage.setItem('batalha-placar', JSON.stringify(placar)); } catch { /* ignora */ } };

// ---------- Rodada ----------
function novaRodada() {
  rodada++;
  estado = 'preparo'; tEstado = CONFIG.tempoPreparo;
  gols = [0, 0]; carga = [0, 0]; vencedor = null; pausa = 0; golNaTela = null; ultimoLider = null; comemorando = false;
  for (const j of jogadores.values()) { j.forca = 0; j.gols = 0; }
  Palco.acao(-1, 'normal'); Palco.definirDono(null);
  Som.energia(0.4);
  narrar('novaRodada', { a: LADOS[0].nome, b: LADOS[1].nome });
}
function valendo() {
  estado = 'jogando'; tEstado = CONFIG.tempoRodada;
  Som.bip(true); Som.energia(0.8);
  narrar('valendo');
}
function terminar() {
  estado = 'resultado'; tEstado = CONFIG.tempoResultado;
  vencedor = gols[0] === gols[1] ? null : gols[0] > gols[1] ? 0 : 1;
  carga = [0, 0]; filaGolaco.length = 0;
  Som.energia(0.5);
  if (vencedor == null) { Palco.acao(-1, 'normal'); narrar('empate', {}, { prioridade: true }); return; }
  placar.vitorias[vencedor]++; salvarPlacar();
  Palco.acao(vencedor, 'comemorar'); Palco.festejar(6);
  Som.vitoria(); T.confete(160);
  narrar('vencedor', { time: LADOS[vencedor].nome }, { prioridade: true });
}

// Enche a barra de chute de uma equipe. Barra cheia (e ninguém comemorando) = chute.
function carregar(lado, quanto, quem) {
  if (estado !== 'jogando') return;
  carga[lado] = Math.min(100, carga[lado] + quanto);
  if (quem) quem.forca += quanto;
  if (carga[lado] > 80) narrarComCalma('quase', 14, { time: LADOS[lado].nome });
}
function tentarChute() {
  if (pausa > 0 || Palco.chutando()) return;
  const lado = carga[0] >= 100 && carga[1] >= 100 ? (Math.random() < 0.5 ? 0 : 1) : carga[0] >= 100 ? 0 : carga[1] >= 100 ? 1 : -1;
  if (lado < 0) return;
  chutar(lado, null);
}
function chutar(lado, golaco) {
  carga[lado] = 0;
  pausa = CONFIG.pausaGol + 1;
  Palco.chutar(lado, () => gol(lado, golaco));
  Som.turbo();
}
function gol(lado, golaco) {
  gols[lado]++;
  // quem mais ajudou desde o último gol leva o gol no nome
  const autor = [...jogadores.values()].filter(j => j.lado === lado).sort((a, b) => b.forca - b.golForca - (a.forca - a.golForca))[0];
  for (const j of jogadores.values()) if (j.lado === lado) j.golForca = j.forca;
  if (autor) autor.gols++;
  golNaTela = { lado, t: 0, autor: golaco?.nome || autor?.nome, golaco: !!golaco };
  Palco.acao(lado, 'comemorar'); Palco.festejar(3); comemorando = true;
  Som.vitoria(); T.confete(90);
  if (golaco) narrar('golaco', { nome: golaco.nome }, { prioridade: true });
  else narrar('gol', { time: LADOS[lado].nome }, { prioridade: true });
  const lider = gols[0] === gols[1] ? -1 : gols[0] > gols[1] ? 0 : 1;
  if (lider !== ultimoLider) {
    if (lider === -1) narrarComCalma('empatou', 8);
    else if (ultimoLider != null && ultimoLider !== -1) narrarComCalma('virada', 8, { time: LADOS[lider].nome });
    ultimoLider = lider;
  }
}

// ---------- Eventos da live ----------
function registrar(ev, lado) {
  let j = jogadores.get(ev.id);
  if (!j) {
    // Quem não escolheu vai para o lado com menos gente
    const n = [0, 0];
    for (const o of jogadores.values()) n[o.lado]++;
    j = { id: ev.id, nome: ev.nome, lado: lado ?? (n[0] <= n[1] ? 0 : 1), forca: 0, golForca: 0, gols: 0, ultima: 0 };
    jogadores.set(ev.id, j);
  }
  j.nome = ev.nome || j.nome;
  return j;
}
const flutuarNoBoneco = (lado, str, cor, tam = 26) => {
  const p = Palco.naTela(lado);
  T.flutuar(p.x + rnd(-70, 70), p.y + rnd(-20, 30), str, cor, tam);
};
Live.on('chat', ev => {
  const lado = acharEquipe(ev.texto, LADOS);
  const novo = !jogadores.has(ev.id);
  const j = registrar(ev, lado);
  if (lado != null && lado !== j.lado && estado !== 'jogando') j.lado = lado;
  if (novo) {
    T.aviso(`⚽ ${cortar(j.nome, 14)} → ${LADOS[j.lado].emoji} ${LADOS[j.lado].nome}`, LADOS[j.lado].ui);
    narrarComCalma('entrou', 7, { nome: j.nome, time: LADOS[j.lado].nome });
    Som.entrar();
  }
  // Comentários seguidos da mesma pessoa valem menos (para não virar metralhadora)
  const agora = performance.now();
  const fator = agora - j.ultima < 1200 ? 0.35 : 1;
  j.ultima = agora;
  carregar(j.lado, CONFIG.cargaComentario * fator, j);
  if (estado === 'jogando') flutuarNoBoneco(j.lado, `⚡ ${cortar(j.nome, 10)}`, LADOS[j.lado].ui);
});

Live.on('like', ev => {
  const j = registrar(ev);
  carregar(j.lado, Math.min(ev.qtd || 1, 15) * CONFIG.cargaCurtida, j);
  if (estado === 'jogando' && Math.random() < 0.6) flutuarNoBoneco(j.lado, '❤️', '#ff4d8d', 30);
  if (Math.random() < 0.5) Som.curtida();
});

Live.on('gift', ev => {
  const j = registrar(ev);
  const d = ev.diamantes || 1, grande = d >= CONFIG.diamantesSuper;
  const lado = LADOS[j.lado];
  const nomePresente = (ev.qtd > 1 ? ev.qtd + 'x ' : '') + ev.presente;
  if (estado === 'jogando') {
    if (grande) { j.forca += 100; chutarGolaco(j); }
    else carregar(j.lado, 30 + Math.sqrt(d) * 8, j);
  }
  if (grande) { T.banner(`💎 ${cortar(j.nome, 16)}`, `${nomePresente} → GOLAÇO!`, [lado.cor, '#7b2cff']); Som.especial(); }
  else { T.aviso(`🎁 ${cortar(j.nome, 12)}: ${nomePresente} → CHUTAÇO!`, '#ffb020'); Som.turbo(); }
  narrar(chaveDoPresente(ev, grande), { nome: j.nome, presente: ev.presente, qtd: ev.qtd, time: lado.nome }, { prioridade: true });
});
// Presentão: gol na hora (se já tiver um chute no ar, entra na fila)
const filaGolaco = [];
function chutarGolaco(j) { filaGolaco.push(j); }

Live.on('follow', ev => {
  const j = registrar(ev);
  carregar(j.lado, 20, j);
  T.aviso(`➕ ${cortar(j.nome, 14)} seguiu! Valeu!`, '#5ad8ff');
  narrar('seguiu', { nome: j.nome });
});
Live.on('share', ev => {
  const j = registrar(ev);
  carregar(j.lado, 20, j);
  T.aviso(`↗️ ${cortar(j.nome, 14)} compartilhou! Valeu!`, '#5ad8ff');
  narrar('compartilhou', { nome: j.nome });
});

// ---------- Atualização ----------
function atualizar(dt) {
  tEstado -= dt;
  if (estado === 'preparo') {
    if (Math.ceil(tEstado) !== Math.ceil(tEstado + dt) && tEstado > 0 && tEstado < 3.5) Som.bip();
    if (tEstado <= 0) valendo();
  } else if (estado === 'jogando') {
    pausa = Math.max(0, pausa - dt);
    if (pausa <= 0 && comemorando) { Palco.acao(-1, 'normal'); comemorando = false; }
    if (filaGolaco.length && pausa <= 0 && !Palco.chutando()) { const j = filaGolaco.shift(); chutar(j.lado, j); }
    else tentarChute();
    // quem está na frente fica com a bola (embaixadinha)
    if (pausa <= 0) Palco.definirDono(gols[0] === gols[1] ? (carga[0] === carga[1] ? null : carga[0] > carga[1] ? 0 : 1) : gols[0] > gols[1] ? 0 : 1);
    const perdendo = gols[0] === gols[1] ? -1 : gols[0] < gols[1] ? 0 : 1;
    if (perdendo >= 0 && Math.abs(gols[0] - gols[1]) >= 2) narrarComCalma('chamar', 20, { time: LADOS[perdendo].nome, num: perdendo + 1 });
    if (tEstado <= 10 && tEstado + dt > 10) narrar('final');
    if (tEstado <= 10 && Math.ceil(tEstado) !== Math.ceil(tEstado + dt)) Som.tique();
    if (tEstado <= 0 && !Palco.chutando()) terminar();
  } else if (estado === 'resultado') {
    if (tEstado <= 0) novaRodada();
  }
  if (golNaTela) { golNaTela.t += dt; if (golNaTela.t > 2.4) golNaTela = null; }
  T.atualizarEfeitos(dt);
}

// ---------- Desenho (por cima do 3D) ----------
function desenharHUD(t) {
  c.clearRect(0, 0, W, 1920);
  T.sombraTopo(470);
  texto('⚽ BATALHA DE CHUTES', 30, 168, { tam: 44 });
  const status = estado === 'preparo' ? `COMEÇA EM ${Math.max(1, Math.ceil(tEstado))}` : estado === 'jogando' ? `⏱ ${Math.max(0, Math.ceil(tEstado))}s` : 'FIM!';
  texto(status, W - 30, 168, { tam: 40, alinhar: 'right', cor: estado === 'jogando' && tEstado <= 10 ? '#ff5f5f' : '#ffd23f' });

  // Placar estilo TV: equipe 1  [gols x gols]  equipe 2, com a barra de chute embaixo
  const n = [0, 0];
  for (const j of jogadores.values()) n[j.lado]++;
  LADOS.forEach((eq, i) => {
    const w = 400, x = i === 0 ? 30 : W - 30 - w, y = 212;
    caixa(x, y, w, 100, 22, '#000000a8', eq.ui);
    const ex = i === 0 ? x + 12 : x + w - 92;
    c.drawImage(eq.escudo, ex, y + 10, 80, 80);
    c.beginPath(); c.arc(ex + 70, y + 80, 19, 0, Math.PI * 2); c.fillStyle = '#ffd23f'; c.fill();
    texto(String(i + 1), ex + 70, y + 82, { tam: 26, alinhar: 'center', cor: '#000', contorno: 0 });
    const tx = i === 0 ? x + 108 : x + w - 108, al = i === 0 ? 'left' : 'right';
    texto(cortar(eq.nome, 12), tx, y + 36, { tam: 32, cor: eq.ui, contorno: 4, alinhar: al });
    texto(`🏆 ${placar.vitorias[i]}   👥 ${n[i]}`, tx, y + 74, { tam: 24, contorno: 4, peso: 600, alinhar: al });

    // barra de chute
    const by = y + 114, cheia = carga[i] >= 100;
    caixa(x, by, w, 30, 15, '#ffffff1f');
    if (carga[i] > 0) {
      c.save(); c.beginPath(); c.roundRect(x, by, w, 30, 15); c.clip();
      const bw = w * carga[i] / 100;
      c.fillStyle = cheia ? `hsl(${45 + Math.sin(t * 20) * 10},100%,60%)` : eq.cor;
      c.fillRect(i === 0 ? x : x + w - bw, by, bw, 30);
      c.restore();
    }
    texto(cheia ? '🔥 CHUTE!' : `⚡ CHUTE ${Math.floor(carga[i])}%`, x + w / 2, by + 16, { tam: 22, alinhar: 'center', contorno: 4 });
  });
  // gols no meio
  caixa(W / 2 - 100, 212, 200, 100, 22, '#ffffffee');
  texto(`${gols[0]}`, W / 2 - 50, 264, { tam: 64, alinhar: 'center', cor: '#14204a', contorno: 0 });
  texto('x', W / 2, 262, { tam: 34, alinhar: 'center', cor: '#14204a88', contorno: 0 });
  texto(`${gols[1]}`, W / 2 + 50, 264, { tam: 64, alinhar: 'center', cor: '#14204a', contorno: 0 });

  texto('💬 COMENTE 1 ou 2 PARA CHUTAR', W / 2, 405, { tam: 40, alinhar: 'center', cor: '#ffd23f' });
  texto('❤️ curtir = carrega   🎁 presente = CHUTAÇO   💎 presentão = GOLAÇO', W / 2, 448, { tam: 25, alinhar: 'center', peso: 600 });

  if (estado !== 'resultado') {
    const fim = T.desenharApoiadores(W - 290, 490, 265);
    T.desenharAvisos(fim + 40);
  }

  // GOOOL!
  if (golNaTela) {
    const g = golNaTela, eq = LADOS[g.lado];
    const s = Math.min(1, g.t * 5) * (1 + Math.max(0, 0.25 - g.t) * 2), a = Math.min(1, (2.4 - g.t) * 3);
    c.save(); c.globalAlpha = Math.max(0, a); c.translate(W / 2, 640); c.scale(s, s); c.rotate(Math.sin(g.t * 9) * 0.03);
    texto(g.golaco ? 'GOLAÇO!' : 'GOOOOL!', 0, 0, { tam: 150, alinhar: 'center', cor: eq.ui, contorno: 16 });
    c.restore();
    c.globalAlpha = Math.max(0, a);
    texto(`${eq.emoji} ${eq.nome.toUpperCase()}`, W / 2, 750, { tam: 48, alinhar: 'center', max: W - 120 });
    if (g.autor) texto(`⚽ ${cortar(g.autor, 16)}`, W / 2, 815, { tam: 38, alinhar: 'center', cor: '#ffe680' });
    c.globalAlpha = 1;
  }

  if (estado === 'preparo') {
    const s = Math.ceil(tEstado);
    caixa(140, 540, W - 280, 250, 36, '#000000c0', '#ffd23f');
    texto(`RODADA ${rodada}`, W / 2, 590, { tam: 32, alinhar: 'center', cor: '#7fe8ff', contorno: 0 });
    texto(`${LADOS[0].emoji} ${cortar(LADOS[0].nome, 10)}  x  ${cortar(LADOS[1].nome, 10)} ${LADOS[1].emoji}`, W / 2, 660, { tam: 50, alinhar: 'center', max: W - 320 });
    texto(s > 0 ? String(s) : 'JÁ!', W / 2, 740, { tam: 70, alinhar: 'center', cor: '#ffd23f' });
    Marca.desenhar(c, W / 2, 850, 32);
  }
  if (estado === 'resultado') {
    caixa(90, 520, W - 180, 330, 40, '#000000cc', vencedor != null ? LADOS[vencedor].ui : '#fff');
    if (vencedor == null) {
      texto('🤝 EMPATE!', W / 2, 620, { tam: 76, alinhar: 'center', cor: '#ffd23f' });
      texto(`${gols[0]} x ${gols[1]}`, W / 2, 710, { tam: 56, alinhar: 'center' });
    } else {
      const eq = LADOS[vencedor];
      c.drawImage(eq.escudo, W / 2 - 60, 540, 120, 120);
      texto(`${eq.nome.toUpperCase()} VENCEU!`, W / 2, 705, { tam: 60, alinhar: 'center', cor: eq.ui, max: W - 220 });
      texto(`${gols[0]} x ${gols[1]}`, W / 2, 765, { tam: 40, alinhar: 'center' });
      const mvp = [...jogadores.values()].filter(j => j.lado === vencedor).sort((a, b) => b.gols - a.gols || b.forca - a.forca)[0];
      if (mvp?.forca) texto(`⭐ Craque: ${cortar(mvp.nome, 16)}`, W / 2, 815, { tam: 32, alinhar: 'center', cor: '#ffe680' });
    }
    texto(`Próxima rodada em ${Math.max(0, Math.ceil(tEstado))}s`, W / 2, 900, { tam: 32, alinhar: 'center', cor: '#ffd23f' });
    Marca.desenhar(c, W / 2, 970, 30);
  }
  T.desenharEfeitos();
  T.desenharBanner(1010); // abaixo do GOOOL, para não cobrir
}

rodarQuadros((dt, t) => {
  atualizar(dt);
  Palco.atualizar(dt, t);
  Palco.render(dt);
  desenharHUD(t);
});

novaRodada();
aoComecar(() => Som.musica({ bpm: 128, energia: 0.4 }));

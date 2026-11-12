// Cabo de Guerra: as 2 primeiras equipes puxam a corda. Quem levar o nó até o seu lado vence.
// Comentário puxa, curtida puxa junto, presente dá PUXÃO, presentão dá SUPER PUXÃO.
const CONFIG = {
  tempoRodada: 75,     // segundos (se ninguém arrastar até o fim, vence quem estiver na frente)
  tempoPreparo: 5,
  tempoResultado: 9,
  forcaComentario: 1.6,
  forcaCurtida: 0.25,  // por curtida (com limite por pacote)
  diamantesSuper: 99,  // presente a partir disso vira SUPER PUXÃO
};

const T = criarTela2D(document.getElementById('tela'));
const { W, c, rnd, texto, caixa, cortar } = T;
const LADOS = EQUIPES.slice(0, 2);
const chavePlacar = LADOS.map(e => e.nome).join('|'); // placar zera se as equipes mudarem
const CHAO = 1010, CENTRO = W / 2, ESCALA = 3.7; // posição -100..100 vira deslocamento em pixels

// ---------- Estado ----------
let estado = 'preparo', tEstado = CONFIG.tempoPreparo;
let pos = 0, vel = 0, forcaRecente = [0, 0], vencedor = null, rodada = 0, ultimoLider = 0;
const jogadores = new Map(); // id -> { nome, lado, forca, ultima }
let placar = carregarPlacar();

// ---------- Narração ----------
const FALAS = {
  novaRodada: ['Cabo de guerra! {a} contra {b}! Comenta 1 ou 2 pra puxar!', 'Nova rodada! Escolhe teu lado: 1 pra {a}, 2 pra {b}!', 'Segura a corda! {a} contra {b}!'],
  valendo: ['Valendo! Puxa!', 'Já! Puxa, puxa!', 'Começou! Força!'],
  entrou: ['{nome} tá puxando pra equipe {time}!', '{nome} pegou na corda! Equipe {time}!', 'Reforço pra equipe {time}: {nome}!'],
  virada: ['Virada! A equipe {time} tá na frente!', 'Olha a equipe {time} reagindo!', 'A corda mudou de lado! {time} na frente!'],
  quase: ['A equipe {time} tá quase ganhando!', 'Falta pouco pra equipe {time}!', 'Segura, que a equipe {time} tá chegando!'],
  chamar: ['Equipe {time}, cadê vocês? Comenta {num}!', 'A equipe {time} precisa de força! Comenta {num}!'],
  presente: ['Valeu, {nome}! Puxão pra equipe {time}!', 'Obrigada pelo presente, {nome}!', '{nome} mandou {presente}! Que puxão!'],
  presenteRosa: ['Valeu pela rosa, {nome}!', 'Uma rosa de {nome}! Obrigada!', 'Obrigada pela rosinha, {nome}!'],
  presenteRosas: ['Valeu pelas {qtd} rosas, {nome}!', '{qtd} rosas de {nome}! Obrigada!'],
  presenteGrande: ['Uau, {nome}! Super puxão pra equipe {time}!', 'Que isso, {nome}! Muito obrigada!', '{nome} mandou {presente}! Super puxão!'],
  seguiu: ['Valeu por seguir, {nome}!', '{nome} seguiu a live! Obrigada!'],
  compartilhou: ['Valeu por compartilhar, {nome}!', '{nome} compartilhou! Valeu demais!'],
  final: ['Últimos dez segundos! Puxa com tudo!', 'Tá acabando! Força!'],
  vencedor: ['A equipe {time} venceu o cabo de guerra!', 'Vitória da equipe {time}! Que força!', 'É da equipe {time}! Ganhou!'],
  empate: ['Empate! Ninguém saiu do lugar!', 'Deu empate! Bora pra próxima!'],
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
    const p = JSON.parse(localStorage.getItem('cabo-placar'));
    if (p && p.dia === new Date().toISOString().slice(0, 10) && p.equipes === chavePlacar) return p;
  } catch { /* sem placar */ }
  return { dia: new Date().toISOString().slice(0, 10), equipes: chavePlacar, vitorias: [0, 0] };
}
const salvarPlacar = () => { try { localStorage.setItem('cabo-placar', JSON.stringify(placar)); } catch { /* ignora */ } };

// ---------- Rodada ----------
function novaRodada() {
  rodada++;
  estado = 'preparo'; tEstado = CONFIG.tempoPreparo;
  pos = 0; vel = 0; vencedor = null; ultimoLider = 0;
  for (const j of jogadores.values()) j.forca = 0;
  Som.energia(0.4);
  narrar('novaRodada', { a: LADOS[0].nome, b: LADOS[1].nome });
}
function valendo() {
  estado = 'jogando'; tEstado = CONFIG.tempoRodada;
  Som.bip(true); Som.energia(0.8);
  narrar('valendo');
}
function terminar(lado) {
  estado = 'resultado'; tEstado = CONFIG.tempoResultado;
  vencedor = lado;
  Som.energia(0.5);
  if (lado == null) { narrar('empate', {}, { prioridade: true }); return; }
  placar.vitorias[lado]++; salvarPlacar();
  Som.vitoria();
  narrar('vencedor', { time: LADOS[lado].nome }, { prioridade: true });
  T.confete(140);
  // O lado que perdeu cai na lama
  for (let i = 0; i < 4; i++) T.explosao(CENTRO + rnd(-60, 60), CHAO + 20, '#6b4a2b', 26, 12);
}

// Puxa a corda para um lado (0 = esquerda, 1 = direita)
function puxar(lado, forca, quem) {
  if (estado !== 'jogando') return;
  vel += (lado === 0 ? -1 : 1) * forca * 1.6;
  forcaRecente[lado] = Math.min(1, forcaRecente[lado] + forca * 0.06);
  if (quem) quem.forca += forca;
}

// ---------- Eventos da live ----------
function registrar(ev, lado) {
  let j = jogadores.get(ev.id);
  if (!j) {
    // Quem não escolheu vai para o lado com menos gente
    const n = [0, 0];
    for (const o of jogadores.values()) n[o.lado]++;
    j = { id: ev.id, nome: ev.nome, lado: lado ?? (n[0] <= n[1] ? 0 : 1), forca: 0, ultima: 0 };
    jogadores.set(ev.id, j);
  }
  j.nome = ev.nome || j.nome;
  return j;
}
Live.on('chat', ev => {
  const lado = acharEquipe(ev.texto, LADOS);
  const novo = !jogadores.has(ev.id);
  const j = registrar(ev, lado);
  if (lado != null && lado !== j.lado && estado !== 'jogando') j.lado = lado;
  if (novo) {
    T.aviso(`🪢 ${cortar(j.nome, 14)} → ${LADOS[j.lado].emoji} ${LADOS[j.lado].nome}`, LADOS[j.lado].ui);
    narrarComCalma('entrou', 7, { nome: j.nome, time: LADOS[j.lado].nome });
    Som.entrar();
  }
  // Comentários seguidos da mesma pessoa valem menos (para não virar metralhadora)
  const agora = performance.now();
  const fator = agora - j.ultima < 1200 ? 0.35 : 1;
  j.ultima = agora;
  puxar(j.lado, CONFIG.forcaComentario * fator, j);
  if (estado === 'jogando') T.flutuar(xDoLado(j.lado), CHAO - 230 + rnd(-30, 30), `💪 ${cortar(j.nome, 10)}`, LADOS[j.lado].ui, 26);
});

let curtidasTotal = 0;
Live.on('like', ev => {
  const j = registrar(ev);
  curtidasTotal += ev.qtd || 1;
  puxar(j.lado, Math.min(ev.qtd || 1, 15) * CONFIG.forcaCurtida, j);
  if (estado === 'jogando' && Math.random() < 0.6) T.flutuar(xDoLado(j.lado) + rnd(-80, 80), CHAO - 180, '❤️', '#ff4d8d', 30);
  if (Math.random() < 0.5) Som.curtida();
});

Live.on('gift', ev => {
  const j = registrar(ev);
  const d = ev.diamantes || 1, grande = d >= CONFIG.diamantesSuper;
  const lado = LADOS[j.lado];
  const nomePresente = (ev.qtd > 1 ? ev.qtd + 'x ' : '') + ev.presente;
  if (estado === 'jogando') {
    puxar(j.lado, grande ? 26 : 5 + Math.sqrt(d) * 1.6, j);
    T.explosao(xDoLado(j.lado), CHAO - 120, lado.ui, grande ? 50 : 22, grande ? 14 : 9);
  }
  if (grande) { T.banner(`💎 ${cortar(j.nome, 16)}`, `${nomePresente} → SUPER PUXÃO!`, [lado.cor, '#7b2cff']); Som.especial(); }
  else { T.aviso(`🎁 ${cortar(j.nome, 12)}: ${nomePresente} → PUXÃO!`, '#ffb020'); Som.turbo(); }
  narrar(chaveDoPresente(ev, grande), { nome: j.nome, presente: ev.presente, qtd: ev.qtd, time: lado.nome }, { prioridade: true });
});
Live.on('follow', ev => {
  const j = registrar(ev);
  puxar(j.lado, 4, j);
  T.aviso(`➕ ${cortar(j.nome, 14)} seguiu! Puxão!`, '#5ad8ff');
  narrar('seguiu', { nome: j.nome });
});
Live.on('share', ev => {
  const j = registrar(ev);
  puxar(j.lado, 4, j);
  T.aviso(`↗️ ${cortar(j.nome, 14)} compartilhou! Puxão!`, '#5ad8ff');
  narrar('compartilhou', { nome: j.nome });
});

// ---------- Atualização ----------
const xDoLado = lado => (lado === 0 ? 260 : W - 260);
function atualizar(dt) {
  tEstado -= dt;
  if (estado === 'preparo') {
    if (Math.ceil(tEstado) !== Math.ceil(tEstado + dt) && tEstado > 0 && tEstado < 3.5) Som.bip();
    if (tEstado <= 0) valendo();
  } else if (estado === 'jogando') {
    // Corda balança um pouquinho sozinha, para nunca ficar parada
    vel += Math.sin(performance.now() / 700) * 0.02;
    pos += vel * dt * 4;
    vel *= Math.pow(0.12, dt);
    pos = Math.max(-100, Math.min(100, pos));
    const lider = Math.abs(pos) < 8 ? 0 : Math.sign(pos);
    if (lider && lider !== ultimoLider) {
      if (ultimoLider) narrarComCalma('virada', 6, { time: LADOS[lider < 0 ? 0 : 1].nome });
      ultimoLider = lider;
    }
    if (Math.abs(pos) > 70) narrarComCalma('quase', 12, { time: LADOS[pos < 0 ? 0 : 1].nome });
    if (Math.abs(pos) > 40) {
      const perdendo = pos < 0 ? 1 : 0;
      narrarComCalma('chamar', 18, { time: LADOS[perdendo].nome, num: perdendo + 1 });
    }
    if (tEstado <= 10 && tEstado + dt > 10) narrar('final');
    if (tEstado <= 10 && Math.ceil(tEstado) !== Math.ceil(tEstado + dt)) Som.tique();
    if (Math.abs(pos) >= 100) terminar(pos < 0 ? 0 : 1);
    else if (tEstado <= 0) terminar(Math.abs(pos) < 3 ? null : pos < 0 ? 0 : 1);
  } else if (estado === 'resultado') {
    // A corda vai toda para o lado vencedor
    if (vencedor != null) pos += ((vencedor === 0 ? -115 : 115) - pos) * Math.min(1, dt * 3);
    if (tEstado <= 0) novaRodada();
  }
  forcaRecente = forcaRecente.map(f => Math.max(0, f - dt * 0.8));
  T.atualizarEfeitos(dt);
}

// ---------- Desenho ----------
const nuvens = Array.from({ length: 6 }, () => ({ x: rnd(0, W), y: rnd(560, 760), v: rnd(8, 20), s: rnd(0.7, 1.3) }));
function desenharCenario(t) {
  const ceu = c.createLinearGradient(0, 0, 0, CHAO);
  ceu.addColorStop(0, '#120a35'); ceu.addColorStop(0.55, '#3b1e7a'); ceu.addColorStop(1, '#ff7a59');
  c.fillStyle = ceu; c.fillRect(0, 0, W, CHAO);
  // sol se pondo
  const sol = c.createRadialGradient(CENTRO, CHAO - 40, 10, CENTRO, CHAO - 40, 260);
  sol.addColorStop(0, '#ffe08add'); sol.addColorStop(1, '#ffe08a00');
  c.fillStyle = sol; c.fillRect(0, CHAO - 320, W, 320);
  c.fillStyle = '#ffffff22';
  for (const n of nuvens) {
    n.x = (n.x + n.v * 0.016) % (W + 200);
    c.beginPath();
    c.ellipse(n.x - 100, n.y, 90 * n.s, 26 * n.s, 0, 0, Math.PI * 2);
    c.ellipse(n.x - 50, n.y - 16 * n.s, 60 * n.s, 24 * n.s, 0, 0, Math.PI * 2);
    c.fill();
  }
  // morros
  c.fillStyle = '#2a1650';
  c.beginPath(); c.moveTo(0, CHAO);
  for (let x = 0; x <= W; x += 60) c.lineTo(x, CHAO - 70 - Math.sin(x / 150) * 40 - Math.sin(x / 47) * 10);
  c.lineTo(W, CHAO); c.fill();
  // chão dos dois lados, com a cor de cada equipe
  const chao = (x0, x1, cor) => {
    const g = c.createLinearGradient(0, CHAO, 0, 1920);
    g.addColorStop(0, cor); g.addColorStop(0.08, '#2c8a3f'); g.addColorStop(1, '#0d2a17');
    c.fillStyle = g; c.fillRect(x0, CHAO, x1 - x0, 1920 - CHAO);
  };
  chao(0, CENTRO - 70, LADOS[0].cor);
  chao(CENTRO + 70, W, LADOS[1].cor);
  // lama no meio
  const lama = c.createLinearGradient(0, CHAO, 0, CHAO + 300);
  lama.addColorStop(0, '#7a5530'); lama.addColorStop(1, '#3b2614');
  c.fillStyle = lama; c.fillRect(CENTRO - 70, CHAO + 8, 140, 1920);
  c.fillStyle = '#9b7040';
  for (let i = 0; i < 5; i++) {
    const bx = CENTRO - 50 + i * 25, by = CHAO + 20 + Math.sin(t * 2 + i) * 4;
    c.beginPath(); c.ellipse(bx, by, 9, 4, 0, 0, Math.PI * 2); c.fill();
  }
  texto('LAMA', CENTRO, CHAO + 70, { tam: 26, alinhar: 'center', cor: '#e8c9a0', contorno: 4 });
  // marcas de vitória em cada lado
  for (const [lado, x] of [[0, CENTRO - ESCALA * 100], [1, CENTRO + ESCALA * 100]]) {
    c.fillStyle = LADOS[lado].ui;
    c.fillRect(x - 4, CHAO - 10, 8, 40);
  }
}

function desenharBoneco(x, y, eq, inclina, i, t) {
  c.save();
  c.translate(x, y);
  c.rotate(inclina);
  // pernas
  c.strokeStyle = '#1b1b2b'; c.lineWidth = 12; c.lineCap = 'round';
  const passo = Math.sin(t * 10 + i) * 6 * Math.min(1, Math.abs(inclina) * 4);
  c.beginPath(); c.moveTo(-8, -40); c.lineTo(-14 + passo, 0); c.moveTo(8, -40); c.lineTo(14 - passo, 0); c.stroke();
  // corpo
  c.fillStyle = eq.cor;
  c.beginPath(); c.roundRect(-24, -112, 48, 76, 18); c.fill();
  c.lineWidth = 3; c.strokeStyle = '#0006'; c.stroke();
  // cabeça = emblema da equipe
  c.drawImage(eq.escudo, -30, -172, 60, 60);
  c.restore();
}

function desenharCorda(t) {
  const desloc = pos * ESCALA;
  const meio = CENTRO + desloc;
  const y = CHAO - 95;
  // corda com leve curva
  c.lineCap = 'round';
  c.strokeStyle = '#7a5a2e'; c.lineWidth = 16;
  c.beginPath(); c.moveTo(meio - 470, y + 4); c.quadraticCurveTo(meio, y + 22 + Math.sin(t * 8) * 3, meio + 470, y + 4); c.stroke();
  c.strokeStyle = '#d9b26b'; c.lineWidth = 10;
  c.beginPath(); c.moveTo(meio - 470, y); c.quadraticCurveTo(meio, y + 18 + Math.sin(t * 8) * 3, meio + 470, y); c.stroke();
  // fitas trançadas
  c.strokeStyle = '#a07c3c'; c.lineWidth = 3;
  for (let x = meio - 460; x < meio + 460; x += 22) { c.beginPath(); c.moveTo(x, y - 5); c.lineTo(x + 10, y + 7); c.stroke(); }
  // nó/bandeira no meio
  c.fillStyle = '#ff2d55';
  c.beginPath(); c.moveTo(meio, y + 14); c.lineTo(meio - 22, y + 70); c.lineTo(meio + 22, y + 70); c.closePath(); c.fill();
  c.beginPath(); c.arc(meio, y + 12, 14, 0, Math.PI * 2); c.fillStyle = '#fff'; c.fill();
  // equipes (5 bonecos de cada lado, inclinando para trás quando puxam)
  for (let lado = 0; lado < 2; lado++) {
    const eq = LADOS[lado], s = lado === 0 ? -1 : 1;
    const caiu = estado === 'resultado' && vencedor != null && vencedor !== lado;
    const forca = estado === 'jogando' ? 0.12 + forcaRecente[lado] * 0.35 : 0.08;
    for (let i = 0; i < 5; i++) {
      const x = meio + s * (150 + i * 64);
      const yb = caiu && i < 2 ? CHAO + 30 : CHAO;
      desenharBoneco(x, yb, eq, -s * forca + Math.sin(t * 3 + i) * 0.02, i, t);
    }
  }
}

function desenharHUD(t) {
  T.sombraTopo(480);
  texto('🪢 CABO DE GUERRA', 30, 168, { tam: 46 });
  const status = estado === 'preparo' ? `COMEÇA EM ${Math.max(1, Math.ceil(tEstado))}` : estado === 'jogando' ? `⏱ ${Math.max(0, Math.ceil(tEstado))}s` : 'FIM!';
  texto(status, W - 30, 168, { tam: 40, alinhar: 'right', cor: estado === 'jogando' && tEstado <= 10 ? '#ff5f5f' : '#ffd23f' });

  // Placas das duas equipes
  const n = [0, 0];
  for (const j of jogadores.values()) n[j.lado]++;
  LADOS.forEach((eq, i) => {
    const x = i === 0 ? 30 : W / 2 + 10, w = W / 2 - 40, y = 215;
    caixa(x, y, w, 104, 22, '#00000099', eq.ui);
    c.drawImage(eq.escudo, x + 12, y + 12, 80, 80);
    c.beginPath(); c.arc(x + 82, y + 82, 20, 0, Math.PI * 2); c.fillStyle = '#ffd23f'; c.fill();
    texto(String(i + 1), x + 82, y + 84, { tam: 28, alinhar: 'center', cor: '#000', contorno: 0 });
    texto(cortar(eq.nome, 14), x + 110, y + 36, { tam: 32, cor: eq.ui, contorno: 4 });
    texto(`🏆 ${placar.vitorias[i]}   👥 ${n[i]}`, x + 110, y + 76, { tam: 26, contorno: 4, peso: 600 });
  });

  // Medidor de força (onde está o nó)
  const mx = 60, mw = W - 120, my = 350;
  caixa(mx, my, mw, 34, 17, '#ffffff1a');
  const meio = mx + mw / 2, p = (pos / 100) * (mw / 2);
  c.save(); c.beginPath(); c.roundRect(mx, my, mw, 34, 17); c.clip();
  c.fillStyle = pos < 0 ? LADOS[0].cor : LADOS[1].cor;
  c.fillRect(Math.min(meio, meio + p), my, Math.abs(p), 34);
  c.restore();
  c.fillStyle = '#fff'; c.fillRect(meio - 2, my - 6, 4, 46);
  c.beginPath(); c.arc(meio + p, my + 17, 22, 0, Math.PI * 2); c.fillStyle = '#ff2d55'; c.fill();
  c.lineWidth = 4; c.strokeStyle = '#fff'; c.stroke();

  texto('💬 COMENTE 1 ou 2 PARA PUXAR', W / 2, 425, { tam: 40, alinhar: 'center', cor: '#ffd23f' });
  texto('❤️ curtir = puxa junto   🎁 presente = PUXÃO   💎 presentão = SUPER PUXÃO', W / 2, 468, { tam: 25, alinhar: 'center', peso: 600 });

  // Quem mais puxou de cada lado (embaixo da arena)
  for (let lado = 0; lado < 2; lado++) {
    const top = [...jogadores.values()].filter(j => j.lado === lado && j.forca > 0).sort((a, b) => b.forca - a.forca).slice(0, 3);
    const x = lado === 0 ? 40 : W / 2 + 20;
    if (!top.length) continue;
    caixa(x, 1090, W / 2 - 60, 46 + top.length * 40, 18, '#000000a0');
    texto('💪 MAIS FORTES', x + 18, 1114, { tam: 22, cor: LADOS[lado].ui, contorno: 0 });
    top.forEach((j, i) => texto(`${['🥇', '🥈', '🥉'][i]} ${cortar(j.nome, 14)}`, x + 18, 1154 + i * 40, { tam: 26, contorno: 0 }));
  }

  if (estado !== 'resultado') {
    const fim = T.desenharApoiadores(W - 360, 520);
    T.desenharAvisos(fim + 40);
  }
  if (estado === 'preparo') {
    const s = Math.ceil(tEstado);
    caixa(140, 560, W - 280, 250, 36, '#000000c0', '#ffd23f');
    texto(`RODADA ${rodada}`, W / 2, 610, { tam: 32, alinhar: 'center', cor: '#7fe8ff', contorno: 0 });
    texto(`${LADOS[0].emoji} ${cortar(LADOS[0].nome, 10)}  x  ${cortar(LADOS[1].nome, 10)} ${LADOS[1].emoji}`, W / 2, 680, { tam: 52, alinhar: 'center' });
    texto(s > 0 ? String(s) : 'JÁ!', W / 2, 760, { tam: 70, alinhar: 'center', cor: '#ffd23f' });
    Marca.desenhar(c, W / 2, 870, 32);
  }
  if (estado === 'resultado') {
    caixa(90, 540, W - 180, 330, 40, '#000000cc', vencedor != null ? LADOS[vencedor].ui : '#fff');
    if (vencedor == null) {
      texto('🤝 EMPATE!', W / 2, 650, { tam: 76, alinhar: 'center', cor: '#ffd23f' });
      texto('Comente 1 ou 2 na próxima!', W / 2, 740, { tam: 36, alinhar: 'center' });
    } else {
      const eq = LADOS[vencedor];
      c.drawImage(eq.escudo, W / 2 - 70, 565, 140, 140);
      texto(`${eq.nome.toUpperCase()} VENCEU!`, W / 2, 755, { tam: 62, alinhar: 'center', cor: eq.ui, max: W - 220 });
      const mvp = [...jogadores.values()].filter(j => j.lado === vencedor).sort((a, b) => b.forca - a.forca)[0];
      if (mvp?.forca) texto(`💪 Mais forte: ${cortar(mvp.nome, 16)}`, W / 2, 820, { tam: 34, alinhar: 'center' });
    }
    texto(`Próxima rodada em ${Math.max(0, Math.ceil(tEstado))}s`, W / 2, 920, { tam: 32, alinhar: 'center', cor: '#ffd23f' });
  }
  T.desenharBanner(760);
}

rodarQuadros((dt, t) => {
  atualizar(dt);
  desenharCenario(t);
  desenharCorda(t);
  T.desenharEfeitos();
  desenharHUD(t);
});

novaRodada();
aoComecar(() => Som.musica({ bpm: 132, energia: 0.4 }));

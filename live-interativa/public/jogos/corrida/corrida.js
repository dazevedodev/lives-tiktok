// Corrida de Bolinhas: cada pessoa que comenta vira uma bolinha da sua equipe e desce uma pista
// gerada na hora. Curtida empurra, presente dá turbo, presente grande teleporta para a frente.
const { Engine, Bodies, Body, Composite, Events } = Matter;

// ---------- Configuração (pode mudar à vontade) ----------
const CONFIG = {
  tempoInscricao: 25,   // segundos para entrar antes da largada
  tempoResultado: 9,    // segundos mostrando o vencedor
  tempoMaxCorrida: 100, // se ninguém chegar, termina assim mesmo
  maxBolinhas: 140,
  // Foto de perfil das pessoas nas bolinhas. Desligado por segurança: uma foto imprópria
  // de alguém do chat apareceria grande na sua live e poderia gerar denúncia.
  mostrarFotos: false,
  diamantesMegaTurbo: 10,
  diamantesTeleporte: 99,
};
// Equipes da corrida: as 4 primeiras configuradas no painel.
const TIMES = EQUIPES.slice(0, 4);
// Bolinhas da casa (entram quando uma equipe fica sem ninguém). O nome deixa claro que não é
// um espectador de verdade.
const mascote = t => `🤖 Mascote ${t.nome}`;
const NUMEROS = numerosDasEquipes(TIMES.length);
const nomesEquipes = TIMES.map(t => t.nome).join('|'); // placar zera se as equipes mudarem

// ---------- Tela ----------
const W = 1080, H = 1920;
const canvas = document.getElementById('tela');
canvas.width = W; canvas.height = H;
const c = canvas.getContext('2d');


// A parte de cima e a de baixo da tela ficam cobertas pela interface do TikTok,
// então o que importa fica entre ~150px e ~1250px.
const CAM_INSCRICAO = -200;   // câmera durante a inscrição (mostra a caixa de largada)
const ALVO_LIDER_TELA = 1050; // altura da tela onde o líder fica durante a corrida

// ---------- Física ----------
const CAT_PISTA = 0x1, CAT_BOLA = 0x2;
const BOLA_R = 20;
const CAIXA_TOPO = 300, CAIXA_FUNDO = 720;
const OPT = { isStatic: true, friction: 0.08, restitution: 0.3, collisionFilter: { category: CAT_PISTA } };
let engine, pista;

const rnd = (a, b) => a + Math.random() * (b - a);
const rint = (a, b) => Math.floor(rnd(a, b + 1));
const agoraMs = () => performance.now();

function estatico(corpo, tipo, cor) {
  corpo.tipoPista = tipo; corpo.cor = cor; corpo.flash = 0;
  pista.estaticos.push(corpo);
  return corpo;
}
function rampa(x1, y1, x2, y2, cor, esp = 26) {
  const corpo = Bodies.rectangle((x1 + x2) / 2, (y1 + y2) / 2, Math.hypot(x2 - x1, y2 - y1), esp,
    { ...OPT, angle: Math.atan2(y2 - y1, x2 - x1), chamfer: { radius: esp / 2 - 1 } });
  return estatico(corpo, 'rampa', cor);
}
const pino = (x, y, cor, r = 11) => estatico(Bodies.circle(x, y, r, { ...OPT, restitution: 0.5 }), 'pino', cor);
const bumper = (x, y, r = 40) => estatico(Bodies.circle(x, y, r, { ...OPT, restitution: 0.9 }), 'bumper', '#ff3d8b');
function moinho(x, y, tam, cor) {
  const corpo = estatico(Bodies.rectangle(x, y, tam, 22, { ...OPT, chamfer: { radius: 10 } }), 'moinho', cor);
  corpo.vel = (Math.random() < 0.5 ? -1 : 1) * rnd(0.025, 0.04);
  pista.giratorios.push(corpo);
  return corpo;
}

// Trechos da pista. Cada um recebe o y de onde começa e devolve onde termina.
const TRECHOS = {
  ziguezague(y, cor) {
    const n = rint(4, 5), comprimento = W * 0.78, esquerdaPrimeiro = Math.random() < 0.5;
    for (let i = 0; i < n; i++) {
      if ((i % 2 === 0) === esquerdaPrimeiro) rampa(-20, y, comprimento, y + 200, cor);
      else rampa(W + 20, y, W - comprimento, y + 200, cor);
      y += 270;
    }
    return y + 60;
  },
  pinos(y, cor) {
    const linhas = rint(6, 8), dx = 118, dy = 100;
    for (let l = 0; l < linhas; l++) {
      for (let x = 60 + (l % 2 ? dx / 2 : 0); x < W - 40; x += dx) pino(x, y + l * dy, cor);
    }
    return y + linhas * dy + 40;
  },
  moinhos(y, cor) {
    [180, 540, 900].forEach(x => moinho(x, y + 180, 250, cor));
    [330, 750].forEach(x => moinho(x, y + 500, 300, cor));
    pino(540, y + 500, cor, 14);
    return y + 720;
  },
  funil(y, cor) {
    const vao = 170;
    rampa(-20, y, W / 2 - vao / 2, y + 300, cor);
    rampa(W + 20, y, W / 2 + vao / 2, y + 300, cor);
    bumper(W / 2, y + 470, 36);
    bumper(W * 0.2, y + 560); bumper(W * 0.8, y + 560);
    return y + 700;
  },
  bumpers(y) {
    [[200, 0], [540, 0], [880, 0], [370, 1], [710, 1], [200, 2], [540, 2], [880, 2]]
      .forEach(([x, l]) => bumper(x + rnd(-30, 30), y + 80 + l * 210, 42));
    return y + 3 * 210 + 60;
  },
  degraus(y, cor) {
    for (let l = 0; l < 3; l++) {
      const yy = y + l * 230, buraco = rnd(160, W - 160);
      rampa(-20, yy, buraco - 58, yy + 70, cor);
      rampa(W + 20, yy, buraco + 58, yy + 70, cor);
    }
    return y + 3 * 230 + 60;
  },
};

function construirPista() {
  engine = Engine.create({ gravity: { x: 0, y: 1.3 } });
  engine.positionIterations = 8;
  engine.velocityIterations = 6;
  pista = { estaticos: [], giratorios: [], secoes: [], chegada: 0, fim: 0, portao: null };

  const nomes = Object.keys(TRECHOS);
  const matiz = rint(0, 360);
  let y = CAIXA_FUNDO + 140, anterior = '';
  for (let i = 0; i < 7; i++) {
    let nome;
    do { nome = nomes[rint(0, nomes.length - 1)]; } while (nome === anterior);
    anterior = nome;
    const cor = `hsl(${(matiz + i * 52) % 360} 90% 62%)`;
    const inicio = y;
    y = TRECHOS[nome](y, cor) + 90;
    pista.secoes.push({ inicio, fim: y, cor });
  }
  pista.chegada = y + 60;
  pista.fim = pista.chegada + 420;

  // Paredes, teto da caixa, portão e chão
  const altura = pista.fim + 600;
  estatico(Bodies.rectangle(-40, altura / 2 - 400, 80, altura, OPT), 'parede', '#3a4380');
  estatico(Bodies.rectangle(W + 40, altura / 2 - 400, 80, altura, OPT), 'parede', '#3a4380');
  estatico(Bodies.rectangle(W / 2, CAIXA_TOPO - 15, W, 30, OPT), 'parede', '#3a4380');
  pista.portao = estatico(Bodies.rectangle(W / 2, CAIXA_FUNDO + 15, W, 30, OPT), 'portao', '#ffd23f');
  estatico(Bodies.rectangle(W / 2, pista.fim, W, 40, OPT), 'parede', '#3a4380');

  Composite.add(engine.world, pista.estaticos);
  Events.on(engine, 'collisionStart', aoColidir);
}

// ---------- Jogadores ----------
const jogadores = new Map();
function bolasNaPista() { return engine.world.bodies.filter(b => b.jogador); }
function timeMenor() {
  const n = TIMES.map(() => 0);
  for (const b of bolasNaPista()) n[b.jogador.time]++;
  return n.indexOf(Math.min(...n));
}
function registrar(ev, time) {
  let j = jogadores.get(ev.id);
  if (!j) {
    j = { id: ev.id, nome: ev.nome, time: time ?? timeMenor(), bola: null, img: null, cpu: false, turboAte: 0, turboLargada: false };
    if (ev.foto && CONFIG.mostrarFotos) {
      j.img = new Image();
      j.img.referrerPolicy = 'no-referrer';
      j.img.src = ev.foto;
    }
    jogadores.set(ev.id, j);
  }
  j.nome = ev.nome || j.nome;
  j.ultimaAcao = agoraMs();
  return j;
}
function criarBola(j, x, y) {
  if (j.bola || bolasNaPista().length >= CONFIG.maxBolinhas) return null;
  const b = Bodies.circle(x, y, BOLA_R, {
    // atrito alto o bastante para a bolinha rolar (girar) em vez de escorregar
    restitution: 0.45, friction: 0.08, frictionStatic: 0.4, frictionAir: 0.005, density: 0.002,
    collisionFilter: { category: CAT_BOLA, mask: CAT_PISTA | CAT_BOLA },
  });
  b.jogador = j; b.melhorY = y; b.parado = 0; b.rastro = [];
  j.bola = b; j.chegou = false;
  Composite.add(engine.world, b);
  return b;
}
function entrarNaCaixa(j) {
  const b = criarBola(j, rnd(80, W - 80), rnd(CAIXA_TOPO + 40, CAIXA_FUNDO - 60));
  if (b) { Som.entrar(); explosao(b.position.x, b.position.y, TIMES[j.time].ui, 10); }
  return b;
}
function removerBola(j) {
  if (j.bola) Composite.remove(engine.world, j.bola);
  j.bola = null;
}

// ---------- Narração (voz da Thalita) ----------
// Só frases prontas + nome da pessoa. Nada de pedir presente: só agradecer e explicar o jogo.
const FALAS = {
  novaRodada: [`Nova corrida! Comenta ${NUMEROS} pra entrar na sua equipe!`, 'Pista nova saindo do forno! Escolhe tua equipe no chat!', 'Bora pra mais uma! Comenta o número da sua equipe!'],
  chamar: [`Ainda dá tempo! Comenta ${NUMEROS}!`, 'Quem vai defender a equipe {time}? Comenta {num}!', 'A equipe {time} tá precisando de gente! Comenta {num}!'],
  entrou: ['{nome} entrou na equipe {time}!', 'Chegou {nome} pela equipe {time}!', 'Bem-vindo à pista, {nome}!'],
  largada: ['Valendo!', 'Foi dada a largada!', 'E lá vão eles!'],
  lider: ['{nome} assumiu a liderança!', '{nome} passou na frente pela equipe {time}!', 'Olha {nome} disparando!'],
  presente: ['Valeu, {nome}! Turbo ligado!', 'Obrigada pelo presente, {nome}! Turbo pra você!', '{nome} mandou {presente}! Lá vai o turbo!'],
  presenteRosa: ['Valeu pela rosa, {nome}! Turbo ligado!', 'Uma rosa de {nome}! Obrigada! Turbo!', 'Obrigada pela rosinha, {nome}!'],
  presenteGrande: ['Uau! {nome} mandou {presente}! Teletransporte!', 'Que isso, {nome}! {presente}! Direto pra frente!'],
  presenteLargada: ['Valeu, {nome}! Turbo guardado pra largada!', 'Obrigada, {nome}! Você larga com turbo!'],
  seguiu: ['Obrigada por seguir, {nome}!', '{nome} seguiu a live! Valeu demais!'],
  compartilhou: ['Valeu por compartilhar, {nome}!', '{nome} compartilhou a live! Obrigada!'],
  vencedor: ['{nome} venceu! Ponto pra equipe {time}!', 'Vitória de {nome}! A equipe {time} comemora!', 'Ganhou! {nome} levou essa pela equipe {time}!'],
  apoiador: ['{nome} agora é o maior apoiador da live!', 'Coroa nova! {nome} é o top apoiador!'],
  curtidas: ['Já são {n} curtidas! Valeu, galera!', '{n} curtidas! Continua curtindo!'],
};
const ultimaFala = {};
function narrar(tipo, vars = {}, opcoes = {}) { Voz.falar(FALAS[tipo], vars, opcoes); }
// Fala no máximo uma vez a cada X segundos (para não virar uma metralhadora de falas)
function narrarComCalma(tipo, segundos, vars = {}) {
  if (agoraMs() - (ultimaFala[tipo] || 0) < segundos * 1000) return;
  ultimaFala[tipo] = agoraMs();
  narrar(tipo, vars);
}
Ranking.aoMudarLider(p => narrar('apoiador', { nome: p.nome }));

// ---------- Rodada ----------
let estado = 'inscricao', tEstado = CONFIG.tempoInscricao, tCorrida = 0, tPrimeiro = 0;
let camY = CAM_INSCRICAO, chegaram = [], vencedor = null, liderAtual = null;
let placar = carregarPlacar();

function novaRodada() {
  for (const j of jogadores.values()) j.bola = null;
  for (const [id, j] of jogadores) if (j.cpu) jogadores.delete(id);
  construirPista();
  // Quem participou nos últimos 15 minutos entra automaticamente
  const limite = agoraMs() - 15 * 60 * 1000;
  for (const j of jogadores.values()) if (j.ultimaAcao > limite) entrarNaCaixa(j);
  estado = 'inscricao'; tEstado = CONFIG.tempoInscricao;
  chegaram = []; vencedor = null; tCorrida = 0; liderAtual = null;
  Som.energia(0.4);
  narrar('novaRodada');
}

function largada() {
  // Garante pelo menos uma bolinha por time (robôs), para sempre ter corrida
  TIMES.forEach((time, i) => {
    if (bolasNaPista().some(b => b.jogador.time === i)) return;
    const j = { id: 'cpu' + i, nome: mascote(time), time: i, cpu: true, turboAte: 0, ultimaAcao: 0 };
    jogadores.set(j.id, j);
    entrarNaCaixa(j);
  });
  estado = 'largada'; tEstado = 3;
  Som.bip();
}

function comecarCorrida() {
  Composite.remove(engine.world, pista.portao);
  pista.estaticos.splice(pista.estaticos.indexOf(pista.portao), 1);
  estado = 'corrida'; tCorrida = 0;
  Som.bip(true); Som.energia(0.85);
  narrar('largada');
  for (const b of bolasNaPista()) {
    if (b.jogador.turboLargada) { b.jogador.turboLargada = false; darTurbo(b.jogador, 3); }
  }
}

function terminarCorrida() {
  const ordem = chegaram.length ? chegaram : bolasNaPista().sort((a, b) => b.position.y - a.position.y).map(b => b.jogador);
  vencedor = ordem[0];
  chegaram = ordem.slice(0, 3);
  if (vencedor) {
    placar.times[vencedor.time]++;
    if (!vencedor.cpu) {
      const p = placar.campeoes[vencedor.id] ||= { nome: vencedor.nome, vitorias: 0 };
      p.nome = vencedor.nome; p.vitorias++;
    }
    salvarPlacar();
  }
  estado = 'resultado'; tEstado = CONFIG.tempoResultado;
  Som.vitoria(); Som.energia(0.5);
  if (vencedor) narrar('vencedor', { nome: vencedor.nome, time: TIMES[vencedor.time].nome }, { prioridade: true });
  for (let i = 0; i < 120; i++) confete();
}

function liderCorrida() {
  let lider = null;
  for (const b of bolasNaPista()) if (!b.jogador.chegou && (!lider || b.position.y > lider.position.y)) lider = b;
  return lider;
}
function ultimoColocado() {
  let ultimo = null;
  for (const b of bolasNaPista()) if (!b.jogador.chegou && (!ultimo || b.position.y < ultimo.position.y)) ultimo = b;
  return ultimo;
}

// ---------- Poderes ----------
function darTurbo(j, segundos, forca = 12) {
  const b = j.bola; if (!b) return;
  j.turboAte = Math.max(j.turboAte, agoraMs()) + segundos * 1000;
  b.fantasma = true;
  b.collisionFilter.mask = CAT_PISTA; // atravessa as outras bolinhas
  Body.setVelocity(b, { x: b.velocity.x * 0.5, y: Math.max(b.velocity.y, 0) + forca });
  explosao(b.position.x, b.position.y, '#ffb020', 18);
  Som.turbo();
}
function teleportar(j) {
  const lider = liderCorrida();
  if (!lider || lider === j.bola) return darTurbo(j, 5, 16);
  explosao(j.bola.position.x, j.bola.position.y, '#b46bff', 25);
  Body.setPosition(j.bola, { x: lider.position.x, y: lider.position.y });
  Body.setVelocity(j.bola, { x: 0, y: 0 });
  j.bola.rastro = [];
  explosao(lider.position.x, lider.position.y, '#b46bff', 25);
  Som.teleporte();
  darTurbo(j, 4, 8);
}
function empurrar(b, qtd) {
  Body.setVelocity(b, { x: b.velocity.x + rnd(-3, 3), y: b.velocity.y + 2 + Math.min(qtd, 15) * 0.35 });
}
function pulinho(b) {
  Body.setVelocity(b, { x: rnd(-5, 5), y: -rnd(8, 13) });
}

// ---------- Eventos da live ----------
let ultimoAvisoEntrada = 0;
Live.on('chat', ev => {
  const time = acharEquipe(ev.texto, TIMES);
  const novo = !jogadores.has(ev.id);
  const j = registrar(ev, time);
  if (time != null && time !== j.time && (!j.bola || estado === 'inscricao')) {
    j.time = time;
    if (j.bola) explosao(j.bola.position.x, j.bola.position.y, TIMES[time].ui, 10);
  }
  if (!j.bola) {
    if (estado === 'inscricao' || estado === 'largada') {
      if (entrarNaCaixa(j)) {
        aviso(`${j.nome} entrou: ${TIMES[j.time].emoji} ${TIMES[j.time].nome}`, TIMES[j.time].ui);
        narrarComCalma('entrou', 6, { nome: j.nome, time: TIMES[j.time].nome });
      }
    } else if (novo) {
      aviso(`${j.nome} entra na próxima corrida!`, TIMES[j.time].ui);
    }
  } else if (estado === 'inscricao') {
    pulinho(j.bola);
  }
});

let ultimoSomCurtida = 0, curtidasTotal = 0;
Live.on('like', ev => {
  const antes = curtidasTotal;
  curtidasTotal += ev.qtd || 1;
  if (Math.floor(curtidasTotal / 200) > Math.floor(antes / 200)) narrar('curtidas', { n: Math.floor(curtidasTotal / 200) * 200 });
  let j = jogadores.get(ev.id);
  if (!j && estado === 'inscricao') { j = registrar(ev); entrarNaCaixa(j); }
  if (j) j.ultimaAcao = agoraMs();
  const b = j?.bola;
  if (b) {
    if (estado === 'inscricao') pulinho(b);
    else if (estado === 'corrida' && !j.chegou) empurrar(b, ev.qtd);
    coracoes(b.position.x, b.position.y, Math.min(ev.qtd || 1, 6));
  }
  if (agoraMs() - ultimoSomCurtida > 120) { Som.curtida(); ultimoSomCurtida = agoraMs(); }
});

Live.on('gift', ev => {
  const j = registrar(ev);
  const d = ev.diamantes || 1;
  const nomePresente = (ev.qtd > 1 ? ev.qtd + 'x ' : '') + ev.presente;
  if (estado === 'corrida') {
    if (!j.bola) {
      const ultimo = ultimoColocado();
      if (ultimo) {
        criarBola(j, ultimo.position.x, ultimo.position.y);
        j.bola.melhorY = ultimo.position.y;
      }
    }
    if (j.bola && !j.chegou) {
      if (d >= CONFIG.diamantesTeleporte) {
        bannerGrande(`💎 ${j.nome}`, `mandou ${nomePresente} → TELEPORTE!`);
        narrar('presenteGrande', { nome: j.nome, presente: ev.presente }, { prioridade: true });
        return teleportar(j);
      }
      darTurbo(j, d >= CONFIG.diamantesMegaTurbo ? 6 : 3.5, d >= CONFIG.diamantesMegaTurbo ? 18 : 12);
      aviso(`🎁 ${j.nome}: ${nomePresente} → ${d >= CONFIG.diamantesMegaTurbo ? 'MEGA TURBO' : 'TURBO'}!`, '#ffb020');
      narrar(/rosa|rose/i.test(ev.presente || '') ? 'presenteRosa' : 'presente', { nome: j.nome, presente: ev.presente }, { prioridade: true });
      return;
    }
  }
  // Fora da corrida: guarda o turbo para a largada
  if (!j.bola && estado !== 'resultado') entrarNaCaixa(j);
  j.turboLargada = true;
  Som.moeda();
  if (d >= CONFIG.diamantesTeleporte) bannerGrande(`💎 ${j.nome}`, `mandou ${nomePresente}! Largada com TURBO`);
  else aviso(`🎁 ${j.nome}: ${nomePresente} → turbo na largada!`, '#ffb020');
  narrar('presenteLargada', { nome: j.nome }, { prioridade: true });
});

Live.on('follow', ev => {
  const j = registrar(ev);
  aviso(`➕ ${j.nome} seguiu! Valeu!`, '#5ad8ff');
  narrar('seguiu', { nome: j.nome });
  if (j.bola && estado === 'corrida' && !j.chegou) darTurbo(j, 2, 8);
});
Live.on('share', ev => {
  const j = registrar(ev);
  aviso(`↗️ ${j.nome} compartilhou! Turbo!`, '#5ad8ff');
  narrar('compartilhou', { nome: j.nome });
  if (j.bola && estado === 'corrida' && !j.chegou) darTurbo(j, 2, 8);
});
Live.on('join', ev => {
  if (estado !== 'inscricao' || agoraMs() - ultimoAvisoEntrada < 4000) return;
  ultimoAvisoEntrada = agoraMs();
  aviso(`👋 ${ev.nome} chegou! Comente ${NUMEROS}`, '#aaaaaa');
});

// ---------- Colisões ----------
let ultimoPop = 0;
function aoColidir(e) {
  for (const { bodyA, bodyB } of e.pairs) {
    const fixo = bodyA.tipoPista ? bodyA : bodyB.tipoPista ? bodyB : null;
    const bola = bodyA.jogador ? bodyA : bodyB.jogador ? bodyB : null;
    if (!fixo || !bola) continue;
    const visivel = bola.position.y > camY && bola.position.y < camY + H;
    if (fixo.tipoPista === 'bumper') {
      const dx = bola.position.x - fixo.position.x, dy = bola.position.y - fixo.position.y, d = Math.hypot(dx, dy) || 1;
      Body.setVelocity(bola, { x: bola.velocity.x + dx / d * 7, y: bola.velocity.y + dy / d * 7 });
      fixo.flash = 1;
      if (visivel) Som.bumper();
    } else if (fixo.tipoPista === 'pino' && visivel && agoraMs() - ultimoPop > 70) {
      ultimoPop = agoraMs();
      fixo.flash = 1;
      Som.pop(rnd(0.8, 1.6));
    }
  }
}

// ---------- Efeitos visuais ----------
let particulas = [], avisos = [], banner = null;
function explosao(x, y, cor, n) {
  for (let i = 0; i < n; i++) {
    const a = rnd(0, Math.PI * 2), v = rnd(2, 9);
    particulas.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, vida: rnd(0.4, 0.9), cor, tam: rnd(4, 9) });
  }
}
function coracoes(x, y, n) {
  for (let i = 0; i < n; i++) particulas.push({ x: x + rnd(-15, 15), y, vx: rnd(-1, 1), vy: rnd(-5, -2), vida: 1, cor: '#ff4d8d', tam: 26, texto: '❤' });
}
function confete() {
  const cores = ['#ffd23f', '#ff3d8b', '#3fd36f', '#5ad8ff', '#b46bff', '#ffffff'];
  particulas.push({ x: rnd(0, W), y: camY + rnd(-200, 0), vx: rnd(-2, 2), vy: rnd(2, 7), vida: rnd(2.5, 4.5),
    cor: cores[rint(0, cores.length - 1)], tam: rnd(8, 16), giro: rnd(0, 6) });
}
function aviso(texto, cor = '#fff') {
  avisos.unshift({ texto, cor, vida: 5 });
  avisos.length = Math.min(avisos.length, 5);
}
function bannerGrande(titulo, sub) {
  banner = { titulo, sub, vida: 3.2 };
  for (let i = 0; i < 60; i++) confete();
}

// ---------- Placar do dia (fica salvo no navegador) ----------
function hoje() { return new Date().toISOString().slice(0, 10); }
function carregarPlacar() {
  try {
    const p = JSON.parse(localStorage.getItem('corrida-placar'));
    if (p && p.dia === hoje() && p.equipes === nomesEquipes) return p;
  } catch { /* sem placar salvo */ }
  return { dia: hoje(), equipes: nomesEquipes, times: TIMES.map(() => 0), campeoes: {} };
}
function salvarPlacar() {
  try { localStorage.setItem('corrida-placar', JSON.stringify(placar)); } catch { /* ignora */ }
}

// ---------- Atualização ----------
function atualizar(dt) {
  tEstado -= dt;
  if (estado === 'inscricao' && tEstado <= 12 && tEstado + dt > 12) {
    // No meio da inscrição, chama gente para o time mais vazio
    const i = timeMenor();
    narrarComCalma('chamar', 20, { time: TIMES[i].nome, num: i + 1 });
  }
  if (estado === 'inscricao' && tEstado <= 0) largada();
  else if (estado === 'largada') {
    if (Math.ceil(tEstado) !== Math.ceil(tEstado + dt) && tEstado > 0) Som.bip();
    if (tEstado <= 0) comecarCorrida();
  } else if (estado === 'corrida') {
    tCorrida += dt;
    const lider = liderCorrida()?.jogador;
    if (lider && lider !== liderAtual) {
      liderAtual = lider;
      if (tCorrida > 4) narrarComCalma('lider', 8, { nome: lider.nome, time: TIMES[lider.time].nome });
    }
    const bolas = bolasNaPista();
    for (const b of bolas) {
      const j = b.jogador;
      if (j.chegou) continue;
      if (b.position.y > pista.chegada) {
        j.chegou = true;
        chegaram.push(j);
        if (chegaram.length === 1) tPrimeiro = tCorrida;
        aviso(`🏁 ${chegaram.length}º lugar: ${j.nome}`, TIMES[j.time].ui);
        Som.moeda();
        continue;
      }
      // Destrava bolinha presa
      if (b.position.y > b.melhorY + 25) { b.melhorY = b.position.y; b.parado = 0; }
      else if ((b.parado += dt) > 4) { Body.setVelocity(b, { x: rnd(-7, 7), y: -8 }); b.parado = 1.5; }
      // Rastro do turbo
      if (j.turboAte > agoraMs()) {
        particulas.push({ x: b.position.x + rnd(-8, 8), y: b.position.y - 10, vx: rnd(-1, 1), vy: rnd(-4, -1),
          vida: 0.45, cor: Math.random() < 0.5 ? '#ffb020' : '#ff5a1f', tam: rnd(6, 12) });
      }
    }
    const todosChegaram = bolas.every(b => b.jogador.chegou);
    if (chegaram.length >= 3 || todosChegaram || (chegaram.length && tCorrida - tPrimeiro > 7) || tCorrida > CONFIG.tempoMaxCorrida) {
      terminarCorrida();
    }
  } else if (estado === 'resultado' && tEstado <= 0) {
    novaRodada();
  }

  // Câmera
  let alvo = CAM_INSCRICAO;
  if (estado === 'corrida') {
    const lider = liderCorrida();
    alvo = lider ? lider.position.y - ALVO_LIDER_TELA : pista.chegada - ALVO_LIDER_TELA;
  } else if (estado === 'resultado') alvo = camY;
  alvo = Math.max(CAM_INSCRICAO, Math.min(alvo, pista.fim - H + 200));
  camY += (alvo - camY) * Math.min(1, dt * 3.5);

  for (const p of particulas) {
    p.x += p.vx; p.y += p.vy; p.vida -= dt;
    if (p.giro != null) { p.giro += 0.15; p.vx *= 0.99; } else { p.vy += 0.15; }
  }
  particulas = particulas.filter(p => p.vida > 0);
  if (particulas.length > 900) particulas.splice(0, particulas.length - 900);
  for (const a of avisos) a.vida -= dt;
  avisos = avisos.filter(a => a.vida > 0);
  if (banner && (banner.vida -= dt) <= 0) banner = null;
  for (const s of pista.estaticos) if (s.flash > 0) s.flash = Math.max(0, s.flash - dt * 4);
}

function passoFisica() {
  for (const g of pista.giratorios) Body.setAngle(g, g.angle + g.vel, true);
  const agora = agoraMs();
  for (const b of bolasNaPista()) {
    const turbo = b.jogador.turboAte > agora;
    if (turbo) Body.applyForce(b, b.position, { x: 0, y: b.mass * 0.0012 });
    else if (b.fantasma) { b.fantasma = false; b.collisionFilter.mask = CAT_PISTA | CAT_BOLA; }
    const max = turbo ? 36 : 28, v = b.velocity, s = Math.hypot(v.x, v.y);
    if (s > max) Body.setVelocity(b, { x: v.x * max / s, y: v.y * max / s });
  }
  Engine.update(engine, 1000 / 60);
}

// ---------- Desenho ----------
const estrelas = Array.from({ length: 90 }, () => ({ x: rnd(0, W), y: rnd(0, H * 2), r: rnd(1, 2.6) }));

function texto(str, x, y, { tam = 40, cor = '#fff', alinhar = 'left', peso = 800, contorno = 6, base = 'middle' } = {}) {
  c.font = `${Math.min(peso, 700)} ${tam}px Fredoka, "Segoe UI Emoji", sans-serif`;
  c.textAlign = alinhar; c.textBaseline = base;
  if (contorno) { c.lineWidth = contorno; c.strokeStyle = '#000a'; c.lineJoin = 'round'; c.strokeText(str, x, y); }
  c.fillStyle = cor; c.fillText(str, x, y);
}
function caixa(x, y, w, h, r, cor) {
  c.beginPath(); c.roundRect(x, y, w, h, r); c.fillStyle = cor; c.fill();
}
function cortar(str, max) { return str.length > max ? str.slice(0, max - 1) + '…' : str; }

function desenharFundo() {
  const g = c.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#1a0f3a'); g.addColorStop(1, '#07142e');
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  c.fillStyle = '#ffffff55';
  for (const s of estrelas) {
    const y = ((s.y - camY * 0.3) % (H * 2) + H * 2) % (H * 2) - H * 0.5;
    c.beginPath(); c.arc(s.x, y, s.r, 0, Math.PI * 2); c.fill();
  }
}

function desenharPista() {
  for (const s of pista.estaticos) {
    if (s.bounds.max.y < camY - 50 || s.bounds.min.y > camY + H + 50) continue;
    c.save();
    if (s.circleRadius) {
      const r = s.circleRadius * (1 + s.flash * 0.25);
      c.shadowColor = s.cor; c.shadowBlur = s.tipoPista === 'bumper' ? 25 + s.flash * 30 : 10;
      c.beginPath(); c.arc(s.position.x, s.position.y, r, 0, Math.PI * 2);
      c.fillStyle = s.flash > 0.3 ? '#fff' : s.cor; c.fill();
      if (s.tipoPista === 'bumper') {
        c.shadowBlur = 0; c.lineWidth = 6; c.strokeStyle = '#ffffffaa';
        c.beginPath(); c.arc(s.position.x, s.position.y, r * 0.6, 0, Math.PI * 2); c.stroke();
      }
    } else {
      c.beginPath();
      s.vertices.forEach((v, i) => i ? c.lineTo(v.x, v.y) : c.moveTo(v.x, v.y));
      c.closePath();
      if (s.tipoPista === 'portao') {
        c.fillStyle = '#ffd23f'; c.fill();
        c.clip();
        c.fillStyle = '#111';
        for (let x = -40; x < W; x += 60) { c.beginPath(); c.moveTo(x, CAIXA_FUNDO); c.lineTo(x + 30, CAIXA_FUNDO); c.lineTo(x + 60, CAIXA_FUNDO + 30); c.lineTo(x + 30, CAIXA_FUNDO + 30); c.fill(); }
      } else {
        c.fillStyle = s.tipoPista === 'parede' ? '#141a3a' : '#0d1230';
        c.shadowColor = s.cor; c.shadowBlur = 18; c.fill();
        c.shadowBlur = 0; c.lineWidth = 4; c.strokeStyle = s.cor; c.stroke();
      }
    }
    c.restore();
  }
  // Linha de chegada
  const y = pista.chegada;
  if (y > camY - 100 && y < camY + H) {
    for (let x = 0, i = 0; x < W; x += 30, i++) {
      c.fillStyle = i % 2 ? '#fff' : '#111'; c.fillRect(x, y, 30, 15);
      c.fillStyle = i % 2 ? '#111' : '#fff'; c.fillRect(x, y + 15, 30, 15);
    }
    texto('🏁 CHEGADA 🏁', W / 2, y - 40, { tam: 54, alinhar: 'center', cor: '#ffd23f' });
  }
}

function desenharBolas() {
  const bolas = bolasNaPista().filter(b => b.position.y > camY - 60 && b.position.y < camY + H + 60);
  const lider = estado === 'corrida' ? liderCorrida() : null;
  const agora = agoraMs();
  // Rastro das bolinhas rápidas
  for (const b of bolas) {
    const rapida = Math.hypot(b.velocity.x, b.velocity.y) > 9;
    b.rastro.push({ x: b.position.x, y: b.position.y });
    if (b.rastro.length > (rapida ? 7 : 1)) b.rastro.shift();
    if (!rapida) continue;
    c.fillStyle = TIMES[b.jogador.time].ui;
    b.rastro.forEach((p, i) => {
      c.globalAlpha = (i + 1) / b.rastro.length * 0.22;
      c.beginPath(); c.arc(p.x, p.y, b.circleRadius * (0.5 + i / b.rastro.length * 0.5), 0, Math.PI * 2); c.fill();
    });
  }
  c.globalAlpha = 1;

  for (const b of bolas) {
    const j = b.jogador, t = TIMES[j.time], r = b.circleRadius;
    c.save();
    c.translate(b.position.x, b.position.y);
    // sombra
    c.beginPath(); c.arc(4, 6, r, 0, Math.PI * 2); c.fillStyle = '#0000004d'; c.fill();
    if (j.turboAte > agora) { c.shadowColor = '#ffb020'; c.shadowBlur = 35; }
    c.beginPath(); c.arc(0, 0, r, 0, Math.PI * 2); c.fillStyle = '#f4f4f4'; c.fill();
    c.shadowBlur = 0;
    // conteúdo gira junto com a bolinha
    c.save(); c.clip(); c.rotate(b.angle);
    const temFoto = j.img && j.img.complete && j.img.naturalWidth;
    if (temFoto) c.drawImage(j.img, -r, -r, r * 2, r * 2);
    else c.drawImage(t.escudo, -r * 0.92, -r * 0.92, r * 1.84, r * 1.84);
    c.restore();
    // brilho e sombreado de bola de gude (não giram)
    const brilho = c.createRadialGradient(-r * 0.4, -r * 0.45, r * 0.05, 0, 0, r);
    brilho.addColorStop(0, '#ffffffb0'); brilho.addColorStop(0.35, '#ffffff10');
    brilho.addColorStop(0.8, '#00000000'); brilho.addColorStop(1, '#00000070');
    c.beginPath(); c.arc(0, 0, r, 0, Math.PI * 2); c.fillStyle = brilho; c.fill();
    c.lineWidth = 3; c.strokeStyle = t.ui; c.stroke();
    if (temFoto) c.drawImage(t.escudo, r * 0.35, r * 0.25, r * 1.05, r * 1.05); // escudinho no canto da foto
    c.restore();
  }
  // Nomes por cima de tudo
  const poucas = bolas.length <= 25;
  for (const b of bolas) {
    const j = b.jogador;
    const destaque = b === lider || j.turboAte > agora || j.turboLargada;
    if (!poucas && !destaque) continue;
    const prefixo = b === lider ? '👑 ' : j.turboAte > agora ? '🔥 ' : '';
    texto(prefixo + cortar(j.nome, 14), b.position.x, b.position.y - 36, { tam: destaque ? 26 : 22, alinhar: 'center', cor: TIMES[j.time].ui, contorno: 5 });
  }
}

function desenharParticulas() {
  for (const p of particulas) {
    c.globalAlpha = Math.max(0, Math.min(1, p.vida * 2));
    if (p.texto) { texto(p.texto, p.x, p.y, { tam: p.tam, cor: p.cor, alinhar: 'center', contorno: 0 }); continue; }
    c.fillStyle = p.cor;
    if (p.giro != null) {
      c.save(); c.translate(p.x, p.y); c.rotate(p.giro); c.fillRect(-p.tam / 2, -p.tam / 4, p.tam, p.tam / 2); c.restore();
    } else {
      c.beginPath(); c.arc(p.x, p.y, p.tam / 2, 0, Math.PI * 2); c.fill();
    }
  }
  c.globalAlpha = 1;
}

function desenharHUD() {
  // Painel do topo
  const g = c.createLinearGradient(0, 0, 0, 460);
  g.addColorStop(0, '#05030fff'); g.addColorStop(0.8, '#05030fdd'); g.addColorStop(1, '#05030f00');
  c.fillStyle = g; c.fillRect(0, 0, W, 460);

  texto('🏁 CORRIDA DE BOLINHAS', 30, 190, { tam: 48 });
  let status = '';
  if (estado === 'inscricao') status = `LARGADA EM ${Math.max(0, Math.ceil(tEstado))}s`;
  else if (estado === 'largada') status = 'PREPARA...';
  else if (estado === 'corrida') {
    const s = Math.floor(tCorrida);
    status = `⏱ ${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  } else status = 'FIM!';
  texto(status, W - 30, 190, { tam: 40, alinhar: 'right', cor: '#ffd23f' });

  // Times: número para comentar, vitórias do dia e bolinhas na pista
  const n = TIMES.map(() => 0);
  for (const b of bolasNaPista()) n[b.jogador.time]++;
  const lw = (W - 60 - (TIMES.length - 1) * 12) / TIMES.length;
  TIMES.forEach((t, i) => {
    const x = 30 + i * (lw + 12), y = 240;
    caixa(x, y, lw, 96, 18, '#ffffff12');
    c.lineWidth = 3; c.strokeStyle = t.ui; c.beginPath(); c.roundRect(x, y, lw, 96, 18); c.stroke();
    c.drawImage(t.escudo, x + 8, y + 12, 72, 72);
    // número para comentar, no canto do escudo
    c.beginPath(); c.arc(x + 72, y + 74, 18, 0, Math.PI * 2); c.fillStyle = '#ffd23f'; c.fill();
    texto(String(i + 1), x + 72, y + 76, { tam: 26, alinhar: 'center', cor: '#000', contorno: 0, peso: 900 });
    texto(cortar(t.nome, lw > 300 ? 16 : 9), x + 96, y + 30, { tam: 26, cor: t.ui, contorno: 4 });
    texto(`🏆${placar.times[i]}  ⚪${n[i]}`, x + 96, y + 68, { tam: 23, contorno: 4 });
  });

  texto(`💬 COMENTE ${NUMEROS} PARA CORRER`, W / 2, 375, { tam: 38, alinhar: 'center', cor: '#ffd23f' });
  texto('❤️ curtir = empurrão   🎁 presente = TURBO   💎 presentão = TELEPORTE', W / 2, 420, { tam: 27, alinhar: 'center', peso: 600 });

  if (estado === 'corrida' || estado === 'largada') desenharMinimapa();
  if (estado === 'corrida') desenharPosicoes();
  if (estado === 'inscricao') desenharInscricao();
  if (estado === 'largada') {
    const n = Math.ceil(tEstado);
    texto(n > 0 ? String(n) : 'JÁ!', W / 2, 1000, { tam: 260, alinhar: 'center', cor: '#ffd23f', contorno: 14 });
  }

  if (estado === 'resultado') return desenharResultado();

  // Lado direito: posições (só na corrida), apoiadores e avisos, um embaixo do outro
  const fimApoiadores = desenharApoiadores(estado === 'corrida' ? 760 : 470);

  avisos.forEach((a, i) => {
    c.globalAlpha = Math.min(1, a.vida);
    const y = fimApoiadores + 40 + i * 52;
    c.font = '700 26px Fredoka, "Segoe UI Emoji"';
    const w = Math.min(c.measureText(a.texto).width + 32, W - 120);
    caixa(W - 20 - w, y - 22, w, 44, 22, '#000000aa');
    texto(cortar(a.texto, 46), W - 36, y, { tam: 26, alinhar: 'right', cor: a.cor, contorno: 0, peso: 700 });
  });
  c.globalAlpha = 1;

  if (banner) {
    const s = Math.min(1, (3.2 - banner.vida) * 5);
    c.save(); c.translate(W / 2, 640); c.scale(s, s);
    const gb = c.createLinearGradient(-480, 0, 480, 0);
    gb.addColorStop(0, '#7b2cff'); gb.addColorStop(1, '#ff2d6f');
    caixa(-480, -90, 960, 180, 40, gb);
    texto(cortar(banner.titulo, 24), 0, -30, { tam: 60, alinhar: 'center' });
    texto(cortar(banner.sub, 40), 0, 40, { tam: 38, alinhar: 'center', cor: '#ffe680' });
    c.restore();
  }
}

function desenharInscricao() {
  const humanos = bolasNaPista().filter(b => !b.jogador.cpu).length;
  const msg = humanos ? `${humanos} na largada! Comente para entrar` : 'Seja o primeiro! Comente o número da sua equipe';
  texto(msg, W / 2, 1000, { tam: 40, alinhar: 'center' });
  Marca.desenhar(c, W / 2, 1150, 34);
  // Mostra quem mandou presente (turbo garantido)
  const comTurbo = [...jogadores.values()].filter(j => j.turboLargada && j.bola).slice(0, 4);
  if (comTurbo.length) texto('🔥 Turbo na largada: ' + comTurbo.map(j => cortar(j.nome, 10)).join(', '), W / 2, 1060, { tam: 28, alinhar: 'center', cor: '#ffb020' });
}

function desenharMinimapa() {
  const x = 26, y0 = 470, y1 = 1230, ini = CAIXA_FUNDO, fim = pista.chegada;
  caixa(x - 8, y0 - 14, 32, y1 - y0 + 28, 16, '#00000088');
  texto('🏁', x + 8, y1 + 34, { tam: 30, alinhar: 'center', contorno: 0 });
  const lider = liderCorrida();
  for (const b of bolasNaPista()) {
    const p = Math.max(0, Math.min(1, (b.position.y - ini) / (fim - ini)));
    c.beginPath(); c.arc(x + 8, y0 + p * (y1 - y0), b === lider ? 11 : 6, 0, Math.PI * 2);
    c.fillStyle = TIMES[b.jogador.time].ui; c.fill();
  }
}

function desenharPosicoes() {
  const bolas = bolasNaPista();
  const ordem = [...chegaram, ...bolas.filter(b => !b.jogador.chegou).sort((a, b) => b.position.y - a.position.y).map(b => b.jogador)].slice(0, 5);
  caixa(W - 360, 470, 340, 50 + ordem.length * 44, 20, '#000000aa');
  texto('POSIÇÕES', W - 340, 498, { tam: 24, cor: '#ffd23f', contorno: 0 });
  ordem.forEach((j, i) => {
    texto(`${i + 1}º ${cortar(j.nome, 15)}${j.chegou ? ' 🏁' : ''}`, W - 340, 542 + i * 44, { tam: 26, cor: TIMES[j.time].ui, contorno: 0, peso: 700 });
  });
}

// Top 3 de quem mais mandou presente hoje. Devolve onde a caixa termina.
function desenharApoiadores(y) {
  const top = Ranking.top(3);
  if (!top.length) return y - 40;
  const h = 56 + top.length * 46;
  caixa(W - 360, y, 340, h, 20, '#000000b0');
  c.lineWidth = 2; c.strokeStyle = '#ffd23f88'; c.beginPath(); c.roundRect(W - 360, y, 340, h, 20); c.stroke();
  texto('🎁 TOP APOIADORES', W - 340, y + 28, { tam: 24, cor: '#ffd23f', contorno: 0 });
  const medalhas = ['👑', '🥈', '🥉'];
  top.forEach((p, i) => {
    const ly = y + 74 + i * 46;
    texto(`${medalhas[i]} ${cortar(p.nome, 13)}`, W - 340, ly, { tam: 27, contorno: 0, peso: 700, cor: i === 0 ? '#ffe680' : '#fff' });
    texto(`${p.diamantes}💎`, W - 36, ly, { tam: 22, contorno: 0, peso: 600, alinhar: 'right', cor: '#9fd8ff' });
  });
  return y + h;
}

function desenharResultado() {
  c.fillStyle = '#000000d8'; c.fillRect(0, 460, W, 900);
  const v = vencedor;
  if (!v) return;
  const t = TIMES[v.time];
  texto('🏆 VENCEDOR 🏆', W / 2, 560, { tam: 64, alinhar: 'center', cor: '#ffd23f' });
  // Foto grande
  c.save();
  c.beginPath(); c.arc(W / 2, 720, 110, 0, Math.PI * 2); c.fillStyle = t.cor; c.fill(); c.clip();
  const temFoto = v.img && v.img.complete && v.img.naturalWidth;
  c.fillStyle = '#f4f4f4'; c.fillRect(W / 2 - 110, 610, 220, 220);
  if (temFoto) c.drawImage(v.img, W / 2 - 110, 610, 220, 220);
  else c.drawImage(t.escudo, W / 2 - 95, 625, 190, 190);
  c.restore();
  c.lineWidth = 10; c.strokeStyle = t.ui; c.beginPath(); c.arc(W / 2, 720, 112, 0, Math.PI * 2); c.stroke();
  if (temFoto) c.drawImage(t.escudo, W / 2 + 50, 740, 100, 100);
  texto(cortar(v.nome, 20), W / 2, 880, { tam: 64, alinhar: 'center' });
  texto(`+1 vitória: ${t.emoji} ${t.nome.toUpperCase()}`, W / 2, 950, { tam: 40, alinhar: 'center', cor: t.ui });
  chegaram.slice(1, 3).forEach((j, i) => {
    texto(`${i + 2}º ${cortar(j.nome, 18)}`, W / 2, 1020 + i * 50, { tam: 34, alinhar: 'center', cor: TIMES[j.time].ui });
  });
  const campeoes = Object.values(placar.campeoes).sort((a, b) => b.vitorias - a.vitorias).slice(0, 3);
  if (campeoes.length) {
    texto('Mais vitórias hoje: ' + campeoes.map(p => `${cortar(p.nome, 10)} (${p.vitorias})`).join(' · '), W / 2, 1150, { tam: 28, alinhar: 'center', cor: '#ccc', peso: 600 });
  }
  texto(`Próxima corrida em ${Math.max(0, Math.ceil(tEstado))}s`, W / 2, 1220, { tam: 32, alinhar: 'center', cor: '#ffd23f' });
}

function desenhar() {
  desenharFundo();
  c.save();
  c.translate(0, -camY);
  desenharPista();
  desenharBolas();
  desenharParticulas();
  c.restore();
  desenharHUD();
}

// ---------- Loop principal ----------
let ultimo = performance.now(), acumulado = 0;
function quadro(t) {
  const dt = Math.min(0.1, (t - ultimo) / 1000);
  ultimo = t;
  acumulado += dt;
  let passos = 0;
  while (acumulado >= 1 / 60 && passos < 4) { passoFisica(); acumulado -= 1 / 60; passos++; }
  if (passos === 4) acumulado = 0;
  atualizar(dt);
  desenhar();
  requestAnimationFrame(quadro);
}

construirPista();
requestAnimationFrame(quadro);

aoComecar(() => Som.musica({ bpm: 126, energia: 0.4 }));

// Todos contra o Chefão: a live inteira bate num monstro gigante. Cada chefão derrotado vem um mais forte.
// Comentário = soco, curtida = golpe rápido, presente = golpe especial, presentão = ATAQUE FINAL.
// De vez em quando o chefão carrega um ataque: se o chat bater bastante a tempo, ele é interrompido.
const CONFIG = {
  tempoLuta: 120,       // segundos para derrotar cada chefão (se não der, ele foge)
  tempoIntervalo: 7,    // segundos entre um chefão e outro
  danoComentario: 6,
  danoCurtida: 0.6,     // por curtida (com limite por pacote)
  diamantesFinal: 99,   // presente a partir disso vira ATAQUE FINAL
};

const T = criarTela2D(document.getElementById('tela'));
const { W, c, rnd, texto, caixa, cortar } = T;
const BX = W / 2, BY = 800; // centro do chefão

const CHEFOES = [
  { nome: 'Gosmão', cor: '#5fd35f', cor2: '#1f7a3a' },
  { nome: 'Rei Pepino', cor: '#9be15d', cor2: '#3b7d1f' },
  { nome: 'Dentuço', cor: '#ff8a3d', cor2: '#a8410f' },
  { nome: 'Capitão Chulé', cor: '#c8b35a', cor2: '#6e5d1d' },
  { nome: 'Mega Brócolis', cor: '#3fbf7f', cor2: '#145c39' },
  { nome: 'Lorde Bocejo', cor: '#8f7dff', cor2: '#3b2a9e' },
  { nome: 'Pirulito do Mal', cor: '#ff5fb7', cor2: '#9e1f66' },
  { nome: 'Barão Mofo', cor: '#7fb3a0', cor2: '#2f5c4c' },
  { nome: 'Dragão de Pelúcia', cor: '#ff4b4b', cor2: '#8a1212' },
  { nome: 'Rainha Gelatina', cor: '#5fd8ff', cor2: '#1a6c9e' },
];

// ---------- Estado ----------
let estado = 'intervalo', tEstado = 3, nivel = 0, chefe = null;
let tremor = 0, flash = 0, ultimoGolpe = 0;
let carga = null; // ataque do chefão: { ate, precisa, feitos }
let proximaCarga = 25;
const herois = new Map(); // id -> { nome, dano, golpes } (desta luta)
let derrotados = carregarPlacar();
const ativos = new Map(); // id -> último momento ativo (para ajustar a vida do chefão ao tamanho da live)

// ---------- Narração ----------
const FALAS = {
  novo: ['Atenção! Chegou o {chefe}! Comenta qualquer coisa pra bater!', 'Nível {nivel}: {chefe}! Todo mundo junto!', 'Lá vem o {chefe}! Bora derrubar ele!'],
  golpe: ['Boa, {nome}!', 'Que soco, {nome}!', '{nome} tá batendo forte!'],
  metade: ['O {chefe} tá na metade da vida!', 'Metade! Continua batendo!'],
  quase: ['Falta pouquinho! Mais um pouco!', 'O {chefe} tá quase caindo!'],
  carga: ['Cuidado! O {chefe} tá carregando um ataque! Comenta rápido pra interromper!', 'Ataque vindo! Bate nele agora!'],
  interrompeu: ['Interrompido! Mandaram muito bem!', 'Boa! Cancelaram o ataque!'],
  curou: ['Ih! O {chefe} recuperou vida!', 'Não deu tempo! Ele se curou!'],
  presente: ['Valeu, {nome}! Golpe especial!', 'Obrigada pelo presente, {nome}!', '{nome} mandou {presente}! Golpe especial!'],
  presenteRosa: ['Valeu pela rosa, {nome}!', 'Uma rosa de {nome}! Obrigada!', 'Obrigada pela rosinha, {nome}!'],
  presenteRosas: ['Valeu pelas {qtd} rosas, {nome}!', '{qtd} rosas de {nome}! Obrigada!'],
  presenteGrande: ['Uau, {nome}! Ataque final!', 'Que isso, {nome}! Muito obrigada! Ataque final!', '{nome} mandou {presente}! Golpe devastador!'],
  seguiu: ['Valeu por seguir, {nome}!', '{nome} seguiu a live! Obrigada!'],
  compartilhou: ['Valeu por compartilhar, {nome}!', '{nome} compartilhou! Valeu demais!'],
  derrotado: ['Derrotamos o {chefe}! O golpe final foi de {nome}!', 'Caiu! {nome} deu o golpe final no {chefe}!', 'Vitória! {nome} acabou com o {chefe}!'],
  fugiu: ['O {chefe} fugiu! Na próxima a gente pega!', 'Escapou! Vamos com mais força na próxima!'],
  final: ['Últimos quinze segundos! Bate com tudo!', 'Tá acabando o tempo! Vai!'],
  apoiador: ['{nome} agora é o maior apoiador da live!', 'Novo líder no ranking: {nome}!'],
};
const ultimaFala = {};
const narrar = (tipo, vars = {}, opcoes = {}) => Voz.falar(FALAS[tipo], { chefe: chefe?.nome, nivel: nivel, ...vars }, opcoes);
function narrarComCalma(tipo, seg, vars) {
  const agora = performance.now();
  if (agora - (ultimaFala[tipo] || 0) < seg * 1000) return;
  ultimaFala[tipo] = agora;
  narrar(tipo, vars);
}
Ranking.aoMudarLider(p => narrar('apoiador', { nome: p.nome }));

function carregarPlacar() {
  try {
    const p = JSON.parse(localStorage.getItem('chefao-placar'));
    if (p?.dia === new Date().toISOString().slice(0, 10)) return p;
  } catch { /* sem placar */ }
  return { dia: new Date().toISOString().slice(0, 10), derrotados: 0, recorde: 0, golpesFinais: {} };
}
const salvarPlacar = () => { try { localStorage.setItem('chefao-placar', JSON.stringify(derrotados)); } catch { /* ignora */ } };

// ---------- Luta ----------
function novoChefe() {
  nivel++;
  const base = CHEFOES[(nivel - 1) % CHEFOES.length];
  // A vida acompanha o tamanho da live: mais gente ativa = chefão mais forte
  const agora = performance.now();
  let n = 0;
  for (const t of ativos.values()) if (agora - t < 180000) n++;
  const vida = Math.round(Math.max(160, n * 45) * (1 + (nivel - 1) * 0.3));
  chefe = { ...base, nivel, vida, max: vida, olhoX: 0, golpeado: 0, escala: 0, morto: 0 };
  herois.clear();
  estado = 'luta'; tEstado = CONFIG.tempoLuta;
  carga = null; proximaCarga = rnd(22, 32);
  chefe.metade = chefe.quase = false;
  Som.energia(0.75);
  narrar('novo');
}

function bater(dano, ev, tipo = 'soco') {
  if (estado !== 'luta' || !chefe || chefe.vida <= 0) return;
  let h = null;
  if (ev) {
    h = herois.get(ev.id) || { nome: ev.nome, dano: 0, golpes: 0 };
    h.nome = ev.nome; h.dano += dano; h.golpes++;
    herois.set(ev.id, h);
    ativos.set(ev.id, performance.now());
  }
  chefe.vida = Math.max(0, chefe.vida - dano);
  chefe.golpeado = 1;
  if (carga) carga.feitos += tipo === 'curtida' ? 0.25 : 1;
  const x = BX + rnd(-180, 180), y = BY + rnd(-160, 120);
  const forte = tipo === 'especial' || tipo === 'final';
  T.explosao(x, y, forte ? '#ffd23f' : '#ffffff', forte ? 40 : 8, forte ? 14 : 7);
  T.flutuar(x, y - 40, `-${Math.round(dano)}`, forte ? '#ffd23f' : '#ff6b6b', forte ? 64 : 36);
  if (ev && tipo === 'soco') T.flutuar(x, y + 10, cortar(ev.nome, 12), '#fff', 24);
  if (forte) { tremor = tipo === 'final' ? 30 : 14; flash = tipo === 'final' ? 1 : 0.5; Som.especial(); }
  else if (performance.now() - ultimoGolpe > 50) { Som.soco(tipo === 'curtida' ? 0.5 : 1); ultimoGolpe = performance.now(); tremor = Math.max(tremor, 4); }
  const p = chefe.vida / chefe.max;
  if (!chefe.metade && p <= 0.5) { chefe.metade = true; narrar('metade'); }
  if (!chefe.quase && p <= 0.15) { chefe.quase = true; narrar('quase'); }
  if (chefe.vida <= 0) derrotar(h);
}

function derrotar(h) {
  estado = 'vitoria'; tEstado = CONFIG.tempoIntervalo + 2;
  chefe.morto = 1; carga = null;
  derrotados.derrotados++;
  derrotados.recorde = Math.max(derrotados.recorde, nivel);
  if (h) derrotados.golpesFinais[h.nome] = (derrotados.golpesFinais[h.nome] || 0) + 1;
  salvarPlacar();
  for (let i = 0; i < 6; i++) T.explosao(BX + rnd(-150, 150), BY + rnd(-150, 150), chefe.cor, 40, 16);
  T.confete(160);
  tremor = 30;
  Som.vitoria(); Som.energia(0.5);
  narrar('derrotado', { nome: h?.nome || 'a galera' }, { prioridade: true });
  chefe.golpeFinal = h?.nome || 'a galera';
}
function fugir() {
  estado = 'fugiu'; tEstado = CONFIG.tempoIntervalo;
  carga = null;
  nivel = Math.max(0, nivel - 1); // vem um do mesmo nível de novo
  Som.erro(); Som.energia(0.4);
  narrar('fugiu', {}, { prioridade: true });
}

// ---------- Eventos da live ----------
Live.on('chat', ev => bater(CONFIG.danoComentario, ev, 'soco'));
Live.on('like', ev => {
  const n = Math.min(ev.qtd || 1, 15);
  bater(n * CONFIG.danoCurtida, ev, 'curtida');
  if (Math.random() < 0.5) T.flutuar(BX + rnd(-250, 250), BY + 260, '❤️', '#ff4d8d', 34);
});
Live.on('gift', ev => {
  const d = ev.diamantes || 1, final = d >= CONFIG.diamantesFinal;
  const nomePresente = (ev.qtd > 1 ? ev.qtd + 'x ' : '') + ev.presente;
  if (estado === 'luta' && chefe) {
    const dano = final ? Math.max(chefe.max * 0.3, 200) : 20 + Math.sqrt(d) * 8;
    bater(dano, ev, final ? 'final' : 'especial');
  }
  if (final) T.banner(`💎 ${cortar(ev.nome, 16)}`, `${nomePresente} → ATAQUE FINAL!`, ['#ff2d55', '#7b2cff']);
  else T.aviso(`🎁 ${cortar(ev.nome, 12)}: ${nomePresente} → GOLPE ESPECIAL!`, '#ffb020');
  narrar(chaveDoPresente(ev, final), { nome: ev.nome, presente: ev.presente, qtd: ev.qtd }, { prioridade: true });
});
Live.on('follow', ev => { bater(15, ev, 'especial'); T.aviso(`➕ ${cortar(ev.nome, 14)} seguiu! Golpe!`, '#5ad8ff'); narrar('seguiu', { nome: ev.nome }); });
Live.on('share', ev => { bater(15, ev, 'especial'); T.aviso(`↗️ ${cortar(ev.nome, 14)} compartilhou! Golpe!`, '#5ad8ff'); narrar('compartilhou', { nome: ev.nome }); });

// ---------- Atualização ----------
function atualizar(dt, t) {
  tEstado -= dt;
  if (estado === 'intervalo' && tEstado <= 0) novoChefe();
  else if (estado === 'luta') {
    if (tEstado <= 15 && tEstado + dt > 15) narrar('final');
    if (tEstado <= 10 && Math.ceil(tEstado) !== Math.ceil(tEstado + dt)) Som.tique();
    if (tEstado <= 0) fugir();
    // Ataque do chefão: precisa de X golpes em 7 segundos para interromper
    proximaCarga -= dt;
    if (!carga && proximaCarga <= 0 && tEstado > 12) {
      let n = 0;
      for (const v of ativos.values()) if (performance.now() - v < 60000) n++;
      carga = { ate: 7, total: 7, precisa: Math.max(6, Math.min(40, n * 2)), feitos: 0 };
      narrar('carga', {}, { prioridade: true });
      Som.bip();
    }
    if (carga) {
      carga.ate -= dt;
      if (carga.feitos >= carga.precisa) {
        carga = null; proximaCarga = rnd(22, 32);
        T.banner('⚡ INTERROMPIDO!', 'O chat cancelou o ataque!', ['#22c55e', '#0ea5e9']);
        Som.acerto(); narrar('interrompeu');
        bater(chefe.max * 0.05, null, 'especial');
      } else if (carga.ate <= 0) {
        carga = null; proximaCarga = rnd(22, 32);
        chefe.vida = Math.min(chefe.max, chefe.vida + chefe.max * 0.12);
        tremor = 22; flash = 0.6;
        T.banner('💚 O CHEFÃO SE CUROU', '+12% de vida', ['#16a34a', '#14532d']);
        Som.erro(); narrar('curou');
      }
    }
  } else if ((estado === 'vitoria' || estado === 'fugiu') && tEstado <= 0) {
    estado = 'intervalo'; tEstado = 0.5;
  }
  if (chefe) {
    chefe.golpeado = Math.max(0, chefe.golpeado - dt * 5);
    chefe.escala = Math.min(1, chefe.escala + dt * 2);
    if (chefe.morto) chefe.morto = Math.min(3, chefe.morto + dt);
    chefe.olhoX = Math.sin(t * 1.3) * 10;
  }
  tremor = Math.max(0, tremor - dt * 40);
  flash = Math.max(0, flash - dt * 2);
  T.atualizarEfeitos(dt);
}

// ---------- Desenho ----------
const estrelas = Array.from({ length: 70 }, () => ({ x: rnd(0, W), y: rnd(0, 1300), r: rnd(1, 2.5), f: rnd(0, 6) }));
function desenharFundo(t) {
  const g = c.createLinearGradient(0, 0, 0, 1920);
  const cor = chefe?.cor2 || '#3b1e7a';
  g.addColorStop(0, '#07040f'); g.addColorStop(0.5, cor + '88'); g.addColorStop(1, '#07040f');
  c.fillStyle = '#07040f'; c.fillRect(0, 0, W, 1920);
  c.fillStyle = g; c.fillRect(0, 0, W, 1920);
  for (const s of estrelas) {
    c.globalAlpha = 0.4 + Math.sin(t * 2 + s.f) * 0.3;
    c.fillStyle = '#fff'; c.beginPath(); c.arc(s.x, s.y, s.r, 0, Math.PI * 2); c.fill();
  }
  c.globalAlpha = 1;
  // chão da arena
  const chao = c.createRadialGradient(BX, 1130, 40, BX, 1130, 520);
  chao.addColorStop(0, '#ffffff22'); chao.addColorStop(1, '#ffffff00');
  c.fillStyle = chao; c.beginPath(); c.ellipse(BX, 1130, 520, 90, 0, 0, Math.PI * 2); c.fill();
}

function desenharChefe(t) {
  if (!chefe) return;
  const p = chefe.vida / chefe.max;
  const morto = chefe.morto;
  if (morto >= 2) return;
  c.save();
  const pulo = Math.sin(t * 3) * 12;
  const apertar = 1 + chefe.golpeado * 0.08;
  const s = (0.4 + chefe.escala * 0.6) * (1 - Math.max(0, morto - 1)) * (1 + (carga ? Math.sin(t * 30) * 0.03 : 0));
  c.translate(BX + rnd(-1, 1) * chefe.golpeado * 10, BY + pulo);
  c.scale(s * apertar, s / apertar);
  if (morto) c.rotate(morto * 2);
  // sombra
  c.fillStyle = '#0006'; c.beginPath(); c.ellipse(0, 330 - pulo, 230, 40, 0, 0, Math.PI * 2); c.fill();
  // aura do ataque carregando
  if (carga) {
    const aura = c.createRadialGradient(0, 0, 200, 0, 0, 360);
    aura.addColorStop(0, '#ff2d5500'); aura.addColorStop(0.7, '#ff2d5566'); aura.addColorStop(1, '#ff2d5500');
    c.fillStyle = aura; c.beginPath(); c.arc(0, 0, 360, 0, Math.PI * 2); c.fill();
  }
  // braços
  c.strokeStyle = chefe.cor2; c.lineWidth = 46; c.lineCap = 'round';
  const braco = Math.sin(t * 4) * 0.4 + (carga ? 0.8 : 0);
  c.beginPath(); c.moveTo(-200, 40); c.lineTo(-300, -40 - braco * 90); c.stroke();
  c.beginPath(); c.moveTo(200, 40); c.lineTo(300, -40 - braco * 90); c.stroke();
  // chifres
  c.fillStyle = '#f5f0e6';
  for (const lado of [-1, 1]) {
    c.beginPath(); c.moveTo(lado * 110, -200); c.quadraticCurveTo(lado * 210, -330, lado * 170, -380); c.quadraticCurveTo(lado * 150, -290, lado * 60, -230); c.fill();
  }
  // corpo
  const corpo = c.createRadialGradient(-80, -120, 40, 0, 0, 300);
  corpo.addColorStop(0, chefe.golpeado > 0.5 ? '#ffffff' : chefe.cor);
  corpo.addColorStop(1, chefe.cor2);
  c.fillStyle = corpo;
  c.beginPath();
  for (let i = 0; i <= 40; i++) {
    const a = (i / 40) * Math.PI * 2;
    const r = 250 + Math.sin(a * 6 + t * 3) * 10;
    c.lineTo(Math.cos(a) * r, Math.sin(a) * r * 0.95 + 20);
  }
  c.fill();
  c.lineWidth = 8; c.strokeStyle = '#0005'; c.stroke();
  // barriga
  c.fillStyle = '#ffffff22'; c.beginPath(); c.ellipse(0, 120, 150, 100, 0, 0, Math.PI * 2); c.fill();
  // olhos
  const piscando = Math.sin(t * 0.8) > 0.97;
  for (const lado of [-1, 1]) {
    c.fillStyle = '#fff'; c.beginPath(); c.ellipse(lado * 85, -70, 62, piscando ? 6 : 70, 0, 0, Math.PI * 2); c.fill();
    c.lineWidth = 6; c.strokeStyle = '#0006'; c.stroke();
    if (!piscando) {
      c.fillStyle = morto ? '#000' : carga ? '#ff2d55' : '#1b1030';
      c.beginPath(); c.arc(lado * 85 + chefe.olhoX, -60, 28, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#fff'; c.beginPath(); c.arc(lado * 85 + chefe.olhoX - 9, -70, 9, 0, Math.PI * 2); c.fill();
    }
    // sobrancelha brava
    c.strokeStyle = '#1b1030'; c.lineWidth = 18;
    c.beginPath(); c.moveTo(lado * 30, -140 + (p < 0.3 ? 10 : 0)); c.lineTo(lado * 140, -175); c.stroke();
  }
  // boca com dentes (abre quando apanha)
  const abre = 30 + chefe.golpeado * 50 + (carga ? 40 : 0);
  c.fillStyle = '#2a0a16';
  c.beginPath(); c.ellipse(0, 90, 120, abre, 0, 0, Math.PI); c.fill();
  c.fillStyle = '#fff';
  for (let i = -3; i <= 3; i++) { c.beginPath(); c.moveTo(i * 32 - 14, 90); c.lineTo(i * 32 + 14, 90); c.lineTo(i * 32, 90 + 26); c.fill(); }
  // curativos quando está machucado
  if (p < 0.6) { c.save(); c.translate(150, -150); c.rotate(0.6); caixa(-45, -14, 90, 28, 8, '#f5d6a8'); c.restore(); }
  if (p < 0.3) { c.save(); c.translate(-160, 60); c.rotate(-0.5); caixa(-45, -14, 90, 28, 8, '#f5d6a8'); c.restore(); }
  c.restore();
}

function desenharHUD(t) {
  T.sombraTopo(470);
  texto('👹 TODOS CONTRA O CHEFÃO', 30, 168, { tam: 42 });
  const status = estado === 'luta' ? `⏱ ${Math.max(0, Math.ceil(tEstado))}s` : estado === 'intervalo' ? 'PREPARA...' : estado === 'vitoria' ? 'VITÓRIA!' : 'FUGIU!';
  texto(status, W - 30, 168, { tam: 38, alinhar: 'right', cor: estado === 'luta' && tEstado <= 15 ? '#ff5f5f' : '#ffd23f' });

  // Barra de vida do chefão
  if (chefe) {
    texto(`NÍVEL ${chefe.nivel} · ${chefe.nome.toUpperCase()}`, W / 2, 228, { tam: 36, alinhar: 'center', cor: chefe.cor });
    const bx = 50, bw = W - 100, by = 256, p = chefe.vida / chefe.max;
    caixa(bx, by, bw, 50, 25, '#000000aa', '#ffffff55');
    if (p > 0) {
      const g = c.createLinearGradient(bx, 0, bx + bw, 0);
      g.addColorStop(0, '#ff2d55'); g.addColorStop(1, p > 0.5 ? '#ffb020' : '#ff2d55');
      c.save(); c.beginPath(); c.roundRect(bx + 5, by + 5, (bw - 10) * p, 40, 20); c.fillStyle = g; c.fill(); c.restore();
    }
    texto(`❤️ ${Math.ceil(chefe.vida)} / ${chefe.max}`, W / 2, by + 26, { tam: 26, alinhar: 'center', contorno: 5 });
  }
  texto('💬 COMENTE QUALQUER COISA PARA BATER', W / 2, 350, { tam: 38, alinhar: 'center', cor: '#ffd23f' });
  texto('❤️ curtir = golpe rápido   🎁 presente = ESPECIAL   💎 presentão = ATAQUE FINAL', W / 2, 395, { tam: 24, alinhar: 'center', peso: 600 });
  texto(`☠️ Derrotados hoje: ${derrotados.derrotados}   🏆 Recorde: nível ${derrotados.recorde}`, W / 2, 438, { tam: 26, alinhar: 'center', peso: 600, cor: '#cfd3ff' });

  // Ataque carregando
  if (carga) {
    const y = 500, w = 760, x = (W - w) / 2;
    const pisca = Math.sin(t * 12) > 0;
    caixa(x, y, w, 112, 26, pisca ? '#ff2d55dd' : '#b0002add', '#fff');
    texto('⚠️ ATAQUE CARREGANDO! BATE AGORA!', W / 2, y + 34, { tam: 34, alinhar: 'center' });
    const pr = Math.min(1, carga.feitos / carga.precisa);
    caixa(x + 30, y + 64, w - 60, 30, 15, '#00000088');
    caixa(x + 30, y + 64, Math.max(30, (w - 60) * pr), 30, 15, '#22c55e');
    texto(`${Math.floor(carga.feitos)} / ${carga.precisa} golpes · ${Math.ceil(carga.ate)}s`, W / 2, y + 80, { tam: 22, alinhar: 'center', contorno: 4 });
  }

  // Heróis da luta (quem mais bateu)
  const top = [...herois.values()].sort((a, b) => b.dano - a.dano).slice(0, 3);
  if (top.length && estado === 'luta') {
    caixa(20, 1110, 420, 50 + top.length * 42, 20, '#000000a8');
    texto('⚔️ HERÓIS DA LUTA', 40, 1136, { tam: 24, cor: '#ffd23f', contorno: 0 });
    top.forEach((h, i) => texto(`${['🥇', '🥈', '🥉'][i]} ${cortar(h.nome, 12)}  ${Math.round(h.dano)}`, 40, 1176 + i * 42, { tam: 26, contorno: 0 }));
  }
  if (estado === 'luta' || estado === 'intervalo') {
    const fim = T.desenharApoiadores(W - 360, carga ? 640 : 500);
    T.desenharAvisos(fim + 40);
  }

  if (estado === 'vitoria' && chefe) {
    caixa(90, 600, W - 180, 360, 40, '#000000cc', '#ffd23f');
    texto('☠️ DERROTADO!', W / 2, 670, { tam: 76, alinhar: 'center', cor: '#ffd23f' });
    texto(chefe.nome, W / 2, 745, { tam: 44, alinhar: 'center', cor: chefe.cor });
    texto(`💥 Golpe final: ${cortar(chefe.golpeFinal, 16)}`, W / 2, 815, { tam: 36, alinhar: 'center' });
    const mvp = [...herois.values()].sort((a, b) => b.dano - a.dano)[0];
    if (mvp) texto(`🥇 Quem mais bateu: ${cortar(mvp.nome, 14)}`, W / 2, 870, { tam: 32, alinhar: 'center', cor: '#cfd3ff' });
    texto(`Próximo chefão em ${Math.max(0, Math.ceil(tEstado))}s`, W / 2, 925, { tam: 30, alinhar: 'center', cor: '#ffd23f' });
  }
  if (estado === 'fugiu' && chefe) {
    caixa(90, 600, W - 180, 260, 40, '#000000cc', '#ff5f5f');
    texto('💨 O CHEFÃO FUGIU!', W / 2, 680, { tam: 64, alinhar: 'center', cor: '#ff8a8a' });
    texto('Na próxima, todo mundo comentando!', W / 2, 760, { tam: 34, alinhar: 'center' });
    texto(`Volta em ${Math.max(0, Math.ceil(tEstado))}s`, W / 2, 820, { tam: 30, alinhar: 'center', cor: '#ffd23f' });
  }
  if (estado === 'intervalo') Marca.desenhar(c, W / 2, 1000, 34);
  T.desenharBanner(1000);
  if (flash > 0) { c.fillStyle = `rgba(255,255,255,${flash * 0.6})`; c.fillRect(0, 0, W, 1920); }
}

rodarQuadros((dt, t) => {
  atualizar(dt, t);
  c.save();
  if (tremor > 0) c.translate(rnd(-1, 1) * tremor, rnd(-1, 1) * tremor);
  desenharFundo(t);
  if (estado !== 'fugiu') desenharChefe(t);
  T.desenharEfeitos();
  c.restore();
  desenharHUD(t);
});

aoComecar(() => Som.musica({ bpm: 140, energia: 0.6 }));

// Torre (Tower Battle): dois bonecos cabeçudos em cima de torres de blocos, numa cidade à noite.
// Cada ação da live coloca blocos na torre de uma equipe (com um raio caindo em cada bloco).
// Quem chegar primeiro na coroa vence a rodada e ganha um WIN. Texto e narração em inglês,
// para pegar público de fora também. Música: batida de funk feita na hora (sem direitos autorais).
// SEGURANÇA: só frases prontas + nome da pessoa (já filtrado). Nunca lê o chat, nunca pede presente.
import * as THREE from 'three';
import { RoomEnvironment } from '/lib/jsm/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from '/lib/jsm/geometries/RoundedBoxGeometry.js';
import { EffectComposer } from '/lib/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from '/lib/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from '/lib/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from '/lib/jsm/postprocessing/OutputPass.js';
import { visual, canvasTex, criarBoneco, pose, aplicar } from '/shared/boneco3d.js';

// ---------- Configuração (pode mudar à vontade) ----------
// lado 0 = primeira equipe do painel, lado 1 = segunda
const CONFIG = {
  meta: 500,                               // blocos até a coroa (quanto maior, mais longa a rodada)
  tempoResultado: 8,
  curtida: { lado: 1, blocos: 1 },          // por curtida (no máximo 5 por pacote)
  seguir: { lado: 0, blocos: 6 },
  compartilhar: { lado: 1, blocos: 6 },
  comentario: 1,                            // comentar o número/nome da equipe (1 bloco a cada 3s por pessoa)
  presentes: [                              // presentes com equipe fixa (por nome, vale cada unidade)
    { nome: /ros[ae]/i, lado: 0, blocos: 10, icone: '🌹', rotulo: 'Rose' },
    { nome: /tik ?tok/i, lado: 1, blocos: 10, icone: '🎵', rotulo: 'TikTok' },
  ],
  outroPresente: d => Math.min(200, 10 + d), // outros presentes: vão para a equipe de quem mandou
};

const LADOS = EQUIPES.slice(0, 2);
const chavePlacar = LADOS.map(e => e.nome).join('|');
const W = 1080, H = 1920, ALT = 0.24; // altura de cada bloco
const T = criarTela2D(document.getElementById('hud'));
const { c, rnd, texto, caixa, cortar } = T;

// ---------- 3D: renderizador, céu e cidade ----------
const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('mundo'), antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setSize(W, H, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const cena = new THREE.Scene();
cena.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
cena.environmentIntensity = 0.4;
cena.background = canvasTex(4, 512, (g, w, h) => {
  const gr = g.createLinearGradient(0, 0, 0, h);
  gr.addColorStop(0, '#05021a'); gr.addColorStop(0.5, '#1b0b45'); gr.addColorStop(0.85, '#5b1f6e'); gr.addColorStop(1, '#ff5f6d');
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
});
cena.fog = new THREE.Fog(0x1b0b45, 70, 180);

const camera = new THREE.PerspectiveCamera(40, W / H, 0.1, 600);
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(cena, camera));
composer.addPass(new UnrealBloomPass(new THREE.Vector2(W / 2, H / 2), 0.8, 0.5, 1.6));
composer.addPass(new OutputPass());

// estrelas
{
  const n = 900, pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, r = 70 + Math.random() * 30;
    pos.set([Math.cos(a) * r * 1.6, 8 + Math.random() * 140, -Math.abs(Math.sin(a)) * r * 1.6], i * 3);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  cena.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 0.35, fog: false })));
}
// cidade: prédios com janelas acesas em volta
const janelas = canvasTex(256, 512, (g, w, h) => {
  g.fillStyle = '#0d0a24'; g.fillRect(0, 0, w, h);
  for (let y = 8; y < h; y += 22) for (let x = 8; x < w; x += 20) {
    if (Math.random() < 0.45) continue;
    g.fillStyle = ['#ffd27a', '#ffe9b0', '#7fd8ff', '#ff9ad5'][Math.floor(Math.random() * 4)];
    g.globalAlpha = 0.5 + Math.random() * 0.5; g.fillRect(x, y, 10, 12);
  }
  g.globalAlpha = 1;
});
janelas.wrapS = janelas.wrapT = THREE.RepeatWrapping;
for (let i = 0; i < 40; i++) {
  const a = Math.PI * (1.02 + (i / 39) * 0.96), r = 45 + Math.random() * 25; // só atrás (a câmera fica na frente)
  const h = 10 + Math.random() * 45, w = 4 + Math.random() * 5;
  const tex = janelas.clone(); tex.repeat.set(w / 6, h / 12); tex.needsUpdate = true;
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), new THREE.MeshStandardMaterial({ color: 0x15122e, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.5, roughness: 0.9 }));
  m.position.set(Math.cos(a) * r, h / 2 - 1, Math.sin(a) * r); m.lookAt(0, h / 2 - 1, 0); cena.add(m);
}
// palco redondo com anel de LED
const chao = new THREE.Mesh(new THREE.CylinderGeometry(5, 5.3, 0.4, 64), new THREE.MeshStandardMaterial({ color: 0x241b4a, roughness: 0.5, metalness: 0.3 }));
chao.position.y = -0.2; chao.receiveShadow = true; cena.add(chao);
const anelLed = new THREE.Mesh(new THREE.TorusGeometry(5.05, 0.06, 8, 96), new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 1.2, 3.5) }));
anelLed.rotation.x = Math.PI / 2; anelLed.position.y = 0.01; cena.add(anelLed);

// luzes
cena.add(new THREE.HemisphereLight(0xb7a8ff, 0x2a1640, 0.9));
const sol = new THREE.DirectionalLight(0xffffff, 2.2);
sol.position.set(4, 12, 9); sol.castShadow = true; sol.shadow.mapSize.set(2048, 2048);
Object.assign(sol.shadow.camera, { left: -6, right: 6, top: 8, bottom: -8, near: 1, far: 60 });
cena.add(sol, sol.target);
const contraluz = new THREE.DirectionalLight(0xff7ad9, 1.4); contraluz.position.set(0, 6, -10); cena.add(contraluz);

// coroa (linha de chegada) na altura da meta
const META_Y = CONFIG.meta * ALT;
const linhaChegada = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.06, 0.06), new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 3, 0.6) }));
linhaChegada.position.set(0, META_Y, 0); cena.add(linhaChegada);

// ---------- Torres ----------
const MAX = CONFIG.meta + 80;
const geoBloco = new RoundedBoxGeometry(0.9, ALT * 0.96, 0.9, 3, 0.05);
const torres = LADOS.map((eq, i) => {
  const malha = new THREE.InstancedMesh(geoBloco, new THREE.MeshStandardMaterial({ roughness: 0.35, metalness: 0.15 }), MAX);
  malha.count = 0; malha.frustumCulled = false; malha.castShadow = malha.receiveShadow = true;
  malha.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  cena.add(malha);
  const x = i ? 1.25 : -1.25;
  // base da torre
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.85, 0.12, 32), new THREE.MeshStandardMaterial({ color: eq.cor, roughness: 0.4, emissive: eq.cor, emissiveIntensity: 0.3 }));
  base.position.set(x, 0.06, 0); cena.add(base);
  // boneco cabeçudo em cima de um suporte que sobe com a torre
  const l = visual(eq, i); l.cabecao = 1.9;
  const b = criarBoneco(l);
  const suporte = new THREE.Group(); suporte.position.set(x, 0.12, 0); suporte.add(b.raiz); cena.add(suporte);
  b.raiz.rotation.y = i ? -0.3 : 0.3;
  return { eq, malha, x, n: 0, pendente: 0, caindo: [], prox: 0, topo: 0.12, b, suporte, cor: new THREE.Color(eq.cor), comemora: 0, giro: [] };
});
const mtx = new THREE.Matrix4(), q = new THREE.Quaternion(), escala = new THREE.Vector3(1, 1, 1), pos = new THREE.Vector3();
function colocarBloco(t, idx, y, s = 1) {
  q.setFromEuler(new THREE.Euler(0, t.giro[idx], 0));
  escala.setScalar(s);
  pos.set(t.x + Math.sin(idx * 2.3) * 0.03, y, Math.cos(idx * 1.7) * 0.03);
  mtx.compose(pos, q, escala); t.malha.setMatrixAt(idx, mtx);
  t.malha.instanceMatrix.needsUpdate = true;
}
const yDoBloco = idx => 0.12 + ALT * (idx + 0.5);

// ---------- Raios ----------
const raios = [];
function raio(t, yAlvo) {
  const pts = [];
  let x = t.x + rnd(-1.5, 1.5), z = rnd(-1, 1);
  const topo = yAlvo + 7, passos = 9;
  for (let k = 0; k <= passos; k++) {
    const f = k / passos;
    pts.push(new THREE.Vector3(THREE.MathUtils.lerp(x, t.x, f) + (k && k < passos ? rnd(-0.35, 0.35) : 0), THREE.MathUtils.lerp(topo, yAlvo, f), THREE.MathUtils.lerp(z, 0, f)));
  }
  const cor = t.cor.clone().lerp(new THREE.Color(1, 1, 1), 0.55).multiplyScalar(5);
  const m = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.1), 24, 0.035, 5), new THREE.MeshBasicMaterial({ color: cor, transparent: true }));
  cena.add(m); raios.push({ m, vida: 0.22 });
}

// ---------- Estado ----------
let estado = 'jogando', tEstado = 0, vencedor = null, rodada = 1, ultimoLider = -1;
let placar = carregarPlacar();
const jogadores = new Map(); // id -> { nome, lado, ultima }
function carregarPlacar() {
  try {
    const p = JSON.parse(localStorage.getItem('torre-placar'));
    if (p && p.dia === new Date().toISOString().slice(0, 10) && p.equipes === chavePlacar) return p;
  } catch { /* sem placar */ }
  return { dia: new Date().toISOString().slice(0, 10), equipes: chavePlacar, wins: [0, 0] };
}
const salvarPlacar = () => { try { localStorage.setItem('torre-placar', JSON.stringify(placar)); } catch { /* ignora */ } };

// ---------- Narração (inglês) ----------
const FALAS = {
  novaRodada: ['New round! Build your tower!', 'Towers are down! New round!', 'Here we go again! Build it up!'],
  mais: ['Plus {qtd} for {time}!', '{nome}, thank you! Plus {qtd}!', 'Thanks {nome}! {qtd} blocks for {time}!'],
  grande: ['Wow, {nome}! Thank you so much!', 'Huge! Thank you {nome}!'],
  seguiu: ['Thanks for the follow, {nome}!', '{nome} followed! Plus six!'],
  compartilhou: ['Thanks for sharing, {nome}!', '{nome} shared the live! Thank you!'],
  virada: ['{time} takes the lead!', 'Now {time} is ahead!'],
  quase: ['{time} is almost at the top!', '{time} is close to the crown!'],
  vencedor: ['{time} wins!', 'Victory for {time}!', '{time} reached the crown!'],
};
const ultimaFala = {};
const narrar = (tipo, vars = {}, opcoes = {}) => Voz.falar(FALAS[tipo], vars, { idioma: 'en', ...opcoes });
function narrarComCalma(tipo, seg, vars) {
  const agora = performance.now();
  if (agora - (ultimaFala[tipo] || 0) < seg * 1000) return;
  ultimaFala[tipo] = agora;
  narrar(tipo, vars);
}

// ---------- Blocos ----------
function adicionar(lado, qtd) {
  if (estado !== 'jogando' || qtd <= 0) return;
  const t = torres[lado];
  t.pendente += Math.min(qtd, CONFIG.meta); // a fila nunca passa da meta inteira de uma vez
}
const total = lado => torres[lado].n + torres[lado].pendente;
function vencer(lado) {
  estado = 'resultado'; tEstado = CONFIG.tempoResultado; vencedor = lado;
  placar.wins[lado]++; salvarPlacar();
  torres.forEach(t => { t.pendente = 0; });
  torres[lado].b.acao = 'comemorar'; torres[1 - lado].b.acao = 'triste';
  Som.vitoria(); T.confete(180); Som.energia(0.5);
  narrar('vencedor', { time: LADOS[lado].nome }, { prioridade: true });
}
function novaRodada() {
  rodada++; estado = 'derrubando'; tEstado = 1.2; vencedor = null; ultimoLider = -1;
  torres.forEach(t => { t.b.acao = 'normal'; });
  Som.teleporte();
}

// ---------- Eventos da live ----------
function registrar(ev, lado) {
  let j = jogadores.get(ev.id);
  if (!j) { j = { id: ev.id, nome: ev.nome, lado: lado ?? (total(0) <= total(1) ? 0 : 1), ultima: 0 }; jogadores.set(ev.id, j); }
  if (lado != null) j.lado = lado;
  j.nome = ev.nome || j.nome;
  return j;
}
const flutuar = (lado, str, cor, tam = 30) => {
  const p = naTela(lado, 3.0);
  T.flutuar(p.x + rnd(-80, 80), p.y + rnd(-10, 40), str, cor, tam);
};
Live.on('chat', ev => {
  const lado = acharEquipe(ev.texto, LADOS);
  if (lado == null) return;
  const j = registrar(ev, lado), agora = performance.now();
  if (agora - j.ultima < 3000) return;
  j.ultima = agora;
  adicionar(lado, CONFIG.comentario);
  flutuar(lado, `+${CONFIG.comentario} ${cortar(j.nome, 10)}`, LADOS[lado].ui, 26);
});
Live.on('like', ev => {
  const n = Math.min(ev.qtd || 1, 5) * CONFIG.curtida.blocos;
  adicionar(CONFIG.curtida.lado, n);
  if (Math.random() < 0.6) flutuar(CONFIG.curtida.lado, `👍 +${n}`, '#ffffff', 28);
});
Live.on('follow', ev => {
  const { lado, blocos } = CONFIG.seguir;
  adicionar(lado, blocos);
  T.aviso(`➕ ${cortar(ev.nome, 14)} followed → +${blocos} ${LADOS[lado].emoji}`, LADOS[lado].ui);
  narrar('seguiu', { nome: ev.nome });
});
Live.on('share', ev => {
  const { lado, blocos } = CONFIG.compartilhar;
  adicionar(lado, blocos);
  T.aviso(`↗️ ${cortar(ev.nome, 14)} shared → +${blocos} ${LADOS[lado].emoji}`, LADOS[lado].ui);
  narrar('compartilhou', { nome: ev.nome });
});
Live.on('gift', ev => {
  const regra = CONFIG.presentes.find(p => p.nome.test(ev.presente || ''));
  const qtd = ev.qtd || 1, d = ev.diamantes || 1;
  const lado = regra ? regra.lado : registrar(ev).lado;
  const blocos = regra ? regra.blocos * qtd : CONFIG.outroPresente(d) * qtd;
  adicionar(lado, blocos);
  const eq = LADOS[lado], icone = regra?.icone || '🎁';
  if (d >= 99) { T.banner(`💎 ${cortar(ev.nome, 16)}`, `${qtd > 1 ? qtd + 'x ' : ''}${ev.presente} → +${blocos} ${eq.emoji}`, [eq.cor, '#7b2cff']); Som.especial(); narrar('grande', { nome: ev.nome }, { prioridade: true }); }
  else { T.aviso(`${icone} ${cortar(ev.nome, 12)} → +${blocos} ${eq.emoji}`, eq.ui); Som.turbo(); narrar('mais', { nome: ev.nome, qtd: blocos, time: eq.nome }, { prioridade: true }); }
  torres[lado].comemora = Math.max(torres[lado].comemora, blocos >= 10 ? 1.3 : 0);
});

// ---------- Atualização ----------
function atualizarTorre(t, i, dt) {
  // solta os blocos da fila (mais rápido quando a fila é grande)
  t.prox -= dt;
  while (t.pendente > 0 && t.prox <= 0 && estado === 'jogando') {
    const idx = t.n++;
    t.pendente--;
    t.giro[idx] = rnd(-0.12, 0.12);
    t.malha.count = t.n;
    const tom = idx % 2 ? t.cor.clone().lerp(new THREE.Color(1, 1, 1), 0.25) : t.cor;
    t.malha.setColorAt(idx, tom); t.malha.instanceColor.needsUpdate = true;
    t.caindo.push({ idx, k: 0 });
    colocarBloco(t, idx, yDoBloco(idx) + 3, 0.01);
    if (t.caindo.length < 4 || Math.random() < 0.25) raio(t, yDoBloco(idx));
    t.prox += Math.max(0.035, 0.14 - t.pendente * 0.006);
    if (t.n >= CONFIG.meta) { t.pendente = 0; break; }
  }
  if (t.pendente <= 0) t.prox = Math.max(t.prox, 0);
  // blocos caindo no lugar
  for (let k = t.caindo.length - 1; k >= 0; k--) {
    const f = t.caindo[k];
    f.k += dt / 0.25;
    const e = Math.min(1, f.k), queda = 1 - e * e;
    colocarBloco(t, f.idx, yDoBloco(f.idx) + queda * 3, 0.4 + 0.6 * e);
    if (f.k >= 1) {
      t.caindo.splice(k, 1);
      Som.pop(0.8 + (f.idx % 12) * 0.05);
      if (f.idx + 1 >= CONFIG.meta && estado === 'jogando') vencer(i);
    }
  }
  // o boneco sobe junto com a torre (fica em cima do último bloco que já caiu)
  const assentados = Math.min(t.malha.count, t.n - t.caindo.length);
  const alvo = 0.12 + ALT * Math.max(0, assentados);
  t.topo += (alvo - t.topo) * Math.min(1, dt * 10);
  t.suporte.position.y = t.topo;
  // pulinho de alegria quando ganha muitos blocos
  t.comemora = Math.max(0, t.comemora - dt);
  if (estado === 'jogando') t.b.acao = t.comemora > 0 ? 'comemorar' : 'normal';
}

function atualizar(dt, tempo) {
  tEstado -= dt;
  if (estado === 'jogando') {
    const lider = total(0) === total(1) ? -1 : total(0) > total(1) ? 0 : 1;
    if (lider >= 0 && lider !== ultimoLider) {
      if (ultimoLider >= 0) narrarComCalma('virada', 8, { time: LADOS[lider].nome });
      ultimoLider = lider;
    }
    for (let i = 0; i < 2; i++) if (torres[i].n > CONFIG.meta * 0.85) narrarComCalma('quase', 15, { time: LADOS[i].nome });
    Som.energia(0.45 + 0.45 * Math.max(torres[0].n, torres[1].n) / CONFIG.meta);
  } else if (estado === 'resultado' && tEstado <= 0) novaRodada();
  else if (estado === 'derrubando') {
    // torres encolhem de cima para baixo e os bonecos descem
    const f = Math.max(0, tEstado / 1.2);
    torres.forEach(t => {
      const n = Math.floor(t.n * f);
      t.malha.count = n;
      t.topo = 0.12 + ALT * n; t.suporte.position.y = t.topo;
    });
    if (tEstado <= 0) {
      torres.forEach(t => { t.n = 0; t.pendente = 0; t.caindo = []; t.malha.count = 0; t.topo = 0.12; });
      estado = 'jogando';
      narrar('novaRodada');
    }
  }
  torres.forEach((t, i) => { atualizarTorre(t, i, dt); aplicar(t.b, pose(t.b, tempo), dt); });
  for (let k = raios.length - 1; k >= 0; k--) {
    const r = raios[k]; r.vida -= dt; r.m.material.opacity = Math.max(0, r.vida / 0.22);
    if (r.vida <= 0) { cena.remove(r.m); r.m.geometry.dispose(); r.m.material.dispose(); raios.splice(k, 1); }
  }
  // câmera segue as torres: olha entre os dois topos e afasta se a diferença for grande
  const alto = Math.max(torres[0].topo, torres[1].topo), baixo = Math.min(torres[0].topo, torres[1].topo);
  const dif = alto - baixo;
  // a parte livre da tela (entre o placar e a parte de baixo do TikTok) é ~1/3 da altura
  const dist = Math.min(150, Math.max(12.5, (dif + 2.8) * 4.3));
  cena.fog.near = dist + 40; cena.fog.far = dist + 200;
  const foco = (alto + baixo) / 2 + 1.2;
  camAlvo.set(Math.sin(tempo * 0.2) * 0.5, foco + 1 + dist * 0.05, dist);
  camera.position.lerp(camAlvo, Math.min(1, dt * 3));
  olhar.lerp(new THREE.Vector3(0, foco, 0), Math.min(1, dt * 3));
  camera.lookAt(olhar);
  linhaChegada.visible = alto > META_Y - 10;
  anelLed.material.color.setHSL((tempo * 0.1) % 1, 1, 0.5).multiplyScalar(3);
  T.atualizarEfeitos(dt);
}
const camAlvo = new THREE.Vector3(), olhar = new THREE.Vector3(0, 1.2, 0);
camera.position.set(0, 2.2, 12.5);

// posição de um ponto do boneco na tela
const vt = new THREE.Vector3();
function naTela(lado, altura) {
  vt.set(0, altura, 0); torres[lado].b.raiz.localToWorld(vt); vt.project(camera);
  return { x: (vt.x + 1) / 2 * W, y: (1 - vt.y) / 2 * H };
}

// ---------- HUD ----------
function legenda(lado) {
  const itens = [];
  if (CONFIG.seguir.lado === lado) itens.push(`➕ Follow  +${CONFIG.seguir.blocos}`);
  if (CONFIG.curtida.lado === lado) itens.push(`👍 Like  +${CONFIG.curtida.blocos}`);
  if (CONFIG.compartilhar.lado === lado) itens.push(`↗️ Share  +${CONFIG.compartilhar.blocos}`);
  for (const p of CONFIG.presentes) if (p.lado === lado) itens.push(`${p.icone} ${p.rotulo}  +${p.blocos}`);
  itens.push(`💬 "${lado + 1}"  +${CONFIG.comentario}`);
  return itens;
}
function desenharHUD(tempo) {
  c.clearRect(0, 0, W, H);
  T.sombraTopo(620);
  texto('🧱 TOWER BATTLE', 30, 168, { tam: 46 });
  texto(`👑 ${CONFIG.meta}`, W - 30, 168, { tam: 42, alinhar: 'right', cor: '#ffd23f' });

  LADOS.forEach((eq, i) => {
    const w = 500, x = i === 0 ? 30 : W - 30 - w, y = 210;
    caixa(x, y, w, 120, 26, '#000000a8', eq.ui);
    const ex = i === 0 ? x + 14 : x + w - 104;
    c.drawImage(eq.escudo, ex, y + 15, 90, 90);
    const tx = i === 0 ? x + 120 : x + w - 120, al = i === 0 ? 'left' : 'right';
    texto(cortar(eq.nome, 12), tx, y + 38, { tam: 34, cor: eq.ui, contorno: 4, alinhar: al });
    texto(`🏆 WINS ${placar.wins[i]}`, tx, y + 86, { tam: 30, contorno: 4, alinhar: al, cor: '#ffe680' });
    // barra até a coroa
    const by = y + 134, n = torres[i].n;
    caixa(x, by, w, 36, 18, '#ffffff1f');
    c.save(); c.beginPath(); c.roundRect(x, by, w, 36, 18); c.clip();
    const bw = w * Math.min(1, n / CONFIG.meta);
    const g = c.createLinearGradient(x, 0, x + w, 0); g.addColorStop(0, eq.cor); g.addColorStop(1, '#ffd23f');
    c.fillStyle = g; c.fillRect(i === 0 ? x : x + w - bw, by, bw, 36);
    c.restore();
    texto(`${n} / ${CONFIG.meta}`, x + w / 2, by + 19, { tam: 26, alinhar: 'center', contorno: 4 });
  });

  // número de blocos em cima de cada boneco
  for (let i = 0; i < 2; i++) {
    const p = naTela(i, 2.75);
    texto(String(torres[i].n), p.x, p.y, { tam: 76, alinhar: 'center', cor: LADOS[i].ui, contorno: 10 });
  }
  // coroa na tela quando a linha de chegada aparece
  if (linhaChegada.visible) {
    vt.set(0, META_Y, 0).project(camera);
    const y = (1 - vt.y) / 2 * H;
    if (y > 400 && y < 1250) texto('👑 FINISH 👑', W / 2, y - 40, { tam: 40, alinhar: 'center', cor: '#ffd23f' });
  }

  // legenda: o que dá bloco para cada lado
  LADOS.forEach((eq, i) => {
    const itens = legenda(i), w = 500, x = i === 0 ? 30 : W - 30 - w, y = 392;
    caixa(x, y, w, itens.length * 34 + 14, 18, '#000000a0');
    itens.forEach((s, k) => texto(s, x + w / 2, y + 24 + k * 34, { tam: 25, alinhar: 'center', contorno: 0, cor: k % 2 ? '#ffe680' : '#fff' }));
  });

  T.desenharAvisos(1130);
  if (estado === 'resultado') {
    const eq = LADOS[vencedor];
    caixa(110, 800, W - 220, 300, 40, '#000000cc', eq.ui);
    c.drawImage(eq.escudo, W / 2 - 60, 820, 120, 120);
    texto(`${eq.nome.toUpperCase()} WINS!`, W / 2, 985, { tam: 64, alinhar: 'center', cor: eq.ui, max: W - 260 });
    texto(`Next round in ${Math.max(0, Math.ceil(tEstado))}s`, W / 2, 1055, { tam: 34, alinhar: 'center', cor: '#ffd23f' });
    Marca.desenhar(c, W / 2, 1150, 30);
  }
  T.desenharEfeitos();
  T.desenharBanner(980);
}

rodarQuadros((dt, tempo) => {
  atualizar(dt, tempo);
  composer.render();
  desenharHUD(tempo);
});
narrar('novaRodada');
aoComecar(() => Som.musica({ bpm: 130, energia: 0.5, estilo: 'funk' }));

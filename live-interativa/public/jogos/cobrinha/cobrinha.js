// Cobrinha Arena 3D: até 6 cobras (uma por equipe) andam sozinhas pela arena comendo.
// Quem comenta o nome/número da equipe entra nela e solta uma comida com o próprio nome perto da cobra.
// Equipe que ainda não está na arena entra na hora (se tiver vaga) ou na próxima rodada.
// (No código, "time" = equipe configurada no painel.)
// Curtida = comidinha, presente = TURBO, presente grande = MEGA. A maior cobra no fim da rodada vence.
// Cada rodada tem um modo (Frutas Douradas, Campo Minado...) e um cenário diferentes, e no meio
// da rodada aparecem eventos surpresa. As cobras falam e a narradora comenta tudo sozinha.
// SEGURANÇA: só frases prontas + nome da pessoa (já filtrado). Nunca lê o chat, nunca pede presente.
import * as THREE from 'three';
import { EffectComposer } from '/lib/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from '/lib/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from '/lib/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from '/lib/jsm/postprocessing/OutputPass.js';

// ---------- Configuração (pode mudar à vontade) ----------
const CONFIG = {
  tempoRodada: 120,      // segundos de cada rodada
  tempoPreparo: 6,       // apresentação do modo + contagem
  tempoResultado: 10,    // segundos mostrando quem venceu
  tamanhoInicial: 10,
  tamanhoMax: 200,
  maxCobras: Math.min(6, EQUIPES.length), // quantas equipes cabem na arena ao mesmo tempo
  minCobras: Math.min(4, EQUIPES.length), // se tiver menos equipes jogando, entram equipes sorteadas
  diamantesMega: 99,     // presente a partir disso vira MEGA
  curtidasPorComida: 3,  // a cada X curtidas cai uma comidinha
  metaCurtidas: 200,     // a cada X curtidas chove comida na arena
  vozDasCobras: true,    // cobras falam em voz alta (além do balão)
  brilhoNeon: true,      // efeito de brilho; desligue se o PC ficar lento durante a live
};
const TIMES_TODOS = EQUIPES;

const W = 1080, H = 1920;
const AX = 15, AZ = 10.5;          // metade da largura/profundidade da arena
const lim = { x: AX, z: AZ };      // limite atual (no modo Arena Encolhendo ele diminui)
const SEG_R = 0.48;                // raio dos gomos
const PASSO = 0.125, K = 4;        // rastro guardado a cada PASSO; gomo a cada K pontos do rastro
const VEL = 6.5, VEL_TURBO = 11.5, GIRO = 3.4;

const rnd = (a, b) => a + Math.random() * (b - a);
const sortear = l => l[Math.floor(Math.random() * l.length)];
// Sorteia sem repetir as últimas escolhas da mesma lista (para as falas não ficarem repetitivas)
const recentes = new Map();
function sortearNovo(lista) {
  const usadas = recentes.get(lista) || [];
  const livres = lista.filter(x => !usadas.includes(x));
  const x = sortear(livres.length ? livres : lista);
  recentes.set(lista, [x, ...usadas].slice(0, Math.max(0, Math.min(4, lista.length - 1))));
  return x;
}
const agora = () => performance.now() / 1000;
const limitar = (v, a, b) => Math.max(a, Math.min(b, v));
const angDif = (a, b) => { let d = a - b; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; };
function embaralhar(l) {
  const a = [...l];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

// ---------- Modos e cenários ----------
const MODOS = [
  { id: 'classica', nome: 'Rodada Clássica', emoji: '🐍', desc: 'A maior cobra no fim vence!' },
  { id: 'dourada', nome: 'Frutas Douradas', emoji: '🌟', desc: 'Fruta dourada vale 8 pedaços!' },
  { id: 'turbo', nome: 'Rodada Turbo', emoji: '⚡', desc: 'Todo mundo mais rápido!' },
  { id: 'gigantes', nome: 'Cobras Gigantes', emoji: '🦖', desc: 'Todas começam enormes!' },
  { id: 'minado', nome: 'Campo Minado', emoji: '💣', desc: 'Cuidado com as bombas!' },
  { id: 'encolhe', nome: 'Arena Encolhendo', emoji: '🧱', desc: 'No final a arena fecha!' },
  { id: 'noite', nome: 'Noite Neon', emoji: '🌙', desc: 'Luz apagada, cobras brilhando!' },
];
const TEMAS = [
  { nome: 'Neon', fundo: '#120a2e', chao: ['#2a1d5c', '#33246e'], linha: '#6b5cff66', mureta: '#ff3d8b', luz: '#5ad8ff', fora: '#170d38', morro: '#3b2a7a' },
  { nome: 'Estádio', fundo: '#0b1a2e', chao: ['#2f8f3a', '#37a145'], linha: '#ffffffcc', campo: true, mureta: '#1e88e5', luz: '#fff3c4', fora: '#10301a', morro: '#1d3b28' },
  { nome: 'Gelo', fundo: '#0b2236', chao: ['#4f93c4', '#5ea3d3'], linha: '#ffffff77', mureta: '#7fe8ff', luz: '#bff3ff', fora: '#163650', morro: '#cfeeff' },
  { nome: 'Vulcão', fundo: '#1e0805', chao: ['#3a1410', '#47190f'], linha: '#ff6a0077', mureta: '#ff6a00', luz: '#ffb347', fora: '#250906', morro: '#4a1a10' },
];

// ---------- Cena 3D ----------
// preserveDrawingBuffer: deixa o painel tirar a prévia da tela
const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('mundo'), antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setSize(W, H, false);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const cena = new THREE.Scene();
cena.fog = new THREE.Fog('#120a2e', 70, 140);

const camera = new THREE.PerspectiveCamera(52, W / H, 0.1, 300);
const CAM_POS = new THREE.Vector3(0, 53, 23), CAM_ALVO = new THREE.Vector3(0, 0, 0);
// Sobe a imagem para a arena ficar entre o placar e a parte de baixo (que o TikTok cobre)
camera.setViewOffset(W, H, 0, 62, W, H);
let tremor = 0;

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(cena, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(W / 2, H / 2), 0.45, 0.3, 0.86);
composer.addPass(bloom);
composer.addPass(new OutputPass());

const hemi = new THREE.HemisphereLight('#b9c8ff', '#2a1640', 1.6);
cena.add(hemi);
const sol = new THREE.DirectionalLight('#ffffff', 2.2);
sol.position.set(-12, 30, 14);
sol.castShadow = true;
sol.shadow.mapSize.set(2048, 2048);
Object.assign(sol.shadow.camera, { left: -26, right: 26, top: 26, bottom: -26, near: 1, far: 80 });
cena.add(sol);

// Faz o material brilhar na própria cor (o brilho neon pega nas partes mais claras)
function brilhar(mat, inicial = 0) {
  mat.userData.brilho = { value: inicial };
  mat.onBeforeCompile = sh => {
    sh.uniforms.uBrilho = mat.userData.brilho;
    sh.fragmentShader = 'uniform float uBrilho;\n' + sh.fragmentShader.replace('#include <emissivemap_fragment>',
      '#include <emissivemap_fragment>\n\ttotalEmissiveRadiance += diffuseColor.rgb * uBrilho;');
  };
  return mat;
}

// Chão da arena (desenhado de novo a cada cenário)
const telaChao = document.createElement('canvas');
telaChao.width = 1200; telaChao.height = 840;
const texChao = new THREE.CanvasTexture(telaChao);
texChao.colorSpace = THREE.SRGBColorSpace; texChao.anisotropy = 8;
const chao = new THREE.Mesh(new THREE.PlaneGeometry(AX * 2, AZ * 2), new THREE.MeshStandardMaterial({ map: texChao, roughness: 0.85 }));
chao.rotation.x = -Math.PI / 2; chao.receiveShadow = true;
cena.add(chao);
function pintarChao(tema) {
  const g = telaChao.getContext('2d'), w = 1200, h = 840, cel = w / 15;
  if (tema.campo) {
    for (let i = 0; i < 15; i++) { g.fillStyle = tema.chao[i % 2]; g.fillRect(i * cel, 0, cel + 1, h); }
    g.strokeStyle = tema.linha; g.fillStyle = tema.linha; g.lineWidth = 7;
    g.strokeRect(24, 24, w - 48, h - 48);
    g.beginPath(); g.moveTo(w / 2, 24); g.lineTo(w / 2, h - 24); g.stroke();
    g.beginPath(); g.arc(w / 2, h / 2, 105, 0, Math.PI * 2); g.stroke();
    g.beginPath(); g.arc(w / 2, h / 2, 9, 0, Math.PI * 2); g.fill();
    for (const lado of [0, 1]) {
      const x = lado ? w - 24 : 24, s = lado ? -1 : 1;
      g.strokeRect(Math.min(x, x + s * 170), h / 2 - 190, 170, 380);
      g.strokeRect(Math.min(x, x + s * 70), h / 2 - 90, 70, 180);
      g.beginPath(); g.arc(x + s * 170, h / 2, 60, lado ? Math.PI / 2 : -Math.PI / 2, lado ? Math.PI * 1.5 : Math.PI / 2); g.stroke();
    }
  } else {
    for (let i = 0; i < 15; i++) for (let j = 0; j < 11; j++) { g.fillStyle = tema.chao[(i + j) % 2]; g.fillRect(i * cel, j * cel, cel + 1, cel + 1); }
    g.strokeStyle = tema.linha; g.lineWidth = 3;
    for (let i = 0; i <= 15; i++) { g.beginPath(); g.moveTo(i * cel, 0); g.lineTo(i * cel, h); g.stroke(); }
    for (let j = 0; j <= 11; j++) { g.beginPath(); g.moveTo(0, j * cel); g.lineTo(w, j * cel); g.stroke(); }
  }
  texChao.needsUpdate = true;
}
const matFora = new THREE.MeshStandardMaterial({ color: '#170d38', roughness: 1 });
const fora = new THREE.Mesh(new THREE.PlaneGeometry(300, 300), matFora);
fora.rotation.x = -Math.PI / 2; fora.position.y = -0.6; fora.receiveShadow = true;
cena.add(fora);

// Muretas neon (no modo Arena Encolhendo elas andam para dentro)
const matMureta = brilhar(new THREE.MeshStandardMaterial({ color: '#ff3d8b', roughness: 0.4 }), 0.55);
const muretas = [0, 1, 2, 3].map(() => {
  const m = new THREE.Mesh(new THREE.BoxGeometry(1, 0.9, 1), matMureta);
  m.castShadow = true; cena.add(m);
  return m;
});
function posicionarMuretas() {
  const [n, s, o, l] = muretas;
  n.scale.set(lim.x * 2 + 1.2, 1, 0.6); n.position.set(0, 0.15, -lim.z - 0.3);
  s.scale.set(lim.x * 2 + 1.2, 1, 0.6); s.position.set(0, 0.15, lim.z + 0.3);
  o.scale.set(0.6, 1, lim.z * 2); o.position.set(-lim.x - 0.3, 0.15, 0);
  l.scale.set(0.6, 1, lim.z * 2); l.position.set(lim.x + 0.3, 0.15, 0);
}

// Arquibancadas com torcida nas cores dos times da rodada
const telaTorcida = document.createElement('canvas');
telaTorcida.width = 1024; telaTorcida.height = 256;
const texTorcida = new THREE.CanvasTexture(telaTorcida);
texTorcida.colorSpace = THREE.SRGBColorSpace;
texTorcida.wrapS = texTorcida.wrapT = THREE.RepeatWrapping;
texTorcida.repeat.set(3, 1);
function pintarTorcida(cores) {
  const g = telaTorcida.getContext('2d');
  g.fillStyle = '#120d22'; g.fillRect(0, 0, 1024, 256);
  // Fileiras de torcedores: cabecinhas pequenas, metade nas cores dos times e metade em tons escuros
  for (let y = 10; y < 256; y += 16) for (let x = rnd(0, 8); x < 1024; x += rnd(9, 14)) {
    g.fillStyle = Math.random() < 0.55 ? sortear(cores) : sortear(['#3a3350', '#4a4060', '#2a2440']);
    g.beginPath(); g.arc(x, y + rnd(-2, 2), rnd(3, 4.5), 0, Math.PI * 2); g.fill();
  }
  texTorcida.needsUpdate = true;
}
const matArquibancada = new THREE.MeshStandardMaterial({ map: texTorcida, color: '#8a8798', roughness: 0.95 });
for (let k = 0; k < 3; k++) {
  const alt = 1.2 + k * 1.3, prof = 2.4;
  for (const [lx, lz, comp] of [[0, -1, AX * 2 + 8 + k * 5], [-1, 0, AZ * 2 + 4 + k * 5], [1, 0, AZ * 2 + 4 + k * 5]]) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(lx ? prof : comp, alt, lx ? comp : prof), matArquibancada);
    const d = 3.2 + k * prof;
    m.position.set(lx * (AX + d), alt / 2 - 0.6, lz * (AZ + d));
    m.receiveShadow = true;
    cena.add(m);
  }
}
// Torres de refletor nos cantos
const matRefletor = brilhar(new THREE.MeshStandardMaterial({ color: '#fff3c4' }), 1.6);
const matPoste = new THREE.MeshStandardMaterial({ color: '#555a66', metalness: 0.6, roughness: 0.4 });
for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
  const x = sx * (AX + 9), z = sz * (AZ + 9);
  const poste = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.45, 14, 8), matPoste);
  poste.position.set(x, 6.4, z); cena.add(poste);
  const refletor = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1.8, 0.5), matRefletor);
  refletor.position.set(x, 13.6, z); refletor.lookAt(0, 0, 0); cena.add(refletor);
}
// Morrinhos no horizonte (só enfeite)
const matMorro = new THREE.MeshStandardMaterial({ color: '#3b2a7a', roughness: 0.9, flatShading: true });
for (let i = 0; i < 16; i++) {
  const m = new THREE.Mesh(new THREE.ConeGeometry(rnd(5, 10), rnd(8, 18), 6), matMorro);
  m.position.set(rnd(-60, 60), 0, rnd(-90, -AZ - 16));
  cena.add(m);
}

function aplicarCenario(tema, noite) {
  cena.background = new THREE.Color(noite ? '#05030d' : tema.fundo);
  cena.fog.color.set(noite ? '#05030d' : tema.fundo);
  pintarChao(tema);
  matMureta.color.set(tema.mureta);
  matRefletor.color.set(tema.luz);
  matFora.color.set(tema.fora);
  matMorro.color.set(tema.morro);
  hemi.intensity = noite ? 0.25 : 1.6;
  sol.intensity = noite ? 0.35 : 2.2;
  bloom.strength = noite ? 0.8 : 0.45;
  const cores = cobras.flatMap(c => [c.t.cor, c.t.faixa, c.t.ui]);
  pintarTorcida(cores.length ? cores : ['#ffffff', '#ff3d8b', '#5ad8ff']);
}

// ---------- Partículas ----------
const MAX_PART = 500;
const partMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.22, 0.22, 0.22), new THREE.MeshBasicMaterial(), MAX_PART);
partMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
cena.add(partMesh);
const parts = Array.from({ length: MAX_PART }, () => ({ vida: 0, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0 }));
let partProx = 0;
const tmpE = new THREE.Euler(), tmpM = new THREE.Matrix4(), tmpQ = new THREE.Quaternion(), tmpS = new THREE.Vector3(), tmpP = new THREE.Vector3(), tmpC = new THREE.Color();
partMesh.setColorAt(0, tmpC.set('#fff'));
function explosao(x, z, cor, n = 14, forca = 6, y = 0.6) {
  tmpC.set(cor);
  for (let i = 0; i < n; i++) {
    Object.assign(parts[partProx], { vida: rnd(0.5, 1), x, y, z, vx: rnd(-1, 1) * forca, vy: rnd(3, 8), vz: rnd(-1, 1) * forca });
    partMesh.setColorAt(partProx, tmpC);
    partProx = (partProx + 1) % MAX_PART;
  }
  partMesh.instanceColor.needsUpdate = true;
}
function atualizarParticulas(dt) {
  parts.forEach((p, i) => {
    if (p.vida > 0) {
      p.vida -= dt; p.vy -= 18 * dt;
      p.x += p.vx * dt; p.y = Math.max(0.1, p.y + p.vy * dt); p.z += p.vz * dt;
    }
    const s = p.vida > 0 ? Math.min(1, p.vida * 2) : 0;
    tmpP.set(p.x, p.y, p.z); tmpS.set(s, s, s); tmpQ.setFromEuler(tmpE.set(p.vida * 8, p.vida * 5, 0));
    partMesh.setMatrixAt(i, tmpM.compose(tmpP, tmpQ, tmpS));
  });
  partMesh.instanceMatrix.needsUpdate = true;
}

// ---------- Comida ----------
// petisco = bolinha comum; joia = comida com nome de quem comentou; dourada/estrela = especiais
const MAX_COMIDA = 320, MAX_NOMES = 30;
const petiscoMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.3, 12, 10),
  brilhar(new THREE.MeshStandardMaterial({ roughness: 0.3 }), 0.45), MAX_COMIDA);
const joiaMesh = new THREE.InstancedMesh(new THREE.OctahedronGeometry(0.45),
  brilhar(new THREE.MeshStandardMaterial({ roughness: 0.15, metalness: 0.3 }), 0.55), MAX_NOMES + 2);
for (const m of [petiscoMesh, joiaMesh]) { m.castShadow = true; m.setColorAt(0, tmpC.set('#fff')); cena.add(m); }
const matOuro = brilhar(new THREE.MeshStandardMaterial({ color: '#ffcc33', metalness: 0.6, roughness: 0.25 }), 0.65);
const geoDourada = new THREE.DodecahedronGeometry(0.75);
const geoEstrela = (() => {
  const s = new THREE.Shape();
  for (let k = 0; k < 10; k++) {
    const r = k % 2 ? 0.38 : 0.9, a = -Math.PI / 2 + k * Math.PI / 5;
    k ? s.lineTo(Math.cos(a) * r, Math.sin(a) * r) : s.moveTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  return new THREE.ExtrudeGeometry(s, { depth: 0.25, bevelEnabled: true, bevelSize: 0.06, bevelThickness: 0.06, bevelSegments: 2 }).center();
})();
let comidas = [];
const CORES_PETISCO = ['#ffd23f', '#5ad8ff', '#ff8af0', '#9dff6a', '#ffa64d'];
const ESPECIAIS = { dourada: geoDourada, estrela: geoEstrela };

function removerComida(f) {
  const i = comidas.indexOf(f);
  if (i >= 0) comidas.splice(i, 1);
  if (f.mesh) cena.remove(f.mesh);
}
function soltarComida(x, z, { valor = 1, tipo = 'ambiente', nome = null, dono = null, time = null, cor = null } = {}) {
  if (comidas.length >= MAX_COMIDA) removerComida(comidas.find(f => f.tipo !== 'nome' && !ESPECIAIS[f.tipo]) || comidas[0]);
  if (tipo === 'nome') {
    const nomes = comidas.filter(f => f.tipo === 'nome');
    if (nomes.length >= MAX_NOMES) removerComida(nomes[0]);
  }
  const f = {
    x: limitar(x, -lim.x + 1, lim.x - 1), z: limitar(z, -lim.z + 1, lim.z - 1), valor, tipo, nome, dono, time,
    cor: cor || sortear(CORES_PETISCO), escala: tipo === 'nome' ? 1.6 : valor > 1 ? 1.3 : 0.9,
    fase: Math.random() * 6, nasceu: agora(),
  };
  if (ESPECIAIS[tipo]) { f.mesh = new THREE.Mesh(ESPECIAIS[tipo], matOuro); f.mesh.castShadow = true; cena.add(f.mesh); }
  comidas.push(f);
  return f;
}
function soltarPerto(x, z, raio, opcoes) {
  const a = Math.random() * Math.PI * 2, r = rnd(raio * 0.4, raio);
  return soltarComida(x + Math.cos(a) * r, z + Math.sin(a) * r, opcoes);
}
function chuvaDeComida(n, x = 0, z = 0, raio = 30) {
  for (let i = 0; i < n; i++) soltarPerto(x, z, raio, { valor: 1, tipo: 'chuva' });
}
function desenharComidas(t) {
  let np = 0, nj = 0;
  for (const f of comidas) {
    const nascendo = Math.min(1, (t - f.nasceu) * 3);
    const s = f.escala * nascendo;
    const y = 0.5 + Math.sin(t * 3 + f.fase) * 0.15;
    if (f.mesh) {
      f.mesh.position.set(f.x, y + 0.6, f.z);
      f.mesh.rotation.set(f.tipo === 'estrela' ? 0 : t, t * 2, 0);
      f.mesh.scale.setScalar(nascendo * (1 + Math.sin(t * 6) * 0.08));
      if (Math.random() < 0.15) explosao(f.x + rnd(-0.6, 0.6), f.z + rnd(-0.6, 0.6), '#ffe680', 1, 1, 1.4);
      continue;
    }
    const mesh = f.tipo === 'nome' ? joiaMesh : petiscoMesh;
    const i = f.tipo === 'nome' ? nj++ : np++;
    tmpP.set(f.x, y + (f.tipo === 'nome' ? 0.25 : 0), f.z);
    tmpQ.setFromEuler(tmpE.set(f.tipo === 'nome' ? 0 : t + f.fase, t * 1.5 + f.fase, 0));
    tmpS.set(s, s, s);
    mesh.setMatrixAt(i, tmpM.compose(tmpP, tmpQ, tmpS));
    mesh.setColorAt(i, tmpC.set(f.cor));
  }
  petiscoMesh.count = np; joiaMesh.count = nj;
  for (const m of [petiscoMesh, joiaMesh]) {
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }
}

// ---------- Bombas (modo Campo Minado) ----------
const matMina = new THREE.MeshStandardMaterial({ color: '#2b2b36', metalness: 0.6, roughness: 0.35 });
const matLuzMina = brilhar(new THREE.MeshStandardMaterial({ color: '#ff2a2a' }), 1.5);
const geoEspinho = new THREE.ConeGeometry(0.16, 0.55, 6);
let minas = [];
function criarMina() {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.IcosahedronGeometry(0.75, 1), matMina));
  const dirs = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, 0, 1], [0, 0, -1], [0.7, 0.7, 0], [-0.7, 0.7, 0], [0, 0.7, 0.7], [0, 0.7, -0.7]];
  for (const d of dirs) {
    const e = new THREE.Mesh(geoEspinho, matMina);
    const v = new THREE.Vector3(...d).normalize();
    e.position.copy(v).multiplyScalar(0.85);
    e.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), v);
    g.add(e);
  }
  const luz = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), matLuzMina);
  luz.position.y = 0.95; g.add(luz);
  g.traverse(o => { o.castShadow = true; });
  cena.add(g);
  const m = { x: 0, z: 0, g };
  moverMina(m);
  return m;
}
function moverMina(m) {
  const p = lugarLivre(0.8);
  m.x = p.x; m.z = p.z;
  explosao(m.x, m.z, '#ff6a00', 10, 4);
}
function limparMinas() { for (const m of minas) cena.remove(m.g); minas = []; }

// ---------- Cobras ----------
const geoGomo = new THREE.SphereGeometry(1, 18, 14);
const geoOlho = new THREE.SphereGeometry(1, 12, 10);
const matBranco = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.2 });
const matPreto = new THREE.MeshStandardMaterial({ color: '#111111', roughness: 0.2 });
let cobras = [];           // cobras na arena agora
const guardadas = {};       // cobras já criadas (reaproveitadas entre rodadas)

function montarCobra(ti) {
  const t = TIMES_TODOS[ti];
  const mat = brilhar(new THREE.MeshStandardMaterial({ roughness: 0.35, metalness: 0.05 }));
  const corpo = new THREE.InstancedMesh(geoGomo, mat, CONFIG.tamanhoMax + 1);
  corpo.castShadow = true; corpo.receiveShadow = true;
  corpo.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  const c1 = new THREE.Color(t.cor), c2 = new THREE.Color(t.faixa), c3 = new THREE.Color(t.faixa2 || t.cor);
  for (let k = 0; k <= CONFIG.tamanhoMax; k++) {
    const faixa = Math.floor(k / 2) % (t.faixa2 ? 3 : 2);
    corpo.setColorAt(k, faixa === 0 ? c1 : faixa === 1 ? c2 : c3);
  }

  const cabeca = new THREE.Group();
  const cranio = new THREE.Mesh(geoGomo, brilhar(new THREE.MeshStandardMaterial({ color: t.cor, roughness: 0.3 })));
  cranio.scale.set(1, 0.85, 1.15); cranio.castShadow = true;
  cabeca.add(cranio);
  const olhos = new THREE.Group();
  for (const lado of [-1, 1]) {
    const olho = new THREE.Mesh(geoOlho, matBranco);
    olho.scale.setScalar(0.34); olho.position.set(lado * 0.42, 0.42, 0.55);
    const pupila = new THREE.Mesh(geoOlho, matPreto);
    pupila.scale.setScalar(0.17); pupila.position.set(lado * 0.47, 0.48, 0.8);
    olhos.add(olho, pupila);
  }
  cabeca.add(olhos);
  const lingua = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.05, 0.6), new THREE.MeshBasicMaterial({ color: '#ff2a55' }));
  lingua.position.set(0, -0.1, 1.2);
  cabeca.add(lingua);
  // Anel brilhante no chão, na cor do time, para achar a cobra fácil
  const anel = new THREE.Mesh(new THREE.RingGeometry(1.2, 1.5, 36),
    new THREE.MeshBasicMaterial({ color: t.ui, transparent: true, opacity: 0.75, depthWrite: false, side: THREE.DoubleSide }));
  anel.rotation.x = -Math.PI / 2; anel.position.y = -0.78;
  cabeca.add(anel);
  const escudo = new THREE.Mesh(new THREE.SphereGeometry(1.7, 20, 16),
    new THREE.MeshBasicMaterial({ color: '#7fe8ff', transparent: true, opacity: 0.25, depthWrite: false }));
  escudo.visible = false;
  cabeca.add(escudo);

  return { ti, t, corpo, mat, cabeca, cranio, olhos, lingua, anel, escudoMesh: escudo };
}
function colocarNaArena(ti) {
  const c = guardadas[ti] ||= montarCobra(ti);
  Object.assign(c, {
    x: 0, z: 0, ang: 0, tam: CONFIG.tamanhoInicial, rastro: [], andado: 0,
    turboAte: 0, escudoAte: 0, imuneAte: 0, alvo: null, pensarEm: 0, proximoDesvio: 0, vagar: Math.random() * 6,
    fala: null, proximoPapo: agora() + rnd(6, 18), ultimaFalaNome: 0, ultimoRoubo: 0, nasceu: agora(), piscarEm: agora() + rnd(2, 5),
  });
  cena.add(c.corpo, c.cabeca);
  cobras.push(c);
  return c;
}
function tirarDaArena(c) {
  cena.remove(c.corpo, c.cabeca);
  cobras = cobras.filter(o => o !== c);
}
const cobraDoTime = ti => cobras.find(c => c.ti === ti);
const raioCabeca = c => 0.62 + Math.min(0.45, c.tam / 240);

function colocar(c, x, z, ang) {
  c.x = x; c.z = z; c.ang = ang;
  c.rastro = [];
  // O rabo começa curto e reto; o resto aparece conforme a cobra anda
  for (let n = 0; n <= Math.min(c.tam, 12) * K + 1; n++) c.rastro.push({ x: x - Math.cos(ang) * n * PASSO, z: z - Math.sin(ang) * n * PASSO });
  c.turboAte = c.escudoAte = 0; c.imuneAte = agora() + 1.5; c.alvo = null;
}
// Ponto da arena mais longe de todas as cobras (para nascer cobra ou bomba)
function lugarLivre(margem = 0.75) {
  let melhor = { x: 0, z: 0 }, maior = -1;
  for (let i = 0; i < 30; i++) {
    const x = rnd(-lim.x, lim.x) * margem, z = rnd(-lim.z, lim.z) * margem;
    let menor = Infinity;
    for (const c of cobras) {
      for (let k = 0; k < c.rastro.length; k += K * 3) menor = Math.min(menor, Math.hypot(c.rastro[k].x - x, c.rastro[k].z - z));
      menor = Math.min(menor, Math.hypot(c.x - x, c.z - z));
    }
    for (const m of minas) menor = Math.min(menor, Math.hypot(m.x - x, m.z - z));
    if (menor > maior) { maior = menor; melhor = { x, z }; }
  }
  return melhor;
}

// Para onde a cobra quer ir: comida que vale mais e está mais perto, desviando de paredes, bombas e outras cobras
function pensar(c) {
  let melhor = null, nota = 0;
  for (const f of comidas) {
    const d = Math.hypot(f.x - c.x, f.z - c.z);
    const bonus = (f.tipo === 'nome' && f.time === c.ti ? 3 : 0) + (f.tipo === 'estrela' ? 10 : 0);
    const n = (f.valor + bonus) / (d + 3);
    if (n > nota) { nota = n; melhor = f; }
  }
  c.alvo = melhor;
}
function perigo(c, x, z) {
  let p = 0;
  if (Math.abs(x) > lim.x - 1.2 || Math.abs(z) > lim.z - 1.2) p += 10;
  for (const m of minas) if ((m.x - x) ** 2 + (m.z - z) ** 2 < 4.5) p += 12;
  for (const o of cobras) {
    if (o === c) continue;
    const n = Math.min(o.tam, Math.floor((o.rastro.length - 1) / K));
    for (let k = 0; k <= n; k += 2) {
      const q = k === 0 ? o : o.rastro[k * K];
      const dx = q.x - x, dz = q.z - z;
      if (dx * dx + dz * dz < 2.4) { p += 6; break; }
    }
  }
  return p;
}
function decidirAngulo(c, t) {
  let desejado;
  if (c.alvo && comidas.includes(c.alvo)) desejado = Math.atan2(c.alvo.z - c.z, c.alvo.x - c.x);
  else { c.vagar += rnd(-0.3, 0.3); desejado = c.vagar; }
  if (t < c.proximoDesvio) return c.desvio ?? desejado;
  c.proximoDesvio = t + 0.12;
  let melhor = desejado, menor = Infinity;
  for (const off of [0, 0.5, -0.5, 1, -1, 1.6, -1.6, 2.4, -2.4]) {
    const a = desejado + off;
    const ca = Math.cos(a), sa = Math.sin(a);
    const custo = (perigo(c, c.x + ca * 2, c.z + sa * 2) + perigo(c, c.x + ca * 4, c.z + sa * 4) * 0.6) * 10 + Math.abs(off);
    if (custo < menor) { menor = custo; melhor = a; }
  }
  c.desvio = melhor;
  return melhor;
}

function moverCobra(c, dt, t) {
  const rapido = t < c.turboAte || t < frenesiAte;
  const vel = (rapido ? VEL_TURBO : VEL) * (modo.id === 'turbo' ? 1.35 : 1) * (1 - Math.min(0.25, c.tam / 800));
  const alvo = decidirAngulo(c, t);
  c.ang += limitar(angDif(alvo, c.ang), -GIRO * dt, GIRO * dt);
  const px = c.x, pz = c.z;
  c.x += Math.cos(c.ang) * vel * dt;
  c.z += Math.sin(c.ang) * vel * dt;
  const r = raioCabeca(c);
  if (Math.abs(c.x) > lim.x - r) { c.x = Math.sign(c.x) * (lim.x - r); c.ang = Math.PI - c.ang; }
  if (Math.abs(c.z) > lim.z - r) { c.z = Math.sign(c.z) * (lim.z - r); c.ang = -c.ang; }
  // Rastro com pontos a cada PASSO (interpolando entre o quadro anterior e o atual)
  const dist = Math.hypot(c.x - px, c.z - pz);
  c.andado += dist;
  while (c.andado >= PASSO) {
    c.andado -= PASSO;
    const f = dist > 0 ? 1 - c.andado / dist : 1;
    c.rastro.unshift({ x: px + (c.x - px) * f, z: pz + (c.z - pz) * f });
  }
  c.rastro.length = Math.min(c.rastro.length, c.tam * K + 1);
  // Rastro de faíscas no turbo
  if (rapido && Math.random() < 0.6) explosao(c.x - Math.cos(c.ang) * r, c.z - Math.sin(c.ang) * r, c.t.ui, 1, 1.5, 0.5);
}

function desenharCobra(c, t) {
  const n = Math.min(c.tam, Math.floor((c.rastro.length - 1) / K));
  const piscando = t < c.imuneAte && Math.floor(t * 10) % 2 === 0;
  const grossura = 1 + Math.min(0.5, c.tam / 220);
  const surgindo = Math.min(1, (t - c.nasceu) * 2.5);
  for (let k = 1; k <= n; k++) {
    const p = c.rastro[k * K];
    const s = SEG_R * grossura * surgindo * (1 - 0.5 * Math.pow(k / (n + 1), 2)) * (piscando ? 0.6 : 1);
    tmpP.set(p.x, s + Math.sin(t * 8 - k * 0.5) * 0.06, p.z);
    tmpS.set(s, s, s);
    c.corpo.setMatrixAt(k - 1, tmpM.compose(tmpP, tmpQ.identity(), tmpS));
  }
  c.corpo.count = n;
  c.corpo.instanceMatrix.needsUpdate = true;
  if (c.corpo.instanceColor) c.corpo.instanceColor.needsUpdate = true;

  const r = raioCabeca(c) * surgindo;
  c.cabeca.position.set(c.x, r * 0.85, c.z);
  c.cabeca.rotation.y = Math.atan2(Math.cos(c.ang), Math.sin(c.ang));
  c.cabeca.scale.setScalar(Math.max(0.01, r));
  c.cabeca.visible = !piscando;
  c.lingua.visible = Math.sin(t * 5 + c.ti) > 0.6;
  // Piscadinha de vez em quando
  if (t > c.piscarEm) c.piscarEm = t + rnd(2.5, 6);
  c.olhos.scale.y = t > c.piscarEm - 0.12 ? 0.15 : 1;
  const turbo = t < c.turboAte || t < frenesiAte;
  const base = modo.id === 'noite' ? 0.35 : 0;
  c.mat.userData.brilho.value = c.cranio.material.userData.brilho.value = turbo ? base + 0.5 + Math.sin(t * 20) * 0.25 : base;
  c.anel.material.opacity = 0.55 + Math.sin(t * 4 + c.ti) * 0.2;
  c.escudoMesh.visible = t < c.escudoAte;
  c.escudoMesh.material.opacity = 0.2 + Math.sin(t * 6) * 0.08;
}

// Batida: a cabeça encostou em outra cobra (ou numa bomba). Perde um pedaço, que vira comida.
function bater(c, outra, t, fracao = 0.25) {
  if (t < c.escudoAte) { c.imuneAte = t + 1.2; c.ang += Math.PI; return; }
  const perda = Math.min(c.tam - 5, Math.max(2, Math.round(c.tam * fracao)));
  if (perda > 0) {
    const n = Math.min(c.tam, Math.floor((c.rastro.length - 1) / K));
    for (let k = n - perda + 1; k <= n; k += 2) {
      const p = c.rastro[k * K];
      if (p) soltarComida(p.x, p.z, { valor: 1, tipo: 'resto', cor: c.t.ui });
    }
    c.tam -= perda;
    c.rastro.length = Math.min(c.rastro.length, c.tam * K + 1);
  }
  c.imuneAte = t + 2.5;
  c.ang += Math.PI + rnd(-0.6, 0.6);
  explosao(c.x, c.z, c.t.ui, 18);
  Som.bumper();
  tremor = Math.max(tremor, perda >= 8 ? 0.6 : 0.25);
  falarCobra(c, 'bateu');
  if (outra && Math.random() < 0.5) falarCobra(outra, 'zoou', { rival: c.t.nome });
  if (perda >= 6) narrarComCalma('batida', 10, { time: c.t.nome });
}

function colisoes(t) {
  for (const c of cobras) {
    if (t < c.imuneAte) continue;
    const r = raioCabeca(c);
    const mina = minas.find(m => (m.x - c.x) ** 2 + (m.z - c.z) ** 2 < (r + 0.9) ** 2);
    if (mina) {
      explosao(mina.x, mina.z, '#ff6a00', 40, 9);
      Som.teleporte();
      aviso(`💣 BUM! ${c.t.nome} pisou na bomba!`, '#ff8a3d');
      bater(c, null, t, 0.3);
      tremor = 1;
      narrarComCalma('bomba', 8, { time: c.t.nome });
      moverMina(mina);
      continue;
    }
    for (const o of cobras) {
      if (o === c) continue;
      const ro = raioCabeca(o);
      if ((o.x - c.x) ** 2 + (o.z - c.z) ** 2 < (r + ro) * (r + ro) * 0.8) {
        // cabeça com cabeça: a menor leva a pior
        if (c.tam <= o.tam) { bater(c, o, t); break; }
        continue;
      }
      const n = Math.min(o.tam, Math.floor((o.rastro.length - 1) / K));
      const g = SEG_R * (1 + Math.min(0.5, o.tam / 220));
      let bateu = false;
      for (let k = 2; k <= n; k++) {
        const p = o.rastro[k * K];
        if ((p.x - c.x) ** 2 + (p.z - c.z) ** 2 < (r + g) * (r + g) * 0.75) { bateu = true; break; }
      }
      if (bateu) { bater(c, o, t); break; }
    }
  }
}

function comer(t) {
  for (const c of cobras) {
    const r = raioCabeca(c) + 0.45;
    for (let i = comidas.length - 1; i >= 0; i--) {
      const f = comidas[i];
      if (!f || (f.x - c.x) ** 2 + (f.z - c.z) ** 2 > (r + (f.mesh ? 0.5 : 0)) ** 2) continue;
      removerComida(f);
      crescer(c, f.valor);
      explosao(f.x, f.z, f.cor, f.tipo === 'nome' ? 12 : 4, 3);
      Som.pop(f.tipo === 'nome' ? 1.4 : 1 + Math.random() * 0.3);
      if (f.tipo === 'dourada') {
        Som.moeda(); explosao(f.x, f.z, '#ffd23f', 30, 7);
        flutuar(f.x, f.z, `+${f.valor} 🌟`, '#ffd23f');
        falarCobra(c, 'dourada');
        aviso(`🌟 ${c.t.nome} pegou a fruta dourada!`, '#ffd23f');
      } else if (f.tipo === 'estrela') {
        Som.turbo(); explosao(f.x, f.z, '#ffd23f', 30, 7);
        c.turboAte = Math.max(c.turboAte, t) + 6; c.escudoAte = Math.max(c.escudoAte, t) + 6;
        flutuar(f.x, f.z, '⭐ TURBO + ESCUDO', '#ffd23f');
        falarCobra(c, 'estrela');
        aviso(`⭐ ${c.t.nome} pegou a estrela!`, '#ffd23f');
      }
      if (f.tipo !== 'nome') continue;
      flutuar(f.x, f.z, `+${f.valor} ${cortar(f.nome, 12)}`, TIMES_TODOS[f.time]?.ui || '#fff');
      if (f.time === c.ti) {
        creditar(f.time, f.dono, f.nome, f.valor);
        if (t - c.ultimaFalaNome > 5) { c.ultimaFalaNome = t; falarCobra(c, 'comeuNome', { nome: f.nome }); }
      } else if (f.time != null && t - c.ultimoRoubo > 6) {
        c.ultimoRoubo = t;
        falarCobra(c, 'roubou', { nome: f.nome });
        aviso(`😈 ${c.t.nome} roubou a comida de ${cortar(f.nome, 12)}!`, c.t.ui);
      }
    }
  }
}
function crescer(c, n) { c.tam = Math.min(CONFIG.tamanhoMax, c.tam + n); }

// ---------- Falas ----------
// Narradora (voz normal). Nada de pedir presente: só agradece e anima.
const FALAS = {
  novaRodada: ['Rodada {n}: {modo}! {desc} Comenta o número da sua equipe!', 'Atenção, galera! {modo}! {desc}', 'Vem aí: {modo}! {desc} Comenta sua equipe pra jogar!', 'Rodada {n} começando! {modo}! {desc}'],
  largada: ['Valendo!', 'Já! Pode comer!', 'Começou!', 'Solta as cobras!'],
  entrou: ['{nome} entrou na equipe {time}!', 'Chegou reforço pra equipe {time}: {nome}!', '{nome} tá com a equipe {time}!', 'Bem-vindo à equipe, {nome}!'],
  chegouTime: ['Chegou a equipe {time} na arena!', 'A equipe {time} entrou no jogo!', 'Olha quem chegou: {time}!'],
  esperaTime: ['A equipe {time} entra na próxima rodada!'],
  chamar: ['A cobra {time} tá com fome! Comenta {num}!', 'Quem vai ajudar a equipe {time}? Comenta {num}!', 'Equipe {time}, cadê vocês? Comenta {num}!'],
  lider: ['A cobra {time} é a maior agora!', 'Virada! {time} na frente!', 'A equipe {time} assumiu a liderança!', 'Olha a cobra {time} disparando!'],
  batida: ['Eita! A cobra {time} bateu e perdeu um pedaço!', 'Pancada! A cobra {time} encolheu!', 'Que trombada da cobra {time}!'],
  bomba: ['Bum! A cobra {time} pisou na bomba!', 'Explodiu! Coitada da cobra {time}!'],
  presente: ['Valeu, {nome}! Turbo na cobra {time}!', '{nome} mandou {presente}! Valeu demais!', 'Obrigada pelo presente, {nome}!', 'Brigadão, {nome}! A cobra {time} ganhou turbo!'],
  presenteRosa: ['Valeu pela rosa, {nome}!', 'Uma rosa de {nome}! Obrigada!', 'Rosa recebida! Valeu, {nome}!', 'Obrigada pela rosinha, {nome}!'],
  presenteRosas: ['Valeu pelas {qtd} rosas, {nome}!', '{qtd} rosas de {nome}! Obrigada!'],
  presenteGrande: ['Uau, {nome}! Mega cobra pra equipe {time}!', 'Que isso, {nome}! A cobra {time} virou um monstro!', 'Muito obrigada, {nome}! A cobra {time} ficou gigante!'],
  presenteDepois: ['Valeu, {nome}! A equipe {time} começa a próxima rodada maior!', 'Obrigada, {nome}! Bônus pra equipe {time} na próxima!'],
  seguiu: ['Valeu por seguir, {nome}!', '{nome} seguiu! Bem-vindo!', 'Mais um seguidor! Valeu, {nome}!'],
  compartilhou: ['Valeu por compartilhar, {nome}!', '{nome} compartilhou! Valeu demais!'],
  final: ['Últimos vinte segundos! Quem vai ser a maior?', 'Reta final! Alimenta sua cobra!', 'Tá acabando! Vai, galera!'],
  encolhendo: ['A arena tá fechando! Cuidado!', 'As paredes estão vindo! Apertou!'],
  vencedor: ['A equipe {time} venceu com {tam} pedaços!', 'Vitória da equipe {time}! A maior cobra da rodada!', 'É da equipe {time}! Que cobra!'],
  apoiador: ['{nome} agora é o maior apoiador da live!', 'Novo líder no ranking: {nome}!'],
  curtidas: ['{n} curtidas! Choveu comida na arena!', 'Bateu {n} curtidas! Chuva de comida!'],
  eventoDourada: ['Apareceu uma fruta dourada! Vale oito!', 'Fruta dourada na arena! Corre!'],
  eventoEstrela: ['Uma estrela apareceu! Quem pegar ganha turbo e escudo!', 'Estrela na arena!'],
  eventoChuva: ['Chuva de comida!', 'Olha a chuva de comida!'],
  eventoFrenesi: ['Frenesi! Todo mundo rápido!', 'Acelera todo mundo!'],
};
// Falas das cobras (balão em cima da cabeça; algumas também em voz, mais fina)
const FALAS_COBRA = {
  papo: ['Tô com fome!', 'Comenta {num} pra me dar comida!', 'Vai, {time}!', 'Ninguém me segura!', 'Cadê a equipe {time}?', 'Hoje eu fico gigante!', 'Sssss!', 'Ô {rival}, vou te engolir!', 'Sai da frente, {rival}!', 'Essa arena é minha!', 'Hmm, cheiro de comida!'],
  comeuNome: ['Valeu, {nome}!', 'Hmm, delícia, {nome}!', 'Essa foi de {nome}!', 'Obrigado, {nome}! Nham!'],
  roubou: ['Hehe, roubei!', 'Essa agora é minha!', 'Obrigado, {nome}! kkk', 'Nham! Era sua?'],
  bateu: ['Ai, meu rabo!', 'Ai! Encolhi!', 'Isso doeu!', 'Quem botou isso aqui?'],
  zoou: ['Sai da frente!', 'Hahaha!', 'Volta aqui, {rival}!', 'Toma essa!'],
  turbo: ['Turbooo!', 'Uhuul, que velocidade!', 'Segura que lá vou eu!', 'Vrummm!'],
  mega: ['Agora eu sou gigante!', 'Tremei, arena!', 'Olha o tamanho disso!'],
  lider: ['Sou a maior!', 'Olha meu tamanho!', 'Primeiro lugar, bebê!'],
  socorro: ['Socorro, equipe {time}! Comenta {num}!', 'Tô pequenininha! Comenta {num}!', 'Me ajuda! Comenta {num}!'],
  venceu: ['Ganhei!', 'Eu sou a maior!', 'É campeão!'],
  chegou: ['Cheguei!', 'Abram alas pra equipe {time}!', 'Cheguei pra ganhar!'],
  dourada: ['Ouro! Ouro!', 'Fruta dourada é minha!'],
  estrela: ['Peguei a estrela!', 'Agora ninguém me pega!'],
};
const COM_VOZ = new Set(['turbo', 'mega', 'socorro', 'venceu', 'comeuNome', 'lider', 'chegou', 'dourada']);
const ultimaFala = {};
function narrar(tipo, vars = {}, opcoes = {}) { Voz.falar(FALAS[tipo], vars, opcoes); }
function narrarComCalma(tipo, segundos, vars = {}) {
  if (agora() - (ultimaFala[tipo] || -99) < segundos) return;
  ultimaFala[tipo] = agora();
  narrar(tipo, vars);
}
let ultimaVozCobra = 0;
function preencher(frase, vars) { return frase.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? ''); }
function falarCobra(c, tipo, vars = {}, { forcarVoz = false } = {}) {
  const rival = sortear(cobras.filter(o => o !== c))?.t.nome || 'galera';
  const frase = sortearNovo(FALAS_COBRA[tipo]);
  vars = { time: c.t.nome, num: c.ti + 1, rival, ...vars };
  c.fala = { texto: preencher(frase, { ...vars, nome: cortar(vars.nome || '', 14) }), ate: agora() + 3.2 };
  if (!CONFIG.vozDasCobras || !COM_VOZ.has(tipo)) return;
  if (!forcarVoz && (agora() - ultimaVozCobra < 7 || Voz.falando)) return;
  ultimaVozCobra = agora();
  Voz.falar(frase, vars, { tom: 1.55 });
}
// Agradece TODO presente, até a rosa. Vai com prioridade na fila da voz (nunca é descartado).
function agradecer(j, ev, time, tipo) {
  const qtd = ev.qtd || 1;
  const rosa = /rosa|rose/i.test(ev.presente || '');
  const chave = tipo === 'mega' ? 'presenteGrande' : tipo === 'depois' ? 'presenteDepois' : rosa ? (qtd > 1 ? 'presenteRosas' : 'presenteRosa') : 'presente';
  narrar(chave, { nome: j.nome, presente: ev.presente, qtd, time }, { prioridade: true });
}
Ranking.aoMudarLider(p => narrar('apoiador', { nome: p.nome }));

// ---------- Jogadores e placar ----------
const jogadores = new Map();
function registrar(ev, ti = null) {
  let j = jogadores.get(ev.id);
  if (!j) { j = { id: ev.id, nome: ev.nome, time: ti, ultimaComida: 0, ativoEm: agora() }; jogadores.set(ev.id, j); }
  j.nome = ev.nome; j.ativoEm = agora();
  // Quem não disse o time vai para o time da arena com menos gente
  if (j.time == null) j.time = ti ?? timeMenor();
  return j;
}
function timeMenor() {
  const n = new Map(cobras.map(c => [c.ti, 0]));
  for (const j of jogadores.values()) if (n.has(j.time)) n.set(j.time, n.get(j.time) + 1);
  return [...n.entries()].sort((a, b) => a[1] - b[1])[0]?.[0] ?? 0;
}
const contarTime = ti => { let n = 0; for (const j of jogadores.values()) if (j.time === ti) n++; return n; };

const hoje = () => new Date().toISOString().slice(0, 10);
const nomesEquipes = TIMES_TODOS.map(t => t.nome).join('|'); // placar zera se as equipes mudarem
function carregarPlacar() {
  try {
    const p = JSON.parse(localStorage.getItem('cobrinha-placar'));
    if (p && p.dia === hoje() && p.equipes === nomesEquipes) return p;
  } catch { /* sem placar salvo */ }
  return { dia: hoje(), equipes: nomesEquipes, times: TIMES_TODOS.map(() => 0), rodadas: 0 };
}
const placar = carregarPlacar();
const salvarPlacar = () => { try { localStorage.setItem('cobrinha-placar', JSON.stringify(placar)); } catch { /* ignora */ } };

// Quem mais alimentou cada time nesta rodada
let ajuda = {};
function creditar(ti, id, nome, pontos) {
  if (ti == null || !id) return;
  const a = (ajuda[ti] ||= {})[id] ||= { nome, pontos: 0 };
  a.nome = nome; a.pontos += pontos;
}

// ---------- Rodada ----------
let estado = 'preparo', tEstado = 0, ultimoBip = 0;
let liderAtual = null, liderDesde = 0, avisouFinal = false, chamouEm = 0, avisouEncolher = false;
let vencedor = null, bonusProxima = new Map();
let modo = MODOS[0], tema = TEMAS[0], sacolaModos = [], proximoEvento = 0, frenesiAte = 0, ultimaDourada = 0;

function sortearModo() {
  if (!sacolaModos.length) sacolaModos = embaralhar([...MODOS, MODOS[0]]);
  let m = sacolaModos.pop();
  if (m === modo && sacolaModos.length) { sacolaModos.unshift(m); m = sacolaModos.pop(); }
  return m;
}
// Times da rodada: quem tem gente ativa no chat (e quem ganhou bônus de presente) primeiro; completa com sorteados
function escolherTimes() {
  const pontos = new Map();
  for (const j of jogadores.values()) if (j.time != null && agora() - j.ativoEm < 300) pontos.set(j.time, (pontos.get(j.time) || 0) + 1);
  for (const ti of bonusProxima.keys()) pontos.set(ti, (pontos.get(ti) || 0) + 1000);
  const lista = [...pontos.entries()].sort((a, b) => b[1] - a[1]).map(e => e[0]).slice(0, CONFIG.maxCobras);
  const resto = embaralhar(TIMES_TODOS.map((_, i) => i).filter(i => !lista.includes(i)));
  while (lista.length < CONFIG.minCobras && resto.length) lista.push(resto.shift());
  return lista;
}

function novaRodada() {
  estado = 'preparo'; tEstado = CONFIG.tempoPreparo; ultimoBip = 4;
  placar.rodadas = (placar.rodadas || 0) + 1;
  modo = sortearModo();
  tema = sortear(TEMAS.filter(x => x !== tema));
  lim.x = AX; lim.z = AZ; posicionarMuretas();
  ajuda = {};
  for (const f of [...comidas]) removerComida(f);
  limparMinas();
  for (const c of [...cobras]) tirarDaArena(c);
  const lista = escolherTimes();
  lista.forEach((ti, i) => {
    const c = colocarNaArena(ti);
    c.tam = (modo.id === 'gigantes' ? 28 : CONFIG.tamanhoInicial) + (bonusProxima.get(ti) || 0);
    const a = (i / lista.length) * Math.PI * 2 + rnd(-0.2, 0.2);
    colocar(c, Math.cos(a) * lim.x * 0.6, Math.sin(a) * lim.z * 0.6, a + Math.PI / 2);
  });
  bonusProxima = new Map();
  aplicarCenario(tema, modo.id === 'noite');
  chuvaDeComida(18 + cobras.length * 2);
  if (modo.id === 'minado') for (let i = 0; i < 6; i++) minas.push(criarMina());
  liderAtual = null; avisouFinal = false; avisouEncolher = false; vencedor = null; frenesiAte = 0;
  Som.energia(0.45);
  narrar('novaRodada', { n: placar.rodadas, modo: modo.nome, desc: modo.desc });
}
function comecarJogo() {
  estado = 'jogando'; tEstado = CONFIG.tempoRodada * (modo.id === 'turbo' ? 0.75 : 1);
  proximoEvento = agora() + rnd(15, 22);
  ultimaDourada = agora();
  Som.bip(true); Som.energia(0.65);
  narrar('largada');
}
function terminarRodada() {
  estado = 'resultado'; tEstado = CONFIG.tempoResultado;
  const v = [...cobras].sort((a, b) => b.tam - a.tam)[0];
  placar.times[v.ti]++; salvarPlacar();
  const top = Object.values(ajuda[v.ti] || {}).sort((a, b) => b.pontos - a.pontos).slice(0, 3);
  vencedor = { cobra: v, tam: v.tam, ajudantes: top };
  Som.vitoria(); Som.energia(0.4);
  explosao(v.x, v.z, v.t.ui, 60, 10);
  falarCobra(v, 'venceu', {}, { forcarVoz: true });
  narrar('vencedor', { time: v.t.nome, tam: v.tam }, { prioridade: true });
}

// Time novo chegando no meio da rodada (se tiver vaga)
function entrarNaArena(ti) {
  if (estado === 'resultado' || cobras.length >= CONFIG.maxCobras) return null;
  const c = colocarNaArena(ti);
  if (modo.id === 'gigantes') c.tam = 20;
  const p = lugarLivre();
  colocar(c, p.x, p.z, Math.atan2(-p.z, -p.x));
  explosao(p.x, p.z, c.t.ui, 40, 8);
  Som.entrar();
  aviso(`🐍 Chegou o ${c.t.nome}!`, c.t.ui);
  falarCobra(c, 'chegou');
  narrarComCalma('chegouTime', 6, { time: c.t.nome });
  pintarTorcida(cobras.flatMap(o => [o.t.cor, o.t.faixa, o.t.ui]));
  return c;
}

// Eventos surpresa no meio da rodada (para nada ficar repetitivo)
function eventoSurpresa() {
  const opcoes = ['dourada', 'estrela', 'chuva', 'frenesi'].filter(e => !(e === 'dourada' && modo.id === 'dourada'));
  const e = sortear(opcoes);
  if (e === 'dourada') { const p = lugarLivre(0.7); soltarComida(p.x, p.z, { valor: 8, tipo: 'dourada', cor: '#ffd23f' }); bannerGrande('🌟 FRUTA DOURADA!', 'Vale 8 pedaços! Quem pega?'); narrar('eventoDourada'); }
  if (e === 'estrela') { const p = lugarLivre(0.7); soltarComida(p.x, p.z, { valor: 2, tipo: 'estrela', cor: '#ffd23f' }); bannerGrande('⭐ ESTRELA!', 'Quem pegar ganha TURBO + ESCUDO'); narrar('eventoEstrela'); }
  if (e === 'chuva') { chuvaDeComida(30); bannerGrande('🌧️ CHUVA DE COMIDA!', 'Comida pra todo lado!'); narrar('eventoChuva'); }
  if (e === 'frenesi') { frenesiAte = agora() + 6; bannerGrande('⚡ FRENESI!', 'Todo mundo rápido por 6 segundos!'); narrar('eventoFrenesi'); Som.turbo(); }
}

function atualizar(dt, t) {
  tEstado -= dt;
  if (estado === 'preparo') {
    const s = Math.ceil(tEstado);
    if (s < ultimoBip && s > 0) { ultimoBip = s; Som.bip(false); }
    if (tEstado <= 0) comecarJogo();
  } else if (estado === 'jogando') {
    for (const c of cobras) {
      if (t > c.pensarEm) { c.pensarEm = t + 0.25; pensar(c); }
      moverCobra(c, dt, t);
    }
    colisoes(t);
    comer(t);
    // Sempre tem comida no chão para as cobras não ficarem paradas
    if (comidas.filter(f => f.tipo !== 'nome').length < 14 + cobras.length && Math.random() < dt * 4) soltarComida(rnd(-lim.x, lim.x), rnd(-lim.z, lim.z));
    // Modo Frutas Douradas: uma fruta dourada a cada 10s
    if (modo.id === 'dourada' && t - ultimaDourada > 10 && comidas.filter(f => f.tipo === 'dourada').length < 2) {
      ultimaDourada = t;
      const p = lugarLivre(0.7);
      soltarComida(p.x, p.z, { valor: 8, tipo: 'dourada', cor: '#ffd23f' });
      aviso('🌟 Nova fruta dourada!', '#ffd23f');
    }
    // Modo Campo Minado: bombas trocam de lugar de vez em quando
    if (modo.id === 'minado' && Math.random() < dt / 6) moverMina(sortear(minas));
    // Modo Arena Encolhendo: nos últimos 45s as paredes fecham
    if (modo.id === 'encolhe' && tEstado < 45) {
      if (!avisouEncolher) { avisouEncolher = true; bannerGrande('🧱 A ARENA TÁ FECHANDO!', 'Cuidado com as paredes!'); narrar('encolhendo'); }
      const f = 0.55 + 0.45 * Math.max(0, tEstado / 45);
      lim.x = AX * f; lim.z = AZ * f;
      posicionarMuretas();
      for (const fo of comidas) { fo.x = limitar(fo.x, -lim.x + 0.8, lim.x - 0.8); fo.z = limitar(fo.z, -lim.z + 0.8, lim.z - 0.8); }
    }
    if (t > proximoEvento && tEstado > 15) { proximoEvento = t + rnd(18, 28); eventoSurpresa(); }
    // Liderança
    const lider = [...cobras].sort((a, b) => b.tam - a.tam)[0];
    if (lider !== liderAtual) { liderAtual = lider; liderDesde = t; }
    else if (t - liderDesde > 2 && liderAtual.anunciado !== liderDesde && CONFIG.tempoRodada - tEstado > 10) {
      liderAtual.anunciado = liderDesde;
      falarCobra(liderAtual, 'lider');
      narrarComCalma('lider', 12, { time: liderAtual.t.nome });
    }
    // Papo das cobras e a menor pedindo ajuda à torcida
    for (const c of cobras) {
      if (t < c.proximoPapo) continue;
      c.proximoPapo = t + rnd(10, 18);
      const menor = [...cobras].sort((a, b) => a.tam - b.tam)[0];
      if (c === menor && t - chamouEm > 25) { chamouEm = t; falarCobra(c, 'socorro'); narrarComCalma('chamar', 30, { time: c.t.nome, num: c.ti + 1 }); }
      else falarCobra(c, 'papo');
    }
    if (tEstado <= 20 && !avisouFinal) { avisouFinal = true; narrar('final'); Som.energia(0.95); }
    if (tEstado <= 5 && Math.ceil(tEstado) < ultimoBip) { ultimoBip = Math.ceil(tEstado); Som.bip(false); }
    if (tEstado > 5) ultimoBip = 6;
    if (tEstado <= 0) terminarRodada();
  } else if (estado === 'resultado') {
    if (tEstado <= 0) novaRodada();
  }
  for (const m of minas) {
    m.g.position.set(m.x, 0.85 + Math.sin(t * 2 + m.x) * 0.1, m.z);
    m.g.rotation.y = t * 0.6;
  }
  matLuzMina.userData.brilho.value = Math.sin(t * 8) > 0 ? 2 : 0.3;
  avisos.forEach(a => a.vida -= dt);
  avisos = avisos.filter(a => a.vida > 0);
  if (banner) { banner.vida -= dt; if (banner.vida <= 0) banner = null; }
  flutuantes.forEach(f => f.vida -= dt);
  flutuantes = flutuantes.filter(f => f.vida > 0);
  tremor = Math.max(0, tremor - dt * 1.5);
}

// ---------- Eventos da live ----------
let curtidasTotal = 0, curtidasSobra = 0, ultimaEspera = 0;
const ativo = () => estado !== 'resultado';
const nomeTime = ti => TIMES_TODOS[ti].nome;

Live.on('chat', ev => {
  const ti = acharEquipe(ev.texto);
  const novo = !jogadores.has(ev.id);
  const antes = jogadores.get(ev.id)?.time;
  const j = registrar(ev, ti);
  if (ti != null && !novo && antes !== ti) { j.time = ti; aviso(`🔁 ${cortar(j.nome, 14)} foi pra ${TIMES_TODOS[ti].emoji} ${nomeTime(ti)}`, TIMES_TODOS[ti].ui); }
  else if (novo) {
    aviso(`👋 ${cortar(j.nome, 14)} entrou: ${TIMES_TODOS[j.time].emoji} ${nomeTime(j.time)}`, TIMES_TODOS[j.time].ui);
    narrarComCalma('entrou', 6, { nome: j.nome, time: nomeTime(j.time) });
    Som.entrar();
  }
  let c = cobraDoTime(j.time);
  if (!c) c = entrarNaArena(j.time);
  if (!c) {
    if (agora() - ultimaEspera > 4) { ultimaEspera = agora(); aviso(`⏳ Equipe ${nomeTime(j.time)} entra na próxima rodada!`, TIMES_TODOS[j.time].ui); }
    return;
  }
  // Cada comentário solta uma comida com o nome da pessoa perto da cobra do time (no máximo 1 a cada 2,5s por pessoa)
  if (!ativo() || agora() - j.ultimaComida < 2.5) return;
  j.ultimaComida = agora();
  const a = c.ang + rnd(-0.8, 0.8), d = rnd(3, 6);
  soltarComida(c.x + Math.cos(a) * d, c.z + Math.sin(a) * d, { valor: 2, tipo: 'nome', nome: j.nome, dono: j.id, time: j.time, cor: TIMES_TODOS[j.time].ui });
});

Live.on('like', ev => {
  const antes = curtidasTotal;
  curtidasTotal += ev.qtd || 1;
  curtidasSobra += ev.qtd || 1;
  const c = cobraDoTime(jogadores.get(ev.id)?.time);
  while (curtidasSobra >= CONFIG.curtidasPorComida) {
    curtidasSobra -= CONFIG.curtidasPorComida;
    if (!ativo()) continue;
    if (c) soltarPerto(c.x, c.z, 7, { valor: 1, tipo: 'curtida', cor: '#ff5fa2' });
    else soltarComida(rnd(-lim.x, lim.x), rnd(-lim.z, lim.z), { valor: 1, tipo: 'curtida', cor: '#ff5fa2' });
  }
  const meta = CONFIG.metaCurtidas;
  if (Math.floor(curtidasTotal / meta) > Math.floor(antes / meta)) {
    const n = Math.floor(curtidasTotal / meta) * meta;
    if (ativo()) chuvaDeComida(30);
    bannerGrande(`❤️ ${n} CURTIDAS!`, 'Chuva de comida na arena!');
    narrar('curtidas', { n });
  }
});

Live.on('gift', ev => {
  const j = registrar(ev);
  const t = agora();
  const d = ev.diamantes || 1;
  const nomePresente = (ev.qtd > 1 ? ev.qtd + 'x ' : '') + ev.presente;
  const emoji = /rosa|rose/i.test(ev.presente || '') ? '🌹' : '🎁';
  const mega = d >= CONFIG.diamantesMega;
  const ganho = mega ? 20 + Math.min(40, Math.round(d / 50)) : 3 + Math.min(12, d);
  creditar(j.time, j.id, j.nome, ganho);
  Som.moeda();
  const c = cobraDoTime(j.time) || entrarNaArena(j.time);
  if (!c || estado === 'resultado') {
    bonusProxima.set(j.time, (bonusProxima.get(j.time) || 0) + ganho);
    aviso(`${emoji} Valeu, ${cortar(j.nome, 12)}! Equipe ${nomeTime(j.time)} começa a próxima maior!`, '#ffd23f');
    agradecer(j, ev, nomeTime(j.time), 'depois');
    return;
  }
  crescer(c, ganho);
  if (mega) {
    c.turboAte = Math.max(c.turboAte, t) + 8;
    c.escudoAte = Math.max(c.escudoAte, t) + 12;
    chuvaDeComida(25, c.x, c.z, 8);
    explosao(c.x, c.z, '#ffd23f', 60, 10);
    tremor = 1;
    Som.teleporte();
    bannerGrande(`💎 ${cortar(j.nome, 16)}`, `${nomePresente}: MEGA COBRA pro ${c.t.nome}!`);
    falarCobra(c, 'mega', {}, { forcarVoz: true });
    agradecer(j, ev, c.t.nome, 'mega');
  } else {
    c.turboAte = Math.max(c.turboAte, t) + 5;
    explosao(c.x, c.z, '#ffd23f', 20, 6);
    Som.turbo();
    if (d >= 10) bannerGrande(`${emoji} ${cortar(j.nome, 16)}`, `${nomePresente}: TURBO no ${c.t.nome}!`);
    else aviso(`${emoji} Valeu, ${cortar(j.nome, 12)}! TURBO no ${c.t.nome}`, '#ffd23f');
    falarCobra(c, 'turbo');
    agradecer(j, ev, c.t.nome, 'turbo');
  }
  flutuar(c.x, c.z, `+${ganho}`, '#ffd23f');
});

Live.on('follow', ev => {
  const j = registrar(ev);
  const c = cobraDoTime(j.time);
  if (c && ativo()) crescer(c, 3);
  aviso(`➕ ${cortar(j.nome, 14)} seguiu! +3 pra ${nomeTime(j.time)}`, '#5ad8ff');
  narrar('seguiu', { nome: j.nome });
});
Live.on('share', ev => {
  const j = registrar(ev);
  const c = cobraDoTime(j.time);
  if (c && ativo()) crescer(c, 3);
  aviso(`↗️ ${cortar(j.nome, 14)} compartilhou! +3 pra ${nomeTime(j.time)}`, '#5ad8ff');
  narrar('compartilhou', { nome: j.nome });
});
let ultimoOi = 0;
Live.on('join', ev => {
  if (agora() - ultimoOi < 5) return;
  ultimoOi = agora();
  aviso(`👋 ${cortar(ev.nome, 14)} chegou! Comente o número da sua equipe`, '#aaaaaa');
});

// ---------- HUD (desenho 2D por cima do 3D) ----------
const hud = document.getElementById('hud');
hud.width = W; hud.height = H;
const c2 = hud.getContext('2d');
let avisos = [], banner = null, flutuantes = [];
function aviso(texto, cor = '#fff') { avisos.unshift({ texto, cor, vida: 5 }); avisos.length = Math.min(avisos.length, 4); }
function bannerGrande(titulo, sub) { banner = { titulo, sub, vida: 3.5 }; }
function flutuar(x, z, texto, cor) { flutuantes.push({ x, z, texto, cor, vida: 1.4 }); }
function cortar(str, max) { str = String(str || ''); return str.length > max ? str.slice(0, max - 1) + '…' : str; }

function texto(str, x, y, { tam = 40, cor = '#fff', alinhar = 'left', peso = 800, contorno = 6 } = {}) {
  c2.font = `${Math.min(peso, 700)} ${tam}px Fredoka, "Segoe UI Emoji", sans-serif`;
  c2.textAlign = alinhar; c2.textBaseline = 'middle';
  if (contorno) { c2.lineWidth = contorno; c2.strokeStyle = '#000a'; c2.lineJoin = 'round'; c2.strokeText(str, x, y); }
  c2.fillStyle = cor; c2.fillText(str, x, y);
}
function caixa(x, y, w, h, r, cor) { c2.beginPath(); c2.roundRect(x, y, w, h, r); c2.fillStyle = cor; c2.fill(); }
const vTela = new THREE.Vector3();
function naTela(x, y, z) {
  vTela.set(x, y, z).project(camera);
  return { x: (vTela.x + 1) / 2 * W, y: (1 - vTela.y) / 2 * H };
}
function mmss(s) { s = Math.max(0, Math.ceil(s)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; }
const listaTimes = (de, ate) => TIMES_TODOS.slice(de, ate).map((t, i) => `${de + i + 1} ${t.sigla}`).join('  ·  ');
const VARIAS_LINHAS = TIMES_TODOS.length > 7;

function desenharHUD(t) {
  c2.clearRect(0, 0, W, H);
  const g = c2.createLinearGradient(0, 0, 0, 545);
  g.addColorStop(0, '#0a0620f2'); g.addColorStop(0.85, '#0a0620c8'); g.addColorStop(1, '#0a062000');
  c2.fillStyle = g; c2.fillRect(0, 0, W, 545);

  // Nomes das comidas, cobras e balões (presos nas coisas do 3D)
  const mundo = estado !== 'resultado';
  const lider = [...cobras].sort((a, b) => b.tam - a.tam)[0];
  if (mundo) {
    for (const f of comidas) {
      if (f.tipo !== 'nome') continue;
      const p = naTela(f.x, 1.3, f.z);
      texto(cortar(f.nome, 12), p.x, p.y, { tam: 22, alinhar: 'center', cor: TIMES_TODOS[f.time].ui, contorno: 5, peso: 700 });
    }
    for (const c of cobras) {
      const p = naTela(c.x, raioCabeca(c) * 2 + 1.2, c.z);
      c2.drawImage(c.t.escudo, p.x - 30, p.y - 72, 60, 60);
      texto(`${c.tam}`, p.x, p.y, { tam: 30, alinhar: 'center', cor: '#fff', contorno: 6 });
      if (c === lider && estado !== 'preparo') texto('👑', p.x, p.y - 98, { tam: 40, alinhar: 'center', contorno: 0 });
      if (t < c.turboAte || t < frenesiAte) texto('⚡', p.x + 44, p.y - 44, { tam: 34, alinhar: 'center', contorno: 0 });
      if (t < c.escudoAte) texto('🛡️', p.x - 46, p.y - 44, { tam: 30, alinhar: 'center', contorno: 0 });
      if (c.fala && t < c.fala.ate) desenharBalao(p.x, p.y - (c === lider ? 128 : 92), c.fala.texto, c.t.ui);
    }
    for (const f of flutuantes) {
      const p = naTela(f.x, 2 + (1.4 - f.vida) * 3, f.z);
      c2.globalAlpha = Math.min(1, f.vida * 2);
      texto(f.texto, p.x, p.y, { tam: 30, alinhar: 'center', cor: f.cor, contorno: 6 });
      c2.globalAlpha = 1;
    }
  }

  // Topo: título, tempo, modo da rodada e meta de curtidas
  texto('🐍 COBRINHA ARENA', 30, 168, { tam: 42 });
  const tempo = estado === 'preparo' ? `COMEÇA EM ${Math.max(1, Math.ceil(tEstado))}` : estado === 'jogando' ? `⏱ ${mmss(tEstado)}` : 'FIM!';
  texto(tempo, W - 30, 168, { tam: 38, alinhar: 'right', cor: estado === 'jogando' && tEstado <= 20 ? '#ff5f5f' : '#ffd23f' });
  texto(`${modo.emoji} ${modo.nome.toUpperCase()}`, 30, 212, { tam: 24, cor: '#7fe8ff', contorno: 0, peso: 800 });
  const meta = CONFIG.metaCurtidas, faltam = curtidasTotal % meta;
  const bw = 230, bx = W - 30 - bw;
  caixa(bx, 200, bw, 24, 12, '#ffffff22');
  caixa(bx, 200, Math.max(24, bw * faltam / meta), 24, 12, '#ff5fa2');
  texto(`❤️ ${faltam}/${meta}`, bx + bw / 2, 213, { tam: 18, alinhar: 'center', contorno: 3, peso: 800 });

  // Placas dos times na arena (até 6, em 2 linhas de 3)
  const largura = 340, gap = 8, x0 = (W - (largura * 3 + gap * 2)) / 2;
  cobras.forEach((c, i) => {
    const x = x0 + (i % 3) * (largura + gap), y = 236 + Math.floor(i / 3) * 88;
    caixa(x, y, largura, 80, 16, '#000000b8');
    if (c === lider && estado !== 'preparo') { c2.lineWidth = 4; c2.strokeStyle = '#ffd23f'; c2.beginPath(); c2.roundRect(x, y, largura, 80, 16); c2.stroke(); }
    c2.drawImage(c.t.escudo, x + 6, y + 6, 58, 58);
    c2.beginPath(); c2.arc(x + 17, y + 64, 14, 0, Math.PI * 2); c2.fillStyle = '#ffd23f'; c2.fill();
    texto(`${c.ti + 1}`, x + 17, y + 65, { tam: c.ti >= 9 ? 15 : 19, alinhar: 'center', cor: '#000', contorno: 0, peso: 900 });
    texto(cortar(c.t.nome, 15), x + 72, y + 22, { tam: 24, cor: c.t.ui, contorno: 0, peso: 800 });
    texto(`🐍 ${c.tam}`, x + 72, y + 56, { tam: 30, contorno: 0, peso: 900 });
    texto(`👥${contarTime(c.ti)}`, x + largura - 10, y + 56, { tam: 19, alinhar: 'right', contorno: 0, peso: 600, cor: '#ccc' });
    if (placar.times[c.ti]) texto(`🏆${placar.times[c.ti]}`, x + largura - 10, y + 22, { tam: 19, alinhar: 'right', contorno: 0, peso: 600, cor: '#ffd23f' });
  });

  // Linha que vai alternando: como entrar (lista das equipes) e o que curtida/presente fazem
  const vez = Math.floor(t / 5) % (VARIAS_LINHAS ? 3 : 2);
  if (vez < (VARIAS_LINHAS ? 2 : 1)) {
    texto('💬 COMENTE O NÚMERO DA SUA EQUIPE', W / 2, 432, { tam: 34, alinhar: 'center', cor: '#ffd23f' });
    texto(vez === 0 ? listaTimes(0, 7) : listaTimes(7, 14), W / 2, 468, { tam: 22, alinhar: 'center', peso: 700, contorno: 4, cor: '#e8e8ff' });
  } else {
    texto('❤️ curtir = comida   🎁 presente = TURBO', W / 2, 432, { tam: 29, alinhar: 'center', peso: 700, contorno: 4 });
    texto(`💎 presentão = MEGA COBRA   🎯 ${meta} curtidas = CHUVA DE COMIDA`, W / 2, 468, { tam: 22, alinhar: 'center', peso: 700, contorno: 4, cor: '#e8e8ff' });
  }

  // Ranking de apoiadores numa faixa só
  const top = Ranking.top(3);
  if (top.length) {
    const med = ['👑', '🥈', '🥉'];
    const linha = '🎁 TOP APOIADORES:  ' + top.map((p, i) => `${med[i]} ${cortar(p.nome, 10)} ${p.diamantes}💎`).join('   ');
    c2.font = '700 23px Fredoka, "Segoe UI Emoji"';
    const w = Math.min(W - 40, c2.measureText(linha).width + 40);
    caixa((W - w) / 2, 490, w, 42, 21, '#000000b0');
    texto(linha, W / 2, 512, { tam: 23, alinhar: 'center', cor: '#ffe680', contorno: 0, peso: 700 });
  }

  // Avisos (canto esquerdo, em cima da arena)
  if (mundo) avisos.forEach((a, i) => {
    c2.globalAlpha = Math.min(1, a.vida);
    const y = 572 + i * 46;
    c2.font = '700 24px Fredoka, "Segoe UI Emoji"';
    const w = c2.measureText(a.texto).width + 28;
    caixa(20, y - 20, w, 40, 20, '#000000aa');
    texto(a.texto, 34, y, { tam: 24, cor: a.cor, contorno: 0, peso: 700 });
    c2.globalAlpha = 1;
  });

  if (estado === 'preparo') desenharApresentacao();
  if (banner) {
    c2.globalAlpha = Math.min(1, banner.vida * 2);
    const s = 1 + Math.max(0, banner.vida - 3) * 0.6;
    c2.save(); c2.translate(W / 2, 800); c2.scale(s, s);
    const gb = c2.createLinearGradient(-480, 0, 480, 0);
    gb.addColorStop(0, '#ff3d8bee'); gb.addColorStop(1, '#7b2cffee');
    caixa(-480, -80, 960, 160, 30, gb);
    texto(banner.titulo, 0, -28, { tam: 50, alinhar: 'center' });
    texto(banner.sub, 0, 36, { tam: 30, alinhar: 'center', cor: '#ffe680', peso: 700 });
    c2.restore(); c2.globalAlpha = 1;
  }
  if (estado === 'resultado' && vencedor) desenharResultado();
}

// Cartão do começo da rodada: número, modo, cenário e contagem
function desenharApresentacao() {
  const entrada = Math.min(1, (CONFIG.tempoPreparo - tEstado) * 3);
  c2.save();
  c2.globalAlpha = entrada;
  caixa(90, 610, W - 180, 380, 36, '#000000c8');
  c2.lineWidth = 5; c2.strokeStyle = '#7fe8ff'; c2.beginPath(); c2.roundRect(90, 610, W - 180, 380, 36); c2.stroke();
  texto(`RODADA ${placar.rodadas}`, W / 2, 660, { tam: 34, alinhar: 'center', cor: '#7fe8ff', contorno: 0 });
  texto(`${modo.emoji} ${modo.nome.toUpperCase()}`, W / 2, 730, { tam: 58, alinhar: 'center', cor: '#ffd23f' });
  texto(modo.desc, W / 2, 795, { tam: 34, alinhar: 'center', peso: 700 });
  texto(`Cenário: ${tema.nome}`, W / 2, 845, { tam: 26, alinhar: 'center', cor: '#bbb', peso: 600, contorno: 0 });
  texto(`${Math.max(1, Math.ceil(tEstado))}`, W / 2, 930, { tam: 90, alinhar: 'center', cor: '#fff', contorno: 10 });
  c2.restore();
  Marca.desenhar(c2, W / 2, 1060, 32);
}

function desenharBalao(x, y, str, cor) {
  c2.font = '700 26px Fredoka, "Segoe UI Emoji"';
  const w = Math.min(440, c2.measureText(str).width + 32), h = 50;
  const bx = limitar(x - w / 2, 10, W - w - 10);
  // Perto do topo o balão vai para baixo da cobra, para não cobrir o placar
  const embaixo = y - h < 545;
  const by = embaixo ? y + 150 : y - h;
  c2.beginPath(); c2.roundRect(bx, by, w, h, 18);
  if (embaixo) { c2.moveTo(x - 10, by); c2.lineTo(x, by - 14); c2.lineTo(x + 10, by); }
  else { c2.moveTo(x - 10, by + h); c2.lineTo(x, by + h + 14); c2.lineTo(x + 10, by + h); }
  c2.fillStyle = '#fff'; c2.fill();
  c2.lineWidth = 4; c2.strokeStyle = cor; c2.stroke();
  texto(str, bx + w / 2, by + h / 2 + 1, { tam: 26, alinhar: 'center', cor: '#111', contorno: 0 });
}

function desenharResultado() {
  const v = vencedor.cobra;
  c2.fillStyle = '#000000c8'; c2.fillRect(0, 545, W, 715);
  texto('🏆 MAIOR COBRA DA RODADA', W / 2, 600, { tam: 44, alinhar: 'center', cor: '#ffd23f' });
  c2.drawImage(v.t.escudo, W / 2 - 95, 635, 190, 190);
  texto(`${v.t.nome.toUpperCase()} VENCEU!`, W / 2, 870, { tam: 62, alinhar: 'center', cor: v.t.ui });
  texto(`🐍 ${vencedor.tam} pedaços`, W / 2, 935, { tam: 38, alinhar: 'center' });
  if (vencedor.ajudantes.length) {
    texto('Quem mais alimentou:', W / 2, 1005, { tam: 30, alinhar: 'center', cor: '#ccc', peso: 600 });
    vencedor.ajudantes.forEach((a, i) => texto(`${['🥇', '🥈', '🥉'][i]} ${cortar(a.nome, 16)}  +${a.pontos}`, W / 2, 1052 + i * 44, { tam: 31, alinhar: 'center' }));
  } else {
    texto('Comente o número da sua equipe na próxima!', W / 2, 1040, { tam: 32, alinhar: 'center', cor: '#ccc', peso: 600 });
  }
  const vitorias = TIMES_TODOS.map((t, i) => [t.emoji || t.sigla, placar.times[i]]).filter(x => x[1]).sort((a, b) => b[1] - a[1]).slice(0, 6);
  texto(`Vitórias hoje: ${vitorias.map(([s, n]) => `${s} ${n}`).join(' · ')}`, W / 2, 1222, { tam: 27, alinhar: 'center', cor: '#ccc', peso: 600 });
}

// ---------- Laço principal ----------
let anterior = agora();
function quadro() {
  const t = agora();
  const dt = Math.min(0.05, t - anterior);
  anterior = t;
  atualizar(dt, t);
  for (const c of cobras) desenharCobra(c, t);
  desenharComidas(t);
  atualizarParticulas(dt);
  // Câmera balança de leve para a cena parecer viva (e treme nas explosões)
  camera.position.set(CAM_POS.x + Math.sin(t * 0.2) * 1.5 + rnd(-1, 1) * tremor, CAM_POS.y + rnd(-1, 1) * tremor, CAM_POS.z);
  camera.lookAt(CAM_ALVO);
  if (CONFIG.brilhoNeon) composer.render(); else renderer.render(cena, camera);
  desenharHUD(t);
  requestAnimationFrame(quadro);
}

posicionarMuretas();
novaRodada();
requestAnimationFrame(quadro);

aoComecar(() => Som.musica({ bpm: 118, energia: 0.45 }));

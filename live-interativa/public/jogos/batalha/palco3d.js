// Batalha: o palco 3D (estádio à noite + dois bonecos estilo action figure).
// O jogo (batalha.js) só chama: acao(), chutar(), definirDono(), atualizar(), render() e naTela().
// Os bonecos são genéricos: camisa, cor e número vindos das 2 primeiras equipes do painel.
// Rosto de boneco, sem imitar ninguém e sem escudo oficial.
import * as THREE from 'three';
import { RoomEnvironment } from '/lib/jsm/environments/RoomEnvironment.js';
import { EffectComposer } from '/lib/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from '/lib/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from '/lib/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from '/lib/jsm/postprocessing/OutputPass.js';
import { visual, canvasTex, criarBoneco, sombra, pose, aplicar, lerp } from '/shared/boneco3d.js';

const W = 1080, H = 1920;
const LADOS = EQUIPES.slice(0, 2).map(visual);

// ---------- Renderizador ----------
const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('mundo'), antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setSize(W, H, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const cena = new THREE.Scene();
cena.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
cena.environmentIntensity = 0.35;
cena.fog = new THREE.Fog(0x0b1634, 26, 80);

const camera = new THREE.PerspectiveCamera(36, W / H, 0.1, 200);
const ALVO_Y = 0.73; // para onde a câmera olha: deixa os bonecos no meio da área segura da tela
camera.position.set(0, 1.2, 7.6);
camera.lookAt(0, ALVO_Y, 0);

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(cena, camera));
composer.addPass(new UnrealBloomPass(new THREE.Vector2(W / 2, H / 2), 0.7, 0.5, 2.2)); // só brilha o que é muito forte (refletores e fogo)
composer.addPass(new OutputPass());

// ---------- Texturas desenhadas ----------
cena.background = canvasTex(4, 512, (g, w, h) => {
  const gr = g.createLinearGradient(0, 0, 0, h);
  gr.addColorStop(0, '#02040d'); gr.addColorStop(0.55, '#0a1430'); gr.addColorStop(1, '#1d3166');
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
});

const texBola = canvasTex(512, 256, (g, w, h) => {
  g.fillStyle = '#f7f7f7'; g.fillRect(0, 0, w, h);
  g.fillStyle = '#1a1a1a';
  for (let i = 0; i < 12; i++) {
    const x = (i % 6) * w / 6 + (i < 6 ? 0 : w / 12), y = i < 6 ? h * 0.3 : h * 0.72;
    g.beginPath();
    for (let k = 0; k < 5; k++) { const a = k * Math.PI * 2 / 5 - Math.PI / 2; g.lineTo(x + Math.cos(a) * 26, y + Math.sin(a) * 22); }
    g.fill();
  }
});

// ---------- Estádio ----------
const grama = canvasTex(512, 512, (g, w, h) => {
  for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#2b8a3a' : '#33994a'; g.fillRect(0, i * h / 8, w, h / 8); }
  for (let i = 0; i < 6000; i++) { g.fillStyle = Math.random() < 0.5 ? '#ffffff0c' : '#0000000e'; g.fillRect(Math.random() * w, Math.random() * h, 2, 3); }
}, [6, 6]);
const chao = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), new THREE.MeshStandardMaterial({ map: grama, roughness: 0.95 }));
chao.rotation.x = -Math.PI / 2; chao.receiveShadow = true; cena.add(chao);

const matLinha = new THREE.MeshBasicMaterial({ color: 0xf2f2f2 });
const circulo = new THREE.Mesh(new THREE.RingGeometry(2.6, 2.7, 96), matLinha);
circulo.rotation.x = -Math.PI / 2; circulo.position.y = 0.006; cena.add(circulo);
const meio = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 120), matLinha);
meio.rotation.x = -Math.PI / 2; meio.position.y = 0.006; cena.add(meio);
const ponto = new THREE.Mesh(new THREE.CircleGeometry(0.12, 24), matLinha);
ponto.rotation.x = -Math.PI / 2; ponto.position.y = 0.007; cena.add(ponto);

const torcida = canvasTex(2048, 256, (g, w, h) => {
  g.fillStyle = '#0d1020'; g.fillRect(0, 0, w, h);
  const cores = ['#c8102e', '#f4f7fb', '#6cb4ee', '#ffd23f', '#e86a2a', '#3a4060'];
  for (let y = 4; y < h; y += 6) {
    g.fillStyle = '#ffffff06'; g.fillRect(0, y + 4, w, 1); // degraus
    for (let x = Math.random() * 4; x < w; x += 4 + Math.random() * 3) {
      if (Math.random() < 0.25) continue;
      g.fillStyle = cores[Math.floor(Math.random() * cores.length)];
      g.globalAlpha = 0.15 + Math.random() * 0.35;
      g.beginPath(); g.arc(x, y + 1.5, 1.6, 0, Math.PI * 2); g.fill(); // cabecinhas
      g.fillRect(x - 1.5, y + 2.5, 3, 2);
    }
  }
  g.globalAlpha = 1;
}, [6, 3]);
// arquibancada em três anéis, com faixas de luz entre eles e cobertura em cima
const matTorcida = new THREE.MeshStandardMaterial({ map: torcida, emissiveMap: torcida, emissive: 0xffffff, emissiveIntensity: 0.1, side: THREE.BackSide, roughness: 1 });
const matConcreto = new THREE.MeshStandardMaterial({ color: 0x1b2032, roughness: 0.9, side: THREE.DoubleSide });
const matFaixaLuz = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.5, 1.7, 2.1), side: THREE.BackSide });
const anel = (rBaixo, rCima, h, y, m) => { const a = new THREE.Mesh(new THREE.CylinderGeometry(rCima, rBaixo, h, 160, 1, true), m); a.position.y = y; cena.add(a); };
anel(22, 22, 1.4, 0.7, matConcreto);        // muro do campo
anel(23, 27.5, 6, 4.2, matTorcida);         // anel de baixo
anel(27.5, 27.8, 1.2, 7.8, matConcreto);    // camarote
anel(27.6, 27.6, 0.16, 7.6, matFaixaLuz);
anel(28, 33, 7, 12, matTorcida);            // anel do meio
anel(33, 33.3, 1, 16, matConcreto);
anel(33.1, 33.1, 0.16, 15.6, matFaixaLuz);
anel(33.5, 38.5, 6.5, 19.8, matTorcida);    // anel de cima
const teto = new THREE.Mesh(new THREE.RingGeometry(31, 42, 160), matConcreto);
teto.rotation.x = Math.PI / 2; teto.position.y = 24; cena.add(teto);
anel(31, 31, 0.25, 23.8, matFaixaLuz);      // LED na beira da cobertura

// placas de LED em volta do campo (rolando)
const texPlaca = canvasTex(2048, 64, (g, w, h) => {
  const gr = g.createLinearGradient(0, 0, w, 0);
  gr.addColorStop(0, '#12205c'); gr.addColorStop(0.5, '#5a1a8c'); gr.addColorStop(1, '#12205c');
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
  g.font = '700 40px Fredoka, system-ui'; g.textBaseline = 'middle';
  for (let i = 0; i < 4; i++) {
    g.fillStyle = i % 2 ? '#ffd23f' : '#ffffff';
    g.fillText(i % 2 ? 'COMENTE 1 OU 2' : (Marca.nome || 'LIVE INTERATIVA').toUpperCase().slice(0, 18), 40 + i * 512, h / 2 + 2);
  }
}, [-8, 1]); // negativo: o lado de dentro do cilindro espelharia o texto
const placas = new THREE.Mesh(new THREE.CylinderGeometry(20, 20, 0.9, 160, 1, true), new THREE.MeshBasicMaterial({ map: texPlaca, side: THREE.BackSide, toneMapped: false }));
placas.position.y = 0.45; cena.add(placas);

// refletores na cobertura, com fachos de luz no ar
const matRefletor = new THREE.MeshBasicMaterial({ color: new THREE.Color(9, 9, 8) });
const matFacho = new THREE.MeshBasicMaterial({ color: 0xc8dcff, transparent: true, opacity: 0.018, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
for (const ang of [-2.3, -1.85, -1.3, -0.85]) {
  const pos = new THREE.Vector3(Math.cos(ang) * 33, 25, Math.sin(ang) * 33);
  const painel = new THREE.Mesh(new THREE.BoxGeometry(5, 1.6, 0.3), matRefletor);
  painel.position.copy(pos); painel.lookAt(0, 0, 0); cena.add(painel);
  const alvo = new THREE.Vector3(pos.x * 0.2, 0, pos.z * 0.2 - 4); // fachos caem atrás dos bonecos, longe da câmera
  const dist = pos.distanceTo(alvo);
  const geo = new THREE.CylinderGeometry(4, 1.2, dist, 32, 1, true); geo.rotateX(Math.PI / 2);
  const facho = new THREE.Mesh(geo, matFacho);
  facho.position.copy(pos).lerp(alvo, 0.5); facho.lookAt(alvo); cena.add(facho);
}

// flashes de celular piscando na torcida
const N_FLASH = 500, posFlash = new Float32Array(N_FLASH * 3), corFlash = new Float32Array(N_FLASH * 3);
for (let i = 0; i < N_FLASH; i++) {
  const a = Math.random() * Math.PI * 2, nivel = Math.random();
  const y = nivel < 0.5 ? 1.5 + Math.random() * 5 : 8.8 + Math.random() * 6;
  const r = (y < 7.5 ? 23 + (y - 1.2) / 6 * 4.5 : 28 + (y - 8.5) / 7 * 5) - 0.4;
  posFlash.set([Math.cos(a) * r, y, Math.sin(a) * r], i * 3);
}
const geoFlash = new THREE.BufferGeometry();
geoFlash.setAttribute('position', new THREE.BufferAttribute(posFlash, 3));
geoFlash.setAttribute('color', new THREE.BufferAttribute(corFlash, 3));
cena.add(new THREE.Points(geoFlash, new THREE.PointsMaterial({ size: 0.28, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })));
function piscarFlashes(dt) {
  for (let i = 0; i < corFlash.length; i++) corFlash[i] *= Math.exp(-dt * 9);
  for (let k = 0; k < 4; k++) { const i = Math.floor(Math.random() * N_FLASH) * 3; corFlash[i] = corFlash[i + 1] = corFlash[i + 2] = 6; }
  geoFlash.attributes.color.needsUpdate = true;
}

// ---------- Luzes ----------
cena.add(new THREE.HemisphereLight(0x9fb8ff, 0x1d3a1d, 0.6));
for (const [x, z, int] of [[-7, 9, 1.8], [7, 8, 1.4]]) {
  const s = new THREE.SpotLight(0xfff4e0, int, 0, Math.PI / 7, 0.5, 0);
  s.position.set(x, 13, z); s.target.position.set(0, 0.8, 0);
  s.castShadow = true; s.shadow.mapSize.set(2048, 2048); s.shadow.bias = -0.0002; s.shadow.normalBias = 0.02;
  cena.add(s, s.target);
}
const contraluz = new THREE.DirectionalLight(0x8fb6ff, 1.2);
contraluz.position.set(0, 5, -8); cena.add(contraluz);

const bonecos = LADOS.map(criarBoneco);
bonecos[0].raiz.position.set(-0.6, 0, 0); bonecos[0].raiz.rotation.y = 0.5;
bonecos[1].raiz.position.set(0.6, 0, 0); bonecos[1].raiz.rotation.y = -0.5;
bonecos.forEach(b => cena.add(b.raiz));

const bola = sombra(new THREE.Mesh(new THREE.SphereGeometry(0.11, 32, 20), new THREE.MeshStandardMaterial({ map: texBola, roughness: 0.4 })));
cena.add(bola);
let bolaVoando = null; // { de, vel, t }

// Rastro de fogo do chute
const fogo = [];
const geoFogo = new THREE.SphereGeometry(0.07, 8, 6);
function soltarFogo(pos) {
  const m = new THREE.Mesh(geoFogo, new THREE.MeshBasicMaterial({ color: new THREE.Color().setHSL(0.06 + Math.random() * 0.06, 1, 0.55).multiplyScalar(4), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  m.position.copy(pos); cena.add(m); fogo.push({ m, vida: 0.5 });
}

export function acao(i, nome) {
  if (nome === 'normal') { bonecos.forEach(b => { b.acao = 'normal'; b.tA = 0; }); return; }
  const b = bonecos[i], outro = bonecos[1 - i];
  b.acao = nome; b.tA = 0;
  if (nome === 'comemorar') { outro.acao = 'triste'; outro.tA = 0; }
}
// Chute: o boneco puxa a perna, a bola vai pro pé dele e sai voando com fogo. "aoGol" avisa quando a bola "entra".
let aoGol = null, golPendente = null;
export function chutar(i, quandoGol) {
  if (bonecos[i].acao === 'chute') return false;
  bonecos[i].acao = 'chute'; bonecos[i].tA = 0;
  aoGol = quandoGol; golPendente = i;
  return true;
}
export const chutando = () => bonecos.some(b => b.acao === 'chute') || !!bolaVoando;
let dono = null; // quem faz embaixadinha (quem está na frente)
export function definirDono(i) { dono = i; }

// Posição de um ponto do boneco na tela (para o texto flutuar em cima dele)
const vt = new THREE.Vector3();
export function naTela(i, altura = 1.4) {
  vt.set(0, altura, 0); bonecos[i].raiz.localToWorld(vt); vt.project(camera);
  return { x: (vt.x + 1) / 2 * W, y: (1 - vt.y) / 2 * H };
}

const v = new THREE.Vector3();
export function atualizar(dt, t) {
  for (const b of bonecos) {
    if (b.acao === 'chute') {
      const antes = b.tA; b.tA += dt / 0.9;
      if (antes < 0.42 && b.tA >= 0.42) {
        // chuta a bola: sai do pé com fogo, cruzando o campo na direção da câmera
        b.pernas[0].pe.getWorldPosition(v);
        const dir = bonecos.indexOf(b) === 0 ? 1 : -1;
        bolaVoando = { pos: v.clone().add(new THREE.Vector3(0, 0.08, 0.1)), vel: new THREE.Vector3(dir * 2.6, 4.6, 7.5), t: 0 };
      }
      if (b.tA >= 1) { b.acao = 'normal'; b.tA = 0; }
    }
    b.embaixadinha = bonecos.indexOf(b) === dono && !bolaVoando;
    aplicar(b, pose(b, t), dt);
  }

  const chutador = bonecos.find(b => b.acao === 'chute' && b.tA < 0.42);
  if (bolaVoando) {
    bolaVoando.t += dt;
    bolaVoando.vel.y -= 9.8 * dt;
    bolaVoando.pos.addScaledVector(bolaVoando.vel, dt);
    bola.position.copy(bolaVoando.pos);
    bola.rotation.x += dt * 20; bola.rotation.z += dt * 12;
    soltarFogo(bola.position);
    if (bolaVoando.t > 0.45 && golPendente != null) { const l = golPendente; golPendente = null; aoGol?.(l); }
    if (bolaVoando.t > 1.2) bolaVoando = null;
  } else if (chutador) {
    // a bola corre até o pé de quem vai chutar
    v.set(-0.095, 0.11, 0.32); chutador.raiz.localToWorld(v); v.y = 0.11;
    bola.position.lerp(v, 1 - Math.exp(-dt * 14));
  } else if (dono == null || bonecos[dono].acao !== 'normal') {
    // sem dono: a bola fica parada no meio do campo
    bola.position.lerp(v.set(0, 0.11, 0.5), 1 - Math.exp(-dt * 6));
  } else {
    const a = bonecos[dono];
    const ph = (t * 1.5) % 1;
    v.set(-0.095, 0, 0.3); a.raiz.localToWorld(v);
    const alvo = new THREE.Vector3(v.x, 0.28 + 4 * ph * (1 - ph) * 0.55, v.z);
    // chega na embaixadinha sem teleportar
    if (bola.position.distanceTo(alvo) > 0.3) bola.position.lerp(alvo, 1 - Math.exp(-dt * 8)); else bola.position.copy(alvo);
    bola.rotation.x += dt * 4;
  }
  for (let i = fogo.length - 1; i >= 0; i--) {
    const f = fogo[i]; f.vida -= dt;
    f.m.scale.setScalar(Math.max(0.01, f.vida * 2.4)); f.m.material.opacity = f.vida * 2;
    if (f.vida <= 0) { cena.remove(f.m); f.m.material.dispose(); fogo.splice(i, 1); }
  }
  texPlaca.offset.x = (t * 0.015) % 1;
  piscarFlashes(dt);
  // câmera respirando de leve
  camera.position.x = Math.sin(t * 0.25) * 0.3;
  camera.lookAt(0, ALVO_Y, 0);
}
// Torcida em festa: mais flashes por um tempo (gol, vitória)
let festa = 0;
export function festejar(seg = 3) { festa = Math.max(festa, seg); }
export function render(dt) {
  festa = Math.max(0, festa - dt);
  for (let k = 0; festa > 0 && k < 25; k++) { const i = Math.floor(Math.random() * N_FLASH) * 3; corFlash[i] = corFlash[i + 1] = corFlash[i + 2] = 6; }
  composer.render();
}

// Boneco 3D estilo action figure (Batalha de Chutes, Torre...). Genérico: camisa, cor, número,
// cabelo e barba vêm da equipe. Rosto de boneco, sem imitar ninguém.
//   const l = visual(EQUIPES[0], 0); l.cabecao = 2;   // cabeção (chibi)
//   const b = criarBoneco(l); cena.add(b.raiz);
//   b.acao = 'comemorar' | 'triste' | 'chute' | 'normal'; b.embaixadinha = true/false
//   a cada quadro: aplicar(b, pose(b, t), dt)
import * as THREE from 'three';

export const brilho = c => { const n = parseInt(c.slice(1), 16); return (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255; };
// Visual de cada boneco: o que a equipe tiver em "boneco" (modelos prontos), senão tira das cores da equipe
export function visual(eq, i) {
  const b = eq.boneco || {};
  const camisa = b.camisa || eq.cor;
  return {
    camisa, faixa: b.faixa || eq.faixa, numero: b.numero || String(i + 1),
    listras: b.listras ?? ['listras', 'listrasV'].includes(eq.escudoInfo?.padrao),
    corNumero: b.corNumero || (brilho(camisa) > 0.6 ? '#1b2a5c' : '#ffffff'),
    calcao: b.calcao || '#1a1d2b', meiao: b.meiao || camisa,
    pele: b.pele || ['#d9a07c', '#e8bb98'][i], cabelo: b.corCabelo || ['#1c140f', '#4a2f1d'][i],
    estilo: b.cabelo || ['topete', 'curto'][i], barba: b.barba ? (b.corBarba || '#43291a') : null,
    ui: eq.ui,
  };
}

export function canvasTex(w, h, desenhar, repetir) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  desenhar(cv.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  if (repetir) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repetir); }
  return t;
}

export function texCamisa(l) {
  return canvasTex(1024, 512, (g, w, h) => {
    g.fillStyle = l.camisa; g.fillRect(0, 0, w, h);
    g.fillStyle = l.faixa;
    if (l.listras) for (let i = 0; i < 12; i++) { if (i % 2) g.fillRect(i * w / 12, 0, w / 12, h); }
    else { g.fillRect(240, 0, 22, h); g.fillRect(762, 0, 22, h); } // faixas nas laterais
    // tecido: tramas leves
    g.globalAlpha = 0.05; g.fillStyle = '#000';
    for (let y = 0; y < h; y += 4) g.fillRect(0, y, w, 1);
    g.globalAlpha = 1;
    g.fillStyle = l.faixa; g.fillRect(0, 0, w, 30); g.fillRect(0, h - 18, w, 18); // gola e barra
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.lineJoin = 'round';
    const numero = (x, y, tam) => {
      g.font = `700 ${tam}px Fredoka, system-ui, sans-serif`;
      g.lineWidth = tam * 0.09; g.strokeStyle = l.listras ? '#ffffff' : '#00000088'; g.strokeText(l.numero, x, y);
      g.fillStyle = l.corNumero; g.fillText(l.numero, x, y);
    };
    numero(w / 2, 190, 150);      // frente
    numero(0, 230, 250); numero(w, 230, 250); // costas (metade em cada ponta)
  });
}

// ---------- Boneco ----------
export const sombra = m => { m.castShadow = true; m.receiveShadow = true; return m; };
export const mat = (cor, rug = 0.6, met = 0) => new THREE.MeshStandardMaterial({ color: cor, roughness: rug, metalness: met });

export function criarBoneco(l) {
  const mPele = mat(l.pele, 0.55), mCabelo = mat(l.cabelo, 0.75), mCalcao = mat(l.calcao, 0.55);
  const mCamisa = new THREE.MeshStandardMaterial({ map: texCamisa(l), roughness: 0.62 });
  const mManga = mat(l.camisa, 0.62), mFaixa = mat(l.faixa, 0.6), mMeiao = mat(l.meiao, 0.7);
  const mChuteira = mat('#111318', 0.28, 0.2), mSola = mat(l.ui, 0.4);
  const parte = (geo, m, x = 0, y = 0, z = 0, pai) => { const me = sombra(new THREE.Mesh(geo, m)); me.position.set(x, y, z); pai.add(me); return me; };

  const raiz = new THREE.Group();
  const quadril = new THREE.Group(); quadril.position.y = 0.94; raiz.add(quadril);

  // tronco (camisa) com forma de ombro largo e cintura fina
  const tronco = new THREE.Group(); quadril.add(tronco);
  const perfil = [[0.165, -0.02], [0.17, 0.08], [0.178, 0.2], [0.195, 0.32], [0.218, 0.44], [0.226, 0.52], [0.2, 0.585], [0.125, 0.63], [0.06, 0.645]]
    .map(([x, y]) => new THREE.Vector2(x, y));
  const camisa = parte(new THREE.LatheGeometry(perfil, 48, Math.PI), mCamisa, 0, 0, 0, tronco);
  camisa.scale.z = 0.7;
  parte(new THREE.TorusGeometry(0.07, 0.016, 8, 24), mFaixa, 0, 0.64, 0, tronco).rotation.x = Math.PI / 2; // gola

  // cabeça
  parte(new THREE.CylinderGeometry(0.05, 0.055, 0.12, 16), mPele, 0, 0.67, 0, tronco);
  const cabeca = new THREE.Group(); cabeca.position.y = 0.71; cabeca.scale.setScalar(1.08 * (l.cabecao || 1)); tronco.add(cabeca);
  parte(new THREE.SphereGeometry(0.12, 32, 24), mPele, 0, 0.12, 0, cabeca).scale.set(0.92, 1.08, 1);
  parte(new THREE.SphereGeometry(0.085, 24, 16), mPele, 0, 0.055, 0.025, cabeca).scale.set(1, 0.9, 1);
  for (const s of [-1, 1]) {
    parte(new THREE.SphereGeometry(0.03, 12, 10), mPele, s * 0.108, 0.12, 0, cabeca).scale.set(0.5, 1, 0.8);
    parte(new THREE.SphereGeometry(0.02, 16, 12), mat('#ffffff', 0.25), s * 0.042, 0.133, 0.1, cabeca).scale.set(1, 0.72, 0.45);
    parte(new THREE.SphereGeometry(0.0125, 12, 10), mat('#2a1d14', 0.15), s * 0.042, 0.133, 0.107, cabeca);
    parte(new THREE.SphereGeometry(0.0038, 8, 6), mat('#ffffff', 0.05), s * 0.042 + 0.004, 0.137, 0.12, cabeca); // brilho do olho
    parte(new THREE.TorusGeometry(0.021, 0.004, 6, 14, Math.PI), mPele, s * 0.042, 0.134, 0.103, cabeca).scale.set(1, 0.75, 1); // pálpebra
    parte(new THREE.BoxGeometry(0.045, 0.01, 0.012), mCabelo, s * 0.043, 0.164, 0.108, cabeca).rotation.z = -s * 0.12;
  }
  parte(new THREE.SphereGeometry(0.02, 12, 10), mPele, 0, 0.108, 0.118, cabeca).scale.set(0.85, 1, 1);
  const boca = parte(new THREE.TorusGeometry(0.024, 0.0055, 6, 16, Math.PI), mat('#8a3434', 0.5), 0, l.barba ? 0.075 : 0.078, l.barba ? 0.127 : 0.105, cabeca);
  boca.rotation.z = Math.PI;
  const cabelo = parte(new THREE.SphereGeometry(0.128, 32, 16, 0, Math.PI * 2, 0, 1.45), mCabelo, 0, 0.13, -0.006, cabeca);
  cabelo.scale.set(0.95, 1.06, 1.04); cabelo.rotation.x = -0.32;
  if (l.estilo === 'topete') parte(new THREE.SphereGeometry(0.07, 16, 12), mCabelo, 0, 0.235, 0.04, cabeca).scale.set(1.3, 0.55, 1);
  if (l.estilo === 'medio') {
    // cabelo médio penteado de lado, descendo na nuca
    parte(new THREE.SphereGeometry(0.133, 32, 16, Math.PI, Math.PI, 0.35, 1.75), mCabelo, 0, 0.122, -0.006, cabeca).scale.set(0.98, 1.08, 1.05);
    const franja = parte(new THREE.SphereGeometry(0.062, 16, 12), mCabelo, 0.03, 0.212, 0.072, cabeca);
    franja.scale.set(1.65, 0.5, 0.95); franja.rotation.z = -0.28;
    for (const s of [-1, 1]) parte(new THREE.SphereGeometry(0.035, 12, 10), mCabelo, s * 0.112, 0.15, -0.01, cabeca).scale.set(0.45, 1.3, 1); // costeleta
  }
  if (l.barba) {
    // barba cheia: lateral do rosto, queixo e bigode
    const mBarba = mat(l.barba, 0.9);
    parte(new THREE.SphereGeometry(0.126, 32, 16, -0.25, Math.PI + 0.5, 1.72, 1.25), mBarba, 0, 0.12, 0, cabeca).scale.set(0.94, 1.08, 1.02);
    parte(new THREE.SphereGeometry(0.093, 24, 16), mBarba, 0, 0.05, 0.028, cabeca).scale.set(1.02, 0.95, 1);
    parte(new THREE.TorusGeometry(0.027, 0.008, 6, 16, Math.PI), mBarba, 0, 0.087, 0.123, cabeca).scale.set(1, 0.6, 1);
  }

  // braços
  const bracos = [-1, 1].map(s => {
    const ombro = new THREE.Group(); ombro.position.set(s * 0.232, 0.52, 0); tronco.add(ombro);
    parte(new THREE.SphereGeometry(0.068, 16, 12), mManga, 0, 0, 0, ombro);
    parte(new THREE.CapsuleGeometry(0.062, 0.12, 6, 16), mManga, 0, -0.1, 0, ombro);
    parte(new THREE.TorusGeometry(0.058, 0.01, 6, 20), mFaixa, 0, -0.19, 0, ombro).rotation.x = Math.PI / 2;
    parte(new THREE.CapsuleGeometry(0.05, 0.1, 6, 14), mPele, 0, -0.23, 0, ombro);
    const cotovelo = new THREE.Group(); cotovelo.position.y = -0.3; ombro.add(cotovelo);
    parte(new THREE.CapsuleGeometry(0.044, 0.19, 6, 14), mPele, 0, -0.12, 0, cotovelo);
    parte(new THREE.SphereGeometry(0.05, 14, 12), mPele, 0, -0.28, 0.005, cotovelo).scale.set(0.75, 1.15, 0.6);
    return { ombro, cotovelo };
  });

  // calção e pernas
  parte(new THREE.LatheGeometry([[0.168, 0.01], [0.178, -0.05], [0.19, -0.12]].map(([x, y]) => new THREE.Vector2(x, y)), 40), mCalcao, 0, 0, 0, quadril).scale.z = 0.72;
  const pernas = [-1, 1].map(s => {
    const coxa = new THREE.Group(); coxa.position.set(s * 0.095, -0.04, 0); quadril.add(coxa);
    parte(new THREE.CylinderGeometry(0.108, 0.1, 0.3, 18), mCalcao, 0, -0.11, 0, coxa);
    parte(new THREE.CapsuleGeometry(0.072, 0.2, 6, 14), mPele, 0, -0.3, 0, coxa);
    const joelho = new THREE.Group(); joelho.position.y = -0.43; coxa.add(joelho);
    parte(new THREE.SphereGeometry(0.068, 14, 12), mPele, 0, 0, 0, joelho);
    parte(new THREE.CylinderGeometry(0.068, 0.048, 0.44, 16), mMeiao, 0, -0.23, 0, joelho);
    parte(new THREE.TorusGeometry(0.066, 0.009, 6, 18), mFaixa, 0, -0.06, 0, joelho).rotation.x = Math.PI / 2;
    const pe = new THREE.Group(); pe.position.y = -0.42; joelho.add(pe);
    const bota = parte(new THREE.CapsuleGeometry(0.05, 0.13, 6, 14), mChuteira, 0, -0.03, 0.05, pe);
    bota.rotation.x = Math.PI / 2; bota.scale.set(1.05, 1, 0.85);
    const sola = parte(new THREE.BoxGeometry(0.09, 0.012, 0.22), mSola, 0, -0.072, 0.05, pe);
    return { coxa, joelho, pe, sola };
  });

  raiz.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return { raiz, quadril, tronco, cabeca, bracos, pernas, l, acao: 'normal', tA: 0, fase: Math.random() * 6 };
}

// ---------- Animação (poses calculadas e suavizadas) ----------
export const lerp = (a, b, k) => a + (b - a) * k;
export const suave = x => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);

export function pose(b, t) {
  const r = Math.sin(t * 2.2 + b.fase);
  const p = { y: 0, quadril: 0.94, troncoX: 0.04 + r * 0.012, cabX: 0, cabY: 0,
    ombro: [[0, 0.13 + r * 0.02], [0, -0.13 - r * 0.02]], cot: [-0.3, -0.3],
    coxa: [0, 0], coxaZ: [0.03, -0.03], joelho: [0, 0], pe: [0, 0], vel: 10 };
  if (b.acao === 'normal') {
    if (b.embaixadinha) {
      // embaixadinha com o pé direito
      const ph = (t * 1.5) % 1, d = Math.min(ph, 1 - ph), sobe = Math.exp(-((d / 0.09) ** 2));
      p.coxa[0] = -0.85 * sobe; p.joelho[0] = 0.55 * sobe; p.pe[0] = -0.25 * sobe; p.cabX = 0.28; p.troncoX = 0.1;
      p.ombro[0][1] = 0.35; p.ombro[1][1] = -0.35; p.vel = 18;
    } else {
      // pulinho no lugar, se aquecendo
      const q = Math.abs(Math.sin(t * 4.5 + b.fase));
      p.quadril -= q * 0.025; p.joelho = [0.1 + q * 0.08, 0.1 + q * 0.08]; p.coxa = [-0.05 - q * 0.04, -0.05 - q * 0.04];
    }
  } else if (b.acao === 'chute') {
    const k = b.tA;
    if (k < 0.35) { const s = suave(k / 0.35); p.coxa[0] = 0.75 * s; p.joelho[0] = 1.3 * s; p.ombro[0][1] = 0.6 * s; p.ombro[1][1] = -0.6 * s; p.troncoX = 0.12; }
    else if (k < 0.5) { const s = suave((k - 0.35) / 0.15); p.coxa[0] = lerp(0.75, -1.35, s); p.joelho[0] = lerp(1.3, 0, s); p.troncoX = -0.18 * s; p.ombro[0][1] = 0.9; p.ombro[1][1] = -0.9; p.vel = 40; }
    else { const s = suave((k - 0.5) / 0.5); p.coxa[0] = lerp(-1.35, 0, s); p.troncoX = lerp(-0.18, 0.04, s); p.ombro[0][1] = lerp(0.9, 0.13, s); p.ombro[1][1] = lerp(-0.9, -0.13, s); }
  } else if (b.acao === 'comemorar') {
    const j = Math.abs(Math.sin(t * 6.5));
    p.y = j * 0.24; p.cabX = -0.25;
    p.ombro = [[0, 2.75 + Math.sin(t * 13) * 0.12], [0, -2.75 - Math.sin(t * 13) * 0.12]]; p.cot = [-0.2, -0.2];
    p.coxa = [-(1 - j) * 0.3, -(1 - j) * 0.3]; p.joelho = [(1 - j) * 0.55, (1 - j) * 0.55]; p.vel = 16;
  } else if (b.acao === 'triste') {
    p.quadril = 0.76; p.coxa = [-0.9, -0.9]; p.coxaZ = [0.12, -0.12]; p.joelho = [1.55, 1.55]; p.pe = [-0.65, -0.65];
    p.troncoX = 0.5 + Math.sin(t * 9) * 0.02; p.cabX = 0.55; p.cabY = Math.sin(t * 1.3) * 0.25;
    p.ombro = [[-0.75, 0.05], [-0.75, -0.05]]; p.cot = [-0.9, -0.9]; p.vel = 5;
  }
  return p;
}

export function aplicar(b, p, dt) {
  const k = 1 - Math.exp(-dt * p.vel);
  b.raiz.position.y = lerp(b.raiz.position.y, p.y, k);
  b.quadril.position.y = lerp(b.quadril.position.y, p.quadril, k);
  b.tronco.rotation.x = lerp(b.tronco.rotation.x, p.troncoX, k);
  b.cabeca.rotation.x = lerp(b.cabeca.rotation.x, p.cabX, k);
  b.cabeca.rotation.y = lerp(b.cabeca.rotation.y, p.cabY, k);
  // índice 0 = perna/braço direito do boneco (lado -x)
  b.bracos.forEach((br, i) => {
    br.ombro.rotation.x = lerp(br.ombro.rotation.x, p.ombro[i][0], k);
    br.ombro.rotation.z = lerp(br.ombro.rotation.z, -p.ombro[i][1], k); // valor positivo = braço abre para fora
    br.cotovelo.rotation.x = lerp(br.cotovelo.rotation.x, p.cot[i], k);
  });
  b.pernas.forEach((pe, i) => {
    pe.coxa.rotation.x = lerp(pe.coxa.rotation.x, p.coxa[i], k);
    pe.coxa.rotation.z = lerp(pe.coxa.rotation.z, -p.coxaZ[i], k);
    pe.joelho.rotation.x = lerp(pe.joelho.rotation.x, p.joelho[i], k);
    pe.pe.rotation.x = lerp(pe.pe.rotation.x, p.pe[i], k);
  });
}


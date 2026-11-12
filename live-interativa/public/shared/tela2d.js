// Peças de desenho em comum para os jogos 2D (1080x1920): texto, caixas, partículas, avisos,
// faixa de destaque e o ranking de apoiadores. Mantém todos os jogos com a mesma cara.
//   const T = criarTela2D(document.getElementById('tela'))
//   T.texto('Oi', x, y, { tam, cor, alinhar, peso, contorno })
//   T.explosao(x, y, cor, n) · T.confete(n) · T.aviso('texto', cor) · T.banner('título', 'sub')
//   T.atualizarEfeitos(dt) e depois T.desenharEfeitos() / T.desenharAvisos(y) / T.desenharBanner(y)
function criarTela2D(canvas) {
  const W = 1080, H = 1920;
  canvas.width = W; canvas.height = H;
  const c = canvas.getContext('2d');
  const rnd = (a, b) => a + Math.random() * (b - a);
  let particulas = [], avisos = [], banner = null;

  function texto(str, x, y, { tam = 40, cor = '#fff', alinhar = 'left', peso = 700, contorno = 6, base = 'middle', max } = {}) {
    c.font = `${Math.min(peso, 700)} ${tam}px Fredoka, "Segoe UI Emoji", sans-serif`;
    c.textAlign = alinhar; c.textBaseline = base;
    if (contorno) { c.lineWidth = contorno; c.strokeStyle = '#000b'; c.lineJoin = 'round'; c.strokeText(str, x, y, max); }
    c.fillStyle = cor; c.fillText(str, x, y, max);
  }
  function largura(str, tam, peso = 700) {
    c.font = `${Math.min(peso, 700)} ${tam}px Fredoka, "Segoe UI Emoji", sans-serif`;
    return c.measureText(str).width;
  }
  function caixa(x, y, w, h, r, cor, borda) {
    c.beginPath(); c.roundRect(x, y, w, h, r); c.fillStyle = cor; c.fill();
    if (borda) { c.lineWidth = 3; c.strokeStyle = borda; c.stroke(); }
  }
  const cortar = (str, max) => (str.length > max ? str.slice(0, max - 1) + '…' : str);

  function explosao(x, y, cor, n = 16, forca = 9) {
    for (let i = 0; i < n; i++) {
      const a = rnd(0, Math.PI * 2), v = rnd(2, forca);
      particulas.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, vida: rnd(0.4, 0.9), cor, tam: rnd(5, 11), gravidade: 0.25 });
    }
  }
  function flutuar(x, y, str, cor = '#fff', tam = 34) {
    particulas.push({ x, y, vx: rnd(-0.6, 0.6), vy: -2.2, vida: 1.1, cor, tam, texto: str, gravidade: 0 });
  }
  function confete(n = 80) {
    const cores = ['#ffd23f', '#ff3d8b', '#3fd36f', '#5ad8ff', '#b46bff', '#ffffff'];
    for (let i = 0; i < n; i++) {
      particulas.push({ x: rnd(0, W), y: rnd(-300, 0), vx: rnd(-2, 2), vy: rnd(3, 8), vida: rnd(2.5, 4.5),
        cor: cores[Math.floor(rnd(0, cores.length))], tam: rnd(9, 17), giro: rnd(0, 6), gravidade: 0 });
    }
  }
  function aviso(str, cor = '#fff') {
    avisos.unshift({ texto: str, cor, vida: 5 });
    avisos.length = Math.min(avisos.length, 5);
  }
  function mostrarBanner(titulo, sub, cores = ['#7b2cff', '#ff2d6f']) {
    banner = { titulo, sub, cores, vida: 3.2 };
    confete(50);
  }
  function atualizarEfeitos(dt) {
    for (const p of particulas) {
      p.x += p.vx; p.y += p.vy; p.vida -= dt;
      if (p.giro != null) p.giro += 0.15; else p.vy += p.gravidade;
    }
    particulas = particulas.filter(p => p.vida > 0 && p.y < H + 50);
    if (particulas.length > 900) particulas.splice(0, particulas.length - 900);
    for (const a of avisos) a.vida -= dt;
    avisos = avisos.filter(a => a.vida > 0);
    if (banner && (banner.vida -= dt) <= 0) banner = null;
  }
  function desenharEfeitos() {
    for (const p of particulas) {
      c.globalAlpha = Math.max(0, Math.min(1, p.vida * 2));
      if (p.texto) { texto(p.texto, p.x, p.y, { tam: p.tam, cor: p.cor, alinhar: 'center', contorno: 5 }); continue; }
      c.fillStyle = p.cor;
      if (p.giro != null) {
        c.save(); c.translate(p.x, p.y); c.rotate(p.giro); c.fillRect(-p.tam / 2, -p.tam / 4, p.tam, p.tam / 2); c.restore();
      } else {
        c.beginPath(); c.arc(p.x, p.y, p.tam / 2, 0, Math.PI * 2); c.fill();
      }
    }
    c.globalAlpha = 1;
  }
  // Avisos à direita, um embaixo do outro, a partir de y
  function desenharAvisos(y, lado = 'direita') {
    avisos.forEach((a, i) => {
      c.globalAlpha = Math.min(1, a.vida);
      const yy = y + i * 52, str = cortar(a.texto, 44);
      const w = Math.min(largura(str, 26) + 32, W - 60);
      const x = lado === 'direita' ? W - 20 - w : 20;
      caixa(x, yy - 22, w, 44, 22, '#000000b0');
      texto(str, lado === 'direita' ? W - 36 : 36, yy, { tam: 26, alinhar: lado === 'direita' ? 'right' : 'left', cor: a.cor, contorno: 0 });
    });
    c.globalAlpha = 1;
  }
  function desenharBanner(y = 700) {
    if (!banner) return;
    const s = Math.min(1, (3.2 - banner.vida) * 5);
    c.save(); c.translate(W / 2, y); c.scale(s, s); c.globalAlpha = Math.min(1, banner.vida * 2);
    const gb = c.createLinearGradient(-480, 0, 480, 0);
    gb.addColorStop(0, banner.cores[0]); gb.addColorStop(1, banner.cores[1]);
    c.shadowColor = '#0008'; c.shadowBlur = 30;
    caixa(-480, -90, 960, 180, 40, gb);
    c.shadowBlur = 0;
    texto(cortar(banner.titulo, 24), 0, -30, { tam: 60, alinhar: 'center' });
    texto(cortar(banner.sub, 40), 0, 40, { tam: 36, alinhar: 'center', cor: '#ffe680' });
    c.restore();
  }
  // Top 3 de quem mais mandou presente hoje. Devolve onde a caixa termina.
  function desenharApoiadores(x, y, w = 340) {
    const top = Ranking.top(3);
    if (!top.length) return y - 40;
    const h = 56 + top.length * 46;
    caixa(x, y, w, h, 20, '#000000b0', '#ffd23f88');
    texto('🎁 TOP APOIADORES', x + 20, y + 28, { tam: 24, cor: '#ffd23f', contorno: 0 });
    const medalhas = ['👑', '🥈', '🥉'];
    top.forEach((p, i) => {
      const ly = y + 74 + i * 46;
      texto(`${medalhas[i]} ${cortar(p.nome, 13)}`, x + 20, ly, { tam: 27, contorno: 0, cor: i === 0 ? '#ffe680' : '#fff' });
      texto(`${p.diamantes}💎`, x + w - 16, ly, { tam: 22, contorno: 0, peso: 600, alinhar: 'right', cor: '#9fd8ff' });
    });
    return y + h;
  }
  // Fundo do topo (escurece atrás do placar)
  function sombraTopo(altura = 460) {
    const g = c.createLinearGradient(0, 0, 0, altura);
    g.addColorStop(0, '#05030fff'); g.addColorStop(0.8, '#05030fcc'); g.addColorStop(1, '#05030f00');
    c.fillStyle = g; c.fillRect(0, 0, W, altura);
  }

  return {
    W, H, c, rnd, texto, largura, caixa, cortar, explosao, flutuar, confete, aviso, banner: mostrarBanner,
    atualizarEfeitos, desenharEfeitos, desenharAvisos, desenharBanner, desenharApoiadores, sombraTopo,
    get temBanner() { return !!banner; },
  };
}

// Laço de quadros com dt em segundos (máx. 0,1s para não pular depois de travar)
function rodarQuadros(fn) {
  let ultimo = performance.now();
  function quadro(t) {
    const dt = Math.min(0.1, (t - ultimo) / 1000);
    ultimo = t;
    fn(dt, t / 1000);
    requestAnimationFrame(quadro);
  }
  requestAnimationFrame(quadro);
}

// Agradecimento de presente com a frase certa (rosa, várias rosas ou presente comum)
function chaveDoPresente(ev, grande) {
  if (grande) return 'presenteGrande';
  if (/rosa|rose/i.test(ev.presente || '')) return ev.qtd > 1 ? 'presenteRosas' : 'presenteRosa';
  return 'presente';
}

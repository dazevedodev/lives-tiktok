// Equipes da live (configuradas no painel) e a marca de quem faz a live.
//   EQUIPES                  lista de equipes: { nome, emoji, cor, ui, faixa, faixa2, sigla, chaves, escudo }
//   EQUIPES[i].escudo        canvas com o emblema (emoji num círculo, ou escudo desenhado no modelo de times)
//   acharEquipe('vai fogo')  -> 0   (null se o texto não fala de nenhuma equipe). O número e o emoji também valem.
//   Marca.nome, Marca.cor, Marca.logo (imagem ou null), Marca.desenhar(ctx, x, y, tamanho)
//   aoComecar(fn)            espera o clique que libera o som (dentro da tela da live começa sozinho)
// Precisa de /config.js carregado antes.
const EQUIPES = (() => {
  const cfg = window.CONFIG_LIVE || {};
  const lista = cfg.equipes?.length >= 2 ? cfg.equipes : [
    { nome: 'Vermelho', emoji: '🔴', cor: '#ff4b3e' }, { nome: 'Azul', emoji: '🔵', cor: '#2f8cff' },
  ];

  const hex = c => [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16));
  const paraHex = rgb => '#' + rgb.map(v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');
  const misturar = (a, b, t) => paraHex(hex(a).map((v, i) => v + (hex(b)[i] - v) * t));
  const brilho = c => { const [r, g, b] = hex(c); return (0.299 * r + 0.587 * g + 0.114 * b) / 255; };

  function emblema(e, tela = document.createElement('canvas')) {
    tela.width = tela.height = 128; // também limpa (para redesenhar quando a fonte carregar)
    const g = tela.getContext('2d');
    const grad = g.createRadialGradient(46, 40, 6, 64, 64, 64);
    grad.addColorStop(0, misturar(e.cor, '#ffffff', 0.35));
    grad.addColorStop(1, misturar(e.cor, '#000000', 0.25));
    g.beginPath(); g.arc(64, 64, 58, 0, Math.PI * 2); g.fillStyle = grad; g.fill();
    g.lineWidth = 7; g.strokeStyle = '#ffffff'; g.stroke();
    g.textAlign = 'center'; g.textBaseline = 'middle';
    if (e.emoji) {
      g.font = '64px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif';
      g.fillText(e.emoji, 64, 70);
    } else {
      g.font = `700 ${e.nome.length > 2 ? 40 : 54}px Fredoka, system-ui, sans-serif`;
      g.lineWidth = 6; g.strokeStyle = '#000a'; g.strokeText(e.nome.slice(0, 3).toUpperCase(), 64, 66);
      g.fillStyle = '#fff'; g.fillText(e.nome.slice(0, 3).toUpperCase(), 64, 66);
    }
    return tela;
  }

  // Escudo desenhado (modelo "Times"): cores e padrão do uniforme + sigla. Não usa escudo oficial.
  function escudo(e, tela = document.createElement('canvas')) {
    const s = e.escudoInfo;
    tela.width = tela.height = 128;
    const g = tela.getContext('2d');
    const forma = () => {
      g.beginPath();
      g.moveTo(14, 10); g.lineTo(114, 10); g.lineTo(114, 58);
      g.quadraticCurveTo(114, 102, 64, 122); g.quadraticCurveTo(14, 102, 14, 58);
      g.closePath();
    };
    forma(); g.fillStyle = e.cor; g.fill();
    g.save(); forma(); g.clip();
    g.fillStyle = s.faixa;
    if (s.padrao === 'listras') for (let y = 22; y < 128; y += 26) g.fillRect(0, y, 128, 13);
    if (s.padrao === 'listrasV') for (let x = 27; x < 114; x += 26) g.fillRect(x, 0, 13, 128);
    if (s.padrao === 'tri') for (let x = 14, k = 0; x < 114; x += 14, k++) { g.fillStyle = k % 2 ? (s.faixa2 || s.faixa) : s.faixa; if (k % 3 !== 2) g.fillRect(x, 0, 14, 128); }
    if (s.padrao === 'faixa') { g.fillRect(0, 44, 128, 14); g.fillStyle = s.faixa2 || '#111'; g.fillRect(0, 58, 128, 14); }
    if (s.padrao === 'diagonal') { g.translate(64, 64); g.rotate(Math.PI / 4); g.fillRect(-90, -11, 180, 22); g.setTransform(1, 0, 0, 1, 0, 0); }
    if (s.padrao === 'estrela') {
      g.beginPath();
      for (let k = 0; k < 10; k++) {
        const r = k % 2 ? 7 : 17, a = -Math.PI / 2 + k * Math.PI / 5;
        g.lineTo(64 + Math.cos(a) * r, 30 + Math.sin(a) * r);
      }
      g.fill();
    }
    g.restore();
    forma(); g.lineWidth = 7; g.strokeStyle = s.padrao === 'liso' ? s.faixa : '#fff'; g.stroke();
    g.font = `700 ${s.sigla.length > 3 ? 30 : 38}px Fredoka, system-ui, sans-serif`;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    const ys = s.padrao === 'estrela' ? 74 : 60;
    g.lineWidth = 6; g.strokeStyle = '#000c'; g.strokeText(s.sigla, 64, ys);
    g.fillStyle = '#fff'; g.fillText(s.sigla, 64, ys);
    return tela;
  }

  const normalizar = t => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();

  const equipes = lista.map((e, i) => {
    const b = brilho(e.cor);
    const eq = {
      nome: e.nome, emoji: e.emoji || '', cor: e.cor, num: i + 1,
      // cor para texto em fundo escuro (cores muito escuras ficam claras)
      ui: b < 0.3 ? misturar(e.cor, '#ffffff', 0.7) : b < 0.45 ? misturar(e.cor, '#ffffff', 0.35) : e.cor,
      // faixas do corpo (Cobrinha) e detalhes
      faixa: e.escudo?.faixa || (b > 0.6 ? misturar(e.cor, '#000000', 0.45) : misturar(e.cor, '#ffffff', 0.55)),
      faixa2: e.escudo?.faixa2,
      sigla: e.escudo?.sigla || e.emoji || e.nome.slice(0, 3).toUpperCase(),
      chaves: [String(i + 1), normalizar(e.nome), ...(e.palavras || []).map(normalizar)].filter(Boolean),
      escudoInfo: e.escudo,
      boneco: e.boneco, // visual do boneco 3D (Batalha), se o modelo tiver
    };
    eq.escudo = e.escudo ? escudo(eq) : emblema(eq);
    return eq;
  });
  // A letra Fredoka pode chegar depois do primeiro desenho: redesenha no mesmo canvas quando ela carregar
  document.fonts?.load('700 40px Fredoka').then(() => equipes.forEach(eq => eq.escudoInfo ? escudo(eq, eq.escudo) : emblema(eq, eq.escudo)));
  return equipes;
})();

function acharEquipe(texto, lista = EQUIPES) {
  const bruto = String(texto || '');
  const t = ' ' + bruto.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim() + ' ';
  let i = lista.findIndex(e => e.chaves.some(k => t.includes(' ' + k + ' ')));
  if (i < 0) i = lista.findIndex(e => e.emoji && bruto.includes(e.emoji));
  return i < 0 ? null : i;
}
// "1, 2, 3 ou 4" para as frases e a tela
function numerosDasEquipes(n = EQUIPES.length) {
  const nums = Array.from({ length: n }, (_, i) => String(i + 1));
  return nums.length > 1 ? nums.slice(0, -1).join(', ') + ' ou ' + nums.at(-1) : nums[0];
}

const Marca = (() => {
  const m = window.CONFIG_LIVE?.marca || {};
  let logo = null;
  if (m.logo) { logo = new Image(); logo.src = m.logo; }
  // Etiqueta com logo + nome (some se não tiver marca configurada)
  function desenhar(ctx, x, y, tam = 34, alinhar = 'center') {
    if (!m.nome && !logo) return;
    ctx.save();
    ctx.font = `600 ${tam}px Fredoka, system-ui, sans-serif`;
    const temLogo = logo?.complete && logo.naturalWidth;
    const wTexto = m.nome ? ctx.measureText(m.nome).width : 0;
    const h = tam * 1.7, wLogo = temLogo ? h - 10 : 0;
    const w = wTexto + wLogo + (m.nome && temLogo ? 14 : 0) + 36;
    const x0 = alinhar === 'center' ? x - w / 2 : alinhar === 'right' ? x - w : x;
    ctx.beginPath(); ctx.roundRect(x0, y - h / 2, w, h, h / 2);
    ctx.fillStyle = '#000000a0'; ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = m.cor || '#ff2d6f'; ctx.stroke();
    let cx = x0 + 18;
    if (temLogo) {
      ctx.save(); ctx.beginPath(); ctx.arc(cx + wLogo / 2, y, wLogo / 2, 0, Math.PI * 2); ctx.clip();
      const s = Math.max(wLogo / logo.naturalWidth, wLogo / logo.naturalHeight);
      ctx.drawImage(logo, cx + wLogo / 2 - logo.naturalWidth * s / 2, y - logo.naturalHeight * s / 2, logo.naturalWidth * s, logo.naturalHeight * s);
      ctx.restore();
      cx += wLogo + 14;
    }
    if (m.nome) {
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#fff';
      ctx.fillText(m.nome, cx, y + 1);
    }
    ctx.restore();
  }
  return { nome: m.nome || '', cor: m.cor || '#ff2d6f', get logo() { return logo; }, desenhar };
})();

// Espera o clique que libera som e voz (regra do navegador). Na tela da live começa direto.
function aoComecar(fn) {
  const aviso = document.getElementById('comecar');
  let foi = false;
  const ir = () => {
    if (foi) return;
    foi = true;
    Som.iniciar();
    aviso?.remove();
    fn();
  };
  aviso?.addEventListener('click', ir);
  if (window.parent !== window && window.parent.Som) ir(); // na tela da live o clique é dado uma vez só, na própria tela
}

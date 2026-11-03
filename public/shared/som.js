// Música e efeitos sonoros gerados na hora (sem arquivos de música = sem problema de direitos autorais).
//   Som.iniciar()                      precisa de um clique do usuário antes (regra do navegador)
//   Som.musica({ bpm: 124, energia })  liga a música de fundo; energia 0..1 muda a intensidade
//   Som.energia(0.8)                   muda a intensidade na hora
//   Som.pop(), Som.turbo(), Som.vitoria() ... efeitos
// Tecla M liga/desliga todo o som (fica lembrado no navegador).
const Som = (() => {
  let ctx, master, busMusica, busSfx, ruido;
  let mudo = false;
  try { mudo = localStorage.getItem('som-mudo') === '1'; } catch { /* sem armazenamento */ }
  let bpm = 124, energia = 0.5, ligada = false;
  let passo = 0, proximoTempo = 0, acordes = [], tom = 60, timer = null;

  function iniciar() {
    if (ctx) { ctx.resume(); return; }
    ctx = new AudioContext();
    master = ctx.createGain(); master.gain.value = mudo ? 0 : 0.8;
    const comp = ctx.createDynamicsCompressor();
    master.connect(comp); comp.connect(ctx.destination);
    busMusica = ctx.createGain(); busMusica.gain.value = 0.32; busMusica.connect(master);
    busSfx = ctx.createGain(); busSfx.gain.value = 0.55; busSfx.connect(master);
    ruido = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = ruido.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const hz = m => 440 * Math.pow(2, (m - 69) / 12);
  const ok = () => ctx && ctx.state === 'running';

  function nota(freq, t, dur, { tipo = 'square', vol = 0.2, destino = busSfx, freqFim = null, ataque = 0.005 } = {}) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = tipo;
    o.frequency.setValueAtTime(freq, t);
    if (freqFim) o.frequency.exponentialRampToValueAtTime(freqFim, t + dur);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + ataque);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(destino);
    o.start(t); o.stop(t + dur + 0.02);
  }
  function chiado(t, dur, { vol = 0.15, filtro = 8000, tipoFiltro = 'highpass', destino = busSfx } = {}) {
    const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = ruido; f.type = tipoFiltro; f.frequency.value = filtro;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(destino);
    s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
  }

  // ---------- Música de fundo ----------
  const ESCALA = [0, 2, 4, 5, 7, 9, 11];
  const PROGRESSOES = [[0, 4, 5, 3], [5, 3, 0, 4], [0, 5, 3, 4], [3, 4, 0, 5], [0, 3, 4, 4], [5, 4, 3, 4]];
  const grau = g => tom + Math.floor(g / 7) * 12 + ESCALA[((g % 7) + 7) % 7];
  function novaProgressao() {
    acordes = PROGRESSOES[Math.floor(Math.random() * PROGRESSOES.length)];
  }
  function tocarPasso(p, t) {
    const s16 = 60 / bpm / 4;
    const compasso = Math.floor(p / 16), p16 = p % 16;
    if (p16 === 0 && compasso % 8 === 0) {
      novaProgressao();
      if (compasso % 32 === 0) tom = [57, 60, 62, 55, 59][Math.floor(Math.random() * 5)];
    }
    const g = acordes[compasso % 4];
    const acorde = [grau(g), grau(g + 2), grau(g + 4)];
    const M = { destino: busMusica };

    // bumbo
    if (p16 % 4 === 0 && energia >= 0.25) nota(150, t, 0.25, { ...M, tipo: 'sine', vol: 0.9, freqFim: 40 });
    // caixa
    if ((p16 === 4 || p16 === 12) && energia >= 0.55) chiado(t, 0.15, { ...M, vol: 0.35, filtro: 1800, tipoFiltro: 'bandpass' });
    // chimbal
    if (p16 % 4 === 2 || (energia >= 0.75 && p16 % 2 === 1)) chiado(t, 0.04, { ...M, vol: 0.18 });
    // baixo
    if ([0, 3, 6, 8, 11, 14].includes(p16)) nota(hz(acorde[0] - 24), t, s16 * 2, { ...M, tipo: 'triangle', vol: 0.55 });
    // acorde de fundo
    if (p16 === 0) for (const n of acorde) nota(hz(n), t, s16 * 15, { ...M, tipo: 'triangle', vol: 0.07, ataque: 0.08 });
    // arpejo
    if (energia >= 0.45) {
      const n = acorde[p16 % 3] + (p16 % 6 >= 3 ? 12 : 0);
      nota(hz(n), t, s16 * 0.9, { ...M, tipo: 'square', vol: 0.045 });
    }
    // melodia
    if (energia >= 0.8 && p16 % 2 === 0 && Math.random() < 0.45) {
      const penta = [0, 2, 4, 7, 9];
      nota(hz(tom + 12 + penta[Math.floor(Math.random() * 5)]), t, s16 * 1.8, { ...M, tipo: 'sawtooth', vol: 0.04 });
    }
  }
  function agendar() {
    if (!ok()) return;
    if (proximoTempo < ctx.currentTime) proximoTempo = ctx.currentTime + 0.05;
    while (proximoTempo < ctx.currentTime + 0.12) {
      tocarPasso(passo, proximoTempo);
      passo++;
      proximoTempo += 60 / bpm / 4;
    }
  }
  function musica(opcoes = {}) {
    if (opcoes.bpm) bpm = opcoes.bpm;
    if (opcoes.energia != null) energia = opcoes.energia;
    if (ligada) return;
    ligada = true; novaProgressao();
    timer = setInterval(agendar, 25);
  }
  function pararMusica() { ligada = false; clearInterval(timer); }

  // ---------- Efeitos ----------
  let ultimoPop = 0;
  const efeitos = {
    pop(altura = 1) {
      if (!ok() || ctx.currentTime - ultimoPop < 0.03) return;
      ultimoPop = ctx.currentTime;
      nota(500 * altura, ctx.currentTime, 0.07, { tipo: 'sine', vol: 0.15, freqFim: 900 * altura });
    },
    entrar() {
      if (!ok()) return; const t = ctx.currentTime;
      nota(660, t, 0.08, { vol: 0.1 }); nota(990, t + 0.07, 0.12, { vol: 0.1 });
    },
    curtida() {
      if (!ok()) return;
      nota(1200 + Math.random() * 400, ctx.currentTime, 0.05, { tipo: 'sine', vol: 0.06 });
    },
    bumper() {
      if (!ok()) return;
      nota(320, ctx.currentTime, 0.12, { tipo: 'square', vol: 0.12, freqFim: 140 });
    },
    turbo() {
      if (!ok()) return; const t = ctx.currentTime;
      nota(180, t, 0.5, { tipo: 'sawtooth', vol: 0.18, freqFim: 1100 });
      chiado(t, 0.5, { vol: 0.15, filtro: 3000 });
    },
    teleporte() {
      if (!ok()) return; const t = ctx.currentTime;
      nota(1500, t, 0.25, { tipo: 'sine', vol: 0.2, freqFim: 200 });
      nota(200, t + 0.25, 0.35, { tipo: 'sine', vol: 0.2, freqFim: 2000 });
      chiado(t, 0.6, { vol: 0.1, filtro: 5000 });
    },
    bip(final = false) {
      if (!ok()) return;
      nota(final ? 1320 : 660, ctx.currentTime, final ? 0.5 : 0.18, { tipo: 'square', vol: 0.18 });
    },
    vitoria() {
      if (!ok()) return; const t = ctx.currentTime;
      [72, 76, 79, 84, 79, 84].forEach((m, i) => nota(hz(m), t + i * 0.12, i === 5 ? 0.8 : 0.14, { vol: 0.16 }));
      chiado(t + 0.6, 1.2, { vol: 0.12, filtro: 6000 });
    },
    moeda() {
      if (!ok()) return; const t = ctx.currentTime;
      nota(988, t, 0.07, { vol: 0.12 }); nota(1319, t + 0.07, 0.3, { vol: 0.12 });
    },
  };

  function alternarMudo() {
    mudo = !mudo;
    try { localStorage.setItem('som-mudo', mudo ? '1' : '0'); } catch { /* ignora */ }
    if (master) master.gain.value = mudo ? 0 : 0.8;
  }
  addEventListener('keydown', e => {
    if (e.target.tagName !== 'INPUT' && (e.key === 'm' || e.key === 'M')) alternarMudo();
  });

  // Abaixa a música enquanto a narradora fala
  function abaixarMusica(sim) {
    if (!ctx) return;
    busMusica.gain.setTargetAtTime(sim ? 0.1 : 0.32, ctx.currentTime, 0.15);
  }

  return {
    iniciar, musica, pararMusica, alternarMudo, abaixarMusica, ...efeitos,
    get mudo() { return mudo; },
    energia(v) { energia = v; },
    bpm(v) { bpm = v; },
  };
})();

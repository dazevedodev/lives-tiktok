// Liga o jogo ao servidor e entrega os eventos da live.
//   Live.on('chat', ev => ...)   ev = { tipo, id, nome, foto, texto }
//   Live.on('like', ev => ...)   ev.qtd = curtidas
//   Live.on('gift', ev => ...)   ev.presente, ev.diamantes, ev.qtd
//   Live.on('follow' | 'share' | 'join' | 'status' | '*', ...)
// Tecla T abre o painel de teste (simula comentários, curtidas e presentes).
const Live = (() => {
  const ouvintes = {};
  let ws = null;
  let status = { modo: '?', conectado: false };

  function on(tipo, fn) { (ouvintes[tipo] ||= []).push(fn); }
  function emitir(ev) {
    for (const fn of ouvintes[ev.tipo] || []) fn(ev);
    for (const fn of ouvintes['*'] || []) fn(ev);
  }

  function conectar() {
    ws = new WebSocket(`ws://${location.host}`);
    ws.onmessage = m => {
      const ev = JSON.parse(m.data);
      if (ev.tipo === 'status') { status = ev; atualizarAviso(); }
      emitir(ev);
    };
    ws.onclose = () => {
      status = { ...status, conectado: false, msg: 'Servidor desligado. Abra o INICIAR-LIVE.bat' };
      atualizarAviso();
      setTimeout(conectar, 2000);
    };
  }

  // Aviso pequeno no topo quando a live não está conectada (some quando conecta)
  let aviso;
  function atualizarAviso() {
    if (!aviso) {
      aviso = document.createElement('div');
      aviso.style.cssText = 'position:fixed;top:8px;left:50%;transform:translateX(-50%);z-index:99;' +
        'background:#000c;color:#fff;font:600 14px system-ui;padding:6px 14px;border-radius:20px;pointer-events:none';
      document.body.appendChild(aviso);
    }
    let texto = '';
    if (status.modo === 'teste') texto = '🧪 Modo teste — aperte T para simular';
    else if (!status.conectado) texto = '⏳ ' + (status.msg || 'Conectando na live...');
    aviso.textContent = texto;
    aviso.style.display = texto ? 'block' : 'none';
  }

  // ---------- Painel de teste ----------
  const NOMES = ['Ana', 'Biel', 'Carol', 'Duda', 'Enzo', 'Fefe', 'Gabi', 'Heitor', 'Isa', 'João', 'Kaká',
    'Lari', 'Malu', 'Nando', 'Otávio', 'Pietra', 'Rafa', 'Sofia', 'Theo', 'Vivi', 'Will', 'Yuri', 'Zeca'];
  const PRESENTES = [['Rosa', 1], ['Dedo coração', 5], ['Donut', 30], ['Confete', 100], ['Leão', 29999]];
  const bots = [];
  function bot() {
    if (bots.length < 40 && Math.random() < 0.3) {
      const n = NOMES[Math.floor(Math.random() * NOMES.length)] + Math.floor(Math.random() * 99);
      bots.push({ id: n.toLowerCase(), nome: n, foto: '' });
    }
    return bots[Math.floor(Math.random() * bots.length)] || { id: 'teste', nome: 'Teste', foto: '' };
  }
  function simular(ev) {
    ev = { ...bot(), ...ev };
    if (ws?.readyState === 1) ws.send(JSON.stringify(ev)); else emitir({ ...ev, simulado: true });
  }
  function aleatorio(lista) { return lista[Math.floor(Math.random() * lista.length)]; }

  let painel, timerPlateia = null;
  function abrirPainel() {
    if (painel) { painel.style.display = painel.style.display === 'none' ? 'block' : 'none'; return; }
    painel = document.createElement('div');
    painel.style.cssText = 'position:fixed;right:12px;bottom:12px;z-index:100;width:260px;background:#111e;color:#fff;' +
      'font:13px system-ui;padding:12px;border-radius:12px;box-shadow:0 4px 24px #0008';
    const textos = Live.textosTeste.map(t => `<option>${t}</option>`).join('');
    painel.innerHTML = `
      <b>🧪 Painel de teste</b> <small style="opacity:.6">(T fecha)</small>
      <div style="margin:8px 0 4px">Comentário:</div>
      <div style="display:flex;gap:4px"><input list="lt-textos" id="lt-texto" value="${Live.textosTeste[0] || 'oi'}"
        style="flex:1;min-width:0;padding:4px;border-radius:6px;border:0">
        <datalist id="lt-textos">${textos}</datalist><button data-a="chat">Enviar</button></div>
      <div style="margin:8px 0 4px">Ações:</div>
      <div style="display:flex;flex-wrap:wrap;gap:4px">
        <button data-a="like">❤️ 10 curtidas</button><button data-a="follow">➕ Seguir</button>
        <button data-a="share">↗️ Compartilhar</button>
        ${PRESENTES.map(([n, d], i) => `<button data-p="${i}">🎁 ${n} (${d}💎)</button>`).join('')}
      </div>
      <label style="display:block;margin-top:10px"><input type="checkbox" id="lt-plateia"> Plateia automática (bots)</label>`;
    painel.querySelectorAll('button').forEach(b => b.style.cssText =
      'padding:5px 8px;border:0;border-radius:6px;background:#333;color:#fff;cursor:pointer;font:12px system-ui');
    painel.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.a === 'chat') simular({ tipo: 'chat', texto: painel.querySelector('#lt-texto').value });
      if (b.dataset.a === 'like') simular({ tipo: 'like', qtd: 10 });
      if (b.dataset.a === 'follow') simular({ tipo: 'follow' });
      if (b.dataset.a === 'share') simular({ tipo: 'share' });
      if (b.dataset.p) { const [n, d] = PRESENTES[b.dataset.p]; simular({ tipo: 'gift', presente: n, diamantes: d, qtd: 1 }); }
    });
    painel.querySelector('#lt-plateia').addEventListener('change', e => {
      clearInterval(timerPlateia);
      if (!e.target.checked) return;
      timerPlateia = setInterval(() => {
        const r = Math.random();
        if (r < 0.55) simular({ tipo: 'chat', texto: aleatorio(Live.textosTeste) });
        else if (r < 0.9) simular({ tipo: 'like', qtd: 1 + Math.floor(Math.random() * 15) });
        else if (r < 0.985) { const [n, d] = aleatorio(PRESENTES.slice(0, 3)); simular({ tipo: 'gift', presente: n, diamantes: d, qtd: 1 }); }
        else simular({ tipo: 'gift', presente: 'Confete', diamantes: 100, qtd: 1 });
      }, 450);
    });
    document.body.appendChild(painel);
  }
  addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT') return;
    if (e.key === 't' || e.key === 'T') abrirPainel();
    if (e.key === 'f' || e.key === 'F') document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen();
    if (e.key === 'g' || e.key === 'G') location.href = '/';
  });

  conectar();
  return { on, simular, get status() { return status; }, textosTeste: ['oi'] };
})();

// Liga o jogo ao servidor e entrega os eventos da live.
//   Live.on('chat', ev => ...)   ev = { tipo, id, nome, texto }
//   Live.on('like', ev => ...)   ev.qtd = curtidas
//   Live.on('gift', ev => ...)   ev.presente, ev.diamantes, ev.qtd
//   Live.on('follow' | 'share' | 'join' | 'status' | 'config' | '*', ...)
// A simulação (teste) fica no painel de controle, não na tela da live.
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
      if (ev.tipo === 'status') status = ev;
      if (ev.tipo === 'config') {
        Object.assign(window.CONFIG_LIVE, ev.config);
        if (typeof Som !== 'undefined') Som.volume(ev.config.volume);
        if (typeof Voz !== 'undefined') Voz.ligada = ev.config.narradora;
      }
      emitir(ev);
    };
    ws.onclose = () => setTimeout(conectar, 2000);
  }

  conectar();
  return { on, get status() { return status; } };
})();

// Tela cheia com F (útil para testar o jogo sozinho no navegador)
addEventListener('keydown', e => {
  if (e.target.tagName !== 'INPUT' && (e.key === 'f' || e.key === 'F')) {
    document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen();
  }
});

// Narradora da live: fala frases prontas com a voz do Windows/Edge (de graça).
// Procura a Thalita (voz neural do Edge); se não tiver, usa outra voz em português.
// SEGURANÇA: só fala frases prontas + nome da pessoa (já filtrado). Nunca lê comentários.
//   Voz.falar('Valeu {nome}!', { nome: 'Ana' })
//   Voz.falar(['frase 1', 'frase 2'], vars, { prioridade: true })  sorteia uma das frases
//   Voz.falar('Oba!', {}, { tom: 1.5 })  voz mais fina (personagens)
//   Voz.falar('Goal!', {}, { idioma: 'en' })  fala em inglês (jogos para público de fora)
// A narradora liga/desliga pelo painel de controle (ou tecla V no jogo).
const Voz = (() => {
  if (window.parent !== window && window.parent.Voz) return window.parent.Voz; // usa a narradora da tela da live
  const PREFERIDAS = [/thalita/i, /francisca/i, /maria/i, /pt-?br/i, /portug/i];
  const PREFERIDAS_EN = [/jenny/i, /aria/i, /ava/i, /en-us/i, /english/i];
  let voz = null, vozEn = null, falando = false, ligada = window.CONFIG_LIVE?.narradora ?? true;
  const fila = [];

  function escolherVoz(lista = PREFERIDAS) {
    const vozes = speechSynthesis.getVoices();
    for (const p of lista) {
      const v = vozes.find(v => p.test(v.name) || p.test(v.lang));
      if (v) return v;
    }
    return null;
  }
  voz = escolherVoz(); vozEn = escolherVoz(PREFERIDAS_EN);
  speechSynthesis.addEventListener('voiceschanged', () => { voz = escolherVoz(); vozEn = escolherVoz(PREFERIDAS_EN); });

  // Deixa o nome falável: tira emoji, _ e símbolos
  function nomeFalado(nome) {
    return String(nome || '').replace(/[_.]/g, ' ').replace(/[^\p{L}\p{N} ]/gu, '').replace(/\s+/g, ' ').trim().slice(0, 20) || 'galera';
  }
  // Sorteia uma frase da lista evitando as últimas usadas (para não ficar repetitivo)
  const recentes = new Map();
  function escolher(frases) {
    if (!Array.isArray(frases)) return frases;
    const usadas = recentes.get(frases) || [];
    const livres = frases.filter(f => !usadas.includes(f));
    const f = (livres.length ? livres : frases)[Math.floor(Math.random() * (livres.length || frases.length))];
    recentes.set(frases, [f, ...usadas].slice(0, Math.min(3, frases.length - 1)));
    return f;
  }
  function montar(frases, vars = {}) {
    const f = escolher(frases);
    return f.replace(/\{(\w+)\}/g, (_, k) => (k === 'nome' ? nomeFalado(vars.nome) : vars[k] ?? ''));
  }

  // Fila: falas com prioridade (agradecimentos) vão na frente, na ordem em que chegaram,
  // e nunca são descartadas antes das falas comuns.
  function falar(frases, vars, { prioridade = false, tom = 1, idioma = 'pt' } = {}) {
    if (!ligada || (typeof Som !== 'undefined' && Som.mudo)) return;
    const item = { texto: montar(frases, vars), tom, prioridade, idioma };
    if (fila.some(f => f.texto === item.texto)) return;
    if (prioridade) fila.splice(fila.filter(f => f.prioridade).length, 0, item); else fila.push(item);
    // Não deixa acumular: se a live estiver muito agitada, descarta primeiro as falas comuns mais antigas
    while (fila.length > 3) {
      const comum = fila.findIndex(f => !f.prioridade);
      if (comum >= 0) fila.splice(comum, 1);
      else if (fila.length > 6) fila.shift();
      else break;
    }
    proxima();
  }
  let atual = null, inicio = 0; // guarda a fala atual: sem isso o navegador às vezes "esquece" e a voz trava
  function terminou() {
    falando = false; atual = null;
    if (typeof Som !== 'undefined' && !fila.length) Som.abaixarMusica(false);
    setTimeout(proxima, 200);
  }
  function proxima() {
    if (falando || !fila.length) return;
    const { texto, tom, idioma } = fila.shift();
    const u = new SpeechSynthesisUtterance(texto);
    const v = idioma === 'en' ? vozEn : voz;
    if (v) u.voice = v;
    u.lang = v?.lang || (idioma === 'en' ? 'en-US' : 'pt-BR');
    u.rate = 1.08;
    u.pitch = tom;
    falando = true; atual = u; inicio = performance.now();
    if (typeof Som !== 'undefined') Som.abaixarMusica(true);
    u.onend = u.onerror = () => { if (atual === u) terminou(); };
    speechSynthesis.speak(u);
  }
  // Vigia: se uma fala travar (passa de 12s), destrava e segue a fila
  setInterval(() => {
    if (falando && performance.now() - inicio > 12000) { speechSynthesis.cancel(); terminou(); }
  }, 1000);

  addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT' || (e.key !== 'v' && e.key !== 'V')) return;
    ligar(!ligada);
  });
  function ligar(sim) {
    ligada = !!sim;
    if (!ligada) { fila.length = 0; speechSynthesis.cancel(); }
  }

  return {
    falar,
    get falando() { return falando; },
    get ligada() { return ligada; },
    set ligada(v) { ligar(v); },
    get nomeDaVoz() { return voz?.name || '(voz padrão)'; },
  };
})();

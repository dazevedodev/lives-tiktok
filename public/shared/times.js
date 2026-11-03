// Times usados nos jogos da galeria, com escudos.
//   TIMES_TODOS            todos os times (a Cobrinha usa todos)
//   TIMES                  os 4 primeiros (a Corrida usa só eles)
//   TIMES_TODOS[i].escudo  canvas com o escudo (desenhado ou oficial, tecla L troca)
//   acharTime('vai fla')   -> 0   (null se o texto não fala de nenhum time). O número do time também vale.
//   aoTrocarEscudos(fn)    avisa quando a tecla L troca os escudos
// arquivo: imagem do escudo em /jogos/corrida/escudos/ (o fundo branco é removido sozinho).
// Sem arquivo, usa um escudo desenhado: padrao 'listras' | 'listrasV' | 'tri' | 'faixa' | 'diagonal' | 'estrela' | 'liso'.
// Para colocar mais um time é só copiar uma linha (o número dele é a posição na lista).
const TIMES_TODOS = [
  { nome: 'Flamengo', sigla: 'FLA', cor: '#e3262f', faixa: '#111111', ui: '#ff4d55', padrao: 'listras', arquivo: 'flamengo.png', chaves: ['flamengo', 'fla', 'mengo', 'mengao'] },
  { nome: 'Corinthians', sigla: 'SCCP', cor: '#1b1b1b', faixa: '#ffffff', ui: '#e8e8e8', padrao: 'liso', arquivo: 'corinthians.png', chaves: ['corinthians', 'timao', 'coringao', 'curintia'] },
  { nome: 'Palmeiras', sigla: 'SEP', cor: '#1f9d47', faixa: '#ffffff', ui: '#3fd36f', padrao: 'liso', arquivo: 'palmeiras.png', chaves: ['palmeiras', 'verdao', 'porco', 'palestra'] },
  { nome: 'São Paulo', sigla: 'SPFC', cor: '#ffffff', faixa: '#d81f26', faixa2: '#111111', ui: '#ff8a8a', padrao: 'faixa', arquivo: 'saopaulo.webp', chaves: ['sao paulo', 'saopaulo', 'spfc', 'tricolor paulista', 'sp'] },
  { nome: 'Santos', sigla: 'SFC', cor: '#ffffff', faixa: '#111111', ui: '#d9e1e6', padrao: 'listrasV', chaves: ['santos', 'peixe', 'peixao', 'sfc'] },
  { nome: 'Grêmio', sigla: 'GRE', cor: '#0d80bf', faixa: '#111111', faixa2: '#ffffff', ui: '#4fb3ff', padrao: 'tri', chaves: ['gremio', 'imortal', 'tricolor gaucho', 'gre'] },
  { nome: 'Internacional', sigla: 'INT', cor: '#d6111c', faixa: '#ffffff', ui: '#ff5a5a', padrao: 'liso', chaves: ['inter', 'internacional', 'colorado', 'saci'] },
  { nome: 'Vasco', sigla: 'VAS', cor: '#111111', faixa: '#ffffff', ui: '#c9c9c9', padrao: 'diagonal', chaves: ['vasco', 'vascao', 'gigante da colina', 'vas'] },
  { nome: 'Cruzeiro', sigla: 'CRU', cor: '#1340a8', faixa: '#ffffff', ui: '#6b97ff', padrao: 'estrela', chaves: ['cruzeiro', 'raposa', 'cabuloso', 'cru'] },
  { nome: 'Atlético-MG', sigla: 'CAM', cor: '#111111', faixa: '#ffffff', ui: '#b5b5b5', padrao: 'listrasV', chaves: ['galo', 'atletico', 'atletico mg', 'atletico mineiro', 'cam', 'galao'] },
  { nome: 'Bahia', sigla: 'BAH', cor: '#ffffff', faixa: '#1556b5', faixa2: '#e21b23', ui: '#5b95ff', padrao: 'faixa', chaves: ['bahia', 'bahea', 'esquadrao', 'bah', 'bba'] },
  { nome: 'Vitória', sigla: 'VIT', cor: '#e3262f', faixa: '#111111', ui: '#ff7a45', padrao: 'listrasV', chaves: ['vitoria', 'leao da barra', 'ecv', 'vit'] },
  { nome: 'Fluminense', sigla: 'FLU', cor: '#8a1538', faixa: '#00843d', faixa2: '#ffffff', ui: '#e0517f', padrao: 'tri', chaves: ['fluminense', 'flu', 'nense', 'fluzao'] },
  { nome: 'Botafogo', sigla: 'BOT', cor: '#111111', faixa: '#ffffff', ui: '#eeeeee', padrao: 'estrela', chaves: ['botafogo', 'fogao', 'bota', 'glorioso', 'bfr'] },
];
TIMES_TODOS.forEach((t, i) => t.chaves.unshift(String(i + 1)));
const TIMES = TIMES_TODOS.slice(0, 4);

function normalizar(t) {
  return (t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
}
function acharTime(texto, lista = TIMES) {
  const t = ' ' + normalizar(texto) + ' ';
  const i = lista.findIndex(time => time.chaves.some(k => t.includes(' ' + k + ' ')));
  return i < 0 ? null : i;
}

const aoTrocarEscudos = (() => {
  function desenharEscudo(t) {
    const e = document.createElement('canvas');
    e.width = e.height = 128;
    const g = e.getContext('2d');
    const forma = () => {
      g.beginPath();
      g.moveTo(14, 10); g.lineTo(114, 10); g.lineTo(114, 58);
      g.quadraticCurveTo(114, 102, 64, 122); g.quadraticCurveTo(14, 102, 14, 58);
      g.closePath();
    };
    forma(); g.fillStyle = t.cor; g.fill();
    g.save(); forma(); g.clip();
    g.fillStyle = t.faixa;
    if (t.padrao === 'listras') for (let y = 22; y < 128; y += 26) g.fillRect(0, y, 128, 13);
    if (t.padrao === 'listrasV') for (let x = 27; x < 114; x += 26) g.fillRect(x, 0, 13, 128);
    if (t.padrao === 'tri') for (let x = 14, k = 0; x < 114; x += 14, k++) { g.fillStyle = k % 2 ? t.faixa2 : t.faixa; if (k % 3 !== 2) g.fillRect(x, 0, 14, 128); }
    if (t.padrao === 'faixa') { g.fillRect(0, 44, 128, 14); g.fillStyle = t.faixa2 || '#111'; g.fillRect(0, 58, 128, 14); }
    if (t.padrao === 'diagonal') { g.translate(64, 64); g.rotate(Math.PI / 4); g.fillRect(-90, -11, 180, 22); g.setTransform(1, 0, 0, 1, 0, 0); }
    if (t.padrao === 'estrela') {
      g.beginPath();
      for (let k = 0; k < 10; k++) {
        const r = k % 2 ? 7 : 17, a = -Math.PI / 2 + k * Math.PI / 5;
        g.lineTo(64 + Math.cos(a) * r, 30 + Math.sin(a) * r);
      }
      g.fill();
    }
    g.restore();
    forma(); g.lineWidth = 7; g.strokeStyle = t.padrao === 'liso' ? t.faixa : '#fff'; g.stroke();
    // Sigla com fundo para ler em cima das listras
    g.font = `900 ${t.sigla.length > 3 ? 30 : 38}px system-ui, sans-serif`;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    const ys = t.padrao === 'estrela' ? 74 : 60;
    g.lineWidth = 6; g.strokeStyle = '#000c'; g.strokeText(t.sigla, 64, ys);
    g.fillStyle = '#fff'; g.fillText(t.sigla, 64, ys);
    return e;
  }
  // Apaga o fundo branco que encosta na borda da imagem (o branco de dentro do escudo fica).
  function tirarFundoBranco(img) {
    const N = 256, e = document.createElement('canvas');
    e.width = e.height = N;
    const g = e.getContext('2d');
    const s = Math.min(N / img.width, N / img.height);
    g.drawImage(img, (N - img.width * s) / 2, (N - img.height * s) / 2, img.width * s, img.height * s);
    const dados = g.getImageData(0, 0, N, N), p = dados.data;
    const claro = i => p[i * 4 + 3] < 20 || (p[i * 4] > 225 && p[i * 4 + 1] > 225 && p[i * 4 + 2] > 225);
    const visto = new Uint8Array(N * N), fila = [];
    for (let k = 0; k < N; k++) fila.push(k, (N - 1) * N + k, k * N, k * N + N - 1);
    while (fila.length) {
      const i = fila.pop();
      if (visto[i] || !claro(i)) continue;
      visto[i] = 1;
      p[i * 4 + 3] = 0;
      const x = i % N, y = (i / N) | 0;
      if (x > 0) fila.push(i - 1); if (x < N - 1) fila.push(i + 1);
      if (y > 0) fila.push(i - N); if (y < N - 1) fila.push(i + N);
    }
    g.putImageData(dados, 0, 0);
    return e;
  }

  // Tecla L troca entre escudos desenhados (padrão, mais seguro) e as imagens oficiais.
  let oficiais = false;
  try { oficiais = localStorage.getItem('corrida-escudos-oficiais') === '1'; } catch { /* sem armazenamento */ }
  const ouvintes = [];
  TIMES_TODOS.forEach(t => {
    t.desenhado = desenharEscudo(t);
    Object.defineProperty(t, 'escudo', { get: () => (oficiais && t.oficial) || t.desenhado });
    if (!t.arquivo) return;
    const img = new Image();
    img.onload = () => { t.oficial = tirarFundoBranco(img); };
    img.src = `/jogos/corrida/escudos/${t.arquivo}`;
  });
  addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT' || (e.key !== 'l' && e.key !== 'L')) return;
    oficiais = !oficiais;
    try { localStorage.setItem('corrida-escudos-oficiais', oficiais ? '1' : '0'); } catch { /* ignora */ }
    for (const fn of ouvintes) fn(oficiais);
  });
  return fn => ouvintes.push(fn);
})();

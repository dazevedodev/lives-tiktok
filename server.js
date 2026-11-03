// Servidor das lives: lê comentários/curtidas/presentes da sua live no TikTok
// e repassa tudo para os jogos abertos no navegador (http://localhost:3000).
//
//   npm run teste             -> modo teste, sem TikTok (aperte T no jogo para simular)
//   npm start                 -> conecta na live do @ salvo (dá pra digitar o @ na galeria)
//   npm start -- seu_usuario  -> conecta na live de @seu_usuario e salva para as próximas vezes
//
// Só LÊ a live, como um espectador. Não usa sua senha nem posta nada na sua conta.
const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');

const PORTA = Number(process.env.PORT) || 3000;
const PUBLIC = path.join(__dirname, 'public');
const ARQ_CONFIG = path.join(__dirname, 'config.json');
const args = process.argv.slice(2);
const MODO_TESTE = args.includes('--teste');

function lerConfig() {
  try { return JSON.parse(fs.readFileSync(ARQ_CONFIG, 'utf8')); } catch { return {}; }
}
function salvarConfig(cfg) {
  fs.writeFileSync(ARQ_CONFIG, JSON.stringify(cfg, null, 2) + '\n');
}
const limparUsuario = u => (u || '').trim().replace(/^@/, '').replace(/^https?:\/\/(www\.)?tiktok\.com\/@/, '').split(/[/?]/)[0];
const usuarioValido = u => /^[a-zA-Z0-9_.]{2,24}$/.test(u);

let usuario = limparUsuario(args.find(a => !a.startsWith('--')) || lerConfig().usuario);
if (usuarioValido(usuario) && args.some(a => !a.startsWith('--'))) salvarConfig({ ...lerConfig(), usuario });

const TIPOS = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml',
  '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav',
};
// Bibliotecas servidas direto do node_modules
const EXTRAS = {
  '/lib/matter.js': path.join(__dirname, 'node_modules/matter-js/build/matter.min.js'),
  '/lib/three.module.js': path.join(__dirname, 'node_modules/three/build/three.module.js'),
  '/lib/three.core.js': path.join(__dirname, 'node_modules/three/build/three.core.js'),
};

const server = http.createServer((req, res) => {
  let url = decodeURIComponent(req.url.split('?')[0]);
  if (url.endsWith('/')) url += 'index.html';
  // Extras do Three.js (brilho neon etc.) vêm da pasta examples/jsm
  const JSM = path.join(__dirname, 'node_modules/three/examples/jsm');
  const arquivo = EXTRAS[url] || (url.startsWith('/lib/jsm/')
    ? path.join(JSM, path.normalize(url.slice('/lib/jsm/'.length)))
    : path.join(PUBLIC, path.normalize(url)));
  if (!EXTRAS[url] && !arquivo.startsWith(PUBLIC) && !arquivo.startsWith(JSM)) { res.writeHead(403); return res.end(); }
  fs.readFile(arquivo, (err, dados) => {
    if (err) { res.writeHead(404); return res.end('Não encontrado'); }
    res.writeHead(200, { 'Content-Type': TIPOS[path.extname(arquivo)] || 'application/octet-stream' });
    res.end(dados);
  });
});

// ---------- Filtro de nomes ----------
// Nomes com palavrão/ofensa aparecem como "Torcedor" na tela, para a live não ser denunciada.
const PROIBIDO_TRECHO = ['porra', 'caralh', 'buceta', 'boceta', 'merda', 'foda', 'fuder', 'foder', 'arrombad', 'cuzao',
  'vagabund', 'xoxota', 'xota', 'punheta', 'boquete', 'piroca', 'viado', 'viadinho', 'estupr', 'pedof', 'nazi', 'hitler',
  'porn', 'putaria', 'puta', 'puto', 'piranha', 'vadia', 'safad', 'retardad', 'macaca', 'macaco', 'nude', 'xvideo',
  'pinto', 'penis', 'vagina', 'bct', 'fdp', 'pqp', 'vsf', 'tnc', 'krl', 'crl', 'sexo', 'sexy', 'onlyfans'];
const PROIBIDO_PALAVRA = ['cu', 'pau', 'rola', 'bicha', 'mongol', 'corno', 'sex', 'nigga', 'nigger'];
function nomeSeguro(nome) {
  nome = String(nome || '').replace(/[\u0000-\u001f​-‏‪-‮]/g, '').trim().slice(0, 24);
  const n = nome.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/0/g, 'o').replace(/1/g, 'i').replace(/3/g, 'e').replace(/4/g, 'a').replace(/5/g, 's').replace(/@/g, 'a');
  const junto = n.replace(/[^a-z]/g, '');
  const palavras = n.split(/[^a-z]+/);
  if (!nome || PROIBIDO_TRECHO.some(p => junto.includes(p)) || PROIBIDO_PALAVRA.some(p => palavras.includes(p))) return 'Torcedor';
  return nome;
}

// ---------- WebSocket: servidor -> jogos ----------
const wss = new WebSocketServer({ server });
const status = { tipo: 'status', modo: MODO_TESTE ? 'teste' : 'live', usuario, conectado: false, msg: '' };

function enviar(evento) {
  if (evento.nome != null) evento.nome = nomeSeguro(evento.nome);
  const texto = JSON.stringify(evento);
  for (const c of wss.clients) if (c.readyState === 1) c.send(texto);
}
function setStatus(mudancas) {
  Object.assign(status, mudancas);
  enviar(status);
}

wss.on('connection', ws => {
  ws.send(JSON.stringify(status));
  ws.on('message', raw => {
    let ev;
    try { ev = JSON.parse(raw); } catch { return; }
    // O painel de teste do navegador manda eventos falsos por aqui
    if (['chat', 'like', 'gift', 'follow', 'share', 'join'].includes(ev?.tipo)) enviar({ ...ev, simulado: true });
    // A galeria manda o @ da conta
    if (ev?.tipo === 'definirUsuario') {
      const u = limparUsuario(ev.usuario);
      if (!usuarioValido(u)) return setStatus({ msg: 'Esse @ não parece válido' });
      usuario = u;
      salvarConfig({ ...lerConfig(), usuario });
      setStatus({ usuario, conectado: false, msg: 'Conectando...' });
      if (!MODO_TESTE) conectarTikTok();
    }
  });
});

// ---------- Conexão com a live do TikTok ----------
let conexao = null, tentativa = null, geracao = 0;

function pessoa(d) {
  const u = d.user || {};
  return {
    id: u.uniqueId || u.displayId || u.id || 'anonimo',
    nome: u.nickname || u.uniqueId || 'Anônimo',
    foto: u.profilePictureUrl || u.avatarThumb?.urlList?.[0] || '',
  };
}

async function conectarTikTok() {
  const minha = ++geracao; // se o @ mudar, a conexão antiga é descartada
  clearTimeout(tentativa);
  if (conexao) { try { conexao.disconnect(); } catch { /* já desconectada */ } conexao = null; }
  const tentarDeNovo = msg => {
    if (minha !== geracao) return;
    setStatus({ conectado: false, msg });
    tentativa = setTimeout(conectarTikTok, 20000);
  };

  const { TikTokLiveConnection, WebcastEvent, ControlEvent } = require('tiktok-live-connector');
  let conn;
  try {
    conn = new TikTokLiveConnection(usuario, {});
  } catch (err) {
    console.log('❌ Erro ao preparar a conexão:', err?.message || err);
    return tentarDeNovo('Erro ao conectar. Tentando de novo em 20s...');
  }
  conexao = conn;
  const se = fn => d => { if (minha === geracao) fn(d); };

  conn.on(WebcastEvent.CHAT, se(d => enviar({ tipo: 'chat', ...pessoa(d), texto: d.comment || '' })));
  conn.on(WebcastEvent.LIKE, se(d => enviar({ tipo: 'like', ...pessoa(d), qtd: d.likeCount || 1 })));
  conn.on(WebcastEvent.FOLLOW, se(d => enviar({ tipo: 'follow', ...pessoa(d) })));
  conn.on(WebcastEvent.SHARE, se(d => enviar({ tipo: 'share', ...pessoa(d) })));
  conn.on(WebcastEvent.MEMBER, se(d => enviar({ tipo: 'join', ...pessoa(d) })));
  conn.on(WebcastEvent.GIFT, se(d => {
    const g = d.giftDetails || d.gift || {};
    const combo = (g.giftType ?? g.type) === 1 || g.combo;
    if (combo && !d.repeatEnd) return; // sequência em andamento: espera o final
    const qtd = d.repeatCount || 1;
    enviar({
      tipo: 'gift', ...pessoa(d), qtd,
      presente: g.giftName || g.name || 'Presente',
      diamantes: (g.diamondCount || 1) * qtd,
    });
  }));
  conn.on(WebcastEvent.ROOM_USER, se(d => enviar({ tipo: 'espectadores', qtd: d.viewerCount || 0 })));
  conn.on(ControlEvent.DISCONNECTED, () => tentarDeNovo('Desconectado. Tentando de novo em 20s...'));
  conn.on(WebcastEvent.STREAM_END, se(() => setStatus({ conectado: false, msg: 'A live terminou.' })));

  try {
    await conn.connect();
    if (minha !== geracao) return conn.disconnect();
    console.log(`✅ Conectado na live de @${usuario}`);
    setStatus({ conectado: true, msg: '' });
  } catch (err) {
    console.log(`⏳ @${usuario} não está ao vivo ainda (${String(err?.message || err).slice(0, 120)}). Tentando de novo em 20s...`);
    tentarDeNovo('Esperando a live começar...');
  }
}

// Um erro inesperado não pode derrubar o servidor no meio da live
process.on('uncaughtException', err => console.log('⚠️  Erro inesperado (o servidor continua):', err?.message || err));
process.on('unhandledRejection', err => console.log('⚠️  Erro inesperado (o servidor continua):', err?.message || err));

// Só o próprio PC acessa (ninguém da rede consegue abrir o jogo ou mexer nele)
server.listen(PORTA, '127.0.0.1', () => {
  console.log(`\n🎮 Galeria de jogos: http://localhost:${PORTA}\n`);
  if (MODO_TESTE) {
    console.log('🧪 MODO TESTE: abra um jogo e aperte T para o painel de simulação.');
  } else if (!usuarioValido(usuario)) {
    setStatus({ msg: 'Digite o @ da conta na galeria' });
    console.log('⚠️  Falta o @ da conta: digite na galeria (http://localhost:3000).');
  } else {
    conectarTikTok();
  }
});

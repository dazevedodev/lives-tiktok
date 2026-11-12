// Live Interativa: servidor que lê a live do TikTok (só como espectador) e controla os jogos.
//   http://127.0.0.1:4517        painel de controle (só no PC de quem faz a live)
//   http://127.0.0.1:4517/tela   tela da live (é ela que vai no TikTok LIVE Studio / OBS)
//
//   npm start          liga de verdade (conecta na live do @ salvo no painel)
//   npm run teste      modo teste, sem TikTok (simule tudo pelo painel)
//
// Não usa senha nem posta nada na conta. Só lê comentários, curtidas e presentes.
const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');

const PORTA = Number(process.env.PORT) || 4517; // porta própria (3000 costuma estar ocupada por outros programas)
const ENDERECO = `http://127.0.0.1:${PORTA}`; // 127.0.0.1 e não "localhost" (no Windows o localhost pode cair em outro programa)
const PUBLIC = path.join(__dirname, 'public');
const ARQ_CONFIG = path.join(__dirname, 'config.json');
const MODO_TESTE = process.argv.includes('--teste');

// ---------- Configuração (salva em config.json) ----------
const PADRAO = {
  usuario: '',
  jogo: 'corrida',
  narradora: true,
  volume: 0.8,
  marca: { nome: '', cor: '#ff2d6f', logo: '' },
  equipes: [
    { nome: 'Fogo', emoji: '🔥', cor: '#ff4b3e', palavras: ['fogo'] },
    { nome: 'Água', emoji: '💧', cor: '#2f8cff', palavras: ['agua'] },
    { nome: 'Raio', emoji: '⚡', cor: '#ffc61a', palavras: ['raio'] },
    { nome: 'Folha', emoji: '🍀', cor: '#2fd16a', palavras: ['folha'] },
  ],
};
const jogoExiste = id => /^[a-z0-9-]{2,30}$/.test(id) && fs.existsSync(path.join(PUBLIC, 'jogos', id, 'index.html'));

function lerConfig() {
  let salvo = {};
  try { salvo = JSON.parse(fs.readFileSync(ARQ_CONFIG, 'utf8')); } catch { /* primeira vez */ }
  return { ...PADRAO, ...salvo, marca: { ...PADRAO.marca, ...salvo.marca } };
}
let config = lerConfig();
function salvarConfig() {
  fs.writeFileSync(ARQ_CONFIG, JSON.stringify(config, null, 2) + '\n');
}

const limparUsuario = u => String(u || '').trim().replace(/^@/, '').replace(/^https?:\/\/(www\.)?tiktok\.com\/@/, '').split(/[/?]/)[0];
const usuarioValido = u => /^[a-zA-Z0-9_.]{2,24}$/.test(u);
const cor = (c, padrao) => (/^#[0-9a-f]{6}$/i.test(c) ? c : padrao);
const textoCurto = (t, max) => String(t ?? '').replace(/[<>\u0000-\u001f]/g, '').trim().slice(0, max);

// Confere tudo que chega do painel antes de salvar (nada de texto gigante ou formato estranho)
function limparEquipes(lista) {
  if (!Array.isArray(lista) || lista.length < 2 || lista.length > 8) return null;
  return lista.map((e, i) => {
    const eq = {
      nome: textoCurto(e.nome, 18) || `Equipe ${i + 1}`,
      emoji: textoCurto(e.emoji, 8),
      cor: cor(e.cor, '#888888'),
      palavras: (Array.isArray(e.palavras) ? e.palavras : []).map(p => textoCurto(p, 24).toLowerCase()).filter(Boolean).slice(0, 10),
    };
    // Equipes do modelo "times" usam escudo desenhado em vez de emoji
    if (e.escudo) {
      eq.escudo = {
        sigla: textoCurto(e.escudo.sigla, 5),
        padrao: ['listras', 'listrasV', 'tri', 'faixa', 'diagonal', 'estrela', 'liso'].includes(e.escudo.padrao) ? e.escudo.padrao : 'liso',
        faixa: cor(e.escudo.faixa, '#ffffff'),
        faixa2: e.escudo.faixa2 ? cor(e.escudo.faixa2, '#111111') : undefined,
      };
    }
    // Visual do boneco 3D da Batalha (opcional; sem isso o jogo usa as cores da equipe)
    if (e.boneco) {
      const b = e.boneco, eb = {};
      for (const k of ['camisa', 'faixa', 'corNumero', 'calcao', 'meiao', 'pele', 'corCabelo', 'corBarba']) if (b[k]) eb[k] = cor(b[k], '#888888');
      if (b.numero) eb.numero = textoCurto(String(b.numero), 2);
      if (['topete', 'medio', 'curto', 'careca'].includes(b.cabelo)) eb.cabelo = b.cabelo;
      if (b.listras != null) eb.listras = !!b.listras;
      if (b.barba != null) eb.barba = !!b.barba;
      eq.boneco = eb;
    }
    return eq;
  });
}
function aplicarConfig(novo) {
  if (novo.equipes) { const eq = limparEquipes(novo.equipes); if (eq) config.equipes = eq; }
  if (novo.marca) {
    const logo = String(novo.marca.logo ?? config.marca.logo);
    config.marca = {
      nome: textoCurto(novo.marca.nome ?? config.marca.nome, 30),
      cor: cor(novo.marca.cor, config.marca.cor),
      // logo pequena em data URL (até ~400 KB)
      logo: /^data:image\/(png|jpeg|webp);base64,[a-z0-9+/=]+$/i.test(logo) && logo.length < 550000 ? logo : '',
    };
  }
  if (typeof novo.narradora === 'boolean') config.narradora = novo.narradora;
  if (novo.volume != null) config.volume = Math.max(0, Math.min(1, Number(novo.volume) || 0));
  salvarConfig();
}
// O que os jogos podem saber (o @ da conta não vai para a tela da live)
const configPublica = () => ({ jogo: config.jogo, narradora: config.narradora, volume: config.volume, marca: config.marca, equipes: config.equipes });

// ---------- Arquivos ----------
const TIPOS = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.woff2': 'font/woff2',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml',
};
const EXTRAS = {
  '/lib/matter.js': path.join(__dirname, 'node_modules/matter-js/build/matter.min.js'),
  '/lib/three.module.js': path.join(__dirname, 'node_modules/three/build/three.module.js'),
  '/lib/three.core.js': path.join(__dirname, 'node_modules/three/build/three.core.js'),
};
const JSM = path.join(__dirname, 'node_modules/three/examples/jsm');

const server = http.createServer((req, res) => {
  let url;
  try { url = decodeURIComponent(req.url.split('?')[0]); } catch { res.writeHead(400); return res.end(); }
  // Configuração lida na hora pelos jogos, antes de começarem
  if (url === '/config.js') {
    res.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8', 'Cache-Control': 'no-store' });
    return res.end(`window.CONFIG_LIVE = ${JSON.stringify(configPublica())};`);
  }
  if (url === '/') url = '/painel/';
  if (url === '/tela') url = '/tela/';
  if (url.endsWith('/')) url += 'index.html';
  const arquivo = EXTRAS[url] || (url.startsWith('/lib/jsm/')
    ? path.join(JSM, path.normalize(url.slice('/lib/jsm/'.length)))
    : path.join(PUBLIC, path.normalize(url)));
  if (!EXTRAS[url] && !arquivo.startsWith(PUBLIC) && !arquivo.startsWith(JSM)) { res.writeHead(403); return res.end(); }
  fs.readFile(arquivo, (err, dados) => {
    if (err) { res.writeHead(404); return res.end('Não encontrado'); }
    res.writeHead(200, { 'Content-Type': TIPOS[path.extname(arquivo)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(dados);
  });
});

// ---------- Filtro de nomes ----------
// Nomes com palavrão/ofensa aparecem como "Participante" na tela, para a live não ser denunciada.
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
  if (!nome || PROIBIDO_TRECHO.some(p => junto.includes(p)) || PROIBIDO_PALAVRA.some(p => palavras.includes(p))) return 'Participante';
  return nome;
}

// ---------- WebSocket: servidor <-> painel e jogos ----------
const wss = new WebSocketServer({ server });
wss.on('error', () => {}); // erro de porta ocupada é tratado no server.on('error')
const status = { tipo: 'status', modo: MODO_TESTE ? 'teste' : 'live', usuario: config.usuario, conectado: false, msg: '', espectadores: 0 };

function enviar(evento) {
  if (evento.nome != null) evento.nome = nomeSeguro(evento.nome);
  const texto = JSON.stringify(evento);
  for (const c of wss.clients) if (c.readyState === 1) c.send(texto);
}
function setStatus(mudancas) {
  Object.assign(status, mudancas);
  enviar(status);
}
// Simulação só quando NÃO está ligado numa live de verdade: evento falso numa live real
// enganaria quem está assistindo (e é o tipo de coisa que dá problema com o TikTok).
const podeSimular = () => MODO_TESTE || !status.conectado;

wss.on('connection', ws => {
  ws.send(JSON.stringify(status));
  ws.send(JSON.stringify({ tipo: 'config', config: configPublica(), usuario: config.usuario }));
  ws.on('message', raw => {
    let ev;
    try { ev = JSON.parse(raw); } catch { return; }
    if (!ev || typeof ev !== 'object') return;

    if (['chat', 'like', 'gift', 'follow', 'share', 'join'].includes(ev.tipo)) {
      if (!podeSimular()) return;
      return enviar({
        tipo: ev.tipo, simulado: true,
        id: textoCurto(ev.id, 40) || 'teste', nome: textoCurto(ev.nome, 24) || 'Teste', foto: '',
        texto: textoCurto(ev.texto, 150), qtd: Math.max(1, Math.min(999, Number(ev.qtd) || 1)),
        presente: textoCurto(ev.presente, 30), diamantes: Math.max(1, Math.min(50000, Number(ev.diamantes) || 1)),
      });
    }
    if (ev.tipo === 'definirUsuario') {
      const u = limparUsuario(ev.usuario);
      if (!usuarioValido(u)) return setStatus({ msg: 'Esse @ não parece válido' });
      config.usuario = u;
      salvarConfig();
      setStatus({ usuario: u, conectado: false, msg: MODO_TESTE ? '' : 'Conectando...' });
      if (!MODO_TESTE) conectarTikTok();
    }
    if (ev.tipo === 'trocarJogo' && jogoExiste(ev.jogo)) {
      config.jogo = ev.jogo;
      salvarConfig();
      enviar({ tipo: 'trocarJogo', jogo: ev.jogo });
    }
    if (ev.tipo === 'salvarConfig' && ev.config) {
      aplicarConfig(ev.config);
      enviar({ tipo: 'config', config: configPublica(), usuario: config.usuario, recarregar: !!ev.recarregar });
    }
    // Comandos rápidos do painel para a tela (recomeçar o jogo etc.)
    if (ev.tipo === 'comando' && ['recarregar', 'som'].includes(ev.acao)) enviar({ tipo: 'comando', acao: ev.acao });
  });
});

// ---------- Conexão com a live do TikTok ----------
let conexao = null, tentativa = null, geracao = 0;

function pessoa(d) {
  const u = d.user || {};
  return {
    id: u.uniqueId || u.displayId || u.id || 'anonimo',
    nome: u.nickname || u.uniqueId || 'Anônimo',
    foto: '', // fotos ficam desligadas: uma foto imprópria na tela poderia gerar denúncia da live
  };
}

async function conectarTikTok() {
  const minha = ++geracao; // se o @ mudar, a conexão antiga é descartada
  clearTimeout(tentativa);
  if (conexao) { try { conexao.disconnect(); } catch { /* já desconectada */ } conexao = null; }
  if (!usuarioValido(config.usuario)) return setStatus({ conectado: false, msg: 'Digite o @ da conta no painel' });
  const tentarDeNovo = msg => {
    if (minha !== geracao) return;
    setStatus({ conectado: false, msg });
    tentativa = setTimeout(conectarTikTok, 20000);
  };

  const { TikTokLiveConnection, WebcastEvent, ControlEvent } = require('tiktok-live-connector');
  let conn;
  try {
    conn = new TikTokLiveConnection(config.usuario, {});
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
  conn.on(WebcastEvent.ROOM_USER, se(d => setStatus({ espectadores: d.viewerCount || 0 })));
  conn.on(ControlEvent.DISCONNECTED, () => tentarDeNovo('Desconectado. Tentando de novo em 20s...'));
  conn.on(WebcastEvent.STREAM_END, se(() => setStatus({ conectado: false, msg: 'A live terminou.' })));

  try {
    await conn.connect();
    if (minha !== geracao) return conn.disconnect();
    console.log(`✅ Conectado na live de @${config.usuario}`);
    setStatus({ conectado: true, msg: '' });
  } catch (err) {
    console.log(`⏳ @${config.usuario} não está ao vivo ainda (${String(err?.message || err).slice(0, 120)}). Tentando de novo em 20s...`);
    tentarDeNovo('Esperando a live começar...');
  }
}

// Um erro inesperado não pode derrubar o servidor no meio da live
process.on('uncaughtException', err => console.log('⚠️  Erro inesperado (o servidor continua):', err?.message || err));
process.on('unhandledRejection', err => console.log('⚠️  Erro inesperado (o servidor continua):', err?.message || err));

// Abre o painel e a tela no Edge, em janelas próprias (perfil separado, som liberado sem clique).
// Só acontece com --abrir (o atalho "Live Interativa.bat" usa).
function abrirNavegador() {
  if (!process.argv.includes('--abrir') || process.platform !== 'win32') return;
  const { spawn } = require('child_process');
  const edge = [
    path.join(process.env['ProgramFiles(x86)'] || '', 'Microsoft/Edge/Application/msedge.exe'),
    path.join(process.env.ProgramFiles || '', 'Microsoft/Edge/Application/msedge.exe'),
  ].find(f => fs.existsSync(f));
  const perfil = path.join(process.env.LOCALAPPDATA || __dirname, 'LiveInterativa', 'navegador');
  const base = [`--user-data-dir=${perfil}`, '--autoplay-policy=no-user-gesture-required', '--no-first-run', '--no-default-browser-check'];
  const abrir = (args) => edge
    ? spawn(edge, [...base, ...args], { detached: true, stdio: 'ignore' }).unref()
    : spawn('cmd', ['/c', 'start', '', args.at(-1).replace('--app=', '')], { detached: true, stdio: 'ignore' }).unref();
  abrir([`--app=${ENDERECO}/`]);
  setTimeout(() => abrir(['--window-size=540,980', `--app=${ENDERECO}/tela`]), 1500);
}

// Já estava aberto? Só abre as janelas de novo e fecha esta cópia.
server.on('error', err => {
  if (err.code !== 'EADDRINUSE') throw err;
  console.log('\nℹ️  A Live Interativa já está aberta neste PC. Abrindo as janelas...');
  abrirNavegador();
  setTimeout(() => process.exit(0), 4000);
});

// Só o próprio PC acessa (ninguém da rede consegue abrir o painel ou mexer nele)
server.listen(PORTA, '127.0.0.1', () => {
  console.log(`\n🎮 Live Interativa ligada`);
  console.log(`   Painel:        ${ENDERECO}`);
  console.log(`   Tela da live:  ${ENDERECO}/tela`);
  console.log(`   Para desligar, feche esta janela.\n`);
  if (MODO_TESTE) console.log('🧪 MODO TESTE: simule comentários, curtidas e presentes pelo painel.');
  else conectarTikTok();
  abrirNavegador();
});

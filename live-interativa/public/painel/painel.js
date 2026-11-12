// Painel de controle da Live Interativa: escolhe o jogo, configura equipes e marca, testa e conecta.
const $ = s => document.querySelector(s);
const esc = t => String(t ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

let ws = null, status = {}, config = null, usuario = '';
let equipesEditando = null; // cópia das equipes enquanto edita (só salva no botão)

function enviar(ev) { if (ws?.readyState === 1) ws.send(JSON.stringify(ev)); }
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg; t.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => { t.hidden = true; }, 2600);
}

// ---------- Conexão com o servidor ----------
function conectar() {
  ws = new WebSocket(`ws://${location.host}`);
  ws.onmessage = m => {
    const ev = JSON.parse(m.data);
    if (ev.tipo === 'status') { status = ev; mostrarStatus(); }
    if (ev.tipo === 'config') {
      const primeira = !config;
      config = ev.config; usuario = ev.usuario || '';
      if (primeira || !equipesEditando) equipesEditando = structuredClone(config.equipes);
      mostrarTudo(primeira);
    }
    if (ev.tipo === 'trocarJogo' && config) { config.jogo = ev.jogo; mostrarJogos(); mostrarNoAr(); }
  };
  ws.onclose = () => {
    status = { desligado: true }; mostrarStatus();
    setTimeout(conectar, 2000);
  };
}

function mostrarStatus() {
  const el = $('#status');
  el.className = 'pilula';
  let texto, detalhe = '';
  if (status.desligado) { el.classList.add('erro'); texto = 'Servidor desligado'; detalhe = 'Abra o atalho "Live Interativa" de novo.'; }
  else if (status.modo === 'teste') { el.classList.add('teste'); texto = 'Modo teste'; detalhe = 'Modo teste: não conecta no TikTok. Use a aba Testar.'; }
  else if (status.conectado) { el.classList.add('ok'); texto = `Ao vivo: @${status.usuario}`; detalhe = `✅ Conectado na live de @${status.usuario}.`; }
  else if (!status.usuario) { el.classList.add('alerta'); texto = 'Falta o @ da conta'; detalhe = 'Digite o @ da conta acima e clique em Salvar.'; }
  else { el.classList.add('alerta'); texto = `@${status.usuario}: aguardando`; detalhe = `⏳ ${status.msg || 'Conectando...'} Assim que a live começar, conecta sozinho.`; }
  el.textContent = texto;
  $('#status-detalhe').textContent = detalhe;
  const esp = $('#espectadores');
  esp.hidden = !status.conectado;
  esp.textContent = `👀 ${status.espectadores || 0} assistindo`;
  const pode = status.modo === 'teste' || !status.conectado;
  $('#testar-bloqueado').hidden = pode;
  $('#testar-controles').hidden = !pode;
  if (!pode) pararPlateia();
}

function mostrarTudo(primeira) {
  mostrarJogos();
  mostrarNoAr();
  mostrarEquipes();
  mostrarBotoesTeste();
  if (primeira) {
    $('#narradora').checked = config.narradora;
    $('#volume').value = config.volume;
    $('#marca-nome').value = config.marca.nome;
    $('#marca-cor').value = config.marca.cor;
    logoAtual = config.marca.logo;
    mostrarEtiqueta();
  }
  if (document.activeElement !== $('#usuario')) $('#usuario').value = usuario;
}

// ---------- Jogos ----------
function mostrarJogos() {
  $('#nichos').innerHTML = NICHOS.map(n => `
    <div class="nicho">
      <div class="nicho-titulo"><h2>${n.emoji} ${esc(n.nome)}</h2></div>
      <p>${esc(n.desc)}</p>
      <div class="jogos">${n.jogos.map(id => {
        const j = JOGOS[id], noAr = config?.jogo === id;
        return `<article class="jogo ${noAr ? 'no-ar' : ''}">
          <div class="jogo-arte" style="background:linear-gradient(135deg, ${j.cores[0]}, ${j.cores[1]})">
            ${noAr ? '<span class="selo-no-ar">● NO AR</span>' : ''}<span>${j.emoji}</span></div>
          <div class="jogo-corpo">
            <h4>${esc(j.nome)}</h4>
            <p>${esc(j.resumo)}</p>
            <ul>${j.como.map(c => `<li>${esc(c)}</li>`).join('')}</ul>
            <span class="jogo-equipes">${esc(j.equipes)}</span>
            <button class="botao ${noAr ? '' : 'principal'}" data-jogo="${id}" ${noAr ? 'disabled' : ''}>${noAr ? 'Está no ar' : '▶ Colocar na live'}</button>
          </div>
        </article>`;
      }).join('')}</div>
    </div>`).join('');
}
$('#nichos').addEventListener('click', e => {
  const b = e.target.closest('[data-jogo]');
  if (!b) return;
  enviar({ tipo: 'trocarJogo', jogo: b.dataset.jogo });
  toast(`${JOGOS[b.dataset.jogo].emoji} ${JOGOS[b.dataset.jogo].nome} na tela da live`);
});
function mostrarNoAr() {
  const j = JOGOS[config.jogo];
  $('#no-ar-emoji').textContent = j?.emoji || '🎮';
  $('#no-ar-nome').textContent = j?.nome || config.jogo;
}

// ---------- Tela da live e prévia ----------
$('#abrir-tela').addEventListener('click', () => {
  window.open('/tela', 'live-interativa-tela', 'width=540,height=960');
});
$('#recomecar').addEventListener('click', () => { enviar({ tipo: 'comando', acao: 'recarregar' }); toast('Jogo recomeçado'); });
const canal = new BroadcastChannel('live-interativa');
let ultimaPrevia = 0;
canal.onmessage = m => {
  if (!m.data?.previa) return;
  $('#previa').src = m.data.previa;
  ultimaPrevia = Date.now();
  $('#previa-vazia').hidden = true;
};
setInterval(() => {
  canal.postMessage('previa?');
  if (Date.now() - ultimaPrevia > 3000) { $('#previa-vazia').hidden = false; $('#previa').removeAttribute('src'); }
}, 1000);

// ---------- Som ----------
$('#narradora').addEventListener('change', e => enviar({ tipo: 'salvarConfig', config: { narradora: e.target.checked } }));
let timerVolume;
$('#volume').addEventListener('input', e => {
  clearTimeout(timerVolume);
  timerVolume = setTimeout(() => enviar({ tipo: 'salvarConfig', config: { volume: Number(e.target.value) } }), 150);
});

// ---------- Abas ----------
$('#abas').addEventListener('click', e => {
  const b = e.target.closest('button');
  if (!b) return;
  document.querySelectorAll('#abas button').forEach(x => x.classList.toggle('ativa', x === b));
  document.querySelectorAll('.aba').forEach(a => { a.hidden = a.id !== 'aba-' + b.dataset.aba; });
});

// ---------- Equipes ----------
$('#modelos').innerHTML = Object.entries(MODELOS_EQUIPES).map(([id, m]) => `<button class="botao" data-modelo="${id}">${esc(m.nome)}</button>`).join('');
$('#modelos').addEventListener('click', e => {
  const b = e.target.closest('[data-modelo]');
  if (!b) return;
  const m = MODELOS_EQUIPES[b.dataset.modelo];
  equipesEditando = structuredClone(m.equipes.slice(0, 8));
  $('#aviso-modelo').hidden = !m.aviso;
  $('#aviso-modelo').textContent = m.aviso || '';
  mostrarEquipes();
  toast('Modelo carregado. Clique em "Salvar equipes" para usar.');
});
function mostrarEquipes() {
  $('#lista-equipes').innerHTML = equipesEditando.map((e, i) => `
    <div class="equipe" data-i="${i}">
      <span class="num">${i + 1}</span>
      ${e.escudo ? `<span class="escudo-fixo">escudo<br>${esc(e.escudo.sigla)}</span>` : `<input class="emoji" data-campo="emoji" value="${esc(e.emoji)}" maxlength="8" title="Emoji">`}
      <input data-campo="nome" value="${esc(e.nome)}" maxlength="18" placeholder="Nome">
      <input type="color" data-campo="cor" value="${esc(e.cor)}">
      <input class="palavras" data-campo="palavras" value="${esc((e.palavras || []).join(', '))}" placeholder="Palavras extras (ex.: fogo, fire)">
      <button class="tirar" data-tirar="${i}" title="Tirar equipe" ${equipesEditando.length <= 2 ? 'disabled' : ''}>✕</button>
    </div>`).join('');
  $('#add-equipe').disabled = equipesEditando.length >= 8;
}
$('#lista-equipes').addEventListener('input', e => {
  const linha = e.target.closest('.equipe'), campo = e.target.dataset.campo;
  if (!linha || !campo) return;
  const eq = equipesEditando[linha.dataset.i];
  eq[campo] = campo === 'palavras' ? e.target.value.split(',').map(p => p.trim()).filter(Boolean) : e.target.value;
});
$('#lista-equipes').addEventListener('click', e => {
  const b = e.target.closest('[data-tirar]');
  if (!b || equipesEditando.length <= 2) return;
  equipesEditando.splice(Number(b.dataset.tirar), 1);
  mostrarEquipes();
});
$('#add-equipe').addEventListener('click', () => {
  if (equipesEditando.length >= 8) return;
  const cores = ['#ff4b3e', '#2f8cff', '#ffc61a', '#2fd16a', '#a855f7', '#ff8a1f', '#7fe3ff', '#ff8fc8'];
  equipesEditando.push({ nome: `Equipe ${equipesEditando.length + 1}`, emoji: '⭐', cor: cores[equipesEditando.length % cores.length], palavras: [] });
  mostrarEquipes();
});
$('#salvar-equipes').addEventListener('click', () => {
  if (equipesEditando.some(e => !String(e.nome).trim())) return toast('Toda equipe precisa de um nome');
  enviar({ tipo: 'salvarConfig', config: { equipes: equipesEditando }, recarregar: true });
  equipesEditando = null; // a próxima config que chegar vira a cópia de edição
  toast('✅ Equipes salvas. O jogo recomeçou com elas.');
});

// ---------- Marca ----------
let logoAtual = '';
function mostrarEtiqueta() {
  $('#etiqueta').style.borderColor = $('#marca-cor').value;
  $('#etiqueta-nome').textContent = $('#marca-nome').value || 'Sua marca aqui';
  $('#etiqueta-logo').hidden = !logoAtual;
  if (logoAtual) $('#etiqueta-logo').src = logoAtual;
  $('#tirar-logo').hidden = !logoAtual;
}
$('#marca-nome').addEventListener('input', mostrarEtiqueta);
$('#marca-cor').addEventListener('input', mostrarEtiqueta);
$('#marca-logo').addEventListener('change', async e => {
  const arquivo = e.target.files[0];
  if (!arquivo) return;
  // Diminui a logo para 256px (fica leve e nítida no jogo)
  const img = await createImageBitmap(arquivo).catch(() => null);
  if (!img) return toast('Não consegui abrir essa imagem');
  const s = Math.min(1, 256 / Math.max(img.width, img.height));
  const tela = document.createElement('canvas');
  tela.width = Math.round(img.width * s); tela.height = Math.round(img.height * s);
  tela.getContext('2d').drawImage(img, 0, 0, tela.width, tela.height);
  logoAtual = tela.toDataURL('image/png');
  if (logoAtual.length > 500000) logoAtual = tela.toDataURL('image/jpeg', 0.85);
  mostrarEtiqueta();
});
$('#tirar-logo').addEventListener('click', () => { logoAtual = ''; $('#marca-logo').value = ''; mostrarEtiqueta(); });
$('#salvar-marca').addEventListener('click', () => {
  enviar({ tipo: 'salvarConfig', config: { marca: { nome: $('#marca-nome').value, cor: $('#marca-cor').value, logo: logoAtual } }, recarregar: true });
  toast('✅ Marca salva');
});

// ---------- Testar ----------
const NOMES = ['Ana', 'Biel', 'Carol', 'Duda', 'Enzo', 'Fefe', 'Gabi', 'Heitor', 'Isa', 'João', 'Kaká', 'Lari', 'Malu',
  'Nando', 'Otávio', 'Pietra', 'Rafa', 'Sofia', 'Theo', 'Vivi', 'Will', 'Yuri', 'Zeca'];
const PRESENTES = [['🌹 Rosa', 'Rosa', 1], ['🎵 TikTok', 'TikTok', 1],['🫰 Dedo coração', 'Dedo coração', 5], ['🍩 Donut', 'Donut', 30], ['🎉 Confete', 'Confete', 100], ['🦁 Leão', 'Leão', 29999]];
const publico = [];
const sortear = l => l[Math.floor(Math.random() * l.length)];
function pessoaTeste() {
  if (publico.length < 40 && (publico.length < 3 || Math.random() < 0.3)) {
    const nome = sortear(NOMES) + Math.floor(Math.random() * 99);
    publico.push({ id: 'teste_' + nome.toLowerCase(), nome });
  }
  return sortear(publico);
}
const simular = ev => enviar({ ...pessoaTeste(), ...ev });

function mostrarBotoesTeste() {
  $('#botoes-equipes').innerHTML = config.equipes.map((e, i) =>
    `<button class="botao" data-chat="${i + 1}">💬 ${i + 1} ${esc(e.emoji || '')} ${esc(e.nome)}</button>`).join('');
}
$('#botoes-presentes').innerHTML = PRESENTES.map(([rotulo, , d], i) => `<button class="botao" data-presente="${i}">${rotulo} <small class="suave">${d}💎</small></button>`).join('');
$('#aba-testar').addEventListener('click', e => {
  const b = e.target.closest('button');
  if (!b) return;
  if (b.dataset.chat) simular({ tipo: 'chat', texto: b.dataset.chat });
  if (b.dataset.like) simular({ tipo: 'like', qtd: Number(b.dataset.like) });
  if (b.dataset.acao) simular({ tipo: b.dataset.acao });
  if (b.dataset.presente) { const [, nome, d] = PRESENTES[b.dataset.presente]; simular({ tipo: 'gift', presente: nome, diamantes: d, qtd: 1 }); }
});
$('#form-chat').addEventListener('submit', e => {
  e.preventDefault();
  const texto = $('#texto-chat').value.trim();
  if (texto) simular({ tipo: 'chat', texto });
  $('#texto-chat').value = '';
});

let timerPlateia = null;
function pararPlateia() { clearInterval(timerPlateia); timerPlateia = null; $('#plateia').checked = false; }
$('#plateia').addEventListener('change', e => {
  clearInterval(timerPlateia);
  if (!e.target.checked) return;
  timerPlateia = setInterval(() => {
    const r = Math.random(), n = config.equipes.length;
    if (r < 0.3) simular({ tipo: 'chat', texto: String(1 + Math.floor(Math.random() * n)) });
    else if (r < 0.45) simular({ tipo: 'chat', texto: sortear(['A', 'B', 'C', 'D', 'a', 'b']) });
    else if (r < 0.55) simular({ tipo: 'chat', texto: sortear(['oi', 'kkkk', 'bora', 'top demais', '🔥🔥']) });
    else if (r < 0.9) simular({ tipo: 'like', qtd: 1 + Math.floor(Math.random() * 15) });
    else if (r < 0.985) { const [, nome, d] = sortear(PRESENTES.slice(0, 3)); simular({ tipo: 'gift', presente: nome, diamantes: d, qtd: 1 }); }
    else simular({ tipo: 'gift', presente: 'Confete', diamantes: 100, qtd: 1 });
  }, 450);
});

// ---------- Conectar ----------
$('#form-usuario').addEventListener('submit', e => {
  e.preventDefault();
  enviar({ tipo: 'definirUsuario', usuario: $('#usuario').value });
  $('#usuario').blur();
  toast('@ salvo');
});

conectar();

// Ranking de apoiadores (quem mais mandou presente hoje, em diamantes).
// Vale para todos os jogos da galeria e fica salvo no navegador até o fim do dia.
//   Ranking.top(3) -> [{ id, nome, diamantes }]
//   Ranking.aoMudarLider(fn)  chama fn(pessoa) quando alguém assume o 1º lugar
const Ranking = (() => {
  const CHAVE = 'ranking-apoiadores';
  const hoje = () => new Date().toISOString().slice(0, 10);
  let dados = { dia: hoje(), pessoas: {} };
  try {
    const salvo = JSON.parse(localStorage.getItem(CHAVE));
    if (salvo?.dia === hoje()) dados = salvo;
  } catch { /* sem ranking salvo */ }
  const aoMudar = [];

  function top(n = 3) {
    return Object.entries(dados.pessoas)
      .map(([id, p]) => ({ id, ...p }))
      .sort((a, b) => b.diamantes - a.diamantes)
      .slice(0, n);
  }

  Live.on('gift', ev => {
    if (dados.dia !== hoje()) dados = { dia: hoje(), pessoas: {} };
    const liderAntes = top(1)[0]?.id;
    const p = dados.pessoas[ev.id] ||= { nome: ev.nome, diamantes: 0 };
    p.nome = ev.nome;
    p.diamantes += ev.diamantes || 1;
    try { localStorage.setItem(CHAVE, JSON.stringify(dados)); } catch { /* ignora */ }
    const lider = top(1)[0];
    if (lider.id !== liderAntes) for (const fn of aoMudar) fn(lider);
  });

  return { top, aoMudarLider: fn => aoMudar.push(fn) };
})();

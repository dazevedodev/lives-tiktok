// Monta a pasta pronta para instalar no PC do cliente: npm run pacote
//   dist/LiveInterativa/       (copie essa pasta inteira, ou o .zip, para o PC do cliente)
//   dist/LiveInterativa.zip
// Leva junto o node.exe deste PC, então o cliente não precisa instalar nada.
// NÃO leva o config.json (o cliente começa com tudo padrão e coloca o @ dele no painel).
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const RAIZ = path.join(__dirname, '..');
const DIST = path.join(RAIZ, 'dist');
const DESTINO = path.join(DIST, 'LiveInterativa');
const ZIP = path.join(DIST, 'LiveInterativa.zip');

const pular = f => /[\\/]three[\\/]src([\\/]|$)/.test(f) || f.endsWith('.map') || f.endsWith('.d.ts');

console.log('📦 Montando a Live Interativa para o cliente...');
fs.rmSync(DIST, { recursive: true, force: true });
fs.mkdirSync(DESTINO, { recursive: true });

for (const item of ['server.js', 'package.json', 'public', 'node_modules', 'Live Interativa.bat', 'Live Interativa - Modo Teste.bat', 'LEIA-ME.txt']) {
  const de = path.join(RAIZ, item);
  if (!fs.existsSync(de)) { console.log(`   ⚠️  faltou ${item}`); continue; }
  fs.cpSync(de, path.join(DESTINO, item), { recursive: true, filter: f => !pular(f) });
  console.log(`   ✓ ${item}`);
}

fs.mkdirSync(path.join(DESTINO, 'node'));
fs.copyFileSync(process.execPath, path.join(DESTINO, 'node', 'node.exe'));
console.log(`   ✓ node.exe (${process.version})`);

if (process.platform === 'win32') {
  execFileSync('powershell', ['-NoProfile', '-Command',
    `Compress-Archive -Path '${DESTINO}' -DestinationPath '${ZIP}' -Force`], { stdio: 'inherit' });
  const mb = (fs.statSync(ZIP).size / 1048576).toFixed(1);
  console.log(`\n✅ Pronto: ${ZIP} (${mb} MB)`);
} else {
  console.log(`\n✅ Pronto: ${DESTINO}`);
}

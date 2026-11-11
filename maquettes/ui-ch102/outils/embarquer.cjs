'use strict';
/* CH-102 : prépare la version web d'une application Exact (`dist/`) pour vivre dans un sous-dossier d'une page, dans un cadre (iframe).
 *   node maquettes/ui-ch102/outils/embarquer.cjs DOSSIER_DES_APPLICATIONS DOSSIER_DE_SORTIE_HORS_DEPOT
 * Exact fabrique un site qui se croit à la racine (`<base href="/">`, routes `/` et `/plus`). Ici, sans toucher au code de l'application :
 * la base devient le sous-dossier (les fichiers se chargent de là) et l'adresse montrée au routeur devient `/` (history.replaceState).
 * Si le navigateur refuse ce changement d'adresse, le cadre affiche un mot d'excuse au lieu d'une application cassée. */
const fs = require('node:fs'), path = require('node:path');
const [, , APPS, SORTIE] = process.argv;
if (!APPS || !SORTIE) { console.error('usage : embarquer.cjs DOSSIER_DES_APPLICATIONS DOSSIER_DE_SORTIE'); process.exit(2); }
const AMORCE = `<script>(function(){var d=location.href.split(/[?#]/)[0].replace(/[^\\/]*$/,'');var b=document.createElement('base');b.href=d;document.head.appendChild(b);
try{history.replaceState(null,'','/'+location.search);if(location.pathname!=='/')throw 0}catch(e){location.replace(d+'indisponible.html')}})();</script>`;
const EXCUSE = '<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>html{color-scheme:light dark}body{margin:0;height:100vh;display:grid;place-items:center;font:15px system-ui,sans-serif;padding:24px;box-sizing:border-box;text-align:center}</style><p>L’application ne peut pas tourner dans ce cadre. Les images de la page montrent les mêmes écrans.</p></html>';
for (const nom of ['fiche', 'carte', 'bandeau']) {
  const de = path.join(APPS, nom, 'dist'), vers = path.join(SORTIE, nom); fs.rmSync(vers, { recursive: true, force: true }); fs.mkdirSync(vers, { recursive: true });
  for (const f of fs.readdirSync(de)) { if (f.startsWith('.') || ['shell.html', 'routes.json', 'manifest.json'].includes(f)) continue; fs.copyFileSync(path.join(de, f), path.join(vers, f)); }
  let html = fs.readFileSync(path.join(de, 'index.html'), 'utf8');
  if (!html.includes('<base href="/">')) throw new Error(nom + ' : <base href="/"> introuvable, le site d’Exact a changé de forme');
  html = html.replace('<base href="/">', AMORCE).replace(/<link rel="manifest"[^>]*>\n?/, '').replace('<html lang="en">', '<html lang="fr">');
  fs.writeFileSync(path.join(vers, 'index.html'), html); fs.writeFileSync(path.join(vers, 'indisponible.html'), EXCUSE);
  console.log(nom + ' : ' + fs.readdirSync(vers).length + ' fichiers, ' + Math.round(fs.readdirSync(vers).reduce((n, f) => n + fs.statSync(path.join(vers, f)).size, 0) / 1024) + ' ko');
}

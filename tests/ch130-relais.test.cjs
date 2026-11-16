'use strict';
/* CH-130 (D-361) — le relais sert, à côté de la page du téléphone, le RENDU DU PANNEAU lui-même (src/signal-rendu.js), l'instantané
 * (src/telecommande-instantane.js), la feuille de style (panel-signal.css) et sa police : octet pour octet les fichiers du dépôt (aucune copie).
 * Liste fermée : rien d'autre du dépôt n'est servi. Avec WRANGLER=<chemin de wrangler>, l'essai fait aussi un déploiement à blanc (--dry-run) et
 * vérifie que wrangler embarque ces fichiers tels quels. */
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{spawnSync}=require('node:child_process');
const {chargerWorker}=require('./helpers/ch111-relais-local.cjs');
const racine=path.resolve(__dirname,'..'),H=['https:/','/relais-essai','.exemple','.test'].join('');
const SERVIS={'/signal-rendu.js':['src/signal-rendu.js',/^text\/javascript/],'/telecommande-instantane.js':['src/telecommande-instantane.js',/^text\/javascript/],
 '/panel-signal.css':['panel-signal.css',/^text\/css/],'/fonts/Inter-latin-opsz-wght.woff2':['fonts/Inter-latin-opsz-wght.woff2',/^font\/woff2$/]};

test('les fichiers du panneau sont servis octet pour octet, avec leur type ; rien d’autre',async()=>{const W=await chargerWorker();
 for(const [chemin,[f,type]] of Object.entries(SERVIS)){const r=await W.default.fetch(new Request(H+chemin),{});
  assert.equal(r.status,200,chemin);assert.match(r.headers.get('content-type'),type,chemin);assert.equal(r.headers.get('x-content-type-options'),'nosniff');
  assert.ok(Buffer.from(await r.arrayBuffer()).equals(fs.readFileSync(path.join(racine,f))),'identique au dépôt : '+f);
  assert.equal((await W.default.fetch(new Request(H+chemin,{method:'POST'}),{})).status,405);}
 for(const p of ['/src/signal-rendu.js','/src/telecommande.js','/background.js','/manifest.json','/fonts/Inter.woff2','/panel.css','/telecommande/worker.js','/%2e%2e/manifest.json'])
  assert.equal((await W.default.fetch(new Request(H+p),{})).status,404,p);
});

test('la page charge ces fichiers depuis le relais seulement ; la politique de sécurité le permet et rien de plus',async()=>{const W=await chargerWorker();
 const r=await W.default.fetch(new Request(H+'/'),{}),csp=r.headers.get('content-security-policy'),html=await r.text();
 assert.match(csp,/script-src 'self' 'unsafe-inline'/);assert.match(csp,/style-src 'self' 'unsafe-inline'/);assert.match(csp,/font-src 'self'/);assert.match(csp,/default-src 'none'/);assert.match(csp,/connect-src 'self'/);
 assert.match(html,/<script src="\/signal-rendu\.js"><\/script>/);assert.match(html,/<script src="\/telecommande-instantane\.js"><\/script>/);assert.match(html,/<link rel="stylesheet" href="\/panel-signal\.css">/);
 assert.doesNotMatch(html,/https?:\/\//,'aucune ressource extérieure');
});

const wr=process.env.WRANGLER;
test('wrangler : déploiement à blanc depuis telecommande/, les fichiers du panneau embarqués tels quels',wr?{}:{skip:'WRANGLER non donné'},()=>{
 const out=fs.mkdtempSync(path.join(os.tmpdir(),'ch130-wr-'));
 const r=spawnSync(wr,['deploy','--dry-run','--outdir',out],{cwd:path.join(racine,'telecommande'),encoding:'utf8',env:{...process.env,WRANGLER_SEND_METRICS:'false'}});
 assert.equal(r.status,0,r.stderr+r.stdout);
 const v=/wrangler (\d+\.\d+\.\d+)/.exec(r.stdout+r.stderr);console.log('# wrangler',v?.[1],'· déploiement à blanc :',/--dry-run: exiting now/.test(r.stdout)?'accepté':'?');
 const f=fs.readdirSync(out);
 for(const [,[src]] of Object.entries(SERVIS)){const n=path.basename(src),g=f.find(x=>x.endsWith('-'+n));assert.ok(g,'embarqué : '+n);
  assert.ok(fs.readFileSync(path.join(out,g)).equals(fs.readFileSync(path.join(racine,src))),'identique : '+n);}
 assert.ok(f.some(x=>x.endsWith('-telephone.html')));
});

'use strict';
/* Rangement R (plan 5.0, 25/10/2026) — la maquette ESV est dans le dépôt (tests/esv-maquette, rapatriée de la branche
 * claude/esv-locale-audit) et se lance depuis lui, sans navigateur : son serveur sert la page, le scénario, la liste des coupes,
 * les nœuds de points (corpus du dépôt) et reçoit une écriture ; le banc de la relecture (tools/relecture-banc.cjs) en règle une
 * copie temporaire sans toucher à la version suivie. Le lancement complet avec l'extension dans Chromium (Playwright) reste hors
 * de verify : `node tools/relecture-banc.cjs` ou `node tests/esv-maquette/essais.cjs`. */
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const ICI=path.join(__dirname,'esv-maquette');
const empreintes=()=>Object.fromEntries(fs.readdirSync(ICI).sort().map(f=>[f,crypto.createHash('sha256').update(fs.readFileSync(path.join(ICI,f))).digest('hex')]));

test('le serveur de la maquette du dépôt sert la page, le scénario, la liste, les nœuds et reçoit une écriture',async()=>{
 const {demarrer}=require('./esv-maquette/serveur.cjs');const s=await demarrer({});
 try{
  const page=await fetch(`${s.url}/tests/esv-maquette/esv.html?cuts=3`);assert.equal(page.status,200);assert.match(await page.text(),/esv-maquette\.js/);
  const sc=await (await fetch(`${s.url}/maquette/scenario.json?cuts=3&debut=100`)).json();
  const partie=sc.parties[0];assert.equal(partie.cuts.length,3);assert.deepEqual(partie.cuts.map(c=>c.cut),[100,101,102]);
  const liste=await (await fetch(`${s.url}/rails/${partie.table}`)).json();assert.equal(liste.value.length,103,'liste indexée : ligne N = cut N');
  const noeuds=await (await fetch(s.url+partie.cuts[0].noeudsUrl)).json();assert.ok(noeuds.noeuds.length>0,'nœuds de points lus dans tests/corpus');
  const rk=liste.value[100].RowKey,put=await fetch(`${s.url}/rails/${partie.table}/${rk}`,{method:'PUT',body:JSON.stringify({ExtractionStatus:'valid'})});
  assert.equal(put.status,204);assert.equal(s.journal.ecritures.length,1);assert.equal(s.journal.ecritures[0].rowKey,rk);
 }finally{await s.fermer();}
});

test('le banc de la relecture règle une copie temporaire de la maquette, jamais la version suivie',()=>{
 const B=require('../tools/relecture-banc.cjs'),avant=empreintes();
 assert.equal(B.MAQUETTE_DEPOT,ICI);
 assert.equal(B.args([]).maquette,null,'sans --maquette : la maquette du dépôt');
 assert.throws(()=>B.preparerMaquette(ICI),/ne se règle pas sur place/);
 const c=B.copierMaquette();
 try{
  B.preparerMaquette(c.dossier);
  assert.match(fs.readFileSync(path.join(c.dossier,'esv-maquette.js'),'utf8'),/majEspace==='surplace'/,'copie réglée');
  assert.ok(fs.existsSync(path.join(c.dossier,'../corpus')),'corpus du dépôt relié');
 }finally{c.nettoyer();}
 assert.equal(fs.existsSync(c.dossier),false,'copie supprimée');
 assert.deepEqual(empreintes(),avant,'maquette suivie inchangée');
});

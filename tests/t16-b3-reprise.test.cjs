'use strict';
/* 4.9.0.16 — trois défauts de B3 vus au test 15 (partie 24), dans le service worker réel :
 *  a. après une fin de partie, « Reprendre » rejouait la fin à chaque clic
 *     (« dernier-cut-differe » + « batch-stopped-at-end ») : il répond « Lot déjà terminé » ;
 *  b. « Arrêter » après l'analyse d'un cut, puis « Reprendre » : la proposition calculée AVANT
 *     l'arrêt était appliquée sans nouvelle capture, même si les rails avaient bougé ; la
 *     reprise compare désormais les rails d'ESV à ceux de la capture (comme « Réessayer ») ;
 *  c. les transitions du lot (64 dernières) partent dans le journal exporté (`transitionsLot`). */
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const K=require('../src/core.js'),L=require('../src/lot-decision.js');
const {dernierCut,differe}=require('./helpers/dernier-cut.cjs');
const {pilote}=require('./helpers/pilote-lot.cjs');
const types=b=>b.store.events.map(e=>e.type).filter(t=>!/adapter-progress|gcv1-shadow|esv-releve/.test(t));
const libre=async b=>{for(let i=0;i<500&&b.fonction('engine.task');i++)await new Promise(r=>setImmediate(r));};

for(const [nom,decision] of [['différé sans envoi',differe],['validé sur place',L]])
test(`a. fin de partie (dernier cut ${nom}) : « Reprendre » répond « Lot déjà terminé », sans rien rejouer`,async()=>{
  const {r,view}=await dernierCut({decision});
  assert.equal(view.batch.state,'STOPPED');assert.ok(['dernier-cut-differe','dernier-cut-valide'].includes(view.batch.stoppedAtEnd.issue));
  const evts=types(r.b).length,appels=r.b.adapter.calls.length,fin=JSON.stringify(view.batch.stoppedAtEnd);
  for(let i=0;i<2;i++){const v=await r.b.api('resume');await r.b.settle();
    assert.match(v.notice,/^Lot déjà terminé : dernier cut de la partie atteint \(cut 100\)\. Rien n’est rejoué/);
    assert.equal(v.batch.state,'STOPPED');assert.equal(JSON.stringify(v.batch.stoppedAtEnd),fin,'la fin du lot est gardée telle quelle');}
  assert.equal(types(r.b).length,evts,'aucun événement : ni « dernier-cut-differe » ni « batch-stopped-at-end » rejoué');
  assert.equal(r.b.adapter.calls.length,appels,'aucune commande ni lecture envoyée à ESV');
});

test('a. un lot clos par une sortie d’ESV reste reprenable comme avant (seule la fin de partie répond « déjà terminé »)',()=>{
  const src=fs.readFileSync(path.join(__dirname,'../background.js'),'utf8');
  assert.match(src,/const FINS_DE_PARTIE=new Set\(\['dernier-cut-valide','dernier-cut-differe'\]\)/);
  assert.match(src,/e\.reason==='navigation-other-part-after-defer'/);
});

/* Arrêt demandé juste après la capture du cut 100 : la boucle s'arrête avant la pose. */
async function arretApresCapture(){let r;const esv=e=>{const c=e.capture.bind(e);let fait=false;
  e.capture=async(...a)=>{const out=await c(...a);if(!fait&&out?.identity?.cut===100){fait=true;await r.b.api('stop');}return out;};};
  r=await pilote(L,{start:100,end:101,esv});await r.b.settle();await libre(r.b);return r;}

test('b. « Arrêter » après la capture, rails déplacés, puis « Reprendre » : refusé, rien n’est posé',async()=>{
  const r=await arretApresCapture();let view=await r.b.api('view');
  assert.equal(view.batch.state,'STOPPED');assert.ok(['analyze','apply'].includes(view.batch.step),'arrêté entre la capture et la pose : '+view.batch.step);
  assert.equal(r.applied.length,0,'rien posé avant la reprise');
  r.b.adapter.rails=K.expectedPoses({rails:K.clone(r.b.adapter.rails)},{left:{delta:[0,.03,0]},right:{delta:[0,-.03,0]}});
  const refus=await r.b.api('resume').then(()=>null,e=>e);await r.b.settle();await libre(r.b);
  assert.match(String(refus?.message),/Rails modifiés depuis la capture du cut 100 : la proposition calculée avant l’arrêt n’est pas appliquée/);
  view=await r.b.api('view');assert.equal(view.batch.state,'STOPPED','le lot reste arrêté');
  assert.equal(r.applied.length,0,'la proposition calculée avant l’arrêt n’est jamais appliquée');
  assert.ok(!types(r.b).includes('applied-verified'));
});

test('b. « Arrêter » après la capture, rails inchangés, puis « Reprendre » : le lot reprend comme avant',async()=>{
  const r=await arretApresCapture();
  await r.b.api('resume');const view=await r.b.settle();
  assert.ok(r.applied.length>=1,'la proposition, calculée sur la même pose, est appliquée');
  assert.notEqual(view.batch.state,'ERROR',view.notice);assert.ok(view.batch.processed.length>=1);
});

test('c. journal exporté : `transitionsLot` (nom, lot, état, heure), sans identité de cut ni donnée d’ESV',async()=>{
  const r=await pilote(L,{start:100,end:101});await r.b.settle();
  for(const action of ['journal-meta','journal']){const j=JSON.parse(JSON.stringify(await r.b.api(action)));
    assert.ok(Array.isArray(j.transitionsLot)&&j.transitionsLot.length>=2,action);
    assert.deepEqual(j.transitionsLot.map(t=>t.nom).slice(0,2),['demarrage','cut-suivant'],action);
    for(const t of j.transitionsLot){assert.deepEqual(Object.keys(t).sort(),['at','etat','lot','nom'],action);assert.ok(!Number.isNaN(Date.parse(t.at)),action);}}
  const src=fs.readFileSync(path.join(__dirname,'../background.js'),'utf8');assert.match(src,/if\(this\.journal\.length>64\)this\.journal\.shift\(\)/,'64 dernières transitions');
});

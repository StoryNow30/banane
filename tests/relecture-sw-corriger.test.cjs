'use strict';
/* 5.0 (D-170 à D-173) — RELECTURE APRÈS LE LOT, service worker réel (tests/helpers/relecture-lot.cjs) : corriger : seuls les cuts qui passent la règle prudente, par la commande `apply` du lot, puis Ctrl+Entrée prouvé par l'écriture. Données synthétiques. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const {H,GOLDEN,empreinte,j,sansRelecture,PERMISSIF,apresLot,LECTURES,coupee}=require('./helpers/relecture-essais.cjs');

test('corriger : seuls les cuts qui passent la règle sont posés et validés, par la commande `apply` du lot puis Ctrl+Entrée prouvé par l’écriture',async()=>{
 const {b,adapter,lot,local}=await H.lotRelecture({mode:'corriger',decisions:{109:14,110:[14,2],115:20,116:90},reglagesProposes:PERMISSIF});
 const p=await H.finPasse(b);
 assert.equal(empreinte(H.neutre(sansRelecture(lot))),GOLDEN.empreinteCommandes,'le lot avant la passe est celui de la base');
 assert.equal(p.etat,'finie');assert.equal(p.corriges,2);assert.equal(p.refusees,0);
 assert.deepEqual(adapter.enPlace.map(x=>x.cut),[109,115]);assert.deepEqual(adapter.applyArgs.slice(2).map(x=>x.cut),[109,115]);
 assert.deepEqual(j(adapter.enPlace.map(x=>x.options)),[{commande:'ctrl-entree',boutonId:null,preuve:'ecriture'},{commande:'ctrl-entree',boutonId:null,preuve:'ecriture'}]);
 const apres=apresLot(b,lot);
 for(const a of ['validateAndNext','skipAndNext','next','nextWithoutDecision','restore'])assert.equal(apres.some(c=>c.action===a),false,a);
 /* Le chemin de la pose d'un rouge : `apply(état, rails)` sans option (clic « Comme avant », comme le lot), relu, puis la validation. */
 const poses=apres.filter(c=>c.action==='apply'),lotPoses=lot.filter(c=>c.action==='apply');
 assert.deepEqual(poses.map(c=>c.args.length),lotPoses.map(c=>c.args.length),'même forme d’appel que les poses du lot');
 for(const c of poses)assert.ok(['left','right'].every(s=>Array.isArray(c.args[1][s].delta)&&c.args[1][s].delta.length===3));
 const i=apres.findIndex(c=>c.action==='apply');assert.deepEqual(apres.slice(i-1,i+3).map(c=>c.action),['state','apply','state','validateInPlace']);
 /* Aucune marque propre à la relecture dans ce qui part vers la page. */
 assert.equal(/relecture/i.test(JSON.stringify(apres)),false);
 const ev=H.evenements(b,'relecture-ombre'),de=c=>ev.find(e=>e.identity.cut===c);
 assert.equal(de(109).action,'corrige');assert.equal(de(115).action,'corrige');
 assert.equal(de(110).action,'visite');assert.equal(de(110).critere.regle,'coherence','les deux rails ne sont pas cohérents');
 assert.equal(de(116).action,'visite');assert.equal(de(116).critere.regle,'voie','jamais de changement de voie');
 for(const c of [108,114])assert.equal(de(c).action,'visite');
 /* La pose d'ESV des cuts corrigés est la pose calculée (relue à 1 mm), et l'intention est effacée. */
 for(const c of [109,115]){const r=adapter.poses.get(c),pc=de(c).poseCalculee;
  for(const s of ['left','right'])assert.ok(H.K.C.distance(r[s].positionSceneRelative,pc[s])<.001,`cut ${c}, rail ${s}`);}
 assert.equal('banane50RelectureIntention' in local.m,false);
 assert.match(p.message,/7 cuts relus, 2 corrigés/);
});

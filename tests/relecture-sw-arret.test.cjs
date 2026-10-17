'use strict';
/* 5.0 (D-170 à D-173) — RELECTURE APRÈS LE LOT, service worker réel (tests/helpers/relecture-lot.cjs) : arrêt demandé pendant la passe ; pendant la passe, ni lot, ni retour à un cut. Données synthétiques. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const {H,GOLDEN,empreinte,j,sansRelecture,PERMISSIF,apresLot,LECTURES,coupee}=require('./helpers/relecture-essais.cjs');

test('arrêt demandé pendant la passe : fin de l’étape en cours, puis plus rien ; pendant la passe, ni lot, ni retour à un cut',async()=>{
 const refus=[];
 const {b,adapter,lot}=await H.lotRelecture({mode:'corriger',decisions:{109:14,110:14},reglagesProposes:PERMISSIF,esv:(a,bb)=>{a.surAller=async t=>{
  if(t.cut===109)for(const [act,args] of [['start',{part:23,start:1,end:2}],['goto-cut',{part:23,cut:5}],['relecture-lancer',{}]])
   await bb.api(act,args).then(()=>refus.push(act+' accepté'),e=>refus.push(e.message));
  if(t.cut===110)await bb.api('relecture-arreter');}}});
 const p=await H.finPasse(b);
 assert.equal(refus.length,3);for(const m of refus)assert.match(m,/Relecture après le lot en cours/);
 assert.equal(p.etat,'arretee');assert.match(p.message,/arrêtée à ta demande : 3 cuts relus sur 7/,'le cut 110, en cours à la demande, est fini');
 assert.deepEqual(adapter.allees.map(a=>a.cut),[108,109,110]);
 /* Aucune pose laissée sans validation : chaque `apply` est suivi de sa validation prouvée. */
 const apres=apresLot(b,lot);assert.equal(apres.filter(c=>c.action==='apply').length,adapter.enPlace.length);
 assert.deepEqual(adapter.enPlace.map(x=>x.cut),[109]);
 assert.equal(H.evenements(b,'relecture-fin')[0].issue,'arret');
});

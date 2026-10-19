'use strict';
/* 5.0 (D-170 à D-176) — RELECTURE APRÈS LE LOT, service worker réel (tests/helpers/relecture-lot.cjs) : arrêt demandé pendant la passe
 * (bouton « Arrêter » du lot : revue, W11) ; pendant la passe, ni lot, ni retour à un cut, ni seconde passe ; l'annulation envoyée à la
 * page porte une raison neutre, sans marque de la relecture (T-6). Données synthétiques. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const {H,PERMISSIF,apresLot}=require('./helpers/relecture-essais.cjs');

test('arrêt demandé pendant la passe (« Arrêter » du lot) : fin de l’étape en cours, sans correction ; annulation neutre ; ni lot, ni retour, ni seconde passe',async()=>{
 const refus=[];let vue=null;
 const {b,adapter,lot}=await H.lotRelecture({mode:'corriger',decisions:{109:14,110:14},reglagesProposes:PERMISSIF,esv:(a,bb)=>{a.surAller=async t=>{if(t.cut!==109)return;
  for(const [act,args] of [['start',{part:23,start:1,end:2}],['goto-cut',{part:23,cut:5}],['relecture-lancer',{}]])
   await bb.api(act,args).then(()=>refus.push(act+' accepté'),e=>refus.push(e.message));
  vue=await bb.api('stop');}}});
 const p=await H.finPasse(b);
 assert.equal(refus.length,3);for(const m of refus)assert.match(m,/Relecture après le lot en cours/);
 assert.ok(vue&&vue.batch,'« Arrêter » rend la vue du panneau');
 assert.equal(p.etat,'arretee');assert.match(p.message,/arrêtée à ta demande : 2 cuts relus sur 7/,'le cut 109, en cours à la demande, est fini, sans correction');
 assert.deepEqual(adapter.allees.map(a=>a.cut),[107,108,109]);assert.deepEqual(adapter.majEspace,[],'aucune correction après la demande d’arrêt');
 const apres=apresLot(b,lot);assert.equal(apres.filter(c=>c.action==='apply').length,0);
 const annulations=apres.filter(c=>c.action==='cancel');assert.equal(annulations.length,1,'le passage en cours est annulé');
 assert.equal(annulations[0].args[0].reason,'goto-cut-cancel');assert.equal(/relecture|ariane|banane/i.test(JSON.stringify(annulations)),false,'aucune marque dans la page');
 assert.equal(H.evenements(b,'relecture-fin')[0].issue,'arret');
 assert.equal(H.evenements(b,'relecture-ombre').find(e=>e.identity.cut===109).action,'visite');
});

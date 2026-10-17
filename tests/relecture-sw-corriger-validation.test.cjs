'use strict';
/* 5.0 (D-170 à D-176) — RELECTURE APRÈS LE LOT, service worker réel (tests/helpers/relecture-lot.cjs) : corriger : Maj+Espace sans
 * écriture de validation vue : arrêt sur ce cut, dit, intention notée PAR CUT ; tant que Mic n'a pas dit « J'ai contrôlé le cut 109 »,
 * ni relecture, ni lot, ni retour à un cut (revue, W5 et R4). Données synthétiques. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const {H,PERMISSIF,apresLot}=require('./helpers/relecture-essais.cjs');

test('corriger : Maj+Espace sans écriture vue → arrêt sur ce cut, intention par cut ; relecture, lot et retour refusés jusqu’à « J’ai contrôlé le cut 109 »',async()=>{
 const {b,adapter,lot,local}=await H.lotRelecture({mode:'corriger',decisions:{109:14},reglagesProposes:PERMISSIF,esv:a=>{a.ecriture=null;}});
 /* Une autre correction interrompue, plus ancienne (cut 60) : elle ne doit pas être effacée par la suite. */
 local.m.banane50RelectureIntention=[{lotId:'ancien',part:23,cut:60,at:new Date().toISOString()}];
 const p=await H.finPasse(b);
 assert.equal(p.etat,'non-lancee','une correction interrompue non contrôlée bloque la passe');assert.match(p.message,/interrompue au cut 60/);
 await b.api('relecture-acquitter',{cut:60});assert.equal('banane50RelectureIntention' in local.m,false);
 assert.equal((await b.api('relecture-lancer')).passe.etat,'en-cours');const q=await H.finPasse(b);
 assert.equal(q.etat,'erreur');assert.match(q.message,/cut 109 : Maj\+Espace envoyé, aucune écriture de validation vue/);
 assert.deepEqual(adapter.allees.map(a=>a.cut),[107,108,109]);assert.equal(adapter.majEspace.length,1);
 assert.deepEqual(local.m.banane50RelectureIntention.map(x=>x.cut),[109],'correction incertaine notée, pour ce cut');
 const etat=await b.api('relecture-etat');assert.equal(etat.correctionInterrompue.cut,109);
 assert.equal(H.evenements(b,'relecture-ombre').find(e=>e.identity.cut===109).action,'correction-incertaine');
 assert.equal(H.evenements(b,'relecture-fin').at(-1).issue,'erreur');
 assert.equal(apresLot(b,lot).filter(c=>c.action==='apply').length,1);
 for(const [act,args] of [['relecture-lancer',{}],['start',{part:23,start:1,end:2,...H.SCOPE}],['goto-cut',{part:23,cut:5}]])
  await assert.rejects(b.api(act,args),/interrompue au cut 109.*J’ai contrôlé le cut 109/,act);
 await b.api('relecture-acquitter',{cut:109});
 assert.equal('banane50RelectureIntention' in local.m,false);assert.equal((await b.api('relecture-etat')).correctionInterrompue,null);
 assert.deepEqual(b.store.events.filter(e=>e.type==='relecture-acquittee').map(e=>e.identity.cut),[60,109]);
});

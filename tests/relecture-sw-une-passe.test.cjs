'use strict';
/* 5.0, revue de la relecture (D-175, correction 2) — UNE SEULE PASSE À LA FOIS. La passe existe dès sa planification (« preparation »),
 * avant toute attente : pendant le délai de départ et la préparation (journal lent), « Lancer la relecture » et « Démarrer » sont
 * refusés, et une seule passe démarre. Deux « Lancer » simultanés sur un lot clos : un seul part. Données synthétiques. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const {H,PERMISSIF}=require('./helpers/relecture-essais.cjs');

test('un seul relecture-debut : clic pendant le délai de départ, « Démarrer » et clic pendant la préparation refusés ; deux « Lancer » simultanés : un seul part',async()=>{
 let lent=null;const vu=new Promise(r=>{lent=r;});
 const {b,adapter}=await H.lotRelecture({mode:'corriger',decisions:{109:14},reglagesProposes:PERMISSIF,relecture:{departMs:250,plafondCuts:3},
  esv:(a,bb)=>{const v=bb.ctx.vertsAControler;let une=true;bb.ctx.vertsAControler=async x=>{if(une){une=false;lent();await H.attendre(500);}return v(x);};}});
 /* Délai de départ (planifiée, pas encore partie) : la passe est déjà là. */
 assert.equal(b.get('relecture').passe.etat,'preparation');assert.equal((await b.api('relecture-etat')).passe.etat,'preparation');
 await assert.rejects(b.api('relecture-lancer'),/en préparation : une seule passe à la fois|en préparation/);
 await vu;/* préparation en cours (journal, liste « À contrôler ») */
 for(const [act,args] of [['relecture-lancer',{}],['start',{part:23,start:120,end:125,...H.SCOPE}],['goto-cut',{part:23,cut:5}]])
  await assert.rejects(b.api(act,args),/en préparation/,act);
 const p=await H.finPasse(b);assert.equal(p.etat,'finie',p.message);
 assert.equal(H.evenements(b,'relecture-debut').length,1,'une seule passe');assert.equal(b.get('engine').s.batch.scope.part,23);
 assert.equal(b.commands.filter(c=>c.action==='capture'&&c.args?.[0]?.identity?.cut>=120).length,0,'aucun lot démarré pendant la préparation');
 /* Deux « Lancer » simultanés sur le lot clos : un seul part, l'autre est refusé. */
 const r=await Promise.allSettled([b.api('relecture-lancer'),b.api('relecture-lancer')]);
 assert.equal(r.filter(x=>x.status==='fulfilled').length,1);assert.match(r.find(x=>x.status==='rejected').reason.message,/une seule passe à la fois/);
 await H.finPasse(b);assert.equal(H.evenements(b,'relecture-debut').length,2,'la passe automatique et un seul lancement');
 assert.ok(adapter.majEspace.every(x=>x.cut===109)&&adapter.majEspace.length===1,'le cut 109, corrigé par la première passe, n’est jamais revalidé');
});

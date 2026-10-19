'use strict';
/* RM-11 (test 9, fiches/RM11_RAISON_CORRECTION.md, essai 2) — la raison de la correction dans la session Écho (`src/native-session.js`).
 *  - L'Écho sans touche de raison est IDENTIQUE à celui de la test 8, octet pour octet (référence figée avant la fonction, à la chaîne de version
 *    près), fonction coupée comme fonction allumée ;
 *  - le champ `raisonCorrection` est écrit dans la visite ; la collante passe aux visites suivantes ; le 0 l'efface ; elle finit par changement de partie, saut,
 *    pause ; elle survit à un F5 ; le résumé `raisonSeries` est écrit une fois. La suite est dans echo-raison-grace.test.cjs (délai de grâce, replis, secours du panneau,
 *    jamais bloquant) et echo-raison-charge.test.cjs (10 000 frappes) et echo-raison-marge.test.cjs. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const REF=JSON.parse(fs.readFileSync(path.join(__dirname,'echo-raison-reference.json'),'utf8'));
const {jouer,ON,chiffre,seance,visite,valider}=require('./helpers/echo-raison-outils.cjs'),R=require('../src/raison-correction.js'),K=require('../src/core.js');
test('l\'Écho sans touche de raison est identique à celui de la test 8, octet pour octet (fonction coupée)',async()=>{
 const res=await jouer();
 const e=jouer.empreintes(res,REF.version,K.VERSION);
 for(const k of ['records','events','native','dataset'])assert.equal(e[k],REF[k],`${k} : changé`);
 assert.deepEqual(e.visites,REF.visites);assert.deepEqual(e.evenements,REF.evenements);
 assert.ok(res.records.every(r=>!('raisonCorrection' in r)));assert.ok(!('raison' in res.native));assert.ok(!('raisonSeries' in res.dataset));
});
test('fonction allumée, aucune touche de raison tapée : visites, événements et export identiques ; la session dit seulement que la lecture était allumée',async()=>{
 const res=await jouer({demarrage:ON});
 assert.deepEqual(res.native.raison,{format:'ariane-raison-v1',actif:true,touches:'chiffres',collante:null,derniere:null,serieSuivante:1,series:[],poses:0});
 assert.deepEqual(res.dataset.session.raison,res.native.raison);
 delete res.native.raison;delete res.dataset.session.raison;
 const e=jouer.empreintes(res,REF.version,K.VERSION);
 for(const k of ['records','events','native','dataset'])assert.equal(e[k],REF[k],`${k} : changé`);
 assert.ok(!('raisonSeries' in res.dataset),'aucune série : pas de résumé');
});
test('le champ raisonCorrection est écrit dans la visite ; le 0 l\'efface (code nul), l\'ancien choix est gardé dans l\'historique',async()=>{
 await seance(async f=>{
  const a=await f.open('v1',100);f.avancer(400);await f.touche('v1',a,chiffre(3));
  const r=visite(f,'v1').raisonCorrection;
  assert.deepEqual(Object.keys(r),['format','code','source','serie','poseeA','eventSeq','apresValidationMs','historique']);
  assert.equal(r.format,'ariane-raison-v1');assert.equal(r.code,'pn');assert.equal(r.source,'touche');assert.equal(r.serie,null);assert.equal(r.apresValidationMs,null);assert.deepEqual(r.historique,[]);
  assert.match(r.poseeA,/^2026-10-19T09:00:00\.400Z$/);assert.ok(Number.isInteger(r.eventSeq)&&r.eventSeq>0);
  const op=visite(f,'v1').operatorEvents.at(-1);assert.equal(op.eventSeq,r.eventSeq,'la raison pointe l\'événement de la touche');assert.equal(op.code,'Digit3','la touche reste consignée comme avant');
  assert.equal(f.engine.s.native.visits[0].raison,'pn','résumé de la visite dans l\'état, pour la bande du panneau');
  f.avancer(900);await f.touche('v1',a,chiffre(5));
  assert.equal(visite(f,'v1').raisonCorrection.code,'hauteur');assert.deepEqual(visite(f,'v1').raisonCorrection.historique.map(h=>h.code),['pn']);
  f.avancer(900);await f.touche('v1',a,chiffre(0));
  const z=visite(f,'v1').raisonCorrection;assert.equal(z.code,null);assert.deepEqual(z.historique.map(h=>h.code),['pn','hauteur']);
  assert.equal(f.engine.s.native.visits[0].raison??null,null);
 });
});
test('une touche qui n\'est pas une raison, ou tapée dans un champ de texte, ou tenue : aucun champ',async()=>{
 await seance(async f=>{
  const a=await f.open('v1',100);
  for(const e of [{code:'Digit7',key:'character'},{code:'KeyD',key:'character'},{code:null,key:null,editable:true},{...chiffre(2),repeat:true},{...chiffre(2),ctrlKey:true},{...chiffre(2),altKey:true},{...chiffre(2),type:'keyup'}]){f.avancer(100);await f.touche('v1',a,e);}
  assert.equal('raisonCorrection' in visite(f,'v1'),false);assert.equal(f.engine.s.native.raison.poses,0);
 });
});
test('fonction coupée (réglage non donné ou inactif) : les chiffres de raison ne font rien et la session ne porte aucun état',async()=>{
 for(const demarrage of [undefined,{},{raison:{actif:false,touches:'chiffres'}},{raison:null}])
  await jouer({prelude:false,demarrage,frappes:async f=>{const a=await f.open('v1',100);await f.touche('v1',a,chiffre(3));
   assert.equal('raisonCorrection' in visite(f,'v1'),false);assert.equal('raison' in f.engine.s.native,false);
   assert.deepEqual(f.appels.find(x=>x[0]==='nativeStart')[1],{sessionId:f.engine.s.native.id,observationPeriodId:f.engine.s.native.observationPeriods[0].observationPeriodId},'rien de plus envoyé à la page');
  }});
});
test('la page reçoit l\'indication « raison » au démarrage et à la reprise, seulement quand la fonction est allumée',async()=>{
 await seance(async f=>{
  const s=f.engine.s.native;assert.equal(f.appels.find(x=>x[0]==='nativeStart')[1].raison,true);
  await f.sessions.pause();await f.sessions.resume();assert.equal(f.appels.find(x=>x[0]==='nativeResume')[1].raison,true);
  assert.equal(s.raison.touches,'chiffres');
 });
});

test('collante : deux appuis rendent la raison collante ; les visites suivantes la reçoivent ; une raison seule passe avant elle pour ce cut ; le 0 la finit',async()=>{
 await seance(async f=>{
  let a=await f.open('v1',100);f.avancer(400);await f.touche('v1',a,chiffre(2));f.avancer(250);await f.touche('v1',a,chiffre(2));
  const o=visite(f,'v1').raisonCorrection;assert.deepEqual([o.code,o.source,o.serie],['adv','touche',1]);const ouverture=o.eventSeq;
  await valider(f,'v1',a);f.avancer(80);await f.fermer('v1',a,101);
  const b=await f.open('v2',101);const r2=visite(f,'v2').raisonCorrection;
  assert.deepEqual([r2.code,r2.source,r2.serie,r2.eventSeq,r2.apresValidationMs],['adv','collante',1,ouverture,null]);assert.equal(r2.poseeA,visite(f,'v2').startedAt);
  f.avancer(300);await f.fermer('v2',b,102);
  const c=await f.open('v3',102);f.avancer(300);await f.touche('v3',c,chiffre(4));
  const r3=visite(f,'v3').raisonCorrection;assert.deepEqual([r3.code,r3.source,r3.serie],['nuage-pauvre','touche',null]);assert.deepEqual(r3.historique.map(h=>[h.code,h.source]),[['adv','collante']]);
  await f.fermer('v3',c,103);
  const d=await f.open('v4',103);assert.deepEqual([visite(f,'v4').raisonCorrection.code,visite(f,'v4').raisonCorrection.source],['adv','collante'],'la collante reprend');
  f.avancer(900);await f.touche('v4',d,chiffre(0));
  assert.equal(visite(f,'v4').raisonCorrection.code,null);assert.equal(f.engine.s.native.raison.collante,null);await f.fermer('v4',d,104);
  await f.open('v5',104);assert.equal('raisonCorrection' in visite(f,'v5'),false,'après le 0, plus de collante');
  assert.deepEqual(R.resumeSeries(f.engine.s.native.raison),[{serie:1,code:'adv',partie:23,cutDebut:100,cutFin:103,nCuts:4,finPar:'touche-0'}]);
  assert.deepEqual(f.engine.s.native.visits.map(v=>v.raison??null),['adv','adv','nuage-pauvre',null,null]);
 });
});
test('résumé raisonSeries : écrit une fois dans l\'en-tête de l\'export, avec la cause de fin ; la série encore ouverte à la fin de séance est finie « fin-seance »',async()=>{
 const res=await seance(async f=>{
  const a=await f.open('v1',100);f.avancer(300);await f.touche('v1',a,chiffre(3));f.avancer(300);await f.touche('v1',a,chiffre(3));
  await f.fermer('v1',a,101);const b=await f.open('v2',101);await f.fermer('v2',b,102);await f.open('v3',102);
  const milieu=await f.sessions.dataset();assert.deepEqual(milieu.raisonSeries,[{serie:1,code:'pn',partie:23,cutDebut:100,cutFin:102,nCuts:3,finPar:null}],'série ouverte pendant la séance');
 });
 assert.deepEqual(res.dataset.raisonSeries,[{serie:1,code:'pn',partie:23,cutDebut:100,cutFin:102,nCuts:3,finPar:'fin-seance'}]);
 assert.deepEqual(Object.keys(res.dataset).slice(0,3),['format','version','exportedAt'],'l\'ordre de l\'en-tête d\'avant est gardé');
});
test('fin de série par changement de partie, saut de plus de 30 cuts, pause',async()=>{
 await seance(async f=>{
  let a=await f.open('v1',100);f.avancer(200);await f.touche('v1',a,chiffre(2));f.avancer(200);await f.touche('v1',a,chiffre(2));await f.fermer('v1',a,101);
  const b=await f.open('v2',101);assert.equal(visite(f,'v2').raisonCorrection.source,'collante');await f.fermer('v2',b,102);
  const c=await f.open('v3',1,24);assert.equal('raisonCorrection' in visite(f,'v3'),false,'autre partie');
  assert.equal(R.resumeSeries(f.engine.s.native.raison).at(-1).finPar,'changement-partie');await f.fermer('v3',c,2);
  /* nouvelle série, puis un saut de 31 cuts */
  const d=await f.open('v4',10,24);f.avancer(200);await f.touche('v4',d,chiffre(1));f.avancer(200);await f.touche('v4',d,chiffre(1));await f.fermer('v4',d,41);
  await f.open('v5',41,24);assert.equal('raisonCorrection' in visite(f,'v5'),false,'31 cuts plus loin');assert.equal(R.resumeSeries(f.engine.s.native.raison).at(-1).finPar,'saut');
  /* pause : la série finit, et la visite d'après n'a rien */
  const e=await f.open('v6',42,24);f.avancer(200);await f.touche('v6',e,chiffre(6));f.avancer(200);await f.touche('v6',e,chiffre(6));
  await f.sessions.pause();assert.equal(R.resumeSeries(f.engine.s.native.raison).at(-1).finPar,'pause');await f.sessions.resume();
  await f.open('v7',43,24);assert.equal('raisonCorrection' in visite(f,'v7'),false,'après la pause');
  assert.deepEqual(R.resumeSeries(f.engine.s.native.raison).map(s=>[s.serie,s.code,s.finPar]),[[1,'adv','changement-partie'],[2,'rail-voisin','saut'],[3,'autre','pause']]);
 });
});
test('la collante survit à un F5 (page perdue puis reprise), elle est gardée dans l\'état de la session',async()=>{
 await seance(async f=>{
  const a=await f.open('v1',100);f.avancer(200);await f.touche('v1',a,chiffre(3));f.avancer(200);await f.touche('v1',a,chiffre(3));
  await f.sessions.pageLost('page-reloaded');assert.equal(f.engine.s.native.status,'PAUSED_ADAPTER_UNRESPONSIVE');
  assert.equal(f.engine.s.native.raison.collante.code,'pn','pas finie par le F5');
  await f.sessions.resume();
  await f.open('v2',100);const r=visite(f,'v2').raisonCorrection;assert.deepEqual([r.code,r.source,r.serie],['pn','collante',1]);
  assert.equal(f.engine.s.native.raison.collante.nCuts,1,'le même cut revu après le F5 n\'ajoute pas de cut');
  /* l'état est bien celui que le service worker garde (copie de l'état persisté) */
  const gardee=JSON.parse(JSON.stringify(f.store.state.native.raison));assert.equal(gardee.collante.code,'pn');assert.equal(gardee.collante.serie,1);
 });
});


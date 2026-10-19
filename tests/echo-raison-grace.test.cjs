'use strict';
/* RM-11 (test 9, essais 2 et 7) — le délai de grâce de 500 ms (la touche tapée juste après la validation va au cut validé), les replis de touches, le secours du panneau
 * (pastilles) et « jamais bloquant » : une erreur du module ou une écriture refusée n'empêche ni la frappe d'être consignée ni la visite d'être enregistrée. */
const {test}=require('node:test'),assert=require('node:assert/strict');

const {jouer,ON,chiffre,seance,visite,valider}=require('./helpers/echo-raison-outils.cjs'),R=require('../src/raison-correction.js'),K=require('../src/core.js');
test('délai de grâce : une touche tapée jusqu\'à 500 ms après la validation, sur le cut suivant, va au cut validé (apresValidationMs)',async()=>{
 await seance(async f=>{
  const a=await f.open('v1',100);f.avancer(600);await valider(f,'v1',a);const T=f.maintenant();
  f.avancer(150);await f.fermer('v1',a,101);const b=await f.open('v2',101);
  /* relâchements de la validation sur le cut suivant : ils ne comptent pas comme un autre geste */
  f.avancer(50);await f.touche('v2',b,{type:'keyup',code:'Space',key:' ',shiftKey:true});await f.touche('v2',b,{type:'keyup',code:'ShiftLeft',key:'Shift'});
  f.avancer(100);await f.touche('v2',b,chiffre(3));
  assert.equal(f.maintenant()-T,300);
  const r=visite(f,'v1').raisonCorrection;assert.deepEqual([r.code,r.source,r.apresValidationMs],['pn','touche',300]);
  assert.equal('raisonCorrection' in visite(f,'v2'),false,'le cut affiché ne reçoit rien');
  assert.equal(visite(f,'v2').operatorEvents.at(-1).code,'Digit3','la frappe reste consignée sur la visite où elle a eu lieu, comme avant');
  assert.equal(f.engine.s.native.visits[0].raison,'pn');assert.equal(f.engine.s.native.visits[1].raison??null,null);
 });
});
test('délai de grâce : 501 ms après, ou après un autre geste sur le cut suivant, ou sans validation : la touche va au cut affiché',async()=>{
 await seance(async f=>{
  /* 501 ms */
  let a=await f.open('v1',100);await valider(f,'v1',a);f.avancer(100);await f.fermer('v1',a,101);let b=await f.open('v2',101);f.avancer(401);await f.touche('v2',b,chiffre(3));
  assert.equal('raisonCorrection' in visite(f,'v1'),false);assert.equal(visite(f,'v2').raisonCorrection.code,'pn');assert.equal(visite(f,'v2').raisonCorrection.apresValidationMs,null);
  /* autre geste (D) avant la touche */
  f.avancer(2000);a=await f.open('v3',102);await valider(f,'v3',a);f.avancer(100);await f.fermer('v3',a,103);b=await f.open('v4',103);f.avancer(100);await f.touche('v4',b,{code:'KeyD',key:'character'});f.avancer(100);await f.touche('v4',b,chiffre(1));
  assert.equal('raisonCorrection' in visite(f,'v3'),false);assert.equal(visite(f,'v4').raisonCorrection.code,'rail-voisin');
  /* le cut d'avant a été passé (SKIP), pas validé */
  f.avancer(2000);a=await f.open('v5',104);await f.touche('v5',a,{code:'Backspace',key:'Backspace',shiftKey:true,intent:'SKIP',decisionKey:'Shift+Backspace'});f.avancer(50);await f.fermer('v5',a,105);
  b=await f.open('v6',105);f.avancer(100);await f.touche('v6',b,chiffre(2));assert.equal('raisonCorrection' in visite(f,'v5'),false);assert.equal(visite(f,'v6').raisonCorrection.code,'adv');
 });
});
test('délai de grâce : une touche arrivée sur le cut validé lui-même, après la validation, porte la marque apresValidationMs',async()=>{
 await seance(async f=>{
  const a=await f.open('v1',100);await valider(f,'v1',a);f.avancer(200);await f.touche('v1',a,chiffre(4));
  assert.deepEqual([visite(f,'v1').raisonCorrection.code,visite(f,'v1').raisonCorrection.apresValidationMs],['nuage-pauvre',200]);
  /* avant la validation : pas de marque */
  f.avancer(1000);const b=await f.open('v2',101);f.avancer(100);await f.touche('v2',b,chiffre(4));assert.equal(visite(f,'v2').raisonCorrection.apresValidationMs,null);
 });
});
test('délai de grâce : un double appui au-delà de la frontière ouvre la collante au cut validé et le cut affiché la reçoit aussi',async()=>{
 await seance(async f=>{
  const a=await f.open('v1',100);await valider(f,'v1',a);f.avancer(100);await f.fermer('v1',a,101);const b=await f.open('v2',101);
  f.avancer(100);await f.touche('v2',b,chiffre(2));f.avancer(150);await f.touche('v2',b,chiffre(2));
  const r1=visite(f,'v1').raisonCorrection;assert.deepEqual([r1.code,r1.source,r1.serie],['adv','touche',1]);
  const r2=visite(f,'v2').raisonCorrection;assert.deepEqual([r2.code,r2.source,r2.serie,r2.eventSeq],['adv','collante',1,r1.eventSeq]);
  assert.deepEqual(R.resumeSeries(f.engine.s.native.raison),[{serie:1,code:'adv',partie:23,cutDebut:100,cutFin:101,nCuts:2,finPar:null}]);
 });
});
test('délai de grâce : un 0 de l\'autre côté de la frontière efface le cut validé et finit la collante, aussi sur le cut affiché',async()=>{
 await seance(async f=>{
  let a=await f.open('v1',100);f.avancer(200);await f.touche('v1',a,chiffre(2));f.avancer(150);await f.touche('v1',a,chiffre(2));await f.fermer('v1',a,101);
  a=await f.open('v2',101);f.avancer(1000);await valider(f,'v2',a);f.avancer(100);await f.fermer('v2',a,102);const b=await f.open('v3',102);
  assert.equal(visite(f,'v3').raisonCorrection.source,'collante');
  f.avancer(150);await f.touche('v3',b,chiffre(0));
  assert.equal(visite(f,'v2').raisonCorrection.code,null);assert.equal(visite(f,'v2').raisonCorrection.apresValidationMs,250);
  assert.equal(visite(f,'v3').raisonCorrection.code,null,'la raison héritée du cut affiché est aussi retirée');assert.equal(f.engine.s.native.raison.collante,null);
  assert.equal(R.resumeSeries(f.engine.s.native.raison)[0].finPar,'touche-0');
 });
});

test('replis : la table « pavé » ou « alt-chiffres » choisit une autre rangée de touches ; la rangée du haut ne fait plus rien',async()=>{
 await seance(async f=>{
  const a=await f.open('v1',100);await f.touche('v1',a,chiffre(3));assert.equal('raisonCorrection' in visite(f,'v1'),false,'rangée du haut ignorée');
  f.avancer(100);await f.touche('v1',a,{code:'Numpad3',key:'3'});assert.equal(visite(f,'v1').raisonCorrection.code,'pn');
 },{raison:{actif:true,touches:'pave'}});
 await seance(async f=>{
  const a=await f.open('v1',100);await f.touche('v1',a,chiffre(3));assert.equal('raisonCorrection' in visite(f,'v1'),false);
  f.avancer(100);await f.touche('v1',a,{...chiffre(3),altKey:true});assert.equal(visite(f,'v1').raisonCorrection.code,'pn');
 },{raison:{actif:true,touches:'alt-chiffres'}});
 await seance(async f=>assert.equal(f.engine.s.native.raison.touches,'chiffres'),{raison:{actif:true,touches:'inconnue'}});
});

test('secours du panneau : une pastille vaut la touche sur le cut en cours, le double clic rend la raison collante, le 0 efface ; le geste est consigné au journal',async()=>{
 await seance(async f=>{
  const a=await f.open('v1',100);f.avancer(300);
  const r=await f.sessions.raisonPanneau({code:'nuage-pauvre'});assert.deepEqual(r,{pris:true});
  const c=visite(f,'v1').raisonCorrection;assert.deepEqual([c.code,c.source,c.serie],['nuage-pauvre','touche',null]);assert.equal(c.poseeA,'2026-10-19T09:00:00.300Z');
  const evenement=f.store.events.filter(e=>e.type==='native-raison-panneau');assert.equal(evenement.length,1);assert.equal(evenement[0].code,'nuage-pauvre');assert.equal(evenement[0].visitId,'v1');assert.equal(c.eventSeq,evenement[0].eventSeq);
  f.avancer(200);await f.sessions.raisonPanneau({code:'hauteur'});f.avancer(200);await f.sessions.raisonPanneau({code:'hauteur'});
  assert.equal(f.engine.s.native.raison.collante.code,'hauteur','deux clics en moins de 600 ms : collante');
  await f.fermer('v1',a,101);await f.open('v2',101);assert.deepEqual([visite(f,'v2').raisonCorrection.code,visite(f,'v2').raisonCorrection.source],['hauteur','collante']);
  f.avancer(900);await f.sessions.raisonPanneau({efface:true});assert.equal(visite(f,'v2').raisonCorrection.code,null);assert.equal(f.engine.s.native.raison.collante,null);
  assert.equal(f.engine.s.native.visits[0].raison,'hauteur');assert.equal(f.engine.s.native.visits[1].raison??null,null);
  /* un code inconnu est refusé ; rien n'est écrit */
  const avant=JSON.stringify(visite(f,'v2').raisonCorrection);await assert.rejects(()=>f.sessions.raisonPanneau({code:'inconnue'}),/Raison inconnue/);assert.equal(JSON.stringify(visite(f,'v2').raisonCorrection),avant);
 });
});
test('secours du panneau : sans cut en cours, en pause, ou lecture coupée, rien n\'est consigné et la réponse le dit',async()=>{
 await seance(async f=>{
  assert.equal((await f.sessions.raisonPanneau({code:'adv'})).pris,false,'aucun cut en cours');
  await f.open('v1',100);await f.sessions.pause();assert.equal((await f.sessions.raisonPanneau({code:'adv'})).pris,false,'en pause');
  assert.equal('raisonCorrection' in visite(f,'v1'),false);
 });
 await seance(async f=>{await f.open('v1',100);assert.equal((await f.sessions.raisonPanneau({code:'adv'})).pris,false,'lecture coupée');assert.equal('raisonCorrection' in visite(f,'v1'),false);
  assert.equal(f.store.events.some(e=>e.type==='native-raison-panneau'),false);},{raison:{actif:false}});
});
test('jamais bloquant : une erreur du module n\'empêche pas d\'enregistrer la visite, ni la frappe, ni la suite',async()=>{
 const vrai={lire:R.lireFrappe,appuyer:R.appuyer,heriter:R.heriter};
 try{
  for(const nom of ['lireFrappe','appuyer','heriter']){
   R[nom]=()=>{throw Error('panne '+nom);};
   await seance(async f=>{
    const a=await f.open('v1',100);f.avancer(100);
    const reponse=await f.touche('v1',a,chiffre(3));assert.equal(reponse?.saved,true,nom);
    assert.equal(visite(f,'v1').operatorEvents.at(-1).code,'Digit3',nom+' : la frappe est consignée');
    await valider(f,'v1',a);await f.fermer('v1',a,101);await f.open('v2',101);assert.equal(f.engine.s.native.visits.length,2,nom);assert.equal(visite(f,'v1').operatorIntent,'VALIDATE',nom);
   });
   R.lireFrappe=vrai.lire;R.appuyer=vrai.appuyer;R.heriter=vrai.heriter;
  }
 }finally{R.lireFrappe=vrai.lire;R.appuyer=vrai.appuyer;R.heriter=vrai.heriter;}
});
test('jamais bloquant : une écriture refusée de la visite précédente (délai de grâce) n\'empêche pas la frappe d\'être consignée',async()=>{
 await seance(async f=>{
  const a=await f.open('v1',100);await valider(f,'v1',a);f.avancer(50);await f.fermer('v1',a,101);const b=await f.open('v2',101);
  await f.sessions.continuityIdle();   // plus d'écriture de fond sur v1
  const put=f.store.putRecord.bind(f.store);f.store.putRecord=async r=>{if(r.visitId==='v1')throw Error('disque plein');return put(r);};
  f.avancer(100);const reponse=await f.touche('v2',b,chiffre(3));f.store.putRecord=put;
  assert.equal(reponse.saved,true);assert.equal(visite(f,'v2').operatorEvents.at(-1).code,'Digit3');
 });
});

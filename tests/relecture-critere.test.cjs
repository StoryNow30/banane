'use strict';
/* 5.0 (D-170, D-173) — règle prudente de correction de la relecture (src/relecture-critere.js), fonction pure. Données synthétiques.
 *  - un seul « oui » : toutes les conditions tiennent ; chaque condition manquante dit sa raison ;
 *  - jamais de changement de voie, refus si les deux rails ne sont pas cohérents ;
 *  - réglages : le fichier proposé s'il se lit, valeur par valeur ; le défaut PROVISOIRE sinon, égal au fichier par défaut. */
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const Q=require('../src/relecture-critere.js');
const ec=(l,r)=>({left:{long:0,lat:l[0],vert:l[1]},right:{long:0,lat:r[0],vert:r[1]}});
/* Un cut que la règle accepte : vert d'abords, étage « window », 14 mm en travers sur les deux rails, confiance 90. */
const bon=(x={})=>({zone:'abords',role:'vert',skipOmbre:{raison:null},ecartementMm:1436,ecartementRefMm:1435,
 jugement:{etage:'window',poseCalculee:{left:[0,0,0],right:[0,0,0]},ecartMm:ec([14,1],[13,0]),confiance:{left:90,right:92}},...x});
const avec=(f)=>{const e=bon();f(e);return Q.juger(e);};

test('un cut qui passe toutes les conditions : corriger, avec la raison',()=>{
 const r=Q.juger(bon());assert.equal(r.corriger,true);assert.equal(r.regle,'ok');assert.match(r.raison,/zone abords, écart 14 mm \(seuil 12\)/);
});

test('chaque condition manquante refuse, avec sa raison (première manquante)',()=>{
 const cas=[
  [e=>{e.jugement.poseCalculee=null;},'pose'],
  [e=>{e.skipOmbre={raison:'aucun-point'};},'skip'],
  [e=>{e.role='lot';},'role'],[e=>{e.role='differe';},'role'],
  [e=>{e.jugement.etage='first-pass';},'etage'],[e=>{e.jugement.etage='choice';},'etage'],
  [e=>{e.zone='adv';},'zone'],[e=>{e.zone='inconnue';},'zone'],
  [e=>{e.jugement.ecartMm=ec([10,1],[9,0]);},'seuil'],
  [e=>{e.jugement.confiance={left:'s1',right:95};},'confiance'],[e=>{e.jugement.confiance={left:95,right:70};},'confiance'],[e=>{e.jugement.confiance=null;},'confiance'],
  [e=>{e.ecartementMm=1450;},'coherence'],[e=>{e.ecartementMm=NaN;},'coherence']];
 for(const [f,regle] of cas){const r=avec(f);assert.equal(r.corriger,false,regle);assert.equal(r.regle,regle,r.raison);assert.ok(r.raison.length>5);}
});

test('jamais de changement de voie : un rail déplacé de plus de 60 mm en travers est refusé, même cohérent',()=>{
 for(const lat of [61,163,280,-1500]){const r=avec(e=>{e.jugement.ecartMm=ec([lat,0],[lat,0]);e.zone='pn';});
  assert.equal(r.corriger,false);assert.equal(r.regle,'voie',r.raison);assert.match(r.raison,/autre voie possible/);}
 assert.equal(avec(e=>{e.jugement.ecartMm=ec([40,0],[40,0]);}).corriger,true,'40 mm, deux rails ensemble : accepté');
});

test('les deux rails doivent être cohérents : une correction qui tord la voie est refusée',()=>{
 /* Un seul rail déplacé (14 mm en travers, l'autre immobile), ou un seul rail relevé (convention verticale) : refusé. */
 assert.equal(avec(e=>{e.jugement.ecartMm=ec([14,0],[0,0]);}).regle,'coherence');
 assert.equal(avec(e=>{e.jugement.ecartMm=ec([0,15],[0,0]);}).regle,'coherence');
 assert.equal(avec(e=>{e.jugement.ecartMm=ec([0,15],[0,13]);}).corriger,true,'les deux rails relevés ensemble : accepté');
});

test('`ecrit` (la pose qui serait écrite) remplace l’écart du jugement pour le seuil, la voie et la cohérence',()=>{
 assert.equal(avec(e=>{e.ecrit=ec([2,0],[2,0]);}).regle,'seuil');
 assert.equal(avec(e=>{e.ecrit=ec([90,0],[90,0]);}).regle,'voie');
 assert.equal(avec(e=>{e.jugement.ecartMm=ec([2,0],[2,0]);e.ecrit=ec([14,0],[14,0]);}).corriger,true);
});

test('réglages : défaut provisoire égal au fichier par défaut ; fichier proposé lu valeur par valeur ; illisible → défaut',()=>{
 const fichier=JSON.parse(fs.readFileSync(path.join(__dirname,'../datasets/relecture-reglages-defaut.json'),'utf8'));
 const {note,...sansNote}=fichier;assert.equal(fichier.statut,'provisoire');assert.ok(note.includes('PROVISOIRES'));
 assert.deepEqual(JSON.parse(JSON.stringify(Q.DEFAUT)),sansNote,'le défaut du module recopie le fichier par défaut');
 assert.deepEqual(Q.reglages(fichier,'fichier-defaut').zones,JSON.parse(JSON.stringify(Q.DEFAUT.zones)));
 for(const x of [null,'texte',[],{format:'autre'}])assert.equal(Q.reglages(x).source,'defaut');
 const p=Q.reglages({format:'ariane-relecture-reglages-1',statut:'chiffre',zones:{adv:{corriger:true,seuilMm:20,confianceMin:'x'},pn:{seuilMm:-3}},
  voie:{lateralMaxMm:9999},etagesPermis:['window','choice'],roles:['vert','lot']},'propose');
 assert.equal(p.source,'propose');assert.equal(p.statut,'chiffre');
 assert.deepEqual(p.zones.adv,{corriger:true,seuilMm:20,confianceMin:95},'valeur invalide : défaut');
 assert.equal(p.zones.pn.seuilMm,15);assert.equal(p.voie.lateralMaxMm,60,'au-delà de 500 mm : défaut');
 assert.deepEqual(p.etagesPermis,['window','choice']);assert.deepEqual(p.roles,['vert'],'un rôle inconnu (« lot ») rend le défaut');
 /* Les réglages proposés changent le jugement : ADV ouverte. */
 assert.equal(Q.juger(bon({zone:'adv',jugement:{...bon().jugement,ecartMm:ec([22,0],[21,0]),confiance:{left:96,right:97}}}),p).corriger,true);
});

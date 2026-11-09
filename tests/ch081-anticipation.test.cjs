'use strict';
/* CH-081 (D-311) — ANTICIPATION DU PRÉCHAUFFAGE, module de page `src/prechauffage-anticipation.js`. Essais purs (Node), données synthétiques. Ils prouvent :
 *  - réglage : défaut prudent du module (1 coupe, 1 candidat), plafonds du lot 4 000 requêtes et 1 200 Mo, repli à 30 % ; hors bornes : défaut ;
 *  - cibles : k+1, puis les changements de mode, puis k+2 ; au plus `candidatsMax` ; saut compté depuis la précédente de la chaîne ; `sautMin` ;
 *    chaîne rompue arrêtée ; doublons et coupe courante retirés ; source hors liste refusée ;
 *  - budget du lot : plafonds de requêtes et d'octets, repli à 1 candidat au-delà de 30 % de nœuds inutiles sur la fenêtre, et retour quand ça redescend ;
 *  - relevé de la vue : entiers et types d'une liste fermée, aucune adresse ni position ; signature qui change avec un réglage. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const A=require('../src/prechauffage-anticipation.js');
const l=(i,source='liste-esv')=>({i,source,e:[i,0,0,i,1.435,0]});

test('réglage : défaut prudent, bornes',()=>{
 assert.deepEqual({...A.reglage()},{horizon:1,candidatsMax:1,lotRequetesMax:4000,lotOctetsMax:1258291200,repliInutiles:.3,repliFenetre:50});
 assert.equal(A.reglage({horizon:2}).horizon,2);assert.equal(A.reglage({horizon:9}).horizon,1);assert.equal(A.reglage({candidatsMax:3}).candidatsMax,3);
 assert.equal(A.reglage({repliInutiles:.25}).repliInutiles,.25);assert.equal(A.reglage({repliInutiles:2}).repliInutiles,.3);
 assert.deepEqual([...A.SOURCES_CIBLE],['liste-esv','relu','passe-differes','b1-fenetre','changement-mode']);
});

test('cibles : k+1, changements de mode, puis k+2 ; au plus 3 ; saut depuis la précédente de la chaîne',()=>{
 const c=A.cibles({coupe:100,suite:[l(150),l(152)],modes:[l(7,'changement-mode')],horizon:2,candidatsMax:3,sautMin:2});
 assert.deepEqual(c.map(x=>[x.i,x.source,x.rang,x.saut]),[[150,'liste-esv',1,50],[7,'changement-mode',1,-93],[152,'liste-esv',2,2]]);
 assert.deepEqual(A.cibles({coupe:100,suite:[l(150),l(152)],modes:[l(7,'changement-mode')],horizon:2,candidatsMax:1,sautMin:2}).map(x=>x.i),[150],'un seul candidat');
 assert.deepEqual(A.cibles({coupe:100,suite:[l(150),l(152)],horizon:1,candidatsMax:3}).map(x=>x.i),[150],'horizon 1 : la suivante seule');
});

test('cibles : sautMin, chaîne rompue, doublons, coupe courante, source inconnue',()=>{
 assert.deepEqual(A.cibles({coupe:10,suite:[l(11),l(30)],horizon:2,candidatsMax:3,sautMin:2}).map(x=>[x.i,x.saut]),[[30,19]],'k+1 voisine : rien pour elle ; k+2 lointaine depuis k+1');
 assert.deepEqual(A.cibles({coupe:10,suite:[l(40),{i:-1,source:'liste-esv'},l(80)],horizon:3,candidatsMax:3}).map(x=>x.i),[40],'chaîne rompue');
 assert.deepEqual(A.cibles({coupe:10,suite:[l(40),l(40)],modes:[l(40,'changement-mode'),l(10,'changement-mode')],horizon:2,candidatsMax:3}).map(x=>x.i),[40],'doublons et coupe courante');
 assert.deepEqual(A.cibles({coupe:10,suite:[l(40,'autre')],horizon:1}),[],'source hors liste');
 assert.deepEqual(A.cibles({coupe:10,modes:[l(40)],candidatsMax:3}),[],'un mode doit porter la source changement-mode');
 assert.deepEqual(A.cibles({coupe:'x',suite:[l(4)]}),[]);
});

test('budget du lot : plafonds de requêtes et d\'octets',()=>{
 const b=A.creerBudget({lotRequetesMax:10,lotOctetsMax:2*1048576});
 assert.equal(b.autorise(10,0),true);b.compter(9,1048576);assert.equal(b.autorise(1,0),true);assert.equal(b.autorise(2,0),false);
 assert.equal(b.autorise(1,1048577),false);b.compter(1,0);assert.deepEqual(b.etat(),{requetes:10,octets:1048576,repli:false,operations:0,plafondRequetes:true,plafondOctets:false});
});

test('repli à 1 candidat au-delà de 30 % de nœuds inutiles sur la fenêtre, puis retour',()=>{
 const b=A.creerBudget({repliFenetre:4});
 assert.equal(b.candidatsMax(3),3);
 b.bilanter(10,10);b.bilanter(10,9);assert.equal(b.candidatsMax(3),3,'5 % inutiles');
 b.bilanter(10,0);assert.equal(b.candidatsMax(3),1,'11/30 inutiles > 30 %');assert.equal(b.etat().repli,true);
 b.bilanter(10,10);b.bilanter(10,10);b.bilanter(10,10);assert.equal(b.candidatsMax(3),3,'la fenêtre a oublié le mauvais bilan');
 b.bilanter(0,0);b.bilanter(3,-1);b.bilanter('x',1);assert.equal(b.etat().operations,4,'bilans illisibles ignorés');
});

test('relevé de la vue : orthographique d\'ESV en entiers, aucune adresse ni position ; signature',()=>{
 const cam={isOrthographicCamera:true,type:'OrthographicCamera',projectionMatrix:{elements:[5,0,0,0,0,4.3873704,0,0,0,0,-0.0000999983,0,0,0,0,1]},position:{x:844565.7,y:6519774,z:172.78}};
 const pc={maxLevel:Infinity,minimumNodePixelSize:30,material:{clipBoxes:[{}]},url:'https://x.invalid/ept.json'};
 const r=A.releveVue({camera:cam,pointBudget:1000000,pointcloud:pc});
 assert.deepEqual({...r},{type:'orthographique',demiLargeurMm:200,demiHauteurMm:228,profondeurM:20000,champDeg:null,pointBudget:1000000,maxLevel:-1,minNodeSize:30,boites:1});
 assert.ok(!/x\.invalid|844565|6519774|ept/.test(JSON.stringify(r)),'ni adresse ni position');
 assert.ok(A.TYPES_VUE.includes(r.type));
 const r2=A.releveVue({camera:cam,pointBudget:2000000,pointcloud:pc});assert.notEqual(A.signatureVue(r),A.signatureVue(r2));
 assert.equal(A.signatureVue(r),A.signatureVue(A.releveVue({camera:cam,pointBudget:1000000,pointcloud:pc})));
 assert.equal(A.releveVue({camera:{isPerspectiveCamera:true,fov:55}}).champDeg,55);
 assert.equal(A.releveVue({}).type,'absente');
 const piege={get isOrthographicCamera(){throw Error('x');}};assert.equal(A.releveVue({camera:piege}).type,'autre','une propriété qui lève ne casse rien');
});

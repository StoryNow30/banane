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
 jugement:{etage:'window',appuis:[110,112],poseCalculee:{left:[0,0,0],right:[0,0,0]},ecartMm:ec([14,1],[13,0]),confiance:{left:90,right:92}},...x});
/* Réglages d'essai : ceux du défaut d'avant D-174 (abords ouverts à 12 mm, ADV fermée), pour éprouver chaque condition de la règle. */
const ESSAI=Q.reglages({format:'ariane-relecture-reglages-1',statut:'essai',etagesPermis:['first-pass','window'],appuisMin:2,roles:['vert'],jamais:['cut différé par le lot','cut posé par le lot'],
 voie:{lateralMaxMm:45},coherence:{diffLateraleMaxMm:6,diffVerticaleMaxMm:6,ecartementMaxMm:8},
 zones:{pn:{corriger:true,seuilMm:15,confianceMin:85},adv:{corriger:false,seuilMm:25,confianceMin:95},abords:{corriger:true,seuilMm:12,confianceMin:80},'vert-hors-zone':{corriger:true,seuilMm:15,confianceMin:90}}},'essai');
const avec=(f)=>{const e=bon();f(e);return Q.juger(e,ESSAI);};

test('un cut qui passe toutes les conditions : corriger, avec la raison',()=>{
 const r=Q.juger(bon(),ESSAI);assert.equal(r.corriger,true);assert.equal(r.regle,'ok');
 assert.equal(Q.juger(bon()).regle,'ok','défaut D-180 : les abords corrigent (8 mm)');assert.match(r.raison,/zone abords, écart 14 mm \(seuil 12\)/);
});

test('chaque condition manquante refuse, avec sa raison (première manquante)',()=>{
 const cas=[
  [e=>{e.jugement.poseCalculee=null;},'pose'],
  [e=>{e.skipOmbre={raison:'aucun-point'};},'skip'],
  [e=>{e.role='lot';},'role'],[e=>{e.role='differe';},'role'],
  [e=>{e.jugement.etage='deferred';},'etage'],[e=>{e.jugement.etage='choice';},'etage'],[e=>{e.jugement.appuis=[110];},'appuis'],
  [e=>{e.zone='adv';},'zone'],[e=>{e.zone='inconnue';},'zone'],
  [e=>{e.jugement.ecartMm=ec([10,1],[9,0]);},'seuil'],
  [e=>{e.jugement.confiance={left:'s1',right:95};},'confiance'],[e=>{e.jugement.confiance={left:95,right:70};},'confiance'],[e=>{e.jugement.confiance=null;},'confiance'],
  [e=>{e.ecartementMm=1450;},'coherence'],[e=>{e.ecartementMm=NaN;},'coherence'],[e=>{e.ecartementRefMm=null;},'coherence']];
 for(const [f,regle] of cas){const r=avec(f);assert.equal(r.corriger,false,regle);assert.equal(r.regle,regle,r.raison);assert.ok(r.raison.length>5);}
});

test('jamais de changement de voie : un rail déplacé de plus de 45 mm en travers est refusé, même cohérent',()=>{
 for(const lat of [46,163,280,-1500]){const r=avec(e=>{e.jugement.ecartMm=ec([lat,0],[lat,0]);e.zone='pn';});
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
 const {note,...sansNote}=fichier;assert.equal(fichier.statut,'provisoire');assert.ok(note.includes('PROVISOIRES'));assert.ok(note.includes('D-180'));
 assert.deepEqual(JSON.parse(JSON.stringify(Q.DEFAUT)),sansNote,'le défaut du module recopie le fichier par défaut');
 assert.deepEqual(Q.reglages(fichier,'fichier-defaut').zones,JSON.parse(JSON.stringify(Q.DEFAUT.zones)));
 for(const x of [null,'texte',[],{format:'autre'}])assert.equal(Q.reglages(x).source,'defaut');
 const p=Q.reglages({format:'ariane-relecture-reglages-1',statut:'chiffre',zones:{adv:{corriger:true,seuilMm:20,confianceMin:'x'},pn:{seuilMm:-3}},
  voie:{lateralMaxMm:9999},etagesPermis:['window','choice'],roles:['vert','lot']},'propose');
 assert.equal(p.source,'propose');assert.equal(p.statut,'chiffre');
 assert.deepEqual(p.zones.adv,{corriger:true,seuilMm:20,confianceMin:95},'valeur invalide : défaut');
 assert.equal(p.zones.pn.seuilMm,15);assert.equal(p.zones.pn.corriger,false,'correction absente : fermée');assert.equal(p.voie.lateralMaxMm,45,'au-delà de 45 mm : défaut');
 assert.deepEqual(p.invalides,['zones.pn.corriger','zones.pn.seuilMm','zones.abords','zones.vert-hors-zone','voie.lateralMaxMm','roles','jamais']);
 assert.deepEqual(p.etagesPermis,['window','choice']);assert.deepEqual(p.roles,['vert'],'un rôle inconnu (« lot ») rend le défaut');
 /* Les réglages proposés changent le jugement : ADV ouverte. */
 assert.equal(Q.juger(bon({zone:'adv',jugement:{...bon().jugement,ecartMm:ec([22,0],[21,0]),confiance:{left:96,right:97}}}),p).corriger,true);
});

test('fichier proposé réel (datasets/relecture-reglages-proposes.json) : lu tel quel, les quatre étapes, PN, ADV et abords corrigent (D-180), 45 mm, écartement à 15 mm, chaine+h',()=>{
 const f=JSON.parse(fs.readFileSync(path.join(__dirname,'../datasets/relecture-reglages-proposes.json'),'utf8'));
 const r=Q.reglages(f,'propose');
 assert.equal(r.source,'propose');assert.equal(r.statut,'propose');
 assert.deepEqual(r.etagesPermis,['first-pass','window','choice','crossing'],'les quatre étapes qui posent, sans repli sur le défaut');
 assert.deepEqual(JSON.parse(JSON.stringify(r.zones)),{pn:{corriger:true,seuilMm:8,confianceMin:0},adv:{corriger:true,seuilMm:8,confianceMin:0},
  abords:{corriger:true,seuilMm:8,confianceMin:0},'vert-hors-zone':{corriger:false,seuilMm:8,confianceMin:0},ecartement:{corriger:true,seuilMm:8,confianceMin:0}});
 assert.deepEqual(r.roles,['vert']);assert.deepEqual(r.jamais,['cut différé par le lot','cut posé par le lot']);
 assert.equal(r.voie.lateralMaxMm,45);assert.deepEqual(r.coherence,{diffLateraleMaxMm:100,diffVerticaleMaxMm:100,ecartementMaxMm:15});
 assert.equal(r.variante,'chaine+h');assert.equal(r.appuisMin,0,'aucun minimum d’appuis : l’étude n’en a pas');
 assert.deepEqual({...r.selection,liste:undefined},{grappeMin:3,trouCuts:5,margeGrappe:3,margeIsole:1,margeDiffere:2,pn:{margeAvant:4,margeApres:6},adv:{margeAvant:30,margeApres:30},liste:undefined});
 /* Un vert de PN, premier passage, 9 mm, confiance présente, écartement à 10 mm de la médiane : corrigé. */
 const pn=bon({zone:'pn',ecartementMm:1445,ecartementRefMm:1435,jugement:{...bon().jugement,etage:'first-pass',appuis:[],ecartMm:ec([9,0],[2,0]),confiance:{left:3,right:50}}});
 assert.equal(Q.juger(pn,r).corriger,true,Q.juger(pn,r).raison);
 for(const etage of ['window','choice','crossing'])assert.equal(Q.juger({...pn,jugement:{...pn.jugement,etage}},r).corriger,true,etage);
 /* Le même cut en ADV ou aux abords : corrigé de la même façon (D-180) ; à l'écartement seul : de même, le fichier proposé l'ouvre (D-185) ; hors zone : reste en ombre. */
 for(const zone of ['adv','abords','ecartement']){const x=Q.juger({...pn,zone},r);assert.equal(x.corriger,true,zone);assert.equal(x.regle,'ok',zone);}
 {const x=Q.juger({...pn,zone:'vert-hors-zone'},r);assert.equal(x.corriger,false);assert.equal(x.regle,'zone','vert-hors-zone');}
 /* Les mêmes gardes dans les trois zones : 8 mm au moins, 45 mm en travers au plus, écartement à 15 mm de la médiane, verts seulement. */
 for(const zone of ['pn','adv','abords']){const z=Q.juger({...pn,zone},r),n=(m)=>Q.juger({...pn,zone,...m},r);
  assert.equal(n({jugement:{...pn.jugement,ecartMm:ec([7.9,0],[0,0])}}).regle,'seuil',zone+' : sous 8 mm');
  assert.equal(n({jugement:{...pn.jugement,ecartMm:ec([46,0],[40,0])}}).regle,'voie',zone+' : plus de 45 mm en travers');
  assert.equal(n({ecartementMm:1451}).regle,'coherence',zone+' : écartement à plus de 15 mm de la médiane');
  assert.equal(n({role:'differe'}).regle,'role',zone+' : jamais un cut différé');assert.equal(n({role:'lot'}).regle,'role',zone+' : jamais un cut posé par le lot');
  assert.equal(n({skipOmbre:{raison:'aucun-point'}}).regle,'skip',zone+' : jamais un SKIP');assert.equal(z.corriger,true,zone);}
 /* Un interrupteur par zone : corriger:false ferme CETTE zone seulement, sans rendre le fichier invalide ni toucher aux autres. */
 for(const fermee of ['pn','adv','abords']){const x=JSON.parse(JSON.stringify(f));x.zones[fermee].corriger=false;const q=Q.reglages(x,'propose');
  assert.deepEqual(q.invalides,[],fermee+' : interrupteur fermé = choix valide');assert.deepEqual(Q.correctionPermise(q),{ok:true,raison:null},fermee);
  for(const zone of ['pn','adv','abords']){const y=Q.juger({...pn,zone},q);assert.equal(y.corriger,zone!==fermee,`${fermee} fermée : ${zone}`);if(zone===fermee)assert.equal(y.regle,'zone');}}
 /* Sous 8 mm, plus de 45 mm en travers, écartement à plus de 15 mm de la médiane, confiance absente, cut du lot : laissé. */
 assert.equal(Q.juger({...pn,jugement:{...pn.jugement,ecartMm:ec([7.9,0],[0,0])}},r).regle,'seuil');
 assert.equal(Q.juger({...pn,jugement:{...pn.jugement,ecartMm:ec([46,0],[40,0])}},r).regle,'voie');
 assert.equal(Q.juger({...pn,ecartementMm:1451},r).regle,'coherence');
 assert.equal(Q.juger({...pn,jugement:{...pn.jugement,confiance:{left:null,right:50}}},r).regle,'confiance');
 assert.match(Q.juger({...pn,role:'differe'},r).raison,/jamais un cut différé par le lot/);assert.match(Q.juger({...pn,role:'lot'},r).raison,/jamais un cut posé par le lot/);
});

test('zone « ecartement » (H5, D-185) : fermée par défaut et par tout fichier qui ne l\'ouvre pas ; ouverte par un réglage explicite, avec les mêmes limites que les abords',()=>{
 /* Fermée : le défaut, et des réglages qui ouvrent tout le reste mais pas cette zone. */
 assert.equal(Q.DEFAUT.zones.ecartement.corriger,false);
 const sans=Q.reglages({format:'ariane-relecture-reglages-1',zones:{pn:{corriger:true,seuilMm:8,confianceMin:0},adv:{corriger:true,seuilMm:8,confianceMin:0},abords:{corriger:true,seuilMm:8,confianceMin:0},'vert-hors-zone':{corriger:true,seuilMm:8,confianceMin:0}}});
 assert.equal(sans.zones.ecartement.corriger,false,'zone absente du fichier : fermée');assert.ok(!sans.invalides.includes('zones.ecartement'),'absente : pas une erreur, simplement fermée');
 const r=Q.juger(bon({zone:'ecartement'}),sans);assert.equal(r.corriger,false);assert.equal(r.regle,'zone');assert.match(r.raison,/ombre seulement/);
 /* Ouverte : l'opérateur l'a accepté après son Écho de la partie 11 (cuts 6391, 6416, 7177). */
 const ouvert=Q.reglages({format:'ariane-relecture-reglages-1',zones:{pn:{corriger:true,seuilMm:8,confianceMin:0},adv:{corriger:true,seuilMm:8,confianceMin:0},abords:{corriger:true,seuilMm:8,confianceMin:0},'vert-hors-zone':{corriger:false,seuilMm:8,confianceMin:0},ecartement:{corriger:true,seuilMm:8,confianceMin:0}}});
 assert.deepEqual(JSON.parse(JSON.stringify(ouvert.zones.ecartement)),{corriger:true,seuilMm:8,confianceMin:0});
 const forte=bon({zone:'ecartement',jugement:{...bon().jugement,ecartMm:ec([-14,1],[-13,0])}});
 const o=Q.juger(forte,ouvert);assert.equal(o.corriger,true);assert.match(o.raison,/zone ecartement/);
 /* Mêmes limites que les autres zones : seuil, voie (45 mm), cohérence, écartement, rôle. */
 assert.equal(Q.juger({...forte,jugement:{...forte.jugement,ecartMm:ec([7,1],[6,0])}},ouvert).regle,'seuil');
 assert.equal(Q.juger({...forte,jugement:{...forte.jugement,ecartMm:ec([46,0],[40,0])}},ouvert).regle,'voie');
 assert.equal(Q.juger({...forte,ecartementMm:1451},ouvert).regle,'coherence');
 assert.equal(Q.juger({...forte,role:'differe'},ouvert).regle,'role');assert.equal(Q.juger({...forte,role:'lot'},ouvert).regle,'role');
 /* Une zone mal écrite est signalée et reste fermée. */
 const mal=Q.reglages({format:'ariane-relecture-reglages-1',zones:{ecartement:{corriger:'true',seuilMm:8}}},'propose');
 assert.ok(mal.invalides.includes('zones.ecartement.corriger'));assert.equal(mal.zones.ecartement.corriger,false);
});

/* Revue de la relecture (D-175, correction 5) et D-180 : des réglages qui ne sont pas sûrs ne s'ouvrent jamais, même si le défaut du module
 * ouvre maintenant l'ADV et les abords (PN, ADV et abords corrigent, 45 mm de latéral au plus, D-174 pour la voie) ; tout champ de sécurité
 * invalide ou absent est listé dans `invalides`, une correction mal écrite reste fermée, et `correctionPermise` dit non (le service worker
 * ramène alors « corriger » à « ombre »). */
test('réglages non sûrs : défaut D-180, champs de sécurité invalides listés, coquille « "corriger":"false" » fermée, correction refusée hors fichier proposé valide',()=>{
 assert.deepEqual(Object.entries(Q.DEFAUT.zones).filter(([,z])=>z.corriger).map(([k])=>k),['pn','adv','abords'],'D-180 : PN, ADV et abords corrigent ; les verts hors zone restent en ombre');
 assert.equal(Q.DEFAUT.zones.adv.seuilMm,8);assert.equal(Q.DEFAUT.zones.abords.seuilMm,8);
 assert.equal(Q.DEFAUT.voie.lateralMaxMm,45,'D-174 : 45 mm de latéral au plus');
 const f=JSON.parse(fs.readFileSync(path.join(__dirname,'../datasets/relecture-reglages-proposes.json'),'utf8'));
 const ok=Q.reglages(f,'propose');assert.deepEqual(ok.invalides,[]);assert.deepEqual(Q.correctionPermise(ok),{ok:true,raison:null});
 const copie=m=>{const x=JSON.parse(JSON.stringify(f));m(x);return Q.reglages(x,'propose');};
 const coquille=copie(x=>{x.zones.pn.corriger='false';});
 assert.deepEqual(coquille.invalides,['zones.pn.corriger']);assert.equal(coquille.zones.pn.corriger,false,'une correction mal écrite reste fermée');
 assert.equal(Q.correctionPermise(coquille).ok,false);assert.match(Q.correctionPermise(coquille).raison,/zones\.pn\.corriger/);
 /* D-180 : l'ADV et les abords, que le défaut du module ouvre, restent fermés quand le fichier les écrit mal ou les oublie. */
 for(const z of ['adv','abords']){
  for(const v of ['true','false',1,0,null,'oui']){const r=copie(x=>{x.zones[z].corriger=v;});
   assert.equal(r.zones[z].corriger,false,`${z} « ${v} » : fermée`);assert.ok(r.invalides.includes(`zones.${z}.corriger`),`${z} « ${v} »`);assert.equal(Q.correctionPermise(r).ok,false);}
  const absente=copie(x=>{delete x.zones[z];});assert.equal(absente.zones[z].corriger,false,'une zone absente est fermée, pas ouverte par le défaut');
  assert.ok(absente.invalides.includes(`zones.${z}`));assert.equal(Q.correctionPermise(absente).ok,false);}
 for(const [m,champ] of [[x=>{x.zones.pn.seuilMm='8';},'zones.pn.seuilMm'],[x=>{x.zones.pn.seuilMm=0;},'zones.pn.seuilMm'],[x=>{delete x.zones.adv;},'zones.adv'],
  [x=>{x.voie.lateralMaxMm=60;},'voie.lateralMaxMm'],[x=>{delete x.voie;},'voie.lateralMaxMm'],[x=>{x.roles=['vert','differe'];},'roles'],[x=>{x.roles='vert';},'roles'],
  [x=>{x.jamais=['cut posé par le lot'];},'jamais'],[x=>{delete x.jamais;},'jamais']]){
  const r=copie(m);assert.ok(r.invalides.includes(champ),`${champ} : ${JSON.stringify(r.invalides)}`);assert.equal(Q.correctionPermise(r).ok,false,champ);}
 assert.equal(copie(x=>{x.voie.lateralMaxMm=60;}).voie.lateralMaxMm,45,'latéral invalide : celui du défaut');
 /* Fichier absent, format -2, défaut : jamais de correction. */
 const absent=Q.reglages(null),format=Q.reglages({...f,format:'ariane-relecture-reglages-2'},'propose'),defaut=Q.reglages(Q.DEFAUT,'defaut');
 assert.equal(absent.source,'defaut');assert.equal(format.refus,'format');assert.equal(format.source,'defaut');
 for(const [r,motif] of [[absent,/fichier proposé absent ou illisible/],[format,/format/],[defaut,/fichier proposé absent ou illisible/]]){
  const p=Q.correctionPermise(r);assert.equal(p.ok,false);assert.match(p.raison,motif);}
 assert.equal(Q.correctionPermise(Q.reglages(f,'defaut')).ok,false,'le contenu seul ne suffit pas : la source doit être le fichier proposé');
});

/* Revue (F4) : les écarts sont comparés aux seuils BRUTS ; l'arrondi au dixième ne sert qu'à l'affichage (7,95 mm ne passe pas 8 mm). */
test('valeurs brutes : 7,95 mm reste sous un seuil de 8 mm, même affiché « 8 » ; écartement brut contre la référence',()=>{
 const f=Q.reglages(JSON.parse(fs.readFileSync(path.join(__dirname,'../datasets/relecture-reglages-proposes.json'),'utf8')),'propose');
 const pn=x=>bon({zone:'pn',ecartementMm:1440,ecartementRefMm:1435,jugement:{...bon().jugement,etage:'window',appuis:[],confiance:{left:3,right:4},
  ecartMm:ec([8,0],[8,0]),ecartBrutMm:ec([7.95,0],[7.95,0])},...x});
 assert.equal(Q.juger(pn(),f).regle,'seuil','le brut du jugement est comparé, pas l’arrondi');
 assert.equal(Q.juger(pn({ecrit:ec([8,0],[8,0]),ecritBrut:ec([7.96,0],[7.9,0])}),f).regle,'seuil','le brut de la pose écrite est comparé');
 assert.equal(Q.juger(pn({ecrit:ec([8,0],[8,0]),ecritBrut:ec([8.01,0],[8.02,0])}),f).corriger,true);
 assert.equal(Q.juger(pn({ecritBrut:ec([8.01,0],[8.02,0]),ecartementMm:1450,ecartementBrutMm:1450.04}),f).regle,'coherence','15,04 mm de la médiane : au-delà de 15');
});

test('paquet : les deux fichiers de réglages sont dans la liste des fichiers requis de tools/package.py',()=>{
 const py=fs.readFileSync(path.join(__dirname,'../tools/package.py'),'utf8'),liste=py.slice(py.indexOf('required = ['),py.indexOf("manifest['background']"));
 for(const f of ['datasets/relecture-reglages-proposes.json','datasets/relecture-reglages-defaut.json'])assert.ok(liste.includes(`'${f}'`),f);
});

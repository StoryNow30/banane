'use strict';
/* D-157 — mode rapide : le clic du rail gauche partait hors de la fenêtre (pose directe depuis la vue du rail droit, NDC ≈ −7).
 * Réglage `pilote.rapide.clicHumain` :
 *  - 'tel-quel' (défaut) : le comportement de la base, à l'octet près (empreinte du code de base : tests/fixtures/rapide-humain-50-base.json) ;
 *  - 'gauche-recentre' : le rail droit posé en direct depuis la vue active, le rail gauche avec recentrage ;
 *  - 'tout-recentre' : le chemin des cuts de référence.
 * Dans les deux modes corrigés, aucun clic ne part hors de la partie visible du canevas (marge de 0,99 en NDC, et dans la fenêtre) ;
 * une cible hors de la vue prend le chemin de repli existant, sans clic hors vue.
 * Garde-fou, quel que soit le mode : un relevé `clic-hors-vue`, envoyé APRÈS la réponse, sans rien changer.
 * ESV simulé : tests/helpers/esv-clic.cjs (caméra qui suit à l'image suivante, clic posé avec la caméra active, entier inférieur de Chromium). */
const {test}=require('node:test'),assert=require('node:assert/strict');
const H=require('./helpers/esv-clic.cjs'),S=require('../src/settings.js');
const GOLDEN=require('./fixtures/rapide-humain-50-base.json');
const MODES_CORRIGES=['gauche-recentre','tout-recentre'];
const clics=r=>r.journal.filter(j=>j.quoi==='canevas');
const boutons=r=>r.journal.filter(j=>j.quoi==='bouton').map(j=>j.id==='O2N3DCutLRClick'?'gauche':'droit');
const sansHorsVue=({horsVue,vue,fenetre,...r})=>r;
const jouer=(nom,clicHumain,pilote={})=>H.jouer(nom,{pilote:{...pilote,rapide:{...(pilote.rapide||{}),...(clicHumain===undefined?{}:{clicHumain})}}});

test('réglage : rapide.clicHumain vaut « tel-quel » par défaut, les autres pièces du mode rapide sont inchangées',()=>{
 assert.equal(S.pilote.rapide.clicHumain,'tel-quel');
 const {clicHumain,...pieces}=S.pilote.rapide;assert.deepEqual(pieces,{lecture:true,selection:true,signal:true,pose:true});
});

test('tel-quel (défaut et explicite) : mêmes commandes à ESV que le code de base, octet pour octet, dans les neuf scénarios',async()=>{
 for(const reglage of [undefined,'tel-quel'])for(const nom of Object.keys(H.SCENARIOS)){
  const r=sansHorsVue(await jouer(nom,reglage));
  assert.equal(JSON.stringify(r),JSON.stringify(GOLDEN.scenarios[nom]),`${nom} (${reglage??'défaut'})`);
 }
});

test('tel-quel : réglage inconnu lu comme « tel-quel »',async()=>{
 const r=sansHorsVue(await jouer('rapide-vue-droite','autre-chose'));
 assert.equal(JSON.stringify(r),JSON.stringify(GOLDEN.scenarios['rapide-vue-droite']));
});

test('l\'empreinte prouve le défaut : en tel-quel, le clic gauche du cut rapide part à plus de 2 000 px à gauche de la fenêtre',()=>{
 const c=clics(GOLDEN.scenarios['rapide-vue-droite']);
 assert.deepEqual(c.map(x=>x.cote),['left','right']);assert.ok(c[0].clientX<-2000,`clientX ${c[0].clientX}`);
 assert.ok(H.clicVisible(c[1]),'le rail droit, lui, est cliqué dans la vue');
});

test('modes corrigés : aucun clic hors de la partie visible du canevas, dans les neuf scénarios ; poses à 1 mm quand le cut est posé',async()=>{
 for(const mode of MODES_CORRIGES)for(const nom of Object.keys(H.SCENARIOS)){
  const r=await jouer(nom,mode);
  for(const c of clics(r))assert.ok(H.clicVisible(c,r.vue,r.fenetre),`${mode} / ${nom} : clic (${c.clientX}, ${c.clientY}) hors de la partie visible`);
  if(!r.erreur)for(const s of ['left','right'])assert.ok(r.ecartCibleMm[s]<=1,`${mode} / ${nom} : ${s} à ${r.ecartCibleMm[s]} mm`);
  assert.equal(r.horsVue.length,0,`${mode} / ${nom} : aucun relevé hors vue`);
 }
});

test('gauche-recentre : le rail droit en direct depuis la vue active, puis le rail gauche avec recentrage (une seule attente)',async()=>{
 const r=await jouer('rapide-vue-droite','gauche-recentre');
 assert.equal(r.erreur,null);
 assert.deepEqual(boutons(r),['droit','gauche'],'droit d\'abord (vue active), puis la sélection du gauche');
 assert.deepEqual(clics(r).map(c=>c.cote),['right','left']);
 assert.equal(r.dureeMs,GOLDEN.scenarios.reference.dureeMs/2,'un recentrage au lieu de deux');
 assert.ok(!r.etapes.some(e=>e[0]==='apply-repli'),'le recentrage du gauche est voulu : pas un repli');
});

test('gauche-recentre : vue active sur le rail gauche au départ : le droit n\'est pas dans la vue, il est recentré aussi (repli), sans clic hors vue',async()=>{
 const r=await jouer('rapide-vue-gauche','gauche-recentre');
 assert.equal(r.erreur,null);assert.deepEqual(r.etapes.filter(e=>e[0]==='apply-repli').map(e=>e[1].side),['right']);
 assert.deepEqual(boutons(r),['droit','gauche'],'le bouton droit n\'est pressé qu\'une fois : refus AVANT de presser');
 assert.equal(r.dureeMs,GOLDEN.scenarios.reference.dureeMs);
});

test('tout-recentre : exactement le chemin des cuts de référence (même trace que la pièce « pose » coupée)',async()=>{
 for(const nom of Object.keys(H.SCENARIOS)){
  if(H.SCENARIOS[nom].mode!=='rapide')continue;
  const a=await jouer(nom,'tout-recentre'),b=await jouer(nom,undefined,{rapide:{pose:false}});
  assert.equal(JSON.stringify(a.journal),JSON.stringify(b.journal),nom+' : trace');
  assert.deepEqual(a.etapes,b.etapes,nom+' : étapes');assert.equal(a.erreur,b.erreur,nom);assert.equal(a.dureeMs,b.dureeMs,nom);
 }
 const r=await jouer('rapide-vue-droite','tout-recentre');assert.deepEqual(boutons(r),['gauche','droit']);assert.equal(r.dureeMs,GOLDEN.scenarios.reference.dureeMs);
});

test('cible entre 0,99 et 1 de sa propre vue : refus « hors de la vue » sans aucun clic pour ce rail (tel-quel : cliquée)',async()=>{
 for(const mode of MODES_CORRIGES){
  const d=await jouer('rapide-cible-droite-au-bord',mode);
  assert.match(d.erreur,/^Position proposée hors de la vue : right /,mode);assert.ok(!clics(d).some(c=>c.cote==='right'),mode+' : aucun clic sur le rail droit');
  const g=await jouer('reference-cible-gauche-au-bord',mode);
  assert.match(g.erreur,/^Position proposée hors de la vue : left /,mode);assert.equal(clics(g).length,0,mode+' : aucun clic');
 }
 assert.equal(GOLDEN.scenarios['reference-cible-gauche-au-bord'].erreur,null,'tel-quel : le clic au bord part, comme avant');
});

test('fenêtre plus étroite que le canevas : en mode corrigé, aucun clic dans la partie du canevas hors de la fenêtre',async()=>{
 for(const mode of MODES_CORRIGES){const r=await jouer('rapide-fenetre-etroite',mode);
  assert.match(r.erreur,/^Position proposée hors de la vue : right /,mode);
  for(const c of clics(r))assert.ok(c.clientX<1600,mode);}
});

test('garde-fou (tel-quel) : un relevé « clic-hors-vue » après la réponse, raison et chemin du clic, sans rien changer',async()=>{
 const r=await jouer('rapide-vue-droite');
 assert.equal(r.horsVue.length,1,'un relevé pour l\'application');const m=r.horsVue[0];
 assert.equal(m.channel,'fixture');assert.equal(typeof m.requestId,'string');
 const x=m.releve;assert.equal(x.action,'apply');assert.equal(x.mode,'tel-quel');assert.deepEqual(x.identity,{part:23,cut:r.cut});
 assert.equal(x.clics.length,1);const c=x.clics[0];
 assert.equal(c.cote,'left');assert.equal(c.chemin,'directe');assert.equal(c.raison,'hors-canevas');assert.equal(c.lecture,'rapide');
 assert.ok(c.client[0]<-2000);assert.ok(c.ndc[0]<-6);assert.equal(c.essai,1);
 assert.deepEqual(Object.keys(c).sort(),['chemin','client','cote','essai','lecture','ndc','raison']);
 const marge=(await jouer('reference-cible-gauche-au-bord')).horsVue[0].releve.clics;
 assert.deepEqual(marge.map(c=>[c.cote,c.chemin,c.raison]),[['left','recentre','marge']]);
 const fen=(await jouer('rapide-fenetre-etroite')).horsVue[0].releve.clics;
 assert.deepEqual(fen.map(c=>[c.cote,c.raison]),[['left','hors-canevas'],['right','hors-fenetre']]);
 const reprises=(await jouer('rapide-esv-decale-une-fois')).horsVue[0].releve.clics;
 assert.deepEqual(reprises.map(c=>c.essai),[1,2],'chaque clic compte, reprises décalées comprises');
 const rest=await jouer('rapide-puis-restauration');assert.deepEqual(rest.horsVue.map(m=>m.releve.action),['apply'],'restauration dans la vue : rien');
 assert.equal((await jouer('reference')).horsVue.length,0,'référence dans la vue : rien');
});

/* Capture lue sur la page d'essai habituelle (un nœud de nuage) : le mode du clic suit chaque cut dans l'export. */
function pageCapture(clicHumain){const {page}=require('./helpers/page.cjs'),F=require('./v242/fixtures.cjs');
 const rapide={...S.pilote.rapide,...(clicHumain?{clicHumain}:{})};
 const f=page({globals:{BananeSettings:{...S,pilote:{...S.pilote,rapide}}}}),pc=F.object([0,0,0],'PointCloudOctree'),n=F.object([0,0,0],'Points');
 n.geometry={attributes:{position:F.buffer([[0,.01,.01],[0,1.425,.01]])}};pc.material={clipBoxes:[],clipTask:0,clipMethod:0};pc.visibleNodes=[{sceneNode:n}];
 f.ctx.viewer.scene.pointclouds=[pc];f.ctx.Potree=F.enums;return f;}
test('capture : en mode corrigé, le mode du clic est consigné par cut (readStrategy.clicHumain) ; en tel-quel, la capture est celle d\'avant',async()=>{
 for(const mode of [undefined,'tel-quel']){const f=pageCapture(mode),out=await f.call('capture',await f.call('state'));
  assert.equal('clicHumain' in out.readStrategy,false,String(mode));assert.deepEqual([...out.readStrategy.pieces],['lecture','selection','signal','pose']);}
 for(const mode of MODES_CORRIGES){const f=pageCapture(mode),out=await f.call('capture',await f.call('state'));
  assert.equal(out.readStrategy.clicHumain,mode);assert.deepEqual([...out.readStrategy.pieces],['lecture','selection','signal','pose'],'les pièces restent des booléens');}
});

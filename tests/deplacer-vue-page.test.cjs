'use strict';
/* 5.0 — « DÉPLACER LA VUE » DANS L'ADAPTATEUR DE PAGE (src/adapter-page.js, `amenerDansLaVue`), joué en VM sur une page ESV
 * simulée (tests/helpers/vue-page.cjs). La vue n'écoute la molette et le glisser que si le MODÈLE DE NAVIGATION SUPPOSÉ est
 * greffé (tests/helpers/modele-navigation.js) ; sans lui, elle est sourde comme la maquette ESV. Ce qui est prouvé ici : la
 * logique de la pièce (au plus 3 gestes par rail, caméra relue et cible reprojetée après chaque geste, refus et différé
 * sinon, vue remise en place), et que SANS OPTION la page reçoit exactement la même suite qu'avec la version de base.
 * Rien ici ne dit qu'ESV réagit ainsi : fiches/DEPLACER_VUE.md. */
const {test}=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs'),os=require('node:os'),{spawnSync}=require('node:child_process');
const {page,cible}=require('./helpers/vue-page.cjs'),S=require('../src/settings.js');
const GOLDEN=require('./fixtures/apply-sans-vue-50-base.json');
const types=f=>f.evenements.map(e=>e.type);
const sansApproche=t=>t.filter(x=>!/move$/.test(x));
const echelle=f=>f.camera.projectionMatrix.elements[0];

test('le réglage existe et est ALLUMÉ par défaut dans la test 25 (D-268, geste clic-droit) ; le panneau le dit',()=>{
 const v=S.deplacerVue;assert.ok(v&&Object.isFrozen(v));assert.equal(v.actif,true);assert.deepEqual({...v.deplacement},{actif:true,geste:'clic-droit',tentativesMax:2});
 assert.equal(v.gestesMax,3);assert.equal(v.dezoomMax,1.5);assert.equal(v.glissementPxMax,250);assert.equal(v.pixelMaxMm,.9);
 const ligne=S.describe().find(l=>/Déplacer la vue/.test(l.nom));assert.ok(ligne);assert.match(ligne.valeur,/actif/i);
});

test('vue sourde (comme la maquette) : un geste, caméra immobile, refus « camera-immobile » ; aucun clic, aucun rail bougé, rien à remettre',async()=>{
 const f=page(),etat=await f.call('state'),avant=f.pos(f.left);
 const r=await f.call('amenerDansLaVue','left',cible(f,'left',230),etat.identity,{});
 assert.equal(r.ok,false);assert.equal(r.raison,'camera-immobile');assert.equal(r.gestes.length,1);assert.equal(r.gestes[0].type,'molette');
 assert.deepEqual(f.pos(f.left),avant);assert.ok(!types(f).includes('click'));
 assert.deepEqual(sansApproche(types(f)),['bouton','wheel','wheel'],'sélection du rail, deux crans, rien d\'autre');
 assert.equal(r.remise.ok,true);assert.equal(r.remise.crans,0,'aucun cran n\'a agi : rien à rendre');
});

test('molette : la cible à 230 mm (NDC 1,15) entre dans la vue en un geste de 2 crans ; la caméra est relue, la cible reprojetée ; vue remise',async()=>{
 const f=page({navigation:{facteurCran:1.1}}),etat=await f.call('state'),e0=echelle(f);
 const r=await f.call('amenerDansLaVue','left',cible(f,'left',230),etat.identity,{});
 assert.equal(r.ok,true,JSON.stringify(r));assert.equal(r.gestes.length,1);const g=r.gestes[0];
 assert.equal(g.type,'molette');assert.equal(g.crans,2);assert.ok(Math.abs(g.facteurCran-1.1)<1e-9);
 assert.ok(Math.abs(r.ndcAvant[0]-1.15)<1e-6);assert.ok(Math.abs(g.ndcApres[0]-1.15/1.21)<1e-3);assert.ok(r.pixelMm.apres<.9);
 /* Remise : deux crans dans l'autre sens, l'échelle d'origine retrouvée. */
 assert.equal(r.remise.ok,true);assert.equal(r.remise.crans,2);assert.ok(Math.abs(echelle(f)/e0-1)<1e-9);
 const w=f.evenements.filter(e=>e.type==='wheel');assert.deepEqual(w.map(e=>e.deltaY),[100,100,-100,-100]);
 assert.deepEqual(w.map(e=>e.wheelDeltaY),[-120,-120,120,120]);assert.ok(!types(f).some(t=>/down|up|click/.test(t)),'ni bouton ni clic dans la vue');
 assert.equal(f.progress.filter(p=>p.stage==='vue-geste').length,1,'un événement consigné par geste');
});

test('molette écoutée en « mousewheel » seulement : un wheel synthétique n\'y arrive pas → refus (le cut reste différé)',async()=>{
 const f=page({navigation:{molette:'mousewheel'}}),etat=await f.call('state');
 const r=await f.call('amenerDansLaVue','left',cible(f,'left',230),etat.identity,{});assert.equal(r.ok,false);assert.equal(r.raison,'camera-immobile');
});

test('glisser : dézoom interdit (×1,05), la cible est amenée par un glisser au bouton gauche, sans clic final ; la vue est recentrée ensuite',async()=>{
 const f=page({navigation:{}}),etat=await f.call('state');
 const r=await f.call('amenerDansLaVue','left',cible(f,'left',230),etat.identity,{dezoomMax:1.05});
 assert.equal(r.ok,true,JSON.stringify(r));assert.equal(r.gestes[0].type,'glisser');
 const g=r.gestes[0];assert.ok(g.px<0&&Math.abs(g.px)>=64&&Math.abs(g.px)<=250,'vers la gauche, dans la limite : '+g.px);
 assert.ok(Math.abs(g.ndcApres[0])<=.99);assert.ok(Math.abs(g.gain-1)<.02,'gain mesuré : '+g.gain);
 const t=sansApproche(types(f));assert.deepEqual(t.slice(0,3),['bouton','pointerdown','mousedown']);
 assert.ok(t.includes('pointerup')&&t.includes('mouseup')&&!t.includes('click'),'glisser complet, sans clic');
 const down=f.evenements.find(e=>e.type==='mousedown');assert.equal(down.button,0);assert.equal(down.buttons,1);
 /* Le glisser part loin du rail sélectionné (au centre de la vue). */
 assert.ok(Math.hypot(down.clientX-400,down.clientY-300)>=150);
 assert.equal(r.remise.ok,true);assert.equal(r.remise.recentre,true);assert.equal(t.at(-1),'bouton','vue recentrée par le bouton du rail');
});

test('au plus 3 gestes par rail : une molette presque sans effet épuise les gestes, la vue est remise, refus « gestes-epuises »',async()=>{
 const f=page({navigation:{facteurCran:1.01}}),etat=await f.call('state'),e0=echelle(f);
 const r=await f.call('amenerDansLaVue','left',cible(f,'left',230),etat.identity,{molette:{cransMax:3}});
 assert.equal(r.ok,false);assert.equal(r.raison,'gestes-epuises');assert.equal(r.gestes.length,3);
 assert.equal(r.remise.ok,true);assert.ok(Math.abs(echelle(f)/e0-1)<1e-9);
});

test('hors limites (cible à 600 mm : ×3 ou 804 px) : aucun geste, refus « hors-limites »',async()=>{
 const f=page({navigation:{}}),etat=await f.call('state');
 const r=await f.call('amenerDansLaVue','left',cible(f,'left',600),etat.identity,{});
 assert.equal(r.ok,false);assert.equal(r.raison,'hors-limites');assert.equal(r.gestes.length,0);assert.deepEqual(sansApproche(types(f)),['bouton']);
});

test('pixel au-delà de 0,9 mm : pas de dézoom qui le dépasserait (le glisser est pris s\'il tient dans sa limite)',async()=>{
 const f=page({navigation:{}}),etat=await f.call('state');
 const r=await f.call('amenerDansLaVue','left',cible(f,'left',380),etat.identity,{dezoomMax:2.5,glissementPxMax:500});
 assert.equal(r.ok,true,JSON.stringify(r));assert.ok(r.gestes.every(g=>g.type==='glisser'),'0,5 mm × 1,92 = 0,96 mm : le dézoom est écarté');
});

test('cible déjà dans la vue : aucun geste',async()=>{
 const f=page({navigation:{}}),etat=await f.call('state');
 const r=await f.call('amenerDansLaVue','left',cible(f,'left',150),etat.identity,{});
 assert.equal(r.ok,true);assert.equal(r.raison,'dans-la-vue');assert.equal(r.gestes.length,0);assert.deepEqual(sansApproche(types(f)),['bouton']);
});

for(const persiste of [true,false])test(`apply avec déplacement de vue (zoom ${persiste?'gardé':'remis'} au recentrage) : deux rails à 210 mm posés à 1 mm, vue remise à la fin`,async()=>{
 const f=page({navigation:{persisteSelect:persiste}}),before=await f.call('state'),e0=echelle(f);
 const proposals={left:{delta:[0,.21,0]},right:{delta:[0,.21,0]}};
 const r=await f.call('apply',before,proposals,{deplacerVue:{cotes:{left:{geste:'dezoom'},right:{geste:'dezoom'}}}});
 for(const s of ['left','right']){const b=before.rails[s].positionSceneRelative,a=r.rails[s].positionSceneRelative;assert.ok(Math.abs(a[1]-b[1]-.21)<=.001,s+' : '+(a[1]-b[1]));}
 assert.ok(r.deplacerVue&&r.deplacerVue.remise.ok,JSON.stringify(r.deplacerVue));assert.ok(Math.abs(echelle(f)/e0-1)<1e-9,'échelle d\'origine');
 assert.equal(types(f).filter(t=>t==='click').length,2,'un clic de pose par rail');
 const crans=r.deplacerVue.cotes.flatMap(c=>c.gestes).reduce((a,g)=>a+g.crans,0);assert.equal(crans,persiste?1:2,'zoom gardé : un cran sert aux deux rails');
});

test('apply avec déplacement de vue, vue sourde : erreur AVANT tout clic, rien n\'est posé',async()=>{
 const f=page(),before=await f.call('state');
 await assert.rejects(f.call('apply',before,{left:{delta:[0,.21,0]},right:{delta:[0,.21,0]}},{deplacerVue:{}}),/Vue ESV non amenée.*rail gauche.*rien n.a été posé/i);
 assert.ok(!types(f).includes('click'));assert.deepEqual(f.pos(f.left),before.rails.left.positionSceneRelative);
});

/* CH-007 : la molette sourde est déjà l'essai « mousewheel seulement » (refus camera-immobile). Ici, la proposition
 * (chantiers/CH-007/propositions/deplacement-vue.patch, non appliquée à src/) : après cette molette, le glisser. */
test('proposition : molette ignorée (mousewheel seul), puis glisser, la cible entre dans la vue',async()=>{
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'ch007-'));
 fs.mkdirSync(path.join(tmp,'src'),{recursive:true});
 fs.copyFileSync(path.join(__dirname,'..','src/adapter-page.js'),path.join(tmp,'src/adapter-page.js'));
 const patch=path.join(__dirname,'..','chantiers/CH-007/propositions/deplacement-vue.patch');
 /* Test 25 : l'adaptateur porte maintenant le patch de CH-018 (geste réglable) ; la proposition de CH-007 a été écrite contre l'adaptateur d'avant : on retire d'abord celui de CH-018. */
 const retour=spawnSync('patch',['-R','-p1','-d',tmp,'-i',path.join(__dirname,'..','chantiers/CH-018/adapter-deplacement.patch')],{encoding:'utf8'});
 assert.equal(retour.status,0,retour.stderr||retour.stdout);
 const r=spawnSync('patch',['-p1','-d',tmp,'-i',patch],{encoding:'utf8'});
 assert.equal(r.status,0,r.stderr||r.stdout);
 const f=page({navigation:{molette:'mousewheel'},adaptateur:path.join(tmp,'src/adapter-page.js')}),etat=await f.call('state');
 const out=await f.call('amenerDansLaVue','left',cible(f,'left',230),etat.identity,{});
 assert.equal(out.ok,true,JSON.stringify(out));
 assert.equal(out.gestes[0].type,'molette');assert.equal(out.gestes[0].camera,'immobile');
 assert.equal(out.gestes[1].type,'glisser');
 assert.ok(Math.abs(out.gestes[1].ndcApres[0])<=.99);
 assert.equal(out.remise.ok,true);assert.equal(out.remise.recentre,true);assert.equal(out.remise.crans,0);
});

test('SANS OPTION, apply et restore envoient exactement la même suite qu\'en 50-base, même avec le réglage actif dans la page',async()=>{
 for(const settings of [null,{deplacerVue:{...S.deplacerVue,actif:true}}]){
  const f=page({navigation:{},settings}),before=await f.call('state');
  const r=await f.call('apply',before,GOLDEN.proposals);await f.call('restore',before);
  assert.deepEqual(f.evenements,GOLDEN.evenements,'mêmes événements, même ordre, mêmes champs');
  assert.deepEqual(f.progress.map(p=>p.stage),GOLDEN.etapes,'mêmes étapes');
  assert.equal(r.deplacerVue,undefined,'aucun rapport sans option');
 }
});

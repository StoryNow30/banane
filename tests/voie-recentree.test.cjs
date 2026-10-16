'use strict';
/* 5.0 (audit 5.0, I8) — MODULE COMMUN « RECENTRER SUR LA VOIE » (src/voie-recentree.js).
 *
 * La règle prudente de la voie prédite (D-147) et la mémoire des différés G1 (b) (D-148) sont la même mécanique : le moteur
 * relancé sur des rails translatés sur une voie prédite, puis le minimum unique à 15 mm. Le module rend la décision qu'aurait
 * prise le moteur recentré, la confiance, l'écart à la voie, la profondeur de chaîne et le geste de vue qu'il AURAIT fallu.
 * Il ne commande rien. Données synthétiques : la fixture de tools/rejeu-voie-predite.cjs (voie droite fabriquée) et celle
 * de tests/fixtures.cjs. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const V=require('../src/voie-recentree.js'),L=require('../src/lot-decision.js'),K=require('../src/core.js'),Shadow=require('../src/gcv1-shadow.js');
const R=require('../tools/rejeu-voie-predite.cjs');
const SIDES=['left','right'];

/* Fixture : cuts 1 à 3 posés seuls (appuis), cuts 4 à 7 avec toute la voie décalée de 230 mm (hors de la fenêtre du
 * moteur et de la vue d'ESV). La vérité est connue : 230 mm du côté opposé au décalage. */
const fx=R.fixtureSynthetique();
const cap=c=>fx.captures.get(c);
const entree=c=>({identity:K.completeIdentity(cap(c).identity),rails:cap(c).rails,pointsSceneRelative:cap(c).pointsSceneRelative,visibleByClipBoxes:cap(c).visibleByClipBoxes});
const sciences=new Map();const science=c=>{if(!sciences.has(c))sciences.set(c,Shadow.scientificProposeBoth(cap(c)));return sciences.get(c);};
const runtime=c=>Shadow.toRuntimeRails(science(c));
/* Appuis réels : les cuts 1 à 3 posés par le moteur seul. */
const posee=c=>{const e=K.expectedPoses({rails:cap(c).rails},runtime(c));return {identity:{part:1,cut:c,frameId:'f-synth'},positions:Object.fromEntries(SIDES.map(s=>[s,e[s].positionSceneRelative])),stage:'first-pass'};};
const appuisReels=[1,2,3].map(posee);

test('constantes : la règle prudente est celle de D-147, la mémoire de série celle de D-148, le jugement commun 5 / 10 / 50 mm',()=>{
 assert.equal(V.VERSION,'voie-recentree-v1');
 assert.deepEqual({...V.REGLE_PRUDENTE,etages:[...V.REGLE_PRUDENTE.etages]},{etages:['window'],confianceMin:55,ecartementVoisinMm:10,profondeurMax:10,fenetreMm:30,dezoomMax:1.5,glissementPxMax:250});
 assert.equal(V.MEMOIRE_SERIE.K,3);assert.equal(V.MEMOIRE_SERIE.porteDispersionMm,10);assert.equal(V.MEMOIRE_SERIE.mmParCut,3);assert.equal(V.MEMOIRE_SERIE.ecartSerieMax,10);
 assert.deepEqual({...V.POOL},{tolMm:15,minHaut:5,minFlanc:3,separationMm:20});
 assert.deepEqual({...V.JUGEMENT},{justeMm:5,fauxMm:10,mauvaiseVoieMm:50});
 for(const o of [V.REGLE_PRUDENTE,V.MEMOIRE_SERIE,V.POOL,V.JUGEMENT])assert.ok(Object.isFrozen(o));
});

test('vue nécessaire et geste : dans la vue, dézoom, glissement, hors limites, caméra inconnue',()=>{
 const c=cap(4),depart=Object.fromEntries(SIDES.map(s=>[s,c.rails[s].positionSceneRelative]));
 const dans=V.vueNecessaire(c,depart);assert.equal(dans.dans,true);assert.equal(V.geste(dans).geste,'dans-la-vue');
 const a=mm=>Object.fromEntries(SIDES.map(s=>[s,R.positionMic(c.rails[s],[0,mm,0])]));
 const g1=V.geste(V.vueNecessaire(c,a(-230)));assert.equal(g1.geste,'dezoom');assert.ok(g1.dezoom>1.1&&g1.dezoom<1.25,'dézoom '+g1.dezoom);assert.ok(g1.glissementPx>0);
 /* Au-delà du dézoom permis mais dans 250 px : glissement. (Vue de 1 042 px : avec ×1,5, le dézoom suffit toujours avant
  * 250 px ; un seuil de dézoom plus bas fait apparaître le glissement.) */
 const g2=V.geste(V.vueNecessaire(c,a(-280)),{dezoomMax:1.2,glissementPxMax:250});assert.equal(g2.geste,'glissement');assert.ok(g2.dezoom>1.2&&g2.glissementPx<=250);
 const g3=V.geste(V.vueNecessaire(c,a(-900)));assert.equal(g3.geste,'hors-limites');
 const sans={...c,camera:null,viewCaptures:[]};assert.equal(V.geste(V.vueNecessaire(sans,a(-230))).geste,'inconnu');
 /* Les seuils viennent de l'appelant (réglages). */
 assert.equal(V.geste(V.vueNecessaire(c,a(-230)),{dezoomMax:1.05,glissementPxMax:10}).geste,'hors-limites');
 /* Le rejeu emploie exactement ces fonctions (mêmes chiffres que l'extension). */
 assert.equal(R.vueNecessaire,V.vueNecessaire);assert.equal(R.camerasLarges,V.camerasLarges);
});

test('règle : la règle du rejeu, plus la condition de vue de D-147 (dézoom ≤ ×1,5 ou glissement ≤ 250 px)',()=>{
 assert.equal(R.regleAccepte,V.regle,'le rejeu juge avec la règle du module');
 const r=(o={})=>({stage:'window',fromPredictionMm:4,anchorsUsed:[10,11],validatedAnchors:null,profondeur:2,moteur:{left:{confiance:70},right:{confiance:65}},
  ecartVoisinMm:3,deplacementMm:{left:[-150,2],right:[-148,3]},vue:{dans:false,inconnu:false,dezoom:1.2,panPx:80},...o});
 const g=V.enRegle(V.REGLE_PRUDENTE);
 assert.equal(V.regle(g,r()),null);
 assert.equal(V.regle(g,r({stage:'choice'})),'etage');
 assert.equal(V.regle(g,r({moteur:{left:{confiance:54},right:{confiance:90}}})),'confiance');
 assert.equal(V.regle(g,r({moteur:{left:{s1:true,confiance:0},right:{confiance:90}}})),null,'un rail retenu par S1 n\'est pas jugé sur la confiance');
 assert.equal(V.regle(g,r({ecartVoisinMm:10.5})),'ecartement-voisin');
 assert.equal(V.regle(g,r({profondeur:11})),'profondeur');
 assert.equal(V.regle(g,r({fromPredictionMm:31})),'fenetre');
 assert.equal(V.regle(g,r({vue:{dans:false,inconnu:false,dezoom:1.6,panPx:240}})),null,'glissement dans la limite');
 assert.equal(V.regle(g,r({vue:{dans:false,inconnu:false,dezoom:1.6,panPx:260}})),'vue');
 assert.equal(V.regle(g,r({vue:{dans:false,inconnu:true,dezoom:1,panPx:0}})),'vue-inconnue');
 /* Sans seuil de vue (variantes du rejeu), la vue n'est pas jugée. */
 assert.equal(V.regle({etages:['window']},r({vue:null})),null);
 /* Verdict : un cut sans pose n'est jamais posable, et dit pourquoi. */
 assert.deepEqual(V.verdictPrudent({posee:false,stage:'deferred',reason:'no-anchor'}),{posable:false,raison:'differe:no-anchor'});
 assert.deepEqual(V.verdictPrudent({...r(),posee:true}),{posable:true,raison:null});
});

test('jugement commun : juste à 5 mm, juste à 10 mm, fausse, mauvaise voie (> 50 mm) ; écart = pire des deux rails, en 3D',()=>{
 assert.equal(V.juger(4.9),'juste5');assert.equal(V.juger(5),'juste5');assert.equal(V.juger(5.1),'juste10');assert.equal(V.juger(10),'juste10');
 assert.equal(V.juger(10.1),'fausse');assert.equal(V.juger(50),'fausse');assert.equal(V.juger(50.1),'mauvaise-voie');assert.equal(V.juger(null),'non-jugee');
 assert.equal(V.juger(60,{...V.JUGEMENT,mauvaiseVoieMm:100}),'fausse','seuil réglable (le rejeu de la voie prédite garde 100 mm)');
 const mic={left:[1,-150,3],right:[0,-149,2]};
 assert.ok(Math.abs(V.ecartPose({left:[0,-150,0],right:[0,-149,2]},mic)-Math.hypot(1,0,3))<1e-9,'pose à trois composantes');
 assert.ok(Math.abs(V.ecartPose({left:[-150,0],right:[-145,2]},mic)-Math.hypot(0,4,0))<1e-9,'pose à deux composantes : le longitudinal de l\'opérateur compte');
 assert.equal(V.ecartPose(null,mic),null);
});

test('recalage dans un pool (forme hors ligne, G1) : un seul minimum qualifié près de la voie, sinon abstention',()=>{
 const c=(fla,fve,o={})=>({fla,fve,perte:o.perte??1,haut:o.haut??20,flanc:o.flanc??8,pente:o.pente??0});
 const voie={gauche:[-150,0],droite:[-150,0]};
 const ok=V.choisirDansLePool({gauche:[c(-148,1),c(-80,0)],droite:[c(-151,0,{perte:.5}),c(-149,0,{perte:2})]},voie,()=>true);
 assert.deepEqual(ok.pose,{gauche:[-148,1],droite:[-151,0]},'deux candidats à moins de 20 mm : une seule grappe, le moins cher');
 assert.equal(V.choisirDansLePool({gauche:[c(-140,0),c(-162,0)],droite:[c(-150,0)]},voie,()=>true).raison,'plusieurs minima près de la voie');
 assert.equal(V.choisirDansLePool({gauche:[c(-120,0)],droite:[c(-150,0)]},voie,()=>true).raison,'aucun minimum près de la voie');
 assert.equal(V.choisirDansLePool({gauche:[c(-150,0,{haut:4})],droite:[c(-150,0)]},voie,()=>true).raison,'aucun minimum près de la voie','5 points de dessus au moins');
 assert.equal(V.choisirDansLePool({gauche:[c(-150,0,{pente:1})],droite:[c(-150,0)]},voie,()=>true).raison,'aucun minimum près de la voie','pente non limitée');
 assert.equal(V.choisirDansLePool({gauche:[c(-150,0)],droite:[c(-150,0)]},voie,()=>false).raison,'écartement hors contrat');
});

test('recentrer sur le vrai nuage : depuis les appuis du lot, le moteur retrouve les deux rails à 230 mm, hors de la vue',{timeout:60000},()=>{
 const c=4,ent=entree(c);
 const r=V.recentrer({capture:{...ent,camera:cap(c).camera,viewCaptures:cap(c).viewCaptures},science:science(c),anchors:appuisReels,Shadow,
  runtimeRails:runtime(c),before:cap(c).rails,expectedPoses:K.expectedPoses,profondeurAppui:()=>0});
 assert.equal(r.stage,'window');assert.equal(r.posee,true);assert.equal(r.commande.action,'lot','vue déplacée : la commande passe');
 assert.deepEqual(r.anchorsUsed,[3,2]);assert.equal(r.profondeur,1);
 assert.ok(SIDES.every(s=>Number.isFinite(r.moteur[s].confiance)),'confiance du moteur relancé, par rail');
 const p=V.poseMm(cap(c),r.positions);
 for(const s of SIDES)assert.ok(Math.abs(p[s][1]+230)<5,`${s} : ${p[s][1]} mm (vérité −230)`);
 assert.equal(r.vue.dans,false);assert.equal(V.geste(r.vue).geste,'dezoom');
 /* La même voie donnée par un décalage : même pose à 1 mm. */
 const d=V.recentrer({capture:{...ent},science:science(c),anchors:V.appuisDepuisDecalage(ent,{left:[-230,0],right:[-230,0]}),Shadow});
 assert.ok(['window','choice'].includes(d.stage),d.stage);const q=V.poseMm(cap(c),d.positions);
 for(const s of SIDES)assert.ok(Math.abs(q[s][1]-p[s][1])<1&&Math.abs(q[s][2]-p[s][2])<1,`${s} : décalage ${q[s]} contre appuis ${p[s]}`);
 /* La décision du module est celle de la décision sur le lot, à l'octet près. */
 const lot=L.decideCut({capture:ent,science:science(c),anchors:appuisReels,Shadow});
 assert.equal(JSON.stringify(r.decision),JSON.stringify(lot));
});

test('ombre d\'Orbite : un événement par différé, la chaîne de l\'ombre ne vit que dans sa mémoire ; rien de ce qui est lu ne change',{timeout:60000},()=>{
 const mem=V.creerMemoire('lot-synth'),evts=[];
 for(const c of [1,2,3])V.noterDecisionReelle(mem,entree(c).identity,{stage:'first-pass',anchorsUsed:[]});
 for(const c of [4,5,6,7]){
  const ent=entree(c),capture={...ent,camera:cap(c).camera,viewCaptures:cap(c).viewCaptures};
  /* Décision réelle du lot (appuis réels seulement) : reprise refusée par la vue (4 à 6), puis plus d'appui (7). */
  const reelle=L.decideCut({capture:ent,science:science(c),anchors:appuisReels,Shadow});
  const avant=JSON.stringify({capture,sci:science(c),appuisReels,reelle,run:runtime(c)});
  const {evenement}=V.evaluerDiffere({mem,capture,science:science(c),ancresReelles:appuisReels,decisionReelle:reelle,commandeReelle:{action:'engine',reason:'hors-vue-left'},
   Shadow,runtimeRails:runtime(c),before:cap(c).rails,expectedPoses:K.expectedPoses});
  assert.equal(JSON.stringify({capture,sci:science(c),appuisReels,reelle,run:runtime(c)}),avant,'rien de ce qui est lu n\'est modifié');
  evts.push(evenement);
 }
 assert.deepEqual(evts.map(e=>e.reel.stage),['window','window','window','deferred']);
 assert.deepEqual(evts.map(e=>e.etage),['window','window','window','window'],'en série : le cut 7 a pour appuis les poses de l\'ombre');
 assert.deepEqual(evts.map(e=>e.verdict.posable),[true,true,true,true],JSON.stringify(evts.map(e=>e.verdict)));
 assert.deepEqual(evts.map(e=>e.profondeur),[1,2,3,4]);
 assert.deepEqual(evts.map(e=>e.appuisOmbre),[[],[4],[5,4],[6,5]]);
 assert.deepEqual(evts.map(e=>e.recalcule),[true,true,true,true]);
 for(const e of evts){
  assert.equal(e.vue.geste,'dezoom');assert.ok(SIDES.every(s=>Math.abs(e.poseMm[s][1]+230)<5));assert.ok(Number.isFinite(e.confiance.left)&&e.confiance.left>=55);
  assert.ok(Number.isFinite(e.ecartVoieMm)&&e.ecartVoieMm<=15);
  /* Aucune position de scène : seulement des décalages (mm), des numéros de cut, des comptes. */
  assert.deepEqual(Object.keys(e).sort(),['appuis','appuisOmbre','confiance','ecartVoieMm','ecartementVoisinMm','etage','identity','poseMm','profondeur','raison','recalcule','reel','verdict','version','vue']);
  assert.ok(!/positionSceneRelative|"positions"/.test(JSON.stringify(e)));
 }
 /* La mémoire de l'ombre est la seule chose modifiée : les appuis réels n'ont pas bougé. */
 assert.deepEqual(appuisReels.map(a=>a.identity.cut),[1,2,3]);assert.deepEqual(mem.poses.map(p=>p.identity.cut),[4,5,6,7]);
 /* Un cut différé sans appui ni pose d'ombre proche : pas de relance du moteur, verdict dit pourquoi. */
 const mem2=V.creerMemoire('autre');let appels=0;const espion={...Shadow,scientificProposeBoth:x=>{appels++;return Shadow.scientificProposeBoth(x);}};
 const seul=V.evaluerDiffere({mem:mem2,capture:{...entree(7),camera:cap(7).camera,viewCaptures:cap(7).viewCaptures},science:science(7),ancresReelles:[],
  decisionReelle:{stage:'deferred',reason:'no-anchor',anchorsUsed:[]},Shadow:espion,runtimeRails:runtime(7),before:cap(7).rails,expectedPoses:K.expectedPoses}).evenement;
 assert.equal(appels,0);assert.equal(seul.recalcule,false);assert.deepEqual(seul.verdict,{posable:false,raison:'differe:no-anchor'});assert.equal(seul.poseMm,null);
});

test('mémoire de série (Écho) : corrections validées de la MÊME série, les trois plus proches, dispersion ≤ 10 mm',()=>{
 const id=cut=>({part:7,cut,frameId:'f'}),val=(cut,visitIndex)=>({identity:id(cut),visitIndex,positions:{left:[cut,0,0],right:[cut,1.43,0]}});
 const differes=[100,101,102,103,104,120,121];
 assert.equal(V.memoireSerie({identity:id(110),differes,validees:[]}).etat,'hors-serie');
 assert.equal(V.memoireSerie({identity:id(103),differes,validees:[]}).etat,'sans-memoire');
 const m=V.memoireSerie({identity:id(103),differes,validees:[val(100,1),val(101,2),val(102,3),val(120,4),val(99,5),{...val(102,6),identity:{...id(102),frameId:'autre'}}]});
 assert.equal(m.etat,'ok');assert.deepEqual(m.memoire.cuts,[102,101,100]);assert.equal(m.memoire.dispersionMm,9);assert.deepEqual(m.appuis.map(a=>a.identity.cut),[102,101]);
 assert.deepEqual(m.serie,{id:100,rang:3,longueur:5});
 /* La dernière validation d'un cut l'emporte. */
 assert.equal(V.memoireSerie({identity:id(103),differes,validees:[val(102,1),{...val(102,8),positions:{left:[9,9,9],right:[9,9,9]}}]}).appuis[0].positions.left[0],9);
 /* Mémoire trop loin : série instable, aucun appui. */
 const loin=V.memoireSerie({identity:id(104),differes,validees:[val(100,1)]});assert.equal(loin.etat,'serie-instable');assert.equal(loin.memoire.dispersionMm,12);assert.deepEqual(loin.appuis,[]);
 /* Séries : trou de 10 cuts au plus (comme G1). */
 assert.deepEqual([...V.series([1,5,15,26,30]).entries()].map(([c,s])=>[c,s.id,s.rang]),[[1,1,0],[5,1,1],[15,1,2],[26,26,0],[30,26,1]]);
});

test('ombre de l\'Écho : moteur recentré sur la voie des corrections de l\'opérateur ; l\'entrée ne porte pas la référence humaine',{timeout:60000},()=>{
 /* Cut 6 : l'opérateur a corrigé 4 et 5 (vérité). */
 const vrai=c=>{const capC=cap(c);return Object.fromEntries(SIDES.map(s=>[s,R.positionMic(capC.rails[s],[0,-230,0])]));};
 const validees=[4,5].map((c,i)=>({identity:{part:1,cut:c,frameId:'f-synth'},visitIndex:i+1,positions:vrai(c)}));
 const ent={identity:entree(6).identity,rails:cap(6).rails,points:cap(6).pointsSceneRelative,visible:cap(6).visibleByClipBoxes};
 const {evenement:e}=V.evaluerEcho({entree:ent,differes:[4,5,6,7],validees,Shadow});
 assert.equal(e.version,'memoire-differes-ombre-v1');assert.equal(e.frontiere,'avant-reference');assert.equal(e.etat,'calcule');
 assert.ok(['window','choice'].includes(e.etage),e.etage);assert.equal(e.verdict.posable,true);assert.deepEqual(e.appuis,[5,4]);assert.deepEqual(e.memoire.cuts,[5,4]);
 for(const s of SIDES)assert.ok(Math.abs(e.poseMm[s][1]+230)<5,`${s} : ${e.poseMm[s]}`);
 assert.ok(!/positionSceneRelative|"positions"/.test(JSON.stringify(e)));
 /* Sans mémoire : rien n'est calculé (le moteur n'est pas appelé). */
 let appels=0;const espion={...Shadow,scientificProposeBoth:x=>{appels++;return Shadow.scientificProposeBoth(x);}};
 const vide=V.evaluerEcho({entree:ent,differes:[4,5,6,7],validees:[],Shadow:espion}).evenement;
 assert.equal(appels,0);assert.equal(vide.etat,'sans-memoire');assert.deepEqual(vide.verdict,{posable:false,raison:'sans-memoire'});
});

test('réglages de l\'extension = réglages figés (datasets/reglages-figes.json) = constantes du module',()=>{
 const S=require('../src/settings.js'),F=require('../datasets/reglages-figes.json').reglages;
 const v=F.voiePredite.valeurs,o=S.voiePrediteOmbre;
 assert.deepEqual([[...o.etages],o.confianceMin,o.profondeurMax,o.ecartementVoisinMm,o.fenetreMm],[v.etages,v.confMin,v.chaineMax,v.ecartVoisinMm,v.fenetreMm]);
 assert.deepEqual([o.dezoomMax,o.glissementPxMax],[F.voiePredite.ombre.vue.dezoomMax,F.voiePredite.ombre.vue.glissementPxMax]);
 for(const k of ['confianceMin','profondeurMax','ecartementVoisinMm','fenetreMm','dezoomMax','glissementPxMax'])assert.equal(o[k],V.REGLE_PRUDENTE[k],k);
 const m=S.memoireDifferesOmbre,g=F.memoireSerieB;
 assert.ok(g.valeurs.porteDispersionMm.includes(m.porteDispersionMm));assert.equal(m.K,g.valeurs.derniersCuts);
 assert.deepEqual([m.porteDispersionMm,m.mmParCut,m.ecartSerieMax,[...m.etages]],[g.ombre.porteDispersionMm,g.ombre.mmParCut,g.ombre.ecartSerieMax,g.ombre.etages]);
 for(const k of ['K','appuis','mmParCut','porteDispersionMm','ecartSerieMax'])assert.equal(m[k],V.MEMOIRE_SERIE[k],k);
});

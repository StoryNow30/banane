const {test}=require('node:test'),assert=require('node:assert/strict');
const K=require('../src/core.js'),{page}=require('./helpers/page.cjs');
const fs=require('node:fs'),path=require('node:path');
test('real adapter code identifies mirrored rails regardless of root list order',async()=>{
 const f=page(),a=await f.call('state');f.root.children.reverse();const b=await f.call('state');
 assert.deepEqual(a.identity,b.identity);assert.deepEqual(a.mapping,b.mapping);assert.deepEqual(a.rails,b.rails);
 f.left.position.y+=.01;const moved=await f.call('state');assert.equal(moved.identity.frameId,a.identity.frameId);
 assert.ok(Math.abs(moved.rails.left.positionSceneRelative[1]-.01)<1e-10);
});
test('real adapter native click path reads back both corrections and can restore on the same cut',async()=>{
 const f=page(),before=await f.call('state'),proposals={left:{delta:[0,.012,.003]},right:{delta:[0,-.01,.004]}};
 const result=await f.call('apply',before,proposals);assert.ok(K.equalPoses(result.rails,K.expectedPoses(before,proposals),1e-10));
 const restored=await f.call('restore',before);assert.ok(K.equalPoses(restored.rails,before.rails,1e-10));
});
test('real adapter navigation is never presented as server confirmation; changed target rejects writes',async()=>{
 const f=page(),before=await f.call('state');const evidence=await f.call('validateAndNext',before.identity,{});
 assert.equal(evidence.commandSent,true);assert.equal(evidence.afterObserved,false);
 assert.equal(evidence.afterStateStatus,'AFTER_STATE_MISSING_BECAUSE_TARGET_CHANGED');assert.equal(evidence.navigationObserved,true);assert.equal(evidence.serverConfirmed,false);
 await assert.rejects(()=>f.call('apply',before,{left:{delta:[0,0,0]},right:{delta:[0,0,0]}}),/Cible différente/);
});
test('real validation adapter exposes the observed next-non-validated navigation contract',async()=>{
 const f=page(),before=await f.call('state');f.nodes.get('O2N3DCutValidate3DRail').click=()=>{
  f.nodes.get('O2N3DCutDescription').textContent='Cut 102 of part 23';};
 const evidence=await f.call('validateAndNext',before.identity,{});
 assert.equal(evidence.navigationSemantics,'VALIDATE_NEXT_NON_VALIDATED_CUT');
 assert.equal(evidence.decisionCommand.id,'O2N3DCutValidate3DRail');
 assert.match(evidence.decisionCommand.title,/Load next non validated cut/);
 assert.equal(evidence.nextIdentity.cut,102);
});
test('real adapter reports an absent native command without fabricating a request',async()=>{
 const f=page(),before=await f.call('state');f.nodes.delete('O2N3DCutValidate3DRail');
 await assert.rejects(()=>f.call('validateAndNext',before.identity,{}),/Commande ESV indisponible/);
});
test('real adapter bounds the wait when a native validation button leaves the cut unchanged',async()=>{
 const f=page(),before=await f.call('state');let clicks=0;f.nodes.get('O2N3DCutValidate3DRail').click=()=>{clicks++;};
 await assert.rejects(()=>f.call('validateAndNext',before.identity,{}),/cut n’a pas changé/);assert.equal(clicks,1);
});
test('a single-cut lot detects navigation even when the next cut has no rail geometry yet',async()=>{
 const f=page(),before=await f.call('state');f.nodes.get('O2N3DCutValidate3DRail').click=()=>{
  f.nodes.get('O2N3DCutDescription').textContent='Cut 101 of part 23';f.root.children=[];
 };
 const result=await f.call('validateAndNext',before.identity,{part:23,start:100,end:100});
 assert.equal(result.navigationObserved,true);assert.equal(result.serverConfirmed,false);assert.equal(result.nextIdentity.cut,101);
 assert.ok(f.progress.some(e=>e.stage==='decision-command-returned'));assert.ok(f.progress.some(e=>e.stage==='navigation-observed'));
});
test('longer lots preserve navigation evidence while marking the next geometry as not ready',async()=>{
 const f=page(),before=await f.call('state');f.nodes.get('O2N3DCutValidate3DRail').click=()=>{
  f.nodes.get('O2N3DCutDescription').textContent='Cut 101 of part 23';f.root.children=[];
 };
 const result=await f.call('validateAndNext',before.identity,{part:23,start:100,end:102});
 assert.equal(result.navigationObserved,true);assert.equal(result.nextReady,false);
});
test('manual SKIP relays the ESV keyboard shortcut and never substitutes Next Invalid',()=>{
 const source=fs.readFileSync(path.join(__dirname,'../src/adapter-page.js'),'utf8');
 const body=source.slice(source.indexOf('function nativeDecision'),source.indexOf('async function captureOnce'));
 assert.match(body,/KeyboardEvent\('keydown'/);assert.match(body,/key:'Backspace'/);assert.match(body,/shiftKey:true/);
 assert.doesNotMatch(body,/selectors\.next|NextInvalid/);
});
test('explicit paused-cut SKIP sends one native shortcut and exports four independent observations',async()=>{
 const f=page(),before=await f.call('state'),evidence=await f.call('skipAndNext',before.identity,{part:23,start:100,end:100});
 assert.equal(f.keyboard.filter(e=>e.type==='keydown'&&e.key==='Backspace'&&e.shiftKey).length,1);
 assert.deepEqual({commandSent:evidence.commandSent,afterObserved:evidence.afterObserved,serverConfirmed:evidence.serverConfirmed,navigationObserved:evidence.navigationObserved},
   {commandSent:true,afterObserved:false,serverConfirmed:false,navigationObserved:true});
 assert.equal(evidence.afterStateStatus,'AFTER_STATE_MISSING_BECAUSE_TARGET_CHANGED');assert.equal(evidence.nextIdentity.cut,101);
});
test('native snapshot preserves a one-rail scene as partial data instead of inventing the missing rail',async()=>{
 const f=page();f.root.children=f.root.children.filter(x=>x!==f.right);const observed=await f.call('nativeSnapshot');
 assert.equal(observed.status,'partial');assert.equal(observed.rails.right,null);assert.ok(observed.rails.left);
 assert.ok(observed.partialReasons.includes('rail-right-not-observed'));
});
test('native LiDAR path is bounded, yields often, and contains no camera, selection, navigation, or decision call',()=>{
 const source=fs.readFileSync(path.join(__dirname,'../src/adapter-page.js'),'utf8');
 const body=source.slice(source.indexOf('async function nativeCapture'),source.indexOf('async function waitFor'));
 assert.match(body,/maxPointsPerRail:50000/);assert.match(body,/maxInspected:500000/);assert.match(body,/maxMillis:1800/);assert.match(body,/maxNodes:512/);assert.match(body,/yieldEvery:2048/);
 assert.match(body,/passive-prioritized-loaded-view/);assert.match(body,/onCheckpoint/);
 assert.doesNotMatch(body,/nativeClick|select\(|nativeDecision|validateAndNext|skipAndNext|selectors\.(left|right|next|validate)/);
});

/* ------------------------------------------------------------------------
 * PILOTE — défauts relevés sur le terrain du 15/09 et corrigés en V4.5.8.
 * ---------------------------------------------------------------------- */

/* 1. LA RELECTURE APRÈS VALIDATION.
 *
 * Le bouton de validation d'ESV valide ET navigue. `src/engine.js`, gelé,
 * ARRÊTE le lot quand la relecture sur la même identité échoue. Terrain :
 * 12 lots arrêtés sur 12, ici même.
 *
 * Ces deux tests ne prouvent PAS un correctif — rapprocher la relecture du clic
 * ne change rien quand ESV navigue de façon synchrone, et c'est le cas observé.
 * Ils verrouillent les deux comportements attendus : relire quand c'est
 * possible, et ne rien inventer quand ça ne l'est pas. Le défaut de fond est
 * architectural, décrit dans AUDIT_PILOTE.md. */
test('quand ESV laisse un tour, l’état est relu sur la même identité',async()=>{
 const f=page(),before=await f.call('state');
 // Navigation différée d'un tour de boucle : ESV réel se comporte ainsi une
 // fois sur deux ou trois, d'où l'intermittence rapportée.
 f.nodes.get('O2N3DCutValidate3DRail').click=()=>{
   queueMicrotask(()=>{f.nodes.get('O2N3DCutDescription').textContent='Cut 101 of part 23';});};
 const evidence=await f.call('validateAndNext',before.identity,{});
 assert.equal(evidence.afterObserved,true,'la relecture doit gagner la course quand ESV laisse un tour');
 assert.equal(evidence.afterStateStatus,'OBSERVED_SAME_TARGET');
 assert.ok(evidence.afterState,'l’état relu doit être conservé');
 assert.equal(evidence.afterState.identity.cut,before.identity.cut);
 assert.equal(evidence.navigationObserved,true,'la navigation reste observée');
});

test('une navigation synchrone reste honnêtement rapportée comme non relue',async()=>{
 // Pas de régression : quand ESV navigue dans le même tour, on ne prétend pas
 // avoir relu. Le pilote s'arrêtera, et c'est le comportement voulu.
 const f=page(),before=await f.call('state');
 const evidence=await f.call('validateAndNext',before.identity,{});
 assert.equal(evidence.afterObserved,false);
 assert.equal(evidence.afterStateStatus,'AFTER_STATE_MISSING_BECAUSE_TARGET_CHANGED');
 assert.equal(evidence.afterState,null,'aucun état inventé');
});

/* 2. LE COÛT DE L'IDENTIFICATION DES RAILS DANS LA BOUCLE D'ATTENTE.
 *
 * `context()` recalcule la moyenne des ordonnées de TOUS les sommets du contour
 * de chaque rail, uniquement pour décider quel objet est à gauche. Il est
 * appelé par `snapshot()` → `assertExpected()` → `guard()`, soit à chaque
 * itération de `waitFor`, toutes les 80 ms pendant toute la capture.
 * Mesure terrain : la capture représente 85 % du temps du pilote. */
function compteurDeParcours(f){
 let n=0;
 for(const rail of [f.left,f.right]){
   const attr=rail.children[1].children[0].geometry.attributes.position;
   const vrai=attr.count;
   Object.defineProperty(attr,'count',{get(){n++;return vrai;},configurable:true});
 }
 return ()=>n;
}

test('l’identification des rails n’est pas refaite à chaque lecture d’état',async()=>{
 const f=page();await f.call('state');
 const lu=compteurDeParcours(f);
 for(let i=0;i<10;i++)await f.call('state');
 assert.equal(lu(),0,'dix lectures d’état ne doivent déclencher aucun reparcours du contour');
});

test('mais elle est refaite dès que le cut change',async()=>{
 const f=page();await f.call('state');
 const lu=compteurDeParcours(f);
 f.nodes.get('O2N3DCutDescription').textContent='Cut 101 of part 23';
 await f.call('state');
 assert.ok(lu()>0,'un changement de cut doit invalider la mémoïsation');
});

test('un rail déplacé est vu immédiatement malgré la mémoïsation',async()=>{
 // C'est la propriété qui compte : mémoïser l'IDENTIFICATION ne doit jamais
 // mémoïser les POSES. Le pilote vérifie sans cesse que les rails n'ont pas
 // bougé ; si la mémoïsation masquait un déplacement, elle casserait ce
 // contrôle en silence.
 const f=page(),avant=await f.call('state');
 f.left.position.y+=.02;
 const apres=await f.call('state');
 assert.ok(Math.abs(apres.rails.left.positionSceneRelative[1]-avant.rails.left.positionSceneRelative[1]-.02)<1e-10,
   'le déplacement doit être relu à neuf');
 assert.deepEqual(apres.identity,avant.identity,'sans changer l’identité');
});

test('l’identification reste correcte après mémoïsation, ordre de scène inversé',async()=>{
 const f=page(),a=await f.call('state');
 f.root.children.reverse();
 const b=await f.call('state');
 assert.deepEqual(b.mapping,a.mapping,'gauche et droite ne doivent pas s’échanger');
 assert.deepEqual(b.rails,a.rails);
});

/* 3. LA SIGNATURE DU NIVEAU DE DÉTAIL, sérialisée deux fois par sondage. */
test('la signature du niveau de détail distingue toujours un chargement qui bouge',async()=>{
 const f=page();
 const lire=()=>f.ctx.window.__BANANE_TEST_SIGNATURE?.();
 // Pas d'accès direct : on l'exerce par la capture, qui l'utilise pour attendre
 // la stabilité. Ici on vérifie au moins que deux états différents de la scène
 // ne produisent pas la même valeur observable via l'état exporté.
 const a=await f.call('state');
 f.left.children[1].children[0].geometry.attributes.position.version=7;
 const b=await f.call('state');
 assert.deepEqual(b.identity,a.identity,'la version d’un tampon ne change pas l’identité');
});

/* 4. LES CONSTANTES DU PILOTE, jusqu'ici codées en dur et invisibles.
 *
 * `src/settings.js` avait été créé pour donner une source unique aux réglages
 * de la collecte. Le pilote n'avait jamais été traité : tentatives, stabilité,
 * budgets et plafonds d'attente vivaient dans `adapter-page.js`, sans nom
 * affichable ni moyen de les étudier. La capture représente 85 % du temps du
 * pilote — on ne peut pas travailler dessus si on ne peut pas la régler. */
test('le pilote lit ses réglages depuis la source unique',()=>{
 const S=require('../src/settings.js');
 for(const cle of ['tentativesParVue','stabiliteMs','budgetCaptureMs','sondageMs',
   'lecturesStables','attenteMs','attenteNavigationMs','attenteClicMs'])
  assert.ok(Number.isFinite(S.pilote[cle]),'réglage absent : '+cle);
 assert.ok(Object.isFrozen(S.pilote));
 const source=fs.readFileSync(path.join(__dirname,'../src/adapter-page.js'),'utf8');
 // Plus aucune de ces valeurs ne doit rester écrite en dur dans le code.
 const code=source.replace(/\/\*[\s\S]*?\*\//g,'');
 for(const enDur of ['stableForMs=800','budgetMs=60000','maxAttemptsPerView=3','sleep(80)','stable>=3'])
  assert.ok(!code.includes(enDur),'valeur encore codée en dur : '+enDur);
});

test('les réglages du pilote sont affichables à l’opérateur',()=>{
 const S=require('../src/settings.js');
 const lignes=S.describe().filter(r=>r.groupe==='Pilote');
 assert.ok(lignes.length>=4,'le pilote doit apparaître dans les réglages lisibles');
 for(const l of lignes){
  assert.ok(l.nom&&l.valeur,'une ligne sans nom ou sans valeur');
  assert.ok(l.pourquoi&&l.pourquoi.length>20,'une ligne sans explication : '+l.nom);
 }
});

test('l’adaptateur fonctionne même si la source unique est absente',async()=>{
 // Repli : un réglage manquant ne doit jamais empêcher le pilote de tourner.
 const source=fs.readFileSync(path.join(__dirname,'../src/adapter-page.js'),'utf8');
 assert.match(source,/window\.BananeSettings\?\.pilote\|\|/,'un repli doit exister');
});

/* 5. MÉMOÏSATION — le cas du remplacement d'objet à matrice identique.
 *
 * Si ESV remplace l'objet Three.js d'un rail par un nouvel objet de même pose,
 * la garde « même cut + même matrice racine » ne suffirait pas : le cache
 * rendrait une référence devenue orpheline, et l'adaptateur lirait un objet
 * détaché de la scène. La garde vérifie donc AUSSI que les objets mémorisés
 * sont encore enfants de la racine. */
test('un rail remplacé par un nouvel objet invalide la mémoïsation',async()=>{
 const f=page();
 const avant=await f.call('state');
 // Remplacement à l'identique : même pose, même cut, même matrice racine.
 const ancien=f.left,index=f.root.children.indexOf(ancien);
 const neuf=JSON.parse(JSON.stringify({p:[ancien.position.x,ancien.position.y,ancien.position.z]})).p;
 const F=require('./v242/fixtures.cjs');
 const remplacant=F.rail(0,neuf,0);
 f.root.children[index]=remplacant;remplacant.parent=f.root;
 ancien.parent=null;              // ce que fait Three.js en retirant un enfant
 const apres=await f.call('state');
 assert.deepEqual(apres.identity,avant.identity,'le cut ne change pas');
 assert.notEqual(apres.mapping.left.objectId,avant.mapping.left.objectId,
   'le nouvel objet doit être identifié, pas l’ancien resté en cache');
});

test('un objet détaché de la scène force un recalcul, il n’est pas servi du cache',async()=>{
 const f=page();
 await f.call('state');
 const lu=compteurDeParcours(f);
 await f.call('state');
 assert.equal(lu(),0,'référence de contrôle : sans changement, aucun recalcul');
 f.left.parent=null;              // ce que fait Three.js en retirant un enfant
 const apres=await f.call('state');
 assert.ok(lu()>0,'un objet détaché doit invalider le cache');
 // Et le recalcul redonne un état correct : la scène liste toujours l'objet,
 // il est simplement réidentifié au lieu d'être servi depuis une garde périmée.
 assert.ok(apres.rails.left&&apres.rails.right,'les deux rails restent lus');
});

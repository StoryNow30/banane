'use strict';
/* CH-084 — deux attentes de la capture au signal (`attendreChargement`, src/adapter-page.js), derrière des réglages ÉTEINTS par défaut :
 * `pilote.repliCourt` {actif, silenceMs} (repli « stabilité » plus court quand aucun nœud n'a bougé) et `pilote.imagesMin` (2 ou 3).
 * D-315 (opérateur) : livrés ALLUMÉS dans src/settings.js (repli court à 600 ms, deux images). Le comportement d'avant (éteint) est prouvé en
 * passant le réglage explicitement (ETEINT). La valeur de repli codée en dur dans l'adaptateur (sans module de réglages) reste éteinte.
 * Le patch (chantiers/CH-084/adapter-page.patch) est appliqué à une COPIE temporaire de src/adapter-page.js tant que le tronc ne le porte pas
 * (src/adapter-page.js est gelé pour un exécutant) ; une fois appliqué au tronc, l'essai lit src/adapter-page.js tel quel.
 * Page ESV simulée au rythme des images (tests/helpers/esv-images.cjs), horloge à événements discrets. Sans l'outil `patch`, l'essai se saute ;
 * un patch qui ne s'applique plus est un ÉCHEC. Données synthétiques. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{spawnSync}=require('node:child_process');
const racine=path.resolve(__dirname,'..'),SRC=path.join(racine,'src/adapter-page.js'),PATCH=path.join(racine,'chantiers/CH-084/adapter-page.patch');
const ORIGINAL=fs.readFileSync(SRC,'utf8'),DEJA=ORIGINAL.includes('CH-084');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ch084-'));fs.mkdirSync(path.join(dir,'src'));fs.writeFileSync(path.join(dir,'src/adapter-page.js'),ORIGINAL);
const r=DEJA?{status:0}:spawnSync('patch',['-s','-p1','-d',dir,'-i',PATCH],{encoding:'utf8'}),raison=r.error?.code==='ENOENT'?'outil patch absent':null;
const opts=raison?{skip:raison}:{};
const PATCHE=DEJA?ORIGINAL:(r.status===0?fs.readFileSync(path.join(dir,'src/adapter-page.js'),'utf8'):null);
/* La page simulée lit src/adapter-page.js à chaque montage : on lui sert la version voulue (« avant » = le fichier du tronc, « après » = patché). */
let servir='apres';
const lire=fs.readFileSync;fs.readFileSync=function(f,...a){if(path.resolve(String(f))===SRC&&servir==='apres'&&PATCHE!==null)return PATCHE;return lire.call(fs,f,...a);};
const {esv,nuage}=require('./helpers/esv-images.cjs'),S=require('../src/settings.js'),F=require('./v242/fixtures.cjs');
const J=x=>JSON.parse(JSON.stringify(x??null));
const lus=f=>J(f.progress.filter(p=>p.stage==='capture-read').map(p=>p.detail));

/* Une capture du cut 100 (rapide, signal à la première tentative). chargements>0 : compteur pendu, seule la stabilité ferme l'attente.
 * bouge : un nœud visible de plus apparaît `bouge` images après chaque début d'attente (la signature change une fois). */
async function capturer({pilote={},chargements=0,bouge=null,version='apres'}={}){servir=version;
 try{const f=esv({cut:100,pilote,chargements}),pc=nuage(f);
  if(bouge!==null){let debutAttente=null,vus=0;const tic=f.ctx.requestAnimationFrame;
   f.ctx.requestAnimationFrame=fn=>tic(()=>{const n=f.progress.filter(p=>p.stage==='capture-wait').length;
    if(n!==vus){vus=n;debutAttente=f.potree.framenumber;}
    if(debutAttente!==null&&f.potree.framenumber-debutAttente===bouge){const m=F.object([0,0,0],'Points');
     m.geometry={attributes:{position:F.buffer([[0,.02,.02],[0,1.43,.02]])}};pc.visibleNodes=[...pc.visibleNodes,{sceneNode:m}];debutAttente=null;}
    fn();});}
  const before=await f.call('state'),t0=f.clock(),capture=J(await f.call('capture',before));
  return {d:lus(f),ms:f.clock()-t0,capture};}
 finally{servir='apres';}}
const ETEINT={repliCourt:{actif:false,silenceMs:600},imagesMin:3},ALLUME={repliCourt:{actif:true,silenceMs:600},imagesMin:2};
/* Mêmes points lus : la capture sans ses identifiants, horodatages et stratégie de lecture (qui portent les temps d'attente) ; `quality.durationMs`
 * est un temps de calcul réel (mesuré : 1 à 3 ms d'une exécution à l'autre au même réglage), retiré lui aussi. */
const points=c=>JSON.stringify({p:c.pointsSceneRelative,s:c.pointSources,n:c.nodes,r:c.rails,cl:c.clouds,a:c.attributes,q:{...c.quality,durationMs:null},v:c.visibleByClipBoxes,st:c.status});
const sansAge=d=>d.map(({diag,...x})=>({...x,diag:(({ageS,...g})=>g)(diag||{})}));

test('le patch s’applique au tronc (ou le tronc le porte)',opts,()=>{assert.equal(r.status,0,'patch : '+(r.stderr||r.stdout));assert.ok(PATCHE.includes('CH-084'));});

test('réglages livrés (D-315) : repliCourt allumé à 600 ms, imagesMin 2 ; repli codé en dur de l’adaptateur éteint',opts,()=>{
 assert.deepEqual(J(S.pilote.repliCourt),{actif:true,silenceMs:600});assert.equal(S.pilote.imagesMin,2);
 assert.ok(PATCHE.includes('repliCourt:{actif:false,silenceMs:600},imagesMin:3};'),'sans module de réglages : éteint');
 assert.ok(Object.isFrozen(S.pilote.repliCourt));});

test('éteints : mêmes sorties qu’avant le patch, au signal comme au repli (règle, diagnostic, temps simulé, capture)',opts,async()=>{
 if(DEJA)return;   /* une fois le patch au tronc, il n'y a plus d'« avant » à comparer ; les essais suivants gardent les valeurs absolues */
 for(const cas of [{pilote:ETEINT},{pilote:ETEINT,chargements:2},{pilote:ETEINT,chargements:2,bouge:5},{pilote:{repliCourt:{actif:false,silenceMs:100},imagesMin:3}},{pilote:{...ETEINT,imagesMin:7},chargements:0},{pilote:{repliCourt:undefined,imagesMin:undefined},chargements:2}]){
  const avant=await capturer({...cas,version:'avant'}),apres=await capturer({...cas,version:'apres'});
  assert.deepEqual(sansAge(apres.d),sansAge(avant.d),JSON.stringify(cas));assert.equal(apres.ms,avant.ms,JSON.stringify(cas));
  assert.deepEqual(apres.capture.readStrategy.attempts,avant.capture.readStrategy.attempts,JSON.stringify(cas));assert.equal(points(apres.capture),points(avant.capture),JSON.stringify(cas));
  for(const x of apres.d)assert.equal('rc' in x.diag,false,'aucun champ rc éteint');}});

test('éteints : valeurs absolues d’aujourd’hui (repli à 800 ms, signal après 3 images)',opts,async()=>{
 const rep=await capturer({pilote:ETEINT,chargements:2});assert.deepEqual(rep.d.map(x=>x.regle),['stabilite','stabilite']);
 for(const x of rep.d){assert.ok(x.diag.at>=800&&x.diag.at<800+2*16+80,'repli à ~800 ms : '+x.diag.at);assert.equal(x.diag.ch,0);assert.equal(x.diag.rc,undefined);}
 const sig=await capturer({pilote:ETEINT});assert.deepEqual(sig.d.map(x=>x.regle),['signal','signal']);});

test('repliCourt actif (livré) : sortie à ~600 ms quand rien ne bouge (rc:1), à 800 ms après le dernier changement si un nœud a bougé',opts,async()=>{
 const pilote={repliCourt:{actif:true,silenceMs:600},imagesMin:3};
 assert.deepEqual(J((await capturer({chargements:2})).d.map(x=>[x.regle,x.diag.rc])),[['stabilite',1],['stabilite',1]],'réglage livré : sortie courte');
 const court=await capturer({pilote,chargements:2});assert.deepEqual(court.d.map(x=>x.regle),['stabilite','stabilite']);
 for(const x of court.d){assert.ok(x.diag.at>=600&&x.diag.at<800,'sortie courte : '+x.diag.at);assert.equal(x.diag.rc,1);assert.equal(x.diag.ch,0);}
 const ref=await capturer({pilote:ETEINT,chargements:2});assert.ok(court.ms<ref.ms,`capture plus courte : ${court.ms} < ${ref.ms} ms`);
 const bouge=await capturer({pilote,chargements:2,bouge:5});assert.deepEqual(bouge.d.map(x=>x.regle),['stabilite','stabilite']);
 for(const x of bouge.d){assert.equal(x.diag.ch,1,'un changement de signature');assert.equal(x.diag.rc,undefined,'pas de sortie courte');
  assert.ok(x.diag.at-x.diag.tc>=800,'800 ms de silence après le changement : '+(x.diag.at-x.diag.tc));}
 /* silenceMs ≥ stabiliteMs, nul ou illisible : ignoré, repli à 800 ms. */
 for(const silenceMs of [800,1200,0,-5,'600',null]){const x=(await capturer({pilote:{repliCourt:{actif:true,silenceMs},imagesMin:3},chargements:2})).d[0];
  assert.ok(x.diag.at>=800,'silenceMs '+silenceMs+' : '+x.diag.at);assert.equal(x.diag.rc,undefined);}
 /* actif mais signal possible : le signal sort avant le repli, rien ne change. */
 const sig=await capturer({pilote});assert.deepEqual(sig.d.map(x=>x.regle),['signal','signal']);for(const x of sig.d)assert.equal(x.diag.rc,undefined);});

test('imagesMin 2 (livré) : sortie au signal une image plus tôt ; toute autre valeur que 2 vaut 3',opts,async()=>{
 const trois=await capturer({pilote:ETEINT}),deux=await capturer({pilote:{...ETEINT,imagesMin:2}});
 assert.deepEqual((await capturer({})).d.map(x=>x.diag.img),deux.d.map(x=>x.diag.img),'réglage livré : deux images');
 assert.deepEqual(deux.d.map(x=>x.regle),['signal','signal']);
 for(let i=0;i<2;i++){assert.equal(deux.d[i].diag.img,trois.d[i].diag.img-1,'une image de moins');assert.ok(deux.d[i].diag.at<trois.d[i].diag.at);}
 assert.ok(deux.ms<trois.ms,`capture plus courte : ${deux.ms} < ${trois.ms} ms`);
 for(const imagesMin of [1,4,0,'2',null,2.5]){const x=await capturer({pilote:{...ETEINT,imagesMin}});
  assert.deepEqual(x.d.map(y=>y.diag.img),trois.d.map(y=>y.diag.img),'imagesMin '+imagesMin+' vaut 3');assert.equal(x.ms,trois.ms);}
 /* imagesMin 2 ne lève aucune autre condition : compteur pendu → repli, comme avant. */
 const pendu=await capturer({pilote:{...ETEINT,imagesMin:2},chargements:2});assert.deepEqual(pendu.d.map(x=>x.regle),['stabilite','stabilite']);});

test('vue qui bouge encore (réglage livré) : un nœud change pendant l’attente → jamais de sortie à 600 ms, 800 ms de silence comme aujourd’hui ; mêmes points avec et sans le réglage',opts,async()=>{
 for(const bouge of [2,5,20]){
  const on=await capturer({pilote:ALLUME,chargements:2,bouge}),off=await capturer({pilote:ETEINT,chargements:2,bouge});
  assert.deepEqual(on.d.map(x=>x.regle),['stabilite','stabilite'],'bouge '+bouge);
  for(const [i,x] of on.d.entries()){assert.equal(x.diag.ch,1,'bouge '+bouge+' : un changement');assert.equal(x.diag.rc,undefined,'bouge '+bouge+' : pas de sortie courte');
   assert.ok(x.diag.at-x.diag.tc>=800,'bouge '+bouge+' : 800 ms après le changement ('+(x.diag.at-x.diag.tc)+')');
   assert.equal(x.diag.at,off.d[i].diag.at,'bouge '+bouge+' : même attente que sans le réglage');}
  assert.equal(on.ms,off.ms,'bouge '+bouge+' : même durée de capture');assert.equal(points(on.capture),points(off.capture),'bouge '+bouge+' : mêmes points');}
 /* Vues stables : la lecture est la même (mêmes points), seule l'attente raccourcit. */
 for(const chargements of [0,2]){const on=await capturer({pilote:ALLUME,chargements}),off=await capturer({pilote:ETEINT,chargements});
  assert.equal(points(on.capture),points(off.capture),'vue stable, chargements '+chargements+' : mêmes points');assert.ok(on.ms<off.ms,`plus court : ${on.ms} < ${off.ms}`);}});

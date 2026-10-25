'use strict';
/* Lecteur d'export : (1) un bilan Orbite produit par le banc lui-même ;
 * (2) une session Écho v2 SYNTHÉTIQUE construite ici à partir des captures du
 * corpus (blocs par rail, pose humaine finale inventée) ; (3) rejeu de la
 * session Écho dans la maquette avec le vrai adaptateur : la capture d'Ariane
 * rend exactement les points visibles des blocs.
 *   node --test --test-timeout=60000 tests/esv-maquette/lecteur-export.test.cjs */
const {test}=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs'),os=require('node:os');
const C=require('../../vendor/capture-core.js');
const L=require('./lecteur-export.cjs'),S=require('./scenario.cjs'),N=require('./navigateur.cjs');
const raison=N.indisponible(),opts=raison?{skip:raison}:{};
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'maquette-echo-'));
/* Session Écho v2 synthétique : une visite par capture du corpus, blocs par rail (points de la fenêtre du rail), pose finale humaine = départ + 7 mm en travers. */
function sessionEcho(captures){const records=[],clouds=[];
  captures.forEach((cap,vi)=>{const visitId=`visite-${vi}`,captureId=`capture-${vi}`,identity={pageId:'p',part:cap.part,cut:cap.cut,shape:'U50',frameId:'f',projectId:null};
    const rails={left:cap.rails.left,right:cap.rails.right},chunkIds=[];
    for(const side of ['left','right']){const inv=rails[side].sceneRelativeToProfileLocal,pts=[],vis=[];
      cap.pointsSceneRelative.forEach((p,k)=>{const l=C.point(inv,p);if(Math.abs(l[0])<=.5&&Math.abs(l[1])<=.4&&Math.abs(l[2])<=.3){pts.push(p);vis.push(cap.visibleByClipBoxes?.[k]??true);}});
      const chunkId=`${captureId}:${side}:0`;chunkIds.push(chunkId);
      clouds.push({format:'banane-native-lidar-chunk-v1',chunkId,captureId,visitId,side,identity,rail:{...rails[side]},pointsSceneRelative:pts,visibleByClipBoxes:vis});}
    clouds.push({format:'banane-native-lidar-capture-v2',captureId,visitId,identity,clouds:cap.clouds});
    const humaine={};for(const side of ['left','right']){const r=rails[side],d=C.point(r.profileLocalToSceneRelative,[0,.007,0]).map((v,i)=>v-r.profileOriginSceneRelative[i]);
      humaine[side]={...r,positionSceneRelative:r.positionSceneRelative.map((v,i)=>v+d[i])};}
    records.push({format:'banane-native-visit-v2',recordId:visitId,visitId,visitIndex:vi,identity,initialObserved:{identity,rails},beforeEstablished:{rails},
      lidarCaptureIds:[captureId],lidarChunkIds:chunkIds,operatorIntent:vi%3===2?'SKIP':'VALIDATE',humanFinalReference:vi%3===2?null:{status:'candidate-observed',state:{identity,rails:humaine}},finalObserved:{identity,rails:humaine}});});
  return {format:'banane-native-session-v2',version:'essai',session:{id:'s'},records,events:[],clouds,cloudIds:clouds.map(c=>c.captureId)};}
const corpus=S.corpus().slice(0,4).map(c=>c.capture);
const fichierEcho=path.join(tmp,'echo.json');fs.writeFileSync(fichierEcho,JSON.stringify(sessionEcho(corpus)));
test('Écho : visites, blocs par rail, référence humaine, intention',()=>{
  const s=L.construire(fichierEcho);assert.equal(s.provenance.nature,'echo');assert.equal(s.provenance.rejouables,4);assert.equal(s.provenance.exclus.total,0);
  const cuts=s.parties[0].cuts;assert.deepEqual(cuts.map(c=>c.cut),corpus.map(c=>c.cut).sort((a,b)=>a-b));
  const c0=cuts[0];assert.equal(c0.noeuds.length,2,'un nœud par bloc (gauche, droit)');assert.equal(c0.reference.source,'humaine');assert.equal(c0.intent,'VALIDATE');
  assert.ok(cuts.some(c=>c.intent==='SKIP'&&c.reference===null),'une visite passée sans référence');
  assert.ok(c0.decoupe&&c0.decoupe.boites.length===1,'découpe réelle reprise de la capture');
  const dist=Math.hypot(...c0.reference.monde.left.map((v,i)=>v-c0.rails.left.position[i]));assert.ok(Math.abs(dist-.007)<1e-6,'référence à 7 mm du départ : '+dist);
});
test('Orbite : bilan du banc (records + nuages), cut sans enregistrement rejouable',()=>{
  const bilan=process.env.BANANE_MAQUETTE_BILAN;if(!bilan||!fs.existsSync(bilan))return; /* produit par extension.test.cjs ou par --dataset ; absent : rien à vérifier ici */
  const s=L.construire(bilan);assert.equal(s.provenance.nature,'orbite');assert.ok(s.provenance.rejouables>=1);
  for(const c of s.parties[0].cuts){assert.ok(c.noeuds.length>0);if(c.reference)assert.equal(c.reference.source,'ariane');}
});
test('rejeu Écho dans la maquette : la capture du vrai adaptateur rend les points des blocs',opts,async()=>{
  const {demarrer}=require('./serveur.cjs');const serveur=await demarrer({exportation:fichierEcho});
  const pw=N.playwright();const navigateur=await pw.chromium.launch({executablePath:N.executable(),headless:true});
  try{const page=await navigateur.newPage();const erreurs=[];page.on('pageerror',e=>erreurs.push(e.message));
    await page.goto(`${serveur.url}/tests/esv-maquette/esv.html?source=export&latence=20`);await page.evaluate(()=>window.__maquette.pret);await page.waitForFunction(()=>window.__maquette.etat().railsPrets);
    const etat=await page.evaluate(()=>window.__maquette.etat());assert.equal(etat.provenance.nature,'echo');assert.equal(etat.cut,corpus.map(c=>c.cut).sort((a,b)=>a-b)[0]);
    const version=JSON.parse(N.lire('manifest.json')).version;
    await page.addScriptTag({content:`window.__ARIANE_PROPRIETAIRE={id:'essai',version:${JSON.stringify(version)},versionName:'essai'};`});
    for(const f of N.PAGE_FILES)await page.addScriptTag({content:N.lire(f)});
    const appel=(action,args=[])=>page.evaluate(([action,args])=>new Promise(res=>{const id='i'+Math.random();const f=e=>{if(e.data?.kind==='banane3:result'&&e.data.id===id){removeEventListener('message',f);res(e.data);}};
      addEventListener('message',f);postMessage({kind:'banane3:command',id,channel:'essai',proprietaire:'essai',action,args,sentAt:Date.now()},location.origin);}),[action,args]);
    const s=await appel('state');assert.equal(s.error,undefined,s.error);
    const c=await appel('capture',[s.result]);assert.equal(c.error,undefined,c.error);
    const sc=L.construire(fichierEcho),attendu=sc.parties[0].cuts[0].noeuds.reduce((n,x)=>n+x.positions.length/3,0);
    assert.equal(c.result.pointsSceneRelative.length,attendu,'tous les points visibles des blocs, et eux seuls');
    assert.deepEqual(erreurs,[]);
  }finally{await navigateur.close();await serveur.fermer();}
});
test('jeu d’apprentissage : écarts départ → référence, interpolation entre voisins, repère profil',()=>{
  const J=require('../../tools/jeu-apprentissage-maquette.cjs');
  const jeu=J.construire({exports:[fichierEcho],rejeu:null,fenetre:3,points:false,sortie:null});
  assert.equal(jeu.format,'banane-apprentissage-v1');assert.equal(jeu.resume.cuts,4);assert.equal(jeu.resume.avecReference,3,'trois visites validées, une passée');
  const cuts=jeu.parties[0].cuts;const c=cuts.find(x=>x.reference);
  assert.ok(Math.abs(c.ecartDepartMm.left-7)<=.2&&Math.abs(c.ecartDepartMm.right-7)<=.2,'référence à 7 mm du départ : '+JSON.stringify(c.ecartDepartMm));
  assert.ok(Math.abs(c.deltaLocalMm.left[1]-7)<=.2&&Math.abs(c.deltaLocalMm.left[0])<=.2&&Math.abs(c.deltaLocalMm.left[2])<=.2,'7 mm en travers, rien le long ni en vertical : '+JSON.stringify(c.deltaLocalMm));
  assert.ok(c.points.left>100&&c.points.right>100,'points par rail : '+JSON.stringify(c.points));
  /* Cuts du corpus : 2855…2860 ; le 2856 (intent SKIP) est entre 2855 et 2857, tous deux à référence : interpolation possible pour un voisin interne. */
  const interpoles=cuts.filter(x=>x.interpolation);assert.ok(interpoles.length>=1,'au moins un cut interpolé entre deux voisins à référence');
  for(const x of interpoles)assert.ok(x.voisins.avant!==null&&x.voisins.apres!==null);
});

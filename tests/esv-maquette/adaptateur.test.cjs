'use strict';
/* Essais de la maquette ESV avec le VRAI code de page d'Ariane (src/adapter-page.js
 * et ses modules), dans un vrai Chromium. Hors du banc `verify` : lancer
 *   node --test --test-timeout=60000 tests/esv-maquette/
 * Chaque essai dit ce qu'il PROUVE sur la maquette ; rien ici n'est vérifié sur
 * le vrai ESV (hypothèses : tests/esv-maquette/README.md). */
const {test,before,after}=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
const N=require('./navigateur.cjs');
const raison=N.indisponible(),opts=raison?{skip:raison}:{};
const corpus=JSON.parse(fs.readFileSync(path.join(N.racine,'tests/corpus/banane-lidar-part-23-cut-2855-1788941885642.json'),'utf8'));
const proche=(a,b,tol,msg)=>assert.ok(a.every((v,i)=>Math.abs(v-b[i])<=tol),`${msg} : ${JSON.stringify(a)} ≠ ${JSON.stringify(b)} (±${tol})`);
let env=null;
before(async()=>{if(!raison){env=await N.ouvrir({maquette:{cuts:8,latence:30}});await env.injecter();}});
after(async()=>{if(env)await env.fermer();});
test('état : identité, deux rails, poses scène identiques au corpus',opts,async()=>{
  const r=await env.appel('state');assert.equal(r.error,undefined,r.error);
  assert.deepEqual([r.result.identity.part,r.result.identity.cut,r.result.identity.shape],[23,100,'U50']);
  proche(r.result.rails.left.positionSceneRelative,[0,0,0],1e-9,'rail gauche à l’origine de la scène');
  proche(r.result.rails.right.positionSceneRelative,corpus.rails.right.positionSceneRelative,1e-6,'rail droit comme au corpus');
  proche(r.result.rails.left.railLocalToSceneRelative,corpus.rails.left.railLocalToSceneRelative,1e-9,'matrice du rail gauche');
  assert.deepEqual(r.result.rails.left.rotation,corpus.rails.left.rotation);
});
test('capture : mêmes points que la capture d’origine (fenêtres par rail), relevé passif du compteur',opts,async()=>{
  const s=(await env.appel('state')).result,debut=Date.now();
  const c=await env.appel('capture',[s]);assert.equal(c.error,undefined,c.error);
  const d=c.result;assert.equal(d.status,'complete-loaded-roi');
  assert.equal(d.pointsSceneRelative.length,corpus.pointsSceneRelative.length,'nombre de points');
  assert.deepEqual(d.quality.perRail,corpus.quality.perRail,'points par rail');
  assert.equal(d.readStrategy.attempts.filter(a=>a.status==='captured').length,2,'une lecture réussie par rail');
  assert.ok(Object.keys(d.attributes).includes('intensity'),'intensité lue');
  const releves=await env.messages('banane3:releve');assert.equal(releves.length,1,'un relevé passif après la capture');
  const e=await env.etat();assert.deepEqual(releves[0].releve.compteur,{traites:e.traites,total:e.total});assert.equal(e.total,108,'une ligne par indice, cut N = ligne N');assert.equal(releves[0].releve.objetsRail,2);assert.equal(releves[0].releve.cutsAffiches,undefined,'pas de texte « M cuts » (relevé du 15 octobre)');
  console.log(`# capture : ${Date.now()-debut} ms (${d.readStrategy.attempts.map(a=>a.durationMs+' ms').join(', ')})`);
});
test('pose (apply) par clics dans la vue, à 1 mm, puis restauration',opts,async()=>{
  const avant=(await env.appel('state')).result;
  /* delta en repère profil : x = le long de la voie (toujours 0 : ESV pose dans le plan de coupe), y en travers, z vertical. */
  const proposals={left:{delta:[0,-.003,.002]},right:{delta:[0,.005,-.001]}};
  const r=await env.appel('apply',[avant,proposals]);assert.equal(r.error,undefined,r.error);
  const K=require(path.join(N.racine,'src/core.js')),attendu=K.expectedPoses(avant,proposals);
  for(const s of ['left','right'])proche(r.result.rails[s].positionSceneRelative,attendu[s].positionSceneRelative,1e-3,`rail ${s} posé`);
  const poses=(await env.page.evaluate(()=>window.__maquette.journal.filter(e=>e.type==='rail-pose')));assert.ok(poses.length>=2,'au moins un clic par rail');
  const back=await env.appel('restore',[avant]);assert.equal(back.error,undefined,back.error);
  for(const s of ['left','right'])proche(back.result.rails[s].positionSceneRelative,avant.rails[s].positionSceneRelative,1e-3,`rail ${s} restauré`);
});
test('navigation sans décision : cut suivant invalide, aucune écriture',opts,async()=>{
  const s=(await env.appel('state')).result;
  const r=await env.appel('nextWithoutDecision',[s.identity,{pageId:s.identity.pageId,part:23},'op-1']);assert.equal(r.error,undefined,r.error);
  const e=r.result;assert.equal(e.refusal,null);assert.equal(e.navigationObserved,true);assert.equal(e.nextReady,true);assert.equal(e.nextIdentity.cut,101);
  assert.equal(env.serveur.journal.ecritures.length,0,'aucune écriture');
  const doublon=await env.appel('nextWithoutDecision',[e.nextIdentity,{},'op-1']);assert.equal(doublon.result.refusal.code,'OPERATION_ALREADY_INVOKED');
});
test('valider et suivant : écriture 204 « valid », compteur N → N+1, cut non validé suivant',opts,async()=>{
  const s=(await env.appel('state')).result;assert.equal(s.identity.cut,101);
  const r=await env.appel('validateAndNext',[s.identity,{part:23,end:107}]);assert.equal(r.error,undefined,r.error);
  const e=r.result;assert.equal(e.commandSent,true);assert.equal(e.navigationObserved,true);assert.equal(e.nextIdentity.cut,102);assert.equal(e.navigationSemantics,'VALIDATE_NEXT_NON_VALIDATED_CUT');
  const ecritures=env.serveur.journal.ecritures;assert.equal(ecritures.length,1);assert.equal(ecritures[0].body.ExtractionStatus,'valid');assert.equal(ecritures[0].status,204);
  const m=await env.etat();assert.equal(m.compteur,`${m.traites} on 108 treated`);assert.equal(m.traites,103,'100 lignes de remplissage + 2 cuts non invalides + 1 validé');
});
test('passer (SKIP, Maj+Retour) : écriture « skipped », puis invalide suivant',opts,async()=>{
  const s=(await env.appel('state')).result;assert.equal(s.identity.cut,102);
  const r=await env.appel('skipAndNext',[s.identity,{part:23,end:107}]);assert.equal(r.error,undefined,r.error);
  assert.equal(r.result.nextIdentity.cut,103);assert.equal(env.serveur.journal.ecritures.at(-1).body.ExtractionStatus,'skipped');
  const touches=await env.page.evaluate(()=>window.__maquette.journal.filter(e=>e.type==='touche').map(t=>[t.key,t.shift,t.trusted]));
  assert.deepEqual(touches.at(-1),['Backspace',true,false],'raccourci relayé, non fiable');
});
test('valider sur place (Ctrl+Entrée) : compteur +1, cut inchangé',opts,async()=>{
  const s=(await env.appel('state')).result;assert.equal(s.identity.cut,103);
  const r=await env.appel('validateInPlace',[s.identity,{},{commande:'ctrl-entree'}]);assert.equal(r.error,undefined,r.error);
  assert.equal(r.result.serverConfirmed,true);assert.equal(r.result.navigationObserved,false);assert.equal(r.result.compteurApres.traites,r.result.compteurAvant.traites+1);
  assert.equal((await env.etat()).cut,103);
});
test('retour à une coupe : boutons « Previous cut » / « Next cut » d’ESV (identifiants relevés) et événement interne (hypothèse)',opts,async()=>{
  await env.page.click('#O2N3DCutPrevious3DRail');await env.page.waitForFunction(()=>window.__maquette.etat().cut===102&&window.__maquette.etat().railsPrets);
  /* Événement interne d'ESV tel que la 4.9 le déclenche : $(#globalcontainer).trigger('railPairSelected',[partie en texte, index]). */
  await env.page.evaluate(()=>window.$(document.getElementById('globalcontainer')).trigger('railPairSelected',['23',100]));
  await env.page.waitForFunction(()=>window.__maquette.etat().cut===100&&window.__maquette.etat().railsPrets);
  const s=(await env.appel('state')).result;assert.equal(s.identity.cut,100);assert.equal(env.serveur.journal.ecritures.length,3,'aucune écriture par la navigation');
});
test('précision des nœuds : positions Float32 locales au nœud, scène reconstituée au micron (comme Potree)',opts,async()=>{
  /* Régression du 15 octobre : des coordonnées scène de ~1 600 m stockées en Float32 perdaient 0,1 mm et déplaçaient
   * 34 rails de 2 à 30 mm au rejeu d'un export de terrain. */
  /* CH-017 : les nœuds du cut affiché sont attendus (chargés, aucun en cours) avant la mesure : juste après « retour à une coupe », l'essai les lisait
   * parfois avant leur arrivée (0 point, tronc compris : 6 échecs sur 6 quand il suit cet essai seul). Ce qui est mesuré ne change pas. */
  await env.page.waitForFunction(()=>window.__maquette.etat().noeudsVisibles>0&&!(window.Potree?.numNodesLoading>0),null,{timeout:20000});
  const r=await env.page.evaluate(async()=>{const m=window.__maquette,e=m.etat(),c=m.scenario().parties.find(p=>p.part===e.part).cuts.find(x=>x.cut===e.cut);
    const j=await (await fetch(c.noeudsUrl)).json(),pc=window.viewer.scene.pointclouds[0];let maxLocal=0,maxErr=0,n=0,coinMax=-Infinity,coinMin=Infinity;
    for(const nd of pc.visibleNodes){const a=nd.sceneNode.geometry.attributes.position.array,M=nd.sceneNode.matrixWorld.elements;
      for(let k=0;k<3;k++){let mn=Infinity;for(let i=k;i<a.length;i+=3)mn=Math.min(mn,a[i]);coinMin=Math.min(coinMin,mn);coinMax=Math.max(coinMax,mn);}
      const src=j.noeuds.find(x=>x.positions.length===a.length&&Math.abs(x.positions[0]+c.origine[0]-(M[0]*a[0]+M[4]*a[1]+M[8]*a[2]+M[12]))<1e-3);if(!src)return {erreur:'nœud sans source'};
      for(let i=0;i<a.length;i+=3){const s=[M[0]*a[i]+M[4]*a[i+1]+M[8]*a[i+2]+M[12],M[1]*a[i]+M[5]*a[i+1]+M[9]*a[i+2]+M[13],M[2]*a[i]+M[6]*a[i+1]+M[10]*a[i+2]+M[14]];
        for(let k=0;k<3;k++){maxLocal=Math.max(maxLocal,Math.abs(a[i+k]));maxErr=Math.max(maxErr,Math.abs(s[k]-(src.positions[i+k]+c.origine[k])));}n++;}}
    return {maxLocal,maxErr,n,noeuds:pc.visibleNodes.length,coinMin,coinMax};});
  assert.equal(r.erreur,undefined,r.erreur);assert.ok(r.n>0&&r.noeuds>0,'des points');
  assert.ok(r.maxLocal<64,`positions locales au nœud (max ${r.maxLocal} m)`);
  assert.ok(r.coinMin>=0&&r.coinMax<1e-3,`chaque nœud a son coin de boîte pour origine (min des positions entre 0 et 1 mm : ${r.coinMin}…${r.coinMax})`);
  assert.ok(r.maxErr<2e-6,`scène reconstituée au micron (erreur max ${r.maxErr} m)`);
});
test('aucune erreur de page pendant les essais',opts,()=>{assert.deepEqual(env.erreurs,[]);});

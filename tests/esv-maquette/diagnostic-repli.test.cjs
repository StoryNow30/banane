'use strict';
/* CH-049-A — diagnostic du repli « stabilité » (adapter-page.js, attendreChargement). Quatre entiers par lecture (ch, tc, gm, at) rejoignent
 * `diag` ; la décision de fin d'attente n'en lit aucun. Ce que cet essai PROUVE sur la maquette : (1) la lecture est celle d'avant (mêmes points
 * que le corpus, mêmes attentes réussies) ; (2) l'événement `capture-read` porte les quatre entiers, cohérents entre eux ; (3) leur poids est
 * négligeable. Ne prouve rien sur le vrai ESV.
 *   CHROMIUM=/opt/pw-browsers/chromium node --test --test-timeout=120000 tests/esv-maquette/diagnostic-repli.test.cjs */
const {test,before,after}=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
const N=require('./navigateur.cjs');
const raison=N.indisponible(),opts=raison?{skip:raison}:{};
const corpus=JSON.parse(fs.readFileSync(path.join(N.racine,'tests/corpus/banane-lidar-part-23-cut-2855-1788941885642.json'),'utf8'));
let env=null,lectures=[],donnee=null;
before(async()=>{if(raison)return;env=await N.ouvrir({maquette:{cuts:8,latence:30}});await env.injecter();
  await env.page.evaluate(()=>{window.BananeSettings.pilote.modeRapide='toujours';});   /* lecture rapide : l'attente passe par attendreChargement */
  const s=(await env.appel('state')).result,c=await env.appel('capture',[s]);assert.equal(c.error,undefined,c.error);donnee=c.result;
  lectures=(await env.messages('banane3:progress')).filter(m=>m.stage==='capture-read');});
after(async()=>{if(env)await env.fermer();});
test('(1) la lecture est inchangée : mêmes points que le corpus, une lecture réussie par rail',opts,()=>{
  assert.equal(donnee.status,'complete-loaded-roi');
  assert.equal(donnee.pointsSceneRelative.length,corpus.pointsSceneRelative.length);
  assert.deepEqual(donnee.quality.perRail,corpus.quality.perRail);
  assert.equal(donnee.readStrategy.attempts.filter(a=>a.status==='captured').length,2);
});
test('(2) chaque lecture au signal ou au repli porte ch, tc, gm, at, entiers et cohérents',opts,()=>{
  const avecAttente=lectures.filter(m=>m.detail?.diag&&m.detail.diag.m!=='hors-signal');
  assert.equal(avecAttente.length,2,'une lecture par rail, avec attente sur signal');
  for(const m of avecAttente){const d=m.detail.diag;
    for(const k of ['ch','tc','gm','at'])assert.ok(Number.isInteger(d[k])&&d[k]>=0,`${k} entier positif : ${d[k]}`);
    assert.ok(d.tc<=d.at,'le dernier changement précède la fin de l\'attente');
    assert.ok(d.gm<=d.tc||d.ch===0,'un silence qui précède un changement tient dans le temps écoulé jusqu\'au dernier');
    assert.equal(d.ch===0,d.tc===0&&d.gm===0,'sans changement, ni instant ni silence');
    /* CH-084 (D-315) : repli court allumé, sortie à 600 ms (rc:1) seulement si aucun nœud n'a changé ; sinon 800 ms comme avant. */
    if(m.detail.regle==='stabilite'&&d.rc===1){assert.equal(d.ch,0,'repli court : aucun changement');assert.ok(d.at>=600-50,'repli court : 600 ms sans changement');}
    else if(m.detail.regle==='stabilite')assert.ok(d.at-d.tc>=Number(process.env.STABILITE_MS||800)-50,'au repli, 800 ms sans changement après le dernier');}
});
test('(3) coût négligeable : quatre entiers, moins de 40 octets par lecture',opts,()=>{
  const avec=lectures.filter(x=>x.detail?.diag?.at!==undefined);assert.ok(avec.length>=2,'les lectures portent le diagnostic');
  for(const m of avec){const d=m.detail.diag;
    assert.ok(JSON.stringify({ch:d.ch,tc:d.tc,gm:d.gm,at:d.at}).length<=40,'poids du diagnostic');}
});
test('(2 bis) compteur d\'ESV bloqué : repli à 800 ms, un nœud tardif est compté (ch=1, tc≈300, gm≈300)',opts,async()=>{
  const avant=lectures.length;
  await env.page.evaluate(()=>{const pc=window.viewer.scene.pointclouds[0];window.__sauve=pc.visibleNodes.slice();
    Object.defineProperty(window.Potree,'numNodesLoading',{configurable:true,get:()=>1,set:()=>{}});
    setTimeout(()=>{pc.visibleNodes.push(pc.visibleNodes[0]);},300);});
  const s=(await env.appel('state')).result,c=await env.appel('capture',[s]);
  await env.page.evaluate(()=>{const pc=window.viewer.scene.pointclouds[0];pc.visibleNodes.length=0;pc.visibleNodes.push(...window.__sauve);delete window.Potree.numNodesLoading;window.Potree.numNodesLoading=0;});
  assert.equal(c.error,undefined,c.error);
  const l=(await env.messages('banane3:progress')).filter(m=>m.stage==='capture-read').slice(avant).filter(m=>m.detail.regle==='stabilite');
  assert.ok(l.length>=1,'une lecture au repli, compteur bloqué');
  const d=l[0].detail.diag;assert.equal(d.ch,1,'un changement de nœuds');
  assert.ok(d.tc>=200&&d.tc<=700,'dernier changement vers 300 ms : '+d.tc);assert.ok(d.gm>=200&&d.gm<=700,'silence avant lui : '+d.gm);
  assert.ok(d.at-d.tc>=750,'800 ms de calme après lui : '+(d.at-d.tc));
});
test('aucune erreur de page',opts,()=>{assert.deepEqual(env.erreurs,[]);});

'use strict';
/* CH-018 : le diff proposé pour src/adapter-page.js (chantiers/CH-018/adapter-deplacement.patch) appliqué sur une COPIE, jamais sur
 * l'adaptateur du dépôt, joué sur la maquette + modèle de navigation supposé (pas ESV). Montre : éteint, rien ne change (molette sourde,
 * caméra immobile, comme aujourd'hui) ; allumé avec `clic-droit` sur une vue qui suit le glisser au bouton droit, la cible entre dans la vue,
 * la vue est remise, et le rapport porte le journal des gestes. */
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{spawnSync}=require('node:child_process');
const N=require('./navigateur.cjs');
const raison=N.indisponible(),opts=raison?{skip:raison}:{};
/* Test 25 (D-268) : le patch de CH-018 est APPLIQUÉ à src/adapter-page.js ; l'essai joue donc l'adaptateur du dépôt tel quel. */
function adaptateurPropose(){return fs.readFileSync(path.join(N.racine,'src/adapter-page.js'),'utf8');}
async function preparer(modele){
  const env=await N.ouvrir({maquette:{cuts:4,latence:10,latenceRails:0}});const {page}=env;
  const version=JSON.parse(N.lire('manifest.json')).version;
  await page.addScriptTag({content:`window.__ARIANE_PROPRIETAIRE={id:'essai',version:${JSON.stringify(version)},versionName:'essai'};window.__messages=[];`});
  const source=adaptateurPropose();
  for(const f of N.PAGE_FILES.flatMap(x=>x.endsWith('adapter-page.js')?['src/gestes-vue.js','src/deplacement-vue.js',x]:[x]))
    await page.addScriptTag({content:f.endsWith('adapter-page.js')?source:N.lire(f)});
  await page.evaluate(m=>{window.__modeleNavigation=m;},modele);
  await page.addScriptTag({content:N.lire('tests/helpers/modele-navigation.js')});
  return env;
}
async function cibleHorsVue(env){
  const s=(await env.appel('state',[])).result,L=s.rails.left.positionSceneRelative,R=s.rails.right.positionSceneRelative,d=R.map((v,i)=>v-L[i]),n=Math.hypot(...d)||1;
  return {s,cible:L.map((v,i)=>v+d[i]/n*0.21)};
}
test('déplacement éteint par le réglage de l\'appel : comportement d\'avant (molette sourde, caméra immobile)',opts,async()=>{
  const env=await preparer({molette:'mousewheel',boutonGlisser:2,facteurCran:1.1,gainGlisser:1,amortiImages:0});
  try{const {s,cible}=await cibleHorsVue(env);const r=await env.appel('amenerDansLaVue',['left',cible,s.identity,{deplacement:{actif:false}}]);
    assert.equal(r.error,undefined,r.error);assert.equal(r.result.ok,false);assert.equal(r.result.raison,'camera-immobile');
    assert.equal(r.result.gestes[0].type,'molette');assert.equal(r.result.gestes[0].deplacement,undefined);assert.equal(r.result.journalGestes,undefined);
  }finally{await env.fermer();}
});
test('déplacement allumé, clic-droit : la cible entre dans la vue, la vue est remise, le journal est dans le rapport',opts,async()=>{
  const env=await preparer({molette:'mousewheel',boutonGlisser:2,facteurCran:1.1,gainGlisser:1,amortiImages:0});
  try{const {s,cible}=await cibleHorsVue(env);
    const r=await env.appel('amenerDansLaVue',['left',cible,s.identity,{deplacement:{actif:true,geste:'clic-droit',tentativesMax:2}}]);
    assert.equal(r.error,undefined,r.error);assert.equal(r.result.ok,true,JSON.stringify(r.result));
    const g=r.result.gestes[0];assert.equal(g.type,'glisser');assert.equal(g.deplacement.geste,'clic-droit');assert.equal(g.deplacement.ok,true);
    assert.ok(Math.abs(r.result.ndcApres[0])<=0.99&&Math.abs(r.result.ndcApres[1])<=0.99);assert.equal(r.result.remise.ok,true);
    assert.equal(r.result.journalGestes.gestes['clic-droit'].mouvements,1);assert.equal(r.result.journalGestes.meilleur,'clic-droit');
    assert.deepEqual((await env.etat()).rails,(await env.etat()).rails);assert.deepEqual(env.erreurs,[]);
  }finally{await env.fermer();}
});

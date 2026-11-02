'use strict';
/* CH-038 : lot arrêté au cut 115 (4.9.5.33, 02/11) sur « Vue ESV non recentrée sur le rail right. ».
 * Rejoué sur la maquette ESV dans un vrai Chromium, avec :
 *   - le modèle de navigation SUPPOSÉ (tests/helpers/modele-navigation.js), qui suit le glisser au bouton droit (D-268, clic droit) ;
 *   - le mode `recentrage=origine` de la maquette : le bouton d'un rail ramène la vue sur la position du rail AU CHARGEMENT du cut,
 *     même après une pose. C'est le comportement SUPPOSÉ d'ESV, déduit du journal (note : chantiers/CH-038/NOTE.md).
 * La cible du rail droit est juste hors de sa vue habituelle (0,21 unité de scène, demi-vue 0,20). Le geste l'amène dans la vue,
 * le rail est posé, puis la vue est remise.
 * Adaptateur du dépôt (rouge) : la remise attend « rail dans la vue », impossible ici, et `apply` lève « Vue ESV non recentrée ».
 * Adaptateur + patch chantiers/CH-038/adaptateur-remise-vue.patch (vert) : la remise reconnaît la vue habituelle revenue, `apply`
 * rend son rapport, les deux rails sont à la cible.
 * Les attentes de la page sont raccourcies (attenteMs 1,5 s au lieu de 12 s), seulement pour la durée de l'essai.
 * Ce que l'essai ne prouve pas : ce que fait le vrai ESV (cible de son bouton, stabilité de sa caméra). */
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{spawnSync}=require('node:child_process');
const N=require('./navigateur.cjs');
const raison=N.indisponible(),opts=raison?{skip:raison}:{};
const PATCH=path.join(N.racine,'chantiers/CH-038/adaptateur-remise-vue.patch');

function adaptateur(avecPatch){
  const source=path.join(N.racine,'src/adapter-page.js');
  if(!avecPatch)return fs.readFileSync(source,'utf8');
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'ch038-'));
  fs.mkdirSync(path.join(tmp,'src'),{recursive:true});fs.copyFileSync(source,path.join(tmp,'src/adapter-page.js'));
  const r=spawnSync('git',['apply',PATCH],{cwd:tmp,encoding:'utf8'});
  if(r.status!==0)throw Error('git apply : '+(r.stderr||r.stdout));
  return fs.readFileSync(path.join(tmp,'src/adapter-page.js'),'utf8');
}
async function preparer(avecPatch,recentrage){
  const env=await N.ouvrir({maquette:{cuts:4,latence:10,latenceRails:0,recentrage}});const {page}=env;
  const version=JSON.parse(N.lire('manifest.json')).version;
  await page.addScriptTag({content:`window.__ARIANE_PROPRIETAIRE={id:'essai',version:${JSON.stringify(version)},versionName:'essai'};window.__messages=[];`});
  const source=adaptateur(avecPatch);
  for(const f of N.PAGE_FILES.flatMap(x=>x.endsWith('adapter-page.js')?['src/gestes-vue.js','src/deplacement-vue.js',x]:[x])){
    if(f.endsWith('adapter-page.js'))await page.evaluate(()=>{const S=window.BananeSettings;window.BananeSettings={...S,pilote:{...S.pilote,attenteMs:1500}};});
    await page.addScriptTag({content:f.endsWith('adapter-page.js')?source:N.lire(f)});}
  await page.evaluate(()=>{window.__modeleNavigation={molette:'mousewheel',boutonGlisser:2,facteurCran:1.1,gainGlisser:1,amortiImages:0};});
  await page.addScriptTag({content:N.lire('tests/helpers/modele-navigation.js')});
  return env;
}
/* Propositions : rail gauche inchangé, rail droit à 0,21 unité de scène vers le rail gauche (hors de sa vue habituelle). */
async function poseHorsVue(env){
  const before=(await env.appel('state',[])).result;
  const L=before.rails.left.positionSceneRelative,R=before.rails.right.positionSceneRelative,d=L.map((v,i)=>v-R[i]),n=Math.hypot(...d);
  const cible=R.map((v,i)=>v+d[i]/n*0.21);
  /* delta dans le repère du profil : inverse de profileLocalToSceneRelative appliqué au déplacement (matrice colonne, rotation seule). */
  const m=before.rails.right.profileLocalToSceneRelative,w=cible.map((v,i)=>v-R[i]);
  const col=j=>[m[j*4],m[j*4+1],m[j*4+2]],norme=j=>Math.hypot(...col(j))**2;
  const delta=[0,1,2].map(j=>col(j).reduce((a,v,i)=>a+v*w[i],0)/norme(j));
  return {before,cible,proposals:{left:{delta:[0,0,0]},right:{delta}}};
}
const PLAN={deplacerVue:{version:'deplacer-vue-v1',cotes:{right:{geste:'glissement'}},deplacement:{actif:true,geste:'clic-droit',tentativesMax:2}}};
const dist=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));

test('rouge (adaptateur du dépôt) : rail posé hors de la vue habituelle, le bouton ramène la vue d\'origine, la remise lève « Vue ESV non recentrée »',opts,async()=>{
  const env=await preparer(false,'origine');
  try{const {before,cible,proposals}=await poseHorsVue(env);
    const r=await env.appel('apply',[before,proposals,PLAN]);
    assert.match(String(r.error),/Vue ESV non recentrée sur le rail right/);
    const apres=(await env.appel('state',[])).result;
    assert.ok(dist(apres.rails.right.positionSceneRelative,cible)<=.001,'le rail droit EST posé : l\'erreur part après l\'écriture');
    assert.deepEqual(env.erreurs,[]);
  }finally{await env.fermer();}
});

test('vert (patch CH-038) : même scène, la remise reconnaît la vue habituelle revenue ; apply rend son rapport, deux rails à la cible',opts,async()=>{
  const env=await preparer(true,'origine');
  try{const {before,cible,proposals}=await poseHorsVue(env);
    const r=await env.appel('apply',[before,proposals,PLAN]);
    assert.equal(r.error,undefined,r.error);
    const rem=r.result.deplacerVue.remise;
    assert.equal(rem.ok,true,JSON.stringify(rem));assert.equal(rem.recentre,true);assert.equal(rem.vueHabituelle,true);assert.equal(rem.railDansVue,false,'le rail posé est hors de la vue habituelle');
    const g=r.result.deplacerVue.cotes.find(c=>c.cote==='right').gestes[0];assert.equal(g.type,'glisser');assert.equal(g.deplacement.geste,'clic-droit');
    assert.ok(dist(r.result.rails.right.positionSceneRelative,cible)<=.001);
    assert.ok(dist(r.result.rails.left.positionSceneRelative,before.rails.left.positionSceneRelative)<=.001,'rail gauche reposé sur place (1 mm, arrondi au pixel)');
    assert.deepEqual(env.erreurs,[]);
  }finally{await env.fermer();}
});

test('vert (patch CH-038), recentrage sur le rail (défaut de la maquette) : inchangé, la remise passe par « rail dans la vue »',opts,async()=>{
  const env=await preparer(true,'rail');
  try{const {before,cible,proposals}=await poseHorsVue(env);
    const r=await env.appel('apply',[before,proposals,PLAN]);
    assert.equal(r.error,undefined,r.error);
    const rem=r.result.deplacerVue.remise;assert.equal(rem.ok,true);assert.equal(rem.railDansVue,true);
    assert.ok(dist(r.result.rails.right.positionSceneRelative,cible)<=.001);assert.deepEqual(env.erreurs,[]);
  }finally{await env.fermer();}
});

test('vert (patch CH-038), pré-vol : sans pose, le bouton ramène la vue habituelle elle-même (remise « faite », vueHabituelle vraie)',opts,async()=>{
  const env=await preparer(true,'origine');
  try{const {before,cible}=await poseHorsVue(env);
    const r=await env.appel('amenerDansLaVue',['right',cible,before.identity,PLAN.deplacerVue]);
    assert.equal(r.error,undefined,r.error);assert.equal(r.result.ok,true,JSON.stringify(r.result));
    assert.equal(r.result.remise.vueHabituelle,true);assert.deepEqual((await env.appel('state',[])).result.rails,before.rails);
    assert.deepEqual(env.erreurs,[]);
  }finally{await env.fermer();}
});

test('vert (patch CH-038), panne simulée APRÈS écriture : le bouton ne ramène ni la vue habituelle ni le rail ; erreur claire « Vue ESV non restituée », rails posés',opts,async()=>{
  const env=await preparer(true,'ailleurs');
  try{const {before,cible,proposals}=await poseHorsVue(env);
    const r=await env.appel('apply',[before,proposals,PLAN]);
    assert.match(String(r.error),/^Vue ESV non restituée après le déplacement de vue \(échelle à 0,0 % de la vue habituelle, le bouton du rail droit n’a ramené ni la vue habituelle ni le rail dans la vue en 3 pressions\) : les deux rails sont posés, rien n’est validé/);
    const DV=require('../../src/deplacement-vue.js'),d=DV.detailRemise(null,r.error,{phase:'pose'});
    assert.equal(d.resultat,'echec','classée échec, plus « inconnu »');assert.equal(d.raison,'vue-non-restituee');
    const apres=(await env.appel('state',[])).result;assert.ok(dist(apres.rails.right.positionSceneRelative,cible)<=.001);
    assert.deepEqual(env.erreurs,[]);
  }finally{await env.fermer();}
});

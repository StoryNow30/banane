'use strict';
/* CH-007 — molette sans effet, puis glisser, sur la maquette ESV.
 * La maquette n'écoute ni la molette ni le glisser. On lui greffe le modèle de navigation supposé
 * (tests/helpers/modele-navigation.js) réglé comme une page qui n'écoute la molette qu'en `mousewheel`
 * (un `wheel` synthétique ne l'atteint pas) et qui suit le glisser au bouton gauche.
 * Ce n'est pas ESV : ça montre le geste proposé (chantiers/CH-007/propositions/deplacement-vue.patch),
 * appliqué ici sur une copie, jamais sur src/adapter-page.js. */
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{spawnSync}=require('node:child_process');
const N=require('./navigateur.cjs');
const raison=N.indisponible(),opts=raison?{skip:raison}:{};
const patch=path.join(N.racine,'chantiers/CH-007/propositions/deplacement-vue.patch');

function adaptateur(avecPatch){
  if(!avecPatch)return fs.readFileSync(path.join(N.racine,'src/adapter-page.js'),'utf8');
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'ch007-'));
  fs.mkdirSync(path.join(tmp,'src'),{recursive:true});
  fs.copyFileSync(path.join(N.racine,'src/adapter-page.js'),path.join(tmp,'src/adapter-page.js'));
  const r=spawnSync('patch',['-p1','-d',tmp,'-i',patch],{encoding:'utf8'});
  if(r.status!==0)throw Error(r.stderr||r.stdout||'patch');
  return fs.readFileSync(path.join(tmp,'src/adapter-page.js'),'utf8');
}
async function injecter(page,source){
  const version=JSON.parse(fs.readFileSync(path.join(N.racine,'manifest.json'),'utf8')).version;
  await page.addScriptTag({content:`window.__ARIANE_PROPRIETAIRE={id:'essai',version:${JSON.stringify(version)},versionName:'essai'};
    window.__messages=[];addEventListener('message',e=>{if(['banane3:releve','banane3:progress','banane4:native-event'].includes(e.data?.kind))window.__messages.push(e.data);});`});
  const fichiers=N.PAGE_FILES.flatMap(f=>f.endsWith('adapter-page.js')?['src/gestes-vue.js',f]:[f]);
  for(const f of fichiers){
    const contenu=f.endsWith('adapter-page.js')?source:fs.readFileSync(path.join(N.racine,f),'utf8');
    await page.addScriptTag({content:contenu});
  }
  await page.evaluate(()=>{window.__modeleNavigation={molette:'mousewheel',facteurCran:1.1,gainGlisser:1,amortiImages:0};});
  await page.addScriptTag({content:fs.readFileSync(path.join(N.racine,'tests/helpers/modele-navigation.js'),'utf8')});
}
function appel(page,action,args){return page.evaluate(([action,args])=>new Promise(res=>{const id='i'+Math.random();
  const f=e=>{if(e.data?.kind==='banane3:result'&&e.data.id===id){removeEventListener('message',f);res(e.data);}};addEventListener('message',f);
  postMessage({kind:'banane3:command',id,channel:'essai',proprietaire:'essai',action,args,sentAt:Date.now()},location.origin);}),[action,args]);}
/* Cible juste hors de la vue du rail gauche : +0,21 unité de scène le long de l'axe horizontal (demi-vue 0,20). */
async function cibleHorsVue(page){
  const s=(await appel(page,'state',[])).result;
  const L=s.rails.left.positionSceneRelative,R=s.rails.right.positionSceneRelative,d=R.map((v,i)=>v-L[i]),n=Math.hypot(...d)||1;
  return L.map((v,i)=>v+d[i]/n*0.21);
}

test('maquette, molette seule (mousewheel) : la caméra ne bouge pas',opts,async()=>{
  const env=await N.ouvrir({maquette:{cuts:4,latence:10,latenceRails:0}});
  try{
    await injecter(env.page,adaptateur(false));
    const avant=await env.etat(),s=(await appel(env.page,'state',[])).result;
    const cible=await cibleHorsVue(env.page);
    const r=await appel(env.page,'amenerDansLaVue',['left',cible,s.identity,{}]);
    assert.equal(r.error,undefined,r.error);
    assert.equal(r.result.ok,false);assert.equal(r.result.raison,'camera-immobile');
    assert.equal(r.result.gestes.length,1);assert.equal(r.result.gestes[0].type,'molette');assert.equal(r.result.gestes[0].camera,'immobile');
    const apres=await env.etat();
    assert.deepEqual(apres.rails,avant.rails,'aucun rail déplacé');
  }finally{await env.fermer();}
});

test('maquette, proposition : après la molette sourde, le glisser amène la cible',opts,async()=>{
  const env=await N.ouvrir({maquette:{cuts:4,latence:10,latenceRails:0}});
  try{
    await injecter(env.page,adaptateur(true));
    const s=(await appel(env.page,'state',[])).result;
    const cible=await cibleHorsVue(env.page);
    const r=await appel(env.page,'amenerDansLaVue',['left',cible,s.identity,{}]);
    assert.equal(r.error,undefined,r.error);
    assert.equal(r.result.ok,true,JSON.stringify(r.result));
    assert.equal(r.result.gestes[0].type,'molette');assert.equal(r.result.gestes[0].camera,'immobile');
    assert.equal(r.result.gestes[1].type,'glisser');
    assert.ok(Math.abs(r.result.ndcApres[0])<=0.99&&Math.abs(r.result.ndcApres[1])<=0.99,JSON.stringify(r.result.ndcApres));
    assert.equal(r.result.remise.ok,true);
    const nav=await env.page.evaluate(()=>window.__navigation);
    assert.equal(nav.crans,0,'aucun cran de mousewheel reçu');
    assert.ok(nav.glissers>=1,'le glisser a été reçu');
  }finally{await env.fermer();}
});

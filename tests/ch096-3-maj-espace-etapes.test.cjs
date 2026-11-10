'use strict';
/* CH-096, défaut 3 — `validerMajEspace` : LES ÉTAPES `maj-espace-*` SORTENT DE LA PAGE.
 * Signature `(identity,scope={},options={},progress=()=>{})`, appelée par le service worker avec deux arguments ; la page ajoute
 * `progress` en dernier (`methods[action](...args,progress)`) : il arrivait dans `options` et les étapes n'étaient jamais postées.
 * Correction : même dépaquetage que `apply` et `amenerDansLaVue`. Ce que l'action envoie à ESV et ce qu'elle rend ne changent pas.
 * Données synthétiques (tests/helpers/page.cjs). `CH096_SANS_PATCH=1` : adaptateur sans le patch (rouge). */
const {test}=require('node:test'),assert=require('node:assert/strict');
const {page}=require('./helpers/page.cjs'),A=require('./helpers/ch096.cjs');
const ADAPTATEUR=A.fichier('src/adapter-page.js'),DEPOT=require('node:path').join(A.racine,'src/adapter-page.js');
function esv({vers=null,adapter=ADAPTATEUR.chemin}={}){const f=page({adapter}),cles=[];
 const doc=f.ctx.document.dispatchEvent;
 f.ctx.document.dispatchEvent=e=>{const r=doc(e);if(vers!==null&&e.type==='keydown'&&(e.key===' '||e.code==='Space')&&e.shiftKey&&!e.ctrlKey)f.nodes.get('O2N3DCutDescription').textContent=`Cut ${vers} of part 23`;return r;};
 f.ctx.viewer.renderer.domElement.dispatchEvent=e=>{cles.push(e);return f.ctx.document.dispatchEvent(e);};
 return {f,cles};}
const etapes=f=>f.progress.map(p=>p.stage).filter(s=>String(s).startsWith('maj-espace-'));
const forme=k=>[k.type,k.key,k.code,k.shiftKey];
test('l\'adaptateur chargé porte le patch de CH-096 (sauf CH096_SANS_PATCH=1)',()=>{
 assert.ok(['porté','appliqué','écarté','retiré'].includes(ADAPTATEUR.etat),'patch : '+ADAPTATEUR.etat);assert.equal(ADAPTATEUR.avecPatch,!A.SANS);});
test('appel du service worker (identité, scope) : validation sur place, les étapes avant et après la commande sont postées',async()=>{
 const {f}=esv(),s=await f.call('state');
 await f.call('validerMajEspace',s.identity,{part:23,pageId:s.identity.pageId});
 assert.deepEqual(etapes(f),['maj-espace-before-command','maj-espace-command-returned']);
 const avant=f.progress.find(p=>p.stage==='maj-espace-before-command');assert.equal(avant.detail.identity.cut,100);});
test('ESV passe à un autre cut : l\'étape de navigation est postée aussi',async()=>{
 const {f}=esv({vers:101}),s=await f.call('state');
 await f.call('validerMajEspace',s.identity,{part:23,pageId:s.identity.pageId});
 const e=etapes(f);assert.deepEqual(e.slice(0,3),['maj-espace-before-command','maj-espace-command-returned','maj-espace-navigation-observed']);
 assert.equal(f.progress.find(p=>p.stage==='maj-espace-navigation-observed').detail.nextIdentity.cut,101);});
test('sans scope (identité seule) : les étapes sortent aussi ; avec options vides : aussi',async()=>{
 for(const args of [[],[{part:23}],[{part:23},{}],[undefined,{}]]){const {f}=esv(),s=await f.call('state');
  await f.call('validerMajEspace',s.identity,...args);
  assert.deepEqual(etapes(f),['maj-espace-before-command','maj-espace-command-returned'],JSON.stringify(args));}});
test('une option inconnue reste refusée avant l\'envoi, sans frappe',async()=>{
 const {f,cles}=esv(),s=await f.call('state');
 await assert.rejects(f.call('validerMajEspace',s.identity,{part:23},{force:true}),/option inconnue \(force\) ; rien n’a été envoyé à ESV/);
 assert.equal(cles.length,0);assert.deepEqual(etapes(f),[]);});
test('avec et sans le patch : mêmes frappes envoyées à ESV, même résultat rendu (sur place, navigation, refus)',async()=>{
 const sansHeures=x=>JSON.stringify(x,(k,v)=>/At$|Epoch$|Ms$/.test(k)?'<t>':v);
 for(const cas of [{},{vers:101},{scope:{part:24}},{scope:{pageId:'autre'}}]){const sorties=[];
  for(const adapter of [DEPOT,ADAPTATEUR.chemin]){const {f,cles}=esv({vers:cas.vers??null,adapter}),s=await f.call('state');let r;
   try{r=await f.call('validerMajEspace',s.identity,cas.scope||{part:23});}catch(e){r={erreur:e.message};}
   sorties.push(sansHeures({r,cles:cles.map(forme),clavier:f.keyboard.map(forme)}).split(s.identity.pageId).join('<page>').split(s.identity.frameId).join('<vue>'));}
  assert.equal(sorties[0],sorties[1],JSON.stringify(cas));}});

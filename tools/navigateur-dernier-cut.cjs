#!/usr/bin/env node
'use strict';
/*
 * navigateur-dernier-cut.cjs — essai, dans un vrai Chromium, de l'action
 * `validateInPlace` (4.8.6, KI-069, D-065) sur une page ESV SYNTHÉTIQUE servie à
 * l'adresse d'ESV (aucun code ni contenu d'ESV). L'adaptateur RÉEL (src/adapter-page.js)
 * est chargé dans la page, avec une scène minimale (deux rails) et de vrais
 * éléments DOM. La page simule, comme l'affirme l'opérateur (HYPOTHÈSE, à confirmer
 * sur ESV), que Ctrl+Entrée valide SANS changer de cut (le compteur « N on M
 * treated » passe de N à N+1) alors que le bouton « valider » passe à la partie
 * suivante. Le raccourci est simulé : un vrai KeyboardEvent, gestionnaire lisant
 * e.which comme celui d'ESV. Vérifié : le raccourci relayé valide le dernier cut,
 * aucun changement de partie, le bouton « valider et suivant » n'est pas cliqué.
 *
 *   node tools/navigateur-dernier-cut.cjs
 *
 * Nécessite Playwright et Chromium (PLAYWRIGHT_BROWSERS_PATH ou CHROMIUM). Hors du banc.
 */
const path=require('node:path'),fs=require('node:fs');
const root=path.join(__dirname,'..'),lire=f=>fs.readFileSync(path.join(root,f),'utf8');
function chromium(){for(const p of [process.env.PLAYWRIGHT_MODULE,'playwright','/opt/node22/lib/node_modules/playwright'].filter(Boolean)){try{return require(p).chromium;}catch{/* suivant */}}
  throw Error('Playwright introuvable (PLAYWRIGHT_MODULE=/chemin/vers/playwright).');}
function executable(){if(process.env.CHROMIUM)return process.env.CHROMIUM;const base=process.env.PLAYWRIGHT_BROWSERS_PATH||'/opt/pw-browsers';
  const d=fs.existsSync(base)?fs.readdirSync(base).find(x=>/^chromium-\d+$/.test(x)):null;return d?path.join(base,d,'chrome-linux','chrome'):undefined;}
const ESV='https://esv.lidar.altametris.xyz/rails_validation/essai-dernier-cut';
/* Page synthétique : libellé, bouton « valider » (qui passe à la partie suivante, comme au terrain),
 * compteur « N on M treated », gestionnaire clavier qui lit e.which (hypothèse : Ctrl+Entrée valide sur place). */
const PAGE=`<!doctype html><meta charset="utf-8"><title>Essai dernier cut</title>
<p id="O2N3DCutDescription">Cut 100 of part 23</p><p id="O2N3DCutShapeInfo">U50</p>
<button id="O2N3DCutValidate3DRail" title="Press ↵ to validate both rails (Load next non validated cut)">valider</button>
<button id="O2N3DCutNextInvalid3DRail">suivant</button><span id="compteur">100 on 101 treated</span>
<script>window.__clics=0;window.__touches=[];let traites=100;
document.getElementById('O2N3DCutValidate3DRail').onclick=()=>{window.__clics++;document.getElementById('O2N3DCutDescription').textContent='Cut 0 of part 24';};
document.addEventListener('keydown',e=>{window.__touches.push({type:e.type,which:e.which,ctrl:e.ctrlKey});
  if(e.ctrlKey&&e.which===13){traites++;document.getElementById('compteur').textContent=traites+' on 101 treated';}});
document.addEventListener('keyup',e=>window.__touches.push({type:e.type,which:e.which,ctrl:e.ctrlKey}));</script>`;
async function essai(){
  const navigateur=await chromium().launch({executablePath:executable(),headless:true});
  const ctx=await navigateur.newContext(),page=await ctx.newPage(),erreurs=[];page.on('pageerror',e=>erreurs.push(e.message));
  await page.route('https://esv.lidar.altametris.xyz/**',r=>r.fulfill({status:200,contentType:'text/html; charset=utf-8',body:PAGE}));
  await page.goto(ESV);
  const version=JSON.parse(lire('manifest.json')).version;
  await page.addScriptTag({content:`window.__ARIANE_PROPRIETAIRE={id:'essai',version:${JSON.stringify(version)}};`});
  for(const f of ['vendor/capture-core.js','vendor/lidar.js','src/core.js','src/settings.js','src/lod-signature.js','src/merge-clouds.js','src/native-lidar.js'])await page.addScriptTag({content:lire(f)});
  /* Scène minimale : deux rails (mêmes fixtures que les essais de l'adaptateur). */
  await page.addScriptTag({content:`(()=>{const module={exports:{}},require=()=>window.BananeCaptureCore;(()=>{${lire('tests/v242/fixtures.cjs')}})();const F=module.exports,CC=window.BananeCaptureCore;
    const left=F.rail(0,[0,0,0],0),right=F.rail(1.435,[0,0,0],0);right.children[1].children[0].geometry.attributes.position=F.buffer([[0,0,0],[0,-.035,0],[0,-.035,-.05]]);
    const root=F.object([0,0,0],'Scene');F.add(root,left);F.add(root,right);
    const camera=F.object([.2,0,0],'OrthographicCamera');camera.quaternion={x:.5,y:.5,z:.5,w:.5};camera.projectionMatrix={elements:CC.identity()};
    window.viewer={scene:{scene:root,pointclouds:[],getActiveCamera:()=>camera},renderer:{domElement:{getBoundingClientRect:()=>({left:0,top:0,width:800,height:600})}}};})();`});
  await page.addScriptTag({content:lire('src/adapter-page.js')});
  const appel=(action,args)=>page.evaluate(([action,args])=>new Promise(res=>{const id='i'+Math.random();
    const f=e=>{if(e.data?.kind==='banane3:result'&&e.data.id===id){removeEventListener('message',f);res(e.data);}};addEventListener('message',f);
    postMessage({kind:'banane3:command',id,channel:'essai',proprietaire:'essai',action,args},location.origin);}),[action,args]);
  const rEtat=await appel('state',[]);if(rEtat.error){console.error('state :',rEtat.error);await navigateur.close();process.exit(2);}const etat=rEtat.result;
  const r=await appel('validateInPlace',[etat.identity,{},{commande:'ctrl-entree'}]);
  const bilan=await page.evaluate(()=>({clics:window.__clics,touches:window.__touches,libelle:document.getElementById('O2N3DCutDescription').textContent,compteur:document.getElementById('compteur').textContent}));
  await navigateur.close();
  const e=r.result,verdicts={
    'Ctrl+Entrée relayé (keydown puis keyup, which 13, ctrl)':JSON.stringify(bilan.touches)===JSON.stringify([{type:'keydown',which:13,ctrl:true},{type:'keyup',which:13,ctrl:true}]),
    'aucun changement de partie ni de cut':bilan.libelle==='Cut 100 of part 23',
    'bouton « valider et suivant » non cliqué':bilan.clics===0,
    'validation prouvée par le compteur (100 → 101), sans navigation':!!e&&e.serverConfirmed===true&&e.navigationObserved===false&&bilan.compteur==='101 on 101 treated',
    'aucune erreur de page':erreurs.length===0};
  console.log(JSON.stringify({reponse:r.error?{erreur:r.error}:{command:e.command,serverConfirmed:e.serverConfirmed,navigationObserved:e.navigationObserved,compteurAvant:e.compteurAvant,compteurApres:e.compteurApres},bilan,erreurs,verdicts},null,1));
  process.exit(Object.values(verdicts).every(Boolean)?0:1);}
essai().catch(e=>{console.error(e);process.exit(2);});

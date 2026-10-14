#!/usr/bin/env node
'use strict';
/*
 * navigateur-retour-cut.cjs — essai, dans un vrai Chromium, de l'action `goToCut`
 * (4.9, retour à un cut, LECTURE SEULE) sur une page ESV SYNTHÉTIQUE servie à
 * l'adresse d'ESV (aucun code ni contenu d'ESV). L'adaptateur RÉEL (src/adapter-page.js)
 * est chargé dans la page, avec une scène minimale (deux rails) et de vrais éléments DOM.
 *
 * La page SIMULE ce que le banc ESV local a relevé (HYPOTHÈSES, jamais vérifiées sur le
 * vrai ESV) : une carte qui change de cut sur l'événement interne `railPairSelected`
 * (partie en texte, index = numéro du cut, index hors partie : exception), écoutée sur
 * `#globalcontainer` par la copie de jQuery exposée dans la page ; une seconde copie de
 * jQuery, non exposée, comme celle qu'ESV embarque dans son paquet ; des boutons « cut
 * précédent » / « cut suivant » ; un compteur « N on M treated ». jQuery est la copie
 * locale du poste (JQUERY=/chemin, par défaut /usr/share/javascript/jquery/jquery.min.js),
 * jamais versée au dépôt ; sans elle, un jQuery minimal simulé la remplace (dit en sortie).
 *
 * Vérifié : saut par l'événement vers un cut validé puis retour ; écouteur posé sur la
 * copie NON exposée seulement → repli pas à pas ; mauvaise cible → incertain sans
 * réémission ; double appel → une seule émission ; mauvaise partie et hors bornes → refus ;
 * dans tous les cas : aucun clic de validation, de « suivant non validé » ni de rail,
 * aucune touche, rails de la scène intacts, aucune erreur de page.
 *
 *   node tools/navigateur-retour-cut.cjs
 *
 * Nécessite Playwright et Chromium (PLAYWRIGHT_BROWSERS_PATH ou CHROMIUM). Hors du banc.
 */
const path=require('node:path'),fs=require('node:fs');
const root=path.join(__dirname,'..'),lire=f=>fs.readFileSync(path.join(root,f),'utf8');
function chromium(){for(const p of [process.env.PLAYWRIGHT_MODULE,'playwright','/opt/node22/lib/node_modules/playwright'].filter(Boolean)){try{return require(p).chromium;}catch{/* suivant */}}
  throw Error('Playwright introuvable (PLAYWRIGHT_MODULE=/chemin/vers/playwright).');}
function executable(){if(process.env.CHROMIUM)return process.env.CHROMIUM;const base=process.env.PLAYWRIGHT_BROWSERS_PATH||'/opt/pw-browsers';
  const d=fs.existsSync(base)?fs.readdirSync(base).find(x=>/^chromium-\d+$/.test(x)):null;return d?path.join(base,d,'chrome-linux','chrome'):undefined;}
const JQUERY=process.env.JQUERY||'/usr/share/javascript/jquery/jquery.min.js';
const jquery=fs.existsSync(JQUERY)?fs.readFileSync(JQUERY,'utf8'):null;
/* jQuery minimal simulé (repli seulement) : `on`, `trigger` synchrone, `_data`, `noConflict`. */
const JQ_SIMULE=`(()=>{const ev=new WeakMap(),prec={$:window.$,jQuery:window.jQuery};
  const $=s=>{const el=typeof s==='string'?document.querySelector(s):s;return {on(n,h){const m=ev.get(el)||{};(m[n]=m[n]||[]).push({handler:h});ev.set(el,m);return this;},
    trigger(n,a=[]){for(const x of (ev.get(el)||{})[n]||[])x.handler.call(el,{type:n},...a);return this;}};};
  $._data=(el,k)=>k==='events'?ev.get(el):undefined;$.fn={jquery:'simulé'};$.noConflict=()=>{window.$=prec.$;window.jQuery=prec.jQuery;return $;};window.$=window.jQuery=$;})();`;
const ESV='https://esv.lidar.altametris.xyz/rails_validation/essai-retour-cut';
/* Page synthétique : libellé, boutons, compteur, conteneur de la carte. Les écouteurs sont posés après jQuery. */
const PAGE=`<!doctype html><meta charset="utf-8"><title>Essai retour à un cut</title>
<p id="O2N3DCutDescription">Cut 100 of part 23</p><p id="O2N3DCutShapeInfo">U50</p><div id="globalcontainer"></div>
<button id="O2N3DCutValidate3DRail" title="Press ↵ to validate both rails (Load next non validated cut)">valider</button>
<button id="O2N3DCutNextInvalid3DRail">suivant non validé</button><button id="O2N3DCutLRClick">G</button><button id="O2N3DCutRRClick">D</button>
<button id="O2N3DCutPrevious3DRail">précédent</button><button id="O2N3DCutNext3DRail">suivant</button><span id="compteur">2 on 200 treated</span>`;
/* ESV simulé : état de la carte, compteurs de tout ce qui décide, écouteur de la carte. `mode` : où écoute la carte
 * ('expose' : copie de jQuery exposée ; 'paquet' : seconde copie seulement), 'faux' (index − 1), 'lent' (50 ms). */
const SIMULATEUR=mode=>`(()=>{const etat={part:23,cut:100,valides:new Set([96,97])},c=window.__compte={evenements:[],valider:0,suivantNonValide:0,rail:0,precedent:0,suivant:0,touches:0};
  const lab=document.getElementById('O2N3DCutDescription'),afficher=()=>{lab.textContent='Cut '+etat.cut+' of part '+etat.part;};
  const cliquer=(id,f)=>document.getElementById(id).addEventListener('click',f);
  cliquer('O2N3DCutValidate3DRail',()=>{c.valider++;});cliquer('O2N3DCutNextInvalid3DRail',()=>{c.suivantNonValide++;});
  cliquer('O2N3DCutLRClick',()=>{c.rail++;});cliquer('O2N3DCutRRClick',()=>{c.rail++;});
  cliquer('O2N3DCutPrevious3DRail',()=>{c.precedent++;etat.cut--;afficher();});cliquer('O2N3DCutNext3DRail',()=>{c.suivant++;etat.cut++;afficher();});
  document.addEventListener('keydown',()=>{c.touches++;});
  const ecoute=function(e,partie,index){c.evenements.push([partie,index]);
    if(typeof partie!=='string'||partie!==String(etat.part))throw Error('clé de partie inconnue (simulé)');
    if(!Number.isInteger(index)||index<0||index>=200)throw Error('index hors partie (simulé)');
    const aller=()=>{etat.cut=${JSON.stringify(mode)}.includes('faux')?index-1:index;afficher();};${JSON.stringify(mode)}.includes('lent')?setTimeout(aller,50):aller();};
  (${JSON.stringify(mode)}.includes('paquet')?window.__jqPaquet:window.$)(document.getElementById('globalcontainer')).on('railPairSelected',ecoute);
  window.__etat=etat;})();`;
async function preparer(navigateur,mode){
  const ctx=await navigateur.newContext(),page=await ctx.newPage(),erreurs=[];page.on('pageerror',e=>erreurs.push(e.message));
  await page.route('https://esv.lidar.altametris.xyz/**',r=>r.fulfill({status:200,contentType:'text/html; charset=utf-8',body:PAGE}));
  await page.goto(ESV);
  /* Deux copies : la première reste `window.$` ; la seconde (comme celle du paquet d'ESV) n'est pas exposée. */
  await page.addScriptTag({content:jquery||JQ_SIMULE});await page.addScriptTag({content:jquery||JQ_SIMULE});
  await page.evaluate(()=>{window.__jqPaquet=window.jQuery.noConflict(true);});
  await page.addScriptTag({content:SIMULATEUR(mode)});
  const version=JSON.parse(lire('manifest.json')).version;
  await page.addScriptTag({content:`window.__ARIANE_PROPRIETAIRE={id:'essai',version:${JSON.stringify(version)}};`});
  for(const f of ['vendor/capture-core.js','vendor/lidar.js','src/core.js','src/settings.js','src/lod-signature.js','src/merge-clouds.js','src/native-lidar.js'])await page.addScriptTag({content:lire(f)});
  /* Scène minimale : deux rails (mêmes fixtures que les essais de l'adaptateur). */
  await page.addScriptTag({content:`(()=>{const module={exports:{}},require=()=>window.BananeCaptureCore;(()=>{${lire('tests/v242/fixtures.cjs')}})();const F=module.exports,CC=window.BananeCaptureCore;
    const left=F.rail(0,[0,0,0],0),right=F.rail(1.435,[0,0,0],0);right.children[1].children[0].geometry.attributes.position=F.buffer([[0,0,0],[0,-.035,0],[0,-.035,-.05]]);
    const root=F.object([0,0,0],'Scene');F.add(root,left);F.add(root,right);
    const camera=F.object([.2,0,0],'OrthographicCamera');camera.quaternion={x:.5,y:.5,z:.5,w:.5};camera.projectionMatrix={elements:CC.identity()};
    window.__rails=()=>JSON.stringify([left.position,right.position,left.quaternion,right.quaternion]);
    window.viewer={scene:{scene:root,pointclouds:[],getActiveCamera:()=>camera},renderer:{domElement:{getBoundingClientRect:()=>({left:0,top:0,width:800,height:600})}}};})();`});
  await page.addScriptTag({content:lire('src/adapter-page.js')});
  const railsAvant=await page.evaluate(()=>window.__rails());
  const appel=(action,args,id='i'+Math.random())=>page.evaluate(([action,args,id])=>new Promise(res=>{
    const f=e=>{if(e.data?.kind==='banane3:result'&&e.data.id===id){removeEventListener('message',f);res(e.data);}};addEventListener('message',f);
    postMessage({kind:'banane3:command',id,channel:'essai',proprietaire:'essai',action,args},location.origin);}),[action,args,id]);
  const bilan=async()=>page.evaluate(()=>({...window.__compte,libelle:document.getElementById('O2N3DCutDescription').textContent,rails:window.__rails()}));
  return {page,appel,bilan,erreurs,railsAvant};}
const resume=r=>r.error?{erreur:r.error}:{resultat:r.result.resultat,code:r.result.refusal?.code??null,chemin:r.result.chemin,emissions:r.result.emissions,
  avant:r.result.identiteAvant,apres:r.result.identiteApres,evenement:r.result.cheminEvenement?.raison??(r.result.cheminEvenement?.disponible?'disponible':null)};
async function essai(){
  const navigateur=await chromium().launch({executablePath:executable(),headless:true}),sorties={},verdicts={};
  const intact=(b,s)=>b.valider===0&&b.suivantNonValide===0&&b.rail===0&&b.touches===0&&b.rails===s.railsAvant;
  try{
    /* 1. Événement, écouteur sur la copie exposée : cut validé 97, puis retour au 100 ; mauvaise partie ; hors bornes. */
    let s=await preparer(navigateur,'expose');
    const a=await s.appel('goToCut',[{part:23,cut:97}]),b=await s.appel('goToCut',[{part:23,cut:100}]);
    const c=await s.appel('goToCut',[{part:24,cut:97}]),d=await s.appel('goToCut',[{part:23,cut:200}]);let n=await s.bilan();
    sorties.evenement={aller:resume(a),retour:resume(b),autrePartie:resume(c),horsBornes:resume(d),bilan:n,erreurs:s.erreurs};
    verdicts['événement : cut validé 97 atteint et confirmé, une émission, partie en texte']=a.result?.resultat==='confirme'&&a.result.chemin==='evenement'&&a.result.emissions===1&&JSON.stringify(n.evenements[0])==='["23",97]';
    verdicts['retour au cut de départ (100) confirmé']=b.result?.resultat==='confirme'&&n.libelle==='Cut 100 of part 23';
    verdicts['mauvaise partie et hors bornes : refus, rien émis']=c.result?.refusal?.code==='WRONG_PART'&&d.result?.refusal?.code==='OUT_OF_BOUNDS'&&n.evenements.length===2;
    verdicts['événement : ni validation, ni rail, ni touche ; rails intacts ; pas de pas à pas']=intact(n,s)&&n.precedent===0&&n.suivant===0&&s.erreurs.length===0;
    /* 2. Écouteur sur la seconde copie seulement (non exposée) : invisible pour window.$, repli pas à pas. */
    s=await preparer(navigateur,'paquet');const e=await s.appel('goToCut',[{part:23,cut:98}]);n=await s.bilan();
    sorties.paquet={aller:resume(e),bilan:n,erreurs:s.erreurs};
    verdicts['écouteur sur la copie non exposée : repli pas à pas (2 clics), confirmé, aucun événement']=e.result?.resultat==='confirme'&&e.result.chemin==='pas-a-pas'&&e.result.cheminEvenement?.raison==='sans-ecouteur'&&n.precedent===2&&n.evenements.length===0&&intact(n,s)&&s.erreurs.length===0;
    /* 3. Mauvaise cible atteinte : incertain, une seule émission, aucun repli. */
    s=await preparer(navigateur,'expose faux');const f=await s.appel('goToCut',[{part:23,cut:97}]);n=await s.bilan();
    sorties.faux={aller:resume(f),bilan:n,erreurs:s.erreurs};
    verdicts['mauvaise cible : incertain, pause explicite, une émission, aucun pas']=f.result?.resultat==='incertain'&&f.result.refusal?.code==='WRONG_TARGET_REACHED'&&f.result.pauseExplicite===true&&n.evenements.length===1&&n.precedent===0&&intact(n,s);
    /* 4. Double appel pendant un chargement lent : une seule émission. */
    s=await preparer(navigateur,'expose lent');
    const [g,h]=await Promise.all([s.appel('goToCut',[{part:23,cut:97}],'d1'),s.appel('goToCut',[{part:23,cut:98}],'d2')]);n=await s.bilan();
    sorties.double={premier:resume(g),second:resume(h),bilan:n,erreurs:s.erreurs};
    verdicts['double appel : une seule émission, le second refusé']=[g,h].filter(x=>x.result?.resultat==='confirme').length===1&&[g,h].filter(x=>x.result?.refusal?.code==='ALREADY_RUNNING').length===1&&n.evenements.length===1&&intact(n,s);
  }finally{await navigateur.close();}
  console.log(JSON.stringify({jquery:jquery?`copie locale du poste (${JQUERY})`:'simulé (aucune copie locale)',sorties,verdicts},null,1));
  process.exit(Object.values(verdicts).every(Boolean)?0:1);}
essai().catch(e=>{console.error(e);process.exit(2);});

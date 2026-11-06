#!/usr/bin/env node
'use strict';
/* CH-064 : banc de TEMPS et de MÉMOIRE dans Chromium (référence), machine au repos, sur les nuages réels.
 *   node --max-old-space-size=6000 tools/ch064-banc-temps.cjs [--nuages N] [--rep R] [--json SORTIE]
 * Pour chaque module porté à façade (V4.6 proposeBoth, GCV1 propose au lab d'exécution, calibrate) et chaque nuage,
 * R répétitions à chaud (échauffement exclu), médianes par nuage puis médiane et p95 des nuages :
 *   js      : le module JS d'origine ;
 *   facade  : la façade complète (sous-ensemble, encodage VBA, traversée, calcul Rust, décodage) ;
 *   encoder : encodage VBA de l'entrée seul ;   coeur : appel du cœur sur la trame déjà encodée (copie comprise) ;
 *   decoder : décodage de la sortie seul.
 * Mémoire : haute eau de la mémoire linéaire WASM ; tas JS de la page (performance.memory) avant et après. */
const fs=require('node:fs'),path=require('node:path'),{construire}=require('./ch064-construire.cjs'),{nuages}=require('./ch064-nuages.cjs');
const RACINE=path.resolve(__dirname,'..');
async function main(){
 const a=process.argv.slice(2),arg=k=>a.includes(k)?a[a.indexOf(k)+1]:null,N=Number(arg('--nuages')||200),R=Number(arg('--rep')||5);
 const w=construire({silencieux:true});const {chromium}=require('playwright'),b=await chromium.launch({args:['--enable-precise-memory-info']});const p=await b.newPage();
 for(const s of ['vendor/capture-core.js','src/geometry.js'])await p.addScriptTag({content:fs.readFileSync(path.join(RACINE,s),'utf8')});
 await p.evaluate(()=>{window.V46=window.BananeGeometry3;});
 for(const s of ['src/geometry-candidate-v1.js','src/placement-convention.js','ariane-rs/coquille/vba.js','ariane-rs/coquille/coeur.js','ariane-rs/coquille/facade-geometrie.js','ariane-rs/coquille/facade-gcv1.js','ariane-rs/coquille/facade-convention.js'])
  await p.addScriptTag({content:fs.readFileSync(path.join(RACINE,s),'utf8')});
 const ua=await p.evaluate(b64=>{const o=Uint8Array.from(atob(b64),c=>c.charCodeAt(0));window.coeur=ArianeCoeur.creer(o);
  window.F={v46:ArianeFacadeGeometrie.creer(coeur,V46),gcv1:ArianeFacadeGcv1.creer(coeur,BananeGeometry3),conv:ArianeFacadeConvention.creer(coeur,BananePlacementConvention)};
  window.mes={};window.tas0=performance.memory.usedJSHeapSize;return navigator.userAgent.match(/Chrome\/[\d.]+/)[0];},fs.readFileSync(w).toString('base64'));
 let n=0;
 for(const c of nuages(N)){n++;
  await p.evaluate(([c,R])=>{
   const med=a=>{const s=a.slice().sort((x,y)=>x-y);return s[s.length>>1];};
   const t=(f)=>{f();const v=[];for(let i=0;i<R;i++){const t0=performance.now();f();v.push(performance.now()-t0);}return med(v);};
   const note=(k,x)=>{(mes[k]=mes[k]||[]).push(x);};
   // V4.6 proposeBoth
   const sous=ArianeFacadeGeometrie.sousEnsemble(c),entree={capture:sous,options:{...V46.DEFAULTS}};
   note('v46.js',t(()=>V46.proposeBoth(c,{...V46.DEFAULTS})));note('v46.facade',t(()=>F.v46.proposeBoth(c,{...V46.DEFAULTS})));
   const trame=ArianeVba.encoder(entree);note('v46.encoder',t(()=>ArianeVba.encoder(entree)));
   note('v46.coeur',t(()=>{const r=coeur.appelerOctets(20,trame);r.liberer();}));
   const r=coeur.appelerOctets(20,trame),sortie=r.octets.slice();r.liberer();note('v46.decoder',t(()=>ArianeVba.decoder(sortie)));
   note('v46.octetsEntree',trame.length);note('v46.octetsSortie',sortie.length);
   // GCV1 propose, lab d'exécution (lot-decision)
   const lab=()=>({lab:{uSeeds:[0.004],replaceOrigin:false,recenterWindow:true,partialFaceKeep:true,onCoarse(){}}});
   note('gcv1.js',t(()=>BananeGeometry3.propose(c,'left',lab())));note('gcv1.facade',t(()=>F.gcv1.propose(c,'left',lab())));
   // calibrate au delta publié par V4.6
   const d=V46.proposeBoth(c).left.delta||[0,.01,.002];
   note('calibrate.js',t(()=>BananePlacementConvention.calibrate(c,'left',d)));note('calibrate.facade',t(()=>F.conv.calibrate(c,'left',d)));
   note('points',c.pointsSceneRelative.length);
  },[c,R]);
 }
 const r=await p.evaluate(()=>{const q=(a,x)=>{const s=a.slice().sort((u,v)=>u-v);return Math.round(s[Math.min(s.length-1,Math.floor(x*s.length))]*1000)/1000;};
  const o={};for(const k in mes)o[k]={mediane:q(mes[k],.5),p95:q(mes[k],.95),n:mes[k].length};
  return {mesures:o,memoireCoeur:coeur.etat(),tasJsAvantOctets:tas0,tasJsApresOctets:performance.memory.usedJSHeapSize};});
 await b.close();
 const out={format:'ch064-banc-temps-v1',navigateur:ua,nuages:n,repetitions:R,unite:'ms par appel (médiane des nuages de la médiane des répétitions)',...r};
 const s=JSON.stringify(out,null,1);if(arg('--json'))fs.writeFileSync(arg('--json'),s+'\n');console.log(s);
}
main().catch(e=>{console.error(e);process.exit(1);});

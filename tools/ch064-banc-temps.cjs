#!/usr/bin/env node
'use strict';
/* CH-064 : banc de TEMPS et de MÉMOIRE dans Chromium (référence), machine au repos, sur les nuages réels.
 *   node --max-old-space-size=6000 tools/ch064-banc-temps.cjs [--nuages N] [--rep R] [--json SORTIE]
 * Pour chaque module porté à façade (V4.6 proposeBoth, GCV1 propose au lab d'exécution, calibrate) et chaque nuage,
 * R répétitions à chaud (échauffement exclu), médianes par nuage puis médiane et p95 des nuages :
 *   js      : le module JS d'origine ;
 *   facade  : la façade complète (sous-ensemble, encodage VBA, traversée, calcul Rust, décodage) ;
 *   encoder : encodage VBA de l'entrée seul ;   coeur : appel du cœur sur la trame déjà encodée (copie comprise) ;
 *   decoder : décodage de la sortie seul ;
 *   v46.elague : la variante « JS élagué » de CH-061 (chantiers/CH-061/bancs/noyaux.js, branche chantier/CH-061, lue par
 *             git show, fabriquée en mémoire : src/ n'est pas modifié), parité vérifiée contre le JS sur chaque nuage ;
 *   gcv1.elague : GCV1 avec les patchs geometrie-elaguee-lot et mediane-exacte de CH-065 (branche chantier/CH-065, lus par
 *             git show, appliqués sur une copie temporaire : src/ n'est pas modifié), identité vérifiée sur chaque nuage
 *             (trames VBA octet pour octet) ;
 *   capture.point, jauge.assessPair : appel par appel, JS contre cœur (coût de la traversée).
 * --seulement gcv1 : seulement les lignes GCV1 (JS, élagué, façade), sans la mesure de mémoire.
 * Mémoire de A : réinstanciation au-delà d'un seuil après la capture de 500 000 points, RSS des processus de rendu
 * avant, après l'appel, après réinstanciation et ramasse-miettes (--expose-gc).
 * Mémoire : haute eau de la mémoire linéaire WASM ; tas JS de la page (performance.memory) avant et après. */
const fs=require('node:fs'),path=require('node:path'),{construire}=require('./ch064-construire.cjs'),{nuages}=require('./ch064-nuages.cjs');
const RACINE=path.resolve(__dirname,'..'),{execFileSync}=require('node:child_process');
/* GCV1 élagué de CH-065 : les deux patchs appliqués dans l'ordre sur une copie de src/geometry-candidate-v1.js. */
function gcv1Elague(){const os=require('node:os'),d=fs.mkdtempSync(path.join(os.tmpdir(),'ch064-gcv1-'));
 try{fs.mkdirSync(path.join(d,'src'));fs.copyFileSync(path.join(RACINE,'src/geometry-candidate-v1.js'),path.join(d,'src/geometry-candidate-v1.js'));
  for(const nom of ['geometrie-elaguee-lot','mediane-exacte']){const f=path.join(d,nom+'.patch');
   fs.writeFileSync(f,execFileSync('git',['show','origin/chantier/CH-065:chantiers/CH-065/'+nom+'.patch'],{cwd:RACINE}));execFileSync('git',['apply',f],{cwd:d});}
  return fs.readFileSync(path.join(d,'src/geometry-candidate-v1.js'),'utf8');}finally{fs.rmSync(d,{recursive:true,force:true});}}
const NOYAUX=()=>execFileSync('git',['show','origin/chantier/CH-061:chantiers/CH-061/bancs/noyaux.js'],{cwd:RACINE,encoding:'utf8'});
function rssRendu(pid){const pp=new Map(),rss=new Map(),cmd=new Map();for(const p of fs.readdirSync('/proc').filter(x=>/^\d+$/.test(x))){try{const st=fs.readFileSync('/proc/'+p+'/status','utf8');
  pp.set(p,(st.match(/PPid:\s+(\d+)/)||[])[1]);rss.set(p,Number((st.match(/VmRSS:\s+(\d+)/)||[0,0])[1]));cmd.set(p,fs.readFileSync('/proc/'+p+'/cmdline','utf8'));}catch{}}
 const g=new Set([String(pid)]);let c=true;while(c){c=false;for(const [p,q] of pp)if(!g.has(p)&&g.has(q)){g.add(p);c=true;}}
 let ko=0;for(const p of g)if(cmd.get(p)?.includes('--type=renderer'))ko+=rss.get(p)||0;return ko;}
async function main(){
 const a=process.argv.slice(2),arg=k=>a.includes(k)?a[a.indexOf(k)+1]:null,N=Number(arg('--nuages')||200),R=Number(arg('--rep')||5),seul=arg('--seulement');
 const w=construire({silencieux:true});const {chromium}=require('playwright'),b=await chromium.launch({args:['--enable-precise-memory-info','--js-flags=--expose-gc','--ch064-banc-temps='+process.pid]});const p=await b.newPage();
 for(const s of ['vendor/capture-core.js','src/geometry.js'])await p.addScriptTag({content:fs.readFileSync(path.join(RACINE,s),'utf8')});
 await p.evaluate(()=>{window.V46=window.BananeGeometry3;});
 const N61=NOYAUX();await p.addScriptTag({content:N61});
 const N61mod=(()=>{const m={exports:{}};new Function('module',N61)(m);return m.exports;})();
 await p.addScriptTag({content:N61mod.variante(fs.readFileSync(path.join(RACINE,'src/geometry.js'),'utf8'),'js-elague')});
 await p.evaluate(()=>{window.V46elague=window.BananeGeometry3;window.__CH061_NOYAU={search:CH061Noyaux.jsElague()};});
 for(const s of ['src/geometry-candidate-v1.js','src/placement-convention.js','ariane-rs/coquille/vba.js','ariane-rs/coquille/coeur.js','ariane-rs/coquille/facade-geometrie.js','ariane-rs/coquille/facade-gcv1.js','ariane-rs/coquille/facade-convention.js'])
  await p.addScriptTag({content:fs.readFileSync(path.join(RACINE,s),'utf8')});
 /* GCV1 élagué chargé sur la même base que GCV1 (capture-core), puis BananeGeometry3 rendu au GCV1 du tronc */
 await p.evaluate(()=>{window.GCV1=window.BananeGeometry3;});await p.addScriptTag({content:gcv1Elague()});
 await p.evaluate(()=>{window.GCV1elague=window.BananeGeometry3;window.BananeGeometry3=window.GCV1;});
 const ua=await p.evaluate(b64=>{const o=Uint8Array.from(atob(b64),c=>c.charCodeAt(0));window.coeur=ArianeCoeur.creer(o);
  window.F={v46:ArianeFacadeGeometrie.creer(coeur,V46),gcv1:ArianeFacadeGcv1.creer(coeur,BananeGeometry3),conv:ArianeFacadeConvention.creer(coeur,BananePlacementConvention)};
  window.mes={};window.tas0=performance.memory.usedJSHeapSize;return navigator.userAgent.match(/Chrome\/[\d.]+/)[0];},fs.readFileSync(w).toString('base64'));
 let n=0;
 for(const c of nuages(N)){n++;
  await p.evaluate(([c,R,seul])=>{
   const med=a=>{const s=a.slice().sort((x,y)=>x-y);return s[s.length>>1];};
   const t=(f)=>{f();const v=[];for(let i=0;i<R;i++){const t0=performance.now();f();v.push(performance.now()-t0);}return med(v);};
   const note=(k,x)=>{(mes[k]=mes[k]||[]).push(x);};
   const lab=()=>({lab:{uSeeds:[0.004],replaceOrigin:false,recenterWindow:true,partialFaceKeep:true,onCoarse(){}}});
   /* une fonction (le rappel onCoarse du lab, rendu dans la sortie) devient une marque : la VBA ne transporte pas les fonctions */
   const sansFn=v=>typeof v==='function'?'\u0000fonction':Array.isArray(v)?(()=>{const r=new Array(v.length);for(let i=0;i<v.length;i++)if(i in v)r[i]=sansFn(v[i]);return r;})():v&&typeof v==='object'?Object.fromEntries(Object.keys(v).map(k=>[k,sansFn(v[k])])):v;
   const memes=(a,b)=>{const x=ArianeVba.encoder(sansFn(a)),y=ArianeVba.encoder(sansFn(b));if(x.length!==y.length)return 0;for(let i=0;i<x.length;i++)if(x[i]!==y[i])return 0;return 1;};
   note('gcv1.elagueIdentique',memes(GCV1.propose(c,'left',lab()),GCV1elague.propose(c,'left',lab())));
   note('gcv1.elague',t(()=>GCV1elague.propose(c,'left',lab())));
   if(seul==='gcv1'){note('gcv1.js',t(()=>BananeGeometry3.propose(c,'left',lab())));note('gcv1.facade',t(()=>F.gcv1.propose(c,'left',lab())));return;}
   // V4.6 proposeBoth
   const sous=ArianeFacadeGeometrie.sousEnsemble(c),entree={capture:sous,options:{...V46.DEFAULTS}};
   note('v46.js',t(()=>V46.proposeBoth(c,{...V46.DEFAULTS})));note('v46.elague',t(()=>V46elague.proposeBoth(c,{...V46.DEFAULTS})));
   {const a=V46.proposeBoth(c,{...V46.DEFAULTS}),b=V46elague.proposeBoth(c,{...V46.DEFAULTS});note('v46.elagueIdentique',JSON.stringify(a)===JSON.stringify(b)?1:0);}note('v46.facade',t(()=>F.v46.proposeBoth(c,{...V46.DEFAULTS})));
   const trame=ArianeVba.encoder(entree);note('v46.encoder',t(()=>ArianeVba.encoder(entree)));
   note('v46.coeur',t(()=>{const r=coeur.appelerOctets(20,trame);r.liberer();}));
   const r=coeur.appelerOctets(20,trame),sortie=r.octets.slice();r.liberer();note('v46.decoder',t(()=>ArianeVba.decoder(sortie)));
   note('v46.octetsEntree',trame.length);note('v46.octetsSortie',sortie.length);
   // GCV1 propose, lab d'exécution (lot-decision)
   note('gcv1.js',t(()=>BananeGeometry3.propose(c,'left',lab())));note('gcv1.facade',t(()=>F.gcv1.propose(c,'left',lab())));
   // calibrate au delta publié par V4.6
   const d=V46.proposeBoth(c).left.delta||[0,.01,.002];
   note('calibrate.js',t(()=>BananePlacementConvention.calibrate(c,'left',d)));note('calibrate.facade',t(()=>F.conv.calibrate(c,'left',d)));
   // appel par appel : un point, un rapport de paire
   const m=c.rails.left.sceneRelativeToProfileLocal,pt=c.pointsSceneRelative[0];
   note('capture.point.js.mille',t(()=>{for(let k=0;k<1000;k++)BananeCaptureCore.point(m,pt);}));note('capture.point.coeur.mille',t(()=>{for(let k=0;k<1000;k++)coeur.appeler(10,{f:'point',a:[m,pt]});}));
   note('points',c.pointsSceneRelative.length);
  },[c,R,seul]);
 }
 const mem={};if(seul!=='gcv1'){
 // mémoire de A : capture de 500 000 points, puis réinstanciation
 const navPid=fs.readdirSync('/proc').filter(x=>/^\d+$/.test(x)).find(x=>{try{const c=fs.readFileSync('/proc/'+x+'/cmdline','utf8');return c.includes('--ch064-banc-temps='+process.pid)&&!c.includes('--type=');}catch{return false;}});mem.avantKo=rssRendu(navPid);
 await p.evaluate(()=>{window.grand=null;});
 for(const c of nuages(120)){await p.evaluate(c=>{(window.__pts=window.__pts||[]).push(...c.pointsSceneRelative);window.__base=window.__base||c;},c);if(await p.evaluate(()=>__pts.length>=500000))break;}
 mem.wasmAvant=await p.evaluate(()=>coeur.memoireOctets());
 await p.evaluate(()=>{const g={...__base,pointsSceneRelative:__pts.slice(0,500000),visibleByClipBoxes:undefined};F.v46.proposeBoth(g);window.__pts=null;window.__base=null;gc();});
 mem.wasmApres=await p.evaluate(()=>coeur.memoireOctets());mem.apresAppelKo=rssRendu(navPid);
 await p.evaluate(()=>{window.coeur2=ArianeCoeur.creer(coeur.module,{seuilReinstanciation:8*1024*1024});coeur.apresAppel();});
 // la coquille réinstancie quand la mémoire dépasse le seuil : on remplace l'instance par une neuve et on libère l'ancienne
 await p.evaluate(()=>{window.coeur=coeur2;window.F={v46:ArianeFacadeGeometrie.creer(coeur2,V46),gcv1:ArianeFacadeGcv1.creer(coeur2,BananeGeometry3),conv:ArianeFacadeConvention.creer(coeur2,BananePlacementConvention)};gc();gc();});await new Promise(r=>setTimeout(r,500));
 mem.wasmApresReinstanciation=await p.evaluate(()=>coeur.memoireOctets());mem.apresReinstanciationKo=rssRendu(navPid);}
 const r=await p.evaluate(()=>{const q=(a,x)=>{const s=a.slice().sort((u,v)=>u-v);return Math.round(s[Math.min(s.length-1,Math.floor(x*s.length))]*1000)/1000;};
  const o={};for(const k in mes)o[k]={mediane:q(mes[k],.5),p95:q(mes[k],.95),n:mes[k].length,...(/Identique$/.test(k)?{somme:mes[k].reduce((s,x)=>s+x,0)}:{})};
  return {mesures:o,memoireCoeur:coeur.etat(),tasJsAvantOctets:tas0,tasJsApresOctets:performance.memory.usedJSHeapSize};});
 await b.close();
 const out={format:'ch064-banc-temps-v1',navigateur:ua,nuages:n,repetitions:R,unite:'ms par appel (médiane des nuages de la médiane des répétitions)',...r,memoireA:mem};
 const s=JSON.stringify(out,null,1);if(arg('--json'))fs.writeFileSync(arg('--json'),s+'\n');console.log(s);
}
main().catch(e=>{console.error(e);process.exit(1);});

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
 *   capture.point, jauge.assessPair : appel par appel, JS contre cœur (coût de la traversée).
 * Mémoire de A : réinstanciation au-delà d'un seuil après la capture de 500 000 points, RSS des processus de rendu
 * avant, après l'appel, après réinstanciation et ramasse-miettes (--expose-gc).
 * Mémoire : haute eau de la mémoire linéaire WASM ; tas JS de la page (performance.memory) avant et après. */
const fs=require('node:fs'),path=require('node:path'),{construire}=require('./ch064-construire.cjs'),{nuages}=require('./ch064-nuages.cjs');
const RACINE=path.resolve(__dirname,'..'),{execFileSync}=require('node:child_process');
const NOYAUX=()=>execFileSync('git',['show','origin/chantier/CH-061:chantiers/CH-061/bancs/noyaux.js'],{cwd:RACINE,encoding:'utf8'});
function rssRendu(pid){const pp=new Map(),rss=new Map(),cmd=new Map();for(const p of fs.readdirSync('/proc').filter(x=>/^\d+$/.test(x))){try{const st=fs.readFileSync('/proc/'+p+'/status','utf8');
  pp.set(p,(st.match(/PPid:\s+(\d+)/)||[])[1]);rss.set(p,Number((st.match(/VmRSS:\s+(\d+)/)||[0,0])[1]));cmd.set(p,fs.readFileSync('/proc/'+p+'/cmdline','utf8'));}catch{}}
 const g=new Set([String(pid)]);let c=true;while(c){c=false;for(const [p,q] of pp)if(!g.has(p)&&g.has(q)){g.add(p);c=true;}}
 let ko=0;for(const p of g)if(cmd.get(p)?.includes('--type=renderer'))ko+=rss.get(p)||0;return ko;}
async function main(){
 const a=process.argv.slice(2),arg=k=>a.includes(k)?a[a.indexOf(k)+1]:null,N=Number(arg('--nuages')||200),R=Number(arg('--rep')||5);
 const w=construire({silencieux:true});const {chromium}=require('playwright'),b=await chromium.launch({args:['--enable-precise-memory-info','--js-flags=--expose-gc','--ch064-banc-temps='+process.pid]});const p=await b.newPage();
 for(const s of ['vendor/capture-core.js','src/geometry.js'])await p.addScriptTag({content:fs.readFileSync(path.join(RACINE,s),'utf8')});
 await p.evaluate(()=>{window.V46=window.BananeGeometry3;});
 const N61=NOYAUX();await p.addScriptTag({content:N61});
 const N61mod=(()=>{const m={exports:{}};new Function('module',N61)(m);return m.exports;})();
 await p.addScriptTag({content:N61mod.variante(fs.readFileSync(path.join(RACINE,'src/geometry.js'),'utf8'),'js-elague')});
 await p.evaluate(()=>{window.V46elague=window.BananeGeometry3;window.__CH061_NOYAU={search:CH061Noyaux.jsElague()};});
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
   note('v46.js',t(()=>V46.proposeBoth(c,{...V46.DEFAULTS})));note('v46.elague',t(()=>V46elague.proposeBoth(c,{...V46.DEFAULTS})));
   {const a=V46.proposeBoth(c,{...V46.DEFAULTS}),b=V46elague.proposeBoth(c,{...V46.DEFAULTS});note('v46.elagueIdentique',JSON.stringify(a)===JSON.stringify(b)?1:0);}note('v46.facade',t(()=>F.v46.proposeBoth(c,{...V46.DEFAULTS})));
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
   // appel par appel : un point, un rapport de paire
   const m=c.rails.left.sceneRelativeToProfileLocal,pt=c.pointsSceneRelative[0];
   note('capture.point.js.mille',t(()=>{for(let k=0;k<1000;k++)BananeCaptureCore.point(m,pt);}));note('capture.point.coeur.mille',t(()=>{for(let k=0;k<1000;k++)coeur.appeler(10,{f:'point',a:[m,pt]});}));
   note('points',c.pointsSceneRelative.length);
  },[c,R]);
 }
 // mémoire de A : capture de 500 000 points, puis réinstanciation
 const navPid=fs.readdirSync('/proc').filter(x=>/^\d+$/.test(x)).find(x=>{try{const c=fs.readFileSync('/proc/'+x+'/cmdline','utf8');return c.includes('--ch064-banc-temps='+process.pid)&&!c.includes('--type=');}catch{return false;}});const mem={avantKo:rssRendu(navPid)};
 await p.evaluate(()=>{window.grand=null;});
 for(const c of nuages(120)){await p.evaluate(c=>{(window.__pts=window.__pts||[]).push(...c.pointsSceneRelative);window.__base=window.__base||c;},c);if(await p.evaluate(()=>__pts.length>=500000))break;}
 mem.wasmAvant=await p.evaluate(()=>coeur.memoireOctets());
 await p.evaluate(()=>{const g={...__base,pointsSceneRelative:__pts.slice(0,500000),visibleByClipBoxes:undefined};F.v46.proposeBoth(g);window.__pts=null;window.__base=null;gc();});
 mem.wasmApres=await p.evaluate(()=>coeur.memoireOctets());mem.apresAppelKo=rssRendu(navPid);
 await p.evaluate(()=>{window.coeur2=ArianeCoeur.creer(coeur.module,{seuilReinstanciation:8*1024*1024});coeur.apresAppel();});
 // la coquille réinstancie quand la mémoire dépasse le seuil : on remplace l'instance par une neuve et on libère l'ancienne
 await p.evaluate(()=>{window.coeur=coeur2;window.F={v46:ArianeFacadeGeometrie.creer(coeur2,V46),gcv1:ArianeFacadeGcv1.creer(coeur2,BananeGeometry3),conv:ArianeFacadeConvention.creer(coeur2,BananePlacementConvention)};gc();gc();});await new Promise(r=>setTimeout(r,500));
 mem.wasmApresReinstanciation=await p.evaluate(()=>coeur.memoireOctets());mem.apresReinstanciationKo=rssRendu(navPid);
 const r=await p.evaluate(()=>{const q=(a,x)=>{const s=a.slice().sort((u,v)=>u-v);return Math.round(s[Math.min(s.length-1,Math.floor(x*s.length))]*1000)/1000;};
  const o={};for(const k in mes)o[k]={mediane:q(mes[k],.5),p95:q(mes[k],.95),n:mes[k].length};
  return {mesures:o,memoireCoeur:coeur.etat(),tasJsAvantOctets:tas0,tasJsApresOctets:performance.memory.usedJSHeapSize};});
 await b.close();
 const out={format:'ch064-banc-temps-v1',navigateur:ua,nuages:n,repetitions:R,unite:'ms par appel (médiane des nuages de la médiane des répétitions)',...r,memoireA:mem};
 const s=JSON.stringify(out,null,1);if(arg('--json'))fs.writeFileSync(arg('--json'),s+'\n');console.log(s);
}
main().catch(e=>{console.error(e);process.exit(1);});

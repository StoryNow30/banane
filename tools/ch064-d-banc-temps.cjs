#!/usr/bin/env node
'use strict';
/* CH-064-D : banc de TEMPS et de MÉMOIRE de la décision dans Chromium (/opt/pw-browsers/chromium), machine au repos, données réelles.
 *   node --max-old-space-size=12000 tools/ch064-d-banc-temps.cjs [--rep 15] [--lourds 30] [--legers 200] [--json SORTIE]
 * Postes (entrées réelles de banane-data, tools/ch064-d-reel.cjs et tools/ch064-nuages.cjs) :
 *   shadow.scientificProposeBoth (nuage complet), lotDecision.decideCut (en chaîne, science du cut en entrée),
 *   crossing.read et reglesMetier.surface (nuage), relectureOmbre.selection (partie), critere.juger, relectureOmbre.juger.
 * Par cas : R répétitions à chaud après une d'échauffement ; médiane par cas, puis médiane et P90 des cas, pour
 *   js     : le module JS du tronc ;
 *   facade : la façade WASM complète (encodage VBA, traversée, calcul Rust, décodage, repli éventuel compté).
 * Mémoire : mémoire linéaire WASM (haute eau, et après), tas JS de la page (performance.memory, --enable-precise-memory-info)
 * avant et après chaque poste. Rien n'est écrit dans le dépôt (sortie : --json, défaut ariane-rs/dist/). */
const fs=require('node:fs'),path=require('node:path'),{construire}=require('./ch064-construire.cjs');
const Vba=require('../ariane-rs/coquille/vba.js');
const RACINE=path.resolve(__dirname,'..');
const CHAINE=['vendor/capture-core.js','src/gauge.js','src/geometry.js','src/brain.js','src/geometry-brain.js','src/gcv1-shadow-bootstrap.js','src/geometry-candidate-v1.js',
 'src/placement-convention.js','src/faux-vert-ombre.js','src/hauteur-apprise.js','src/continuity-observer.js','src/level-crossing.js','src/lot-decision.js','src/gcv1-shadow.js',
 'src/regles-metier.js','src/relecture-ombre.js','src/relecture-critere.js','src/relecture-signal.js','src/garde-passe-appuis.js','src/garde-apres-differe.js',
 'ariane-rs/coquille/vba.js','ariane-rs/coquille/coeur.js','ariane-rs/coquille/facade-decision.js'];
const b64=args=>Buffer.from(Vba.encoder(args)).toString('base64');
function*postes({lourds,legers}){
 const {nuages}=require('./ch064-nuages.cjs'),S=require('../src/gcv1-shadow.js'),L=require('../src/lot-decision.js');
 const cs=[...nuages(lourds)];
 yield {poste:'shadow.scientificProposeBoth',cas:cs.map(c=>({module:'shadow',f:'scientificProposeBoth',args:b64([c])}))};
 // chaîne de décisions sur les mêmes nuages, triés par partie et cut
 const tri=cs.slice().sort((a,b)=>(a.identity.part-b.identity.part)||(a.identity.cut-b.identity.cut)),anchors=[],lot=[];
 for(const c of tri){const science=S.scientificProposeBoth(c);lot.push({module:'lotDecision',f:'decideCut',args:b64([{capture:c,science,anchors:structuredClone(anchors),Shadow:'\u0000shadow'}])});
  const d=L.decideCut({capture:c,science,anchors,Shadow:S});if(d.anchor&&d.positions)L.rememberAnchor(anchors,{identity:c.identity,positions:d.positions,stage:d.stage});}
 yield {poste:'lotDecision.decideCut',cas:lot};
 // décisions qui RELANCENT la science (reprise depuis la voie, choix, différé avec appuis) : chaînes de cuts consécutifs réels
 {const parPartie=new Map();for(const c of nuages(Number(process.env.CH064D_LOT_MAX||600))){const k=c.identity?.frameId+'|'+c.identity?.part;if(!parPartie.has(k))parPartie.set(k,[]);parPartie.get(k).push(c);}
  const rep=[],stades={};
  for(const [,l] of parPartie){l.sort((a,b)=>a.identity.cut-b.identity.cut);const an=[];
   for(const c of l){const science=S.scientificProposeBoth(c),args={capture:c,science,anchors:structuredClone(an),Shadow:'\u0000shadow'};
    const d=L.decideCut({capture:c,science,anchors:an,Shadow:S});stades[d.stage]=(stades[d.stage]||0)+1;
    if((d.stage==='window'||d.stage==='choice'||d.stage==='deferred'&&(d.anchorsUsed||[]).length)&&rep.length<lourds)rep.push({module:'lotDecision',f:'decideCut',args:b64([args])});
    if(d.anchor&&d.positions)L.rememberAnchor(an,{identity:c.identity,positions:d.positions,stage:d.stage});}}
  yield {poste:'lotDecision.decideCut (reprise)',cas:rep,stades};}
 const legersN=[...nuages(legers)];
 yield {poste:'crossing.read',cas:legersN.map(c=>{const v=c.visibleByClipBoxes,p=Array.isArray(v)?c.pointsSceneRelative.filter((_,i)=>v[i]===true):c.pointsSceneRelative;return {module:'crossing',f:'read',args:b64([{rails:c.rails,pointsSceneRelative:p}])};})};
 yield {poste:'reglesMetier.surface',cas:legersN.map(c=>({module:'reglesMetier',f:'surface',args:b64([{rails:c.rails,pointsSceneRelative:c.pointsSceneRelative,visibleByClipBoxes:c.visibleByClipBoxes}])}))};
 const R=require('./ch064-d-reel.cjs'),parF={};
 for(const c of R.cas(['relectureOmbre','critere'],{}))if(['selection','juger'].includes(c.f)){const k=c.module+'.'+c.f;(parF[k]=parF[k]||[]);if(parF[k].length<legers)parF[k].push({module:c.module,f:c.f,args:b64(c.args)});}
 for(const [k,v] of Object.entries(parF))yield {poste:k,cas:v};
}
const q=(a,p)=>{if(!a.length)return null;const s=a.slice().sort((x,y)=>x-y);return s[Math.min(s.length-1,Math.floor(p*s.length))];};
/* Option B : les mêmes cas, en trames telles que la façade les enverrait, rejouées par le programme natif (exemple banc_natif). */
const NUM={critere:50,relectureOmbre:54,reglesMetier:55,crossing:56,shadow:57,lotDecision:60};
function natif(listePostes,R){const {execFileSync}=require('node:child_process'),os=require('node:os');const morceaux=[];
 const ETAT={partialFlank:true,convention:true,plafond:false};
 listePostes.forEach((po,i)=>{for(const c of po.cas){const a=Vba.decoder(Uint8Array.from(Buffer.from(c.args,'base64')));let e;
  if(c.module==='lotDecision'){const {Shadow,...reste}=a[0];e={f:c.f,a:[reste],etat:ETAT,globaux:{}};}else if(c.module==='shadow')e={f:c.f,a,etat:ETAT};else e={f:c.f,a};
  const tr=Buffer.from(Vba.encoder(e)),h=Buffer.alloc(12);h.writeUInt32LE(i,0);h.writeUInt32LE(NUM[c.module],4);h.writeUInt32LE(tr.length,8);morceaux.push(h,tr);}});
 const f=path.join(os.tmpdir(),'ch064-d-natif-'+process.pid+'.bin');fs.writeFileSync(f,Buffer.concat(morceaux));
 execFileSync('cargo',['build','--release','-p','ariane-decision','--example','banc_natif'],{cwd:path.join(RACINE,'ariane-rs'),stdio:'ignore'});
 const r=JSON.parse(execFileSync(path.join(RACINE,'ariane-rs','target','release','examples','banc_natif'),[f,String(R)],{encoding:'utf8',maxBuffer:1<<26}));fs.unlinkSync(f);
 return Object.fromEntries([...Object.entries(r.postes).map(([i,v])=>[listePostes[i].poste,v]),['memoire',{vmRssAvantKo:r.vmRssAvantKo,vmRssKo:r.vmRssKo,vmHwmKo:r.vmHwmKo}]]);}
async function main(){
 const a=process.argv.slice(2),arg=k=>a.includes(k)?a[a.indexOf(k)+1]:null;
 const R=Number(arg('--rep')||15),lourds=Number(arg('--lourds')||30),legers=Number(arg('--legers')||200);
 const w=construire({silencieux:true}),{chromium}=require('playwright');
 const b=await chromium.launch({executablePath:process.env.CHROMIUM||'/opt/pw-browsers/chromium',args:['--enable-precise-memory-info','--js-flags=--expose-gc']});
 const sortie={format:'ch064-d-banc-temps-v1',repetitions:R,postes:{}};
 try{const p=await b.newPage();await p.goto('about:blank');
  for(const s of CHAINE)await p.addScriptTag({content:fs.readFileSync(path.join(RACINE,s),'utf8')});
  sortie.navigateur=await p.evaluate(x=>{window.coeur=ArianeCoeur.creer(Uint8Array.from(atob(x),c=>c.charCodeAt(0)));
   window.M={shadow:BananeGCV1Shadow,lotDecision:BananeLotDecision,crossing:BananeLevelCrossing,reglesMetier:BananeReglesMetier,relectureOmbre:BananeRelectureOmbre,critere:BananeRelectureCritere};
   window.F=ArianeFacadeDecision.creer(coeur,{...M,convention:BananePlacementConvention});
   window.dec=b=>{const a=ArianeVba.decoder(Uint8Array.from(atob(b),c=>c.charCodeAt(0)));for(const x of a)if(x&&typeof x==='object'&&x.Shadow==='\u0000shadow')x.Shadow=BananeGCV1Shadow;return a;};
   return navigator.userAgent.match(/Chrome\/[\d.]+/)[0];},fs.readFileSync(w).toString('base64'));
  const tous=[...postes({lourds,legers})];
  if(a.includes('--natif'))sortie.natif=natif(tous,R);
  for(const po of tous){
   const m0=await p.evaluate(()=>{if(window.gc)gc();return {tas:performance.memory.usedJSHeapSize,wasm:coeur.memoireOctets()};});
   const res={js:[],facade:[]};
   if(po.cas.length>=100){ /* poste léger : l'horloge de la page ne descend pas sous 0,1 ms ; on chronomètre un passage sur TOUS les cas, R fois,
     et on rend la moyenne par cas de chaque passage (médiane et P90 des passages). */
    const r=await p.evaluate(([cs,R])=>{const pas=(f)=>{const as=cs.map(c=>dec(c.args));const t0=performance.now();for(let i=0;i<cs.length;i++)f(cs[i],as[i]);return (performance.now()-t0)/cs.length;};
     const js=(c,a)=>M[c.module][c.f](...a),fa=(c,a)=>F[c.module][c.f](...a);pas(js);pas(fa);const o={js:[],facade:[]};
     for(let i=0;i<R;i++){o.js.push(pas(js));o.facade.push(pas(fa));}return o;},[po.cas,R]);
    res.js=r.js;res.facade=r.facade;res.mode='passages';
   }else for(const c of po.cas){
    const r=await p.evaluate(([c,R])=>{const med=v=>{const s=v.slice().sort((x,y)=>x-y);return s[s.length>>1];};
     const t=f=>{f(dec(c.args));const v=[];for(let i=0;i<R;i++){const a=dec(c.args);const t0=performance.now();f(a);v.push(performance.now()-t0);}return med(v);};
     return {js:t(a=>M[c.module][c.f](...a)),facade:t(a=>F[c.module][c.f](...a))};},[c,R]);
    res.js.push(r.js);res.facade.push(r.facade);}
   const m1=await p.evaluate(()=>({tas:performance.memory.usedJSHeapSize,wasm:coeur.memoireOctets(),etat:coeur.etat(),compteurs:F.compteurs()}));
   sortie.postes[po.poste]={cas:po.cas.length,mesure:res.mode||'par-cas',...(po.stades?{stadesDeLaChaine:po.stades}:{}),jsMs:{mediane:q(res.js,.5),p90:q(res.js,.9)},facadeMs:{mediane:q(res.facade,.5),p90:q(res.facade,.9)},
    gainMedian:q(res.js,.5)/q(res.facade,.5),memoire:{tasJsAvant:m0.tas,tasJsApres:m1.tas,wasmAvant:m0.wasm,wasmApres:m1.wasm,wasmHauteEau:m1.etat.hauteEau,reinstanciations:m1.etat.reinstanciations},
    compteursFacade:m1.compteurs};
   console.error(po.poste,JSON.stringify(sortie.postes[po.poste].jsMs),JSON.stringify(sortie.postes[po.poste].facadeMs));}
 }finally{await b.close();}
 const s=JSON.stringify(sortie,null,1),f=arg('--json')||path.join(RACINE,'ariane-rs','dist','ch064-d-banc-temps.json');fs.writeFileSync(f,s+'\n');console.log(s);
}
if(require.main===module)main().catch(e=>{console.error(e);process.exit(1);});
module.exports={postes};

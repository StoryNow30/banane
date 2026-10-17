#!/usr/bin/env node
'use strict';
/*
 * rapide-humain.cjs — banc des trois modes du clic de pose rapide (D-157, réglage `pilote.rapide.clicHumain`, fiches/RAPIDE_HUMAIN.md).
 *
 * Un lot réel rejoué dans le VRAI service worker (background.js, moteur et GCV1 réels), contre un ESV simulé :
 *  - capture : la page répond après la durée que le journal du lot a relevée pour ce cut (commande `capture`), avec le vrai nuage
 *    du cut (corpus GCV1), comme tools/cycle-ombre.cjs ;
 *  - application : le VRAI code de page (src/adapter-page.js) tourne contre une page ESV simulée (tests/helpers/esv-clic.cjs) qui
 *    porte, pour ce cut, les rails de départ et les DEUX caméras de la capture (une par rail : matrices, projection, rectangle du
 *    canevas), la vue active étant la dernière caméra de la capture. Le bouton d'un rail change le côté tout de suite et la caméra à
 *    l'image suivante ; un clic pose le rail du côté courant là où le rayon de la caméra active coupe le plan de coupe ; Chromium
 *    arrondit les coordonnées à l'entier inférieur. Les attentes de la page (sondages, images) sont de vraies minuteries, multipliées
 *    par `--echelle` comme les durées de capture. La pose obtenue (à moins de 1 mm de la cible, ou l'erreur de la page) est rendue au
 *    service worker ; les relevés `clic-hors-vue` de la page lui sont transmis comme par le pont.
 *
 *   node tools/rapide-humain.cjs banc --corpus SEG.json [--corpus …] --journal J.json [--modes tel-quel,gauche-recentre,tout-recentre]
 *        [--echelle 2.5] [--coupe a:b] [--parallele] [--verrou FICHIER] [--sortie S.json]
 *   node tools/rapide-humain.cjs bras --mode MODE … (un lot, dans ce processus ; le banc lance un processus neuf par mode)
 *
 * Chaque temps du banc est un temps de cette machine ; divisé par `--echelle` (rapport de `cycle-ombre.cjs etalon`), il est ramené
 * au poste du terrain. Lecture seule : rien dans src/ ni background.js n'est modifié par l'outil. Corpus et journaux hors dépôt.
 */
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process');
const CO=require('./cycle-ombre.cjs');
const MODES=['tel-quel','gauche-recentre','tout-recentre'];
const {stats,quantile}=CO;
const arrondi=(x,d=1)=>Number.isFinite(x)?Math.round(x*10**d)/10**d:null;
const maintenant=()=>performance.now();

/* La partie du lot, lue dans le journal (le corpus d'un export peut porter plusieurs parties : on ne garde que les nuages de celle-ci). */
function partieDuJournal(j){const s=j.state?.batch?.scope;return Number.isInteger(s?.part)?s.part:null;}
/* Rôle des deux caméras d'une capture : la plus proche de chaque rail ; la vue active est la dernière caméra (`camera`). */
function vuesDeCapture(cap){
  const vcs=(cap.viewCaptures||[]).map(v=>v?.camera).filter(c=>Array.isArray(c?.cameraToSceneRelative)&&Array.isArray(c?.projection)&&c?.viewport);
  if(vcs.length<2||!cap.rails?.left||!cap.rails?.right)return null;
  const d=(c,s)=>Math.hypot(...c.cameraToSceneRelative.slice(12,15).map((v,i)=>v-cap.rails[s].positionSceneRelative[i]));
  const left=vcs.reduce((a,c)=>d(c,'left')<d(a,'left')?c:a),right=vcs.reduce((a,c)=>d(c,'right')<d(a,'right')?c:a);
  if(left===right)return null;
  const a=cap.camera?.cameraToSceneRelative,egal=c=>Array.isArray(a)&&c.cameraToSceneRelative.every((v,i)=>Math.abs(v-a[i])<=1e-9);
  const active=egal(right)?'right':egal(left)?'left':null;
  return {left,right,active};
}
/* Translation d'un rail (mêmes champs que K.expectedPoses). */
function translater(K,r,d){const C=K.C,o=K.clone(r);
  for(const n of ['railLocalToSceneRelative','profileLocalToSceneRelative'])o[n]=C.multiply(C.translation(d),o[n]);
  o.sceneRelativeToProfileLocal=C.inverse(o.profileLocalToSceneRelative);o.positionSceneRelative=C.point(o.railLocalToSceneRelative,[0,0,0]);
  o.profileOriginSceneRelative=C.point(o.profileLocalToSceneRelative,[0,0,0]);return o;}

/* Service worker dans le contexte principal (comme cycle-ombre `montageDirect`), avec un envoi « depuis l'onglet d'ESV ». */
function montage({adapter,store}){
  const vm=require('node:vm'),root=path.resolve(__dirname,'..'),commands=[];let message;
  /* L'adresse d'ESV n'est écrite nulle part ici : elle est lue dans background.js. */
  const origine=fs.readFileSync(path.join(root,'background.js'),'utf8').match(/u\.origin==='([^']+)'/)?.[1],urlEsv=origine+'/rails_validation/test';
  store.all=async n=>n==='clouds'?[...store.clouds.values()]:store[n];store.keys=async()=>[...store.clouds.keys()];
  Object.assign(globalThis,{chrome:{runtime:{id:'test',getURL:p=>'chrome-extension://test/'+p,onMessage:{addListener:f=>message=f},onConnect:{addListener:()=>{}}},
    action:{onClicked:{addListener:()=>{}}},storage:{local:{get:async()=>({}),set:async()=>{}}},
    tabs:{get:async id=>({id,url:urlEsv}),query:async()=>[],onRemoved:{addListener:()=>{}},
     sendMessage:async(id,m)=>{if(m.kind==='launcher-visibility')return {ok:true};if(m.kind==='liste-instantane')return {ok:false,reason:'banc-sans-table'};commands.push({action:m.action,args:m.args});return {result:await adapter[m.action](...m.args)};}},
    scripting:{executeScript:async options=>[{frameId:0,result:options.func?null:undefined}]},windows:{onRemoved:{addListener:()=>{}},create:async()=>({id:1}),update:async()=>{}}},
    importScripts:(...files)=>{for(const f of files){
      if(f==='src/storage.js'){globalThis.BananeStorage3=class{constructor(){return store;}};continue;}
      vm.runInThisContext(fs.readFileSync(path.join(root,f),'utf8'),{filename:f});}}});
  vm.runInThisContext(fs.readFileSync(path.join(root,'background.js'),'utf8'),{filename:'background.js'});
  const sender={id:'test',url:'chrome-extension://test/panel.html',tab:{id:20}},esv={id:'test',tab:{id:1},url:urlEsv};
  const api=(action,args={})=>new Promise((resolve,reject)=>{message({kind:'panel',action,args},sender,r=>r.error?reject(Error(r.error)):resolve(r.result));});
  const get=name=>vm.runInThisContext(name);
  const raw=m=>{message(m,esv,()=>{});};
  const settle=async()=>{const e=get('engine');if(e.task)await e.task;return api('view');};
  return {ctx:globalThis,api,get,store,adapter,commands,settle,raw};
}

/* Un lot, dans CE processus, avec le mode `mode` du clic de pose. */
async function jouerLot({mode,corpus,journal,coupe=null,echelle=1,vm=false,sansAttente=false},log=()=>{}){
  if(!MODES.includes(mode))throw Error('Mode inconnu : '+mode);
  const {production}=require('../tests/helpers/perf-production.cjs'),{SimulatedESV,K,MemoryStore}=require('../tests/fixtures.cjs');
  const H=require('../tests/helpers/esv-clic.cjs');
  const j=typeof journal==='string'?JSON.parse(fs.readFileSync(journal,'utf8')):journal,partie=partieDuJournal(j);
  const visites=CO.visitesDuJournal(j);
  let ordre=visites.map(v=>v.cut);if(coupe)ordre=ordre.slice(coupe[0],coupe[1]);
  const voulus=new Set(ordre),captures=new Map();
  for(const f of corpus){const seg=typeof f==='string'?JSON.parse(fs.readFileSync(f,'utf8')):f;
    for(const c of seg.clouds||[]){const p=c.identity?.part??c.part;if(voulus.has(c.cut)&&(partie===null||p===partie)&&c.rails?.left&&c.rails?.right)captures.set(c.cut,c);}}
  ordre=ordre.filter(c=>captures.has(c));
  const latences=new Map(visites.map(v=>[v.cut,sansAttente?0:(v.captureMs??0)*echelle]));
  const pas=[],poses=[];
  const Esv=CO.creerEsvRejoue({ordre,captures,latences,SimulatedESV,K,journalise:x=>pas.push(x)});
  /* L'application passe par le vrai code de page. */
  const premiere=captures.get(ordre[0]),vp0=vuesDeCapture(premiere)?.right?.viewport||H.VIEWPORT;
  const page=H.esvClic({horloge:'reelle',echelle,pilote:{rapide:{clicHumain:mode}},viewport:vp0});
  let b=null;
  Esv.prototype.apply=async function(before,proposals,...reste){
    const cut=this.identity.cut,cap=captures.get(cut),vues=cap&&vuesDeCapture(cap),t0=maintenant();
    pas.push({cut,action:'apply',t:t0});
    const ligne={cut,lecture:null,vueActive:vues?.active??null,dureeMs:null,erreur:null,clics:[],horsVue:0,ecartMm:null,reprises:[]};poses.push(ligne);
    if(!vues){ligne.erreur='sans-cameras';const r=await SimulatedESV.prototype.apply.call(this,before,proposals,...reste);return r;}
    const n0=page.journal.length,h0=page.horsVue.length,p0=page.progress.length;
    page.poser({part:this.identity.part,cut,rails:{left:{rail:before.rails.left.railLocalToSceneRelative,profil:before.rails.left.profileLocalToSceneRelative},
      right:{rail:before.rails.right.railLocalToSceneRelative,profil:before.rails.right.profileLocalToSceneRelative}},
      vues:{left:vues.left.cameraToSceneRelative,right:vues.right.cameraToSceneRelative},active:vues.active||'right',projection:vues.right.projection,vp:vues.right.viewport});
    const avant=await page.call('state'),cible=K.expectedPoses(avant,proposals);let erreur=null;
    const t1=maintenant();
    try{await page.call('apply',avant,proposals);}catch(e){erreur=e.message;}
    ligne.dureeMs=arrondi(maintenant()-t1,2);
    await new Promise(r=>setImmediate(r));
    const fin=await page.call('state'),vue=page.vue();
    ligne.lecture=(cap.readStrategy?.lecture)??null;
    ligne.clics=page.journal.slice(n0).filter(x=>x.quoi==='canevas').map(x=>({cote:x.cote,x:arrondi(x.clientX,2),y:arrondi(x.clientY,2),visible:H.clicVisible(x,vue)}));
    ligne.boutons=page.journal.slice(n0).filter(x=>x.quoi==='bouton').map(x=>x.id==='O2N3DCutLRClick'?'left':'right');
    ligne.reprises=page.progress.slice(p0).filter(p=>p.stage==='apply-repli').map(p=>p.detail?.side);
    const releves=page.horsVue.slice(h0);ligne.horsVue=releves.reduce((s,m)=>s+(m.releve?.clics?.length||0),0);
    for(const m of releves)b?.raw({kind:'clic-hors-vue',releve:JSON.parse(JSON.stringify(m.releve))});
    const d={};for(const s of ['left','right'])d[s]=cible[s].positionSceneRelative.map((v,i)=>fin.rails[s].positionSceneRelative[i]-v);
    ligne.ecartMm=Object.fromEntries(['left','right'].map(s=>[s,arrondi(Math.hypot(...d[s])*1000,4)]));
    ligne.erreur=erreur;
    if(erreur){pas.push({cut,action:'apply-fin',t:maintenant()});throw Error(erreur);}
    await SimulatedESV.prototype.apply.call(this,before,proposals);
    for(const s of ['left','right'])this.rails[s]=translater(K,this.rails[s],d[s]);
    ligne.positions=Object.fromEntries(['left','right'].map(s=>[s,this.rails[s].positionSceneRelative]));
    pas.push({cut,action:'apply-fin',t:maintenant()});
    return this.state();};
  const adapter=new Esv();b=vm?production({adapter}):montage({adapter,store:new MemoryStore()});
  await b.api('connect',{tabId:1});await b.api('settings',{mode:'automatic-test'});
  const SCOPE={testConfirmed:true,allowNavigationEvidence:true,lowConfidence:'attempt',geometryEngine:'geometry-candidate-v1',lotDecision:'apply'};
  log(`mode ${mode} : ${ordre.length} cuts, échelle ${echelle}`);
  const t0=maintenant();
  await b.api('start',{part:adapter.identity.part,start:ordre[0],end:ordre.at(-1),...SCOPE});await b.settle();
  const dureeMs=maintenant()-t0;
  await new Promise(r=>setTimeout(r,20));
  const ev=b.store.events,engine=b.get('engine');
  const decisions=ev.filter(e=>e.type==='gcv1-shadow-observed').map(e=>{const d=e.lotObservation||{};return [e.identity?.cut,d.stage??null,d.command?.action??null,d.reason??null];});
  const differes=[...new Set([...ev.filter(e=>e.type==='defer-intent').map(e=>e.identity?.cut),...decisions.filter(d=>d[2]==='defer').map(d=>d[0])].filter(Number.isInteger))].sort((a,b)=>a-b);
  const parCut=[];
  for(const cut of ordre){const s=pas.find(x=>x.cut===cut&&x.action==='capture-envoi');if(!s)continue;parCut.push({cut,envoi:s.t});}
  const cycles=parCut.slice(1).map((x,i)=>x.envoi-parCut[i].envoi);
  return {format:'ariane-rapide-humain-bras-v1',mode,echelle,coupe,cuts:ordre.length,partie,dureeMs,charge:os.loadavg(),uptime:cp.execSync('uptime').toString().trim(),
    etatLot:engine.s.batch?.state??null,traites:engine.s.batch?.processed?.length??null,
    decisions,differes,poses,cycles,appelsEsv:adapter.calls.length,
    journalHorsVue:{evenements:ev.filter(e=>e.type==='clic-hors-vue').length,bilan:ev.filter(e=>e.type==='clic-hors-vue-bilan').map(e=>({total:e.total,exemples:e.exemples,etat:e.etat})),
      compteur:engine.s.batch?.clicsHorsVue?{...engine.s.batch.clicsHorsVue}:null}};
}

/* ------------------------------------------------------------------ lecture d'un bras et comparaison des modes */
function resumer(m){
  const E=m.echelle||1,t=x=>Number.isFinite(x)?x/E:x;
  const ap=m.poses.filter(p=>Number.isFinite(p.dureeMs)),rapides=ap.filter(p=>p.lecture==='rapide'),refs=ap.filter(p=>p.lecture==='reference');
  const clics=m.poses.flatMap(p=>p.clics);
  return {mode:m.mode,cuts:m.cuts,etatLot:m.etatLot,traites:m.traites,
    dureeLotS:arrondi(m.dureeMs/1000),dureeLotTerrainS:arrondi(t(m.dureeMs)/1000),
    cycleTerrainMs:stats(m.cycles.map(t)),
    applicationTerrainMs:{tous:stats(ap.map(p=>t(p.dureeMs))),rapides:stats(rapides.map(p=>t(p.dureeMs))),references:stats(refs.map(p=>t(p.dureeMs)))},
    applications:m.poses.length,erreursPage:m.poses.filter(p=>p.erreur).map(p=>({cut:p.cut,erreur:p.erreur})),
    clics:clics.length,clicsHorsVue:clics.filter(c=>!c.visible).length,relevesHorsVue:m.poses.reduce((s,p)=>s+p.horsVue,0),
    clicsHorsVueParCote:{left:clics.filter(c=>!c.visible&&c.cote==='left').length,right:clics.filter(c=>!c.visible&&c.cote==='right').length},
    cutsAvecClicHorsVue:m.poses.filter(p=>p.clics.some(c=>!c.visible)).length,
    vueActive:m.poses.reduce((o,p)=>(o[p.vueActive??'inconnue']=(o[p.vueActive??'inconnue']||0)+1,o),{}),
    reprises:m.poses.reduce((o,p)=>{for(const s of p.reprises)o[s]=(o[s]||0)+1;return o;},{}),
    ecartCibleMaxMm:arrondi(Math.max(0,...m.poses.filter(p=>p.ecartMm&&!p.erreur).flatMap(p=>[p.ecartMm.left,p.ecartMm.right])),4),
    posesAPlusDe1mm:m.poses.filter(p=>p.ecartMm&&!p.erreur&&(p.ecartMm.left>1||p.ecartMm.right>1)).length,
    differes:m.differes.length,journal:m.journalHorsVue};
}
function comparer(bras){
  const ref=bras.find(b=>b.mode==='tel-quel')||bras[0],K=require('../src/core.js');
  const posesRef=new Map(ref.poses.filter(p=>p.positions).map(p=>[p.cut,p.positions]));
  return bras.map(b=>{const r=resumer(b),dRef=new Set(ref.differes),d=new Set(b.differes);
    let n=0,max=0,au1=0;
    for(const p of b.poses){const q=posesRef.get(p.cut);if(!q||!p.positions)continue;n++;
      const e=Math.max(...['left','right'].map(s=>K.C.distance(p.positions[s],q[s])*1000));max=Math.max(max,e);if(e<=1)au1++;}
    return {...r,comparaisonTelQuel:{posesComparees:n,identiquesA1mm:au1,ecartMaxMm:arrondi(max,4),
      memesDecisions:JSON.stringify(b.decisions)===JSON.stringify(ref.decisions),
      differesEnPlus:[...d].filter(c=>!dRef.has(c)),differesEnMoins:[...dRef].filter(c=>!d.has(c)),
      dureeLotEcartTerrainS:arrondi((b.dureeMs-ref.dureeMs)/(b.echelle||1)/1000)}};});
}

/* ------------------------------------------------------------------ orchestration (un processus neuf par mode) */
function banc(opt,log=console.error){
  const verrou=opt.verrou,poser=()=>{if(verrou)fs.writeFileSync(verrou,JSON.stringify({pid:process.pid,debut:new Date().toISOString(),outil:'rapide-humain banc'})+'\n');};
  const lever=()=>{if(verrou)try{fs.rmSync(verrou,{force:true});}catch{/* déjà levé */}};
  for(const sig of ['SIGINT','SIGTERM'])process.on(sig,()=>{lever();process.exit(130);});
  const modes=opt.modes||MODES,sorties=modes.map(m=>path.join(os.tmpdir(),`rapide-humain-${process.pid}-${m}.json`));
  const args=m=>[__filename,'bras','--mode',m,'--journal',opt.journal,...opt.corpus.flatMap(f=>['--corpus',f]),'--sortie',sorties[modes.indexOf(m)],
    ...(opt.coupe?['--coupe',opt.coupe.join(':')]:[]),...(opt.echelle!==1?['--echelle',String(opt.echelle)]:[])];
  poser();const bras=[];
  try{
    if(opt.parallele){
      log(`trois modes en parallèle — ${cp.execSync('uptime').toString().trim()}`);
      const enfants=modes.map(m=>cp.spawn(process.execPath,['--max-old-space-size=5000',...args(m)],{stdio:['ignore','inherit','inherit'],env:process.env}));
      const fini=enfants.map(e=>new Promise(r=>e.on('exit',c=>r(c))));
      return Promise.all(fini).then(c=>{if(c.some(x=>x!==0))throw Error('un bras a échoué : '+c.join(','));
        for(const f of sorties){const m=JSON.parse(fs.readFileSync(f,'utf8'));fs.rmSync(f,{force:true});bras.push(m);}
        return sortie(opt,bras);}).finally(lever);
    }
    for(const m of modes){log(`mode ${m} — ${cp.execSync('uptime').toString().trim()}`);
      const r=cp.spawnSync(process.execPath,['--max-old-space-size=8000',...args(m)],{stdio:['ignore','inherit','inherit'],env:process.env});
      if(r.status!==0)throw Error(`le mode ${m} a échoué (code ${r.status})`);
      const f=sorties[modes.indexOf(m)],x=JSON.parse(fs.readFileSync(f,'utf8'));fs.rmSync(f,{force:true});bras.push(x);
      log(`  lot ${arrondi(x.dureeMs/1000)} s, ${x.differes.length} différés`);}
  }catch(e){lever();throw e;}
  lever();return sortie(opt,bras);
}
const sortie=(opt,bras)=>({format:'ariane-rapide-humain-banc-v1',echelle:opt.echelle,coupe:opt.coupe||null,parallele:!!opt.parallele,
  machine:{cpus:os.cpus().length,modele:os.cpus()[0]?.model,memoireGo:Math.round(os.totalmem()/2**30)},
  modes:comparer(bras),charges:bras.map(b=>({mode:b.mode,uptime:b.uptime})),bras});

function lireArgs(argv){const o={corpus:[],echelle:1};
  for(let i=1;i<argv.length;i++){const a=argv[i],val=()=>argv[++i];
    if(a==='--corpus')o.corpus.push(val());else if(a==='--journal')o.journal=val();else if(a==='--mode')o.mode=val();else if(a==='--modes')o.modes=val().split(',');
    else if(a==='--echelle')o.echelle=Number(val());else if(a==='--coupe')o.coupe=val().split(':').map(Number);else if(a==='--sortie')o.sortie=val();
    else if(a==='--verrou')o.verrou=val();else if(a==='--parallele')o.parallele=true;else throw Error('Option inconnue : '+a);}
  return o;}
async function main(argv=process.argv.slice(2)){
  const cmd=argv[0];if(!['banc','bras'].includes(cmd))throw Error('Usage : rapide-humain.cjs banc|bras … (voir l\'en-tête du fichier)');
  const o=lireArgs(argv);if(!o.journal||!o.corpus.length)throw Error('--journal et --corpus sont nécessaires');
  const res=cmd==='bras'?await jouerLot({mode:o.mode,corpus:o.corpus,journal:o.journal,coupe:o.coupe,echelle:o.echelle},m=>console.error(m)):await banc(o);
  const texte=JSON.stringify(res)+'\n';if(o.sortie)fs.writeFileSync(o.sortie,texte);else process.stdout.write(texte);
  if(cmd==='bras')process.exit(0);
}
if(require.main===module)main().catch(e=>{console.error(e.stack||e);process.exitCode=1;});
module.exports={MODES,jouerLot,resumer,comparer,vuesDeCapture,partieDuJournal,banc};

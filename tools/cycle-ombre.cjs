#!/usr/bin/env node
'use strict';
/*
 * cycle-ombre.cjs — de combien l'ombre de la voie prédite (événement `voie-predite-ombre`, background.js : voieOmbreNoter,
 * voieOmbrePlanifier, voieOmbrePousser, voieOmbreVider ; module src/voie-recentree.js) allonge-t-elle le cycle d'un lot Orbite ?
 *
 * Contexte : l'ombre d'un cut DIFFÉRÉ relance le moteur (jusqu'à 2,5 s) dans le service worker, au moment où la page capture le cut
 * suivant. Le service worker ne fait qu'une chose à la fois : si le calcul dure plus que la capture, la réponse de la page attend la
 * fin du calcul. Ce que cet outil mesure ; il ne change rien au comportement de l'extension (lecture seule, aucun fichier de src/ ni
 * background.js n'est modifié).
 *
 * Deux mesures, la première est la meilleure.
 *
 *  1. `banc` — un lot rejoué dans le VRAI service worker (background.js en vm, moteur et GCV1 réels, tests/helpers/perf-production.cjs),
 *     sur les VRAIS nuages du lot (corpus GCV1), contre un ESV simulé. La page simulée répond à chaque capture après la durée que le
 *     journal a relevée pour ce cut (commande `capture`, côté service worker). Réglage `voiePrediteOmbre.actif` coupé puis actif,
 *     en alternance, chaque lot dans un processus neuf. Rapporte, par cut : le cycle (de la capture d'un cut à celle du suivant), le
 *     retard de la réponse de la page (instant où elle est reçue moins instant où elle était prête) et l'écart entre sa réponse et la
 *     commande suivante ; et pour le lot : sa durée totale. Vérifie que les décisions du lot et les commandes à ESV sont identiques
 *     avec et sans ombre.
 *
 *       node tools/cycle-ombre.cjs banc --corpus SEG.json [--corpus ...] --journal J.json [--reps 3] [--coupe a:b]
 *            [--sortie S.json] [--verrou FICHIER] [--sans-attente]
 *
 *  2. `calcul` — au plus près, sans service worker : l'ombre (`evaluerDiffere`, code de l'extension, moteur NON mémoïsé) rejouée sur
 *     le lot ; temps de calcul par différé, comparé au temps de capture du cut suivant relevé au journal ; retard estimé par cut =
 *     max(0, calcul − capture), additionné sur le lot.
 *
 *       node tools/cycle-ombre.cjs calcul --corpus SEG.json [--corpus ...] --journal J.json --jointure JT.json [--cache C.json]
 *            [--reps 3] [--facteurs 1,1.6,2.5,3.7] [--sortie S.json]
 *
 *  0. `etalon` — vitesse de cette machine contre le poste du terrain (même calcul du moteur, cuts du journal) : rapport à utiliser comme
 *     `--facteurs` (calcul) et `--echelle` (banc : multiplie les durées de capture du journal pour garder le rapport calcul / capture).
 *       node tools/cycle-ombre.cjs etalon --corpus SEG.json [--corpus ...] --journal J.json [--pas 8] [--sortie S.json]
 *
 * Limites : la page est simulée (elle attend, elle ne travaille pas) ; le stockage est en mémoire (les écritures IndexedDB du
 * terrain, qui n'occupent pas le service worker, manquent donc au cycle de banc : sa valeur absolue est plus courte que celle du
 * terrain, seule la différence avec et sans ombre se lit) ; les nuages sont ceux de l'export, les mêmes dans les deux bras.
 * Les corpus, journaux et jointures restent hors dépôt.
 */
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process');

/* ------------------------------------------------------------------ statistiques */
const nombres=v=>(v||[]).filter(Number.isFinite);
function quantile(v,q){const b=nombres(v).sort((x,y)=>x-y);if(!b.length)return null;const at=(b.length-1)*q,lo=Math.floor(at),hi=Math.ceil(at);return b[lo]+(b[hi]-b[lo])*(at-lo);}
const arrondi=(x,d=1)=>Number.isFinite(x)?Math.round(x*10**d)/10**d:null;
function stats(v){const b=nombres(v).sort((x,y)=>x-y);if(!b.length)return {n:0};
  return {n:b.length,mediane:arrondi(quantile(b,.5)),p90:arrondi(quantile(b,.9)),max:arrondi(b.at(-1)),min:arrondi(b[0]),moyenne:arrondi(b.reduce((s,x)=>s+x,0)/b.length),total:arrondi(b.reduce((s,x)=>s+x,0))};}

/* ------------------------------------------------------------------ journal */
/* Les visites du lot exporté, dans l'ordre : cut, instant d'ouverture (horloge du service worker), durée de la commande `capture`
 * côté service worker (ce pendant quoi la page travaille), et durées des autres commandes. Lit les relevés `phase-timing-pli`. */
function visitesDuJournal(chemin){
  const j=typeof chemin==='string'?JSON.parse(fs.readFileSync(chemin,'utf8')):chemin,bid=j.state?.batch?.id??null,v=[];
  for(const e of j.events||[]){
    if(e.type!=='phase-timing-pli'||(bid&&e.batchId!==bid))continue;
    const cut=e.ctx?.identity?.cut,s=e.r?.s||{},open=Array.isArray(e.rows?.[0])?e.rows[0][2]:null;
    if(!Number.isInteger(cut)||!Number.isFinite(open)||!s['command:capture'])continue;
    const d=k=>Array.isArray(s[k])?s[k][1]:null;
    v.push({cut,ouvertureMs:open,captureMs:d('command:capture'),appliquerMs:d('command:apply'),validerMs:d('command:validateAndNext'),
      differerMs:d('command:nextWithoutDecision'),differe:!!s['command:nextWithoutDecision'],analyseMs:d('analysis-envelope'),moteurMs:d('facade-total')});
  }
  return v.sort((a,b)=>a.ouvertureMs-b.ouvertureMs);
}
/* Cycle du terrain : écart entre les ouvertures de deux visites successives. */
const cyclesDuTerrain=visites=>visites.slice(1).map((x,i)=>({cut:visites[i].cut,cycleMs:x.ouvertureMs-visites[i].ouvertureMs,apresDiffere:i>0&&visites[i-1].differe}));

/* ------------------------------------------------------------------ retard estimé */
/* Le calcul de l'ombre d'un différé part avec la capture du cut suivant et occupe le service worker `calculMs` ; la page répond au
 * bout de `captureMs`. Le service worker reçoit la réponse à max(calcul, capture) : retard ajouté = max(0, calcul − capture). */
const retardAjoute=(calculMs,captureMs)=>Number.isFinite(calculMs)&&Number.isFinite(captureMs)?Math.max(0,calculMs-captureMs):null;
/* Retard recalculé pour un poste `k` fois plus lent que celui du terrain (k=1 : tel que mesuré ; k=2,5 : le calcul du terrain dure 1/2,5 du calcul d'ici).
 * `calculMs` est le calcul d'ici, `captureMs` la capture du terrain (non modifiée). */
const retardAvecFacteur=(lignes,k)=>resumeRetards(lignes.map(l=>({retardMs:retardAjoute(l.calculMs/k,l.captureSuivanteMs)})));
function resumeRetards(lignes){
  const r=lignes.map(l=>l.retardMs).filter(Number.isFinite),retardes=r.filter(x=>x>0);
  return {differes:lignes.length,avecSuivant:r.length,retardes:retardes.length,partRetardes:r.length?arrondi(retardes.length/r.length,3):null,
    sommeMs:arrondi(r.reduce((s,x)=>s+x,0)),tous:stats(r),surLesRetardes:stats(retardes)};
}

/* ------------------------------------------------------------------ mesure 2 : calcul de l'ombre */
function mesureCalcul(opt,log=()=>{}){
  const R=require('./rejeu-voie-predite.cjs'),K=require('../src/core.js'),V=require('../src/voie-recentree.js'),Shadow=require('../src/gcv1-shadow.js');
  const ctx=R.preparer(opt);
  const visites=visitesDuJournal(opt.journal),journal=new Set(visites.map(x=>x.cut));
  ctx.ordre=visites.map(x=>x.cut).filter(c=>ctx.captures.has(c));      // les seuls cuts du lot (pas ceux d'une autre partie du corpus)
  log(`lot : ${ctx.ordre.length} cuts, ${visites.length} visites au journal`);
  const {temoin}=R.executer(ctx,['temoin'],log);
  const parCut=new Map(visites.map((x,i)=>[x.cut,{visite:x,suivante:visites[i+1]||null}]));
  /* Le moteur de l'extension (`BananeGCV1Shadow`), SANS mémoire : chaque relance coûte ce qu'elle coûte. La science de la décision du
   * lot (non chronométrée) vient de la mémoire du rejeu : elle est la même, c'est l'entrée de l'ombre, pas son coût. */
  const memo=new Map(),scienceDe=cap=>{const k=cap.identity.cut;if(!memo.has(k))memo.set(k,Shadow.scientificProposeBoth(cap));return memo.get(k);};
  const passes=[];
  for(let rep=0;rep<opt.reps;rep++){
    const mem=V.creerMemoire('calcul'),lignes=[];
    for(const cut of ctx.ordre){
      const cap=ctx.captures.get(cut),t=temoin.resultats.get(cut),decision=temoin.decisions?.get(cut);if(!cap||!t||!decision)continue;
      const identity=K.completeIdentity(cap.identity);
      V.noterDecisionReelle(mem,identity,decision);
      if(t.posee)continue;
      const science=scienceDe(cap);let runtime=null;try{runtime=Shadow.toRuntimeRails(science);}catch{runtime=null;}
      const capture={identity,rails:cap.rails,pointsSceneRelative:cap.pointsSceneRelative,visibleByClipBoxes:cap.visibleByClipBoxes,camera:cap.camera,viewCaptures:cap.viewCaptures};
      const t0=process.hrtime.bigint();
      const {evenement}=V.evaluerDiffere({mem,capture,science:{rails:science.rails,summary:science.summary},ancresReelles:temoin.ancresParCut.get(cut)||[],decisionReelle:decision,
        commandeReelle:temoin.commandes?.get(cut)||null,Shadow,runtimeRails:runtime,before:cap.rails,expectedPoses:K.expectedPoses,seuils:V.REGLE_PRUDENTE});
      lignes.push({cut,calculMs:Number(process.hrtime.bigint()-t0)/1e6,recalcule:evenement.recalcule,posable:evenement.verdict.posable});
    }
    passes.push(lignes);log(`passe ${rep+1}/${opt.reps} : ${lignes.length} différés, calcul total ${arrondi(lignes.reduce((s,l)=>s+l.calculMs,0)/1000)} s`);
  }
  /* Par différé : médiane des passes (la première passe chauffe le moteur : elle est aussi donnée seule). */
  const lignes=passes[0].map((l,i)=>{
    const calculs=passes.map(p=>p[i].calculMs),calcul=quantile(calculs,.5),p=parCut.get(l.cut);
    const capSuivante=p?.suivante?.captureMs??null;
    return {cut:l.cut,recalcule:l.recalcule,posable:l.posable,calculMs:arrondi(calcul),calculPremierePasseMs:arrondi(calculs[0]),captureSuivanteMs:arrondi(capSuivante),
      suivantDifferee:!!p?.suivante?.differe,retardMs:arrondi(retardAjoute(calcul,capSuivante)),retardPremierePasseMs:arrondi(retardAjoute(calculs[0],capSuivante))};
  });
  const recalcules=lignes.filter(l=>l.recalcule),simples=lignes.filter(l=>!l.recalcule);
  const cyclesTerrain=cyclesDuTerrain(visites);
  const duree=(visites.at(-1).ouvertureMs-visites[0].ouvertureMs);
  return {format:'ariane-cycle-ombre-calcul-v1',lot:{cuts:ctx.ordre.length,visites:visites.length,differes:lignes.length,dureeMs:arrondi(duree)},reps:opt.reps,
    calculParDiffereMs:stats(lignes.map(l=>l.calculMs)),calculRecalculesMs:stats(recalcules.map(l=>l.calculMs)),calculSansRelanceMs:stats(simples.map(l=>l.calculMs)),
    calculPremierePasseMs:stats(lignes.map(l=>l.calculPremierePasseMs)),
    captureSuivanteMs:stats(lignes.map(l=>l.captureSuivanteMs)),captureTousLesCutsMs:stats(visites.map(x=>x.captureMs)),
    retard:resumeRetards(lignes),retardPremierePasse:resumeRetards(lignes.map(l=>({retardMs:l.retardPremierePasseMs}))),
    retardRecalcules:resumeRetards(recalcules.map(l=>({retardMs:lignes.find(x=>x.cut===l.cut).retardMs}))),
    retardParFacteur:Object.fromEntries((opt.facteurs||[1]).map(k=>[String(k),(({differes,avecSuivant,retardes,partRetardes,sommeMs,tous,surLesRetardes})=>({retardes,partRetardes,sommeMs,tous,surLesRetardes}))(retardAvecFacteur(lignes,k))])),
    part:{retardSurDureeDuLot:arrondi(lignes.reduce((s,l)=>s+(l.retardMs||0),0)/duree,4)},
    terrain:{cycleMs:stats(cyclesTerrain.map(c=>c.cycleMs)),cycleApresDiffereMs:stats(cyclesTerrain.filter(c=>c.apresDiffere).map(c=>c.cycleMs)),
      cycleApresPoseMs:stats(cyclesTerrain.filter(c=>!c.apresDiffere).map(c=>c.cycleMs))},
    lignes};
}

/* ------------------------------------------------------------------ mesure 1 : le lot dans le service worker */
const attendre=ms=>new Promise(r=>setTimeout(r,ms));
const maintenant=()=>performance.now();
/* background.js dans le contexte PRINCIPAL de Node (mêmes mocks que tests/helpers/perf-production.cjs). Le contexte `vm` de cet
 * assistant ralentit le moteur d'un facteur 2,2 à 2,5 (accès aux globales) ; le service worker de Chrome n'a pas ce coût.
 * Un seul service worker par processus : le bras tourne dans un processus neuf. */
function montageDirect({adapter,store}){
  const vm=require('node:vm'),root=path.resolve(__dirname,'..'),commands=[];let message;
  /* L'adresse d'ESV n'est écrite nulle part ici : elle est lue dans le test d'origine de background.js (`esvURL`). */
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
  const sender={id:'test',url:'chrome-extension://test/panel.html',tab:{id:20}};
  const api=(action,args={})=>new Promise((resolve,reject)=>{message({kind:'panel',action,args},sender,r=>r.error?reject(Error(r.error)):resolve(r.result));});
  const get=name=>vm.runInThisContext(name);
  const settle=async()=>{const e=get('engine');if(e.task)await e.task;return api('view');};
  return {ctx:globalThis,api,get,store,adapter,commands,settle};
}
/* ESV simulé qui rejoue la suite de cuts du lot : chaque cut a son nuage, sa pose de départ, et une latence de capture. Il journalise
 * ses commandes (instant d'appel). */
function creerEsvRejoue({ordre,captures,latences,SimulatedESV,K,journalise}){
  class EsvRejoue extends SimulatedESV{
    constructor(){super();this.i=0;this.placer(0);}
    placer(i){this.i=i;const cap=captures.get(ordre[i]);if(!cap)return;this.identity=K.clone(cap.identity);this.rails=K.clone(cap.rails);}
    async next(){this.calls.push('next');if(this.i+1<ordre.length)this.placer(this.i+1);else{this.identity.cut++;}return this.state();}
    async nextWithoutDecision(...a){
      const suivant=captures.get(ordre[this.i+1]);this.deferIdentity=suivant?K.clone(suivant.identity):null;
      const r=await super.nextWithoutDecision(...a);if(suivant)this.placer(this.i+1);return r;}
    async capture(expected){
      K.assertTarget(expected.identity,this.identity);this.calls.push('capture');
      const cut=this.identity.cut,t0=maintenant(),lat=latences.get(cut)??0;
      journalise({cut,action:'capture-envoi',t:t0,pret:t0+lat});
      await attendre(lat);
      journalise({cut,action:'capture-recue',t:maintenant(),pret:t0+lat});
      const d=K.clone(captures.get(cut));d.rails=K.clone(this.rails);return d;}
  }
  /* Journal des commandes qui font avancer le lot (instant d'appel). */
  for(const nom of ['apply','validateAndNext','nextWithoutDecision','skipAndNext','restore']){
    const f=EsvRejoue.prototype[nom]||SimulatedESV.prototype[nom];
    EsvRejoue.prototype[nom]=function(...a){journalise({cut:this.identity.cut,action:nom,t:maintenant()});return f.apply(this,a);};
  }
  return EsvRejoue;
}
/* Un lot, dans CE processus : `bras` = 'coupe' (voiePrediteOmbre.actif=false) ou 'actif'. `echelle` : multiplicateur des durées de
 * capture du journal (pour garder le rapport calcul / capture du poste qui a fait le lot si cette machine est plus lente). */
async function jouerLot({bras,corpus,journal,coupe=null,sansAttente=false,echelle=1,vm=false},log=()=>{}){
  const {production}=require('../tests/helpers/perf-production.cjs'),{SimulatedESV,K,MemoryStore}=require('../tests/fixtures.cjs'),S=require('../src/settings.js');
  const visites=visitesDuJournal(journal);
  let ordre=visites.map(v=>v.cut);
  if(coupe)ordre=ordre.slice(coupe[0],coupe[1]);
  const voulus=new Set(ordre),captures=new Map();
  for(const f of corpus){
    const seg=JSON.parse(fs.readFileSync(f,'utf8'));
    for(const c of seg.clouds||[])if(voulus.has(c.cut)&&c.rails?.left&&c.rails?.right)captures.set(c.cut,c);
  }
  ordre=ordre.filter(c=>captures.has(c));
  const latences=new Map(visites.map(v=>[v.cut,sansAttente?0:(v.captureMs??0)*echelle]));
  const pas=[];                                              // journal des commandes à l'ESV simulé
  const Esv=creerEsvRejoue({ordre,captures,latences,SimulatedESV,K,journalise:x=>pas.push(x)});
  const adapter=new Esv(),b=vm?production({adapter}):montageDirect({adapter,store:new MemoryStore()});
  const setG=(nom,v)=>{b.ctx[nom]=v;};
  if(bras==='coupe')setG('BananeSettings',{...b.ctx.BananeSettings,voiePrediteOmbre:{...S.voiePrediteOmbre,actif:false}});
  /* Chronomètres autour de l'ombre (mêmes enveloppes dans les deux bras ; elles ne changent rien à ce qui est calculé). */
  const chrono={evaluer:[],noter:[],planifier:[]};
  const V0=b.ctx.BananeVoieRecentree;
  setG('BananeVoieRecentree',{...V0,evaluerDiffere:a=>{const t0=maintenant(),r=V0.evaluerDiffere(a);
    chrono.evaluer.push({cut:a.capture.identity.cut,debut:t0,ms:maintenant()-t0,recalcule:r.evenement.recalcule,posable:r.evenement.verdict.posable});return r;}});
  for(const [cle,nom] of [['noter','voieOmbreNoter'],['planifier','voieOmbrePlanifier']]){const f=b.get(nom);
    setG(nom,(...a)=>{const t0=maintenant();try{return f(...a);}finally{chrono[cle].push(maintenant()-t0);}});}
  await b.api('connect',{tabId:1});await b.api('settings',{mode:'automatic-test'});
  const SCOPE={testConfirmed:true,allowNavigationEvidence:true,lowConfidence:'attempt',geometryEngine:'geometry-candidate-v1',lotDecision:'apply'};
  const t0=maintenant(),horloge0=Date.now();
  await b.api('start',{part:adapter.identity.part,start:ordre[0],end:ordre.at(-1),...SCOPE});await b.settle();
  const dureeMs=maintenant()-t0;
  const charge=os.loadavg();
  try{b.get('voieOmbreVider')();}catch{}
  await attendre(20);
  const ev=b.store.events;
  const decisions=ev.filter(e=>e.type==='gcv1-shadow-observed').map(e=>{const {engineMs,...d}=e.lotObservation||{};return [e.identity?.cut,d.stage??null,d.command?.action??null,d.reason??null];});
  /* Les différés du lot : ceux qui ont une intention de navigation sans décision (`defer-intent`), et le dernier cut s'il est différé sans navigation. */
  const differes=[...new Set([...ev.filter(e=>e.type==='defer-intent').map(e=>e.identity?.cut),...decisions.filter(d=>d[2]==='defer').map(d=>d[0])].filter(Number.isInteger))].sort((a,b)=>a-b);
  const ombres=ev.filter(e=>e.type==='voie-predite-ombre');
  /* Par cut : instants d'envoi de la capture, de réponse prête (nominal), de réponse reçue, et de la commande suivante. */
  const parCut=[];
  for(const cut of ordre){
    const s=pas.find(x=>x.cut===cut&&x.action==='capture-envoi'),r=pas.find(x=>x.cut===cut&&x.action==='capture-recue');if(!s||!r)continue;
    const suiv=pas.find(x=>x.cut===cut&&['apply','nextWithoutDecision','validateAndNext','skipAndNext'].includes(x.action)&&x.t>=r.t);
    parCut.push({cut,envoi:s.t,pret:s.pret,recue:r.t,commande:suiv?.t??null,action:suiv?.action??null});
  }
  return {format:'ariane-cycle-ombre-bras-v1',bras,coupe,echelle,vm,cuts:ordre.length,dureeMs,charge,uptime:cp.execSync('uptime').toString().trim(),debut:new Date(horloge0).toISOString(),
    parCut,decisions,differes,commandes:b.commands.map(c=>c.action),appelsEsv:adapter.calls,
    ombre:{evenements:ombres.length,etats:ombres.reduce((m,e)=>(m[e.etat||'ok']=(m[e.etat||'ok']||0)+1,m),{}),recalcules:ombres.filter(e=>e.recalcule).length,posables:ombres.filter(e=>e.verdict?.posable).length,
      msEvenement:ombres.map(e=>e.ms).filter(Number.isFinite)},
    chrono:{evaluer:chrono.evaluer,noterMs:chrono.noter,planifierMs:chrono.planifier}};
}
/* Les mesures d'un bras → cycles, retards, écarts. */
function lireBras(r){
  const diff=new Set(r.differes),cuts=r.parCut,cycles=[];
  for(let i=0;i<cuts.length;i++){
    const c=cuts[i],suivant=cuts[i+1],apresDiffere=i>0&&diff.has(cuts[i-1].cut);
    cycles.push({cut:c.cut,apresDiffere,differe:diff.has(c.cut),
      cycleMs:suivant?suivant.envoi-c.envoi:null,
      retardReponseMs:Math.max(0,c.recue-c.pret),                    // la réponse de la page était prête à `pret`, le service worker l'a reçue à `recue`
      reponseVersCommandeMs:c.commande!=null?c.commande-c.pret:null});  // de la réponse prête à la commande suivante
  }
  return cycles;
}
const classes=cycles=>({tous:cycles,apresDiffere:cycles.filter(c=>c.apresDiffere),apresPose:cycles.filter(c=>!c.apresDiffere&&c.cut!==undefined)});
const resumeBras=cycles=>{const o={};for(const [k,l] of Object.entries(classes(cycles)))o[k]={cycleMs:stats(l.map(c=>c.cycleMs)),retardReponseMs:stats(l.map(c=>c.retardReponseMs)),reponseVersCommandeMs:stats(l.map(c=>c.reponseVersCommandeMs))};return o;};
/* Comparaison : bras « coupe » contre bras « actif », en alternance. */
function comparer(bras){
  const par=nom=>bras.filter(b=>b.bras===nom);
  const coupe=par('coupe'),actif=par('actif');
  const poolCycles=l=>l.flatMap(b=>lireBras(b));
  const cC=poolCycles(coupe),cA=poolCycles(actif);
  const sorties={coupe:resumeBras(cC),actif:resumeBras(cA)};
  /* Décisions et commandes identiques ? (l'ombre ne pose rien) */
  const ref=JSON.stringify(coupe[0]?.decisions),refCmd=JSON.stringify(coupe[0]?.commandes);
  const memes=bras.every(b=>JSON.stringify(b.decisions)===ref&&JSON.stringify(b.commandes)===refCmd);
  /* Par cut, apparié : moyenne des répétitions de chaque bras, puis écart actif − coupe. */
  const moy=(l,cut,champ)=>{const v=l.map(b=>lireBras(b).find(c=>c.cut===cut)?.[champ]).filter(Number.isFinite);return v.length?v.reduce((s,x)=>s+x,0)/v.length:null;};
  const cuts=coupe[0]?lireBras(coupe[0]).map(c=>({cut:c.cut,apresDiffere:c.apresDiffere})):[];
  const paires=cuts.map(c=>({cut:c.cut,apresDiffere:c.apresDiffere,
    dCycleMs:diff(moy(actif,c.cut,'cycleMs'),moy(coupe,c.cut,'cycleMs')),dRetardMs:diff(moy(actif,c.cut,'retardReponseMs'),moy(coupe,c.cut,'retardReponseMs')),
    dCommandeMs:diff(moy(actif,c.cut,'reponseVersCommandeMs'),moy(coupe,c.cut,'reponseVersCommandeMs'))}));
  const dp=f=>({tous:stats(paires.map(f)),apresDiffere:stats(paires.filter(p=>p.apresDiffere).map(f)),apresPose:stats(paires.filter(p=>!p.apresDiffere).map(f))});
  const dureesC=coupe.map(b=>b.dureeMs),dureesA=actif.map(b=>b.dureeMs);
  const evalu=actif.flatMap(b=>b.chrono.evaluer.map(e=>e.ms));
  return {memesDecisionsEtCommandes:memes,
    lot:{coupeMs:dureesC.map(x=>arrondi(x)),actifMs:dureesA.map(x=>arrondi(x)),medianeCoupeMs:arrondi(quantile(dureesC,.5)),medianeActifMs:arrondi(quantile(dureesA,.5)),
      ecartMedianMs:arrondi(quantile(dureesA,.5)-quantile(dureesC,.5)),ecartMoyenParPaireMs:arrondi(moyenneEcarts(coupe,actif)),
      ecartRelatif:arrondi((quantile(dureesA,.5)-quantile(dureesC,.5))/quantile(dureesC,.5),4)},
    ...sorties,ecartsApparies:{cycleMs:dp(p=>p.dCycleMs),retardReponseMs:dp(p=>p.dRetardMs),reponseVersCommandeMs:dp(p=>p.dCommandeMs)},
    sommeEcartCycleSurLotMs:arrondi(paires.reduce((s,p)=>s+(p.dCycleMs||0),0)),
    sommeRetardReponseActifMs:arrondi(actif.length?actif.map(b=>lireBras(b).reduce((s,c)=>s+c.retardReponseMs,0)).reduce((s,x)=>s+x,0)/actif.length:null),
    sommeRetardReponseCoupeMs:arrondi(coupe.length?coupe.map(b=>lireBras(b).reduce((s,c)=>s+c.retardReponseMs,0)).reduce((s,x)=>s+x,0)/coupe.length:null),
    calculOmbreMs:stats(evalu),calculOmbreRecalculesMs:stats(actif.flatMap(b=>b.chrono.evaluer.filter(e=>e.recalcule).map(e=>e.ms))),
    calculOmbreSansRelanceMs:stats(actif.flatMap(b=>b.chrono.evaluer.filter(e=>!e.recalcule).map(e=>e.ms))),
    noterMs:stats(actif.flatMap(b=>b.chrono.noterMs)),planifierMs:stats(actif.flatMap(b=>b.chrono.planifierMs)),
    noterCoupeMs:stats(coupe.flatMap(b=>b.chrono.noterMs)),planifierCoupeMs:stats(coupe.flatMap(b=>b.chrono.planifierMs)),
    differes:coupe[0]?.differes.length??null,evenementsOmbre:actif.map(b=>b.ombre.evenements),
    charges:bras.map(b=>({bras:b.bras,debut:b.debut,uptime:b.uptime}))};
}
const diff=(a,b)=>Number.isFinite(a)&&Number.isFinite(b)?a-b:null;
function moyenneEcarts(coupe,actif){const n=Math.min(coupe.length,actif.length);if(!n)return null;let s=0;for(let i=0;i<n;i++)s+=actif[i].dureeMs-coupe[i].dureeMs;return s/n;}


/* ------------------------------------------------------------------ étalon : cette machine contre le poste du terrain */
/* Le journal donne, pour chaque cut du lot, le temps du moteur (`facade-total`, côté service worker du poste de l'opérateur). On
 * refait le même calcul ici (`scientificProposeBoth` sur le nuage du cut, deuxième passe, moteur chaud) : le rapport dit combien cette
 * machine est plus lente (>1) ou plus rapide (<1) que le poste du terrain. Sert à ramener un temps de calcul d'ici à celui du terrain. */
function etalon(opt,log=()=>{}){
  const Shadow=require('../src/gcv1-shadow.js'),visites=visitesDuJournal(opt.journal),pas=opt.pas||8;
  const echantillon=visites.filter((v,i)=>i%pas===0&&Number.isFinite(v.moteurMs)),voulus=new Set(echantillon.map(v=>v.cut)),captures=new Map();
  for(const f of opt.corpus){const seg=JSON.parse(fs.readFileSync(f,'utf8'));for(const c of seg.clouds||[])if(voulus.has(c.cut)&&c.rails?.left&&c.rails?.right)captures.set(c.cut,c);}
  const lignes=[];
  for(const v of echantillon){const cap=captures.get(v.cut);if(!cap)continue;
    Shadow.scientificProposeBoth(cap);                                    // chauffe
    const t0=process.hrtime.bigint();Shadow.scientificProposeBoth(cap);const ici=Number(process.hrtime.bigint()-t0)/1e6;
    lignes.push({cut:v.cut,terrainMs:arrondi(v.moteurMs),iciMs:arrondi(ici),rapport:arrondi(ici/v.moteurMs,2)});}
  log(`étalon : ${lignes.length} cuts`);
  const somme=a=>a.reduce((s,x)=>s+x,0);
  return {format:'ariane-cycle-ombre-etalon-v1',cuts:lignes.length,terrainMs:stats(lignes.map(l=>l.terrainMs)),iciMs:stats(lignes.map(l=>l.iciMs)),rapport:stats(lignes.map(l=>l.rapport)),
    rapportDesSommes:arrondi(somme(lignes.map(l=>l.iciMs))/somme(lignes.map(l=>l.terrainMs)),2),lignes};
}

/* ------------------------------------------------------------------ orchestration du banc (un processus par lot, en alternance) */
function banc(opt,log=console.error){
  const verrou=opt.verrou,poser=()=>{if(verrou)fs.writeFileSync(verrou,JSON.stringify({pid:process.pid,debut:new Date().toISOString(),outil:'cycle-ombre banc'})+'\n');};
  const lever=()=>{if(verrou)try{fs.rmSync(verrou,{force:true});}catch{/* déjà levé */}};
  for(const sig of ['SIGINT','SIGTERM'])process.on(sig,()=>{lever();process.exit(130);});
  poser();const bras=[];
  try{
    for(let rep=0;rep<opt.reps;rep++)for(const nom of (rep%2===0?['coupe','actif']:['actif','coupe'])){   // alternance coupe/actif, actif/coupe, …
      const sortie=path.join(os.tmpdir(),`cycle-ombre-${process.pid}-${rep}-${nom}.json`);
      const args=[__filename,'bras','--bras',nom,'--journal',opt.journal,...opt.corpus.flatMap(f=>['--corpus',f]),'--sortie',sortie];
      if(opt.coupe)args.push('--coupe',opt.coupe.join(':'));if(opt.sansAttente)args.push('--sans-attente');if(opt.echelle!==1)args.push('--echelle',String(opt.echelle));if(opt.vm)args.push('--vm');
      log(`répétition ${rep+1}/${opt.reps}, bras ${nom} — ${cp.execSync('uptime').toString().trim()}`);
      const r=cp.spawnSync(process.execPath,['--max-old-space-size=8000',...args],{stdio:['ignore','inherit','inherit'],env:process.env});
      if(r.status!==0)throw Error(`le bras ${nom} (répétition ${rep+1}) a échoué (code ${r.status})`);
      const m=JSON.parse(fs.readFileSync(sortie,'utf8'));fs.rmSync(sortie,{force:true});m.repetition=rep+1;bras.push(m);
      log(`  durée du lot ${arrondi(m.dureeMs/1000)} s, ${m.differes.length} différés, ${m.ombre.evenements} événements d'ombre`);
    }
  }finally{lever();}
  return {format:'ariane-cycle-ombre-banc-v1',reps:opt.reps,coupe:opt.coupe,sansAttente:!!opt.sansAttente,echelle:opt.echelle,vm:!!opt.vm,machine:{cpus:os.cpus().length,modele:os.cpus()[0]?.model,memoireGo:Math.round(os.totalmem()/2**30)},
    comparaison:comparer(bras),bras};
}

/* ------------------------------------------------------------------ CLI */
function lireArgs(argv){
  const o={corpus:[],reps:3,echelle:1,pas:8};
  for(let i=1;i<argv.length;i++){const a=argv[i],val=()=>argv[++i];
    if(a==='--corpus')o.corpus.push(val());else if(a==='--journal')o.journal=val();else if(a==='--jointure')o.jointure=val();else if(a==='--cache')o.cache=val();
    else if(a==='--reps')o.reps=Number(val());else if(a==='--sortie')o.sortie=val();else if(a==='--verrou')o.verrou=val();else if(a==='--bras')o.bras=val();
    else if(a==='--coupe')o.coupe=val().split(':').map(Number);else if(a==='--sans-attente')o.sansAttente=true;else if(a==='--echelle')o.echelle=Number(val());else if(a==='--vm')o.vm=true;else if(a==='--pas')o.pas=Number(val());else if(a==='--facteurs')o.facteurs=val().split(',').map(Number);
    else throw Error('Option inconnue : '+a);}
  return o;
}
async function main(argv=process.argv.slice(2)){
  const cmd=argv[0];
  if(!['banc','calcul','bras','etalon'].includes(cmd))throw Error('Usage : cycle-ombre.cjs banc|calcul … (voir l\'en-tête du fichier)');
  const o=lireArgs(argv);
  if(!o.journal||!o.corpus.length)throw Error('--journal et --corpus sont nécessaires');
  let res;
  if(cmd==='calcul'){if(!o.jointure)throw Error('--jointure est nécessaire');res=mesureCalcul(o,m=>console.error(m));}
  else if(cmd==='bras')res=await jouerLot({bras:o.bras,corpus:o.corpus,journal:o.journal,coupe:o.coupe,sansAttente:o.sansAttente,echelle:o.echelle,vm:o.vm},m=>console.error(m));
  else if(cmd==='etalon')res=etalon(o,m=>console.error(m));
  else res=banc(o);
  const texte=JSON.stringify(res)+'\n';
  if(o.sortie)fs.writeFileSync(o.sortie,texte);else process.stdout.write(texte);
  if(cmd==='bras')process.exit(0);       // l'ombre garde des minuteries : on ne les attend pas
}
if(require.main===module)main().catch(e=>{console.error(e.stack||e);process.exitCode=1;});
module.exports={retardAvecFacteur,etalon,montageDirect,stats,quantile,visitesDuJournal,cyclesDuTerrain,retardAjoute,resumeRetards,mesureCalcul,jouerLot,lireBras,comparer,banc,creerEsvRejoue};

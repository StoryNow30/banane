'use strict';
/* CH-068 (J4) : entrées RÉELLES des modules J4, reconstruites des exports de banane-data (collections des 04, 05, 06/11).
 *   cas(modules, {max}) : itérable de {id, module, f, args} (id sans donnée identifiante : rang, partie, cut).
 * Sources lues dans les zips, jamais copiées dans le dépôt :
 *   - instantanés de la liste d'ESV (`ariane-liste-partie*.json`, format ariane-liste-instantane-1), décompactés par
 *     src/liste-memoire.js : référence d'écartement (gcv2-l1e), lignes de la fenêtre (voie-b1-ecart), appuis lus (appuis-liste) ;
 *   - nuages (tools/ch064-nuages.cjs) de la même partie : pose de départ du cut (repère, mesure de T), relevé des rails.
 * Les bords sont des coordonnées MONDE : ils ne sortent jamais d'ici que sous forme d'entrée du banc (rien n'est écrit). */
const path=require('node:path'),{execFileSync}=require('node:child_process');
const {zips,entrees}=require('./ch064-corpus.cjs');
const RACINE=path.resolve(__dirname,'..');
const MOTIF=/^2026-11-0[456]_/;
const lireJson=(z,e)=>JSON.parse(execFileSync('unzip',['-p',z,e],{maxBuffer:2**31-1}).toString('utf8'));
let TABLES=null;
/* Tables décompactées, une par (partie, empreinte) : la première vue. */
function tables(){
 if(TABLES)return TABLES;const LM=require(path.join(RACINE,'src/liste-memoire.js')),vus=new Set();TABLES=[];
 for(const z of zips(MOTIF))for(const e of entrees(z).filter(x=>/liste-partie/.test(x))){const snap=lireJson(z,e);const t=LM.decompacter(snap);
  if(!t||vus.has(t.partie+'|'+t.sig))continue;vus.add(t.partie+'|'+t.sig);TABLES.push({n:t.n,st:t.st,fl:t.fl,ed:t.ed,partie:t.partie});}
 return TABLES;}
function*cas(modules,{max=Infinity}={}){
 const veut=m=>modules.includes(m);if(veut('voieRecentree'))yield* recentree(max);if(!['gcv2L1e','appuisListe','voieB1'].some(veut))return;
 const T=tables();let k=0;
 if(veut('gcv2L1e'))for(const t of T){const pas=Math.max(1,Math.floor(t.n/120));
  for(let c=0;c<t.n;c+=pas){k++;yield {id:'reel-l1e-ref-p'+t.partie+'-c'+c,module:'gcv2L1e',f:'referenceEcartement',args:k%7?[t,c]:[t,c,{voisines:8,voisinesMin:3}]};}}
 if(!['appuisListe','voieB1'].some(veut))return;
 const VB1=require(path.join(RACINE,'src/voie-b1-ecart.js')),B=require(path.join(RACINE,'src/appuis-liste.js'));
 const parPartie=new Map(T.map(t=>[t.partie,t]));
 const {nuages}=require('./ch064-nuages.cjs');let n=0,repere=null;
 for(const c of nuages(max)){const t=parPartie.get(c.identity?.part),cut=c.identity?.cut;if(!t||!Number.isInteger(cut)||!c.rails?.left||!c.rails?.right)continue;n++;
  const id='p'+c.identity.part+'-c'+cut,rows=VB1.lignesDeTable(t,cut,n%5?5:3);
  if(veut('voieB1')){yield {id:'reel-b1-lignes-'+id,module:'voieB1',f:'lignesDeTable',args:[t,cut]};
   yield {id:'reel-b1-repere-'+id,module:'voieB1',f:'repereDepuisLigne',args:[rows,cut,{left:{positionSceneRelative:c.rails.left.positionSceneRelative},right:{positionSceneRelative:c.rails.right.positionSceneRelative}}]};}
  if(!veut('appuisListe'))continue;
  const ligne=rows.find(x=>x.i===cut),corrige={left:c.rails.left.positionSceneRelative,right:c.rails.right.positionSceneRelative};
  yield {id:'reel-al-compter-'+id,module:'appuisListe',f:'compter',args:[rows,cut]};
  if(!ligne?.bords)continue;
  const m=B.mesurerT(ligne.bords,corrige,n%4?undefined:{rigideMm:0.5});
  yield {id:'reel-al-mesure-'+id,module:'appuisListe',f:'mesurerT',args:[ligne.bords,corrige]};
  yield {id:'reel-al-repere-'+id,module:'appuisListe',f:'noterRepere',args:[structuredClone(repere),c.identity.frameId??null,m]};
  repere=B.noterRepere(repere,c.identity.frameId??null,m);
  yield {id:'reel-al-resume-'+id,module:'appuisListe',f:'resumeRepere',args:[structuredClone(repere)]};
  if(m)yield {id:'reel-al-appuis-'+id,module:'appuisListe',f:'appuis',args:[rows,m.T,c.identity]};
  /* Réponse de la page reconstituée depuis la table (format de esv-observer : i, s, t, v, f, e). */
  const rep={ok:true,table:{lignes:t.n,pages:1,fraiches:0,debut:true,rompue:false,tronquee:false,tables:1},geo:{index:cut,mm:n%3,secondMm:n%2?null:40+n%9},
   rows:rows.map(x=>({i:x.i,s:x.statut,t:x.operateur,v:x.vu,f:x.fraiche,e:x.bords?[...x.bords.left,...x.bords.right]:null}))};
  yield {id:'reel-al-reponse-'+id,module:'appuisListe',f:'lireReponse',args:[rep,{cut,fenetre:n%5?5:3}]};
  yield {id:'reel-al-accord-'+id,module:'appuisListe',f:'accord',args:[B.lireReponse(rep,{cut}),cut]};}
}
/* voie-recentree : la décision du lot EN CHAÎNE sur les nuages réels d'une partie (comme tools/ch064-d-reel.cjs pour decideCut) ;
 * à chaque cut, les fonctions du module sur la capture, la science GCV1 du cut, la décision et les appuis du moment. */
function*recentree(max){
 const L=require(path.join(RACINE,'src/lot-decision.js')),S=require(path.join(RACINE,'src/gcv1-shadow.js')),V=require(path.join(RACINE,'src/voie-recentree.js'));
 const {nuages}=require('./ch064-nuages.cjs'),lim=Math.min(max,Number(process.env.CH068_RECENTREE_MAX||300)),parPartie=new Map();
 for(const c of nuages(lim)){const k=c.identity?.frameId+'|'+c.identity?.part;if(!parPartie.has(k))parPartie.set(k,[]);parPartie.get(k).push(c);}
 let k=0;
 for(const [,cs] of parPartie){cs.sort((a,b)=>a.identity.cut-b.identity.cut);const anchors=[],differes=[],validees=[];
  for(const c of cs){k++;const id='p'+c.identity.part+'-c'+c.identity.cut,leger={identity:c.identity,rails:c.rails,camera:c.camera,viewCaptures:c.viewCaptures};
   const science=S.scientificProposeBoth(c),d=L.decideCut({capture:c,science,anchors,Shadow:S});
   if(k%3===0)yield {id:'reel-vr-recentrer-'+id,module:'voieRecentree',f:'recentrer',args:[{capture:c,science,anchors:structuredClone(anchors),Shadow:'\u0000shadow'}]};
   yield {id:'reel-vr-trace-'+id,module:'voieRecentree',f:'traceMoteur',args:[science]};
   yield {id:'reel-vr-completer-'+id,module:'voieRecentree',f:'completer',args:[{capture:leger,decision:d,relance:k%2?science:null,appuis:structuredClone(anchors)}]};
   const r=V.completer({capture:leger,decision:d,relance:science,appuis:anchors});
   yield {id:'reel-vr-verdict-'+id,module:'voieRecentree',f:'verdictPrudent',args:[r,k%4?undefined:{...V.REGLE_PRUDENTE,etages:['window','choice','first-pass'],confianceMin:40}]};
   yield {id:'reel-vr-regle-'+id,module:'voieRecentree',f:'regle',args:[{...V.enRegle(),vertMm:3,deversMm:4,cohMm:5,cohVMm:5,appuisMin:2,adv:k%2?{confMin:70}:false},r,{adv:k%3===0},k%5?null:{reason:'no-anchor'}]};
   yield {id:'reel-vr-confiances-'+id,module:'voieRecentree',f:'confiances',args:[V.traceMoteur(science)]};
   yield {id:'reel-vr-camlarges-'+id,module:'voieRecentree',f:'camerasLarges',args:[leger]};
   yield {id:'reel-vr-decalage-'+id,module:'voieRecentree',f:'appuisDepuisDecalage',args:[leger,{left:[k%7-3,-1.5],right:[2.25,0.5]}]};
   if(d.positions){
    yield {id:'reel-vr-pose-'+id,module:'voieRecentree',f:'poseMm',args:[leger,d.positions]};
    yield {id:'reel-vr-vue-'+id,module:'voieRecentree',f:'vueNecessaire',args:[leger,d.positions]};
    yield {id:'reel-vr-geste-'+id,module:'voieRecentree',f:'geste',args:[V.vueNecessaire(leger,d.positions)]};
    yield {id:'reel-vr-mesures-'+id,module:'voieRecentree',f:'mesures',args:[leger,d,d.positions,structuredClone(anchors)]};
    yield {id:'reel-vr-local-'+id,module:'voieRecentree',f:'localMm',args:[c.rails.left,d.positions.left]};}
   yield {id:'reel-vr-prediction-'+id,module:'voieRecentree',f:'predictionDe',args:[leger,d,structuredClone(anchors)]};
   yield {id:'reel-vr-serie-'+id,module:'voieRecentree',f:'memoireSerie',args:[{identity:c.identity,differes:differes.slice(),validees:structuredClone(validees),...(k%3?{}:{seuils:{K:5,porteDispersionMm:30}})}]};
   if(d.stage==='deferred')differes.push(c.identity.cut);
   if(d.positions)validees.push({identity:c.identity,visitIndex:k,positions:d.positions});
   if(d.anchor&&d.positions)L.rememberAnchor(anchors,{identity:c.identity,positions:d.positions,stage:d.stage});}}
}
module.exports={cas,tables};

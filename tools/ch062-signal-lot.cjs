#!/usr/bin/env node
'use strict';
/* CH-062 — Le signal de fin de chargement d'ESV pendant le LOT : quand il meurt, ce que coûte sa mort, pourquoi il meurt.
 *
 * Lit un ou plusieurs journaux de lot (`ariane-journal-v4-*.json`) et rend, PAR PAGE ESV (un `identity.pageId` = un chargement de la page) :
 *  - les captures du lot (hors relecture) : signal / repli / neutre, par la règle de la relecture (src/relecture-signal.js `lectureDe`, réutilisée) ;
 *  - la mort du signal : dernière capture lue au signal, et le cut où la règle de la relecture (`observer`, 8 replis de suite) l'aurait détectée ;
 *  - le temps par cut posé (entre deux décisions du lot, validation acceptée ou différé finalisé), selon que le cut a été lu au signal ou au repli,
 *    et par tiers de la partie ;
 *  - la cause : valeur du compteur `numNodesLoading` au repli (`nl`), événements `diag-compteur-bloque`, et requêtes de points en échec relevées
 *    par l'observateur (`esv-observation` « point-resource », `echecs` / `echecsCumules`), avec l'écart de temps entre le premier échec de la page
 *    et la première lecture au repli à compteur non nul.
 * Aucune coordonnée, aucun identifiant de page, de lot ou de session n'est recopié : des durées, des comptes, des heures, des numéros de partie.
 *
 * Usage : node --max-old-space-size=6000 tools/ch062-signal-lot.cjs --journal J.json [--journal …] [--sortie mesure.json] [--cuts cuts.json] */
const fs=require('fs');
const path=require('path');
const SG=require(path.join(__dirname,'..','src','relecture-signal.js'));
const {capturesParRequete}=require('./ch060-relecture-temps.cjs');

const ms=t=>{const v=Date.parse(t);return Number.isFinite(v)?v:null;};
const tri=a=>a.filter(Number.isFinite).sort((x,y)=>x-y);
const quantile=(s,q)=>{if(!s.length)return null;const i=(s.length-1)*q,lo=Math.floor(i),hi=Math.ceil(i);return s[lo]+(s[hi]-s[lo])*(i-lo);};
const r1=x=>x===null||x===undefined||!Number.isFinite(x)?null:Math.round(x*10)/10;
const r0=x=>x===null||x===undefined||!Number.isFinite(x)?null:Math.round(x);
const somme=a=>a.reduce((x,y)=>x+(Number.isFinite(y)?y:0),0);
function resume(v){const s=tri(v);if(!s.length)return {n:0};return {n:s.length,mediane:r0(quantile(s,.5)),q1:r0(quantile(s,.25)),q3:r0(quantile(s,.75)),moyenne:r0(somme(s)/s.length)};}
const heure=t=>t===null?null:new Date(t).toISOString().slice(11,16);
/* Pseudo-aléa déterministe (bootstrap reproductible). */
function alea(seed){let s=seed>>>0||1;return ()=>{s^=s<<13;s>>>=0;s^=s>>>17;s^=s<<5;s>>>=0;return s/4294967296;};}

/* Une capture du journal → l'objet attendu par `lectureDe` (premières tentatives réussies, règle d'attente de chaque vue). */
function enCapture(c){const lecture=c.resultat?.detail?.lecture??c.etapes.find(x=>x.st==='capture-read')?.d?.lecture??null;
 const lus=new Map();for(const x of c.etapes){if(x.st==='capture-read'&&(x.d.attempt===1||x.d.attempt===undefined)&&!lus.has(x.d.side))lus.set(x.d.side,{regle:x.d.regle,nl:x.d.diag?.nl?.[0]??null,navS:x.d.diag?.navS??null,m:x.d.diag?.m??null});
  if(x.st==='capture-view-ready'&&lus.has(x.d.side))lus.get(x.d.side).ok=true;}
 const attempts=[...lus].filter(([,v])=>v.ok).map(([side,v])=>({side,attempt:1,status:'captured',regle:v.regle}));
 return {readStrategy:{lecture,attempts},vues:[...lus.values()]};}

function analyser(j){const ev=Array.isArray(j.events)?j.events:[];
 /* fenêtres de relecture (à exclure : le lot seul est mesuré ici) */
 const deb=ev.filter(e=>e.type==='relecture-debut').map(e=>({lot:e.lotId,t:ms(e.timestamp)})),fins=ev.filter(e=>e.type==='relecture-fin').map(e=>({lot:e.lotId,t:ms(e.timestamp)}));
 const relectures=deb.map(d=>{const f=fins.filter(x=>x.lot===d.lot&&x.t>=d.t).sort((a,b)=>a.t-b.t)[0];return [d.t,f?f.t:Infinity];});
 const enRelecture=t=>relectures.some(([a,b])=>t>=a&&t<=b);
 /* captures du lot, par page */
 const caps=[...capturesParRequete(ev).values()].filter(c=>c.resultat&&Number.isFinite(c.resultat.t));
 const pageDe=new Map();for(const e of ev)if(e.type==='adapter-result'&&e.action==='capture'&&e.requestId&&e.identity?.pageId)pageDe.set(e.requestId,e.identity.pageId);
 for(const [id,c] of capturesParRequete(ev))c.id=id;
 const pages=new Map();
 const page=id=>{if(!pages.has(id))pages.set(id,{parts:new Set(),captures:[],decisions:[],chargeA:null,debut:Infinity,fin:-Infinity});return pages.get(id);};
 for(const e of ev){const p=e.identity?.pageId;if(!p)continue;const t=ms(e.timestamp);const o=page(p);if(Number.isFinite(e.identity.part)&&e.identity.part>0)o.parts.add(e.identity.part);if(t<o.debut)o.debut=t;if(t>o.fin)o.fin=t;}
 const parReq=capturesParRequete(ev);
 for(const [id,c] of parReq){if(!c.resultat||!Number.isFinite(c.resultat.t))continue;const p=pageDe.get(id);if(!p)continue;
  const t=c.resultat.t,cap=enCapture(c),o=page(p);
  const navS=cap.vues.find(v=>Number.isFinite(v.navS))?.navS;if(Number.isFinite(navS)){const ch=t-navS*1000;if(o.chargeA===null||ch<o.chargeA)o.chargeA=ch;}
  o.captures.push({t,relecture:enRelecture(t),lecture:SG.lectureDe(cap),nl:cap.vues.filter(v=>v.regle==='stabilite'&&Number.isFinite(v.nl)).map(v=>v.nl),vues:cap.vues.filter(v=>v.ok),part:c.part});}
 /* décisions du lot (validation acceptée ou différé finalisé), avec la page et l'heure */
 for(const e of ev){if((e.type!=='validation-accepted'&&e.type!=='defer-finalized')||!e.identity?.pageId)continue;const t=ms(e.timestamp);if(enRelecture(t))continue;
  page(e.identity.pageId).decisions.push({t,type:e.type==='validation-accepted'?'pose':'differe',part:e.identity.part,cut:e.identity.cut,batch:e.batchId});}
 /* observations de l'observateur (sans pageId) : rangées dans la page dont la fenêtre de temps les contient */
 const obs=ev.filter(e=>e.type==='esv-observation'&&(e.kind==='diag-compteur-bloque'||(e.kind==='resource'&&e.class==='point-resource'))).map(e=>({t:ms(e.timestamp),e}));
 const listePages=[...pages.entries()].filter(([,o])=>o.captures.length).sort((a,b)=>a[1].debut-b[1].debut);
 const pageA=t=>{for(const [id,o] of listePages)if(t>=o.debut-1000&&t<=o.fin+1000)return o;return null;};
 for(const {t,e} of obs){const o=pageA(t);if(!o)continue;(o.obs??=[]).push({t,e});}
 const out=[];
 for(const [,o] of listePages){o.captures.sort((a,b)=>a.t-b.t);o.decisions.sort((a,b)=>a.t-b.t);
  const lot=o.captures.filter(c=>!c.relecture),chargeA=o.chargeA??o.debut;
  /* mort du signal : dernière capture (lot ou relecture) lue au signal ; détection par la règle de la relecture, sur les captures du lot */
  const sig=o.captures.filter(c=>c.lecture==='signal');const dernierSignal=sig.length?sig[sig.length-1].t:null;
  const premierRepliApres=dernierSignal===null?null:o.captures.find(c=>c.t>dernierSignal&&c.lecture==='repli')?.t??null;
  const det=SG.creer({actif:false});let detection=null;
  for(const c of lot){const r=SG.observer(det,{readStrategy:c.lecture==='signal'?{lecture:'rapide',attempts:[{status:'captured',attempt:1,regle:'signal'}]}:c.lecture==='repli'?{lecture:'rapide',attempts:[{status:'captured',attempt:1,regle:'stabilite'}]}:null});
   if(r.action!=='rien'&&detection===null)detection=c.t;}
  /* le signal est-il mort pour de bon dans la page ? (aucune capture au signal après la détection) */
  const reprendApres=detection===null?null:o.captures.some(c=>c.t>detection&&c.lecture==='signal');
  /* temps par cut du lot : intervalle depuis la décision précédente du même lot (≤ 120 s ; au-delà : pause, compté à part) ; lecture du cut =
   * captures du lot dans l'intervalle (« signal » si une au moins l'est, « repli » si toutes les lectures utiles le sont) */
  const cuts=[];let pauses=0;
  for(let i=1;i<o.decisions.length;i++){const a=o.decisions[i-1],b=o.decisions[i];if(a.batch!==b.batch)continue;const dt=b.t-a.t;if(dt>120000){pauses++;continue;}
   const cs=lot.filter(c=>c.t>a.t&&c.t<=b.t).map(c=>c.lecture).filter(l=>l!=='neutre');
   const lecture=!cs.length?'neutre':cs.includes('signal')?'signal':'repli';
   cuts.push({t:b.t,type:b.type,dt,lecture,ageS:Math.round((b.t-chargeA)/1000),part:b.part,cut:b.cut,apresDetection:detection!==null&&b.t>detection});}
  /* tiers de la partie (par ordre des cuts posés) */
  const poses=cuts.filter(c=>c.type==='pose');const tiers=[0,1,2].map(k=>poses.slice(Math.floor(k*poses.length/3),Math.floor((k+1)*poses.length/3)).map(c=>c.dt));
  /* cause : compteur au repli, échecs de requêtes de points */
  const nl=lot.flatMap(c=>c.nl),nlRepli=lot.filter(c=>c.lecture==='repli').flatMap(c=>c.nl);
  const bloques=(o.obs||[]).filter(x=>x.e.kind==='diag-compteur-bloque').map(x=>({t:x.t,valeur:x.e.valeur}));
  const res=(o.obs||[]).filter(x=>x.e.kind==='resource');
  const echecs=res.filter(x=>(x.e.echecs||0)>0).sort((a,b)=>a.t-b.t).map(x=>({t:x.t,echecs:x.e.echecs,statuts:x.e.statuts}));
  const cumulDebut=res.length?Math.min(...res.map(x=>(x.e.echecsCumules||0)-(x.e.echecs||0))):null,cumulFin=res.length?Math.max(...res.map(x=>x.e.echecsCumules||0)):null;
  const statuts={};for(const x of res)for(const [k,v] of Object.entries(x.e.statuts||{}))statuts[k]=(statuts[k]||0)+v;
  const sansStatut=somme(res.map(x=>x.e.sansStatut||0));
  /* Option « ligne de base par les échecs » (lecture seule, src/adapter-page.js) : une vue au repli dont le compteur, à la fin de l'attente, vaut
   * exactement le nombre de requêtes de points en échec depuis le chargement de la page, et à qui ne manquait QUE « chargements », aurait été
   * lue au signal (compteur effectif nul). `exact` : nl = échecs ; `plus` : nl > échecs (chargement réel en cours) ; `moins` : nl < échecs. */
  const echTri=echecs.map(x=>x.t).sort((a,b)=>a-b),echecsA=t=>{let n=0;for(const x of echecs)if(x.t<=t)n+=x.echecs;return n;};
  const base={vuesRepliApresEchec:0,exact:0,plus:0,moins:0,exactEtSeulManqueChargements:0,capturesRepliApresEchec:0,capturesRecuperables:0};
  for(const c of o.captures){if(c.lecture!=='repli'||!echTri.length||c.t<echTri[0])continue;base.capturesRepliApresEchec++;let toutes=true;
   for(const v of c.vues){if(v.regle!=='stabilite'||!Number.isFinite(v.nl)){toutes=false;continue;}base.vuesRepliApresEchec++;const n=echecsA(c.t);
    if(v.nl===n){base.exact++;if(v.m==='chargements')base.exactEtSeulManqueChargements++;else toutes=false;}else{toutes=false;if(v.nl>n)base.plus++;else base.moins++;}}
   if(toutes&&c.vues.length)base.capturesRecuperables++;}
  /* pages SANS échec : vues au repli à compteur non nul (la ligne de base n'y changerait rien) */
  const sansEchecNonNul=echTri.length?null:lot.filter(c=>c.lecture==='repli'&&c.nl.some(v=>v>0)).length;
  const premierNlNonNul=lot.find(c=>c.lecture==='repli'&&c.nl.some(v=>v>0))?.t??null;
  for(const c of cuts)c.apresEchec=echTri.length>0&&c.t>echTri[0];
  out.push({parts:[...o.parts].sort((a,b)=>a-b),chargeA:heure(chargeA),dureePageMin:r1((o.fin-chargeA)/60000),
   capturesLot:lot.length,signalLot:lot.filter(c=>c.lecture==='signal').length,repliLot:lot.filter(c=>c.lecture==='repli').length,
   capturesRelecture:o.captures.length-lot.length,signalRelecture:o.captures.filter(c=>c.relecture&&c.lecture==='signal').length,
   dernierSignalS:dernierSignal===null?null:Math.round((dernierSignal-chargeA)/1000),premierRepliApresS:premierRepliApres===null?null:Math.round((premierRepliApres-chargeA)/1000),
   detectionS:detection===null?null:Math.round((detection-chargeA)/1000),signalRevientApresDetection:reprendApres,
   cutsLot:cuts.length,pauses,
   parLecture:{signal:resume(cuts.filter(c=>c.type==='pose'&&c.lecture==='signal').map(c=>c.dt)),repli:resume(cuts.filter(c=>c.type==='pose'&&c.lecture==='repli').map(c=>c.dt)),
    neutre:resume(cuts.filter(c=>c.type==='pose'&&c.lecture==='neutre').map(c=>c.dt))},
   posesApresDetection:poses.filter(c=>c.apresDetection).length,tempsApresDetectionS:r1(somme(cuts.filter(c=>c.apresDetection).map(c=>c.dt))/1000),
   tiers:tiers.map(resume),
   cause:{nlAuRepli:Object.fromEntries(Object.entries(nlRepli.reduce((m,v)=>(m[v]=(m[v]||0)+1,m),{}))),nlToutes:nl.length,
    compteurBloque:bloques.length?{episodes:bloques.length,premierS:Math.round((bloques[0].t-chargeA)/1000),valeurs:[...new Set(bloques.map(b=>b.valeur))]}:null,
    requetesPoints:somme(res.map(x=>x.e.ept||0)),statuts,sansStatut,echecsPage:cumulFin===null?null:cumulFin-cumulDebut,
    premierEchecS:echecs.length?Math.round((echecs[0].t-chargeA)/1000):null,echecsS:echecs.map(x=>Math.round((x.t-chargeA)/1000)),
    premierRepliCompteurNonNulS:premierNlNonNul===null?null:Math.round((premierNlNonNul-chargeA)/1000),dernierSignalAvantEchecS:echTri.length&&dernierSignal!==null?Math.round((echTri[0]-Math.max(...sig.filter(c=>c.t<=echTri[0]).map(c=>c.t),-Infinity))/1000):null,
    ligneDeBase:base,capturesRepliCompteurNonNulSansEchec:sansEchecNonNul},
   _cuts:cuts,_recup:base.capturesRepliApresEchec?base.capturesRecuperables/base.capturesRepliApresEchec:0});}
 return out;}

/* Gain d'un rechargement : pour chaque page où la règle détecte la mort pendant le lot, les cuts du lot après la détection passent du temps
 * mesuré au repli au temps mesuré au signal de la même page (sinon du même journal), moins le coût du rechargement (SUPPOSÉ, paramètre).
 * Deux bornes : haute (le signal tient jusqu'à la fin du lot de la page) ; prudente (le signal reneuf retient la durée de vie mesurée des
 * pages qui l'ont perdu, médiane ; au-delà, retour au repli, et plafond de 1 rechargement : pas d'autre). Intervalle : bootstrap des cuts (2 000). */
function gain(pages,{coutS=20,tirages=2000,seed=62}={}){const R=alea(seed);
 const signalTous=pages.flatMap(p=>p._cuts.filter(c=>c.type==='pose'&&c.lecture==='signal').map(c=>c.dt));
 const vies=tri(pages.filter(p=>p.detectionS!==null).map(p=>p.detectionS));const vieMed=quantile(vies,.5);
 const touchees=pages.filter(p=>p.detectionS!==null&&p._cuts.some(c=>c.apresDetection));
 /* Par page touchée : cuts du lot après la détection, séparés en « dans la vie médiane du signal reneuf » et « au-delà ». */
 const P=touchees.map(p=>{const apres=p._cuts.filter(c=>c.apresDetection),t0=apres[0].t;const sig=p._cuts.filter(c=>c.type==='pose'&&c.lecture==='signal').map(c=>c.dt);
  return {base:sig.length>=20?sig:signalTous,dans:apres.filter(c=>c.t-t0<=vieMed*1000).map(c=>c.dt),au:apres.filter(c=>c.t-t0>vieMed*1000).map(c=>c.dt)};});
 const calc=(tire)=>{let haut=0,prudent=0;
  for(const p of P){const med=quantile(tri(tire(p.base)),.5);const g=l=>somme(tire(l).map(v=>Math.max(0,v-med)));const gd=g(p.dans),ga=g(p.au);
   haut+=gd+ga-coutS*1000;prudent+=gd-coutS*1000;}
  return {haut,prudent};};
 const ident=a=>a,reech=a=>a.map(()=>a[Math.floor(R()*a.length)]);
 const pt=calc(ident),bs=[];for(let k=0;k<tirages;k++)bs.push(calc(reech));
 const iv=k=>{const s=tri(bs.map(x=>x[k]));return [r0(quantile(s,.05)/1000),r0(quantile(s,.95)/1000)];};
 const total=somme(pages.flatMap(p=>p._cuts.map(c=>c.dt)));
 /* Ligne de base par les échecs (sans rechargement, sans coût) : cuts du lot après le premier échec de la page, au signal de la page, pondérés
  * par la part des captures au repli que la ligne de base aurait rendues au signal (mesurée dans la page). */
 const E=pages.filter(p=>p._cuts.some(c=>c.apresEchec)).map(p=>{const sig=p._cuts.filter(c=>c.type==='pose'&&c.lecture==='signal').map(c=>c.dt);
  return {base:sig.length>=20?sig:signalTous,apres:p._cuts.filter(c=>c.apresEchec).map(c=>c.dt),recup:p._recup};});
 const calcE=tire=>somme(E.map(p=>{const med=quantile(tri(tire(p.base)),.5);return p.recup*somme(tire(p.apres).map(v=>Math.max(0,v-med)));}));
 const ptE=calcE(a=>a),bsE=tri(Array.from({length:tirages},()=>calcE(reech)));
 return {coutRechargementS:coutS,vieDuSignalMedianeS:r0(vieMed),viesS:vies,pagesTouchees:touchees.length,
  hautS:r0(pt.haut/1000),hautIntervalle90:iv('haut'),prudentS:r0(pt.prudent/1000),prudentIntervalle90:iv('prudent'),tempsLotS:r0(total/1000),
  partHaute:r1(100*pt.haut/total),partPrudente:r1(100*pt.prudent/total),
  ligneDeBase:{pages:E.length,gainS:r0(ptE/1000),intervalle90:[r0(quantile(bsE,.05)/1000),r0(quantile(bsE,.95)/1000)],part:r1(100*ptE/total)}};}

if(require.main===module){const a=process.argv.slice(2),journaux=[];let sortie=null,cutsF=null,cout=20;
 for(let i=0;i<a.length;i++){if(a[i]==='--journal')journaux.push(a[++i]);else if(a[i]==='--sortie')sortie=a[++i];else if(a[i]==='--cuts')cutsF=a[++i];else if(a[i]==='--cout')cout=Number(a[++i]);}
 const res={format:'ch062-signal-lot-1',journaux:[]},toutes=[];
 for(const f of journaux){const j=JSON.parse(fs.readFileSync(f,'utf8'));const pages=analyser(j).filter(p=>p.cutsLot>0||p.capturesLot>0);toutes.push(...pages);
  res.journaux.push({version:j.version||null,pages:pages.map(({_cuts,...p})=>p),gain:gain(pages,{coutS:cout})});}
 res.gainTotal=gain(toutes,{coutS:cout});
 const P=l=>toutes.flatMap(p=>p._cuts.filter(c=>c.type==='pose'&&c.lecture===l).map(c=>c.dt));
 const R=alea(7),A=P('signal'),B=P('repli'),reech=a=>a.map(()=>a[Math.floor(R()*a.length)]);
 const d=tri(Array.from({length:2000},()=>quantile(tri(reech(B)),.5)-quantile(tri(reech(A)),.5)));
 res.parCutPose={signal:resume(A),repli:resume(B),ecartMedianMs:r0(quantile(tri(B),.5)-quantile(tri(A),.5)),ecartIntervalle90:[r0(quantile(d,.05)),r0(quantile(d,.95))]};
 const txt=JSON.stringify(res,null,1);if(sortie)fs.writeFileSync(sortie,txt);else process.stdout.write(txt+'\n');
 if(cutsF)fs.writeFileSync(cutsF,JSON.stringify(toutes.flatMap(p=>p._cuts.map(c=>({parts:p.parts,...c,t:undefined})))));}
module.exports={analyser,gain,enCapture};

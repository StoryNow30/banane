#!/usr/bin/env node
'use strict';
/* CH-058 — Où part le temps au fil de la journée.
 *
 * Lit les journaux d'un lot (`ariane-journal-v4-*.json`) et les segments d'une session Écho
 * (`ariane-echo-*.json`) et rend, PAR PHASE, le temps en fonction de l'heure et de la taille de
 * l'état : lot (entre deux validations), deuxième passe, relecture, corrections (ouverture et
 * `goto-cut`), changement de partie, Écho (retard du service worker sur la page, visites, captures).
 *
 * Aucune coordonnée, aucun identifiant de page ni de session n'est recopié dans la sortie : seulement
 * des durées, des comptes, des tailles et des heures (UTC, à la minute).
 *
 * Usage :
 *   node --max-old-space-size=6000 tools/ch058-temps-journee.cjs --journal J1.json [--journal J2.json …]
 *        [--echo seg01.json …] [--sortie agregats.json]
 * Sans --sortie : le JSON est écrit sur la sortie standard. */
const fs=require('fs');

/* ---------- statistiques ---------- */
const tri=a=>a.filter(Number.isFinite).sort((x,y)=>x-y);
const quantile=(s,q)=>{if(!s.length)return null;const i=(s.length-1)*q,lo=Math.floor(i),hi=Math.ceil(i);return s[lo]+(s[hi]-s[lo])*(i-lo);};
/* Intervalle de confiance à 95 % de la médiane par les rangs (loi binomiale, approximation normale) :
 * déterministe, sans tirage. Sous 6 valeurs, pas d'intervalle. */
function icMediane(s){const n=s.length;if(n<6)return null;const d=1.96*Math.sqrt(n)/2,j=Math.max(0,Math.floor(n/2-d)),k=Math.min(n-1,Math.ceil(n/2+d)-1);return [s[j],s[k]];}
const r1=x=>x===null||x===undefined?null:Math.round(x*10)/10;
function resume(valeurs){const s=tri(valeurs);if(!s.length)return {n:0};const ic=icMediane(s);
 return {n:s.length,mediane:r1(quantile(s,0.5)),ic95:ic?ic.map(r1):null,p90:r1(quantile(s,0.9)),moyenne:r1(s.reduce((a,b)=>a+b,0)/s.length),max:r1(s.at(-1))};}
/* Pente des moindres carrés et sa marge à 95 % (approximation normale) : y en fonction de x. */
function pente(points){const p=points.filter(([x,y])=>Number.isFinite(x)&&Number.isFinite(y)),n=p.length;if(n<3)return null;
 const mx=p.reduce((a,[x])=>a+x,0)/n,my=p.reduce((a,[,y])=>a+y,0)/n;let sxx=0,sxy=0;for(const [x,y] of p){sxx+=(x-mx)**2;sxy+=(x-mx)*(y-my);}
 if(!sxx)return null;const b=sxy/sxx,a=my-b*mx;let rss=0;for(const [x,y] of p)rss+=(y-a-b*x)**2;
 const se=Math.sqrt(rss/Math.max(1,n-2)/sxx);return {n,pente:b,marge95:1.96*se,origine:a};}

/* ---------- outils ---------- */
const ms=t=>{const v=Date.parse(t);return Number.isFinite(v)?v:null;};
const minute=t=>typeof t==='string'?t.slice(0,16)+'Z':null;
const partieDuCutId=id=>{const p=String(id||'').split('|');const v=Number(p[1]);return Number.isInteger(v)?v:null;};
function grouper(liste,cle){const m=new Map();for(const x of liste){const k=cle(x);if(k===null||k===undefined)continue;if(!m.has(k))m.set(k,[]);m.get(k).push(x);}return m;}
const taille=x=>x===undefined?0:Buffer.byteLength(JSON.stringify(x??null));
/* Écarts successifs (secondes) entre événements d'un même groupe, triés par heure. */
function ecarts(evts,groupe){const out=[];for(const [,l] of grouper(evts,groupe)){const s=l.map(e=>({t:ms(e.timestamp),e})).filter(x=>x.t!==null).sort((a,b)=>a.t-b.t);
 for(let i=1;i<s.length;i++)out.push({t:s[i].t,heure:minute(s[i].e.timestamp),s:(s[i].t-s[i-1].t)/1000,e:s[i].e});}return out;}

/* ---------- journal d'un lot ---------- */
/* Les événements que `Engine.event` émet SANS sauvegarde (src/engine.js, EVENEMENTS_SANS_SAUVEGARDE) ;
 * les autres, s'ils viennent du moteur, déclenchent `save()`. Les événements « simples » du service
 * worker (journalerSimple, relecture, observateur ESV) n'en déclenchent pas : liste tenue ici, mesurée
 * dans le code (background.js `journalerSimple`, `relectureJournal`, observateur `esv-observation`). */
const SANS_SAUVEGARDE=new Set(['adapter-progress','adapter-result','esv-observation','esv-releve','phase-timing','phase-timing-pli','phase-timing-pli-formes',
 'relecture-ombre','regles-metier-ombre','b1-ombre','gcv1-shadow-observed','cut-target-changed','correction-ouvrir','goto-cut','correction-liste',
 'file-parties','file-parties-changement','relecture-debut','relecture-fin','passe-differes-ombre','passe-differes-ombre-fin','clic-hors-vue','clic-hors-vue-bilan',
 'voie-predite-ombre','garde-apres-differe','garde-apres-differe-suivant','contrat-esv','avis-contrat-esv','releve-selecteur-parties','reconnexion-auto',
 'correction-partie','correction-partie-tentative','correction-debut','correction-fin','correction-couverture','dernier-cut-detecte','dernier-cut-par-liste',
 'eveil-demande','eveil-relache','veille-detectee','passe-differes-ecriture','passe-differes-ecriture-fin','validation-en-place','defer-command-possible']);

function analyserJournal(j,nom){
 const ev=Array.isArray(j.events)?j.events:[];const parType=grouper(ev,e=>e.type);const de=t=>parType.get(t)||[];
 const r={nom,format:j.format||null,version:j.version||null,evenements:ev.length,
  etatFinal:etatParCles(j.state),machine:j.machine?{memoireJsMo:j.machine.memoireJsMo||null,coeurs:j.machine.coeurs??null,memoireGo:j.machine.memoireGo??null}:null,
  phases:{}};
 /* Lot : écart entre deux validations acceptées d'un même lot, par partie. Un écart > 60 s est une pause
  * (ou un arrêt) : compté à part, exclu de la médiane « travail ». */
 const val=ecarts(de('validation-accepted'),e=>e.batchId||null);
 r.phases.lot=parPartie(val.map(x=>({...x,part:partieDuCutId(x.e.cutId)})),60);
 /* Temps passé par le service worker dans chaque cut (pli des étapes, ms). */
 const plis=de('phase-timing-pli').map(e=>({part:e.ctx?.identity?.part??null,s:e.r?.s||{}}));
 const etapes=['command:capture','analysis-envelope','facade-total','command:validateAndNext','command:apply','command:state','observe-lot','command-lot'];
 r.phases.lotEtapesSw={};for(const [part,l] of grouper(plis,x=>x.part)){const o={n:l.length};
  for(const et of etapes){const v=l.map(x=>Array.isArray(x.s[et])?x.s[et][1]:null).filter(Number.isFinite);if(v.length)o[et]=resume(v);}
  r.phases.lotEtapesSw[part]=o;}
 /* Relecture : écart entre deux cuts relus d'un même lot. */
 const rel=ecarts(de('relecture-ombre'),e=>e.lotId||e.batchId||null);
 r.phases.relecture=parPartie(rel.map(x=>({...x,part:x.e.identity?.part??null})),60);
 r.phases.relectureFin=de('relecture-fin').map(e=>({heure:minute(e.timestamp),faits:e.faits??null,dureeS:r1((e.dureeMs??NaN)/1000),sParCut:e.faits?r1(e.dureeMs/1000/e.faits):null}));
 /* Deuxième passe (ombre et écriture). */
 r.phases.passe={ombre:resume(ecarts(de('passe-differes-ombre'),e=>e.batchId||null).filter(x=>x.s<=60).map(x=>x.s)),
  ecriture:resume(ecarts(de('passe-differes-ecriture'),e=>e.batchId||null).filter(x=>x.s<=60).map(x=>x.s))};
 /* Corrections : durée de `goto-cut` (mesurée par le SW), écart entre deux ouvertures (geste humain compris). */
 const go=de('goto-cut').map(e=>({t:ms(e.timestamp),heure:minute(e.timestamp),d:e.dureeMs,dp:e.dureePageMs}));
 const ouv=ecarts(de('correction-ouvrir'),()=>'c');
 r.phases.correction={gotoCutMs:resume(go.map(x=>x.d)),gotoCutPageMs:resume(go.map(x=>x.dp)),
  gotoCutParQuart:parTranche(go.map(x=>({t:x.t,v:x.d})),15),
  entreOuverturesS:resume(ouv.filter(x=>x.s<=600).map(x=>x.s)),entreOuverturesParQuart:parTranche(ouv.filter(x=>x.s<=600).map(x=>({t:x.t,v:x.s})),15),
  penteEntreOuvertures:pentePar(ouv.filter(x=>x.s<=600).map(x=>({t:x.t,v:x.s})),'s par heure')};
 /* Changement de partie (réussi). */
 r.phases.changementPartie=de('file-parties-changement').filter(e=>e.issue==='ok').map(e=>({heure:minute(e.timestamp),de:e.de?.part??null,vers:e.vers??null,dureeS:r1(e.dureeMs/1000),
  jalons:e.jalons?{rechargee:e.jalons.rechargee??null,chargee:e.jalons.chargee??null,partieLue:e.jalons.partieLue??null}:null}));
 /* Début de relecture : `vertsAControler` lit TOUT le magasin `events` d'IndexedDB (background.js). Écart entre le dernier événement
  * utile et `relecture-debut`, contre le nombre d'événements déjà au journal (le journal plié en garde une part : le rapport
  * avant/après pli le corrige en estimation du nombre dans IndexedDB). */
 const tries=ev.filter(e=>e.timestamp).sort((a,b)=>String(a.timestamp).localeCompare(String(b.timestamp)));
 const bruit=new Set(['adapter-progress','esv-observation','adapter-result','phase-timing','phase-timing-pli']);
 const ratio=j.phaseTimingPli?.evenementsAvant&&j.phaseTimingPli?.evenementsApres?j.phaseTimingPli.evenementsAvant/j.phaseTimingPli.evenementsApres:1;
 const debuts=[];tries.forEach((e,i)=>{if(e.type!=='relecture-debut')return;let k=i-1;while(k>=0&&bruit.has(tries[k].type))k--;if(k<0)return;
  debuts.push({heure:minute(e.timestamp),apres:tries[k].type,ecartS:Math.round((ms(e.timestamp)-ms(tries[k].timestamp))/10)/100,evenementsAvantEstimes:Math.round(i*ratio)});});
 const pd=pente(debuts.map(x=>[x.evenementsAvantEstimes/10000,x.ecartS]));
 r.phases.debutRelecture={liste:debuts,penteSPar10000Evenements:pd?{n:pd.n,pente:r1(pd.pente*100)/100,marge95:r1(pd.marge95*100)/100}:null};
 /* Sauvegardes par cut : événements susceptibles de réécrire l'état, rapportés aux validations. */
 const sauv=ev.filter(e=>!SANS_SAUVEGARDE.has(e.type)&&!String(e.type).startsWith('native-')).length;
 r.sauvegardes={evenementsAvecSauvegarde:sauv,validations:de('validation-accepted').length,
  parCut:de('validation-accepted').length?r1(sauv/de('validation-accepted').length):null,
  pli:j.phaseTimingPli||null,note:'borne basse : les événements pliés (phase-timing) et les sauvegardes sans événement (locked, observe) ne sont pas comptés'};
 return r;}
function parPartie(liste,pauseS){const out={};for(const [part,l] of grouper(liste,x=>x.part)){const v=l.map(x=>x.s);
 out[part]={debut:l.length?minute(new Date(Math.min(...l.map(x=>x.t))).toISOString()):null,travail:resume(v.filter(s=>s<=pauseS)),pauses:v.filter(s=>s>pauseS).length,
  premierTiers:resume(tiers(l,0).filter(s=>s<=pauseS)),dernierTiers:resume(tiers(l,2).filter(s=>s<=pauseS))};}return out;}
function tiers(l,i){const s=[...l].sort((a,b)=>a.t-b.t),n=s.length,a=Math.floor(n*i/3),b=Math.floor(n*(i+1)/3);return s.slice(a,b).map(x=>x.s);}
function parTranche(liste,minutes){const pas=minutes*60000,m=grouper(liste.filter(x=>x.t!==null),x=>Math.floor(x.t/pas)*pas);
 return [...m.entries()].sort((a,b)=>a[0]-b[0]).map(([t,l])=>({heure:minute(new Date(t).toISOString()),...resume(l.map(x=>x.v))}));}
function pentePar(liste,unite){const p=liste.filter(x=>x.t!==null);if(p.length<3)return null;const t0=Math.min(...p.map(x=>x.t));
 const r=pente(p.map(x=>[(x.t-t0)/3600000,x.v]));return r?{n:r.n,pente:r1(r.pente*1000)/1000,marge95:r1(r.marge95*1000)/1000,unite}:null;}
function etatParCles(s){if(!s||typeof s!=='object')return null;const o={totalMo:r3(taille(s)/1048576),cles:{}};
 for(const [k,v] of Object.entries(s)){const t=taille(v);if(t>2048)o.cles[k]=r3(t/1048576);}
 if(s.native&&typeof s.native==='object'){o.native={};for(const [k,v] of Object.entries(s.native)){const t=taille(v);if(t>2048)o.native[k]=r3(t/1048576);}
  o.native.visites=Array.isArray(s.native.visits)?s.native.visits.length:null;o.native.cloudIds=Array.isArray(s.native.cloudIds)?s.native.cloudIds.length:null;
  o.native.exportedCloudIds=s.native.exportState?.exportedCloudIds?.length??null;o.native.releasedCloudIds=s.native.exportState?.releasedCloudIds?.length??null;
  o.native.observationPeriods=Array.isArray(s.native.observationPeriods)?s.native.observationPeriods.length:null;}
 if(s.batch&&typeof s.batch==='object'){o.batch={};for(const [k,v] of Object.entries(s.batch)){const t=taille(v);if(t>8192)o.batch[k]=r3(t/1048576);}}
 if(s.correction&&typeof s.correction==='object')o.correctionMo=r3(taille(s.correction)/1048576);
 return o;}
const r3=x=>Math.round(x*1000)/1000;

/* ---------- session Écho ---------- */
/* Heure de la page pour un événement natif (avant passage par le service worker). */
function heurePage(e){return e.event?.observedAt||e.chunk?.capturedAt||e.initialObserved?.capturedAt||e.state?.capturedAt||e.finalObserved?.capturedAt||
 e.cloud?.termination?.observedAt||e.startedAt||e.endedAt||null;}
function analyserEcho(segments){
 const vus=new Set(),evts=[],tailles=[];
 for(const {nom,j} of segments){const s=j.session||{};
  tailles.push({heure:minute(j.exportedAt),exporteA:j.exportedAt||null,sessionMo:r3(taille(s)/1048576),visites:(s.visits||[]).length,cloudIds:(s.cloudIds||[]).length,
   exportedCloudIds:s.exportState?.exportedCloudIds?.length??null,releasedCloudIds:s.exportState?.releasedCloudIds?.length??null,
   observationPeriods:(s.observationPeriods||[]).length,cles:Object.fromEntries(Object.entries(s).map(([k,v])=>[k,r3(taille(v)/1048576)]).filter(([,v])=>v>=0.005)),segment:nom});
  for(const e of j.events||[]){if(!e||vus.has(e.eventId)||!String(e.type).startsWith('native-'))continue;vus.add(e.eventId);evts.push(e);}}
 tailles.sort((a,b)=>String(a.exporteA).localeCompare(String(b.exporteA)));
 /* Taille de session au moment t : celle du dernier segment exporté avant t (palier), ou du premier. */
 const tailleA=t=>{let x=tailles[0];for(const y of tailles)if(ms(y.exporteA)<=t)x=y;return x;};
 const retards=evts.map(e=>{const tp=ms(heurePage(e)),ts=ms(e.timestamp);return tp!==null&&ts!==null?{type:e.type,t:ts,heure:minute(e.timestamp),retardS:(ts-tp)/1000,
  file:e.collectorMetrics?.queueDepth??e.metrics?.queueDepth??null}:null;}).filter(Boolean).filter(x=>x.retardS>-5&&x.retardS<600);
 const parType={};for(const [t,l] of grouper(retards,x=>x.type))parType[t]=resume(l.map(x=>x.retardS));
 const visitesDebut=grouper(evts.filter(e=>e.type==='native-visit-started'),()=>'v').get('v')||[];
 return {segments:tailles.map(({cles,...x})=>x),clesDernierSegment:tailles.at(-1)?.cles||null,evenements:evts.length,
  retardSwParType:parType,retardSwParQuart:parTranche(retards.map(x=>({t:x.t,v:x.retardS})),5),
  fileParQuart:parTranche(retards.filter(x=>Number.isFinite(x.file)).map(x=>({t:x.t,v:x.file})),5),
  penteRetardSelonVisites:(()=>{const p=pente(retards.map(x=>[tailleA(x.t)?.visites??NaN,x.retardS]));return p?{n:p.n,sParCentVisites:r1(p.pente*100*100)/100,marge95:r1(p.marge95*100*100)/100}:null;})(),
  retardSelonTaille:[...grouper(retards,x=>tailleA(x.t)?.sessionMo??null).entries()].sort((a,b)=>a[0]-b[0]).map(([mo,l])=>({sessionMo:mo,visites:tailleA(l[0].t)?.visites??null,...resume(l.map(x=>x.retardS)),
   partPlus1s:Math.round(1000*l.filter(x=>x.retardS>1).length/l.length)/1000,partPlus5s:Math.round(1000*l.filter(x=>x.retardS>5).length/l.length)/1000})),
  visitesCommencees:visitesDebut.length};}

/* ---------- ligne de commande ---------- */
function lireJson(f){return JSON.parse(fs.readFileSync(f,'utf8'));}
function main(argv){const a={journal:[],echo:[],sortie:null};
 for(let i=0;i<argv.length;i++){const k=argv[i];if(k==='--journal')a.journal.push(argv[++i]);else if(k==='--echo')a.echo.push(argv[++i]);else if(k==='--sortie')a.sortie=argv[++i];
  else if(k==='--aide'||k==='-h'){console.log('Usage : --journal J.json … --echo seg.json … [--sortie f.json]');return 0;}else throw Error('Option inconnue : '+k);}
 const out={outil:'ch058-temps-journee',journaux:a.journal.map(f=>analyserJournal(lireJson(f),f.split('/').at(-2)||'journal')),
  echo:a.echo.length?analyserEcho(a.echo.map(f=>({nom:f.split('/').at(-1).replace(/^.*?-(seg\d+)\.json$/,'$1'),j:lireJson(f)}))):null};
 const txt=JSON.stringify(out,null,1);if(a.sortie)fs.writeFileSync(a.sortie,txt+'\n');else process.stdout.write(txt+'\n');return 0;}
if(require.main===module){try{process.exitCode=main(process.argv.slice(2));}catch(e){console.error(e.message);process.exitCode=1;}}
module.exports={resume,icMediane,pente,analyserJournal,analyserEcho,etatParCles,heurePage,SANS_SAUVEGARDE};

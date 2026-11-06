#!/usr/bin/env node
'use strict';
/* CH-060 — Où part le temps d'un cut relu (relecture après le lot).
 *
 * Lit un journal de lot (`ariane-journal-v4-*.json`) et rend, PAR PARTIE, la décomposition du temps de chaque cut relu :
 *   navigation (goToCut), avant capture (readState + statut de la liste d'ESV), capture côté page (par rail : sélection du rail,
 *   attente du niveau de détail, lecture des points), transfert de la capture vers le service worker, calcul, correction,
 *   et le temps « entre deux cuts » (après le journal du cut : point de reprise, cut suivant pas encore demandé).
 * Sources : les champs `durees` des événements `relecture-ombre` (service worker, background.js `relecturePasse`) et les étapes
 * `adapter-progress` / `adapter-result` de la capture du même cut (src/adapter-page.js `capture`), reliées par le cut et l'heure.
 *
 * Aucune coordonnée, aucun identifiant de page, de lot ou de session n'est recopié : des durées, des comptes, des zones, des heures.
 *
 * Usage : node --max-old-space-size=6000 tools/ch060-relecture-temps.cjs --journal J.json [--journal …] [--sortie agregats.json] [--cuts cuts.json]
 *   --cuts : écrit aussi la liste des cuts relus décomposés (sans coordonnée), pour d'autres calculs. */
const fs=require('fs');

const tri=a=>a.filter(Number.isFinite).sort((x,y)=>x-y);
const quantile=(s,q)=>{if(!s.length)return null;const i=(s.length-1)*q,lo=Math.floor(i),hi=Math.ceil(i);return s[lo]+(s[hi]-s[lo])*(i-lo);};
const r0=x=>x===null||x===undefined||!Number.isFinite(x)?null:Math.round(x);
const r1=x=>x===null||x===undefined||!Number.isFinite(x)?null:Math.round(x*10)/10;
const somme=a=>a.reduce((x,y)=>x+(Number.isFinite(y)?y:0),0);
function resume(v){const s=tri(v);if(!s.length)return {n:0};return {n:s.length,mediane:r0(quantile(s,.5)),p90:r0(quantile(s,.9)),moyenne:r0(somme(s)/s.length),somme:r0(somme(s))};}
const ms=t=>{const v=Date.parse(t);return Number.isFinite(v)?v:null;};

/* Les étapes de la capture d'une requête (par `requestId`). `elapsedMs` est compté depuis la réception par la page. */
function capturesParRequete(ev){const m=new Map();
 for(const e of ev){if((e.type!=='adapter-progress'&&e.type!=='adapter-result')||e.action!=='capture'||!e.requestId)continue;
  let c=m.get(e.requestId);if(!c){c={part:e.identity?.part??null,cut:e.identity?.cut??null,etapes:[],resultat:null};m.set(e.requestId,c);}
  if(e.type==='adapter-result'){c.resultat={t:ms(e.timestamp),demandeA:ms(e.demandeA),elapsedMs:e.elapsedMs,error:e.error??null,detail:e.lastDetail||null};continue;}
  c.etapes.push({st:e.lastStage,el:e.elapsedMs,d:e.lastDetail||{}});}
 for(const c of m.values())c.etapes.sort((a,b)=>a.el-b.el);
 return m;}
/* Découpe d'une capture : par rail, sélection (fin de la vue précédente → `capture-wait`), attente (→ `capture-read`), lecture (→ `capture-view-ready`) ;
 * tentatives refaites (`capture-retry`) comptées ; règle d'attente (signal / stabilité) et mode de lecture (rapide / référence). */
function decouper(c){const o={rails:{},tentatives:0,lecture:null,regles:[],noeuds:null,points:null,pageMs:null,manques:[],changements:0};let fin=0;
 const fv=new Map();
 for(const x of c.etapes){const s=x.d.side;
  if(x.st==='capture-wait'){o.tentatives++;if(!fv.has(s)){fv.set(s,{sel:x.el-fin,att:0,lec:0,debut:x.el});}else{const r=fv.get(s);r.debutTentative=x.el;}fv.get(s).t=x.el;}
  else if(x.st==='capture-read'){const r=fv.get(s);if(r){r.att+=x.el-r.t;r.t=x.el;}o.lecture=x.d.lecture??o.lecture;o.regles.push(x.d.regle);if(x.d.diag?.m)o.manques.push(x.d.diag.m);
   if(Number.isFinite(x.d.diag?.nc))o.changements+=x.d.diag.nc;}
  else if(x.st==='capture-view-ready'){const r=fv.get(s);if(r){r.lec+=x.el-r.t;r.t=x.el;}fin=x.el;}
  else if(x.st==='capture-retry'){const r=fv.get(s);if(r){r.att+=x.el-r.t;r.t=x.el;}}
  else if(x.st==='capture-ready'){o.pageMs=x.el;o.noeuds=x.d.nodes??null;o.points=x.d.points??null;}}
 for(const [s,r] of fv)o.rails[s]={selectionMs:r.sel,attenteMs:r.att,lectureMs:r.lec};
 if(o.pageMs===null&&c.resultat)o.pageMs=c.resultat.elapsedMs;
 return o;}

function analyser(j){const ev=Array.isArray(j.events)?j.events:[];
 /* L'identité portée par les étapes de la page est celle que le service worker connaissait AVANT la commande (en retard d'un cut après une
  * navigation) : une capture est donc reliée au cut relu par l'heure de sa demande seule (entre la fin de la navigation et le journal du cut). */
 const caps=[...capturesParRequete(ev).values()].filter(c=>c.resultat&&Number.isFinite(c.resultat.demandeA)).sort((a,b)=>a.resultat.demandeA-b.resultat.demandeA);
 const capsEntre=(a,b)=>{let lo=0,hi=caps.length;while(lo<hi){const m=(lo+hi)>>1;if(caps[m].resultat.demandeA<a)lo=m+1;else hi=m;}
  const out=[];for(let i=lo;i<caps.length&&caps[i].resultat.demandeA<=b;i++)out.push(caps[i]);return out;};
 const ro=ev.filter(e=>e.type==='relecture-ombre'&&e.durees&&e.identity).map(e=>({e,t:ms(e.timestamp)})).sort((a,b)=>a.t-b.t);
 const steps=new Map();/* nombre de pas de goToCut par cut d'arrivée */
 const cuts=[];
 for(let i=0;i<ro.length;i++){const {e,t}=ro[i],d=e.durees,t0=t-d.totalMs,tNav=t0+d.navigationMs;
  const cand=capsEntre(tNav-5,t);
  const cap=cand[0]||null,dc=cap?decouper(cap):null,second=cand.length>1;
  const avantCapture=cap?cap.resultat.demandeA-tNav:null;
  const transfert=cap?d.captureMs-avantCapture-(dc.pageMs??0)-(second?somme(cand.slice(1).map(c=>c.resultat.elapsedMs)):0):null;
  const correction=d.totalMs-d.navigationMs-d.captureMs-d.calculMs;
  const suivant=ro[i+1];let entre=null;
  if(suivant&&suivant.e.lotId===e.lotId){const t0s=suivant.t-suivant.e.durees.totalMs;entre=t0s-t;}
  cuts.push({part:e.identity.part,cut:e.identity.cut,zone:e.zone,zoneSource:e.zoneSource??null,role:e.role,arrivee:e.arrivee??null,chemins:e.chemins||[],action:e.action,
   verdict:e.verdict??null,corriger:e.critere?.corriger===true,pireMm:Number.isFinite(e.pireMm)?e.pireMm:null,vuAvant:e.statutEsv?.vu??null,
   heure:String(e.timestamp).slice(11,16),totalMs:d.totalMs,navigationMs:d.navigationMs,captureMs:d.captureMs,calculMs:d.calculMs,correctionMs:correction,
   avantCaptureMs:avantCapture,capturePageMs:dc?.pageMs??null,transfertMs:transfert,secondeCapture:second,
   rails:dc?.rails??null,tentatives:dc?.tentatives??null,lecture:dc?.lecture??null,regles:dc?.regles??[],manques:dc?.manques??[],changements:dc?.changements??null,
   noeuds:dc?.noeuds??null,points:dc?.points??null,entreMs:entre,
   /* temps « mur » de ce cut : du début de sa navigation au début de la navigation du suivant */
   murMs:d.totalMs+(Number.isFinite(entre)?entre:0)});}
 const fins=ev.filter(e=>e.type==='relecture-fin').map(e=>({faits:e.faits,dureeMs:e.dureeMs,t:ms(e.timestamp)}));
 const debuts=ev.filter(e=>e.type==='relecture-debut').map(e=>({t:ms(e.timestamp)}));
 return {cuts,fins,debuts};}

/* Agrégat d'une liste de cuts relus : postes du temps (somme, part), cuts rapides et lents (≥ 3 s mur). */
function postes(l){const rail=(s,k)=>l.map(c=>c.rails?.[s]?.[k]);
 const P={navigation:l.map(c=>c.navigationMs),avantCapture:l.map(c=>c.avantCaptureMs),
  selectionG:rail('left','selectionMs'),attenteG:rail('left','attenteMs'),lectureG:rail('left','lectureMs'),
  selectionD:rail('right','selectionMs'),attenteD:rail('right','attenteMs'),lectureD:rail('right','lectureMs'),
  transfert:l.map(c=>c.transfertMs),calcul:l.map(c=>c.calculMs),correction:l.map(c=>c.correctionMs),entre:l.map(c=>c.entreMs)};
 const mur=somme(l.map(c=>c.murMs)),o={n:l.length,murS:r1(mur/1000),sParCut:l.length?r1(mur/1000/l.length):null,postes:{}};
 /* reste de la capture (fin de la dernière vue → capture-ready : fusion, compactage) */
 P.finCapture=l.map(c=>c.capturePageMs!==null&&c.rails?c.capturePageMs-somme(Object.values(c.rails).flatMap(r=>[r.selectionMs,r.attenteMs,r.lectureMs])):null);
 for(const [k,v] of Object.entries(P)){const s=somme(v);o.postes[k]={...resume(v),part:mur?r1(100*s/mur):null};}
 return o;}
function grouper(l,f){const m={};for(const c of l){const k=f(c);(m[k]??=[]).push(c);}return m;}
function agreger(cuts){const out={};
 for(const [part,l] of Object.entries(grouper(cuts,c=>c.part))){
  const lents=l.filter(c=>c.murMs>=3000),rapides=l.filter(c=>c.murMs<3000);
  const facteur=(f)=>Object.fromEntries(Object.entries(grouper(l,f)).map(([k,g])=>[k,{n:g.length,lents:g.filter(c=>c.murMs>=3000).length,sParCut:r1(somme(g.map(c=>c.murMs))/1000/g.length),murS:r1(somme(g.map(c=>c.murMs))/1000)}]));
  out[part]={tous:postes(l),rapides:postes(rapides),lents:postes(lents),
   parZone:facteur(c=>c.zone),parRole:facteur(c=>c.role),parArrivee:facteur(c=>c.arrivee),parAction:facteur(c=>c.action),
   parLecture:facteur(c=>c.lecture),parRegle:facteur(c=>[...new Set(c.regles)].join('+')||'aucune'),parTentatives:facteur(c=>c.tentatives),
   parChemin:facteur(c=>c.chemins.length>1?'saut+pas':c.chemins[0]||'?'),
   parVuAvant:facteur(c=>String(c.vuAvant)),
   parNoeuds:facteur(c=>c.noeuds===null?'?':c.noeuds<20?'<20':c.noeuds<40?'20-39':'40+')};}
 return out;}


/* ---------- volume : ce que la relecture trouve, selon où est le cut (à mesurer seulement, CH-060 § 3) ----------
 * Pour chaque cut relu : zone, motif de sa plage (libellé), distance au CŒUR de l'ADV la plus proche (ADV : les plages « à contrôler » des règles
 * métier, marginées de 30 cuts de chaque côté, src/regles-metier.js : cœur = [début + 30, fin − 30] ; une plage qui part de 0 est prise telle quelle),
 * distance au cut du lot (posé ou différé) le plus proche. Trouvé : corrigé (`action` « corrige »), proposé (`critere.corriger`), verdict « je corrigerais ». */
const MOTIFS=[['cut isolé','isole'],['grappe','grappe'],['autour du différé','differe'],['trou bouché','trou'],['à contrôler','a-controler'],['écartement','ecartement'],['PN','pn'],['ADV','adv']];
const motifDe=l=>{const t=String(l||'');for(const [p,m] of MOTIFS)if(t.startsWith(p))return m;return '?';};
function volume(j){const ev=Array.isArray(j.events)?j.events:[],out=[];
 const debuts=ev.filter(e=>e.type==='relecture-debut'&&e.lotId);
 for(const d of debuts){const lot=d.lotId,ro=ev.filter(e=>e.type==='relecture-ombre'&&e.lotId===lot&&e.identity&&e.action!=='navigation-refusee');if(!ro.length)continue;
  const part=ro[0].identity.part;
  /* cœurs d'ADV : une entrée par début de zone, la fin la plus grande (la zone grandit au fil des alertes) */
  const parDebut=new Map();for(const [a,z] of (d.zones?.adv||[]))parDebut.set(a,Math.max(parDebut.get(a)??-Infinity,z));
  const coeurs=[...parDebut].map(([a,z])=>[a===0?0:a+30,Math.max(a===0?0:a+30,z-30)]);
  const dAdv=c=>{if(!coeurs.length)return null;let m=Infinity;for(const [a,z] of coeurs){const v=c<a?a-c:c>z?c-z:0;if(v<m)m=v;}return m;};
  const lotCuts=[...new Set(ev.filter(e=>(e.type==='validation-accepted'||e.type==='defer-finalized')&&e.batchId===lot&&e.identity?.part===part).map(e=>e.identity.cut))].sort((a,b)=>a-b);
  const dLot=c=>{if(!lotCuts.length)return null;let lo=0,hi=lotCuts.length;while(lo<hi){const m=(lo+hi)>>1;if(lotCuts[m]<c)lo=m+1;else hi=m;}
   return Math.min(lo<lotCuts.length?Math.abs(lotCuts[lo]-c):Infinity,lo>0?Math.abs(c-lotCuts[lo-1]):Infinity);};
  for(const e of ro)out.push({part,cut:e.identity.cut,zone:e.zone,role:e.role,motif:motifDe(e.plage),distAdv:dAdv(e.identity.cut),distLot:dLot(e.identity.cut),
   corrige:e.action==='corrige',propose:e.critere?.corriger===true,jeCorrigerais:e.verdict==='je corrigerais',pireMm:Number.isFinite(e.pireMm)?e.pireMm:null,mode:e.mode??null});
  out.push(...(d.horsPlafond||[]).map(h=>({part,horsPlafond:true,motif:motifDe(h.libelle),cuts:h.fin-h.debut+1})));}
 return out;}
function tableau(l,cle){const m=new Map();for(const x of l){const k=cle(x);if(k===undefined)continue;if(!m.has(k))m.set(k,{relus:0,corriges:0,proposes:0,jeCorrigerais:0});
  const o=m.get(k);o.relus++;if(x.corrige)o.corriges++;if(x.propose)o.proposes++;if(x.jeCorrigerais)o.jeCorrigerais++;}
 return Object.fromEntries([...m].sort((a,b)=>String(a[0]).localeCompare(String(b[0]),'fr',{numeric:true})).map(([k,o])=>[k,{...o,pourCentCorriges:o.relus?r1(100*o.corriges/o.relus):null,pourCentProposes:o.relus?r1(100*o.proposes/o.relus):null,pourCentJeCorrigerais:o.relus?r1(100*o.jeCorrigerais/o.relus):null}]));}
function agregerVolume(v){const relus=v.filter(x=>!x.horsPlafond),verts=relus.filter(x=>x.role==='vert');
 const tranche=d=>d===null?undefined:d===0?'0 (cœur)':d<=5?'01-05':d<=10?'06-10':d<=15?'11-15':d<=20?'16-20':d<=25?'21-25':d<=30?'26-30':'31+ (trou enchaîné)';
 return {note:'verts relus seulement (les différés ne sont jamais corrigés) ; « proposé » = la règle prudente corrigerait ; « je corrigerais » = verdict brut à 5 mm',
  adv:{parDistanceAuCoeur:tableau(verts.filter(x=>x.zone==='adv'),x=>tranche(x.distAdv)),parDistanceAuCoeurUnParUn:tableau(verts.filter(x=>x.zone==='adv'&&x.distAdv>=1&&x.distAdv<=30),x=>String(x.distAdv).padStart(2,'0'))},
  abords:{parMotif:tableau(verts.filter(x=>x.zone==='abords'),x=>x.motif),parDistanceAuLot:tableau(verts.filter(x=>x.zone==='abords'),x=>x.distLot===null?undefined:x.distLot>=4?'4+':String(x.distLot))},
  parZone:tableau(verts,x=>x.zone),
  horsPlafond:Object.fromEntries(Object.entries(grouper(v.filter(x=>x.horsPlafond),x=>x.motif)).map(([k,l])=>[k,{plages:l.length,cutsCouverts:l.reduce((s,x)=>s+x.cuts,0)}])),
  horsPlafondParPartie:Object.fromEntries(Object.entries(grouper(v.filter(x=>x.horsPlafond),x=>x.part)).map(([k,l])=>[k,{plages:l.length,cutsCouverts:l.reduce((s,x)=>s+x.cuts,0)}]))};}

if(require.main===module){const a=process.argv.slice(2),journaux=[];let sortie=null,cutsF=null;
 for(let i=0;i<a.length;i++){if(a[i]==='--journal')journaux.push(a[++i]);else if(a[i]==='--sortie')sortie=a[++i];else if(a[i]==='--cuts')cutsF=a[++i];}
 const res={format:'ch060-relecture-temps-1',journaux:[]},tousCuts=[],tousVolume=[];
 for(const f of journaux){const j=JSON.parse(fs.readFileSync(f,'utf8')),r=analyser(j);
  const v=volume(j);tousVolume.push(...v);
  res.journaux.push({version:j.version||null,cutsRelus:r.cuts.length,fins:r.fins.map(x=>({faits:x.faits,dureeS:r1(x.dureeMs/1000)})),parties:agreger(r.cuts),volume:agregerVolume(v)});
  tousCuts.push(...r.cuts.map(c=>({journal:res.journaux.length-1,...c})));}
 res.volumeTotal=agregerVolume(tousVolume);
 const txt=JSON.stringify(res,null,1);if(sortie)fs.writeFileSync(sortie,txt);else process.stdout.write(txt+'\n');
 if(cutsF)fs.writeFileSync(cutsF,JSON.stringify(tousCuts));}
module.exports={analyser,decouper,capturesParRequete,postes,agreger,resume,volume,agregerVolume,tableau,motifDe};

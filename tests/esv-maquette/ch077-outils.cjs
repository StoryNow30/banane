'use strict';
/* CH-077 — séance de maquette pour l'essai navigateur (tests/esv-maquette/ch077-prechauffage.test.cjs) et le banc (tools/ch077-banc.cjs).
 * Maquette en mode EPT (`ept=1` : nœuds servis par adresse, en-têtes de cache, chargement par étages en XHR), observateur d'Ariane posé avant les
 * scripts de la page (table B1), vrai code de page avec la COPIE PATCHÉE de l'adaptateur (chantiers/CH-077/adapter-page.patch) et src/prechauffage.js.
 * Une transition : capture du cut affiché (le préchauffage part à la fin, s'il est allumé), pose (apply), temps mort, validation et passage au suivant,
 * puis fin de la chaîne d'étages du cut suivant (journal `ept-fin` de la maquette : durée, nœuds, nœuds servis par le cache du navigateur). */
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{spawnSync}=require('node:child_process');
const N=require('./navigateur.cjs'),S=require('../../src/settings.js');
let adaptateur=null;
/* Copie patchée de l'adaptateur (null si l'outil `patch` manque ; exception si le patch ne s'applique plus). */
function adaptateurPatche(){if(adaptateur!==null)return adaptateur;const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ch077-m-'));fs.mkdirSync(path.join(dir,'src'));
 fs.copyFileSync(path.join(N.racine,'src/adapter-page.js'),path.join(dir,'src/adapter-page.js'));
 const r=spawnSync('patch',['-s','-p1','-d',dir,'-i',path.join(N.racine,'chantiers/CH-077/adapter-page.patch')],{encoding:'utf8'});
 if(r.error?.code==='ENOENT')return null;if(r.status!==0)throw Error('le patch CH-077 ne s’applique plus : '+(r.stderr||r.stdout));
 return adaptateur=fs.readFileSync(path.join(dir,'src/adapter-page.js'),'utf8');}
const FICHIERS=[...N.PAGE_FILES.slice(0,-1),'src/prechauffage.js','src/adapter-page.js'];
const ECOUTE="window.__evts=[];addEventListener('message',e=>{if(e.source===window&&e.data&&e.data.kind==='banane5:evt')window.__evts.push(JSON.parse(JSON.stringify(e.data.event)));});";
const attendre=async(f,ms=15000,pas=20)=>{const t=Date.now();for(;;){const v=await f();if(v)return v;if(Date.now()-t>ms)throw Error('délai dépassé');await new Promise(r=>setTimeout(r,pas));}};

async function ouvrir({prechauffer=false,reglage={},maquette={}}={}){
 const R={...S.lot.chargement.prechauffer,...reglage,actif:prechauffer};
 const reglages=N.lire('src/settings.js')+`;window.BananeSettings={...window.BananeSettings,lot:{...window.BananeSettings.lot,chargement:{prechauffer:${JSON.stringify(R)}}}};`;
 const env=await N.ouvrir({maquette:{cuts:10,latence:20,lots:2,ept:1,...maquette},avantPage:[N.lire('src/esv-observer.js'),ECOUTE],fichiersPage:FICHIERS,
  contenus:{'src/adapter-page.js':adaptateurPatche(),'src/settings.js':reglages}});
 await env.injecter();
 const finCut=cut=>env.page.evaluate(c=>window.__maquette.journal.filter(e=>e.type==='ept-fin'&&e.cut===c).at(-1)||null,cut);
 const repos=()=>attendre(()=>env.page.evaluate(()=>window.Potree.numNodesLoading===0&&window.__maquette.etat().railsPrets));
 await attendre(async()=>finCut((await env.etat()).cut));await repos();
 /* Une transition ; `mortMs` : temps mort entre la fin de la capture et la validation (calcul et pose ; ~1,1 s mesuré sur le terrain, CH-078). */
 async function transition({mortMs=900}={}){
  const s=(await env.appel('state')).result,cut=s.identity.cut,requetesAvant=Object.values(env.serveur.journal.ept).reduce((a,b)=>a+b,0);
  let t=Date.now();const c=await env.appel('capture',[s]);if(c.error)throw Error('capture : '+c.error);const captureMs=Date.now()-t,finCapture=Date.now();
  t=Date.now();const a=await env.appel('apply',[s,{left:{delta:[0,-.002,.001]},right:{delta:[0,.002,-.001]}}]);if(a.error)throw Error('pose : '+a.error);const poseMs=Date.now()-t;
  const reste=mortMs-(Date.now()-finCapture);if(reste>0)await new Promise(r=>setTimeout(r,reste));
  const s2=(await env.appel('state')).result;
  t=Date.now();const v=await env.appel('validateAndNext',[s2.identity,{part:s.identity.part,end:s.identity.cut+100}]);if(v.error)throw Error('validation : '+v.error);const validationMs=Date.now()-t;
  const suivant=v.result.nextIdentity?.cut;const fin=await attendre(()=>finCut(suivant));await repos();
  const requetes=Object.values(env.serveur.journal.ept).reduce((a,b)=>a+b,0)-requetesAvant;
  const evts=await env.page.evaluate(()=>window.__evts.splice(0));
  return {cut,suivant,captureMs,poseMs,validationMs,chaineMs:fin.ms,noeuds:fin.noeuds,cache:fin.cache,requetes,evts};}
 return {env,transition,fermer:()=>env.fermer()};}
module.exports={ouvrir,adaptateurPatche,FICHIERS,attendre};

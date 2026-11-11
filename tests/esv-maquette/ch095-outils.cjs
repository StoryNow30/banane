'use strict';
/* CH-095 — séance de maquette pour les essais des deux pannes de Potree (tests/esv-maquette/ch095-*.test.cjs).
 * Maquette en forme RELEVÉE d'ESV (nœud commun, EPT laszip) avec le modèle mémoire de Potree 1.8.2 (tests/esv-maquette/ch083-outils.cjs), code de page
 * DU TRONC tel quel (src/adapter-page.js, src/prechauffage.js, aucune copie patchée), réglage LIVRÉ du préchauffage (voie potree, opération lointaine,
 * 4 chargements à la fois, pause de 10 s, `hierarchiesMax` 8) sauf les clés passées dans `reglage`.
 *  - panne 1 (`serveur.pannes({eptEchec:{http:502,fois:1}})`) : la prochaine requête de nœud reçoit 502 ; le Potree simulé garde le nœud « en cours » ;
 *  - panne 2 (`pagesHier` : niveaux par page de hiérarchie, paramètre `eptPas` de la maquette ; 1 = une page par nœud) : la boîte d'une coupe lointaine
 *    contient plus de 8 pages non lues. Défaut 7 : toute la hiérarchie dans la page racine (relevé d'ESV du 09/11), aucune panne.
 * Une transition : capture du cut affiché (le préchauffage part à la fin), pose, temps mort, validation, rails du cut suivant. Contrairement aux séances
 * de CH-083, elle N'ATTEND PAS « points affichés » : un nœud bloqué dans la boîte d'arrivée ne s'affiche jamais (c'est la panne). */
const N=require('./navigateur.cjs'),O77=require('./ch077-outils.cjs');
const LIVRE=require('../../src/settings.js').lot.chargement.prechauffer;
/* `ligneBase:false` : réglage `lot.signalEteint.ligneDeBaseEchecs` coupé (témoin : la capture retombe au repli « stabilité ») ; `prechauffer:false` : témoin sans préchauffage. */
/* CH-110 : `adaptateur` (contenu d'une copie patchée de src/adapter-page.js) et `reparation` (réglage `lot.reparationPotree` passé à la page). Par défaut la
 * réparation est COUPÉE ici : les essais CH-095 prouvent la panne elle-même (nœud gardé « en cours ») et ce qui tient malgré elle (ligne de base,
 * préchauffage) ; la réparation a ses propres essais (ch110-place-rendue). */
async function ouvrir({cuts=14,saut=1,pagesHier=7,loin=true,reglage={},decode=40,latence=60,images=true,ligneBase=true,prechauffer=true,pas=null,adaptateur=null,reparation={actif:false}}={}){
 const R={...LIVRE,memoire:{...LIVRE.memoire},loin:{...LIVRE.loin,actif:loin},...reglage,actif:prechauffer};
 const reglages=N.lire('src/settings.js')+`;window.BananeSettings={...window.BananeSettings,lot:{...window.BananeSettings.lot,chargement:{prechauffer:${JSON.stringify(R)}},signalEteint:{...window.BananeSettings.lot.signalEteint,ligneDeBaseEchecs:${ligneBase===true}}${reparation?`,reparationPotree:${JSON.stringify(reparation)}`:''}}};`;
 const env0=await N.ouvrir({maquette:{cuts,latence:20,lots:2,ept:1,...(saut>=2?{saut,...(pas?{pas}:{})}:{}),eptHier:1,eptForme:'commun',eptPas:pagesHier,eptMemoire:1,eptDecode:decode},avantPage:[N.lire('src/esv-observer.js'),O77.ECOUTE],fichiersPage:O77.FICHIERS,contenus:{'src/settings.js':reglages,...(adaptateur?{'src/adapter-page.js':adaptateur}:{})}});
 await env0.injecter();const s={env:env0,fermer:()=>env0.fermer()};
 await O77.attendre(()=>env0.page.evaluate(()=>window.__maquette.journal.some(e=>e.type==='ept-fin')&&window.Potree.numNodesLoading===0&&window.__maquette.etat().railsPrets));
 const env=s.env,page=env.page;env.serveur.pannes({eptLatenceMs:latence});
 /* La maquette n'a pas de compteur d'images (`Potree.framenumber`, lu par la règle du signal de la capture) : une image par rendu, comme les essais
  * « signal éteint ». Sans lui, toute capture attend la stabilité (800 ms) et le compteur de chargements n'est jamais consulté. */
 if(images)await page.evaluate(()=>{const t=()=>{if(window.Potree)window.Potree.framenumber=(window.Potree.framenumber||0)+1;requestAnimationFrame(t);};requestAnimationFrame(t);});
 const boite=cut=>page.evaluate(c=>window.__eptBoite(c),cut);
 const compteur=()=>page.evaluate(()=>window.Potree.numNodesLoading);
 const evenements=()=>page.evaluate(()=>window.__evts.splice(0));
 const journal=type=>page.evaluate(t=>window.__maquette.journal.filter(e=>e.type===t),type);
 const pagesLues=()=>Object.values(env.serveur.journal.eptHier||{}).reduce((a,b)=>a+b,0);
 /* Capture seule du cut affiché : durée, règle d'attente de chaque vue, relevé de la ligne de base. */
 async function capturer(){const st=(await env.appel('state')).result,t0=Date.now(),c=await env.appel('capture',[st]);if(c.error)throw Error('capture : '+c.error);
  const rs=c.result.readStrategy||{};return {st,cut:st.identity.cut,captureMs:Date.now()-t0,dureeMs:rs.durationMs??null,regles:(rs.attempts||[]).map(a=>a.regle??a.status),tentatives:(rs.attempts||[]).length,trouEchec:rs.trouEchec??null};}
 async function valider(st){const s2=(await env.appel('state')).result,v=await env.appel('validateAndNext',[s2.identity,{part:st.identity.part,end:st.identity.cut+1000}]);if(v.error)throw Error('validation : '+v.error);
  await O77.attendre(()=>page.evaluate(()=>window.__maquette.etat().railsPrets));return v.result.nextIdentity?.cut??null;}
 async function transition({mortMs=900,avantValidation=null}={}){
  const c=await capturer(),fin=Date.now();
  const a=await env.appel('apply',[c.st,{left:{delta:[0,-.002,.001]},right:{delta:[0,.002,-.001]}}]);if(a.error)throw Error('pose : '+a.error);
  const reste=mortMs-(Date.now()-fin);if(reste>0)await new Promise(r=>setTimeout(r,reste));
  const extra=avantValidation?await avantValidation(c):null;
  const suivant=await valider(c.st);
  return {...c,st:undefined,suivant,extra,evts:await evenements()};}
 return {...s,env,page,transition,capturer,boite,compteur,evenements,journal,pagesLues,pannes:p=>env.serveur.pannes({eptLatenceMs:latence,...p})};}
module.exports={ouvrir,LIVRE};

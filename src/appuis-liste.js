/* B1 (D-095) — APPUIS LUS DANS LA LISTE DES COUPES D'ESV, côté service worker.
 *
 * ESV charge au démarrage la liste des coupes d'une partie ; chaque ligne porte
 * son statut et les bords gauche/droit de la coupe en coordonnées MONDE. La
 * page d'ESV range les lignes dans l'ordre reçu et affiche « Cut N » pour la
 * ligne d'indice N (lecture du code d'ESV, mission B). L'observateur de la page
 * (src/esv-observer.js) tient cette table EN MÉMOIRE DE LA PAGE ; le service
 * worker n'en reçoit, à chaque décision, qu'une fenêtre de ±`fenetre` lignes et
 * l'indice de la ligne la plus proche d'un point.
 *
 * REPÈRE. Ariane travaille en coordonnées de scène (translation absolue omise).
 * Monde = scène + T, T constante par page (mesuré sur sept lots du 13/10 : même
 * valeur à 1 mm près, aucune rotation). T se calibre sur la première écriture
 * de validation de la séance : le corps de l'écriture (monde) moins la pose
 * corrigée d'Ariane du même cut (scène) ; les deux rails doivent donner la même
 * translation (`rigideMm`), sinon la mesure est refusée. Les écritures
 * suivantes CONTRÔLENT T : un écart de plus de `repereEcartMm` rend le repère
 * instable pour la page, et plus aucun voisin n'est lu.
 *
 * APPARIEMENT. Deux méthodes, qui doivent s'accorder : l'indice (cut N = ligne
 * N) et la géométrie (pose de départ d'ESV du cut + T contre les bords de toutes
 * les lignes). La ligne la plus proche doit être la ligne N, à `accordMm` près ;
 * sinon aucun voisin. Sans T : aucun voisin.
 *
 * APPUIS. Les lignes de la fenêtre au statut `valid` (validées par l'opérateur
 * ou par l'extraction et laissées telles quelles par l'opérateur, qui ne parcourt
 * que les invalides), ramenées en scène (− T), au format de `consistentValidated`.
 * Règle d'emploi (D-054, proposition de la partie 9) : en DERNIER RECOURS sur un
 * cut que la décision diffère, et comme GARDE DE CONTINUITÉ sur un premier
 * passage sans voie ; ailleurs la décision ne change pas. Jamais une pose du cut
 * décidé, jamais un écartement cible.
 *
 * Ce module ne commande rien. Réglage `appuisListe` (src/settings.js) : 'ombre'
 * (livré : la décision réelle est inchangée, l'hypothèse est consignée dans un
 * événement `b1-ombre`), 'actif', 'off'. Aucune position absolue ni T n'est
 * consignée : seulement des écarts (mm), des numéros de cut et des comptes. */
(function(root,factory){const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;else root.BananeAppuisListe=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){'use strict';
 const DEFAULTS=Object.freeze({fenetre:5,accordMm:20,rigideMm:2,repereEcartMm:5,delaiPageMs:600,statuts:Object.freeze(['valid'])});
 const SIDES=['left','right'],EDGES=['XLeftEdge','YLeftEdge','ZLeftEdge','XRightEdge','YRightEdge','ZRightEdge'];
 const fin=v=>typeof v==='number'&&Number.isFinite(v),v3=a=>Array.isArray(a)&&a.length===3&&a.every(fin);
 const dist=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]),r1=v=>fin(v)?Math.round(v*10)/10:null;
 const int=(v,max)=>Number.isInteger(v)&&v>=0&&v<=max?v:null;

 /* Bords d'un corps d'écriture d'ESV (monde), ou null. */
 function bordsCorps(body){if(!body||typeof body!=='object')return null;const e=EDGES.map(k=>body[k]);
  return e.every(fin)?{left:e.slice(0,3),right:e.slice(3)}:null;}
 /* Translation monde − scène sur une écriture et la pose corrigée du même cut. */
 function mesurerT(bords,corrige,cfg=DEFAULTS){
  if(!bords||!SIDES.every(s=>v3(bords[s])&&v3(corrige?.[s])))return null;
  const d=Object.fromEntries(SIDES.map(s=>[s,[0,1,2].map(i=>bords[s][i]-corrige[s][i])]));
  const rigideMm=dist(d.left,d.right)*1000;
  return {T:[0,1,2].map(i=>(d.left[i]+d.right[i])/2),rigideMm,ok:rigideMm<=cfg.rigideMm};
 }
 /* Repère d'une page (identifiant de scène) : la première mesure rigide fixe T, les suivantes la contrôlent. */
 function noterRepere(repere,frameId,mesure,cfg=DEFAULTS){
  if(!mesure)return repere;
  const meme=repere&&repere.frameId===frameId;
  if(!mesure.ok){if(meme)repere.refusees++;return meme?repere:{frameId,T:null,paires:0,ecartMaxMm:0,refusees:1,etat:'sans-mesure'};}
  if(!meme||!repere.T)return {frameId,T:mesure.T,paires:1,ecartMaxMm:0,refusees:meme?repere.refusees:0,etat:'calibre'};
  const e=dist(repere.T,mesure.T)*1000;repere.paires++;repere.ecartMaxMm=Math.max(repere.ecartMaxMm,e);
  if(e>cfg.repereEcartMm)repere.etat='instable';
  return repere;
 }
 /* Ce que le journal garde du repère : jamais T. */
 const resumeRepere=R=>R?{etat:R.etat,paires:R.paires,ecartMaxMm:r1(R.ecartMaxMm),refusees:R.refusees}:null;
 /* Réponse de la page (source NON FIABLE) : relue champ par champ, bornée à la fenêtre demandée. */
 function lireReponse(r,{cut,fenetre=DEFAULTS.fenetre}={}){
  if(!r||typeof r!=='object')return {ok:false,reason:'sans-reponse'};
  if(r.ok!==true)return {ok:false,reason:typeof r.reason==='string'&&/^[\w-]{1,40}$/.test(r.reason)?r.reason:'refus'};
  const t=r.table&&typeof r.table==='object'?r.table:{};
  const table={lignes:int(t.lignes,1e7),pages:int(t.pages,1e6),fraiches:int(t.fraiches,1e7),debut:t.debut===true,rompue:t.rompue===true,tronquee:t.tronquee===true,tables:int(t.tables,100)};
  const g=r.geo&&typeof r.geo==='object'?r.geo:null;
  const geo=g&&int(g.index,1e7)!==null&&fin(g.mm)&&g.mm>=0?{index:g.index,mm:g.mm,secondMm:fin(g.secondMm)?g.secondMm:null}:null;
  const rows=[],vus=new Set();
  for(const x of Array.isArray(r.rows)?r.rows.slice(0,2*fenetre+1):[]){
   const i=int(x?.i,1e7);if(i===null||Math.abs(i-cut)>fenetre||vus.has(i))continue;vus.add(i);
   const e=Array.isArray(x.e)&&x.e.length===6&&x.e.every(fin)?x.e:null;
   rows.push({i,statut:['valid','invalid','skipped'].includes(x.s)?x.s:'autre',operateur:x.t===true,vu:x.v===true,fraiche:x.f===true,bords:e?{left:e.slice(0,3),right:e.slice(3)}:null});}
  return {ok:true,table,geo,rows};
 }
 /* Accord de l'indice et de la géométrie : la ligne la plus proche de la pose de départ est la ligne N. */
 function accord(rep,cut,cfg=DEFAULTS){
  const geo=rep?.geo,raison=!geo?'sans-geometrie':!rep.table.debut?'debut-non-vu':rep.table.rompue?'table-rompue':geo.index!==cut?'indice-different':geo.mm>cfg.accordMm?'trop-loin':null;
  return {ok:raison===null,raison,indiceGeo:geo?.index??null,ecartIndice:geo?geo.index-cut:null,geoMm:r1(geo?.mm),secondMm:r1(geo?.secondMm)};
 }
 /* Voisins validés de la fenêtre, en scène, au format de `consistentValidated`. */
 function appuis(rows,T,identity,cfg=DEFAULTS){
  if(!v3(T))return [];
  return (rows||[]).filter(x=>x.i!==identity.cut&&cfg.statuts.includes(x.statut)&&x.bords&&SIDES.every(s=>v3(x.bords[s])))
   .map(x=>({identity:{part:identity.part,cut:x.i,frameId:identity.frameId??null},positions:Object.fromEntries(SIDES.map(s=>[s,x.bords[s].map((v,k)=>v-T[k])])),stage:'list-validated'}));
 }
 /* Comptes de la fenêtre (le cut décidé exclu). */
 function compter(rows,cut){const n={lignes:0,valid:0,invalid:0,skipped:0,autre:0,operateur:0,fraiches:0,sansBords:0};
  for(const x of rows||[]){if(x.i===cut)continue;n.lignes++;n[x.statut]++;if(x.operateur)n.operateur++;if(x.fraiche)n.fraiches++;if(!x.bords)n.sansBords++;}return n;}
 /* Règle d'emploi : dernier recours (cut différé) ; garde de continuité d'un premier passage sans voie. */
 function regle(d0){
  if(d0?.stage==='deferred')return 'dernier-recours';
  if(d0?.stage==='first-pass'&&d0.guardMm==null)return 'garde-premier-passage';
  return 'inchange';
 }
 function politique(d0,validated,decide){const r=validated?.length?regle(d0):'inchange';return {regle:r,decision:r==='inchange'?d0:decide(validated)};}
 /* Écart entre la décision réelle et l'hypothèse : pose ajoutée, retirée, déplacée (mm, pire rail), ou aucun. */
 function comparer(d0,d1){
  const pose=d=>!!d&&d.stage!=='deferred'&&!!d.positions&&SIDES.every(s=>v3(d.positions[s]));
  const ecartMm=pose(d0)&&pose(d1)?r1(Math.max(...SIDES.map(s=>dist(d0.positions[s],d1.positions[s])*1000))):null;
  const changement=d0===d1?'aucun':pose(d0)&&!pose(d1)?'pose-retiree':!pose(d0)&&pose(d1)?'pose-ajoutee':pose(d0)&&ecartMm>1?'pose-deplacee':'aucun';
  return {changement,ecartPoseMm:ecartMm};
 }
 const resumeDecision=d=>d?{stage:d.stage??null,reason:d.reason??null,anchorsUsed:(d.anchorsUsed||[]).slice(0,12),validatedAnchors:d.validatedAnchors?d.validatedAnchors.slice(0,12):null,
  guardMm:d.guardMm??null,fromPredictionMm:d.fromPredictionMm??null,gaugeMm:d.gaugeMm??null}:null;
 return {DEFAULTS,EDGES,bordsCorps,mesurerT,noterRepere,resumeRepere,lireReponse,accord,appuis,compter,regle,politique,comparer,resumeDecision};
});

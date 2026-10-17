(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory(require('../vendor/capture-core.js'));
  else root.BananeRelectureOmbre=factory(root.BananeCaptureCore);
})(typeof globalThis!=='undefined'?globalThis:this,function(C){
 'use strict';
 /* 5.0 (D-170, D-171, D-172) — RELECTURE APRÈS LE LOT, EN OMBRE (fiches/RELECTURE_OMBRE.md).
  *
  * Mic relit en Écho, après un lot Orbite, les cuts qu'il juge à risque, verts compris (fiches/METHODE_MIC_P29.md). La 5.0 doit
  * savoir le faire elle-même (D-170). Accord de Mic (D-171) : d'abord SANS RIEN MODIFIER. Ce module est la partie PURE de cette
  * passe : il choisit les cuts et juge ce qu'Ariane donnerait. Il ne commande rien, ne lit rien d'ESV, n'écrit rien : tout lui est
  * passé. La visite elle-même (navigation par les boutons d'ESV, capture) est dans background.js et src/adapter-page.js.
  *
  * SÉLECTION (`selection`), sur la partie du lot :
  *   - cut isolé du lot (seul à `grappe.trouCuts` cuts) : le cut d'avant et le cut d'après (Mic, cuts 323, 335, 411) ;
  *   - deux cuts du lot proches : du cut d'avant le premier au cut d'après le dernier ;
  *   - grappe (au moins `grappe.min` cuts du lot, trous de `grappe.trouCuts` au plus) : toute la plage sans trou, `grappe.marge`
  *     cuts de marge de chaque côté (Mic : 456–468, 495–504 ; règles métier : marge de grappe 3) ;
  *   - différé : `differe.marge` cuts de chaque côté, et le différé lui-même (il reste invalide dans ESV) ;
  *   - PN et ADV : les plages À CONTRÔLER des règles métier, déjà marginées (PN : 4 avant, 6 après ; ADV : 30 de chaque côté) ;
  *   - « À contrôler » : les plages de la liste des verts à contrôler (src/verts-a-controler.js).
  *   Les plages à `fusionTrouCuts` cuts ou moins l'une de l'autre sont fondues (Mic ne laisse pas de trou). Bornes : 0 et `total − 1`.
  *   D-172 : aucun cut n'est exclu, les premiers cuts d'une partie compris.
  *   Rôle de chaque cut d'une plage : `vert` (hors du lot, laissé valide par ESV), `differe` (cut du lot différé : encore invalide),
  *   `lot` (cut posé et validé par le lot : traversé, pas relu, sauf `relireCutsDuLot`).
  *   ORDRE : par plages, dans l'ordre des cuts, comme Mic parcourt. PLAFOND : `plafondCuts` cuts relus au plus ; les plages sont
  *   gardées ENTIÈRES (un PN à moitié contrôlé laisse des erreurs de 30 à 40 mm), par priorité de motif (`priorites`), puis remises
  *   dans l'ordre des cuts ; une plage qui ne tient pas est rendue dans `horsPlafond`, sauf si rien n'est encore gardé : elle est
  *   alors coupée au plafond (son début). Le plafond en minutes est tenu pendant la passe (background.js).
  *   Compatible avec l'étude hors ligne (claude/50-zones-autonomes) : même entrée que les règles métier et les verts à contrôler,
  *   sortie en numéros de cut seulement.
  *
  * JUGEMENT (`juger`) d'un cut visité : la pose actuelle d'ESV (celle de la capture), la pose qu'Ariane donnerait (décision sur le
  * lot, moteur et appuis du lot ; corrigée de la hauteur apprise quand elle ne s'abstient pas), l'écart par rail dans le repère profil
  * du rail (longitudinal, latéral, vertical, mm), le pire écart (latéral ou vertical), le verdict (« je corrigerais » au-delà de
  * `seuilCorrigerMm`, sinon « je laisserais ») et sa raison. Le seuil de 5 mm vient du bruit de la référence (D-158 : 5 mm a un sens
  * comme taux sur une partie, la zone grise va de 3,6 à 6,4 mm ; `zoneGrise` le dit).
  *
  * SKIP EN OMBRE (`skipOmbre`, règle métier de Mic, D-172) : un cut ne se SKIP que si AUCUN point n'est affiché, ou si UN SEUL scanner
  * l'est. Le nombre de points par rail est dans la capture (`quality.perRail`) : « aucun-point » quand les deux sont nuls. Le scanner
  * d'un point n'y est PAS : un seul nuage Potree par capture, attributs `intensity` et `classification` seulement (aucun
  * `pointSourceID` relevé sur le terrain). `scanners` reste donc `null`, `scannersLisibles` faux : rien n'est deviné. Consigné
  * seulement : aucun SKIP n'est envoyé. */
 const VERSION='relecture-ombre-v1';
 const DEFAULTS=Object.freeze({version:VERSION,
  isole:Object.freeze({marge:1}),differe:Object.freeze({marge:2}),grappe:Object.freeze({trouCuts:5,min:3,marge:3}),
  fusionTrouCuts:3,relireCutsDuLot:false,
  priorites:Object.freeze(['pn','adv','grappe','differe','isole','a-controler']),
  plafondCuts:120,
  /* Temps par cut relu (s) pour l'estimation : navigation d'un pas, capture, calcul, visite au moins `visiteMinMs`. Mesuré au banc
   * (fiches/RELECTURE_OMBRE.md § 6) ; Mic : 3,7 s par vert relu en partie 29. Un cut traversé : un pas et sa pause. */
  tempsParCutS:4,tempsTraverseS:1,
  seuilCorrigerMm:5,zoneGrise:Object.freeze([3.6,6.4])});
 const SIDES=['left','right'],NOM={left:'gauche',right:'droit'};
 const LIBELLE={pn:'PN',adv:'ADV',grappe:'grappe',differe:'autour du différé',isole:'cut isolé','a-controler':'à contrôler'};
 const entier=v=>Number.isInteger(v)&&v>=0;
 const r1=v=>Number.isFinite(v)?Math.round(v*10)/10+0:null;
 const um=v=>Math.round(v*1e6)/1e6;
 const fusion=(a,b)=>{const o={...a};for(const [k,v] of Object.entries(b||{}))o[k]=v&&typeof v==='object'&&!Array.isArray(v)&&a[k]&&typeof a[k]==='object'?{...a[k],...v}:v;return o;};
 const cfgDe=o=>o?fusion(DEFAULTS,o):DEFAULTS;
 const tiret=(a,b)=>a===b?String(a):`${a}–${b}`;

 /* Plages [a, b] lisibles : [a, b], {debut, fin}, {controle:[a, b]} ou un cut seul. */
 function plage(x){
  if(entier(x))return [x,x];
  if(Array.isArray(x)&&x.length===2&&x.every(entier)&&x[0]<=x[1])return [x[0],x[1]];
  if(x&&Array.isArray(x.controle))return plage(x.controle);
  if(x&&entier(x.debut)&&entier(x.fin)&&x.debut<=x.fin)return [x.debut,x.fin];
  return null;}

 /* Plages de la méthode de Mic autour des cuts du lot : isolés, paires, grappes, différés. */
 function plagesDuLot(lot,cfg){const out=[],cuts=[...new Set(lot.map(x=>x.cut))].sort((a,b)=>a-b);
  const groupes=[];for(const c of cuts){const g=groupes.at(-1);if(g&&c-g.at(-1)<=cfg.grappe.trouCuts)g.push(c);else groupes.push([c]);}
  for(const g of groupes){const a=g[0],z=g.at(-1);
   if(g.length>=cfg.grappe.min)out.push({a:a-cfg.grappe.marge,z:z+cfg.grappe.marge,motif:'grappe'});
   else out.push({a:a-cfg.isole.marge,z:z+cfg.isole.marge,motif:'isole'});}
  for(const x of lot)if(x.differe)out.push({a:x.cut-cfg.differe.marge,z:x.cut+cfg.differe.marge,motif:'differe'});
  return out;}

 function selection(entree,options){const cfg=cfgDe(options),e=entree&&typeof entree==='object'?entree:{};
  const total=entier(e.total)&&e.total>0?e.total:null,max=total!==null?total-1:Infinity;
  const lot=(Array.isArray(e.lot)?e.lot:[]).filter(x=>entier(x?.cut)&&x.cut<=max).map(x=>({cut:x.cut,differe:x.differe===true}));
  const differes=new Set(lot.filter(x=>x.differe).map(x=>x.cut)),poses=new Set(lot.filter(x=>!x.differe&&!differes.has(x.cut)).map(x=>x.cut));
  const brutes=plagesDuLot(lot,cfg);
  for(const [cle,motif] of [['zonesPN','pn'],['zonesADV','adv'],['aControler','a-controler']])
   for(const x of Array.isArray(e[cle])?e[cle]:[]){const p=plage(x);if(p)brutes.push({a:p[0],z:p[1],motif});}
  /* Bornes de la partie, puis fusion des plages qui se touchent ou laissent un trou de `fusionTrouCuts` cuts au plus. */
  const bornees=brutes.map(p=>({...p,a:Math.max(0,p.a),z:Math.min(max,p.z)})).filter(p=>p.a<=p.z).sort((x,y)=>x.a-y.a||x.z-y.z);
  const fondues=[];
  for(const p of bornees){const d=fondues.at(-1);
   if(d&&p.a-d.z-1<=cfg.fusionTrouCuts){d.z=Math.max(d.z,p.z);d.motifs.add(p.motif);}
   else fondues.push({a:p.a,z:p.z,motifs:new Set([p.motif])});}
  const rang=m=>{const i=cfg.priorites.indexOf(m);return i<0?cfg.priorites.length:i;};
  const decrire=(a,z,motifs)=>{const ms=[...motifs].sort((x,y)=>rang(x)-rang(y)),cuts=[],traverses=[];
   for(let c=a;c<=z;c++){if(poses.has(c)&&!cfg.relireCutsDuLot)traverses.push(c);else cuts.push({cut:c,role:differes.has(c)?'differe':poses.has(c)?'lot':'vert'});}
   return {debut:a,fin:z,motifs:ms,priorite:rang(ms[0]),libelle:`${LIBELLE[ms[0]]||ms[0]} ${tiret(a,z)}`,cuts,traverses};};
  const candidates=fondues.map(p=>decrire(p.a,p.z,p.motifs));
  /* Plafond : plages entières, par priorité puis ordre des cuts. */
  const gardees=[],horsPlafond=[];let reste=entier(cfg.plafondCuts)?cfg.plafondCuts:Infinity;
  for(const p of [...candidates].sort((x,y)=>x.priorite-y.priorite||x.debut-y.debut)){
   if(p.cuts.length<=reste){gardees.push(p);reste-=p.cuts.length;continue;}
   if(!gardees.length&&reste>0){const coupe=p.cuts[reste-1].cut;gardees.push(decrire(p.debut,coupe,p.motifs));
    horsPlafond.push({debut:coupe+1,fin:p.fin,motifs:p.motifs,libelle:p.libelle,raison:'plafond-cuts'});reste=0;continue;}
   horsPlafond.push({debut:p.debut,fin:p.fin,motifs:p.motifs,libelle:p.libelle,raison:'plafond-cuts'});}
  gardees.sort((x,y)=>x.debut-y.debut);horsPlafond.sort((x,y)=>x.debut-y.debut);
  const cuts=gardees.flatMap((p,i)=>p.cuts.map(c=>({...c,plage:i})));
  const traverses=gardees.reduce((n,p)=>n+p.traverses.length,0);
  return {format:'ariane-relecture-selection-1',version:cfg.version,partie:entier(e.partie)?e.partie:null,total:cuts.length,traverses,
   tempsEstimeS:Math.round(cuts.length*cfg.tempsParCutS+traverses*cfg.tempsTraverseS),plafondCuts:Number.isFinite(reste)?cfg.plafondCuts:null,
   plages:gardees.map(p=>({debut:p.debut,fin:p.fin,motifs:p.motifs,libelle:p.libelle,relus:p.cuts.length,traverses:p.traverses})),
   cuts,horsPlafond};}

 /* ----------------------------------------------------------------- jugement */
 /* Écart (mm) d'une position scène à la pose actuelle d'ESV, dans le repère profil du rail : longitudinal, latéral, vertical. */
 function ecartRail(rail,p){const M=rail.sceneRelativeToProfileLocal,a=C.point(M,p),o=C.point(M,rail.positionSceneRelative);
  const d=[0,1,2].map(i=>(a[i]-o[i])*1000);return {long:r1(d[0]),lat:r1(d[1]),vert:r1(d[2])};}
 /* La pose qu'Ariane donnerait : celle de la décision, corrigée en hauteur par la hauteur apprise quand elle ne s'abstient pas. */
 function poseCalculee(decision){const p=decision?.positions;if(!p||!SIDES.every(s=>Array.isArray(p[s])&&p[s].length===3&&p[s].every(Number.isFinite)))return null;
  const h=decision.hauteurApprise?.rails,out={},corr={};
  for(const s of SIDES){const c=h?.[s],ok=c&&Number.isFinite(c.correctionMm)&&c.correctionMm!==0&&Array.isArray(c.corrigee)&&c.corrigee.every(Number.isFinite);
   out[s]=ok?c.corrigee.slice():p[s].slice();corr[s]=ok?c.correctionMm:0;}
  return {positions:out,hauteurApprise:h?corr:null};}
 /* Confiance du moteur par rail (« s1 » : rail retenu par S1, sans confiance calibrée). */
 function confiance(science){if(!science?.rails)return null;
  return Object.fromEntries(SIDES.map(s=>{const r=science.rails[s];return [s,r?.s1Changed?'s1':Number.isFinite(r?.astar?.confidence)?r1(r.astar.confidence):null];}));}
 function juger({capture,decision,science=null},options){const cfg=cfgDe(options),rails=capture?.rails;
  const actuelle=rails&&SIDES.every(s=>Array.isArray(rails[s]?.positionSceneRelative))?Object.fromEntries(SIDES.map(s=>[s,rails[s].positionSceneRelative.map(um)])):null;
  const base={etage:decision?.stage??null,motifDecision:decision?.reason!=null?String(decision.reason).slice(0,80):null,
   appuis:Array.isArray(decision?.anchorsUsed)?decision.anchorsUsed.slice(0,12):[],confiance:confiance(science),poseActuelle:actuelle};
  const calc=actuelle?poseCalculee(decision):null;
  if(!calc)return {...base,poseCalculee:null,ecartMm:null,pireMm:null,hauteurApprise:null,zoneGrise:false,verdict:'je laisserais',
   raison:`aucune pose sûre calculée (${base.etage||'?'}${base.motifDecision?' : '+base.motifDecision:''}) : rien à proposer`};
  const ecartMm=Object.fromEntries(SIDES.map(s=>[s,ecartRail(rails[s],calc.positions[s])]));
  let pire=0,ou=null;for(const s of SIDES)for(const axe of ['lat','vert']){const v=Math.abs(ecartMm[s][axe]);if(v>pire){pire=v;ou={s,axe,v:ecartMm[s][axe]};}}
  const corrige=pire>=cfg.seuilCorrigerMm,gris=pire>=cfg.zoneGrise[0]&&pire<=cfg.zoneGrise[1];
  const nombre=v=>String(r1(v)).replace('.',',');
  const lieu=ou?`rail ${NOM[ou.s]}, ${ou.axe==='lat'?'latéral':'vertical'} ${nombre(Math.abs(ou.v))} mm`:'aucun écart';
  const h=calc.hauteurApprise&&SIDES.some(s=>calc.hauteurApprise[s])?` ; hauteur apprise ${SIDES.filter(s=>calc.hauteurApprise[s]).map(s=>`${NOM[s]} ${calc.hauteurApprise[s]>0?'+':''}${nombre(calc.hauteurApprise[s])} mm`).join(', ')}`:'';
  return {...base,poseCalculee:Object.fromEntries(SIDES.map(s=>[s,calc.positions[s].map(um)])),ecartMm,pireMm:r1(pire),hauteurApprise:calc.hauteurApprise,zoneGrise:gris,
   verdict:corrige?'je corrigerais':'je laisserais',
   raison:corrige?`${lieu} (seuil ${nombre(cfg.seuilCorrigerMm)} mm, étage ${base.etage})${h}`:`écart le plus grand : ${lieu}, sous le seuil de ${nombre(cfg.seuilCorrigerMm)} mm${h}`};}

 /* SKIP en ombre (D-172) : « aucun-point » si aucun point n'est affiché ; un seul scanner : illisible dans la capture. */
 function skipOmbre(capture){const q=capture?.quality?.perRail;
  const points=q&&SIDES.every(s=>Number.isInteger(q[s]))?{left:q.left,right:q.right}:null;
  const total=points?points.left+points.right:Array.isArray(capture?.pointsSceneRelative)?capture.pointsSceneRelative.length:null;
  return {raison:total===0?'aucun-point':null,points,scanners:null,scannersLisibles:false};}

 /* Ce qu'Ariane donnerait sur une capture : moteur (science GCV1), décision sur le lot avec les appuis du lot, hauteur apprise
  * (consignée par la décision, réglage forcé actif ici : c'est une ombre), puis le jugement. Dépendances passées : `Shadow`
  * (BananeGCV1Shadow), `L` (BananeLotDecision). Aucun effet. */
 function evaluer({capture,anchors=[],Shadow,L,hauteur=null},options){
  const science=Shadow.scientificProposeBoth(capture);
  const opts=hauteur?{hauteurApprise:{...hauteur,actif:true,appliquer:false}}:{};
  const decision=L.decideCut({capture:{identity:capture.identity,rails:capture.rails,pointsSceneRelative:capture.pointsSceneRelative,visibleByClipBoxes:capture.visibleByClipBoxes},
   science:{rails:science.rails,summary:science.summary},anchors,Shadow,options:opts});
  return juger({capture,decision,science},options);}

 /* Durée lisible : « 2 min 20 s », « 45 s ». */
 function duree(s){if(!Number.isFinite(s)||s<0)return '';const m=Math.floor(s/60),r=Math.round(s-60*m);return m?`${m} min${r?` ${r} s`:''}`:`${r} s`;}
 return {VERSION,DEFAULTS,LIBELLE,plage,selection,ecartRail,poseCalculee,confiance,juger,skipOmbre,evaluer,duree};
});

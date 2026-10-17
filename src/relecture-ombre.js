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
  * SÉLECTION (`selection`), sur la partie du lot, ALIGNÉE sur celle de l'étude (tools/relecture-autonome.cjs `selection`, bloc
  * `selection` de datasets/relecture-reglages-proposes.json) : même ensemble de cuts, même type de zone pour chaque cut :
  *   - PN et ADV : les plages À CONTRÔLER des règles métier, déjà marginées (PN : 4 avant, 6 après ; ADV : 30 de chaque côté) ;
  *   - grappe (au moins `grappe.min` cuts du lot, trous de `grappe.trouCuts` au plus) : toute la plage, `grappe.marge` cuts de marge
  *     de chaque côté (Mic : 456–468, 495–504) ;
  *   - cuts du lot hors grappe (isolés, paires) : CHAQUE cut avec `isole.marge` cut(s) de part et d'autre (Mic, cuts 323, 335, 411) ;
  *   - différé : `differe.marge` cuts de chaque côté, et le différé lui-même (il reste invalide dans ESV) ;
  *   - « À contrôler » : les verts de la liste (src/verts-a-controler.js) ;
  *   - en plus de l'étude (H5 de l'audit P-5), en OMBRE SEULEMENT : les verts de la liste d'ESV à plus de 15 mm de la médiane
  *     d'écartement de la partie, hors de toute autre plage (`ecartement`, zone `ecartement`, que la règle ne corrige jamais).
  *   TYPE DE ZONE de chaque cut (`zone`), comme l'étude : le premier qui le couvre dans l'ordre pn, adv, abords (grappe, cut isolé,
  *   différé), vert-hors-zone (liste), puis ecartement ; lu par la règle prudente (src/relecture-critere.js). Les cuts couverts sont groupés en plages
  *   de cuts CONSÉCUTIFS (`fusionTrouCuts`, 0 par défaut : aucun cut ajouté pour boucher un trou). Bornes : 0 et `total − 1`.
  *   D-172 : aucun cut n'est exclu, les premiers cuts d'une partie compris.
  *   Rôle de chaque cut : `vert` (hors du lot, laissé valide par ESV), `differe` (cut du lot différé : encore invalide), `lot` (cut
  *   posé et validé par le lot : traversé, pas relu, sauf `relireCutsDuLot`).
  *   ORDRE : par plages, dans l'ordre des cuts, comme Mic parcourt. PLAFOND (propre à la passe, absent de l'étude : budget de temps) :
  *   `plafondCuts` cuts relus au plus ; les plages sont gardées ENTIÈRES (un PN à moitié contrôlé laisse des erreurs de 30 à 40 mm),
  *   par priorité de motif (`priorites`), puis remises dans l'ordre des cuts ; une plage qui ne tient pas est rendue dans
  *   `horsPlafond`, sauf si rien n'est encore gardé : elle est alors coupée au plafond (son début).
  *
  * JUGEMENT (`juger`) d'un cut visité : la pose actuelle d'ESV (celle de la capture), la pose qu'Ariane donnerait (décision sur le
  * lot en chaîne, plus la hauteur apprise : variante « chaine+h » de l'étude), l'écart par rail dans le repère profil
  * du rail (longitudinal, latéral, vertical, mm), le pire écart (latéral ou vertical), le verdict (« je corrigerais » au-delà de
  * `seuilCorrigerMm`, sinon « je laisserais ») et sa raison. Le seuil de 5 mm vient du bruit de la référence (D-158 : 5 mm a un sens
  * comme taux sur une partie, la zone grise va de 3,6 à 6,4 mm ; `zoneGrise` le dit).
  *
  * SKIP EN OMBRE (`skipOmbre`, règle métier de Mic, D-172) : « aucun-point » seulement quand deux captures complètes de suite sont vides ;
  * jamais « un seul scanner », qui ne se mesure pas (un seul nuage d'ESV pour tous les scanners). Consigné seulement. */
 const VERSION='relecture-ombre-v1';
 const DEFAULTS=Object.freeze({version:VERSION,
  isole:Object.freeze({marge:1}),differe:Object.freeze({marge:2}),grappe:Object.freeze({trouCuts:5,min:3,marge:3}),
  fusionTrouCuts:0,relireCutsDuLot:false,
  priorites:Object.freeze(['pn','adv','grappe','differe','isole','a-controler','ecartement']),
  plafondCuts:120,
  /* Temps par cut relu (s) pour l'estimation : navigation d'un pas, capture, calcul, visite au moins `visiteMinMs`. Mesuré au banc
   * (fiches/RELECTURE_OMBRE.md § 6) ; Mic : 3,7 s par vert relu en partie 29. Un cut traversé : un pas et sa pause. */
  tempsParCutS:4,tempsTraverseS:1,
  seuilCorrigerMm:5,zoneGrise:Object.freeze([3.6,6.4])});
 const SIDES=['left','right'],NOM={left:'gauche',right:'droit'};
 const LIBELLE={pn:'PN',adv:'ADV',grappe:'grappe',differe:'autour du différé',isole:'cut isolé','a-controler':'à contrôler',ecartement:'écartement'};
 /* Type de zone d'une plage, pour la règle prudente de correction (src/relecture-critere.js) : celui de son motif le plus prioritaire.
  * Abords : autour des cuts du lot (grappe, différé, cut isolé) ; vert hors zone : la liste « À contrôler » seule. */
 const ZONE={pn:'pn',adv:'adv',grappe:'abords',differe:'abords',isole:'abords','a-controler':'vert-hors-zone',ecartement:'ecartement'};
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

 /* Plages de la méthode de Mic autour des cuts du lot : grappes entières ; hors grappe, chaque cut et ses voisins ; différés. */
 function plagesDuLot(lot,cfg){const out=[],cuts=[...new Set(lot.map(x=>x.cut))].sort((a,b)=>a-b);
  const groupes=[];for(const c of cuts){const g=groupes.at(-1);if(g&&c-g.at(-1)<=cfg.grappe.trouCuts)g.push(c);else groupes.push([c]);}
  for(const g of groupes){
   if(g.length>=cfg.grappe.min)out.push({a:g[0]-cfg.grappe.marge,z:g.at(-1)+cfg.grappe.marge,motif:'grappe'});
   else for(const c of g)out.push({a:c-cfg.isole.marge,z:c+cfg.isole.marge,motif:'isole'});}
  for(const x of lot)if(x.differe)out.push({a:x.cut-cfg.differe.marge,z:x.cut+cfg.differe.marge,motif:'differe'});
  return out;}
 /* Ordre de couverture des types de zone (le premier qui couvre un cut le garde), comme l'étude. */
 const ORDRE_ZONES=['pn','adv','abords','vert-hors-zone','ecartement'];

 function selection(entree,options){const cfg=cfgDe(options),e=entree&&typeof entree==='object'?entree:{};
  const total=entier(e.total)&&e.total>0?e.total:null,max=total!==null?total-1:Infinity;
  const lot=(Array.isArray(e.lot)?e.lot:[]).filter(x=>entier(x?.cut)&&x.cut<=max).map(x=>({cut:x.cut,differe:x.differe===true}));
  const differes=new Set(lot.filter(x=>x.differe).map(x=>x.cut)),poses=new Set(lot.filter(x=>!x.differe&&!differes.has(x.cut)).map(x=>x.cut));
  const brutes=plagesDuLot(lot,cfg);
  for(const [cle,motif] of [['zonesPN','pn'],['zonesADV','adv'],['aControler','a-controler'],['ecartement','ecartement']])
   for(const x of Array.isArray(e[cle])?e[cle]:[]){const p=plage(x);if(p)brutes.push({a:p[0],z:p[1],motif});}
  const bornees=brutes.map(p=>({...p,a:Math.max(0,p.a),z:Math.min(max,p.z)})).filter(p=>p.a<=p.z);
  /* Type de zone de chaque cut : le premier type qui le couvre (pn, adv, abords, vert-hors-zone) ; motifs : tous ceux qui le couvrent. */
  const zoneDe=new Map(),motifsDe=new Map();
  for(const z of ORDRE_ZONES)for(const p of bornees)if((ZONE[p.motif]||'vert-hors-zone')===z)for(let c=p.a;c<=p.z;c++)if(!zoneDe.has(c))zoneDe.set(c,z);
  for(const p of bornees)for(let c=p.a;c<=p.z;c++){if(!motifsDe.has(c))motifsDe.set(c,new Set());motifsDe.get(c).add(p.motif);}
  /* Plages : cuts couverts consécutifs (trou de `fusionTrouCuts` au plus : les cuts du trou ne sont pas relus). */
  const couverts=[...zoneDe.keys()].sort((a,b)=>a-b),fondues=[];
  for(const c of couverts){const d=fondues.at(-1);if(d&&c-d.z-1<=cfg.fusionTrouCuts){d.z=c;d.cuts.push(c);}else fondues.push({a:c,z:c,cuts:[c]});}
  const rang=m=>{const i=cfg.priorites.indexOf(m);return i<0?cfg.priorites.length:i;};
  const decrire=(a,z,liste)=>{const motifs=new Set();for(const c of liste)for(const m of motifsDe.get(c)||[])motifs.add(m);
   const ms=[...motifs].sort((x,y)=>rang(x)-rang(y)),cuts=[],traverses=[];
   for(const c of liste){if(poses.has(c)&&!cfg.relireCutsDuLot)traverses.push(c);else cuts.push({cut:c,role:differes.has(c)?'differe':poses.has(c)?'lot':'vert',zone:zoneDe.get(c)});}
   return {debut:a,fin:z,motifs:ms,zone:ZONE[ms[0]]||'vert-hors-zone',priorite:rang(ms[0]),libelle:`${LIBELLE[ms[0]]||ms[0]} ${tiret(a,z)}`,cuts,traverses,liste};};
  const candidates=fondues.map(p=>decrire(p.a,p.z,p.cuts));
  /* Plafond : plages entières, par priorité puis ordre des cuts. */
  const gardees=[],horsPlafond=[];let reste=entier(cfg.plafondCuts)?cfg.plafondCuts:Infinity;
  for(const p of [...candidates].sort((x,y)=>x.priorite-y.priorite||x.debut-y.debut)){
   if(p.cuts.length<=reste){gardees.push(p);reste-=p.cuts.length;continue;}
   if(!gardees.length&&reste>0){const coupe=p.cuts[reste-1].cut;gardees.push(decrire(p.debut,coupe,p.liste.filter(c=>c<=coupe)));
    horsPlafond.push({debut:coupe+1,fin:p.fin,motifs:p.motifs,libelle:p.libelle,raison:'plafond-cuts'});reste=0;continue;}
   horsPlafond.push({debut:p.debut,fin:p.fin,motifs:p.motifs,libelle:p.libelle,raison:'plafond-cuts'});}
  gardees.sort((x,y)=>x.debut-y.debut);horsPlafond.sort((x,y)=>x.debut-y.debut);
  const cuts=gardees.flatMap((p,i)=>p.cuts.map(c=>({...c,plage:i})));
  const traverses=gardees.reduce((n,p)=>n+p.traverses.length,0);
  const parZone=Object.fromEntries(ORDRE_ZONES.map(z=>[z,cuts.filter(c=>c.zone===z).length]));
  return {format:'ariane-relecture-selection-1',version:cfg.version,partie:entier(e.partie)?e.partie:null,total:cuts.length,traverses,parZone,
   tempsEstimeS:Math.round(cuts.length*cfg.tempsParCutS+traverses*cfg.tempsTraverseS),plafondCuts:Number.isFinite(reste)?cfg.plafondCuts:null,
   plages:gardees.map(p=>({debut:p.debut,fin:p.fin,motifs:p.motifs,zone:p.zone,libelle:p.libelle,relus:p.cuts.length,traverses:p.traverses})),
   cuts,horsPlafond};}
 /* Options de sélection depuis le bloc `selection` du fichier de réglages (marges de grappe, d'isolé, de différé) ; le reste : défaut.
  * Les marges des PN et des ADV sont celles des règles métier, qui donnent les plages déjà marginées. */
 function optionsSelection(bloc){const b=bloc&&typeof bloc==='object'?bloc:{},n=(v,d)=>Number.isInteger(v)&&v>=0&&v<=100?v:d,o={};
  if(b.grappeMin!==undefined||b.trouCuts!==undefined||b.margeGrappe!==undefined)o.grappe={min:n(b.grappeMin,DEFAULTS.grappe.min),trouCuts:n(b.trouCuts,DEFAULTS.grappe.trouCuts),marge:n(b.margeGrappe,DEFAULTS.grappe.marge)};
  if(b.margeIsole!==undefined)o.isole={marge:n(b.margeIsole,DEFAULTS.isole.marge)};
  if(b.margeDiffere!==undefined)o.differe={marge:n(b.margeDiffere,DEFAULTS.differe.marge)};
  return o;}

 /* ----------------------------------------------------------------- jugement */
 /* Écart (mm) d'une position scène à la pose actuelle d'ESV, dans le repère profil du rail : longitudinal, latéral, vertical. */
 function ecartRail(rail,p){const M=rail.sceneRelativeToProfileLocal,a=C.point(M,p),o=C.point(M,rail.positionSceneRelative);
  const d=[0,1,2].map(i=>(a[i]-o[i])*1000);return {long:r1(d[0]),lat:r1(d[1]),vert:r1(d[2])};}
 /* La pose qu'Ariane donnerait, comme l'étude (variante « +h », tools/relecture-autonome.cjs `proposition`) : les positions de la
  * décision, plus la correction de hauteur apprise que la décision consigne (`correctionMm` par rail), portée sur l'axe vertical du
  * repère profil de la pose ACTUELLE d'ESV du rail. `hauteur:false` : la décision seule (variante sans « +h »). */
 function poseCalculee(decision,rails,{hauteur=true}={}){const p=decision?.positions;if(!p||!SIDES.every(s=>Array.isArray(p[s])&&p[s].length===3&&p[s].every(Number.isFinite)))return null;
  const h=decision.hauteurApprise?.rails,out={},corr={};
  for(const s of SIDES){const mm=hauteur&&Number.isFinite(h?.[s]?.correctionMm)?h[s].correctionMm:0,r=rails?.[s];
   const porte=!!mm&&!!r?.sceneRelativeToProfileLocal&&!!r?.profileLocalToSceneRelative;
   if(porte){const q=C.point(r.sceneRelativeToProfileLocal,p[s]);q[2]+=mm/1000;out[s]=C.point(r.profileLocalToSceneRelative,q);}else out[s]=p[s].slice();
   corr[s]=porte?mm:0;}
  return {positions:out,hauteurMm:h&&hauteur?corr:null};}
 /* Confiance du moteur par rail (A*, comme l'étude : présente même pour un rail repêché par S1, signalé à part dans `s1`). */
 function confiance(science){if(!science?.rails)return null;
  return Object.fromEntries(SIDES.map(s=>{const r=science.rails[s];return [s,Number.isFinite(r?.astar?.confidence)?r1(r.astar.confidence):null];}));}
 const s1De=science=>science?.rails?Object.fromEntries(SIDES.map(s=>[s,science.rails[s]?.s1Changed===true])):null;
 function juger({capture,decision,science=null,hauteur=true},options){const cfg=cfgDe(options),rails=capture?.rails;
  const actuelle=rails&&SIDES.every(s=>Array.isArray(rails[s]?.positionSceneRelative))?Object.fromEntries(SIDES.map(s=>[s,rails[s].positionSceneRelative.map(um)])):null;
  const base={etage:decision?.stage??null,motifDecision:decision?.reason!=null?String(decision.reason).slice(0,80):null,
   appuis:Array.isArray(decision?.anchorsUsed)?decision.anchorsUsed.slice(0,12):[],confiance:confiance(science),s1:s1De(science),poseActuelle:actuelle};
  const calc=actuelle?poseCalculee(decision,rails,{hauteur}):null;
  if(!calc)return {...base,poseCalculee:null,ecartMm:null,pireMm:null,hauteurMm:null,zoneGrise:false,verdict:'je laisserais',
   raison:`aucune pose sûre calculée (${base.etage||'?'}${base.motifDecision?' : '+base.motifDecision:''}) : rien à proposer`};
  const ecartMm=Object.fromEntries(SIDES.map(s=>[s,ecartRail(rails[s],calc.positions[s])]));
  let pire=0,ou=null;for(const s of SIDES)for(const axe of ['lat','vert']){const v=Math.abs(ecartMm[s][axe]);if(v>pire){pire=v;ou={s,axe,v:ecartMm[s][axe]};}}
  const corrige=pire>=cfg.seuilCorrigerMm,gris=pire>=cfg.zoneGrise[0]&&pire<=cfg.zoneGrise[1];
  const nombre=v=>String(r1(v)).replace('.',',');
  const lieu=ou?`rail ${NOM[ou.s]}, ${ou.axe==='lat'?'latéral':'vertical'} ${nombre(Math.abs(ou.v))} mm`:'aucun écart';
  const h=calc.hauteurMm&&SIDES.some(s=>calc.hauteurMm[s])?` ; hauteur apprise ${SIDES.filter(s=>calc.hauteurMm[s]).map(s=>`${NOM[s]} ${calc.hauteurMm[s]>0?'+':''}${nombre(calc.hauteurMm[s])} mm`).join(', ')}`:'';
  return {...base,poseCalculee:Object.fromEntries(SIDES.map(s=>[s,calc.positions[s].map(um)])),ecartMm,pireMm:r1(pire),hauteurMm:calc.hauteurMm,zoneGrise:gris,
   verdict:corrige?'je corrigerais':'je laisserais',
   raison:corrige?`${lieu} (seuil ${nombre(cfg.seuilCorrigerMm)} mm, étage ${base.etage})${h}`:`écart le plus grand : ${lieu}, sous le seuil de ${nombre(cfg.seuilCorrigerMm)} mm${h}`};}

 /* SKIP en ombre (D-172), règle de Mic réduite à ce qui se mesure (fiches/RELECTURE_AUTONOME.md § 6) : « aucun-point » seulement
  * quand la capture est VRAIMENT vide après chargement complet, c'est-à-dire quand `min` captures complètes de suite (2 par défaut)
  * n'ont aucun point près des deux rails (`quality.perRail`, sinon les points de la capture) ; une seule capture vide ne suffit pas
  * (l'étude : 3 fausses alertes sur des visites brèves). Jamais « un seul scanner » : tous les scanners arrivent dans un seul nuage
  * d'ESV, la capture ne le dit pas. Consigné seulement : aucun SKIP n'est envoyé. */
 const pointsDe=capture=>{const q=capture?.quality?.perRail;if(q&&SIDES.every(s=>Number.isInteger(q[s])))return {left:q.left,right:q.right,total:q.left+q.right};
  const n=Array.isArray(capture?.pointsSceneRelative)?capture.pointsSceneRelative.length:null;return n===null?null:{left:null,right:null,total:n};};
 function skipOmbre(captures,{min=2}={}){const liste=(Array.isArray(captures)?captures:[captures]).filter(Boolean),comptes=liste.map(pointsDe);
  const p=comptes[0]||null,vides=comptes.filter(c=>c&&c.total===0).length;
  return {raison:liste.length>=min&&vides===liste.length?'aucun-point':null,points:p?{left:p.left,right:p.right}:null,captures:liste.length,capturesVides:vides};}
 const captureVide=capture=>pointsDe(capture)?.total===0;

 /* Durée lisible : « 2 min 20 s », « 45 s ». */
 function duree(s){if(!Number.isFinite(s)||s<0)return '';const m=Math.floor(s/60),r=Math.round(s-60*m);return m?`${m} min${r?` ${r} s`:''}`:`${r} s`;}
 return {VERSION,DEFAULTS,LIBELLE,ZONE,ORDRE_ZONES,plage,selection,optionsSelection,ecartRail,poseCalculee,confiance,juger,skipOmbre,captureVide,duree};
});

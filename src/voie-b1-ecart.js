(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory(require('../vendor/capture-core.js'),require('./lot-decision.js'),require('./voie-recentree.js'),require('./appuis-liste.js'),require('./gcv2-l1e.js'));
  else root.BananeVoieB1Ecart=factory(root.BananeCaptureCore,root.BananeLotDecision,root.BananeVoieRecentree,root.BananeAppuisListe,root.BananeGcv2L1e);
})(typeof globalThis!=='undefined'?globalThis:this,function(C,L,V,B,L1e){
 'use strict';
 /* CH-055 (05/11/2026) — RÈGLE DE VOIE « B1-ECART », EN OMBRE. Module pur : ni ESV, ni stockage, ni horloge, ni journal ; il CALCULE et rend
  * un événement. Il ne pose rien, ne commande rien, ne change ni la décision du lot ni ses appuis.
  *
  * Mesure (CH-053-M, chantiers/CH-053/M-rapport.md) : sur les différés jugés des parties 10, 13, 14, 15 du 04/11, cette règle pose juste 28 cuts sur 45
  * (validation croisée par partie), 5 faux de 11 à 31 mm, 0 à plus de 50 mm sur 33 poses ; sur l'examen 8-12 du 05/11 : 14 justes sur 22, 0 faux. Les
  * différés qu'elle rattrape sont des voies décalées de 60 à 150 mm (le moteur trouve un rail et accroche pour l'autre une structure à 60-70 mm, contre-rail
  * de passage à niveau ; la pose d'ESV d'une ligne invalide est un gabarit à 1 500 mm). Sources, dans cet ordre, sur un cut que le lot DIFFÈRE :
  *   1. « serie » : la chaîne de l'ombre (ses propres poses, jamais celles du lot : `appuisOmbre` de voie-recentree), même reprise que la voie prédite ;
  *   2. « b1 » : les lignes VALIDES de la liste d'ESV à `fenetreListe` cuts (instantané compact de la liste, src/liste-memoire.js), ramenées en scène par
  *      la translation T lue sur la ligne du cut lui-même (sa pose de départ, invalide, est la pose d'ESV à 0 mm : S6 de la 4.9.5.3), puis `decideCut`
  *      avec ces voisins validés (D-095, dernier recours) ;
  *   3. « ecart » : le rail que le moteur a trouvé (candidat publié, publié avant la garde d'écartement, ou A* brut) ; l'autre rail est cherché là où la
  *      paire aurait l'ÉCARTEMENT DE RÉFÉRENCE (lignes valides non touchées de la liste, `referenceEcartement` de L1-e ; sinon les appuis ; sinon
  *      `gRefDefautMm`), de chaque côté du rail trouvé ; le moteur est RELANCÉ depuis cette paire (appuis fictifs `appuisDepuisDecalage`) et sa propre
  *      qualification décide (minimum à `choixMm`, points de dessus et de flanc, contrat d'écartement, garde d'écartement voisin). Deux rails trouvés
  *      ⇒ deux compléments ; s'ils ne tombent pas sur la même paire à `accordMm`, abstention (« ecart:plusieurs »).
  * Jamais le balayage du nuage (une mauvaise voie sur 27 poses en passage à niveau, CH-053-M) : il n'est pas ici.
  * L'événement ne porte que des décalages en mm dans le repère profil de la pose de départ, des numéros de cut et des comptes. */
 const VERSION='voie-b1-ecart-ombre-v1';
 const SIDES=['left','right'],FR={left:'gauche',right:'droite'};
 const REGLAGE=Object.freeze({fenetreListe:5,fenetreMm:30,choixMm:15,accordMm:20,gRefDefautMm:1435,essaisMax:4,solutionPorteeMm:320,solutionPasMm:1,solutionTolMm:0.5});
 const STATUTS=['valid','invalid','skipped','autre'];
 const r1=v=>Number.isFinite(v)?Math.round(v*10)/10:null,r2=v=>Number.isFinite(v)?Math.round(v*100)/100:null;
 const med=a=>{if(!a.length)return null;const b=a.slice().sort((x,y)=>x-y),i=b.length>>1;return b.length%2?b[i]:(b[i-1]+b[i])/2;};

 /* ------------------------------------------------------------------ liste d'ESV */
 /* Lignes de la liste autour du cut, au format des réponses de B1 (`lireReponse`) : { i, statut, operateur, vu, fraiche, bords (monde, m) }. */
 function lignesDeTable(table,cut,fenetre=REGLAGE.fenetreListe){
   const rows=[];
   if(!table||!Number.isInteger(table.n)||!Array.isArray(table.st)||!Array.isArray(table.ed)||!Number.isInteger(cut))return rows;
   for(let i=Math.max(0,cut-fenetre);i<=Math.min(table.n-1,cut+fenetre);i++){
     const e=table.ed.slice(6*i,6*i+6),fl=(table.fl&&table.fl[i])|0;
     rows.push({i,statut:STATUTS[table.st[i]]||'autre',operateur:!!(fl&1),vu:!!(fl&2),fraiche:false,bords:e.length===6&&e.every(Number.isFinite)?{left:e.slice(0,3).map(v=>v/1e4),right:e.slice(3).map(v=>v/1e4)}:null});
   }
   return rows;
 }
 /* T = bords de la ligne du cut (monde) − pose de départ de la capture (scène), seulement si la ligne est encore invalide (pose d'ESV, jamais
  * écrite) et rigide (les deux rails donnent la même T). Rend { etat, T, rigideMm }. */
 function repereDepuisLigne(rows,cut,rails){
   const ligne=(rows||[]).find(x=>x.i===cut);
   if(!ligne)return {etat:'sans-ligne',T:null,rigideMm:null};
   if(!ligne.bords)return {etat:'sans-bords',T:null,rigideMm:null};
   if(ligne.statut!=='invalid'||ligne.fraiche)return {etat:'ligne-non-depart',T:null,rigideMm:null};
   const m=B.mesurerT(ligne.bords,{left:rails.left.positionSceneRelative,right:rails.right.positionSceneRelative});
   if(!m)return {etat:'mesure-impossible',T:null,rigideMm:null};
   return {etat:m.ok?'calibre':'non-rigide',T:m.ok?m.T:null,rigideMm:r1(m.rigideMm)};
 }
 /* Écartement de référence (mm) : lignes valides non touchées de la liste (L1-e), sinon la médiane des appuis, sinon le défaut. */
 function ecartementReference(table,cut,ancres,reglage=REGLAGE){
   if(table){const r=L1e.referenceEcartement(table,cut);if(r&&Number.isFinite(r.mm))return {mm:r.mm,source:'liste'};}
   const g=(ancres||[]).filter(a=>a.positions?.left&&a.positions?.right).map(a=>C.distance(a.positions.left,a.positions.right)*1000);
   if(g.length)return {mm:r2(med(g)),source:'appuis'};
   return {mm:reglage.gRefDefautMm,source:'defaut'};
 }

 /* ------------------------------------------------------------------ complément par l'écartement */
 /* Rail trouvé par le moteur (décalage [long, lat, vert] en m, repère profil du rail de départ) : candidat publié, publié avant la garde d'écartement
  * de la paire, sinon A* brut. Jamais la pose de l'opérateur. */
 function railTrouve(rail){
   if(!rail||rail.ok!==true)return null;
   if(rail.next?.status==='candidate'&&Array.isArray(rail.next.delta))return {delta:rail.next.delta,origine:'publie'};
   const g=rail.pairGauge?.publishedBeforeGate?.delta;if(Array.isArray(g))return {delta:g,origine:'avant-garde'};
   if(rail.astar?.status==='candidate'&&Array.isArray(rail.astar.delta))return {delta:rail.astar.delta,origine:'astar'};
   return null;
 }
 /* Décalages latéraux (mm) de l'autre rail qui donnent à la paire l'écartement `gRef`, le rail `sur` étant à `deltaSur` (m) : les minima locaux de
  * |écartement − gRef| sur ±portée, de chaque côté du rail sûr (deux solutions au plus) ; la hauteur de l'autre rail est celle du rail sûr. */
 function solutionsEcartement(cap,sur,deltaSur,gRef,o=REGLAGE){
   const autre=sur==='left'?'right':'left',posSur=L.positionOf(cap.rails[sur],deltaSur),vert=deltaSur[2];
   const g=a=>C.distance(L.positionOf(cap.rails[autre],[0,a/1000,vert]),posSur)*1000;
   const sols=[];let prev=null,prev2=null;
   for(let a=-o.solutionPorteeMm;a<=o.solutionPorteeMm;a+=o.solutionPasMm){
     const e=Math.abs(g(a)-gRef);
     if(prev!==null&&prev2!==null&&prev.e<=prev2.e&&prev.e<=e&&prev.e<=5)sols.push(prev.a);
     prev2=prev;prev={a,e};
   }
   return sols.map(a0=>{let lo=a0-o.solutionPasMm,hi=a0+o.solutionPasMm;for(let k=0;k<20;k++){const m=(lo+hi)/2,ml=g(lo)-gRef,mm=g(m)-gRef;if(Math.sign(ml)===Math.sign(mm))lo=m;else hi=m;}
     const a=(lo+hi)/2;return Math.abs(g(a)-gRef)<=o.solutionTolMm?{lat:a,vert:vert*1000}:null;}).filter(Boolean);
 }
 /* Relance du moteur depuis une paire en décalages (mm, [lat, vert] par rail) : appuis fictifs sur la droite parallèle à la pose de départ. */
 function relancerDepuis(decider,args,cap,decalage,opts){return decider({...args,anchors:V.appuisDepuisDecalage(cap,decalage),options:opts});}
 const poseMmDe=(cap,decision)=>decision?.positions?Object.fromEntries(SIDES.map(s=>{const l=V.localMm(cap.rails[s],decision.positions[s]);return [s,[l[1],l[2]]];})):null;
 const ecartPoses=(a,b)=>Math.max(...SIDES.map(s=>Math.hypot(a[s][0]-b[s][0],a[s][1]-b[s][1])));
 /* Source « ecart ». `decider(args)` → { decision, relance } ; `quels` : 'les-deux' | 'gauche' | 'droite'. Rend { decision, relance, raison, essais }. */
 function sourceEcart(decider,args,cap,science,gRef,opts,quels='les-deux',reglage=REGLAGE){
   const trouves=SIDES.filter(s=>(quels==='les-deux'||FR[s]===quels)&&railTrouve(science.rails[s]));
   if(!trouves.length)return {decision:null,raison:'ecart:aucun-rail-trouve',essais:0};
   const poses=[];let essais=0;
   for(const sur of trouves){
     const t=railTrouve(science.rails[sur]),autre=sur==='left'?'right':'left';
     for(const sol of solutionsEcartement(cap,sur,t.delta,gRef,reglage)){
       if(essais>=reglage.essaisMax)break;
       essais++;
       const decalage={[sur]:[t.delta[1]*1000,t.delta[2]*1000],[autre]:[sol.lat,sol.vert]};
       const e=relancerDepuis(decider,args,cap,decalage,opts);
       if(e.decision&&e.decision.stage!=='deferred'&&e.decision.positions)poses.push({...e,sur,origine:t.origine,pose:poseMmDe(cap,e.decision)});
     }
   }
   if(!poses.length)return {decision:null,raison:'ecart:aucune-pose-qualifiee',essais};
   const groupes=[];for(const p of poses)if(!groupes.some(g=>ecartPoses(g.pose,p.pose)<=reglage.accordMm))groupes.push(p);
   if(groupes.length>1)return {decision:null,raison:'ecart:plusieurs',essais};
   return {...groupes[0],raison:null,essais,accord:poses.length};
 }

 /* ------------------------------------------------------------------ l'ombre d'un cut différé */
 const creerMemoire=batchId=>V.creerMemoire(batchId);
 /* `capture` : { identity, rails, pointsSceneRelative, visibleByClipBoxes } ; `science` : le moteur sur la capture telle quelle ; `table` : instantané
  * décompacté de la liste (ou null) ; `ancresReelles` : appuis du lot ; `decisionReelle`, `commandeReelle` : consignés seulement. Rend { evenement, r }.
  * Seule `mem` (mémoire de l'ombre, volatile) est modifiée : la pose de l'ombre devient appui de l'ombre quand la décision en ferait un appui. */
 function evaluer({mem,capture,science,Shadow,table=null,ancresReelles=[],decisionReelle=null,commandeReelle=null,reglage=REGLAGE}){
   const identity=capture.identity,base={version:VERSION,identity:{part:identity.part??null,cut:identity.cut??null},
     reel:{stage:decisionReelle?.stage??null,reason:decisionReelle?.reason!=null?String(decisionReelle.reason).slice(0,80):null,
       commande:commandeReelle?`${commandeReelle.action}:${commandeReelle.reason??''}`.slice(0,60):null}};
   try{
     const o={...REGLAGE,...reglage},opts={guardMm:o.fenetreMm,chooseMm:o.choixMm};
     const sci={rails:science.rails,summary:science.summary};
     let relance=null;const moteur=Object.create(Shadow);moteur.scientificProposeBoth=c=>{relance=Shadow.scientificProposeBoth(c);return relance;};
     const args={capture,science:sci,anchors:(ancresReelles||[]).slice(),Shadow:moteur};
     const decider=a=>{relance=null;const d=L.decideCut(a);return {decision:d,relance};};
     const ancres=V.appuisOmbre(mem,ancresReelles),deOmbre=new Set(mem.poses.map(p=>p.identity.cut));
     let d=null,source=null,raisons=[],essais=0,appuisB1=[];
     /* 1. La chaîne de l'ombre (seulement si une pose de l'ombre est à portée : sinon la décision réelle a déjà tout dit). */
     if(V.doitRecalculer(mem,identity,null)){const e=decider({...args,anchors:ancres,options:opts});essais++;if(e.decision.stage!=='deferred'&&e.decision.positions){d=e;source='serie';}else raisons.push('serie:'+String(e.decision.reason||'?').slice(0,40));}
     /* 2. Les lignes valides de la liste d'ESV. */
     const rows=lignesDeTable(table,identity.cut,o.fenetreListe),rep=rows.length?repereDepuisLigne(rows,identity.cut,capture.rails):{etat:'sans-liste',T:null};
     if(!d){
       if(rep.T){appuisB1=B.appuis(rows,rep.T,identity);
         if(appuisB1.length){const e=decider({...args,anchors:ancres,validated:appuisB1,options:opts});essais++;if(e.decision.stage!=='deferred'&&e.decision.positions){d=e;source='b1';}else raisons.push('b1:'+String(e.decision.reason||'?').slice(0,40));}
         else raisons.push('b1:aucune-ligne-valide');}
       else raisons.push('b1:'+rep.etat);
     }
     /* 3. Le complément par l'écartement. */
     const gRef=ecartementReference(table,identity.cut,ancres,o);
     if(!d){const e=sourceEcart(decider,{...args,anchors:ancres},capture,sci,gRef.mm,opts,'les-deux',o);essais+=e.essais;if(e.decision){d=e;source='ecart';}else raisons.push(e.raison);}
     const r=d?{decision:d.decision,relance:d.relance,...V.completer({capture,decision:d.decision,relance:d.relance,appuis:[...ancres,...appuisB1],vue:null,profondeurAppui:c=>mem.profondeurs.get(c)??0})}:null;
     const posable=!!(r&&r.posee);
     if(posable&&r.anchor&&L.commandsPositions(r.decision,{action:'lot'})){
       const i=mem.poses.findIndex(p=>p.identity.part===identity.part&&(p.identity.frameId??null)===(identity.frameId??null)&&p.identity.cut===identity.cut);if(i>=0)mem.poses.splice(i,1);
       mem.poses.push({identity:{part:identity.part,cut:identity.cut,frameId:identity.frameId??null},positions:r.positions,stage:r.stage,profondeur:r.profondeur});
       while(mem.poses.length>40)mem.poses.shift();
       mem.profondeurs.delete(identity.cut);mem.profondeurs.set(identity.cut,r.profondeur);
     }
     const evenement={...base,etat:'calcule',source,etage:r?.stage??null,raison:r?.reason!=null?String(r.reason).slice(0,80):null,
       appuis:r&&source!=='ecart'?r.anchorsUsed:[],appuisOmbre:r&&source!=='ecart'?r.anchorsUsed.filter(c=>deOmbre.has(c)):[],lignesValides:appuisB1.map(a=>a.identity.cut).slice(0,12),repere:rep.etat,
       gRef:{mm:r2(gRef.mm),source:gRef.source},essais,confiance:r?V.confiances(r.moteur):null,ecartVoieMm:r?r1(r.fromPredictionMm):null,
       poseMm:posable?V.poseMm(capture,r.positions):null,verdict:posable?{posable:true,raison:null}:{posable:false,raison:raisons.join(' | ').slice(0,160)||'aucune-source'}};
     return {evenement,r};
   }catch(e){return {evenement:{...base,etat:'erreur',source:null,poseMm:null,verdict:{posable:false,raison:'erreur'},message:String(e?.message||e).slice(0,160)},r:null};}
 }

 return {VERSION,REGLAGE,lignesDeTable,repereDepuisLigne,ecartementReference,railTrouve,solutionsEcartement,relancerDepuis,poseMmDe,ecartPoses,sourceEcart,creerMemoire,evaluer};
});

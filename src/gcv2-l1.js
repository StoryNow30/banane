(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory(require('../vendor/capture-core.js'),require('./lot-decision.js'),require('./continuity-observer.js'),
    require('./hauteur-apprise.js'),require('./placement-convention.js'),require('./voie-recentree.js'),require('./gcv1-shadow.js'),require('./gauge.js'),require('./gcv2-l1e.js'));
  else root.BananeGcv2L1=factory(root.BananeCaptureCore,root.BananeLotDecision,root.BananeContinuityObserver,root.BananeHauteurApprise,root.BananePlacementConvention,
    root.BananeVoieRecentree,root.BananeGCV1Shadow,root.BananeGauge4,root.BananeGcv2L1e);
})(typeof globalThis!=='undefined'?globalThis:this,function(C,L,O,H,Conv,V,Shadow,Gauge,E){
 'use strict';
 /* 4.9.5.13 (D-217, D-219) — CANDIDATE « L1 » SUR LES DIFFÉRÉS DU LOT. Module commun au banc hors ligne (`tools/banc-differes.cjs`) et au
  * chemin du lot du service worker (`background.js`, profil `lot.profil = 'L1'`) : le banc mesure exactement ce que le terrain exécute.
  *
  * Pour un cut que la chaîne du lot diffère, à l'instant de la décision et avec cela seulement (capture et science du cut, décisions du lot seul
  * et en chaîne, appuis de la chaîne, cuts validés par le lot avant cet instant, médiane d'écartement de ces cuts, zone connue) :
  *   1. les hypothèses H0 à H6 de la GCV2, famille « lot » (aucun appui humain) — portage à l'identique de `hypothesesDuCut`
  *      (`tools/gcv2-jeu.cjs`) ; les essais comparent les deux, trait par trait ;
  *   2. le score de justesse à 10 mm de chaque hypothèse, par les paramètres FIGÉS de l'usage « lot » (`datasets/gcv2-parametres-h6.json`) ;
  *   3. la meilleure paire (produit des scores) parmi les paires dont l'écartement tient (médiane ± 15 mm, ou contrat 1 420–1 470 mm), SANS le
  *      couloir de 45 mm depuis la pose de départ (P2, D-219) ;
  *   4. la règle L1 : au-dessus de τ et à δ au moins de la pose de départ : POSER ET VALIDER ; sous τ : POSER SANS VALIDER (le cut reste
  *      invalide), sauf si la paire est à plus de 150 mm de la pose de départ (rien) ; la paire de départ, ou une paire à moins de δ : rien.
  *      Variante L1-v (chiffrée, jamais activée sans décision écrite) : sous τ, VALIDER et inscrire aux verts à contrôler.
  * Inchangés : contrat d'écartement du moteur, τ, δ, écartement de la paire, géométrie. Rien ici ne commande ESV : le module rend une décision. */
 const SIDES=['left','right'];
 const VERSION='gcv2-l1-1';
 const fini=v=>typeof v==='number'&&Number.isFinite(v);
 const arrondi=(v,d=1)=>fini(v)?Math.round(v*10**d)/10**d:null;
 const r2=v=>fini(v)?Math.round(v*100)/100:null;
 const sig4=v=>fini(v)?Number(v.toPrecision(4)):null;
 const vec3=v=>Array.isArray(v)&&v.length>=3&&v.slice(0,3).every(fini)?v.slice(0,3):null;
 const norme=v=>Math.hypot(...v);
 const moins=(a,b)=>a.map((x,i)=>x-b[i]);
 const med=a=>{const s=a.filter(fini).sort((x,y)=>x-y);if(!s.length)return null;const m=s.length>>1;return s.length%2?s[m]:(s[m-1]+s[m])/2;};
 const gaugeMm=(a,b)=>1000*C.distance(a,b);

 /* ------------------------------------------------------------------ règle L1 (déclarée en D-219, détails tranchés dans fiches/L1_DIFFERES.md § 2) */
 const REGLE=Object.freeze({version:'L1',variante:'L1',sansValiderMaxMm:150,ecartementMedianeMm:15,contratMm:Object.freeze([1420,1470]),
   lotOptions:Object.freeze({pairGuard:false,gap:10})});
 const REGLE_V=Object.freeze({...REGLE,variante:'L1-v'});
 /* 4.9.5.14 (test 14, fiches/L1_APPRENTISSAGE.md) : variante L1-e, correction d'écartement apprise sur les Échos (src/gcv2-l1e.js) ; mêmes
  * hypothèses, mêmes probabilités, même paire ; valider ou rien, jamais de pose sans validation. */
 const REGLE_E=Object.freeze({...REGLE,variante:'L1-e'});

 /* ------------------------------------------------------------------ outils de repère (tools/relecture-autonome.cjs) */
 /* Décalage d'une position par rapport au rail de départ, repère profil de ce rail (mm, [long, lat, vert]). */
 function decalage(rail,p){
   const M16=rail&&rail.sceneRelativeToProfileLocal,o=rail&&vec3(rail.positionSceneRelative),q=vec3(p);
   if(!Array.isArray(M16)||M16.length!==16||!o||!q)return null;
   const a=C.point(M16,q),b=C.point(M16,o);
   return [0,1,2].map(i=>r2(1000*(a[i]-b[i])));
 }
 /* Une décision du lot et sa hauteur apprise, en décalages depuis la pose de départ (`variante` de relecture-autonome). */
 function variante(capture,science,anchors,options){
   const decision=L.decideCut({capture,science,anchors,Shadow,...(options?{options}:{})});
   let haut=null;
   if(decision.positions){try{haut=H.evaluer({capture,science,decision});}catch{haut=null;}}
   const rails={};
   for(const s of SIDES){const h=haut&&haut.rails[s];
     rails[s]={pose:decision.positions?decalage(capture.rails[s],decision.positions[s]):null,hauteurMm:h?h.correctionMm:null,hauteurAbstention:h?h.abstention:null,groupe:h?h.groupe:null};}
   return {decision,haut,v:{stage:decision.stage,reason:decision.reason??null,appuis:(decision.anchorsUsed||[]).length,rails}};
 }
 /* H6 : décalage [latéral, vertical] (mm) d'une pose sûre `positions` depuis la pose d'ESV de départ du même cut (`rails`). */
 function decalageDepuisDepart(rails,positions){
   if(!rails||!positions)return null;
   const out={};
   for(const s of SIDES){const a=decalage(rails[s],positions[s]);if(!a)return null;out[s]=[a[1],a[2]];}
   return out;
 }

 /* ------------------------------------------------------------------ H6 « voie décalée » (tools/gcv2-jeu.cjs) */
 const H6=Object.freeze({fenetreCuts:10,k:5,dispersionSureMm:50,nSur:2,reservoirMm:5,procheMaxCuts:5,supportDessus:5,supportFlanc:3,concurrentMm:45});
 const MAX_HYP=12,DOUBLON_MM=0.75;
 function voisinsH6(identity,voisins){
   return (voisins||[]).filter(a=>a&&a.decalage&&a.identity&&a.identity.part===identity.part&&(a.identity.frameId??null)===(identity.frameId??null)
     &&a.identity.cut!==identity.cut&&Math.abs(a.identity.cut-identity.cut)<=H6.fenetreCuts)
     .sort((a,b)=>Math.abs(a.identity.cut-identity.cut)-Math.abs(b.identity.cut-identity.cut)||a.identity.cut-b.identity.cut);
 }
 const moyPaire=d=>[(d.left[0]+d.right[0])/2,(d.left[1]+d.right[1])/2];
 function decalagesH6(identity,voisins){
   const v=voisinsH6(identity,voisins);
   if(!v.length)return null;
   const p=v[0],k=v.slice(0,H6.k),dist=a=>Math.abs(a.identity.cut-identity.cut);
   const proche={left:p.decalage.left.slice(),right:p.decalage.right.slice(),paire:moyPaire(p.decalage),dist:dist(p),n:1,source:p.source==='humain'?'humain':'lot'};
   let mediane=null;
   if(k.length>=2){
     const m=f=>[med(k.map(a=>f(a)[0])),med(k.map(a=>f(a)[1]))];
     const Lm=m(a=>a.decalage.left),Rm=m(a=>a.decalage.right),Pm=m(a=>moyPaire(a.decalage));
     const etendue=f=>{const x=k.map(a=>f(a)[0]);return Math.max(...x)-Math.min(...x);};
     mediane={left:Lm,right:Rm,paire:Pm,n:k.length,distMax:Math.max(...k.map(dist)),source:k.some(a=>a.source==='humain')?'humain':'lot',
       dispersion:{left:etendue(a=>a.decalage.left),right:etendue(a=>a.decalage.right),paire:etendue(a=>moyPaire(a.decalage))}};
   }
   const motifs=[];
   if(!mediane)motifs.push(v.length?'un-seul-appui':'aucun-appui');
   else{
     if(mediane.dispersion.left>H6.dispersionSureMm||mediane.dispersion.right>H6.dispersionSureMm)motifs.push('appuis-contradictoires');
     if(proche.dist>H6.procheMaxCuts)motifs.push('appui-trop-loin');
   }
   const reference=mediane?{left:mediane.left,right:mediane.right,n:mediane.n,distMax:mediane.distMax,distMin:proche.dist,
     dispersion:{left:mediane.dispersion.left,right:mediane.dispersion.right},ancres:k.map(a=>({cut:a.identity.cut,source:a.source==='humain'?'humain':'lot'})),motifs}:null;
   return {proche,mediane,reference,motifs};
 }

 /* ------------------------------------------------------------------ géométrie d'une hypothèse */
 const cleCellule=c=>Math.round(c.u*1e6)+','+Math.round(c.z*1e6);
 const comptePositions=(capture,side,mm)=>L.positionOf(capture.rails[side],mm.map(v=>v/1000));
 function mesuresPose(capture,side,mm,calage,etage='first-pass'){
   const pos=comptePositions(capture,side,mm);
   const sig=H.signalRail(capture,{rails:{[side]:{conventionCalibration:calage||null}}},side,pos);
   return {pos,sig,cor:H.correctionRail(sig,etage)};
 }
 function mesuresTranslatees(capture,side,mm,calage,etage='first-pass'){
   const rail=capture.rails[side],pos=comptePositions(capture,side,mm);
   const t=pos.map((v,i)=>v-rail.positionSceneRelative[i]);
   const capT={...capture,rails:{...capture.rails,[side]:O.translated(rail,t)}};
   const sig=H.signalRail(capT,{rails:{[side]:{conventionCalibration:calage||null}}},side,pos);
   return {pos,sig,cor:H.correctionRail(sig,etage)};
 }

 /* ------------------------------------------------------------------ hypothèses d'un cut (portage de `hypothesesDuCut`, tools/gcv2-jeu.cjs) */
 /* `science` : résultat du moteur AVEC réservoir (`Shadow.scientificProposeBothAvecReservoir`) ; `seul`, `chaine` : { decision, v } (`variante`) ;
  * `voisins` : cuts validés par le lot avant l'instant de la décision ({ identity, positions, source:'lot', decalage }) ; `gMed` : médiane
  * d'écartement de ces cuts (mm) ou null ; `departEsv` : null (la pose de départ du cut est celle d'ESV). Jamais une pose humaine. */
 function hypothesesDuCut({capture,science,seul,chaine=null,appuisAvant=[],voisins=[],gMed=null,voisinsLot=null,departEsv=null}){
   const T=Shadow.reservoirOutils,identity=capture.identity;
   if(!T)throw Error('GCV2 L1 : le moteur ne rend pas les outils de son réservoir.');
   const res={};
   const baseH6=departEsv===false?null:departEsv||{left:[0,0,0],right:[0,0,0]};
   const famH6=baseH6?{lot:decalagesH6(identity,voisinsLot||voisins.filter(a=>a.source==='lot')),tous:decalagesH6(identity,voisins)}:{lot:null,tous:null};
   const tronquesH6={left:0,right:0};
   let voie=null;
   if(chaine&&chaine.decision&&(chaine.decision.anchorsUsed||[]).length){
     try{voie=V.predictionDe(capture,chaine.decision,appuisAvant);}catch{voie=null;}
   }
   let interp=null,infoVoisins={n:0,humains:0,lot:0,encadre:false,coupMin:null,ecartementMm:null};
   if(voisins.length){
     const nb=L.neighbours(identity,voisins,L.DEFAULTS),pa=L.predictionAnchors(identity,voisins,nb,L.DEFAULTS);
     if(pa.list.length){
       const predire=pa.list.framed?L.predictFramed:O.predict,utilises=voisins.filter(a=>pa.cuts.includes(a.identity.cut));
       interp={};
       for(const s of SIDES){const p=predire(capture.rails[s],pa.list,s);interp[s]=[p.lateral*1000,p.vertical*1000];}
       const g=L.gaugeReference(identity,voisins,L.DEFAULTS);
       infoVoisins={n:pa.cuts.length,humains:utilises.filter(a=>a.source==='humain').length,lot:utilises.filter(a=>a.source==='lot').length,
         encadre:!!pa.framed,coupMin:Math.min(...pa.cuts.map(k=>Math.abs(k-identity.cut))),ecartementMm:g?arrondi(g.mm,1):null};
     }
   }
   const tronques={left:[],right:[]},railInfo={};
   for(const s of SIDES){
     const rail=capture.rails[s],r=science.rails[s],rs=r&&r.ok&&r._reservoir?r._reservoir:null;
     const items=[];
     items.push({origine:'H0',sous:'depart',mm:[0,0,0],calage:null,cellule:null});
     const cellules=[];
     if(rs){
       const pick=r.next&&r.next.pick?cleCellule(r.next.pick):null;
       for(const c of rs.pool){
         const ratio=T.lossRatio(c.loss,rs.lmin),comp=T.inCompetitive(c,rs.lmin),strong=T.qualifyStrong(c),astar=(c.tags||[]).includes('astar-published');
         cellules.push({c,ratio,comp,strong,astar,publiee:pick!==null&&cleCellule(c)===pick});
       }
     }
     const miseEnCellule=(k,origine,sous)=>{
       const brutD=[0,rs.sign*k.c.u,k.c.z],cal=Conv.calibrate(capture,s,brutD),fin=cal.applied?cal.delta:brutD;
       return {origine,sous,mm:fin.map(v=>1000*v),calage:cal,cellule:k};
     };
     const astarCell=cellules.find(k=>k.astar);
     if(astarCell)items.push(miseEnCellule(astarCell,'H1','astar'));
     if(chaine&&chaine.decision&&chaine.decision.positions&&(chaine.decision.anchorsUsed||[]).length)
       items.push({origine:'H3',sous:'chaine',mm:decalage(rail,chaine.decision.positions[s]),calage:null,cellule:null,chaineRail:chaine.v.rails[s]});
     if(voie)items.push({origine:'H3',sous:'voie',mm:[0,voie[s][0],voie[s][1]],calage:null,cellule:null});
     if(interp)items.push({origine:'H4',sous:infoVoisins.humains?'voisins-humains':'voisins-lot',mm:[0,interp[s][0],interp[s][1]],calage:null,cellule:null});
     const sur=SIDES.find(x=>x!==s),rSur=science.rails[sur];
     if(fini(gMed)&&rSur&&rSur.ok&&rSur.next.status==='candidate'&&Array.isArray(rSur.next.delta)){
       const dSur=rSur.next.delta,posSur=L.positionOf(capture.rails[sur],dSur),vert=1000*dSur[2];
       const g=a=>gaugeMm(L.positionOf(rail,[0,a/1000,vert/1000]),posSur);
       let a=0;
       for(let k=0;k<4;k++){const pente=(g(a+5)-g(a))/5;if(!(Math.abs(pente)>0.3)){a=NaN;break;}a-=(g(a)-gMed)/pente;}
       if(Number.isFinite(a)&&Math.abs(a)<=80&&Math.abs(g(a)-gMed)<0.5)items.push({origine:'H5',sous:'ecartement-median',mm:[0,a,vert],calage:null,cellule:null});
     }
     if(baseH6)for(const mode of ['rail','paire'])for(const fam of ['lot','tous'])for(const vr of ['proche','mediane']){
       const F=famH6[fam]&&famH6[fam][vr];
       if(!F||(fam==='tous'&&F.source!=='humain'))continue;
       const off=mode==='paire'?F.paire:F[s],b=baseH6[s];
       items.push({origine:'H6',sous:`h6-${F.source}-${vr}-${mode}`,mm:[b[0],b[1]+off[0],b[2]+off[1]],calage:null,cellule:null,
         h6:{source:F.source,ampleurMm:Math.hypot(off[0],off[1]),distCuts:vr==='proche'?F.dist:F.distMax,n:F.n,
           dispersionMm:vr==='mediane'?(mode==='paire'?F.dispersion.paire:F.dispersion[s]):(famH6[fam].mediane?famH6[fam].mediane.dispersion[mode==='paire'?'paire':s]:null)}});
     }
     const h2=cellules.filter(k=>!k.astar&&(k.comp||k.strong))
       .sort((a,b)=>(b.comp&&b.strong)-(a.comp&&a.strong)||b.comp-a.comp||a.c.loss-b.c.loss);
     const h2Items=h2.map(k=>miseEnCellule(k,'H2',k.comp?(k.strong?'comp-strong':'comp'):'strong-ecartee'));
     const gardees=[];
     const ajoute=it=>{
       const d=gardees.find(g=>norme(moins(g.mm,it.mm))<DOUBLON_MM);
       if(d){
         if(!d.origines.includes(it.origine))d.origines.push(it.origine);
         d.sousListe.push(it.sous);
         if(it.cellule){d.cellules.push(it.cellule);if(!d.cellule||it.cellule.c.loss<d.cellule.c.loss){d.cellule=it.cellule;d.calage=it.calage;}}
         if(it.h6&&(!d.h6||(d.h6.source!=='lot'&&it.h6.source==='lot')))d.h6=it.h6;
         return true;
       }
       if(gardees.length>=MAX_HYP)return false;
       gardees.push({...it,origines:[it.origine],sousListe:[it.sous],cellules:it.cellule?[it.cellule]:[]});
       return true;
     };
     for(const it of items)if(!ajoute(it)&&it.origine==='H6')tronquesH6[s]++;
     for(const it of h2Items)if(!ajoute(it))tronques[s].push(it.mm.map(v=>arrondi(v,2)));
     railInfo[s]={
       statut:r&&r.ok?r.next.status:'absent',motif:r&&r.ok?(r.next.motif??null):(r&&r.error?'erreur':'absent'),
       confianceAstar:r&&r.astar?arrondi(r.astar.confidence,1):null,rapportPerteAstar:r&&r.astar?arrondi(r.astar.lossRatio,2):null,
       s1:!!(r&&r.s1Changed),fortsConcurrents:r&&r.competitive?(r.competitive.nStrongCompetitive??null):null,
       competitives:r&&r.competitive?r.competitive.nCompetitive:null,grappes:r&&r.competitive?r.competitive.nClusters:null,
       fortsReservoir:r&&r.competitive?r.competitive.nStrongPool:null,reservoir:rs?rs.pool.length:0,
       pointsRail:r&&r.frame?r.frame.pointsLocal:null,perteMin:rs?sig4(rs.lmin):null,
     };
     res[s]={gardees,cellules,rs};
   }
   const hyps={left:[],right:[]};
   for(const s of SIDES){
     const {gardees,cellules}=res[s],autre=SIDES.find(x=>x!==s);
     gardees.forEach((g,i)=>{
       const m=g.h6?mesuresTranslatees(capture,s,g.mm,g.calage):mesuresPose(capture,s,g.mm,g.calage),sig=m.sig;
       const dessinCellule=g.cellule;
       let proche=null;
       if(!dessinCellule&&cellules.length){
         let best=null;
         for(const k of cellules){const d=Math.hypot(1000*(res[s].rs.sign*k.c.u)-g.mm[1],1000*k.c.z-g.mm[2]);if(!best||d<best.d)best={d,k};}
         proche=best;
       }
       const posAutreH0=capture.rails[autre].positionSceneRelative;
       const gauge0=gaugeMm(m.pos,posAutreH0);
       const base={
         rang:i,origine:g.origine,sous:g.sousListe[0],origines:g.origines.slice().sort(),sousOrigines:[...new Set(g.sousListe)].sort(),
         decal:g.mm.map(v=>arrondi(v,2)),
         traits:{
           perte:dessinCellule?sig4(dessinCellule.c.loss):null,ratioPerte:dessinCellule?arrondi(dessinCellule.ratio,3):null,
           lignesSommet:dessinCellule?dessinCellule.c.topRows??null:null,faces:dessinCellule?dessinCellule.c.faceCount??null:null,
           strong:dessinCellule?g.cellules.some(k=>k.strong):null,palier:dessinCellule?dessinCellule.c.tier??null:null,
           pente:dessinCellule?!!dessinCellule.c.slopeLimited:null,fenetre:dessinCellule?!!dessinCellule.c.windowOk:null,
           competitive:dessinCellule?g.cellules.some(k=>k.comp):null,astar:g.cellules.some(k=>k.astar),
           publiee:g.cellules.some(k=>k.publiee),s1:!!(g.cellules.some(k=>k.publiee)&&railInfo[s].s1),
           balises:dessinCellule?(dessinCellule.c.tags||[]).slice().sort():null,
           distCelluleMm:proche?arrondi(proche.d,1):null,ratioCelluleProche:proche?arrondi(proche.k.ratio,3):null,strongCelluleProche:proche?proche.k.strong:null,
           pointsDessus:sig.pointsDessus,pointsFlanc:sig.pointsFlanc,epaisseurDessusMm:sig.epaisseurDessusMm,
           dzConventionMm:g.calage?arrondi(g.calage.dzMm,2):null,duConventionMm:g.calage?arrondi(g.calage.duMm,2):null,
           convention:g.calage?(g.calage.applied?'appliquee':(g.calage.reason||'refusee')):null,groupeHauteur:g.chaineRail?(g.chaineRail.groupe??null):sig.groupe,
           deplMm:arrondi(norme(g.mm),2),
           ecartVoieMm:voie?arrondi(Math.hypot(g.mm[1]-voie[s][0],g.mm[2]-voie[s][1]),2):null,
           ecartVoisinsMm:interp?arrondi(Math.hypot(g.mm[1]-interp[s][0],g.mm[2]-interp[s][1]),2):null,
           ecartementAutreH0Mm:arrondi(gauge0,1),ecartMedAutreH0Mm:fini(gMed)?arrondi(gauge0-gMed,1):null,
           chaineEtage:g.chaineRail?chaine.v.stage:null,
         },
         _pos:m.pos,_cor:m.cor,
       };
       if(g.h6){
         const cel=dessinCellule?{d:0,k:dessinCellule}:proche,dans=!!(cel&&cel.d<=H6.reservoirMm);
         Object.assign(base.traits,{h6AmpleurMm:arrondi(g.h6.ampleurMm,2),h6DistCuts:g.h6.distCuts,h6NVoisins:g.h6.n,h6DispersionMm:arrondi(g.h6.dispersionMm,2),
           h6DansReservoir:dans,h6Perte:dans?sig4(cel.k.c.loss):null,h6LignesSommet:dans?(cel.k.c.topRows??null):null});
       }
       let correction=null;
       if(g.chaineRail)correction=fini(g.chaineRail.hauteurMm)&&g.chaineRail.hauteurMm!==0?g.chaineRail.hauteurMm:null;
       else if(m.cor&&m.cor.correctionMm)correction=m.cor.correctionMm;
       base.traits.hauteurMm=correction;
       base.traits.hauteurAbstention=g.chaineRail?(g.chaineRail.hauteurAbstention??null):(m.cor?m.cor.abstention:null);
       hyps[s].push({...base,hauteur:false});
       if(correction){
         const mm=[g.mm[0],g.mm[1],g.mm[2]+correction],pos=comptePositions(capture,s,mm);
         hyps[s].push({...base,hauteur:true,decal:mm.map(v=>arrondi(v,2)),_pos:pos,traits:{...base.traits,deplMm:arrondi(norme(mm),2),
           ecartVoieMm:voie?arrondi(Math.hypot(mm[1]-voie[s][0],mm[2]-voie[s][1]),2):null,
           ecartVoisinsMm:interp?arrondi(Math.hypot(mm[1]-interp[s][0],mm[2]-interp[s][1]),2):null,
           ecartementAutreH0Mm:arrondi(gaugeMm(pos,posAutreH0),1),ecartMedAutreH0Mm:fini(gMed)?arrondi(gaugeMm(pos,posAutreH0)-gMed,1):null}});
       }
     });
   }
   if(fini(gMed))for(const s of SIDES){
     const autre=SIDES.find(x=>x!==s);
     for(const h of hyps[s]){let mini=Infinity;for(const o of hyps[autre])mini=Math.min(mini,Math.abs(gaugeMm(h._pos,o._pos)-gMed));h.traits.ecartPaireMedMm=Number.isFinite(mini)?arrondi(mini,1):null;}
   }else for(const s of SIDES)for(const h of hyps[s])h.traits.ecartPaireMedMm=null;
   for(const s of SIDES)for(const h of hyps[s]){delete h._pos;delete h._cor;}
   const ecartDepart=gaugeMm(capture.rails.left.positionSceneRelative,capture.rails.right.positionSceneRelative);
   const abstenu=!SIDES.every(s=>science.rails[s]&&science.rails[s].ok&&science.rails[s].next.status==='candidate')||!!(science.summary&&science.summary.pairGaugeRejected);
   const support=mm=>SIDES.map(s=>{const m=mesuresTranslatees(capture,s,mm[s],null).sig;return {dessus:m.pointsDessus??0,flanc:m.pointsFlanc??0};});
   const soutenu=x=>x.dessus>=H6.supportDessus&&x.flanc>=H6.supportFlanc;
   const refH6=f=>{
     const r=famH6[f]&&famH6[f].reference;
     if(!r)return null;
     const pose=s=>[arrondi(baseH6[s][1]+r[s][0],2),arrondi(baseH6[s][2]+r[s][1],2)];
     const sRef=support({left:[baseH6.left[0],baseH6.left[1]+r.left[0],baseH6.left[2]+r.left[1]],right:[baseH6.right[0],baseH6.right[1]+r.right[0],baseH6.right[2]+r.right[1]]});
     const sDep=support({left:[0,0,0],right:[0,0,0]}),loin=Math.max(...SIDES.map(s=>Math.abs(baseH6[s][1]+r[s][0])))>H6.concurrentMm;
     const motifs=[...r.motifs];
     if(!sRef.every(soutenu))motifs.push('sans-support-local');
     if(loin&&sDep.every(soutenu))motifs.push('voie-concurrente-au-depart');
     return {left:pose('left'),right:pose('right'),n:r.n,distMin:r.distMin,distMax:r.distMax,dispersionMm:{left:arrondi(r.dispersion.left,2),right:arrondi(r.dispersion.right,2)},
       ancres:r.ancres,support:{reference:sRef,depart:sDep},motifs,sure:!motifs.length};
   };
   const voieH6=baseH6?{tous:refH6('tous'),lot:refH6('lot'),departLot:!!departEsv}:null;
   return {rails:hyps,rail:railInfo,tronques,voieH6,tronquesH6,
     cut:{abstenu,differe:seul.decision.stage==='deferred',etage:seul.decision.stage,raison:seul.decision.reason!=null?String(seul.decision.reason).slice(0,60):null,
       etageChaine:chaine?chaine.decision.stage:null,appuisChaine:chaine?(chaine.decision.anchorsUsed||[]).length:0,
       voisins:infoVoisins,ecartDepartMm:arrondi(ecartDepart,1),gMedMm:arrondi(gMed,1),
       ecartementMm:science.pairGauge?arrondi(science.pairGauge.predictedMm,1):null,ecartementRejete:!!(science.summary&&science.summary.pairGaugeRejected),
       nHyp:{left:hyps.left.length,right:hyps.right.length}}};
 }
 /* Soutien du nuage pour une pose d'un rail, décalée de `mm` ([long, lat, vert], mm) depuis la pose de départ : points de dessus et de flanc
  * (mêmes mesures que le soutien de H6). Sert à la décision L1-e (src/gcv2-l1e.js) : un rail corrigé à l'écartement de référence n'est posé
  * que si le nuage le soutient à sa nouvelle place. */
 function soutienRail(capture,side,mm){const m=mesuresTranslatees(capture,side,mm,null).sig;return {dessus:m.pointsDessus??0,flanc:m.pointsFlanc??0};}
 /* Cap 5b — VOIE ABSOLUE des voisins validés : leurs poses (repère scène) lues dans le repère profil de la pose de départ DU CUT, et non comme
  * décalages depuis leurs propres poses de départ (qui changent d'un cut à l'autre en ADV). Par rail : jusqu'à `parCote` voisins de chaque côté à
  * `fenetre` cuts au plus ; droite des moindres carrés (travers et hauteur selon la position le long de la voie), valeur en 0 ; et le voisin le
  * plus proche. Rend { left:{ v:[lat,vert], proche:[lat,vert], distProche, n:{avant,apres}, residuMm }, right } ou null. */
 function voieAbsolue(capture,cut,voisins,fenetre=6,parCote=3,coherents=null){
   const pts={left:[],right:[]},vus=new Set();let liste=[];
   for(const v of voisins||[]){
     if(!v||!v.identity||!v.positions||!Number.isInteger(v.identity.cut))continue;
     const dc=v.identity.cut-cut;if(!dc||Math.abs(dc)>fenetre||vus.has(v.identity.cut))continue;
     const d=Object.fromEntries(SIDES.map(s=>[s,decalage(capture.rails[s],v.positions[s])]));if(!SIDES.every(s=>d[s]))continue;
     vus.add(v.identity.cut);liste.push({d,dc});
   }
   /* Cap 6 (A2) — voisins COHÉRENTS : un voisin validé qui ne s'accorde avec aucun autre (écart en travers et en hauteur, par rail, plus grand que
    * `parCutMm` par cut d'écart entre eux + `baseMm`) est écarté ; s'il ne reste personne, tous restent. Cas visé : une pose de première passe du
    * lot sur une autre voie (203, 451 de 2:18, à 236 et 247 mm de l'opérateur) qui fausse le voisin le plus proche. */
   if(coherents&&liste.length>=3){
     const ok=(a,b)=>SIDES.every(s=>Math.hypot(a.d[s][1]-b.d[s][1],a.d[s][2]-b.d[s][2])<=coherents.parCutMm*Math.abs(a.dc-b.dc)+coherents.baseMm);
     const gardes=liste.filter(a=>liste.some(b=>b!==a&&ok(a,b)));
     if(gardes.length>=2)liste=gardes;
   }
   for(const q of liste)for(const s of SIDES)pts[s].push({d:q.d[s],dc:q.dc});
   const out={};
   for(const s of SIDES){
     const av=pts[s].filter(q=>q.dc<0).sort((a,b)=>b.dc-a.dc).slice(0,parCote),ap=pts[s].filter(q=>q.dc>0).sort((a,b)=>a.dc-b.dc).slice(0,parCote),P=av.concat(ap);
     if(!P.length)return null;
     const pr=P.slice().sort((a,b)=>Math.abs(a.dc)-Math.abs(b.dc))[0];
     const fit=c=>{const n=P.length,mx=P.reduce((a,q)=>a+q.d[0],0)/n,my=P.reduce((a,q)=>a+q.d[c],0)/n,sxx=P.reduce((a,q)=>a+(q.d[0]-mx)**2,0);
       const b=n>=2&&sxx>1?P.reduce((a,q)=>a+(q.d[0]-mx)*(q.d[c]-my),0)/sxx:0,a=n>=2&&sxx>1?my-b*mx:pr.d[c];
       return {v:a,res:n>=3?Math.max(...P.map(q=>Math.abs(q.d[c]-(a+b*q.d[0])))):null};};
     const fl=fit(1),fv=fit(2);
     out[s]={v:[arrondi(fl.v,1),arrondi(fv.v,1)],proche:[arrondi(pr.d[1],1),arrondi(pr.d[2],1)],distProche:Math.abs(pr.dc),n:{avant:av.length,apres:ap.length},residuMm:arrondi(fl.res,1),
       /* Encadrement : interpolation le long de la voie entre le plus proche voisin de chaque côté (null s'il manque un côté). */
       encadre:av.length&&ap.length?(()=>{const a=av[0],b=ap[0],t=Math.abs(b.d[0]-a.d[0])>1e-6?(0-a.d[0])/(b.d[0]-a.d[0]):0.5;
         return {v:[arrondi(a.d[1]+t*(b.d[1]-a.d[1]),1),arrondi(a.d[2]+t*(b.d[2]-a.d[2]),1)],saut:arrondi(Math.hypot(b.d[1]-a.d[1],b.d[2]-a.d[2]),1),cuts:[-a.dc,b.dc]};})():null};
   }
   return out;
 }
 /* Cap 5b — RECHERCHE RECENTRÉE : le moteur (inchangé) relancé sur une capture dont la pose de départ du rail est déplacée à `seeds[s]`
  * ([lat, vert], mm, repère de la pose de départ du cut) ; ses fenêtres (points à 180 mm, recherche à 80 mm) suivent la nouvelle pose. Rend, par
  * rail, les cellules de son réservoir dans la fenêtre du moteur, sans pente limite, d'au moins `filtre.minTop` lignes de dessus et `filtre.minFace`
  * points de flanc, à `filtre.ratioMax` au plus de la perte minimale (défaut : cellules FORTES et compétitives du moteur, 15, 6, 1,5), calage de
  * convention compris, en décalages depuis la vraie pose de départ ; `fort` : forte et compétitive au sens du moteur. */
 const FILTRE_FORT=Object.freeze({minTop:15,minFace:6,ratioMax:1.5});
 function rechercheRecentree(capture,seeds,filtre=FILTRE_FORT){
   const rails={...capture.rails};
   for(const s of SIDES){if(!seeds[s])continue;const rail=capture.rails[s],pos=L.positionOf(rail,[0,seeds[s][0]/1000,seeds[s][1]/1000]);
     rails[s]=O.translated(rail,pos.map((v,i)=>v-rail.positionSceneRelative[i]));}
   const capT={...capture,rails};
   let sci;try{sci=Shadow.scientificProposeBothAvecReservoir(capT);}catch{return null;}
   const T=Shadow.reservoirOutils,out={};
   for(const s of SIDES){
     if(!seeds[s])continue;
     const r=sci.rails[s];if(!r||!r.ok||!r._reservoir){out[s]=[];continue;}
     const rs=r._reservoir;
     out[s]=rs.pool.filter(c=>c.windowOk&&!c.slopeLimited&&(c.topRows??0)>=filtre.minTop&&(c.faceCount??0)>=filtre.minFace&&T.lossRatio(c.loss,rs.lmin)<=filtre.ratioMax).map(c=>{
       const brutD=[0,rs.sign*c.u,c.z],cal=Conv.calibrate(capT,s,brutD),fin=cal.applied?cal.delta:brutD;
       return {mm:decalage(capture.rails[s],L.positionOf(rails[s],fin)),ratio:arrondi(T.lossRatio(c.loss,rs.lmin),3),top:c.topRows,face:c.faceCount,
         fort:T.qualifyStrong(c)&&T.inCompetitive(c,rs.lmin),astar:(c.tags||[]).includes('astar-published')};
     }).filter(x=>x.mm);
   }
   return out;
 }
 /* Cap 5b — PAIRES RECENTRÉES : cellules de la recherche recentrée sur chaque graine ({ nom, left:[lat,vert], right }), dans l'ordre, fusionnées par
  * rail (à 2 mm ; une graine à moins de `dedupMm` d'une graine déjà cherchée n'est pas relancée, son nom s'ajoute), puis toutes les paires à
  * `ecartMm` au plus de l'écartement de référence `refMm`. Chaque paire porte son écart à la référence, son écart en travers et en hauteur au
  * voisin le plus proche de la voie absolue `va`, les graines qui ont donné ses cellules et les traits de ses cellules (lignes de dessus, flanc,
  * rapport de perte, les plus faibles des deux rails). `assez(paires)` : arrêt après la graine où il rend vrai (relances du moteur limitées). */
 function pairesRecentrees(capture,graines,refMm,va,ecartMm,{filtre=FILTRE_FORT,dedupMm=5,assez=null}={}){
   const C={left:[],right:[]},vues=[];let out=[];
   const paires=()=>{
     const r=[];
     for(const l of C.left)for(const rr of C.right){
       const decal={left:l.mm.map(v=>arrondi(v,2)),right:rr.mm.map(v=>arrondi(v,2))},dg=refMm-ecartementDecal(capture,decal);
       if(!(Math.abs(dg)<=ecartMm))continue;
       const dv=va?SIDES.map(s=>Math.abs(decal[s][1]-va[s].proche[0])):null,dz=va?SIDES.map(s=>Math.abs(decal[s][2]-va[s].proche[1])):null;
       r.push({decal,dg:arrondi(dg,1),dv:dv?Math.max(...dv):null,dz:dz?Math.max(...dz):null,depl:arrondi(Math.max(norme(decal.left),norme(decal.right)),1),
         cel:{left:l,right:rr},top:Math.min(l.top,rr.top),face:Math.min(l.face,rr.face),ratio:Math.max(l.ratio,rr.ratio),fort:l.fort&&rr.fort});
     }
     r.sort((a,b)=>(a.dv??0)-(b.dv??0)||Math.abs(a.dg)-Math.abs(b.dg));return r;
   };
   for(const g of graines){
     if(!g||!SIDES.every(s=>Array.isArray(g[s])&&g[s].every(fini)))continue;
     const dej=vues.find(v=>SIDES.every(s=>Math.hypot(v[s][0]-g[s][0],v[s][1]-g[s][1])<dedupMm));
     if(dej){dej.noms.push(g.nom);continue;}
     const vue={left:g.left,right:g.right,noms:[g.nom]};vues.push(vue);
     const rr=rechercheRecentree(capture,{left:g.left,right:g.right},filtre);if(!rr)continue;
     for(const s of SIDES)for(const x of rr[s]||[]){
       const d=C[s].find(c=>Math.hypot(c.mm[1]-x.mm[1],c.mm[2]-x.mm[2])<2);
       if(d){if(!d.vues.includes(vue))d.vues.push(vue);if(x.ratio<d.ratio)d.ratio=x.ratio;d.top=Math.max(d.top,x.top);d.face=Math.max(d.face,x.face);d.fort=d.fort||x.fort;}
       else C[s].push({...x,vues:[vue]});
     }
     if(assez){out=paires();if(assez(out))break;}
   }
   for(const s of SIDES)for(const c of C[s])c.graines=[...new Set(c.vues.flatMap(v=>v.noms))];
   out=paires();
   for(const p of out)p.graines={left:p.cel.left.graines,right:p.cel.right.graines};
   for(const s of SIDES)for(const c of C[s])delete c.vues;
   for(const p of out)delete p.cel;
   return {paires:out,cellules:C,graines:vues.map(v=>v.noms.join('=')),relances:vues.length};
 }
 /* Rupture de série (audit H1) : un appui séparé du cut par un changement de statut ADV rend la voie de référence non sûre. */
 function avecRupture(voie,cut,zones){
   if(!voie)return voie;
   const adv=c=>(zones.get(c)||{}).zone==='adv',t=adv(cut);
   const rompu=(voie.ancres||[]).some(a=>{for(let c=Math.min(a.cut,cut);c<=Math.max(a.cut,cut);c++)if(zones.has(c)&&adv(c)!==t)return true;return false;});
   if(!rompu)return voie;
   return {...voie,motifs:[...voie.motifs,'rupture-de-serie'],sure:false};
 }

 /* ------------------------------------------------------------------ traits et score (tools/gcv2-apprendre.cjs, tools/gcv2-predire-differes.cjs) */
 const T=(nom,src,chemin,tr='id')=>Object.freeze({nom,src,chemin,tr});
 const NUM=Object.freeze([
   T('perte','hyp','perte','log10'),T('ratioPerte','hyp','ratioPerte','log'),T('lignesSommet','hyp','lignesSommet','log'),T('faces','hyp','faces'),
   T('pointsDessus','hyp','pointsDessus','log'),T('pointsFlanc','hyp','pointsFlanc','log'),T('epaisseurDessusMm','hyp','epaisseurDessusMm'),
   T('distCelluleMm','hyp','distCelluleMm','log'),T('ratioCelluleProche','hyp','ratioCelluleProche','log'),
   T('dzConventionMm','hyp','dzConventionMm'),T('duConventionMm','hyp','duConventionMm'),T('deplMm','hyp','deplMm','log'),
   T('ecartVoieMm','hyp','ecartVoieMm','log'),T('ecartVoisinsMm','hyp','ecartVoisinsMm','log'),T('ecartMedAutreH0Mm','hyp','ecartMedAutreH0Mm','abs'),
   T('ecartPaireMedMm','hyp','ecartPaireMedMm','abs'),T('hauteurMm','hyp','hauteurMm'),
   T('strong','hyp','strong','bool'),T('pente','hyp','pente','bool'),T('fenetre','hyp','fenetre','bool'),T('competitive','hyp','competitive','bool'),
   T('astar','hyp','astar','bool'),T('publiee','hyp','publiee','bool'),T('s1','hyp','s1','bool'),T('strongCelluleProche','hyp','strongCelluleProche','bool'),
   T('hauteur','lig','hauteur','bool'),
   T('confianceAstar','rail','confianceAstar'),T('rapportPerteAstar','rail','rapportPerteAstar','log'),T('s1Rail','rail','s1','bool'),
   T('fortsConcurrents','rail','fortsConcurrents','log'),T('competitives','rail','competitives','log'),T('grappes','rail','grappes','log'),
   T('fortsReservoir','rail','fortsReservoir','log'),T('reservoir','rail','reservoir','log'),T('pointsRail','rail','pointsRail','log'),T('perteMin','rail','perteMin','log10'),
   T('appuisChaine','ctx','appuisChaine'),T('voisinsN','ctx','voisinsN'),T('voisinsHumains','ctx','voisinsHumains'),T('voisinsLot','ctx','voisinsLot'),
   T('voisinsEncadre','ctx','voisinsEncadre','bool'),T('voisinsCoupMin','ctx','voisinsCoupMin','log'),T('ecartDepartMedMm','ctx','ecartDepartMedMm','abs'),
   T('accNProches5','acc','nProches5','log'),T('accNProches10','acc','nProches10','log'),T('accPlusProcheMm','acc','plusProcheMm','log'),
   T('accDistH1Mm','acc','distH1Mm','log'),T('accDistChaineMm','acc','distChaineMm','log'),T('accDistVoisinsMm','acc','distVoisinsMm','log'),T('accNOrigines','acc','nOrigines'),
   T('h6AmpleurMm','hyp','h6AmpleurMm','log'),T('h6DistCuts','hyp','h6DistCuts','log'),T('h6NVoisins','hyp','h6NVoisins'),T('h6DispersionMm','hyp','h6DispersionMm','log'),
   T('h6Perte','hyp','h6Perte','log10'),T('h6LignesSommet','hyp','h6LignesSommet','log'),T('h6DansReservoir','hyp','h6DansReservoir','bool'),
 ]);
 const CAT=Object.freeze([
   T('palier','hyp','palier'),T('convention','hyp','convention'),T('groupeHauteur','hyp','groupeHauteur'),T('chaineEtage','hyp','chaineEtage'),
   T('hauteurAbstention','hyp','hauteurAbstention'),T('statut','rail','statut'),T('motif','rail','motif'),T('etageChaine','ctx','etageChaine'),
   T('zone','ctx','zone'),T('role','ctx','role'),
 ]);
 const MULTI=Object.freeze([T('balises','hyp','balises'),T('origines','lig','origines'),T('sousOrigines','lig','sousOrigines')]);
 function transfo(tr,v){
   if(v===null||v===undefined)return NaN;
   if(tr==='bool')return v===true?1:v===false?0:NaN;
   if(typeof v!=='number'||!Number.isFinite(v))return NaN;
   if(tr==='log')return Math.sign(v)*Math.log1p(Math.abs(v));
   if(tr==='log10')return Math.log10(Math.max(v,1e-12));
   if(tr==='abs')return Math.abs(v);
   return v;
 }
 function accords(hyps){
   const d=(a,b)=>Math.hypot(a.decal[0]-b.decal[0],a.decal[1]-b.decal[1],a.decal[2]-b.decal[2]);
   const h1=hyps.find(h=>!h.hauteur&&h.origines.includes('H1')),ch=hyps.find(h=>!h.hauteur&&h.sousOrigines.includes('chaine')),vo=hyps.find(h=>!h.hauteur&&h.origines.includes('H4'));
   return hyps.map(h=>{
     let n5=0,n10=0,mini=Infinity;
     for(const o of hyps){if(o===h)continue;const e=d(h,o);if(e<=5)n5++;if(e<=10)n10++;if(e<mini)mini=e;}
     return {nProches5:n5,nProches10:n10,plusProcheMm:Number.isFinite(mini)?mini:null,distH1Mm:h1?d(h,h1):null,distChaineMm:ch?d(h,ch):null,
       distVoisinsMm:vo?d(h,vo):null,nOrigines:h.origines.length};
   });
 }
 function brut(ligne,rail,ctx,acc){
   const S={hyp:ligne.traits||{},lig:ligne,rail:rail||{},ctx,acc};
   const lire=t=>S[t.src][t.chemin];
   return {n:Float64Array.from(NUM,t=>transfo(t.tr,lire(t))),c:CAT.map(t=>{const v=lire(t);return v===null||v===undefined?'∅':String(v);}),
     m:MULTI.map(t=>{const v=lire(t);return Array.isArray(v)?v.map(String):[];})};
 }
 function coder(fit,l,out=new Float64Array(fit.p),off=0){
   let j=off;
   fit.num.forEach((f,c)=>{if(!f||f.constant)return;const v=l.n[c],ko=Number.isNaN(v);out[j++]=ko?0:Math.max(-6,Math.min(6,(v-f.moy)/f.sd));if(f.manque)out[j++]=ko?1:0;});
   fit.cat.forEach((vals,c)=>{if(vals.length>1)for(const v of vals)out[j++]=l.c[c]===v?1:0;});
   fit.multi.forEach((vals,c)=>{for(const v of vals)out[j++]=l.m[c].includes(v)?1:0;});
   return out;
 }
 const sigmoide=z=>z>=0?1/(1+Math.exp(-z)):Math.exp(z)/(1+Math.exp(z));
 const appliquerPlatt=(c,z)=>sigmoide(c.a*z+c.b);
 const FORMAT_PARAMS='ariane-gcv2-parametres-v1';
 /* Codage et modèles d'un usage, depuis le fichier exporté, sans rien apprendre ; refus si les colonnes reconstruites ne sont pas celles du fichier. */
 function modeleFige(params,usage='lot'){
   if(!params||params.format!==FORMAT_PARAMS)throw Error(`paramètres : format ${FORMAT_PARAMS} attendu`);
   const u=params.usages&&params.usages[usage];
   if(!u)throw Error(`paramètres : usage « ${usage} » absent`);
   const norm=new Map((u.normalisation||[]).map(x=>[x.nom,x]));
   const accord=params.accord!==false;
   const num=NUM.map(t=>{const x=norm.get(t.nom);return x?{moy:x.moyenne,sd:x.ecartType,constant:false,manque:!!x.manque}:null;});
   const noms=[];
   num.forEach((f,i)=>{if(f){noms.push(NUM[i].nom);if(f.manque)noms.push(NUM[i].nom+':manque');}});
   const cat=CAT.map(t=>(u.categories[t.nom]||[]).slice());
   cat.forEach((vals,c)=>{if(vals.length>1)for(const v of vals)noms.push(`${CAT[c].nom}=${v}`);});
   const multi=MULTI.map(t=>(u.categories[t.nom]||[]).slice());
   multi.forEach((vals,c)=>{for(const v of vals)noms.push(`${MULTI[c].nom}∋${v}`);});
   if(JSON.stringify(noms)!==JSON.stringify(u.colonnes))throw Error(`paramètres : les colonnes reconstruites (${noms.length}) ne sont pas celles du fichier (${u.colonnes.length}) : refus`);
   const fit={num,cat,multi,noms,p:noms.length,accord};
   for(const k of ['modele10','modele5'])if(u[k].coefficients.length!==fit.p)throw Error(`paramètres : ${k} n'a pas ${fit.p} coefficients`);
   return {usage,version:params.version??null,date:params.date??null,fit,m10:{coef:Float64Array.from(u.modele10.coefficients),intercept:u.modele10.intercept},
     m5:{coef:Float64Array.from(u.modele5.coefficients),intercept:u.modele5.intercept},cal10:{a:u.calibrage10.a,b:u.calibrage10.b},cal5:{a:u.calibrage5.a,b:u.calibrage5.b},
     seuils:JSON.parse(JSON.stringify(u.seuils))};
 }
 function probas(mod,x){
   const v=coder(mod.fit,x),lin=m=>{let s=m.intercept;for(let j=0;j<v.length;j++)s+=v[j]*m.coef[j];return s;};
   return {p10:appliquerPlatt(mod.cal10,lin(mod.m10)),p5:appliquerPlatt(mod.cal5,lin(mod.m5))};
 }
 /* Le cas d'un différé (`casDuDiffere` de gcv2-predire-differes, sans les paires du garde-fou de voie). */
 function casDuDiffere({cut,zone,hyp,gMed,voieRef}){
   const G0=hyp.cut.ecartDepartMm,v=hyp.cut.voisins||{};
   const ctx={zone,role:'differe',etageChaine:hyp.cut.etageChaine,appuisChaine:hyp.cut.appuisChaine,voisinsN:v.n??null,voisinsHumains:v.humains??null,voisinsLot:v.lot??null,
     voisinsEncadre:v.encadre??null,voisinsCoupMin:v.coupMin??null,ecartDepartMedMm:fini(G0)&&fini(gMed)?G0-gMed:null};
   const k={cut,zone,role:'differe',gMed:fini(gMed)?arrondi(gMed,1):null,G0,rails:{},voieRef:voieRef||null};
   for(const s of SIDES){
     const liste=hyp.rails[s].map(h=>({...h,traits:{...h.traits,zone,role:'differe'}})),acc=accords(liste);
     k.rails[s]={hyps:liste.map((h,i)=>({rang:h.rang,hauteur:!!h.hauteur,origines:h.origines,sousOrigines:h.sousOrigines,decal:h.decal,g:h.traits.ecartementAutreH0Mm,
       x:brut(h,hyp.rail[s],ctx,acc[i]),h6:h.origines.includes('H6')}))};
   }
   k.i0={};for(const s of SIDES){k.i0[s]=k.rails[s].hyps.findIndex(h=>!h.hauteur&&h.origines.includes('H0'));if(k.i0[s]<0)k.i0[s]=k.rails[s].hyps.findIndex(h=>!h.hauteur&&h.decal.every(x=>Math.abs(x)<0.75));}
   return k;
 }
 const ecartementPaire=(k,hl,hr)=>fini(k.G0)&&fini(hl.g)&&fini(hr.g)?k.G0+(hl.g-k.G0)+(hr.g-k.G0):null;

 /* ------------------------------------------------------------------ décision L1 d'un différé */
 /* Meilleure paire (produit des scores à 10 mm) parmi toutes les paires dont l'écartement tient, la paire de départ comprise (comme
  * `gcv2Variantes` de tools/diag-differes.cjs, couloir « aucun », écartement allumé). `ecart` : le plus grand décalage latéral ou vertical. */
 function meilleurePaire(k,p,regle=REGLE){
   const Lh=k.rails.left.hyps,Rh=k.rails.right.hyps,i0=k.i0.left,j0=k.i0.right;
   let best={i:i0,j:j0,v:p.left[i0]*p.right[j0],ecart:0,h0:true},n=0;
   for(let i=0;i<Lh.length;i++)for(let j=0;j<Rh.length;j++){
     if(i===i0&&j===j0)continue;
     const hl=Lh[i],hr=Rh[j],g=ecartementPaire(k,hl,hr);
     if(!(fini(g)&&((fini(k.gMed)&&Math.abs(g-k.gMed)<=regle.ecartementMedianeMm)||(g>=regle.contratMm[0]&&g<=regle.contratMm[1]))))continue;
     n++;
     const v=p.left[i]*p.right[j];
     if(v>best.v)best={i,j,v,ecart:Math.max(Math.abs(hl.decal[1]),Math.abs(hl.decal[2]),Math.abs(hr.decal[1]),Math.abs(hr.decal[2])),h0:false};
   }
   return {...best,permises:n};
 }
 /* Décision L1 : { etat: 'valider' | 'poser-sans-valider' | 'rien', motif, paire, p, ecartDepartMm (3D, pire rail), zone, tau, delta, hypothese }.
  *   valider : la paire est au-dessus de τ (zone active) et à δ au moins (P2) ;
  *   poser-sans-valider : sous τ, à δ au moins, à `sansValiderMaxMm` au plus de la pose de départ (L1) ; L1-v : valider (et inscrire aux verts à contrôler) ;
  *   rien : paire de départ la plus probable (`depart-le-plus-probable`), sous δ (`sous-delta`), zone inactive, ou sous τ à plus de 150 mm (`plus-de-150-mm`). */
 function deciderL1(k,mod,regle=REGLE,probasDonnees=null){
   const p={};
   for(const s of SIDES)p[s]=probasDonnees?Float64Array.from(probasDonnees[s]):Float64Array.from(k.rails[s].hyps.map(h=>probas(mod,h.x).p10));
   if(SIDES.some(s=>k.i0[s]<0))return {etat:'rien',motif:'sans-pose-de-depart',p:null,paire:null,ecartDepartMm:null,zone:k.zone,probas:p};
   const b=meilleurePaire(k,p,regle),z=mod.seuils[k.zone]||mod.seuils.hors||{actif:false};
   const hl=k.rails.left.hyps[b.i],hr=k.rails.right.hyps[b.j];
   const ecart3d=Math.max(norme(hl.decal),norme(hr.decal));
   const paire={left:{decal:hl.decal,origines:hl.origines,sousOrigines:hl.sousOrigines,hauteur:hl.hauteur},right:{decal:hr.decal,origines:hr.origines,sousOrigines:hr.sousOrigines,hauteur:hr.hauteur}};
   const out={zone:k.zone,tau:z.tau??null,delta:z.delta??null,p:arrondi(b.v,4),ecartDepartMm:arrondi(ecart3d,1),ecartMaxLatVertMm:arrondi(b.ecart,1),paire,i:b.i,j:b.j,permises:b.permises,
     hypothese:[...new Set([...hl.origines,...hr.origines])].sort().join('+'),probas:p};
   if(b.h0)return {...out,etat:'rien',motif:'depart-le-plus-probable',paire:null};
   if(!z.actif)return {...out,etat:'rien',motif:'zone-inactive'};
   if(b.ecart<z.delta)return {...out,etat:'rien',motif:'sous-delta'};
   if(b.v>=z.tau)return {...out,etat:'valider',motif:null};
   if(regle.variante==='L1-v')return {...out,etat:ecart3d>regle.sansValiderMaxMm?'rien':'valider',motif:ecart3d>regle.sansValiderMaxMm?'plus-de-150-mm':'sous-tau-a-controler',aControler:ecart3d<=regle.sansValiderMaxMm};
   if(ecart3d>regle.sansValiderMaxMm)return {...out,etat:'rien',motif:'plus-de-150-mm'};
   return {...out,etat:'poser-sans-valider',motif:'sous-tau'};
 }
 /* 4.9.5.15 (test 15, fiches/L1_CAP5.md) — LEVIERS de la décision L1-e, valeurs v4 (test 15) : la base de tous les leviers. Le banc peut les
  * changer pour une mesure (`reglerLeviers`), jamais l'extension. */
 const LEVIERS_V4=Object.freeze({exact:true,autreRail:true,anomalieMinMm:10,anomalieMaxMm:45,sousTauCoherentMm:8,sousTauCorrige:false,voisins:true,transport:true,
   voisinsRaffineMm:8,voisinsEcartMaxMm:10,vetoVoieMm:45,raffineObligatoire:true,anomalieNonCorrigeeRien:true,
   consensus:true,consensusEcartMm:10,consensusVoieMm:15,consensusVoieProche:true,selectionRefMm:null,
   consensusTous:false,voieProcheMaxCuts:5,diag:false,
   vetoVoieAbsMm:null,voieIncoherenteMm:null,contreChaineZones:null,contreChaineVoieMm:null,contreChaineMm:null,
   validerSansVoieMinP:null,anomalieMinRienMm:null,anomalieMinRienSansVoieMm:null,corrigeVoieMaxMm:null,sansVoieRien:false,voieListe:false,voieListeFenetre:8,deuxiemePasse:0,passe2Leviers:null,passesAlternees:false,
   branche:false,brancheMm:8,brancheVertMm:25,brancheMaxCuts:6,brancheExtrapCuts:1,brancheEcartement:Object.freeze([1380,1520]),voieProcheSureCuts:null,
   soutienMinDessus:null,soutienMinFlanc:null,
   rechercheDiag:false,voieAbsFenetre:6,rechercheADV:false,rechZones:null,rechEcartMm:10,rechMaxDeplMm:300,rechVoieMaxMm:80,rechHauteurMaxMm:null,
   rechProcheMaxCuts:6,rechUniqueMm:15,rechRemplace:false,rechRemplaceMm:5,rechSansPaireRien:false,rechVoieParCutMm:null,rechContraMinMm:null,rechContraMaxMm:45,rechContraRien:false,
   rechMinTop:15,rechMinFace:6,rechRatioMax:1.5,rechDedupMm:5,rechArret:false,rechGraineDecalMm:0,rechDiagLarge:false,rechOrdreGraines:null,
   rechEncadre:false,rechEncadreMaxCuts:1,rechEncadreSautMm:15,rechEncadreEcartMm:15,corrigeValideZones:null,anomalieNonCorrigeePMin:null,anomalieNonCorrigeeVoieMm:null,rechPaireTopMin:null,rechContraRatioMax:null,rechSauteProcheMm:null,rechSauteProcheCuts:2,rechSauteProcheZones:null,
   voisinsCoherents:false,voisinsCoherentsParCutMm:40,voisinsCoherentsBaseMm:15,rechVoisinsMin:null,brancheDernier:false,
   rechListeResMm:null,rechListeVoieMm:20,rechListeZones:null});
 /* 4.9.5.16 (test 16, fiches/PASSATION_CAP5_A3.md, fiches/PASSATION_CAP5_B.md) — LEVIERS v5 LIVRÉS : la chaîne mesurée au banc « a3-bd3 sans
  * deuxième passe » (a3-bd3s, mesurée sur a2486b1) : b-r7a de l'agent B (recherche recentrée, gardes de preuve, arrêt et saut de coût) avec, de
  * l'agent A, la recherche en ADV ET en abords, les voisins cohérents, l'écartement de la paire recentrée à 15 mm et la branche rail par rail en
  * dernier recours. Sans deuxième passe au banc (`deuxiemePasse` 0 ; celle de l'extension a son réglage, `lot.passeDifferes`, coupé) ; diagnostics coupés (`diag`,
  * `rechercheDiag` : ils n'écrivent que le journal, aucune décision ne les lit). */
 const LEVIERS_V5=Object.freeze({rechercheADV:true,rechZones:Object.freeze(['adv','abords']),rechEcartMm:15,rechVoieParCutMm:40,rechHauteurMaxMm:20,
   rechContraMinMm:22,rechContraMaxMm:45,rechContraRien:true,rechRemplace:true,rechRemplaceMm:12,corrigeValideZones:Object.freeze(['adv']),rechEncadre:true,
   anomalieNonCorrigeePMin:0.8,anomalieNonCorrigeeVoieMm:35,rechPaireTopMin:60,rechContraRatioMax:1.5,rechArret:true,rechSauteProcheMm:2.5,
   voisinsCoherents:true,branche:true,brancheDernier:true,brancheVertMm:60,brancheExtrapCuts:2});
 /* 4.9.5.18 (test 18, fiches/PASSATION_T17_SANSPOSE.md) — LEVIERS v6 LIVRÉS : hauteur de la paire recentrée à 25 mm du voisin au plus (20 dans la v5). Au banc :
  * 0 cut changé sur les 9 anciens lots, avec et sans deuxième passe ; sur 3:0 (apprentissage), poses fausses 846 et 847 remplacées par la paire juste (à 22 mm
  * en hauteur), 229, 845 et 848 posés justes. */
 const LEVIERS_V6=Object.freeze({rechHauteurMaxMm:25});
 const LEVIERS_LIVRES=Object.freeze({...LEVIERS_V4,...LEVIERS_V5,...LEVIERS_V6});
 let LEVIERS=LEVIERS_LIVRES;
 function reglerLeviers(l){LEVIERS=l?Object.freeze({...LEVIERS_LIVRES,...l}):LEVIERS_LIVRES;return LEVIERS;}
 /* Écartement exact (mm) d'une paire de décalages depuis la pose de départ de la capture. */
 function ecartementDecal(capture,decal){return gaugeMm(L.positionOf(capture.rails.left,decal.left.map(v=>v/1000)),L.positionOf(capture.rails.right,decal.right.map(v=>v/1000)));}
 /* Le rail `rail` déplacé en travers (vertical gardé) pour que la paire prenne l'écartement `ref` (Newton, comme H5). Rend les décalages ou null. */
 function ramenerRail(capture,decal,rail,ref,maxMm=60){
   const out={left:decal.left.slice(),right:decal.right.slice()},g=a=>{const d={left:out.left.slice(),right:out.right.slice()};d[rail][1]=decal[rail][1]+a;return ecartementDecal(capture,d);};
   let a=0;
   for(let k=0;k<6;k++){const pente=(g(a+5)-g(a))/5;if(!(Math.abs(pente)>0.3))return null;a-=(g(a)-ref)/pente;}
   if(!Number.isFinite(a)||Math.abs(a)>maxMm||Math.abs(g(a)-ref)>0.5)return null;
   out[rail][1]=arrondi(decal[rail][1]+a,2);return out;
 }
 /* Correction d'écartement d'une paire de décalages : anomalie si l'écart à la référence est dans [anomalieMinMm, anomalieMaxMm] ; rails essayés
  * dans l'ordre `ordre` (le moins sûr d'abord) ; le premier que le nuage soutient à sa nouvelle place est retenu (sans `autreRail` : le premier
  * seulement). `gApprox` : écartement des hypothèses, pris sans capture (ou sans le levier `exact`) ; sans capture, rien n'est corrigé.
  * Rend { ref, ecartMm, anomalie, rail, soutenue, decal (corrigé) ou null }. */
 function corrigerDecal({capture,decal,ref,ordre,gApprox=null,leviers=LEVIERS}){
   const g=leviers.exact&&capture?ecartementDecal(capture,decal):gApprox;
   const out={ref,ecartMm:fini(g)&&fini(ref)?arrondi(ref-g,1):null,anomalie:false,rail:null,soutenue:false,decal:null};
   if(!fini(out.ecartMm))return out;
   const e=Math.abs(out.ecartMm);if(e<leviers.anomalieMinMm||e>leviers.anomalieMaxMm)return out;
   out.anomalie=true;
   if(!capture)return out;
   for(const s of leviers.autreRail?ordre:ordre.slice(0,1)){
     const nd=ramenerRail(capture,decal,s,ref);if(!nd)continue;
     const m=soutienRail(capture,s,nd[s]);
     if(m.dessus>=E.REGLAGE.soutienDessus&&m.flanc>=E.REGLAGE.soutienFlanc){out.rail=s;out.soutenue=true;out.decal=nd;return out;}
     if(!out.rail)out.rail=s;
   }
   return out;
 }
 /* Ordre des rails à corriger : le moins probable d'abord (probabilités de la GCV2), sinon le moins soutenu par le nuage à sa place. */
 function ordreRails(capture,decal,p=null){
   if(p&&fini(p.left)&&fini(p.right))return p.left<=p.right?['left','right']:['right','left'];
   const m={left:soutienRail(capture,'left',decal.left),right:soutienRail(capture,'right',decal.right)};
   return m.left.dessus<=m.right.dessus?['left','right']:['right','left'];
 }
 /* Décision L1-e d'un cas (`casDuDiffere`) : la décision de la test 13 (`deciderL1`, mêmes probabilités), puis la correction d'écartement contre
  * la référence `ref` ({ mm } : lignes valides non touchées de la liste d'ESV, ou null), soutien du nuage lu sur la capture. Même forme que
  * `deciderL1` ; `etat` : 'valider' ou 'rien' (jamais de pose sans validation) ; `test13` : la décision d'origine. */
 /* Toutes les paires (i, j) des hypothèses du nuage : à `consensusVoieMm` en travers de la voie et à `consensusEcartMm` de l'écartement de
  * référence ; classées par écart à la voie puis à la référence ; la première que le nuage soutient des deux côtés. Rend { decal, dv, dg } ou null. */
 function paireConsensus(k,capture,voie,refMm,soutenu){
   const near=s=>k.rails[s].hyps.filter(h=>Math.abs(h.decal[1]-voie[s][0])<=LEVIERS.consensusVoieMm),c=[];
   for(const hl of near('left'))for(const hr of near('right')){const decal={left:hl.decal,right:hr.decal},dg=Math.abs(refMm-ecartementDecal(capture,decal));
     if(dg<=LEVIERS.consensusEcartMm)c.push({decal,dg,dv:Math.max(Math.abs(hl.decal[1]-voie.left[0]),Math.abs(hr.decal[1]-voie.right[0]))});}
   c.sort((a,b)=>a.dv-b.dv||a.dg-b.dg);
   for(const x of c)if(soutenu(x.decal))return x;
   return null;
 }
 function deciderL1e(k,mod,ref,capture,probasDonnees=null){
   if(!E)throw Error('GCV2 L1-e : module absent.');
   const d0=fini(LEVIERS.selectionRefMm)&&ref&&fini(ref.mm)&&capture?deciderL1Ref(k,mod,ref.mm,capture,probasDonnees):deciderL1(k,mod,REGLE,probasDonnees),p=d0.probas;
   let c=null;
   if(d0.paire&&Number.isInteger(d0.i)&&Number.isInteger(d0.j)&&ref&&fini(ref.mm)){
     const hl=k.rails.left.hyps[d0.i],hr=k.rails.right.hyps[d0.j],decal={left:hl.decal,right:hr.decal};
     c=corrigerDecal({capture,decal,ref:ref.mm,gApprox:ecartementPaire(k,hl,hr),ordre:ordreRails(capture,decal,{left:p.left[d0.i],right:p.right[d0.j]})});
   }
   let dd=E.decider(d0,c);
   /* Cap 5b — `corrigeValideZones` (liste de zones, coupé par défaut) : seules ces zones corrigent par l'écartement une paire que la test 13 valide
    * elle-même ; ailleurs la paire validée est gardée si le nuage la soutient (hors ADV, l'écartement de la liste n'est pas une preuve contre elle). */
   if(Array.isArray(LEVIERS.corrigeValideZones)&&dd.etat==='valider'&&dd.corrigee&&d0.etat==='valider'&&d0.paire&&capture&&!LEVIERS.corrigeValideZones.includes(k.zone)){
     const decal0={left:d0.paire.left.decal,right:d0.paire.right.decal};
     if(SIDES.every(s=>{const m=soutienRail(capture,s,decal0[s]);return m.dessus>=E.REGLAGE.soutienDessus&&m.flanc>=E.REGLAGE.soutienFlanc;}))dd={etat:'valider',motif:null,decal:decal0,corrigee:false,correctionAnnulee:true};
   }
   /* Anomalie d'écartement qu'aucun rail soutenu ne corrige : la paire de la test 13 n'est pas validée. */
   /* Cap 5b — `anomalieNonCorrigeePMin` (coupé par défaut) : si la test 13 valide sa paire avec p au moins égal à ce seuil et que le nuage soutient les
   * deux rails à leur place, l'anomalie d'écartement que rien ne corrige n'écarte pas la paire (l'écartement de la liste est alors le point douteux). */
  if(LEVIERS.anomalieNonCorrigeeRien&&dd.etat==='valider'&&c&&c.anomalie&&!c.soutenue){
    const decal0=d0.paire?{left:d0.paire.left.decal,right:d0.paire.right.decal}:null;
    /* Garde indépendante de p (`anomalieNonCorrigeeVoieMm`, si réglée) : les deux rails de la paire à cette valeur au plus, en travers, du voisin validé
     * le plus proche (voie absolue, `rechProcheMaxCuts` cuts au plus) ; sans voisin proche, la paire n'est pas gardée. */
    const voieOk=()=>{if(!fini(LEVIERS.anomalieNonCorrigeeVoieMm))return true;const va=voieAbsolue(capture,k.cut,k.voisinsAbs,LEVIERS.voieAbsFenetre);
      return !!va&&SIDES.every(s=>va[s].distProche<=LEVIERS.rechProcheMaxCuts&&Math.abs(decal0[s][1]-va[s].proche[0])<=LEVIERS.anomalieNonCorrigeeVoieMm);};
    if(fini(LEVIERS.anomalieNonCorrigeePMin)&&d0.etat==='valider'&&decal0&&capture&&d0.p>=LEVIERS.anomalieNonCorrigeePMin&&SIDES.every(s=>{const m=soutienRail(capture,s,decal0[s]);return m.dessus>=E.REGLAGE.soutienDessus&&m.flanc>=E.REGLAGE.soutienFlanc;})&&voieOk())
      dd={etat:'valider',motif:null,decal:decal0,corrigee:false,anomalieGardee:true};
    else dd={etat:'rien',motif:'anomalie-non-corrigee',decal:null,corrigee:false};
  }
   /* Voie de référence : celle des voisins validés AVEC les poses de la GCV2 (transport, si le banc ou le lot la donne), sinon celle de H6. */
   /* Voie sûre : transport, H6, liste d'ESV (levier), ou le voisin posé le plus proche s'il est à `voieProcheSureCuts` cut(s) au plus (levier). */
   const voie=k.voieTransport&&k.voieTransport.sure?k.voieTransport:k.voieRef&&k.voieRef.sure?k.voieRef:LEVIERS.voieListe&&k.voieListe&&k.voieListe.sure?k.voieListe
     :fini(LEVIERS.voieProcheSureCuts)&&k.voieProche&&k.voieProche.dist<=LEVIERS.voieProcheSureCuts?k.voieProche:null;
   const soutenu=decal=>SIDES.every(s=>{const m=soutienRail(capture,s,decal[s]);return m.dessus>=E.REGLAGE.soutienDessus&&m.flanc>=E.REGLAGE.soutienFlanc;});
   /* Leviers du cap 5 (fiches/L1_CAP5.md). Sous τ : paire déjà à l'écartement de référence et soutenue, ou corrigée et soutenue. */
   if(dd.etat==='rien'&&d0.etat==='poser-sans-valider'&&c&&capture){
     const decal={left:d0.paire.left.decal,right:d0.paire.right.decal};
     if(fini(LEVIERS.sousTauCoherentMm)&&!c.anomalie&&fini(c.ecartMm)&&Math.abs(c.ecartMm)<=LEVIERS.sousTauCoherentMm&&soutenu(decal))dd={etat:'valider',motif:'sous-tau-coherent',decal,corrigee:false};
     else if(LEVIERS.sousTauCorrige&&c.anomalie&&c.soutenue)dd={etat:'valider',motif:'sous-tau-corrige',decal:c.decal,corrigee:true};
   }
   /* Voie des voisins validés (H6, référence sûre) : la paire transportée, rapprochée de l'hypothèse du nuage la plus proche (`voisinsRaffineMm`),
    * soutenue par le nuage et à l'écartement de référence. */
   if(dd.etat==='rien'&&LEVIERS.voisins&&voie&&capture&&dd.motif!=='anomalie-non-corrigee'){
     const v=voie,decal={left:[0,v.left[0],v.left[1]],right:[0,v.right[0],v.right[1]]};let raffines=0;
     for(const s of SIDES){let best=null;for(const h of k.rails[s].hyps){const e=norme(moins(h.decal,decal[s]));if(e<=LEVIERS.voisinsRaffineMm&&(!best||e<best.e))best={e,h};}if(best){decal[s]=best.h.decal.slice();raffines++;}}
     const g=ecartementDecal(capture,decal),ok=(!LEVIERS.raffineObligatoire||raffines===2)&&(!ref||!fini(ref.mm)||Math.abs(ref.mm-g)<=LEVIERS.voisinsEcartMaxMm);
     if(ok&&soutenu(decal))dd={etat:'valider',motif:'voie-voisins',decal,corrigee:false};
   }
   /* Consensus : sous τ ou sans paire, une paire est validée quand trois preuves indépendantes s'accordent : le nuage (deux rails soutenus), l'écartement
    * de référence (à `consensusEcartMm`) et la voie des voisins validés (à `consensusVoieMm` en travers). Candidats : la paire de la test 13, sa
    * correction, et la « complétion » (le rail le plus probable du nuage, l'autre ramené à l'écartement de référence depuis la voie des voisins). */
   const voieC=voie||(LEVIERS.consensusVoieProche&&k.voieProche&&k.voieProche.dist<=LEVIERS.voieProcheMaxCuts?k.voieProche:null);
   if(dd.etat==='rien'&&LEVIERS.consensus&&voieC&&capture&&ref&&fini(ref.mm)&&dd.motif!=='anomalie-non-corrigee'){
     const cands=[];
     if(d0.paire)cands.push({left:d0.paire.left.decal,right:d0.paire.right.decal});
     if(c&&c.anomalie&&c.soutenue)cands.push(c.decal);
     for(const s of SIDES){
       const o=s==='left'?'right':'left',hs=k.rails[s].hyps.map((h,i)=>({h,p:p[s][i],i})).filter(x=>x.i!==k.i0[s]).sort((a,b)=>b.p-a.p);
       if(!hs.length)continue;
       const base={[s]:hs[0].h.decal.slice(),[o]:[0,voieC[o][0],voieC[o][1]]},nd=ramenerRail(capture,base,o,ref.mm);
       if(nd)cands.push(nd);
     }
     for(const cand of cands){
       const g=ecartementDecal(capture,cand),dv=Math.max(...SIDES.map(s=>Math.abs(cand[s][1]-voieC[s][0])));
       if(Math.abs(ref.mm-g)<=LEVIERS.consensusEcartMm&&dv<=LEVIERS.consensusVoieMm&&soutenu(cand)){dd={etat:'valider',motif:'consensus',decal:cand,corrigee:false};break;}
     }
     /* Consensus sur toutes les paires d'hypothèses du nuage : la voie des voisins choisit (écart en travers le plus petit), l'écartement de
      * référence ne fait que départager ; nuage (deux rails soutenus), voie et écartement doivent tous trois s'accorder. */
     if(dd.etat==='rien'&&LEVIERS.consensusTous){const t=paireConsensus(k,capture,voieC,ref.mm,soutenu);if(t)dd={etat:'valider',motif:'consensus-tous',decal:t.decal,corrigee:false};}
   }
   /* Branche (ADV) : sans paire retenue, chaque rail prend l'hypothèse du nuage la plus proche de la voie géométrique de SON rail (à `brancheMm`),
    * en travers (et à `brancheVertMm` en hauteur), sans imposer l'écartement de la voie (seulement une plage plausible), les deux rails soutenus par le
    * nuage. Voie interpolée (posés avant et après), ou prolongée d'au plus `brancheExtrapCuts` cut. */
   if(dd.etat==='rien'&&LEVIERS.branche&&!LEVIERS.brancheDernier&&capture&&k.voieGeo&&(k.voieGeo.mode==='interp'||k.voieGeo.mode==='extrap'&&k.voieGeo.distCuts<=LEVIERS.brancheExtrapCuts)&&dd.motif!=='anomalie-non-corrigee'){
     const g=k.voieGeo,decal={};
     for(const s of SIDES){let best=null;for(const h of k.rails[s].hyps){const e=Math.abs(h.decal[1]-g[s][0]);if(e<=LEVIERS.brancheMm&&Math.abs(h.decal[2]-g[s][1])<=LEVIERS.brancheVertMm&&(!best||e<best.e))best={e,h};}if(best)decal[s]=best.h.decal.slice();}
     if(SIDES.every(s=>decal[s])){const ga=ecartementDecal(capture,decal);if(ga>=LEVIERS.brancheEcartement[0]&&ga<=LEVIERS.brancheEcartement[1]&&soutenu(decal))dd={etat:'valider',motif:'branche',decal,corrigee:false};}
   }
   /* Qualité (v5) : sans voie sûre des voisins, une validation de la test 13 exige p ≥ `validerSansVoieMinP` ; un « plus de 150 mm » validé par
    * correction exige une anomalie d'au moins `anomalieMinRienMm` (`anomalieMinRienSansVoieMm` sans voie sûre) et, si `corrigeVoieMaxMm`, une voie sûre à moins de `corrigeVoieMaxMm` en travers. */
   /* Sans voie sûre des voisins (transport ou H6), aucune validation de la GCV2 (`sansVoieRien`) : la preuve du nuage seule ne suffit pas. */
   if(dd.etat==='valider'&&!voie&&LEVIERS.sansVoieRien&&dd.motif!=='branche')dd={etat:'rien',motif:'sans-voie',decal:null,corrigee:false};
   if(dd.etat==='valider'&&!voie&&d0.etat==='valider'&&fini(LEVIERS.validerSansVoieMinP)&&!(d0.p>=LEVIERS.validerSansVoieMinP))dd={etat:'rien',motif:'sans-voie-p',decal:null,corrigee:false};
   if(dd.etat==='valider'&&d0.etat==='rien'&&dd.corrigee&&c&&fini(LEVIERS.anomalieMinRienMm)&&!(Math.abs(c.ecartMm)>=LEVIERS.anomalieMinRienMm))dd={etat:'rien',motif:'anomalie-faible',decal:null,corrigee:false};
   if(dd.etat==='valider'&&d0.etat==='rien'&&dd.corrigee&&c&&!voie&&fini(LEVIERS.anomalieMinRienSansVoieMm)&&!(Math.abs(c.ecartMm)>=LEVIERS.anomalieMinRienSansVoieMm))dd={etat:'rien',motif:'anomalie-faible-sans-voie',decal:null,corrigee:false};
   if(dd.etat==='valider'&&d0.etat==='rien'&&dd.corrigee&&fini(LEVIERS.corrigeVoieMaxMm)&&(!voie||Math.max(...SIDES.map(s=>Math.abs(dd.decal[s][1]-voie[s][0])))>LEVIERS.corrigeVoieMaxMm))dd={etat:'rien',motif:'corrige-hors-voie',decal:null,corrigee:false};
   /* Preuve du nuage sur LES DEUX rails de la paire finale (levier) : au moins `soutienMinDessus` points sur le champignon et `soutienMinFlanc` sur le
    * flanc, pour chaque rail ; sinon rien. */
   if(dd.etat==='valider'&&capture&&(fini(LEVIERS.soutienMinDessus)||fini(LEVIERS.soutienMinFlanc))&&!SIDES.every(s=>{const m=soutienRail(capture,s,dd.decal[s]);
     return (!fini(LEVIERS.soutienMinDessus)||m.dessus>=LEVIERS.soutienMinDessus)&&(!fini(LEVIERS.soutienMinFlanc)||m.flanc>=LEVIERS.soutienMinFlanc);}))dd={etat:'rien',motif:'soutien-faible',decal:null,corrigee:false};
   /* Garde de voie : une pose validée à plus de `vetoVoieMm` en travers de la voie sûre des voisins validés n'est pas posée. */
   if(dd.etat==='valider'&&fini(LEVIERS.vetoVoieMm)&&voie&&dd.motif!=='voie-voisins'&&dd.motif!=='consensus'&&dd.motif!=='branche'){
     const ecartVoie=Math.max(...SIDES.map(s=>Math.abs(dd.decal[s][1]-voie[s][0])));
     if(ecartVoie>LEVIERS.vetoVoieMm)dd={etat:'rien',motif:'veto-voie',decal:null,corrigee:false,ecartVoieMm:arrondi(ecartVoie,1)};
   }
   /* Cap 5b — RECHERCHE RECENTRÉE EN ADV (levier `rechercheADV`, coupé par défaut). Graines : la paire de la test 13, la paire retenue, le voisin
    * validé le plus proche et la voie ajustée (voie absolue), la pose de départ. Paires de cellules FORTES du moteur recentré à `rechEcartMm` de
    * l'écartement de référence ; retenue : la plus proche en travers du voisin validé le plus proche (à `rechProcheMaxCuts` cuts au plus), à
    * `rechVoieMaxMm` au plus en travers (et `rechHauteurMaxMm` en hauteur), unique (aucune autre paire admise à plus de `rechUniqueMm` d'elle),
    * à `rechMaxDeplMm` au plus du départ. Un « rien » devient « valider » ; une validation (`rechRemplace`) prend la paire recentrée si elle s'en
    * écarte de plus de `rechRemplaceMm`, et (`rechSansPaireRien`) n'est pas posée sans paire recentrée. */
   let rech=null;const ddAvant=dd;
   const coherents=LEVIERS.voisinsCoherents?{parCutMm:LEVIERS.voisinsCoherentsParCutMm,baseMm:LEVIERS.voisinsCoherentsBaseMm}:null;
   /* Coût (`rechSauteProcheMm`, coupé par défaut) : une pose déjà validée à cette distance (3D, le plus grand des deux rails) de la pose du voisin validé
    * le plus proche (à `rechSauteProcheCuts` cuts au plus des deux côtés) n'est pas cherchée : la recherche ne l'a jamais modifiée (écart minimal des
    * poses modifiées : 3,7 mm). La décision reste celle d'avant la recherche. Mesure de B en ADV seulement : `rechSauteProcheZones` (par défaut ['adv']) ; en abords, la recherche modifie
    * des poses qui sont exactement celles du voisin (fd7067f7 49 : 13,6 mm → 4,3 mm). */
   const sauteRech=()=>{if(!fini(LEVIERS.rechSauteProcheMm)||dd.etat!=='valider'||!dd.decal||!(LEVIERS.rechSauteProcheZones||['adv']).includes(k.zone))return false;const va=voieAbsolue(capture,k.cut,k.voisinsAbs,LEVIERS.voieAbsFenetre,3,coherents);
     return !!va&&SIDES.every(s=>va[s].distProche<=LEVIERS.rechSauteProcheCuts&&Math.hypot(dd.decal[s][1]-va[s].proche[0],dd.decal[s][2]-va[s].proche[1])<=LEVIERS.rechSauteProcheMm);};
   if((LEVIERS.rechercheADV||(LEVIERS.diag&&LEVIERS.rechercheDiag))&&capture&&ref&&fini(ref.mm)&&(LEVIERS.rechZones||['adv']).includes(k.zone)&&!sauteRech()){
     let va=voieAbsolue(capture,k.cut,k.voisinsAbs,LEVIERS.voieAbsFenetre,3,coherents);
     /* Test 17 (fiches/PASSATION_T17_SANSPOSE.md) — `rechListeResMm` (coupé par défaut) : sans voisin posé à `rechProcheMaxCuts` cuts au plus, en abords (`rechListeZones`), la voie de la liste d'ESV
      * (valides non touchés des deux côtés, résidu d'ajustement de cette valeur au plus) tient lieu de voisin le plus proche : graine de la recherche,
      * référence en travers (`rechListeVoieMm`) et en hauteur. */
     const vl=k.voieListe,parListe=fini(LEVIERS.rechListeResMm)&&!!vl&&!!vl.left&&vl.n.avant>=1&&vl.n.apres>=1&&vl.residuMm<=LEVIERS.rechListeResMm&&(LEVIERS.rechListeZones||['abords']).includes(k.zone)
       &&!(va&&SIDES.every(s=>va[s].distProche<=LEVIERS.rechProcheMaxCuts));
     if(parListe)va=Object.fromEntries(SIDES.map(s=>[s,{v:vl[s],proche:vl[s],distProche:1,n:vl.n,residuMm:vl.residuMm,encadre:null,liste:true}]));
     const lv=a=>a?[a[1],a[2]]:null,gd=LEVIERS.rechGraineDecalMm||0;
     const G={d0:d0.paire?{left:lv(d0.paire.left.decal),right:lv(d0.paire.right.decal)}:null,dd:dd.decal?{left:lv(dd.decal.left),right:lv(dd.decal.right)}:null,
       proche:va?{left:va.left.proche,right:va.right.proche}:null,va:va?{left:va.left.v,right:va.right.v}:null,h0:{left:[0,0],right:[0,0]}};
     /* Ordre des graines (`rechOrdreGraines`) : par défaut la test 13, la pose retenue, le voisin, la voie ajustée, le départ (celui de b-r2 ; une
      * graine à moins de `rechDedupMm` d'une graine déjà cherchée n'est pas relancée, l'ordre fixe donc où le moteur est relancé). `rechGraineDecalMm` :
      * graines déplacées en travers (mesure de sensibilité à la fenêtre du moteur seulement). */
     const gr=(LEVIERS.rechOrdreGraines||['d0','dd','proche','va','h0']).filter(n=>G[n]).map(n=>({nom:n,left:[G[n].left[0]+gd,G[n].left[1]],right:[G[n].right[0]+gd,G[n].right[1]]}));
     const filtreDec={minTop:LEVIERS.rechMinTop,minFace:LEVIERS.rechMinFace,ratioMax:LEVIERS.rechRatioMax};
     const diagLarge=LEVIERS.diag&&LEVIERS.rechercheDiag&&LEVIERS.rechDiagLarge;
     const ratioContra=fini(LEVIERS.rechContraRatioMax)?LEVIERS.rechContraRatioMax:filtreDec.ratioMax;
     const filtreRech=diagLarge?{minTop:Math.min(10,filtreDec.minTop),minFace:Math.min(4,filtreDec.minFace),ratioMax:Math.max(2,filtreDec.ratioMax)}:(ratioContra>filtreDec.ratioMax?{...filtreDec,ratioMax:ratioContra}:filtreDec);
     /* `rechPaireTopMin` (coupé par défaut) : soutien de dessus minimal de la paire retenue (plancher de preuve, indépendant de la hauteur et du rapport :
     * les paires fausses de 649 f228 et 153 2:18 ont un dessus de 29 à 31 points contre 55 au moins pour les justes). `rechContraRatioMax` (coupé) :
     * rapport maximal des cellules qui CONTREDISENT une pose ou arrêtent l'encadrement (détecteur de contradiction découplé du choix de la paire). */
     const garde=p=>p.top>=filtreDec.minTop&&p.face>=filtreDec.minFace&&p.ratio<=filtreDec.ratioMax&&(!fini(LEVIERS.rechPaireTopMin)||p.top>=LEVIERS.rechPaireTopMin);
     /* Hauteur : à `rechHauteurMaxMm` du voisin le plus proche OU de la pose de départ, pour chaque rail. Travers : à `rechVoieMaxMm` au plus, et à
      * `rechVoieParCutMm` par cut d'écart au voisin le plus proche. */
     const hOk=p=>!fini(LEVIERS.rechHauteurMaxMm)||SIDES.every(s=>Math.min(Math.abs(p.decal[s][2]-va[s].proche[1]),Math.abs(p.decal[s][2]))<=LEVIERS.rechHauteurMaxMm);
     const admis=ps=>va?ps.filter(p=>garde(p)&&Math.abs(p.dg)<=LEVIERS.rechEcartMm&&p.depl<=LEVIERS.rechMaxDeplMm&&p.dv!=null&&p.dv<=LEVIERS.rechVoieMaxMm
       &&(!fini(LEVIERS.rechVoieParCutMm)||p.dv<=LEVIERS.rechVoieParCutMm*Math.max(1,va.left.distProche,va.right.distProche))&&(!parListe||p.dv<=LEVIERS.rechListeVoieMm)&&hOk(p)):[];
     const procheOk=!!(va&&va.left.distProche<=LEVIERS.rechProcheMaxCuts&&va.right.distProche<=LEVIERS.rechProcheMaxCuts
       &&(!fini(LEVIERS.rechVoisinsMin)||SIDES.every(s=>va[s].n.avant+va[s].n.apres>=LEVIERS.rechVoisinsMin)));
     const ecart=(a,b)=>Math.max(...SIDES.map(s=>norme(moins(a.decal[s],b.decal[s]))));
     const choisir=ps=>{const adm=admis(ps),best=procheOk?adm[0]||null:null;return {adm,best,ambigu:best?adm.some(p=>p!==best&&ecart(p,best)>LEVIERS.rechUniqueMm):false};};
     /* Arrêt (`rechArret`) : dès qu'une paire sûre et unique existe (et, pour une pose retenue, après la graine de la pose). */
     const assez=LEVIERS.rechArret&&!diagLarge?ps=>{const c=choisir(ps);return !!(c.best&&!c.ambigu);}:null;
     const t0=Date.now();
     rech={...pairesRecentrees(capture,gr,ref.mm,va,Math.max(LEVIERS.rechEcartMm,15),{filtre:filtreRech,dedupMm:LEVIERS.rechDedupMm,assez}),va};rech.ms=Date.now()-t0;
     const {adm,best,ambigu}=choisir(rech.paires);
     rech.choix=best?{dv:arrondi(best.dv,1),dg:best.dg,ambigu,n:adm.length}:{n:adm.length};
     if(LEVIERS.rechercheADV){
       if(dd.etat==='rien'&&best&&!ambigu)dd={etat:'valider',motif:'recherche-adv',decal:best.decal,corrigee:false,avant:dd.motif};
       else if(dd.etat==='valider'){
         /* Pose contredite : sur un rail, la cellule la plus proche trouvée autour de la pose retenue en est à plus de `rechContraMinMm` (et à
          * `rechContraMaxMm` au plus : au-delà, c'est un autre rail) ; la paire recentrée la remplace, sinon (`rechContraRien`) rien. */
         const contra=fini(LEVIERS.rechContraMinMm)&&SIDES.some(s=>{const c=rech.cellules[s].filter(x=>x.graines.includes('dd')&&x.top>=filtreDec.minTop&&x.face>=filtreDec.minFace&&x.ratio<=ratioContra);if(!c.length)return false;
           const m=Math.min(...c.map(x=>Math.hypot(x.mm[1]-dd.decal[s][1],x.mm[2]-dd.decal[s][2])));return m>LEVIERS.rechContraMinMm&&m<=LEVIERS.rechContraMaxMm;});
         if(contra&&best&&!ambigu)dd={etat:'valider',motif:'recherche-adv-contredite',decal:best.decal,corrigee:false,avant:dd.motif};
         else if(contra&&LEVIERS.rechContraRien)dd={etat:'rien',motif:'recherche-adv-contredite-rien',decal:null,corrigee:false,avant:dd.motif};
         else if(LEVIERS.rechRemplace&&best&&!ambigu&&ecart(best,{decal:dd.decal})>LEVIERS.rechRemplaceMm)dd={etat:'valider',motif:'recherche-adv-remplace',decal:best.decal,corrigee:false,avant:dd.motif};
         else if(LEVIERS.rechSansPaireRien&&(!best||ambigu))dd={etat:'rien',motif:'recherche-adv-sans-paire',decal:null,corrigee:false,avant:dd.motif};
       }
       /* Encadrement (`rechEncadre`) : toujours rien, et un voisin validé de chaque côté à `rechEncadreMaxCuts` cuts au plus, qui se suivent
        * (écart entre eux de `rechEncadreSautMm` au plus, par rail) : la paire interpolée, chaque rail ramené sur une cellule forte à 5 mm au plus
        * s'il y en a une (et aucune entre 5 et `rechContraMaxMm`), posée si le nuage soutient les deux rails et si son écartement est à `rechEncadreEcartMm` de la référence. */
       if(dd.etat==='rien'&&LEVIERS.rechEncadre&&va&&SIDES.every(s=>va[s].encadre&&Math.max(...va[s].encadre.cuts)<=LEVIERS.rechEncadreMaxCuts&&va[s].encadre.saut<=LEVIERS.rechEncadreSautMm)){
         const decal={};let contreditE=false;
         for(const s of SIDES){const v=va[s].encadre.v;let b=null;
           for(const x of rech.cellules[s])if(x.top>=filtreDec.minTop&&x.face>=filtreDec.minFace&&x.ratio<=ratioContra){const e=Math.hypot(x.mm[1]-v[0],x.mm[2]-v[1]);if(!b||e<b.e)b={e,x};}
           /* Sans cellule forte à 5 mm, aucune ne doit être à `rechContraMaxMm` ou moins : le nuage contredirait l'interpolation. */
           if(b&&b.e>5&&b.e<=LEVIERS.rechContraMaxMm)contreditE=true;
           decal[s]=b&&b.e<=5?b.x.mm.map(z=>arrondi(z,2)):[0,v[0],v[1]];}
         const sout=!contreditE&&SIDES.every(s=>{const m=soutienRail(capture,s,decal[s]);return m.dessus>=E.REGLAGE.soutienDessus&&m.flanc>=E.REGLAGE.soutienFlanc;});
         if(sout&&Math.abs(ref.mm-ecartementDecal(capture,decal))<=LEVIERS.rechEncadreEcartMm)dd={etat:'valider',motif:'recherche-adv-encadre',decal,corrigee:false,avant:dd.motif};
       }
     }
   }
   /* Cap 6 (A3) — « branche » en DERNIER RECOURS (`brancheDernier`, avec `branche`) : le même calcul que la branche ci-dessus, mais après la
    * recherche recentrée et l'encadrement, et seulement s'il ne reste rien (ni pose contredite par le nuage, ni anomalie d'écartement sans correction).
    * Évite que la branche passe devant une pose de la recherche (9553 et 199 : 15 mm au lieu de 5 mm quand la branche passe en premier). */
   if(dd.etat==='rien'&&LEVIERS.branche&&LEVIERS.brancheDernier&&capture&&k.voieGeo&&(k.voieGeo.mode==='interp'||k.voieGeo.mode==='extrap'&&k.voieGeo.distCuts<=LEVIERS.brancheExtrapCuts)
     &&dd.motif!=='anomalie-non-corrigee'&&dd.motif!=='recherche-adv-contredite-rien'){
     const g=k.voieGeo,decal={};
     for(const s of SIDES){let best=null;for(const h of k.rails[s].hyps){const e=Math.abs(h.decal[1]-g[s][0]);if(e<=LEVIERS.brancheMm&&Math.abs(h.decal[2]-g[s][1])<=LEVIERS.brancheVertMm&&(!best||e<best.e))best={e,h};}if(best)decal[s]=best.h.decal.slice();}
     if(SIDES.every(s=>decal[s])){const ga=ecartementDecal(capture,decal);if(ga>=LEVIERS.brancheEcartement[0]&&ga<=LEVIERS.brancheEcartement[1]&&SIDES.every(s=>{const m=soutienRail(capture,s,decal[s]);return m.dessus>=E.REGLAGE.soutienDessus&&m.flanc>=E.REGLAGE.soutienFlanc;}))dd={etat:'valider',motif:'branche',decal,corrigee:false,avant:dd.motif};}
   }
   /* Garde de voie absolue (leviers `vetoVoieAbsMm` et `voieIncoherenteMm`, coupés par défaut), sur toute pose validée, quel qu'en soit le chemin. Voie : droite
    * ajustée des voisins validés (voie absolue, `rechProcheMaxCuts` cuts au plus sur chaque rail). Pose à plus de `vetoVoieAbsMm` en travers de cette droite
    * (en ADV, la voie de départ d'ESV et celle de l'opérateur sont toutes deux des rails du nuage : seuls les voisins disent laquelle) : rien. Voisins qui ne
    * s'accordent pas (résidu de la droite au-delà de `voieIncoherenteMm`) : la voie ne tranche pas, rien. */
   if(dd.etat==='valider'&&dd.decal&&capture&&(fini(LEVIERS.vetoVoieAbsMm)||fini(LEVIERS.voieIncoherenteMm))){
     const va=voieAbsolue(capture,k.cut,k.voisinsAbs,LEVIERS.voieAbsFenetre,3,coherents);
     if(va&&SIDES.every(s=>va[s].distProche<=LEVIERS.rechProcheMaxCuts)){
       const ecartVoie=Math.max(...SIDES.map(s=>Math.abs(dd.decal[s][1]-va[s].v[0])));
       if(fini(LEVIERS.vetoVoieAbsMm)&&ecartVoie>LEVIERS.vetoVoieAbsMm)dd={etat:'rien',motif:'veto-voie-absolue',decal:null,corrigee:false,avant:dd.motif,ecartVoieMm:arrondi(ecartVoie,1)};
       else if(fini(LEVIERS.voieIncoherenteMm)&&Math.max(...SIDES.map(s=>va[s].residuMm??0))>LEVIERS.voieIncoherenteMm)dd={etat:'rien',motif:'voie-incoherente',decal:null,corrigee:false,avant:dd.motif};
     }
   }
   const diag=LEVIERS.diag?{voie:k.voieTransport&&k.voieTransport.sure?'transport':k.voieRef&&k.voieRef.sure?'ref':k.voieProche?'proche':null,
     voieProcheDist:k.voieProche?k.voieProche.dist:null,voieListe:k.voieListe||null,voieGeo:k.voieGeo||null,voieVal:(voie||k.voieProche)?{left:(voie||k.voieProche).left.slice(0,2),right:(voie||k.voieProche).right.slice(0,2)}:null,
     hyps:Object.fromEntries(SIDES.map(s=>[s,k.rails[s].hyps.map(h=>[arrondi(h.decal[1],1),arrondi(h.decal[2],1)])])),motifsVoie:k.voieTransport?k.voieTransport.motifs:k.voieRef?k.voieRef.motifs:null,
     tous:dd.etat==='rien'&&capture&&ref&&fini(ref.mm)&&(voie||k.voieProche)?(paireConsensus(k,capture,voie||k.voieProche,ref.mm,decal=>SIDES.every(s=>{const m=soutienRail(capture,s,decal[s]);return m.dessus>=E.REGLAGE.soutienDessus&&m.flanc>=E.REGLAGE.soutienFlanc;}))||null):null}:null;
   if(diag&&rech){const lv=a=>[arrondi(a[1],1),arrondi(a[2],1)];
     diag.voieAbs=rech.va;diag.recherche={graines:rech.graines,relances:rech.relances,ms:rech.ms,choix:rech.choix||null,
       avant:{etat:ddAvant.etat,motif:ddAvant.motif??null,decal:ddAvant.decal?{l:lv(ddAvant.decal.left),r:lv(ddAvant.decal.right)}:null},
       cellules:Object.fromEntries(SIDES.map(s=>[s,rech.cellules[s].map(x=>[arrondi(x.mm[1],1),arrondi(x.mm[2],1),x.ratio,x.graines.join('+'),x.top,x.face])])),
       paires:rech.paires.slice(0,LEVIERS.rechDiagLarge?80:6).map(p=>({l:lv(p.decal.left),r:lv(p.decal.right),dg:p.dg,dv:arrondi(p.dv,1),dz:arrondi(p.dz,1),depl:p.depl,
         top:p.top,face:p.face,ratio:p.ratio,g:p.graines.left.join('+')+'|'+p.graines.right.join('+')})),n:rech.paires.length};}
   if(diag&&dd.decal&&capture){diag.soutien=Object.fromEntries(SIDES.map(s=>{const m=soutienRail(capture,s,dd.decal[s]);return [s,{dessus:m.dessus,flanc:m.flanc}];}));
     diag.ecartRefMm=ref&&fini(ref.mm)?arrondi(ref.mm-ecartementDecal(capture,dd.decal),1):null;
     if(voie)diag.dvMm=arrondi(Math.max(...SIDES.map(s=>Math.abs(dd.decal[s][1]-voie[s][0]))),1);}
   const correction=c?{ref:ref.mm,ecartMm:c.ecartMm,anomalie:c.anomalie,rail:c.rail,soutenue:c.soutenue,appliquee:dd.corrigee}:{ref:ref&&fini(ref.mm)?ref.mm:null,appliquee:false};
   const base0=d0.paire||{left:{origines:['H6'],sousOrigines:[],hauteur:false},right:{origines:['H6'],sousOrigines:[],hauteur:false}};
   const paire=dd.decal?Object.fromEntries(SIDES.map(s=>[s,{...base0[s],decal:dd.decal[s]}])):null;
   const ecart3d=paire?Math.max(norme(paire.left.decal),norme(paire.right.decal)):d0.ecartDepartMm;
   return {...d0,variante:'L1-e',etat:dd.etat,motif:dd.motif,paire,ecartDepartMm:paire?arrondi(ecart3d,1):d0.ecartDepartMm,correction,...(diag?{diag}:{}),test13:{etat:d0.etat,motif:d0.motif??null,paire:d0.paire?{left:d0.paire.left.decal,right:d0.paire.right.decal}:null}};
 }
 /* Cap 5, levier « sélection à la référence » : la règle L1 (τ, δ, 150 mm), mais la meilleure paire est cherchée parmi les paires dont l'écartement
  * EXACT est à `selectionRefMm` de la référence de la liste d'ESV (au lieu de la médiane du lot ± 15 mm ou du contrat 1 420–1 470 mm). */
 function deciderL1Ref(k,mod,ref,capture,probasDonnees=null){
   const p={};
   for(const s of SIDES)p[s]=probasDonnees?Float64Array.from(probasDonnees[s]):Float64Array.from(k.rails[s].hyps.map(h=>probas(mod,h.x).p10));
   if(SIDES.some(s=>k.i0[s]<0))return {etat:'rien',motif:'sans-pose-de-depart',p:null,paire:null,ecartDepartMm:null,zone:k.zone,probas:p};
   const Lh=k.rails.left.hyps,Rh=k.rails.right.hyps,i0=k.i0.left,j0=k.i0.right,z=mod.seuils[k.zone]||mod.seuils.hors||{actif:false};
   let best={i:i0,j:j0,v:p.left[i0]*p.right[j0],ecart:0,h0:true},n=0;
   for(let i=0;i<Lh.length;i++)for(let j=0;j<Rh.length;j++){
     if(i===i0&&j===j0)continue;
     const v=p.left[i]*p.right[j];if(!(v>best.v))continue;
     const g=ecartementDecal(capture,{left:Lh[i].decal,right:Rh[j].decal});
     if(!(Math.abs(g-ref)<=LEVIERS.selectionRefMm))continue;
     n++;best={i,j,v,ecart:Math.max(Math.abs(Lh[i].decal[1]),Math.abs(Lh[i].decal[2]),Math.abs(Rh[j].decal[1]),Math.abs(Rh[j].decal[2])),h0:false};
   }
   const hl=Lh[best.i],hr=Rh[best.j],ecart3d=Math.max(norme(hl.decal),norme(hr.decal));
   const paire={left:{decal:hl.decal,origines:hl.origines,sousOrigines:hl.sousOrigines,hauteur:hl.hauteur},right:{decal:hr.decal,origines:hr.origines,sousOrigines:hr.sousOrigines,hauteur:hr.hauteur}};
   const out={zone:k.zone,tau:z.tau??null,delta:z.delta??null,p:arrondi(best.v,4),ecartDepartMm:arrondi(ecart3d,1),ecartMaxLatVertMm:arrondi(best.ecart,1),paire,i:best.i,j:best.j,permises:n,
     hypothese:[...new Set([...hl.origines,...hr.origines])].sort().join('+'),probas:p,selection:'reference'};
   if(best.h0)return {...out,etat:'rien',motif:'depart-le-plus-probable',paire:null};
   if(!z.actif)return {...out,etat:'rien',motif:'zone-inactive'};
   if(best.ecart<z.delta)return {...out,etat:'rien',motif:'sous-delta'};
   if(best.v>=z.tau)return {...out,etat:'valider',motif:null};
   if(ecart3d>REGLE.sansValiderMaxMm)return {...out,etat:'rien',motif:'plus-de-150-mm'};
   return {...out,etat:'poser-sans-valider',motif:'sous-tau'};
 }
 /* Cap 5, piste 2 — VOIE DE LA LISTE D'ESV : les rails des coupes valides et non touchées voisines (instantané de la partie), ramenés dans le
  * repère profil de la pose de départ du cut par la translation monde − scène mesurée sur la ligne du cut lui-même (sa pose de départ ; les deux
  * rails doivent donner la même translation à `rigideMaxMm` près), puis ajustés en travers et en hauteur selon la position le long de la voie
  * (droite des moindres carrés) ; la voie au cut est la valeur ajustée en 0. Indépendante des poses de la GCV2 : elle amorce le transport.
  * Sûre s'il y a des voisins des deux côtés et un résidu d'ajustement d'au plus `residuMaxMm`. Rend { left:[lat,vert], right, n, residuMm, sure } ou null. */
 const VOIE_LISTE=Object.freeze({fenetre:8,parCote:3,residuMaxMm:4,rigideMaxMm:2});
 function voieDeListe(table,cut,capture,cfg=VOIE_LISTE){
   if(!table||!capture||!capture.rails||!Number.isInteger(cut)||cut<0||cut>=table.n)return null;
   const row=i=>{const e=table.ed.slice(6*i,6*i+6);return e.length===6&&e.every(fini)?{left:e.slice(0,3).map(v=>v/1e4),right:e.slice(3).map(v=>v/1e4)}:null;};
   const r0=row(cut);if(!r0||!SIDES.every(s=>capture.rails[s]&&vec3(capture.rails[s].positionSceneRelative)))return null;
   const T=Object.fromEntries(SIDES.map(s=>[s,[0,1,2].map(i=>r0[s][i]-capture.rails[s].positionSceneRelative[i])]));
   const rigideMm=1000*Math.hypot(...[0,1,2].map(i=>T.left[i]-T.right[i]));
   if(!(rigideMm<=cfg.rigideMaxMm))return {sure:false,rigideMm:arrondi(rigideMm,1),motif:'repere'};
   const Tm=[0,1,2].map(i=>(T.left[i]+T.right[i])/2),pts={left:[],right:[]};let avant=0,apres=0;
   for(const sens of [-1,1]){let k=0;
     for(let j=cut+sens;Math.abs(j-cut)<=cfg.fenetre&&j>=0&&j<table.n&&k<cfg.parCote;j+=sens){
       if(table.st[j]!==0||table.fl[j]!==0)continue;const r=row(j);if(!r)continue;
       const d=Object.fromEntries(SIDES.map(s=>[s,decalage(capture.rails[s],r[s].map((v,i)=>v-Tm[i]))]));if(!SIDES.every(s=>d[s]))continue;
       for(const s of SIDES)pts[s].push({d:d[s],sens,j});k++;if(sens<0)avant++;else apres++;}}
   if(avant+apres<2)return {sure:false,n:{avant,apres},rigideMm:arrondi(rigideMm,1),motif:'voisins'};
   /* Interpolation entre la plus proche coupe valide de chaque côté (le long de la voie), en plus de l'ajustement. */
   const proche=(s,sens)=>pts[s].filter(q=>q.sens===sens).sort((a,b)=>Math.abs(a.j-cut)-Math.abs(b.j-cut))[0]||null;
   let interp=null,ecartCuts=null;
   if(avant&&apres){interp={};for(const s of SIDES){const a=proche(s,-1).d,b=proche(s,1).d,t=Math.abs(b[0]-a[0])>1e-6?(0-a[0])/(b[0]-a[0]):0.5;
     interp[s]=[arrondi(a[1]+t*(b[1]-a[1]),2),arrondi(a[2]+t*(b[2]-a[2]),2)];}ecartCuts=proche('left',1).j-proche('left',-1).j;}
   for(const s of SIDES)pts[s]=pts[s].map(q=>q.d);
   const ajuster=(P,c)=>{const n=P.length,mx=P.reduce((a,q)=>a+q[0],0)/n,my=P.reduce((a,q)=>a+q[c],0)/n,sxx=P.reduce((a,q)=>a+(q[0]-mx)**2,0);
     const b=sxx>1e-6?P.reduce((a,q)=>a+(q[0]-mx)*(q[c]-my),0)/sxx:0,a=my-b*mx;return {v:a,res:Math.max(...P.map(q=>Math.abs(q[c]-(a+b*q[0]))))};};
   const out={n:{avant,apres},rigideMm:arrondi(rigideMm,1)};let res=0;
   for(const s of SIDES){const fl=ajuster(pts[s],1),fv=ajuster(pts[s],2);out[s]=[arrondi(fl.v,2),arrondi(fv.v,2)];res=Math.max(res,fl.res);}
   out.interp=interp;out.ecartCuts=ecartCuts;
   out.residuMm=arrondi(res,1);out.sure=avant>=1&&apres>=1&&res<=cfg.residuMaxMm;return out;
 }
 /* Cap 5, levier « branche » — VOIE GÉOMÉTRIQUE RAIL PAR RAIL : les rails posés du lot (chaîne : voisins ; L1 : transport), en positions de
  * scène, ramenés dans le repère profil de la pose de départ du cut ; pour chaque rail, la position en travers au cut est interpolée entre le
  * plus proche posé avant et le plus proche après (le long de la voie), sinon prolongée des deux plus proches d'un même côté. Elle ne transporte
  * pas une correction : elle suit la géométrie de chaque branche (bifurcation d'ADV : une branche par rail).
  * Rend { left:[lat,vert], right, mode:'interp'|'extrap', distCuts } ou null. */
 function voieGeometrique(capture,poses,cut,maxCuts=6){
   if(!capture||!capture.rails)return null;const pts=[];
   for(const v of poses||[]){if(!v||!v.identity||!v.positions||v.identity.cut===cut||Math.abs(v.identity.cut-cut)>maxCuts)continue;
     const d=Object.fromEntries(SIDES.map(s=>[s,decalage(capture.rails[s],v.positions[s])]));if(SIDES.every(s=>d[s]))pts.push({cut:v.identity.cut,d});}
   if(!pts.length)return null;
   const av=pts.filter(q=>q.cut<cut).sort((a,b)=>b.cut-a.cut),ap=pts.filter(q=>q.cut>cut).sort((a,b)=>a.cut-b.cut);
   const lin=(a,b,s,i)=>{const da=b.d[s][0]-a.d[s][0];return Math.abs(da)>1e-6?a.d[s][i]+(0-a.d[s][0])*(b.d[s][i]-a.d[s][i])/da:(a.d[s][i]+b.d[s][i])/2;};
   let a,b,mode;
   if(av.length&&ap.length){a=av[0];b=ap[0];mode='interp';}
   else{const c=av.length?av:ap;if(c.length<2)return {mode:'un-seul',distCuts:Math.abs(c[0].cut-cut)};a=c[0];b=c[1];mode='extrap';}
   const out={mode,distCuts:Math.max(Math.abs(a.cut-cut),mode==='interp'?Math.abs(b.cut-cut):0)};
   for(const s of SIDES)out[s]=[arrondi(lin(a,b,s,1),2),arrondi(lin(a,b,s,2),2)];
   return out;
 }
 /* Pose de la chaîne refaite par L1-s (vue élargie ou options de L1) sous L1-se : la même correction d'écartement, sur ses décalages.
  * Rend { decal, correction } (decal : corrigé, ou celui de la chaîne). */
 function corrigerPoseChaine(capture,decal,ref){
   if(!ref||!fini(ref.mm))return {decal,correction:{ref:null,appliquee:false}};
   const c=corrigerDecal({capture,decal,ref:ref.mm,ordre:ordreRails(capture,decal)});
   return {decal:c.anomalie&&c.soutenue?c.decal:decal,correction:{ref:ref.mm,ecartMm:c.ecartMm,anomalie:c.anomalie,rail:c.rail,soutenue:c.soutenue,appliquee:!!(c.anomalie&&c.soutenue)}};
 }
 /* Écart en travers (mm, le pire des deux rails) de la pose `decal` d'un cut à la voie absolue de ses voisins validés (`voieAbsolue`, mêmes réglages que la décision) :
 * au voisin le plus proche et à la droite ajustée. Rend { proche, droite } ou null (aucun voisin, ou le plus proche à plus de `rechProcheMaxCuts`). */
function ecartAVoie(capture,cut,voisins,decal){
  const va=voieAbsolue(capture,cut,voisins,LEVIERS.voieAbsFenetre,3,LEVIERS.voisinsCoherents?{parCutMm:LEVIERS.voisinsCoherentsParCutMm,baseMm:LEVIERS.voisinsCoherentsBaseMm}:null);
  if(!va||!SIDES.every(s=>va[s].distProche<=LEVIERS.rechProcheMaxCuts))return null;
  const pire=f=>Math.max(...SIDES.map(s=>Math.abs(decal[s][1]-f(va[s]))));
  return {proche:pire(v=>v.proche[0]),droite:pire(v=>v.v[0])};
}
/* Contre-expertise d'une pose de la chaîne (leviers `contreChaineZones`, `contreChaineVoieMm` et `contreChaineMm`, coupés) : `g` est la décision de la GCV2 (`deciderDiffere`) sur le même
 * cut, avec l'état d'avant lui. Vrai si elle VALIDE une paire dont un rail est à plus de `seuilMm` (3D) de la pose de la chaîne : la chaîne n'est pas posée, le cut
 * passe à la GCV2 comme un différé. `seuilMm` non réglé : jamais (la GCV2 ne fait que consigner sa décision). */
function contreChaine(g,decalChaine,seuilMm){
  const d=g&&g.decision;
  return fini(seuilMm)&&!!d&&d.etat==='valider'&&!!d.paire&&SIDES.some(s=>norme(moins(d.paire[s].decal,decalChaine[s]))>seuilMm);
}
/* Positions (repère scène) d'une paire, depuis ses décalages [long, lat, vert] (mm) dans le repère profil de la pose de départ. */
 function positionsDe(capture,paire){return Object.fromEntries(SIDES.map(s=>[s,L.positionOf(capture.rails[s],paire[s].decal.map(v=>v/1000))]));}

 /* ------------------------------------------------------------------ un différé, de bout en bout */
 /* Entrées (tout ce que le lot connaît à l'instant de sa décision, rien de plus) :
  *   capture : { identity, rails, pointsSceneRelative, visibleByClipBoxes } ; science : moteur AVEC réservoir sur cette capture ;
  *   appuis : appuis de la chaîne du lot (avant ce cut) ; options : options de la décision du lot (profil) ;
  *   voisins : cuts validés par le lot avant ce cut, { identity, positions, rails (pose de départ de ce voisin) } ; zone : 'pn' | 'adv' | 'abords' ;
  *   plagesADV : plages ADV connues à l'instant ; modele : `modeleFige(...)` ; regle : REGLE ou REGLE_V.
  * Rend { decision (deciderL1), positions (scène) ou null, hyp (résumé), cas } ; lève une erreur seulement sur entrée illisible. */
 function deciderDiffere({capture,science,appuis=[],options=REGLE.lotOptions,voisins=[],zone='abords',plagesADV=[],modele,regle=REGLE,reference=null,voisinsTransport=null,voieListe=null}){
   if(!modele)throw Error('GCV2 L1 : modèle absent.');
   if(!SIDES.every(s=>science&&science.rails&&science.rails[s]))throw Error('GCV2 L1 : science incomplète.');
   const id=capture.identity,seul=variante(capture,science,[],options),chaine=variante(capture,science,appuis.slice(),options);
   const vs=voisins.filter(v=>v&&v.identity&&v.positions&&v.rails).map(v=>({identity:{part:v.identity.part,cut:v.identity.cut,frameId:v.identity.frameId??null},
     positions:{left:v.positions.left.slice(),right:v.positions.right.slice()},stage:'verifie',source:'lot',decalage:decalageDepuisDepart(v.rails,v.positions)}));
   const gs=vs.map(v=>gaugeMm(v.positions.left,v.positions.right)).filter(x=>fini(x)&&Math.abs(x-1500)>0.05),gMed=med(gs);
   const hyp=hypothesesDuCut({capture,science,seul,chaine,appuisAvant:appuis.slice(),voisins:vs,gMed,voisinsLot:vs,departEsv:null});
   const ancres=(hyp.voieH6&&hyp.voieH6.lot&&hyp.voieH6.lot.ancres||[]).map(a=>a.cut),bornes=[id.cut,...ancres],zmap=new Map();
   for(let x=Math.min(...bornes);x<=Math.max(...bornes);x++)zmap.set(x,{zone:(plagesADV||[]).some(([a,b])=>x>=a&&x<=b)?'adv':'autre'});
   const voieRef=hyp.voieH6?avecRupture(hyp.voieH6.lot,id.cut,zmap):null;
   const k=casDuDiffere({cut:id.cut,zone,hyp,gMed,voieRef});
   if(voieListe)k.voieListe=voieListe;
   k.voieGeo=voieGeometrique(capture,voisins.concat(Array.isArray(voisinsTransport)?voisinsTransport:[]),id.cut,LEVIERS.brancheMaxCuts);
   /* Cap 5b : voisins validés en positions de scène (chaîne et, s'il y en a, poses de la GCV2), pour la voie absolue. */
   k.voisinsAbs=vs.concat(Array.isArray(voisinsTransport)?voisinsTransport.filter(v=>v&&v.identity&&v.positions):[]);
   /* Cap 5 : voie de référence des voisins validés, poses de la GCV2 comprises (`voisinsTransport`) ; sert seulement à la voie des voisins et à la
    * garde de voie de L1-e, jamais aux hypothèses ni aux probabilités. */
   if(Array.isArray(voisinsTransport)&&voisinsTransport.length){
     const vt=vs.concat(voisinsTransport.filter(v=>v&&v.identity&&v.positions&&v.rails).map(v=>({identity:{part:v.identity.part,cut:v.identity.cut,frameId:v.identity.frameId??null},
       positions:{left:v.positions.left.slice(),right:v.positions.right.slice()},stage:'verifie',source:'lot',decalage:decalageDepuisDepart(v.rails,v.positions)})));
     const r=decalagesH6(id,vt);
     if(r&&r.reference)k.voieTransport={left:r.reference.left.map(x=>arrondi(x,2)),right:r.reference.right.map(x=>arrondi(x,2)),n:r.reference.n,distMin:r.reference.distMin,motifs:r.reference.motifs,sure:!r.reference.motifs.length};
     if(r&&r.proche)k.voieProche={left:r.proche.left.map(x=>arrondi(x,2)),right:r.proche.right.map(x=>arrondi(x,2)),dist:r.proche.dist};
   }
   /* Levier `voieProcheSureCuts` : sans poses L1 à transporter, le voisin le plus proche est lu dans la chaîne seule. */
   if(!k.voieProche&&fini(LEVIERS.voieProcheSureCuts)&&vs.length){const r=decalagesH6(id,vs);if(r&&r.proche)k.voieProche={left:r.proche.left.map(x=>arrondi(x,2)),right:r.proche.right.map(x=>arrondi(x,2)),dist:r.proche.dist};}
   const d=regle.variante==='L1-e'?deciderL1e(k,modele,reference,capture):deciderL1(k,modele,regle);
   const positions=d.paire&&d.etat!=='rien'?positionsDe(capture,d.paire):null;
   return {decision:d,positions,gMed,cas:k,hyp,chaine:{stage:chaine.decision.stage,reason:chaine.decision.reason??null,anchorsUsed:chaine.decision.anchorsUsed||[]}};
 }
 /* Commande d'une pose de la GCV2, comme la branche « lot » de `commandRails` (src/lot-decision.js) : rails en décalages du repère profil de la
  * pose ESV courante, relus par `expectedPoses` (même position à 0,01 mm), écartement admissible, cible dans la vue de chaque rail. Une cible
  * hors de la vue n'est pas refusée : `vue:'deplacer'` dit qu'il faut d'abord amener la vue (L1 : « déplacer la vue puis poser »), à condition
  * que la vue élargie (`camerasLarges`) la contienne ; sinon refus. Rend { action:'lot', reason, rails, gaugeMm, vue } ou { action:'refus', reason }. */
 const MATCH_SCENE=1e-5;
 function commander({positions,runtimeRails,before,expectedPoses,cameras,camerasLarges=null,valider=true}){
   if(!positions||!before||typeof expectedPoses!=='function'||!SIDES.every(s=>before[s]&&runtimeRails&&runtimeRails[s]))return {action:'refus',reason:'entree-incomplete'};
   const rails={};
   for(const side of SIDES){
     const init=before[side],M=init.sceneRelativeToProfileLocal,q=C.point(M,positions[side]),o=C.point(M,init.positionSceneRelative);
     rails[side]={...runtimeRails[side],status:'candidate',delta:[q[0]-o[0],q[1]-o[1],q[2]-o[2]],confidence:0,
       reasons:['décision sur le lot : GCV2 (L1), '+(valider?'pose validée':'pose sans validation')],source:'gcv2-l1',lotDecision:{stage:'gcv2-l1',version:VERSION}};
   }
   let expected;try{expected=expectedPoses({rails:before},rails);}catch{return {action:'refus',reason:'expected-poses-failed'};}
   if(SIDES.some(side=>C.distance(expected[side].positionSceneRelative,positions[side])>MATCH_SCENE))return {action:'refus',reason:'position-mismatch'};
   const gaugeMm=Gauge.gaugeMmOf(expected,C),gaugeClass=Gauge.classifyMm(gaugeMm);
   if(!Gauge.admissible(gaugeClass))return {action:'refus',reason:'gauge-'+gaugeClass,gaugeMm:arrondi(gaugeMm,1)};
   let vue='dans';
   for(const side of SIDES){const cam=cameras&&cameras[side];
     if(cam&&L.inView(cam,positions[side]).inView)continue;
     const large=camerasLarges&&camerasLarges[side];
     if(!large||!L.inView(large,positions[side]).inView)return {action:'refus',reason:(cam?'hors-vue-':'vue-inconnue-')+side};
     vue='deplacer';}
   return {action:'lot',reason:valider?'gcv2-l1':'gcv2-l1-sans-valider',rails,gaugeMm:arrondi(gaugeMm,1),vue};
 }
 /* Journal d'une décision L1 (sans coordonnée : des millimètres dans le repère profil de la pose de départ, des probabilités, des motifs). */
 function resumer(r){
   const d=r.decision;
   return {version:VERSION,etat:d.etat,motif:d.motif??null,zone:d.zone,tau:d.tau,delta:d.delta,p:d.p,hypothese:d.hypothese??null,
     ecartDepartMm:d.ecartDepartMm,ecartMaxLatVertMm:d.ecartMaxLatVertMm??null,paires:d.permises??null,
     paire:d.paire?{left:d.paire.left.decal,right:d.paire.right.decal}:null,aControler:d.aControler===true||undefined,
     gMedMm:arrondi(r.gMed,1),chaine:r.chaine?{stage:r.chaine.stage,reason:r.chaine.reason!=null?String(r.chaine.reason).slice(0,80):null,appuis:r.chaine.anchorsUsed.length}:null,
     nHyp:r.hyp?r.hyp.cut.nHyp:null,...(d.variante==='L1-e'?{variante:'L1-e',correction:d.correction,test13:d.test13,...(d.diag?{diag:d.diag}:{})}:{})};
 }
 return {VERSION,REGLE,REGLE_V,REGLE_E,H6,NUM,CAT,MULTI,FORMAT_PARAMS,decalage,variante,decalageDepuisDepart,decalagesH6,hypothesesDuCut,avecRupture,transfo,accords,brut,coder,soutienRail,
   modeleFige,probas,casDuDiffere,ecartementPaire,meilleurePaire,deciderL1,deciderL1e,positionsDe,ecartementDecal,ramenerRail,corrigerDecal,ordreRails,corrigerPoseChaine,ecartAVoie,contreChaine,voieDeListe,VOIE_LISTE,voieGeometrique,reglerLeviers,LEVIERS_LIVRES,LEVIERS_V4,LEVIERS_V5,LEVIERS_V6,deciderDiffere,commander,resumer,
   voieAbsolue,rechercheRecentree,pairesRecentrees,leviersActifs:()=>LEVIERS};
});

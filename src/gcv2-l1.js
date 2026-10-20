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
 /* Décision L1-e d'un cas (`casDuDiffere`) : la décision de la test 13 (`deciderL1`, mêmes probabilités), puis la correction d'écartement de
  * `src/gcv2-l1e.js` contre la référence `ref` ({ mm } : lignes valides non touchées de la liste d'ESV, ou null), soutien du nuage lu sur la
  * capture. Même forme que `deciderL1` ; `etat` : 'valider' ou 'rien' (jamais de pose sans validation) ; `test13` : la décision d'origine. */
 function deciderL1e(k,mod,ref,capture,probasDonnees=null){
   if(!E)throw Error('GCV2 L1-e : module absent.');
   const d0=deciderL1(k,mod,REGLE,probasDonnees),p=d0.probas;
   let c=null;
   if(d0.paire&&Number.isInteger(d0.i)&&Number.isInteger(d0.j)&&ref&&fini(ref.mm)){
     const hl=k.rails.left.hyps[d0.i],hr=k.rails.right.hyps[d0.j];
     const hyps=Object.fromEntries(SIDES.map(s=>[s,k.rails[s].hyps.map((h,i)=>({decal:h.decal,g:h.g,depart:i===k.i0[s]}))]));
     c=E.corriger({paire:{left:{decal:hl.decal,p:p.left[d0.i]},right:{decal:hr.decal,p:p.right[d0.j]}},g:ecartementPaire(k,hl,hr),hyps,ref:ref.mm,
       soutien:(s,mm)=>soutienRail(capture,s,mm)});
   }
   const dd=E.decider(d0,c);
   const correction=c?{ref:ref.mm,ecartMm:c.ecartMm,anomalie:c.anomalie,rail:c.rail,soutenue:c.soutenue,appliquee:dd.corrigee}:{ref:ref&&fini(ref.mm)?ref.mm:null,appliquee:false};
   const paire=dd.decal?Object.fromEntries(SIDES.map(s=>[s,{...d0.paire[s],decal:dd.decal[s]}])):null;
   const ecart3d=paire?Math.max(norme(paire.left.decal),norme(paire.right.decal)):d0.ecartDepartMm;
   return {...d0,variante:'L1-e',etat:dd.etat,motif:dd.motif,paire,ecartDepartMm:paire?arrondi(ecart3d,1):d0.ecartDepartMm,correction,test13:{etat:d0.etat,motif:d0.motif??null}};
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
 function deciderDiffere({capture,science,appuis=[],options=REGLE.lotOptions,voisins=[],zone='abords',plagesADV=[],modele,regle=REGLE,reference=null}){
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
     nHyp:r.hyp?r.hyp.cut.nHyp:null,...(d.variante==='L1-e'?{variante:'L1-e',correction:d.correction,test13:d.test13}:{})};
 }
 return {VERSION,REGLE,REGLE_V,REGLE_E,H6,NUM,CAT,MULTI,FORMAT_PARAMS,decalage,variante,decalageDepuisDepart,decalagesH6,hypothesesDuCut,avecRupture,transfo,accords,brut,coder,soutienRail,
   modeleFige,probas,casDuDiffere,ecartementPaire,meilleurePaire,deciderL1,deciderL1e,positionsDe,deciderDiffere,commander,resumer};
});

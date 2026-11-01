(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory(require('../vendor/capture-core.js'),require('./lot-decision.js'),require('./continuity-observer.js'),require('./gcv1-shadow.js'),require('./gauge.js'));
  else root.BananeRechercheLarge=factory(root.BananeCaptureCore,root.BananeLotDecision,root.BananeContinuityObserver,root.BananeGCV1Shadow,root.BananeGauge4);
})(typeof globalThis!=='undefined'?globalThis:this,function(C,L,O,Sh,Gauge){
 'use strict';
 /* CH-034 — RECHERCHE LARGE (chantiers/CH-034/JOURNAL.md § 2). Module PUR : ni DOM, ni ESV, ni stockage, ni réglage global ; il CALCULE.
  *
  * Constat (partie 20 du 28/10, 21 poses à plus de 50 mm, toutes en travers de 107 à 391 mm) : le rail validé par l'opérateur est dans le
  * nuage capturé (42 rails sur 42 : la ROI de capture va à ±400 mm en travers), le moteur gelé relancé autour de lui y trouve une cellule
  * forte (39 sur 42), mais le lot ne la voit jamais : la recherche du moteur est bornée à ±80 mm de la pose de départ d'ESV (D-265), les
  * points lus à ±180 mm. Dans les appareils de voie, deux rails réels se tiennent à 100 à 400 mm, et le moteur ne voit que le plus proche
  * du départ. Le gabarit U50 est mieux ajusté au vrai rail qu'au faux pour 31 rails sur 39 (rapport de perte médian 0,46).
  *
  * Ce que fait ce module, sur le seul nuage du cut (ce que le lot sait au moment de poser, rien de l'Écho, rien des voisins) :
  *   1. le moteur gelé (`gcv1-shadow`, `scientificProposeBothAvecReservoir`, aucun seuil changé) est relancé sur les rails de départ
  *      TRANSLATÉS en travers à chaque graine (0, ±pas, ±2 pas, … jusqu'à ±portée) : sa fenêtre de ±80 mm balaie ainsi ±portée ;
  *   2. union des cellules FORTES de toutes les relances (`qualifyStrong` du moteur : dessus ≥ 15, flanc ≥ 6, rapport de perte dans la
  *      compétition ; fenêtre tenue, pente dans le domaine), dédoublonnées à 3 mm, en décalages (mm) depuis la vraie pose de départ ;
  *   3. paires (gauche, droite) admissibles au contrat d'écartement du moteur (`gauge.js`), classées par produit des pertes ;
  *   4. une décision sur la pose que le lot s'apprête à commander (`positions`, repère scène) :
  *      - mode `differer` (livré quand le réglage est allumé) : la pose du lot n'est aucune paire forte (`pose-sans-paire-forte`), ou une
  *        paire au moins aussi bonne (produit ≤ `rapport` × le sien) est à plus de `loinMm` d'elle (`concurrence`) → `differer` ;
  *        sinon `garde`. C'est le rapport de perte 1,5 du moteur (« plusieurs placements concurrents ») étendu à toute la ROI ;
  *      - mode `choisir` : la meilleure paire large est à plus de `loinMm` de la pose du lot ; si la seconde paire loin d'elle a un
  *        produit ≥ `rapport` × le sien, elle REMPLACE la pose (`remplacer`, positions de scène rendues), sinon `differer` (`ambigu`) ;
  *        la meilleure paire à `loinMm` au plus de la pose : `garde`.
  * Ce module ne commande rien ; le service worker (`background.js`, `rechercheLargeCommande`) traduit `differer` en deux abstentions et
  * `remplacer` en commande du lot (cible dans la vue, écartement admissible, position relue), ou garde la commande. Une panne ici rend
  * `garde` : la commande du lot ne change jamais par erreur. Réglage `lot.rechercheLarge` (src/settings.js), livré ÉTEINT.
  * Mesuré hors ligne (réglage : partie 20, cuts < 8 000, 150 jugés) : mode `differer` 13 fautes sur 13 différées, 0 fine ni acceptation
  * différée, 1 moyenne, 1 acceptation ; mode `choisir` 12 fautes sur 13 remplacées à 20 mm au plus de la vérité, 0 fine ni acceptation
  * déplacée. Examen : JOURNAL § 2.5. Coût : 2 × (1 + 2 × portée/pas) relances du moteur par cut posé (14 avec les valeurs livrées). */
 const VERSION='recherche-large-1';
 const SIDES=['left','right'];
 const DEFAUT=Object.freeze({actif:false,mode:'differer',porteeMm:400,pasMm:120,loinMm:50,rapport:1.5,presMm:15,cellulesMax:12,zones:null,passe:true});
 const MODES=['differer','choisir'];
 const fini=v=>typeof v==='number'&&Number.isFinite(v);
 const r1=v=>fini(v)?Math.round(v*10)/10:null,sig4=v=>fini(v)?Number(v.toPrecision(4)):null;
 const objet=v=>!!v&&typeof v==='object'&&!Array.isArray(v);
 const T=Sh&&Sh.reservoirOutils;

 /* Lecture du réglage `lot.rechercheLarge` : ABSENT = la valeur livrée (éteinte) ; `false` = coupé ; un objet : clé par clé, une clé absente
  * vaut la valeur livrée ; toute autre valeur ou une clé illisible : { ok:false, actif:false } (ce levier CHANGE la pose : un réglage
  * illisible ne l'allume jamais). */
 function reglage(valeur,defaut=DEFAUT){
  const d=objet(defaut)?{...DEFAUT,...defaut}:{...DEFAUT};
  const illisible=raison=>({ok:false,raison,...d,actif:false});
  if(valeur===undefined)valeur={};
  else if(valeur===false)return {ok:true,...d,actif:false};
  if(!objet(valeur))return illisible('rechercheLarge illisible');
  const r={...d,...valeur};
  if(typeof r.actif!=='boolean')return illisible('rechercheLarge.actif illisible');
  if(!MODES.includes(r.mode))return illisible('rechercheLarge.mode illisible');
  for(const k of ['porteeMm','pasMm','loinMm','presMm'])if(!(fini(r[k])&&r[k]>0))return illisible('rechercheLarge.'+k+' illisible');
  if(!(fini(r.rapport)&&r.rapport>=1))return illisible('rechercheLarge.rapport illisible');
  if(!(Number.isInteger(r.cellulesMax)&&r.cellulesMax>=2))return illisible('rechercheLarge.cellulesMax illisible');
  if(r.zones!==null&&!(Array.isArray(r.zones)&&r.zones.every(z=>typeof z==='string')))return illisible('rechercheLarge.zones illisible');
  if(typeof r.passe!=='boolean')return illisible('rechercheLarge.passe illisible');
  return {ok:true,actif:r.actif,mode:r.mode,porteeMm:r.porteeMm,pasMm:r.pasMm,loinMm:r.loinMm,rapport:r.rapport,presMm:r.presMm,cellulesMax:r.cellulesMax,zones:r.zones?r.zones.slice():null,passe:r.passe};
 }
 /* Graines en travers (mm) : 0, puis ±pas, ±2 pas… jusqu'à ±portée. */
 function graines(R){const g=[0];for(let x=R.pasMm;x<=R.porteeMm+1e-9;x+=R.pasMm){g.push(x);g.push(-x);}return g;}
 /* Décalage [long, lat, vert] (mm) d'une position de scène depuis la pose de départ d'un rail, repère profil de ce rail. */
 function decalage(rail,p){
  const M=rail&&rail.sceneRelativeToProfileLocal,o=rail&&rail.positionSceneRelative;
  if(!Array.isArray(M)||M.length!==16||!Array.isArray(o)||!Array.isArray(p))return null;
  const a=C.point(M,p),b=C.point(M,o);return [0,1,2].map(i=>1000*(a[i]-b[i]));
 }
 const capturePrete=cap=>!!(cap&&cap.rails&&Array.isArray(cap.pointsSceneRelative)&&cap.pointsSceneRelative.length&&SIDES.every(s=>cap.rails[s]&&Array.isArray(cap.rails[s].positionSceneRelative)&&Array.isArray(cap.rails[s].sceneRelativeToProfileLocal)));
 /* Une relance : les deux rails de départ translatés en travers de `lat` mm, le moteur gelé relancé, ses cellules FORTES en décalages depuis
  * la vraie pose de départ. */
 function relance(capture,lat){
  const rails={...capture.rails};
  for(const s of SIDES){const rail=capture.rails[s],pos=L.positionOf(rail,[0,lat/1000,0]);rails[s]=O.translated(rail,pos.map((v,i)=>v-rail.positionSceneRelative[i]));}
  let sci;try{sci=Sh.scientificProposeBothAvecReservoir({...capture,rails});}catch{return null;}
  const out={};
  for(const s of SIDES){
   const r=sci&&sci.rails&&sci.rails[s];if(!r||!r.ok||!r._reservoir){out[s]=[];continue;}
   const rs=r._reservoir;
   out[s]=rs.pool.filter(c=>c&&c.windowOk&&!c.slopeLimited&&fini(c.loss)&&T.qualifyStrong(c)).map(c=>{
    const mm=decalage(capture.rails[s],L.positionOf(rails[s],[0,rs.sign*c.u,c.z]));
    return mm?{lat:mm[1],vert:mm[2],loss:c.loss,top:c.topRows??null,face:c.faceCount??null,graine:lat}:null;}).filter(Boolean);
  }
  return out;
 }
 /* Union des cellules fortes de toutes les relances, dédoublonnées à 3 mm (la perte la plus petite est gardée), classées par perte. */
 function cellules(capture,R){
  const out={left:[],right:[],relances:0};
  if(!capturePrete(capture))return out;
  for(const g of graines(R)){
   const r=relance(capture,g);if(!r)continue;out.relances++;
   for(const s of SIDES)for(const x of r[s]){const d=out[s].find(c=>Math.hypot(c.lat-x.lat,c.vert-x.vert)<3);if(d){if(x.loss<d.loss)Object.assign(d,x);}else out[s].push({...x});}
  }
  for(const s of SIDES)out[s].sort((p,q)=>p.loss-q.loss);
  return out;
 }
 const positionDe=(capture,s,c)=>L.positionOf(capture.rails[s],[0,c.lat/1000,c.vert/1000]);
 /* Paires (gauche, droite) parmi les `cellulesMax` meilleures cellules de chaque rail, à l'écartement admissible du contrat, par produit des pertes. */
 function paires(capture,cells,R){
  const out=[];
  for(const l of cells.left.slice(0,R.cellulesMax))for(const r of cells.right.slice(0,R.cellulesMax)){
   const gm=1000*C.distance(positionDe(capture,'left',l),positionDe(capture,'right',r));
   if(!Gauge.admissible(Gauge.classifyMm(gm)))continue;
   out.push({left:l,right:r,gaugeMm:gm,prod:l.loss*r.loss});
  }
  return out.sort((p,q)=>p.prod-q.prod);
 }
 const ecart=(p,q)=>Math.max(...SIDES.map(s=>Math.hypot(p[s].lat-q[s].lat,p[s].vert-q[s].vert)));
 /* La décision. `positions` : la pose que le lot s'apprête à commander, repère scène, par rail. Rend { version, etat, motif, ms, paireLot,
  * meilleure, concurrente, positions (scène, si `remplacer`), cellules:{left,right,relances}, nPaires }. Une entrée illisible ou un réglage
  * éteint rend `garde` : la commande du lot ne change pas. */
 function decider({capture,positions,R}={}){
  const t0=Date.now(),base={version:VERSION,etat:'garde',motif:null,mode:R&&R.mode||null,paireLot:null,meilleure:null,concurrente:null,positions:null,cellules:{left:0,right:0,relances:0},nPaires:0};
  const fin=o=>({...base,...o,ms:Date.now()-t0});
  if(!R||R.ok===false||R.actif!==true)return fin({motif:'reglage-eteint'});
  if(!capturePrete(capture)||!positions||!SIDES.every(s=>Array.isArray(positions[s])))return fin({motif:'entree-illisible'});
  const pose={};
  for(const s of SIDES){const d=decalage(capture.rails[s],positions[s]);if(!d)return fin({motif:'entree-illisible'});pose[s]={lat:d[1],vert:d[2]};}
  const cells=cellules(capture,R);
  const P=paires(capture,cells,R);
  const res={cellules:{left:cells.left.length,right:cells.right.length,relances:cells.relances},nPaires:P.length};
  if(!P.length)return fin({...res,motif:'aucune-paire-forte',etat:R.mode==='differer'?'differer':'garde'});
  const lot=P.find(p=>ecart(p,pose)<=R.presMm)||null,best=P[0];
  res.paireLot=lot,res.meilleure=best;
  if(R.mode==='differer'){
   if(!lot)return fin({...res,etat:'differer',motif:'pose-sans-paire-forte'});
   const conc=P.find(p=>p!==lot&&ecart(p,pose)>R.loinMm&&p.prod<=R.rapport*lot.prod)||null;
   if(conc)return fin({...res,etat:'differer',motif:'concurrence',concurrente:conc});
   return fin({...res,etat:'garde',motif:'pose-unique'});
  }
  /* mode choisir */
  if(ecart(best,pose)<=R.loinMm)return fin({...res,etat:'garde',motif:'meilleure-proche'});
  const second=P.find(p=>p!==best&&ecart(p,best)>R.loinMm)||null;
  if(second&&second.prod<R.rapport*best.prod)return fin({...res,etat:'differer',motif:'ambigu',concurrente:second});
  return fin({...res,etat:'remplacer',motif:'meilleure-loin',positions:{left:positionDe(capture,'left',best.left),right:positionDe(capture,'right',best.right)}});
 }
 /* Journal d'une décision : des millimètres (repère profil de la pose de départ), des pertes, des comptes ; jamais une coordonnée de scène. */
 const paireMm=p=>p?{left:[r1(p.left.lat),r1(p.left.vert)],right:[r1(p.right.lat),r1(p.right.vert)],gaugeMm:r1(p.gaugeMm),prod:sig4(p.prod),top:[p.left.top,p.right.top],face:[p.left.face,p.right.face]}:null;
 function resumer(d){
  if(!d)return null;
  return {version:d.version,etat:d.etat,motif:d.motif,mode:d.mode,ms:d.ms,cellules:d.cellules,nPaires:d.nPaires,paireLot:paireMm(d.paireLot),meilleure:paireMm(d.meilleure),concurrente:paireMm(d.concurrente),
   ...(d.paireLot&&d.meilleure?{rapportMeilleure:sig4(d.meilleure.prod/d.paireLot.prod)}:{})};
 }
 return {VERSION,DEFAUT,MODES,reglage,graines,decalage,relance,cellules,paires,decider,resumer};
});

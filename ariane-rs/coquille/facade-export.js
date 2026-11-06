/* CH-069 : façade des modules d'export sur le cœur WASM (ariane-export, fonctions 200 à 249), MÊME API, mêmes valeurs rendues.
 *   const F=ArianeFacadeExport.creer(coeur,{NativeExport,PhasePli,GCV1Export,ExportCache,Zip,Coeur})  (Coeur : ArianeCoeur, pour crc32 direct)
 *   → {nativeExport, phasePli, gcv1Export, exportCache, zip, compteurs()}
 * Chaque fonction portée appelle le cœur ; un refus (HorsDomaine) ou une entrée que la trame VBA refuse (TypeError « VBA : »)
 * rappelle le JS d'origine (compté). Les objets que le JS rend PAR IDENTITÉ (événements gardés, nœuds, entrées d'un
 * journal…) reviennent du cœur sous forme d'indices : la façade remet les objets d'origine. Les fonctions non portées
 * (état entre appels, fonctions reçues, stockage, Date.parse, Intl) sont celles du module JS, telles quelles.
 * Rien ici ne touche au stockage ni à ESV. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.ArianeFacadeExport=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 function creer(coeur,M){
  const N=M.NativeExport,P=M.PhasePli,G=M.GCV1Export,C=M.ExportCache,Z=M.Zip;
  const n={coeur:0,repliHorsDomaine:0,repliFormat:0},n2={direct:0},raisons={};
  const noter=(f,r)=>{const k=f+' '+r;raisons[k]=(raisons[k]||0)+1;};
  /* Appel du cœur ; null si le JS doit être rejoué (compté). Les exceptions du JS reproduites par le cœur sont relevées. */
  const REPLI={};
  function cœur(f,entree){
   try{const r=coeur.appeler(f,entree);n.coeur++;return r;}
   catch(e){if(e&&e.name==='HorsDomaine'){n.repliHorsDomaine++;noter(f,e.message);return REPLI;}if(e instanceof TypeError&&/^VBA : /.test(e.message)){n.repliFormat++;noter(f,e.message);return REPLI;}throw e;}
  }
  const appel=(f,entree,js)=>{const r=cœur(f,entree);return r===REPLI?js():r;};
  const choisir=(liste,sources,nouveaux)=>{const out=new Array(sources.length);for(let i=0;i<sources.length;i++){const s=sources[i];out[i]=s>=0?liste[s]:nouveaux[-s-1];}return out;};

  /* ---------------------------------------------------------------- zip-writer : crc32 */
  /* Chemin direct (sans trame) : les octets sont copiés une fois dans la mémoire d'une instance propre du module (même
   * Module compilé que le cœur), puis `ariane_export_crc32(p, n, crc)` ; le paramètre i32 de WebAssembly fait le même
   * ToInt32 que `crc ^ 0xFFFFFFFF` du JS. Instance refaite au-delà de 64 Mio de mémoire, ou après une trappe (repli JS). */
  let direct=null;
  const instanceDirecte=()=>{if(!direct&&M.Coeur&&coeur.module)direct=new WebAssembly.Instance(coeur.module,M.Coeur.IMPORTS).exports;return direct&&typeof direct.ariane_export_crc32==='function'?direct:null;};
  const zip={...Z,crc32(octets,crc=0){
   if(octets instanceof Uint8Array){const ex=instanceDirecte();
    if(ex){try{const n=octets.length,p=ex.vba_reserver(n);new Uint8Array(ex.memory.buffer,p,n).set(octets);const r=ex.ariane_export_crc32(p,n,crc)>>>0;ex.vba_liberer(p,n);
      if(ex.memory.buffer.byteLength>64*1024*1024)direct=null;n2.direct++;return r;}catch(e){direct=null;n.repliHorsDomaine++;noter(200,'direct : '+(e&&e.message));return Z.crc32(octets,crc);}}}
   if(!Array.isArray(octets))return Z.crc32(octets,crc);
   return appel(200,{octets,crc},()=>Z.crc32(octets,crc));}};

  /* ---------------------------------------------------------------- export-cache */
  const sansEnsembles=c=>{ // c.timing.pending : Set ou Map en JS, seule sa taille est lue
   if(!c||typeof c!=='object'||!c.timing||typeof c.timing!=='object')return c;
   const p=c.timing.pending;if(!(p instanceof Set||p instanceof Map))return c;
   return {...c,timing:{...c.timing,pending:{size:p.size}}};};
  const exportCache={...C,
   signature:o=>appel(201,{objet:o},()=>C.signature(o)),
   /* Extension de la façade : `objets.map(signature)` en un seul passage (instantané du panneau). */
   signatures:objets=>appel(202,{objets},()=>objets.map(o=>C.signature(o))),
   capturesAGarder:(s,events,records)=>appel(203,{s,events,records},()=>C.capturesAGarder(s,events,records)),
   refus:(c,options)=>appel(204,{c:sansEnsembles(c),options},()=>C.refus(c,options)),
   reprenable:c=>appel(205,{c:sansEnsembles(c)},()=>C.reprenable(c)),
   finiPourDeBon:b=>appel(206,{b},()=>C.finiPourDeBon(b)),
   ficheDepart:(obs,ctx)=>appel(207,{obs,ctx},()=>C.ficheDepart(obs,ctx)),
   ajouterDepart(liste,fiche){const r=cœur(208,{liste,fiche});if(r===REPLI)return C.ajouterDepart(liste,fiche);return r.map(i=>i<0?fiche:liste[i]);}};

  /* ---------------------------------------------------------------- native-export */
  const nativeExport={...N,
   compact:(doc,options)=>appel(210,{doc,options},()=>N.compact(doc,options)),
   expand(doc,options){if(doc&&doc.format!==N.FORMAT)return doc;return appel(211,{doc,options},()=>N.expand(doc,options));},
   expandCloud:(cloud,dictionaries)=>appel(212,{cloud,dictionaries},()=>N.expandCloud(cloud,dictionaries)),
   unfoldRefs:(value,dictionaries)=>appel(213,{value,dictionaries},()=>N.unfoldRefs(value,dictionaries)),
   misfiledHead:doc=>appel(214,{doc},()=>N.misfiledHead(doc)),
   alleger(cloud){
    if(!cloud||typeof cloud!=='object'||!Array.isArray(cloud.nodes))return cloud;
    const r=cœur(215,{cloud:{nodes:cloud.nodes}});if(r===REPLI)return N.alleger(cloud);
    if(!r.length)return cloud;
    const vises=new Set(r);
    const nodes=cloud.nodes.map((node,i)=>{if(!vises.has(i))return node;const {probes,...reste}=node;return reste;});
    return {...cloud,nodes,exportLightening:{mode:'allege',decision:'D-091',probesRemovedFromNodes:r.length,
     probesRule:'retained === 0 et aucune sonde roiHit ni hierarchyRoiHit',pointsUnchanged:true}};},
   enteteMince(metadata){
    const r=cœur(216,{metadata});if(r===REPLI)return N.enteteMince(metadata);
    const out={};r.cles.forEach((k,i)=>{out[k]=r.vides[i]?[]:metadata[k];});return out;},
   deltaMetadonnees(doc,jalon){
    if(!doc||typeof doc!=='object')return N.deltaMetadonnees(doc,jalon);
    const entrees=m=>m instanceof Map?{cles:[...m.keys()],empreintes:[...m.values()]}:null;
    const j=jalon&&typeof jalon==='object'?{version:jalon.version,session:jalon.session,events:entrees(jalon.events),records:entrees(jalon.records)}:jalon;
    const r=cœur(217,{session:doc.session,events:doc.events,records:doc.records,jalon:j});
    if(r===REPLI)return N.deltaMetadonnees(doc,jalon);
    const session=doc&&doc.session&&doc.session.id;
    const garder=(liste,g)=>{const l=liste||[];return g.map(i=>l[i]);};
    const ev=garder(doc.events,r.events.gardes),rc=garder(doc.records,r.records.gardes);
    const carte=p=>new Map(p.cles.map((k,i)=>[k,p.empreintes[i]]));
    const stats={events:{total:(doc.events||[]).length,envoyes:ev.length},records:{total:(doc.records||[]).length,envoyes:rc.length}};
    return {doc:{...doc,events:ev,records:rc,deltaVidage:{...stats,note:'Vidage en delta : événements et visites neufs ou modifiés depuis le vidage précédent ; '+
       'tools/merge-segments.cjs réunit la série (l’export final est complet).'}},
     jalon:{version:1,session:session===undefined?null:session,events:carte(r.events),records:carte(r.records)},
     jalonAvant:r.valide?jalon:null,stats};},
   evenementsParReference(evenements,reference,options){
    const r=cœur(218,{evenements,reference,options});if(r===REPLI)return N.evenementsParReference(evenements,reference,options);
    if(r===null)return null;
    return {reference:'journal',total:r.total,longueurJournal:r.longueurJournal,signature:r.signature,ajouts:r.positions.map(p=>({position:p,evenement:evenements[p]}))};},
   rehydraterEvenements(ref,reference){
    const leger=ref&&typeof ref==='object'&&Object.getPrototypeOf(ref)===Object.prototype&&Array.isArray(ref.ajouts)
     ?{...ref,ajouts:ref.ajouts.map(a=>a&&typeof a==='object'&&Object.getPrototypeOf(a)===Object.prototype?{position:a.position}:a)}:ref;
    const r=cœur(219,{ref:leger,reference});if(r===REPLI)return N.rehydraterEvenements(ref,reference);
    return r.map(c=>c>=0?reference[c]:ref.ajouts[-c-1].evenement);}};

  /* ---------------------------------------------------------------- phase-pli */
  const phasePli={...P,
   plier(events){
    const r=cœur(220,{events});if(r===REPLI)return P.plier(events);
    return {events:choisir(Array.isArray(events)?events:[],r.sources,r.nouveaux),bilan:r.bilan};},
   deplier(events){
    const r=cœur(221,{events});if(r===REPLI)return P.deplier(events);
    const liste=Array.isArray(events)?events:[];
    return r.meme===true?liste:choisir(liste,r.sources,r.nouveaux);},
   estPlie:events=>appel(222,{events},()=>P.estPlie(events)),
   eligible:e=>appel(223,{e},()=>P.eligible(e))};

  /* ---------------------------------------------------------------- gcv1-export */
  const gcv1Export={...G,
   buildDiagnostic(args){
    const a=args===undefined?{}:args;if(a===null)return G.buildDiagnostic(args);
    const exportedAt=a.exportedAt===undefined?new Date().toISOString():a.exportedAt;
    return appel(230,{args:a,exportedAt},()=>G.buildDiagnostic({...a,exportedAt}));}};

  return {nativeExport,phasePli,gcv1Export,exportCache,zip,compteurs:()=>({...n,...n2}),raisonsDesReplis:()=>({...raisons})};
 }
 return {creer};
});

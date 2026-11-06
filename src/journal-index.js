/* CH-058 — INDEX DU JOURNAL EN MÉMOIRE (service worker), sans toucher la base IndexedDB.
 *
 * Mesuré (chantiers/CH-058/rapport.md) : plusieurs étapes relisaient TOUT le magasin `events` (et `records`) d'IndexedDB,
 * c'est-à-dire la journée entière, puis filtraient : export Écho (service worker et panneau), début de relecture,
 * liste de corrections, fin de lot, relevés de la liste ESV, vols écrits de la deuxième passe. Le coût croissait avec la
 * journée : de 0,4 à 2,7 s par lecture côté service worker à 150 000 événements, +214 Mo dans le panneau.
 *
 * Principe :
 *  - l'instance `store` du service worker est ENVELOPPÉE (écritures et suppressions) ; l'index retient, en mémoire
 *    seulement, les clés par session Écho (`nativeSessionId`) et par type (types lus par les étapes ci-dessus) ;
 *  - il est construit UNE fois par vie du service worker, par une seule lecture complète, au premier besoin ;
 *  - une lecture rend les objets des clés retenues, lus par `get` dans UNE transaction, clés triées comme IndexedDB les
 *    trie : même ordre que `getAll`. L'index est un SUR-ENSEMBLE (une clé périmée rend `undefined`, ignorée) ; l'appelant
 *    réapplique son filtre d'origine sur les vraies valeurs : résultat identique à « tout lire puis filtrer » ;
 *  - aucune écriture dans IndexedDB, aucune montée de version : l'ancien paquet (retour arrière) ouvre la même base
 *    (mesuré : une base montée en version 2 lui rendrait `VersionError`) ;
 *  - en cas de doute (construction ou écriture d'index en échec), l'index se déclare invalide et chaque lecture revient
 *    au chemin d'origine (lire tout, filtrer).
 * Les écritures faites hors de cette instance ne sont pas vues : seul le service worker écrit dans `events` et `records`
 * (le panneau ne fait que lire), vérifié dans le code au 06/11. */
(function(racine,fabrique){const M=fabrique();if(typeof module==='object'&&module.exports)module.exports=M;racine.BananeJournalIndex=M;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const cleEvenement=e=>e&&typeof e.eventId==='string'?e.eventId:null;
 const cleVisite=r=>{const id=r?.recordId||r?.id;return typeof id==='string'?id:null;};
 /* Tri des clés comme IndexedDB trie des clés chaînes (unités de code UTF-16) : c'est l'ordre par défaut de `sort`. */
 const trier=cles=>[...cles].sort();

 function creer(TYPES_SET){
  const ix={pret:false,invalide:false,construction:null,parType:new Map(),evNatif:new Map(),recNatif:new Map(),totaux:{events:0,records:0},mesures:{constructions:0,constructionMs:null,lectures:0}};
  const ajouter=(m,k,cle)=>{if(k===null||k===undefined)return;let s=m.get(k);if(!s){s=new Set();m.set(k,s);}s.add(cle);};
  const noterEvenement=(e,cle=cleEvenement(e))=>{if(cle===null||!e||typeof e!=='object')return;
   if(TYPES_SET.has(e.type))ajouter(ix.parType,e.type,cle);if(typeof e.nativeSessionId==='string')ajouter(ix.evNatif,e.nativeSessionId,cle);};
  const noterVisite=(r,cle=cleVisite(r))=>{if(cle===null||!r||typeof r!=='object')return;if(typeof r.nativeSessionId==='string')ajouter(ix.recNatif,r.nativeSessionId,cle);};
  const retirer=(cartes,cles)=>{for(const m of cartes)for(const s of m.values())for(const k of cles)s.delete(k);};
  const vider=()=>{ix.parType.clear();ix.evNatif.clear();ix.recNatif.clear();};
  return {ix,noterEvenement,noterVisite,retirer,vider};}

 /* Rend un store ÉQUIPÉ : un objet neuf qui délègue à `store` (BananeStorage3), enveloppe ses écritures et suppressions et
  * ajoute `lireParType`, `lireEvenementsNatif`, `lireVisitesNatif`, `clesNatif`, `indexJournal`. L'objet d'origine n'est
  * JAMAIS modifié : deux vies du service worker sur un même magasin (essais de redémarrage) gardent chacune leur index.
  * Un store déjà équipé est rendu tel quel. */
 const EQUIPES=new WeakSet();
 function equiper(base,options={}){if(!base||EQUIPES.has(base))return base;
  /* `options.types` : les types d'événements indexés, fournis par l'appelant (background.js, `TYPES_INDEXES`). */
  const TYPES_SET=new Set(Array.isArray(options.types)?options.types:[]);
  /* L'objet équipé est un Proxy : ses ajouts (et ce qu'on lui affecte ensuite, comme l'enveloppe de `putRecord` posée par
   * le moteur) vivent dans `ajouts` ; tout le reste est lu sur le magasin d'origine, et ses méthodes s'exécutent avec
   * `this` = le magasin d'origine (mesuré : avec un simple héritage, `setState` d'un magasin écrivait `this.state` sur
   * l'objet dérivé, et une seconde vie du service worker relisait l'ancien état). */
  const ajouts=Object.create(null);
  const store=new Proxy(base,{get:(t,p)=>{if(p in ajouts)return ajouts[p];const v=Reflect.get(t,p,t);return typeof v==='function'?v.bind(t):v;},
   set:(t,p,v)=>{ajouts[p]=v;return true;},has:(t,p)=>p in ajouts||p in t});
  const I=creer(TYPES_SET),{ix}=I,orig={};EQUIPES.add(store);
  const def=(n,v)=>{ajouts[n]=v;};
  /* La méthode du magasin est cherchée À CHAQUE APPEL (un essai, ou un autre module, peut la remplacer après nous). */
  for(const n of ['putEvent','putRecord','deleteEvent','deleteRecord','deleteMany','deleteIfUnchanged','clearAll'])if(typeof base[n]==='function')orig[n]=(...a)=>base[n](...a);
  /* Écritures : la clé est retenue DÈS l'appel, avant la fin de l'écriture. Une lecture lancée pendant une écriture en
   * cours la demande donc, et IndexedDB ordonne les transactions : comme `getAll` avant, elle voit l'écriture si celle-ci
   * a commencé avant elle. Une écriture refusée laisse une clé sans objet : sur-ensemble, sans effet sur le résultat.
   * Une clé qui n'est pas une chaîne (jamais vu : `K.uid`) rendrait l'ordre incertain : l'index se déclare invalide. */
  /* CH-067 : écritures comptées par clé. Une suppression ne retire de l'index que les clés qui n'ont pas été RÉÉCRITES pendant
   * qu'elle tournait : IndexedDB ordonne les transactions, une écriture lancée pendant la suppression peut passer après elle et laisser
   * l'objet en base. Le retirer de l'index le ferait disparaître des lectures bornées (sur-ensemble rompu, rien ne le détecte).
   * Les écritures ne sont comptées que pendant une suppression en cours (mémoire bornée), et oubliées quand la dernière finit. */
  const ecrits={events:new Map(),records:new Map()};let suppressions=0;
  const compter=(nom,cle)=>{if(suppressions>0&&typeof cle==='string')ecrits[nom].set(cle,(ecrits[nom].get(cle)||0)+1);};
  const avant=(nom,ids)=>{suppressions++;return new Map((ids||[]).map(k=>[k,ecrits[nom]?.get(k)||0]));};
  const retirerSiInchange=(nom,cartes,ids,vus)=>I.retirer(cartes,(ids||[]).filter(k=>(ecrits[nom].get(k)||0)===(vus.get(k)??0)));
  const fini=()=>{if(--suppressions===0){ecrits.events.clear();ecrits.records.clear();}};
  if(orig.putEvent)def('putEvent',e=>{try{if(e&&typeof e==='object'&&typeof e.eventId!=='string')ix.invalide=true;I.noterEvenement(e);compter('events',e?.eventId);ix.totaux.events++;}catch{ix.invalide=true;}return orig.putEvent(e);});
  if(orig.putRecord)def('putRecord',r=>{try{if(r&&typeof r==='object'&&cleVisite(r)===null)ix.invalide=true;I.noterVisite(r);compter('records',cleVisite(r));ix.totaux.records++;}catch{ix.invalide=true;}return orig.putRecord(r);});
  if(orig.deleteEvent)def('deleteEvent',async id=>{const v=avant('events',[id]);try{const r=await orig.deleteEvent(id);retirerSiInchange('events',[ix.parType,ix.evNatif],[id],v);return r;}finally{fini();}});
  if(orig.deleteRecord)def('deleteRecord',async id=>{const v=avant('records',[id]);try{const r=await orig.deleteRecord(id);retirerSiInchange('records',[ix.recNatif],[id],v);return r;}finally{fini();}});
  if(orig.deleteMany)def('deleteMany',async(nom,ids)=>{const v=avant(nom,ids);try{const r=await orig.deleteMany(nom,ids);
   if(nom==='events')retirerSiInchange(nom,[ix.parType,ix.evNatif],ids,v);else if(nom==='records')retirerSiInchange(nom,[ix.recNatif],ids,v);return r;}finally{fini();}});
  if(orig.deleteIfUnchanged)def('deleteIfUnchanged',async(nom,...a)=>{const v=avant(nom,a[0]);try{const r=await orig.deleteIfUnchanged(nom,...a);const ids=r?.supprimes||[];
   if(nom==='events')retirerSiInchange(nom,[ix.parType,ix.evNatif],ids,v);else if(nom==='records')retirerSiInchange(nom,[ix.recNatif],ids,v);return r;}finally{fini();}});
  /* CH-067 : après un vidage complet, l'index est JETÉ (reconstruit au prochain besoin, base presque vide) au lieu d'être vidé en restant
   * « prêt » : une écriture lancée pendant le vidage et passée après lui serait sinon absente de l'index. */
  if(orig.clearAll)def('clearAll',async()=>{try{return await orig.clearAll();}finally{I.vider();ix.totaux={events:0,records:0};ix.pret=false;ix.invalide=false;ix.construction=null;}});
  /* Construction : une lecture complète par magasin, une fois par vie du service worker. */
  const construire=()=>ix.construction||(ix.construction=(async()=>{const t0=Date.now();
   try{const cles=await Promise.all(['events','records'].map(n=>store.keys(n)));if(cles.flat().some(k=>typeof k!=='string'))ix.invalide=true;
    ix.totaux.events=cles[0].length;ix.totaux.records=cles[1].length;
    for(const e of await store.all('events'))I.noterEvenement(e);for(const r of await store.all('records'))I.noterVisite(r);
    ix.pret=true;ix.mesures.constructions++;ix.mesures.constructionMs=Date.now()-t0;}
   catch{ix.invalide=true;}})());
  /* `totaux` : approché (une réécriture compte une fois de plus) ; il ne sert qu'à choisir entre `get` et `getAll`, pas au résultat. */
  const lireClesStore=async(nom,cles)=>lireCles(await store.open(),nom,cles,ix.totaux[nom]);
  /* Lecture bornée, ou `null` si l'index n'est pas sûr (l'appelant lit alors tout, comme avant). */
  /* Toute incohérence (clé de l'index absente de la base, erreur de lecture) : JAMAIS de résultat partiel. La lecture rend
   * `null` (l'appelant lit tout, comme avant), un événement `journal-index-repli` est écrit, et l'index est jeté pour être
   * reconstruit au prochain besoin. Une clé absente ne vient normalement que d'une écriture refusée (clé retenue dès l'appel). */
  const repli=(nom,raison,detail={})=>{ix.mesures.replis=(ix.mesures.replis||0)+1;
   try{void Promise.resolve(orig.putEvent?.({eventId:'journal-index-repli-'+Date.now()+'-'+ix.mesures.replis,timestamp:new Date().toISOString(),type:'journal-index-repli',schema:1,
    magasin:nom,raison,...detail})).catch(()=>{});}catch{/* le journal n'est pas critique */}
   I.vider();ix.pret=false;ix.invalide=false;ix.construction=null;return null;};
  const borne=async(nom,cles)=>{await construire();if(!ix.pret||ix.invalide)return null;
   /* Un store sans `open` (harnais d'essai) ne sait pas lire par clé : ce n'est pas une incohérence, l'index est simplement inutilisable. */
   if(typeof store.open!=='function'){ix.invalide=true;return null;}
   ix.mesures.lectures++;
   let r;try{r=await lireClesStore(nom,cles());}catch(e){return repli(nom,'erreur',{message:String(e?.message||e).slice(0,160)});}
   if(r.manquants)return repli(nom,'cle-absente',{demandees:r.demandees,manquants:r.manquants});
   return r.objets;};
  const union=(m,ks)=>{const s=new Set();for(const k of ks)for(const c of m.get(k)||[])s.add(c);return s;};
  /* API : chaque fonction rend la même chose que `store.all(nom)` filtré par l'appelant, pour les objets qui comptent. */
  def('lireParType',async types=>{for(const t of types)if(!TYPES_SET.has(t))throw Error('Type non indexé : '+t);
   const r=await borne('events',()=>union(ix.parType,types));return r??(await store.all('events'));});
  def('lireEvenementsNatif',async sid=>(await borne('events',()=>union(ix.evNatif,[sid])))??(await store.all('events')));
  def('lireVisitesNatif',async sid=>(await borne('records',()=>union(ix.recNatif,[sid])))??(await store.all('records')));
  /* Pour le panneau (qui lit lui-même IndexedDB) : les clés triées, ou `null` si l'index n'est pas sûr. */
  def('clesNatif',async sid=>{await construire();if(!ix.pret||ix.invalide)return null;
   return {events:trier(union(ix.evNatif,[sid])),records:trier(union(ix.recNatif,[sid])),totaux:{...ix.totaux}};});
  def('indexJournal',{etat:()=>({pret:ix.pret,invalide:ix.invalide,mesures:{...ix.mesures},
   tailles:{types:[...ix.parType.values()].reduce((a,s)=>a+s.size,0),evNatif:[...ix.evNatif.values()].reduce((a,s)=>a+s.size,0),recNatif:[...ix.recNatif.values()].reduce((a,s)=>a+s.size,0)}}),
   construire,types:[...TYPES_SET],
   /* Écriture faite hors de cette instance (banc, outil) : l'index est jeté et sera reconstruit au prochain besoin. */
   invalider:()=>{I.vider();ix.pret=false;ix.invalide=false;ix.construction=null;}});
  return store;}

 /* Objets des clés données, dans une base déjà ouverte, en UNE transaction, dans l'ordre de `getAll` ; `undefined` (clé
  * supprimée entre-temps) est retiré. Service worker et panneau. Quand les clés demandées dépassent PART_GETALL du magasin,
  * `getAll` puis filtre par clé est plus rapide (mesuré au banc : 31 000 clés sur 41 000, 0,48 s par `getAll` contre 0,81 s
  * par `get`) ; le résultat est le même : mêmes objets, même ordre. */
 const PART_GETALL=0.4;
 /* `total` : nombre d'objets du magasin, tenu par l'index (pas `count()`, qui parcourt tout le magasin : mesuré, 0,28 s à
  * 181 000 objets). Inconnu : lecture par `get`. */
 async function lireCles(db,nom,cles,total){const liste=trier(cles),voulues=new Set(liste);
  /* Rend {objets, demandees, manquants} : `manquants` > 0 dit qu'une clé demandée n'est plus en base (l'appelant ne doit pas s'en servir). */
  return new Promise((res,rej)=>{const tx=db.transaction(nom,'readonly'),os=tx.objectStore(nom);let out=null;
    if(Number.isFinite(total)&&liste.length>PART_GETALL*total){const q=os.getAll(),k=os.getAllKeys();let v=null,ks=null;
     const fin=()=>{if(v&&ks)out=v.filter((_,i)=>voulues.has(ks[i]));};q.onsuccess=()=>{v=q.result;fin();};k.onsuccess=()=>{ks=k.result;fin();};}
    else{const tab=new Array(liste.length);out=tab;liste.forEach((x,i)=>{const q=os.get(x);q.onsuccess=()=>{tab[i]=q.result;};});}
   tx.oncomplete=()=>{const objets=(out||[]).filter(x=>x!==undefined);res({objets,demandees:liste.length,manquants:liste.length-objets.length});};tx.onerror=()=>rej(tx.error);tx.onabort=()=>rej(tx.error||Error('Lecture annulée.'));});}

 return {equiper,lireCles};
});

/* 4.9.5.3 (S7) — REPLI DES JALONS `phase-timing` PAR VISITE, À L'EXPORT.
 *
 * Avant : un événement par jalon (visite, point, étape, requête…), chacun recopiant le contexte de la visite (session,
 * lot, horloge, visite, identité du cut, identifiants de capture, d'analyse et de proposition) : mesuré sur un export réel
 * (partie 27, 606 visites), 23 421 jalons = 20,6 Mo sur 48,6 Mo de journal, dont près de 18 Mo de contexte répété.
 * Maintenant : UN événement `phase-timing-pli` par visite. Le contexte n'y figure qu'une fois ; chaque jalon n'est plus
 * qu'une ligne de nombres (écart de numéro d'ordre, écart de numéro de lot, `ms`, forme, valeurs). Un résumé de la visite
 * (comptes par sorte de jalon, durées cumulées par étape, instants des jalons depuis l'ouverture) est joint pour la lecture
 * à l'œil. Les formes de ligne sont rangées une fois dans un événement `phase-timing-pli-formes`.
 *
 * SANS PERTE pour l'analyse : `deplier()` redonne chaque jalon d'origine à l'identique (mêmes clés, mêmes valeurs, au bit
 * près pour les nombres), à deux exceptions dites : `eventId` (rendu sous une forme de 36 caractères propre à la ligne, pour garder les tailles mesurées) et `timestamp`
 * (recalculé : heure d'origine de l'horloge + `ms`, à quelques millisecondes de l'heure d'émission d'origine). Aucun outil
 * d'analyse ne lit l'un ni l'autre pour les jalons (`tools/perf-phases.cjs` s'en sert pour écarter les doublons seulement).
 * Les lignes sont rendues dans l'ordre des numéros (`seq`), non plus dans l'ordre aléatoire de la base.
 *
 * GARDE-FOUS : un groupe qui ne se redéplie pas à l'identique (clé manquante, valeur réservée, nombre non fini…) n'est PAS
 * replié : ses jalons restent tels quels dans l'export. Les jalons sans visite (lot, santé) restent toujours tels quels.
 * Aucune lecture d'ESV, aucune commande, aucun effet sur le lot : ce module ne fait que réécrire un tableau d'événements
 * déjà lu, au moment de l'export. */
(function(root,factory){'use strict';const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;else root.BananePhasePli=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){'use strict';
 const TYPE='phase-timing-pli',TYPE_FORMES='phase-timing-pli-formes',VERSION=1;
 /* Clés d'en-tête (identiques sur toute la visite), de contexte (qui peuvent changer d'un jalon à l'autre), de ligne. */
 const ENTETE=['schema','clockId','timeOrigin','sessionId','batchId','visitId'];
 const CTX=['identity','captureId','analysisId','proposalId','selector'];
 const LIGNE=['seq','batchSeq','ms','kind'];
 const PERDUES=['eventId','timestamp','type'];
 const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
 const MARQUE_REF='§',MARQUE_MS='=';
 const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
 const fini=v=>typeof v==='number'&&Number.isFinite(v);
 const copie=v=>v===undefined?undefined:JSON.parse(JSON.stringify(v));
 /* Forme canonique (clés triées) pour comparer un jalon à son redéploiement. */
 function canon(v){if(Array.isArray(v))return v.map(canon);if(v&&typeof v==='object'){const o={};for(const k of Object.keys(v).sort())if(v[k]!==undefined)o[k]=canon(v[k]);return o;}return v;}
 const egal=(a,b)=>JSON.stringify(canon(a))===JSON.stringify(canon(b));

 function eligible(e){
  if(!e||typeof e!=='object'||e.type!=='phase-timing'||e.schema!==1||e.kind==='health')return false;
  if(typeof e.visitId!=='string'||!e.visitId||!fini(e.ms)||!fini(e.timeOrigin)||!Number.isInteger(e.seq)||!Number.isInteger(e.batchSeq))return false;
  if(typeof e.clockId!=='string'||typeof e.sessionId!=='string'||typeof e.batchId!=='string'||typeof e.kind!=='string')return false;
  return CTX.every(k=>own(e,k));
 }
 const cleGroupe=e=>JSON.stringify([e.sessionId,e.batchId,e.clockId,e.timeOrigin,e.visitId]);

 /* ------------------------------------------------------------------ repli */
 function plierGroupe(es,formes){
  es=es.slice().sort((a,b)=>a.seq-b.seq);
  const premier=es[0],u=[],indexU=new Map();
  const interne=v=>{if(typeof v!=='string'||!UUID.test(v))return v;let i=indexU.get(v);if(i===undefined){i=u.length;u.push(v);indexU.set(v,i);}return MARQUE_REF+i;};
  const entete={};for(const k of ENTETE)entete[k]=premier[k];
  const etat={};for(const k of CTX)etat[k]=copie(premier[k]);
  const ctx={};for(const k of CTX)ctx[k]=copie(premier[k]);
  const rows=[],resume={k:{},s:{},j:{}};let seqPrec=0,bsPrec=0;const m0=premier.ms;
  for(const e of es){
   const explicites={};
   for(const k of CTX)if(!egal(e[k],etat[k])){explicites[k]=copie(e[k]);etat[k]=copie(e[k]);}
   for(const k of Object.keys(e)){if(PERDUES.includes(k)||ENTETE.includes(k)||LIGNE.includes(k)||CTX.includes(k))continue;if(e[k]!==undefined)explicites[k]=copie(e[k]);}
   const cles=Object.keys(explicites).sort(),forme=JSON.stringify([e.kind,cles]);
   let id=formes.index.get(forme);if(id===undefined){id=formes.liste.length;formes.liste.push({k:e.kind,c:cles});formes.index.set(forme,id);}
   const vals=cles.map(k=>{const v=explicites[k];if(typeof v==='string'&&(v.startsWith(MARQUE_REF)||v===MARQUE_MS))throw Error('valeur réservée');
    if(v===e.ms&&typeof v==='number')return MARQUE_MS;return interne(v);});
   rows.push([e.seq-seqPrec,e.batchSeq-bsPrec,e.ms,id,...vals]);seqPrec=e.seq;bsPrec=e.batchSeq;
   /* Résumé de lecture : comptes par sorte de jalon, durée cumulée par étape, instant (ms depuis l'ouverture) de chaque point. */
   resume.k[e.kind]=(resume.k[e.kind]||0)+1;
   if(e.kind==='span'&&typeof e.label==='string'&&fini(e.fromMs)&&fini(e.toMs)){const s=resume.s[e.label]||(resume.s[e.label]=[0,0]);s[0]++;s[1]=Math.round((s[1]+e.toMs-e.fromMs)*10)/10;}
   if((e.kind==='point'||e.kind==='visit')&&typeof e.point==='string'&&!own(resume.j,e.point))resume.j[e.point]=Math.round((e.ms-m0)*10)/10;
  }
  const out={type:TYPE,schema:VERSION,...entete,ctx,n:rows.length,r:resume,...(u.length?{u}:{}),rows};
  return out;
 }
 /* Replie les jalons `phase-timing` par visite. Rend un nouveau tableau (l'entrée n'est pas modifiée) et un bilan. */
 function plier(events){
  const liste=Array.isArray(events)?events:[];
  const groupes=new Map();
  liste.forEach((e,i)=>{if(!eligible(e))return;const k=cleGroupe(e);const g=groupes.get(k);if(g)g.es.push(e);else groupes.set(k,{es:[e],premier:i});});
  const formes={liste:[],index:new Map()},plies=new Map(),exclus=new Set();let nbRefus=0,nbPlies=0,rangs=0;
  for(const [k,g] of groupes){
   try{
    /* Les formes sont globales : on n'en ajoute définitivement que si le groupe passe l'essai de redéploiement. */
    const copieFormes={liste:formes.liste.slice(),index:new Map(formes.index)};
    const ev=plierGroupe(g.es,copieFormes);
    const ref=deplierGroupe(ev,copieFormes.liste,0);
    const attendu=g.es.slice().sort((a,b)=>a.seq-b.seq);
    if(ref.length!==attendu.length||!attendu.every((e,i)=>egal(sansPerdues(e),sansPerdues(ref[i])))){nbRefus+=g.es.length;continue;}
    formes.liste=copieFormes.liste;formes.index=copieFormes.index;
    plies.set(g.premier,ev);for(const e of g.es)exclus.add(e);nbPlies+=g.es.length;rangs+=ev.rows.length;
   }catch{nbRefus+=g.es.length;}
  }
  const sortie=[];let formesPosees=false;
  liste.forEach((e,i)=>{
   if(plies.has(i)){if(!formesPosees){sortie.push({type:TYPE_FORMES,schema:VERSION,formes:formes.liste});formesPosees=true;}sortie.push(plies.get(i));return;}
   if(exclus.has(e))return;sortie.push(e);
  });
  return {events:sortie,bilan:{evenementsAvant:liste.length,evenementsApres:sortie.length,jalonsPlies:nbPlies,jalonsLaisses:nbRefus,groupes:plies.size}};
 }
 function sansPerdues(e){const o={};for(const k of Object.keys(e))if(k!=='eventId'&&k!=='timestamp')o[k]=e[k];return o;}

 /* --------------------------------------------------------------- dépliage */
 /* Identifiant restitué : 36 caractères comme l'original, pour que les tailles mesurées (`instrumentation.utf8Bytes`) restent celles d'origine. */
 const hex=(n,k)=>n.toString(16).padStart(k,'0');
 const idRestitue=(g,i)=>`70690000-${hex(g%65536,4)}-4000-8000-${hex(i,12)}`;
 function deplierGroupe(g,formes,indexGroupe){
  const u=Array.isArray(g.u)?g.u:[];
  const sortie=[],etat={};for(const k of CTX)etat[k]=copie(g.ctx?.[k]);
  const lire=v=>typeof v==='string'&&v.startsWith(MARQUE_REF)?u[Number(v.slice(MARQUE_REF.length))]:v;
  let seq=0,bs=0;
  (g.rows||[]).forEach((r,i)=>{
   seq+=r[0];bs+=r[1];const ms=r[2],f=formes[r[3]];if(!f)throw Error('forme inconnue');
   const e={eventId:idRestitue(indexGroupe,i),timestamp:new Date(g.timeOrigin+ms).toISOString(),type:'phase-timing'};
   for(const k of ENTETE)e[k]=g[k];
   e.seq=seq;e.batchSeq=bs;e.ms=ms;e.kind=f.k;
   f.c.forEach((k,j)=>{const v=r[4+j],val=v===MARQUE_MS?ms:lire(v);if(CTX.includes(k))etat[k]=copie(val);else e[k]=copie(val);});
   for(const k of CTX)e[k]=copie(etat[k]);
   sortie.push(e);
  });
  return sortie;
 }
 /* Redonne les jalons d'origine ; les événements d'un autre type, ou d'un groupe illisible, passent tels quels. */
 function deplier(events){
  const liste=Array.isArray(events)?events:[];
  if(!liste.some(e=>e&&e.type===TYPE))return liste;
  const formes=liste.find(e=>e&&e.type===TYPE_FORMES)?.formes;
  const sortie=[];let n=0;
  for(const e of liste){
   if(e&&e.type===TYPE_FORMES)continue;
   if(e&&e.type===TYPE){try{if(!Array.isArray(formes))throw Error('formes absentes');sortie.push(...deplierGroupe(e,formes,n));}catch{sortie.push(e);}n++;continue;}
   sortie.push(e);
  }
  return sortie;
 }
 const estPlie=events=>Array.isArray(events)&&events.some(e=>e&&e.type===TYPE);
 return {TYPE,TYPE_FORMES,VERSION,plier,deplier,estPlie,eligible};
});

/* GARDE D'AMBIGUÏTÉ S1 — lot correctif GCV1.
 *
 * Défaut corrigé : quand A_STAR s'abstient POUR AMBIGUÏTÉ, la politique S1
 * pouvait lever cette abstention sur son seul test « un cluster STRONG
 * compétitif », et publier un placement distant alors qu'un candidat V4.6
 * géométriquement STRONG occupait une hypothèse spatialement distincte. Le cas
 * indépendant partie 23 / cut 2857 / rail droit en est la preuve de terrain :
 * S1 publiait u = 161,4 mm, z = 34,0 mm, soit 139,7 mm de la correction
 * humaine, quand V4.6 proposait u = 26,0 mm (0,9 mm de cette correction).
 *
 * La garde ne choisit pas : elle PRÉSERVE l'ambiguïté. Aucun repli automatique
 * vers V4.6, aucun candidat, aucune décision VALIDATE/SKIP, aucune application.
 * Le Pilote suit son chemin DEFERRED_UNRESOLVED habituel.
 *
 * Aucun seuil empirique n'est introduit : motif 'ambiguity' vient de motifOf,
 * la qualification de qualifyStrong, la distinction spatiale de
 * spatialClusters/SEP (CONTRACT.alternativeSeparation).
 */
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const Shadow=require('../src/gcv1-shadow.js');
const T=Shadow._test;
const SEP=Shadow.CONTRACT.alternativeSeparation;
const AMBIG='Plusieurs placements concurrents du champignon sont géométriquement plausibles.';

const CORPUS=path.join(__dirname,'corpus');
const captureOf=cut=>{
  const name=fs.readdirSync(CORPUS).find(f=>f.startsWith(`banane-lidar-part-23-cut-${cut}-`));
  assert.ok(name,`capture du cut ${cut} absente du corpus de test`);
  return JSON.parse(fs.readFileSync(path.join(CORPUS,name),'utf8'));
};
const oracleOf=(cut,side)=>{
  const refs=JSON.parse(fs.readFileSync(path.join(CORPUS,'references.json'),'utf8'));
  const rec=refs.records.find(r=>r.cut===cut);
  assert.equal(rec.source,'explicit-before-after','seule une référence humaine explicite fait oracle');
  return rec.rails[side].displacementLocal;
};
const err2d=(delta,truth)=>Math.hypot(delta[1]-truth[1],delta[2]-truth[2])*1000;

/* Cellules STRONG servant aux cas unitaires. Les champs sont exactement ceux
 * que qualifyStrong et spatialClusters consultent. */
const strongCell=(u,z,extra={})=>({u,z,loss:1e-6,topRows:40,faceCount:8,slopeLimited:false,windowOk:true,
  tier:'STRONG_FACE',...extra});
const ambiguousAstar=(motif='ambiguity',reason=AMBIG)=>({status:'unresolved',motif,reason,seed:[0,0],
  loss:1e-6,topRows:12,faceCount:3,slopeLimited:false});
const s1Publishing=pick=>({status:'candidate',motif:'candidate',reason:null,pick,policy:'S1',
  changed:true,activated:true,nStrongCompetitive:1,nClusters:1});
/* Sortie V4.6 compactée : `status` est la clause C4 de la règle ablatée. Un V4.6
 * UNRESOLVED porte encore seed/top/face, donc la cellule du pool ne suffit pas. */
const v46Proposal=(status='candidate',delta=[0,0,0])=>({status,reason:status==='candidate'?null:'Autre raison.',
  delta:status==='candidate'?delta:null,seed:[delta[1],delta[2]],topRows:40,faceCount:8,slopeLimited:false});

/* ---- A — le cas de terrain devient une ambiguïté préservée ---- */
test('A — 2857 droite : S1 voulait publier un placement distant, GCV1 préserve l’ambiguïté',()=>{
 const rail=Shadow.scientificProposeBoth(captureOf(2857)).rails.right;
 assert.equal(rail.ok,true);
 // conditions de la garde, observées et non supposées
 assert.equal(rail.astar.status,'unresolved');
 assert.equal(rail.astar.motif,'ambiguity');
 assert.equal(rail.astar.reason,AMBIG);
 assert.equal(rail.v46.status,'candidate');
 // témoin du chemin S1 d'origine : un seul cluster STRONG compétitif, donc S1 publiait
 assert.equal(rail.next.nClusters,1);
 assert.equal(rail.next.nStrongCompetitive,1);
 // résultat après garde : abstention pour ambiguïté, sans repli V4.6
 assert.equal(rail.s1AmbiguityPreserved,true);
 assert.equal(rail.next.status,'unresolved');
 assert.equal(rail.next.motif,'ambiguity');
 assert.equal(rail.next.reason,AMBIG);
 assert.equal(rail.next.delta,null);
 assert.equal(rail.next.pick,null);
 assert.equal(rail.next.changed,false);
 assert.equal(rail.next.activated,true);
 assert.equal(rail.publishedWeak,false);
 // aucun repli : le delta V4.6, même excellent, n'est pas publié
 const oracle=oracleOf(2857,'right');
 assert.ok(err2d(rail.v46.delta,oracle)<15,'V4.6 est bien la bonne hypothèse ici');
 assert.equal(rail.next.delta,null,'et GCV1 ne la publie pas pour autant');
});

/* ---- B — ratification S1 utile préservée ---- */
test('B — 2865 droite : la ratification S1 dans la même hypothèse reste publiée',()=>{
 const rail=Shadow.scientificProposeBoth(captureOf(2865)).rails.right;
 assert.equal(rail.astar.motif,'ambiguity','même motif d’abstention A_STAR que 2857');
 assert.equal(rail.v46.status,'candidate');
 assert.equal(rail.s1AmbiguityPreserved,false);
 assert.equal(rail.next.status,'candidate');
 assert.equal(rail.next.changed,true);
 assert.ok(rail.deltaV46Next<SEP,`S1 reste dans l’hypothèse V4.6 (${rail.deltaV46Next} < ${SEP})`);
 assert.ok(err2d(rail.next.delta,oracleOf(2865,'right'))<=15,'la correction humaine reste retrouvée');
});

/* ---- C — 4680 droite (corpus de découverte, hors dépôt) ---- */
test('C — 4680 droite : candidat S1 confondu avec le candidat V4.6, garde silencieuse',()=>{
 /* La capture 9/4680 appartient au corpus de découverte, qui n'est pas versionné.
  * Les valeurs ci-dessous sont celles relevées sur cette capture : le pick S1 et
  * la cellule V4.6 sont la MÊME cellule (distance 0,0 mm). */
 const cell=strongCell(.019,-.005,{loss:7.07487933969744e-7,topRows:298,faceCount:44});
 const pick={...cell};
 assert.equal(T.spatialClusters([cell,pick]).length,1,'une seule hypothèse spatiale');
 assert.equal(T.preserveAmbiguity(ambiguousAstar(),s1Publishing(pick),v46Proposal(),cell),false);
});

/* ---- D — pas de V4.6 exploitable : les récupérations S1 existantes survivent ---- */
test('D — sans candidat V4.6 STRONG, la garde ne bloque aucune récupération S1',()=>{
 const far=strongCell(.16,.034);
 assert.equal(T.preserveAmbiguity(ambiguousAstar(),s1Publishing(far),v46Proposal(),null),false,'cellule V4.6 absente');
 assert.equal(T.preserveAmbiguity(ambiguousAstar(),s1Publishing(far),v46Proposal(),
   strongCell(0,0,{faceCount:5})),false,'V4.6 sous minFace');
 assert.equal(T.preserveAmbiguity(ambiguousAstar(),s1Publishing(far),v46Proposal(),
   strongCell(0,0,{topRows:14})),false,'V4.6 sous minTop');
 assert.equal(T.preserveAmbiguity(ambiguousAstar(),s1Publishing(far),v46Proposal(),
   strongCell(0,0,{slopeLimited:true})),false,'V4.6 à inclinaison bridée');
 assert.equal(T.preserveAmbiguity(ambiguousAstar(),s1Publishing(far),v46Proposal(),
   strongCell(0,0,{windowOk:false})),false,'V4.6 hors fenêtre');
});

/* ---- E — la garde ne s'élargit pas aux autres motifs d'abstention ---- */
test('E — A_STAR abstenu pour un autre motif : la garde reste muette',()=>{
 const far=strongCell(.16,.034),v46=strongCell(0,0);
 for(const motif of ['flank','minTop','window','slope','rsf','pair-lateral','other'])
  assert.equal(T.preserveAmbiguity(ambiguousAstar(motif,'Autre raison.'),s1Publishing(far),v46Proposal(),v46),false,motif);
 // et jamais sur un A_STAR qui est lui-même candidat
 assert.equal(T.preserveAmbiguity({status:'candidate',motif:'candidate',reason:null},
   s1Publishing(far),v46Proposal(),v46),false,'A_STAR candidat');
 // ni sur une sortie S1 qui ne change rien
 assert.equal(T.preserveAmbiguity(ambiguousAstar(),
   {status:'unresolved',motif:'ambiguity',pick:null,changed:false,activated:true},v46Proposal(),v46),false,'S1 sans candidat');
 assert.equal(T.preserveAmbiguity(ambiguousAstar(),
   {...s1Publishing(far),changed:false},v46Proposal(),v46),false,'S1 conserve le motif A_STAR');
});

/* ---- F — candidat S1 non distinct spatialement : aucune abstention ajoutée ---- */
test('F — la distinction spatiale est celle du contrat, et elle seule décide',()=>{
 const v46=strongCell(0,0);
 const just=T.preserveAmbiguity(ambiguousAstar(),s1Publishing(strongCell(SEP-1e-4,0)),v46Proposal(),v46);
 const over=T.preserveAmbiguity(ambiguousAstar(),s1Publishing(strongCell(SEP,0)),v46Proposal(),v46);
 assert.equal(just,false,'sous la séparation du contrat : même hypothèse');
 assert.equal(over,true,'à la séparation du contrat : hypothèses distinctes');
 // la frontière est exactement celle de spatialClusters, pas un seuil nouveau
 assert.equal(T.spatialClusters([v46,strongCell(SEP-1e-4,0)]).length,1);
 assert.equal(T.spatialClusters([v46,strongCell(SEP,0)]).length,2);
});

/* ---- G — contrat runtime d'une ambiguïté préservée ---- */
test('G — une ambiguïté préservée traverse la frontière runtime en abstention pure',()=>{
 const science=Shadow.scientificProposeBoth(captureOf(2857));
 assert.equal(science.rails.right.s1AmbiguityPreserved,true);
 const rails=Shadow.toRuntimeRails(science);
 const r=rails.right;
 assert.equal(r.status,'unresolved');
 assert.equal(r.delta,null);
 assert.equal(r.confidence,0);
 assert.deepEqual(r.reasons,[AMBIG]);
 assert.equal(r.source,'geometry-candidate-v1-abstention');
 assert.equal(r.geometryEngine,'geometry-candidate-v1');
 assert.equal(r.gcv1.motif,'ambiguity');
 assert.equal(r.gcv1.activated,true);
 assert.equal(r.gcv1.changed,false);
 assert.equal(r.parameters.alternativeSeparation,SEP);
 // cette couche ne fabrique aucune commande : ni application, ni VALIDATE/SKIP
 for(const key of ['apply','validate','skip','command','action','click'])
  assert.equal(Object.hasOwn(r,key),false,key+' ne doit pas exister sur un rail runtime');
 for(const action of ['apply','validateAndNext','skipAndNext','navigate'])
  assert.equal(Object.hasOwn(Shadow,action),false,action+' ne doit pas être exposé');
});

/* ---- H — portée : un V4.6 UNRESOLVED ne vaut pas un candidat V4.6 ---- */
test('H — V4.6 unresolved avec une cellule pourtant STRONG : la garde reste muette',()=>{
 /* `src/geometry.js` rend `{...unresolved(...),metrics,top,face}` sur ses deux
  * sorties non soutenues : un V4.6 UNRESOLVED porte donc encore seed, top et
  * face. Sur sa propre abstention d'ambiguïté (ratio de perte sous
  * minTemplateLossRatio) minTop, minFace, la pente et la fenêtre sont déjà tous
  * satisfaits, et la cellule `engine-published` qui en découle est STRONG.
  * La clause C4 de la règle ablatée est `v46.status === 'candidate'` : tester
  * la seule cellule du pool rendrait la garde plus large que la règle validée. */
 const cell=strongCell(0,0);
 assert.equal(T.qualifyStrong(cell),true,'la cellule issue d’un V4.6 unresolved peut être STRONG');
 const far=strongCell(.16,.034);
 assert.equal(T.spatialClusters([cell,far]).length,2,'et spatialement distincte du pick S1');
 for(const status of ['unresolved','absent'])
  assert.equal(T.preserveAmbiguity(ambiguousAstar(),s1Publishing(far),v46Proposal(status),cell),false,status);
 assert.equal(T.preserveAmbiguity(ambiguousAstar(),s1Publishing(far),null,cell),false,'V4.6 absent');
 // et la garde reste effective quand V4.6 est bien candidat
 assert.equal(T.preserveAmbiguity(ambiguousAstar(),s1Publishing(far),v46Proposal(),cell),true);
});

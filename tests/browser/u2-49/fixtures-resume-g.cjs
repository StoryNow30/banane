'use strict';
/* Données SYNTHÉTIQUES pour voir le résumé de partie dans le vrai panneau
 * (mission F). Aucune donnée d'ESV. Chaque cas donne : `state` (réponse de
 * l'action « view » du double de backend) et `history` (événements à écrire
 * dans IndexedDB « banane-test-v3 », magasin « events », clé = eventId),
 * plus ce que le panneau doit afficher. */
const id=(cut,extra={})=>({pageId:'page-F',frameId:'repere-F',shape:'U50',projectId:null,part:23,cut,...extra});
const t=s=>`2026-10-05T08:00:${String(s).padStart(2,'0')}.000Z`;
const ev=(type,cut,s,extra={})=>({eventId:`F-${type}-${s}`,type,timestamp:t(s),identity:id(cut),...extra});
const start=(lot,cut,s)=>ev('batch-started',cut,s,{batch:{id:lot,startedAt:t(s),scope:{part:23,pageId:'page-F'}}});
const lot=(extra={})=>({id:'F-lot-b',state:'STOPPED',step:'capture',startedAt:t(10),scope:{part:23,start:1,end:20,pageId:'page-F',unresolvedPolicy:'defer',lotDecision:'apply',geometryEngine:'geometry-candidate-v1',lowConfidence:'attempt'},
  activeIdentity:id(3),processed:[{identity:id(1),cut:1},{identity:id(3),cut:3}],deferred:[],skipped:[],paused:[],interrupted:[],manuallyCompleted:[],sequence:[],lotCommands:{},...extra});
const state=(extra={})=>({sessionId:'F-session',current:{identity:id(3)},busy:false,manual:null,native:null,notice:'État synthétique F',intent:null,reconcileRequired:false,events:[],batch:lot(),...extra});
/* Deux lots : le cut 1 différé au lot a, posé au lot b (reprise) ; cut 2 différé ; cut 3 posé. */
const history=[start('F-lot-a',1,0),ev('defer-finalized',1,1,{batchId:'F-lot-a',deferredConfirmed:true,rails:{left:{gcv1:{motif:'flank'}}}}),
  ev('defer-finalized',2,2,{batchId:'F-lot-a',deferredConfirmed:true,rails:{left:{gcv1:{motif:'gauge-out-of-contract'}}}}),
  start('F-lot-b',1,10),ev('validation-accepted',1,11,{batchId:'F-lot-b',action:'VALIDATE'}),ev('validation-accepted',3,12,{batchId:'F-lot-b',action:'VALIDATE'})];
module.exports={
 complet:{state:state(),history,attendu:{titre:'Résumé de la partie 23',note:/^Historique lu en entier\./,differes:'Différés restants : 2.',lots:'Lots de la partie (2)',
   tuiles:'Lots 2 · Coupes traitées 3 · Posées par Ariane 2 · Différés restants 1 (0 moteur · 1 écartement · 0 sans points · 0 motif inconnu)'}},
 indisponible:{state:state(),history:null,bloquerIndexedDB:true,attendu:{note:/^Historique indisponible/,differes:'Différés restants : inconnu (aucun dans ce qui a été lu).',
   tuiles:'Lots au moins 1 · Coupes traitées au moins 2 · Posées par Ariane au moins 2 · Différés restants inconnu'}},
 partiel:{state:state(),history:history.filter(e=>e.batch?.id!=='F-lot-a'),attendu:{note:/^Historique incomplet \(début de lot absent\)/,differes:'Différés restants connus : 2 (liste peut-être incomplète).'}},
 autrePartieDansESV:{state:state({current:{identity:id(0,{part:24})}}),history,attendu:{titre:'Résumé de la partie 23'}},
 sansLot:{state:state({batch:null,current:{identity:id(0,{part:24})}}),history,attendu:{titre:'Résumé de la partie 24',lots:'Lots de la partie (0)',differes:'Aucun différé restant.'}},
 lotEnCours:{state:state({batch:lot({state:'RUNNING',activeIdentity:id(4),processed:[{identity:id(1),cut:1},{identity:id(3),cut:3}]}),current:{identity:id(4)}}),history,
   attendu:{inconnu:/En cours maintenant : cut 4/}},
};

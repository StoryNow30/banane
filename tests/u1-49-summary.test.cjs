'use strict';
/* U1 — résumé de partie, module pur (src/part-summary-49.js).
 * Les 18 premiers essais sont ceux de la livraison U1 d'origine, corps
 * inchangés : seul l'adaptateur `sum` traduit l'ancien appel
 * `summarize({state,events,historyStatus})` vers les entrées explicites de la
 * réécriture (session, lot, identité ESV, événements). Les essais « G : »
 * couvrent les défauts relevés par la relecture et par la mission G. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const U=require('../src/part-summary-49.js');
const identity=(cut,extra={})=>({projectId:'projet',pageId:'page',frameId:'repere',shape:'U50',part:23,cut,...extra});
const ev=(type,cut,at,extra={})=>({eventId:type+'-'+at,timestamp:`2026-10-02T08:00:${String(at).padStart(2,'0')}.000Z`,type,identity:identity(cut),...extra});
const start=(id,cut,at,extra={})=>ev('batch-started',cut,at,{batch:{id,scope:{part:23,pageId:'page'},startedAt:`2026-10-02T08:00:${String(at).padStart(2,'0')}.000Z`},...extra});
const done=(id,cut,at)=>ev('validation-accepted',cut,at,{batchId:id,action:'VALIDATE'});
const defer=(id,cut,at,extra={})=>ev('defer-finalized',cut,at,{batchId:id,deferredConfirmed:true,status:'DEFERRED_UNRESOLVED',...extra});
const state=(extra={})=>({sessionId:'session',current:{identity:identity(4)},...extra});
/* Adaptateur d'interface (seule différence avec les essais d'origine). */
const sum=(events,{state:st=state(),historyStatus='available'}={})=>U.summarize({sessionId:st.sessionId,batch:st.batch??null,identity:st.current?.identity??null,
  events:[...events.map(U.projectEvent).filter(Boolean),...(st.events||[])],historyStatus});

test('plusieurs lots : une coupe reprise reste unique et sort des différés',()=>{
 const events=[start('a',1,0),done('a',1,1),defer('a',2,2),start('b',2,3),done('b',2,4)];
 const r=sum(events);assert.equal(r.lots.length,2);assert.equal(r.counts.distinct,2);assert.equal(r.counts.posed,2);assert.equal(r.counts.deferred,0);
 assert.deepEqual(r.deferredCuts,[]);assert.equal(r.lots[0].counts.deferred,1);
});
test('événements réémis et fenêtre des 150 événements : pas de double compte',()=>{
 const events=[start('a',1,0),done('a',1,1)];
 const r=sum([...events,...events],{state:state({events,batch:{id:'a',state:'STOPPED',scope:{part:23,pageId:'page'},activeIdentity:identity(1),processed:[{identity:identity(1),evidence:{startedAt:events[1].timestamp}}],deferred:[],skipped:[],manuallyCompleted:[]}})});
 assert.equal(r.lots.length,1);assert.equal(r.counts.distinct,1);assert.equal(r.counts.posed,1);
});
test('refus d’écartement et absence de points sont des sous-catégories des différés',()=>{
 const r=sum([start('a',1,0),defer('a',1,1,{rails:{left:{gcv1:{motif:'gauge-out-of-contract'}}}}),defer('a',2,2,{rails:{right:{gcv1:{motif:'input'}}}}),defer('a',3,3,{rails:{left:{gcv1:{motif:'flank'}}}})]);
 assert.equal(r.counts.deferred,3);assert.equal(r.counts.gaugeRejected,1);assert.equal(r.counts.noInput,1);assert.equal(r.counts.engineDeferred,1);
});
test('reprise manuelle déclarée et SKIP restent distincts des poses d’Ariane',()=>{
 const r=sum([start('a',1,0),defer('a',1,1),defer('a',2,2),start('b',1,3),ev('batch-manual-completion',1,4,{bananeValidated:false}),ev('explicit-skip-observation',2,5,{commandSent:true})]);
 assert.equal(r.counts.manual,1);assert.equal(r.counts.skipped,1);assert.equal(r.counts.posed,0);assert.equal(r.counts.deferred,0);
});
test('une nouvelle visite sans décision laisse une ancienne issue inconnue',()=>{
 const r=sum([start('a',1,0),defer('a',1,1),start('b',1,2),ev('before-captured',1,3)]);
 assert.equal(r.counts.unknown,1);assert.equal(r.counts.deferred,0);
});
test('deux projets et deux parties ne se mélangent jamais',()=>{
 const r=sum([start('a',1,0),done('a',1,1),start('b',1,2,{identity:identity(1,{projectId:'autre'})}),{...done('b',1,3),identity:identity(1,{projectId:'autre'})},start('c',1,4,{identity:identity(1,{part:24})}),{...done('c',1,5),identity:identity(1,{part:24})}]);
 assert.equal(r.counts.distinct,1);assert.equal(r.lots.length,1);
});
test('projet absent : limiter aux mêmes session, page et repère, sans fusion après F5',()=>{
 const events=[start('a',1,0),done('a',1,1),start('b',1,2),done('b',1,3)].map((e,i)=>({...e,identity:identity(1,{projectId:null,pageId:i<2?'page':'nouvelle-page'})}));
 const r=sum(events,{state:state({current:{identity:identity(2,{projectId:null})}})});
 assert.equal(r.counts.distinct,1);assert.equal(r.lots.length,1);assert.equal(r.partTotal,null);assert.equal(r.scope.projectId,null);
});
test('session déclarée différente : aucune fusion même à identité égale',()=>{
 const r=sum([start('a',1,0,{sessionId:'autre-session'}),{...done('a',1,1),sessionId:'autre-session'}]);
 assert.equal(r.counts.distinct,0);
});
test('ancien début sans sessionId : la session portée par son observation interdit la fusion',()=>{
 const r=sum([start('a',1,0),ev('gcv1-shadow-observed',1,1,{batchId:'a',sessionId:'autre-session'}),done('a',1,2)]);
 assert.equal(r.counts.distinct,0);assert.equal(r.lots.length,0);
});
test('lot courant sans identité active : les identités des résultats restent exploitables',()=>{
 const r=sum([],{historyStatus:'unavailable',state:state({batch:{id:'a',state:'STOPPED',processed:[{identity:identity(1)}]}})});
 assert.equal(r.counts.posed,1);
});
test('écriture historique manquante : résultat identifié conservé, complétude inconnue',()=>{
 const r=sum([done('a',1,1)]);
 assert.equal(r.counts.posed,1);assert.equal(r.historyComplete,false);
});
test('identité absente ou numérique nulle : inconnue, jamais coupe zéro inventée',()=>{
 const r=sum([start('a',1,0),{...done('a',1,1),identity:{part:23,cut:null}}]);
 assert.equal(r.counts.posed,0);assert.ok(r.identityUnknown>0);
 const empty=sum([],{state:state({current:{identity:null}})});assert.equal(empty.counts,null);
});
test('historique absent : nombres observés seulement, totaux inconnus',()=>{
 const r=sum([],{historyStatus:'unavailable',state:state({batch:{id:'a',state:'STOPPED',scope:{part:23,pageId:'page'},activeIdentity:identity(1),processed:[{identity:identity(1)}],deferred:[],skipped:[],manuallyCompleted:[]}})});
 assert.equal(r.counts.posed,1);assert.equal(r.historyComplete,false);assert.equal(r.partTotal,null);
});
test('lot en cours : la coupe active sans résultat est dite en cours',()=>{
 const r=sum([start('a',1,0),ev('before-captured',1,1)],{state:state({batch:{id:'a',state:'RUNNING',scope:{part:23,pageId:'page'},activeIdentity:identity(1),processed:[],deferred:[],skipped:[],manuallyCompleted:[]}})});
 assert.equal(r.counts.distinct,0);assert.equal(r.inProgress,1);assert.equal(r.counts.unknown,0);
});
test('revisite en cours : une coupe déjà traitée reste au total, avec issue inconnue',()=>{
 const r=sum([start('a',1,0),defer('a',1,1),start('b',1,2),ev('before-captured',1,3)],{state:state({batch:{id:'b',state:'RUNNING',scope:{part:23,pageId:'page'},activeIdentity:identity(1),processed:[],deferred:[],skipped:[],manuallyCompleted:[]}})});
 assert.equal(r.counts.distinct,1);assert.equal(r.inProgress,1);assert.equal(r.counts.unknown,1);assert.equal(r.lots[1].counts.distinct,0);
});
test('validation simplement observée ou pose appliquée : aucun crédit sans acceptation',()=>{
 const r=sum([start('a',1,0),ev('before-captured',1,1),ev('validation-observation',1,2,{commandSent:true}),ev('applied-verified',1,3)]);
 assert.equal(r.counts.posed,0);assert.equal(r.counts.unknown,1);
});
test('dernier différé sans commande reste inconnu, pas différé confirmé',()=>{
 const r=sum([start('a',1,0)],{state:state({batch:{id:'a',state:'STOPPED',scope:{part:23,pageId:'page'},activeIdentity:identity(1),processed:[],deferred:[],skipped:[],manuallyCompleted:[],interrupted:[{identity:identity(1),status:'DEFER_DERNIER_CUT_SANS_ENVOI'}]}})});
 assert.equal(r.counts.deferred,0);assert.equal(r.counts.unknown,1);
});
test('projection en lecture seule : ni nuages ni matrices ni mutation',()=>{
 const e=ev('gcv1-shadow-observed',1,1,{batchId:'a',shadow:{summary:{pairGaugeRejected:true},rails:{left:{next:{motif:'input'},frame:{points:[1,2,3]}}}},heavy:{points:[1,2,3]}}),before=JSON.stringify(e),p=U.projectEvent(e);
 assert.equal(JSON.stringify(e),before);assert.doesNotMatch(JSON.stringify(p),/"points"|"heavy"|"frame"/);
});

/* ---- Mission G : défauts relevés (essais rouges sur la livraison U1 d'origine) ---- */
const page=(cut,pageId,extra={})=>identity(cut,{projectId:null,pageId,...extra});
const lot=(id,extra={})=>({id,state:'STOPPED',scope:{part:23,pageId:'page'},startedAt:'2026-10-02T08:00:00.000Z',processed:[],deferred:[],skipped:[],manuallyCompleted:[],interrupted:[],...extra});
const at=(e,i)=>({...e,identity:i});

test('G : après un F5, la partie résumée est celle du lot, pas la page ESV rechargée',()=>{
 const events=[at(start('a',1,0),page(1,'page')),at(done('a',1,1),page(1,'page')),at(done('a',2,2),page(2,'page'))];
 const r=sum(events,{state:{sessionId:'session',current:{identity:page(8,'page-rechargee')},batch:lot('a',{activeIdentity:page(2,'page'),processed:[{identity:page(1,'page')},{identity:page(2,'page')}]})}});
 assert.equal(r.lots.length,1);assert.equal(r.counts.posed,2);assert.equal(r.scope.pageId,'page');
 assert.equal(r.scope.source,'lot');assert.equal(r.historyComplete,true);
});
test('G : fin de partie, ESV affiche la partie suivante : le résumé reste sur la partie du lot',()=>{
 const events=[at(start('a',1,0),page(1,'page')),at(done('a',1,1),page(1,'page')),at(defer('a',2,2),page(2,'page'))];
 const r=sum(events,{state:{sessionId:'session',current:{identity:page(0,'page',{part:24})},batch:lot('a',{activeIdentity:page(2,'page'),processed:[{identity:page(1,'page')}],deferred:[{identity:page(2,'page')}]})}});
 assert.equal(r.scope.part,23);assert.equal(r.counts.distinct,2);assert.deepEqual(r.deferredCuts,[2]);
});
test('G : lot repris après rechargement d’ESV : coupes d’avant et d’après comptées ensemble',()=>{
 const events=[at(start('a',1,0),page(1,'A')),at(done('a',1,1),page(1,'A')),at(done('a',2,2),page(2,'A')),
  {eventId:'rebase',type:'batch-rebased-after-reload',timestamp:'2026-10-02T08:00:03.000Z',identity:page(3,'B'),dePageId:'A',deFrameId:'repere'},
  at(done('a',3,4),page(3,'B')),at(ev('before-captured',4,5),page(4,'B'))];
 const r=sum(events,{state:{sessionId:'session',current:{identity:page(4,'B')},batch:lot('a',{activeIdentity:page(4,'B')})}});
 assert.equal(r.lots.length,1);assert.equal(r.counts.distinct,4);assert.equal(r.counts.posed,3);assert.deepEqual(r.unknownCuts,[4]);assert.equal(r.historyComplete,true);
});
test('G : lot courant absent d’un historique dit lu : comptes partiels, et son issue l’emporte',()=>{
 const r=sum([start('a',1,0),defer('a',1,1)],{state:state({batch:{id:'b',state:'STOPPED',processed:[{identity:identity(1)}]}})});
 assert.equal(r.counts.posed,1);assert.equal(r.counts.deferred,0);assert.deepEqual(r.deferredCuts,[]);
 assert.equal(r.missingStarts,1);assert.equal(r.historyComplete,false);
 const avecHeure=sum([start('a',1,0),defer('a',1,1)],{state:state({batch:{id:'b',state:'STOPPED',startedAt:'2026-10-02T08:00:05.000Z',processed:[{identity:identity(1)}]}})});
 assert.equal(avecHeure.historyComplete,false);assert.equal(avecHeure.counts.posed,1);
});
test('G : une identité incomplète dans le lot d’une autre partie ne rend pas ce résumé partiel',()=>{
 const r=sum([start('a',1,0),done('a',1,1),start('c',1,2,{identity:identity(1,{part:21})}),{...done('c',1,3),identity:{part:21,cut:null}}]);
 assert.equal(r.counts.posed,1);assert.equal(r.identityUnknown,0);assert.equal(r.historyComplete,true);
});
test('G : refus d’écartement lu sur l’observation du cut, comme l’outil d’analyse',()=>{
 const r=sum([start('a',1,0),ev('gcv1-shadow-observed',1,1,{batchId:'a',shadow:{summary:{pairGaugeRejected:true},rails:{left:{gcv1:{motif:'flank'}}}}}),defer('a',1,2,{rails:{left:{gcv1:{motif:'flank'}}}})]);
 assert.equal(r.counts.gaugeRejected,1);assert.equal(r.counts.engineDeferred,0);
});
test('G : même partie sur une page non rapprochée : non comptée, signalée, comptes partiels',()=>{
 const events=[at(start('a',1,0),page(1,'A')),at(done('a',1,1),page(1,'A'))];
 const r=sum(events,{state:{sessionId:'session',current:{identity:page(5,'B')}}});
 assert.equal(r.lots.length,0);assert.equal(r.historyComplete,false);assert.equal(r.otherPageLots,1);
});
test('G : export ancien : clé de coupe sans identité, listes récentes absentes',()=>{
 const journal={state:{sessionId:'session',current:{identity:identity(9)},batch:{id:'a',state:'STOPPED',scope:{part:23},processed:[{key:'page|23|5|U50|repere|projet'}],skipped:[]}},
  events:[start('a',5,0)]};
 const r=U.summarize(U.fromJournal(journal));
 assert.equal(r.counts.posed,1);assert.equal(r.counts.distinct,1);assert.equal(r.identityUnknown,0);assert.equal(r.historyComplete,true);
});
test('G : visite d’un lot écarté (autre session) jamais rattachée au lot précédent',()=>{
 const r=sum([start('a',1,0),done('a',1,1),start('x',9,2,{sessionId:'autre-session'}),ev('gcv1-shadow-observed',9,3,{batchId:'x',sessionId:'autre-session'}),ev('before-captured',9,4)]);
 assert.equal(r.counts.distinct,1);assert.deepEqual(r.unknownCuts,[]);assert.equal(r.excludedLots,1);
});

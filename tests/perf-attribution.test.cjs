'use strict';
/* V1, correction proposée (2) complète : D-073 « chaque seconde d'un cycle est
 * attribuée à une étape ou marquée non expliquée ». Attribué + non expliqué =
 * durée du cycle, sans double compte ; durée non calculable = « non mesuré »,
 * jamais zéro ; ordre impossible signalé et exclu des statistiques de signe ;
 * chronologie publiée par coupe (JSON et markdown) ; identités en dictionnaire. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const {measure,toMarkdown}=require('../tools/perf-phases.cjs'),{journal,id}=require('./helpers/perf-phases.cjs');
const ev=(j,p)=>j.events.find(e=>e.point===p);
const span=(j,label,fromMs,toMs,extra={})=>{const base=j.events.find(e=>e.kind==='visit');j.events.push({...base,eventId:'s'+Math.random(),kind:'span',point:undefined,label,fromMs,toMs,ms:toMs,...extra});return j;};
const attr=j=>measure(j).visits[0].attribution;
const ok=a=>assert.ok(Math.abs(a.attributedMs+a.unexplainedMs-a.cycleMs)<1e-9&&a.reconciled,'attribué + non expliqué = cycle');

test('cycle ordinaire : le trou entre pose lue et lecture après pose est « non expliqué », rien n’est compté deux fois',()=>{
 const a=attr(journal());ok(a);
 assert.deepEqual([a.status,a.outcome,a.cycleMs,a.attributedMs,a.unexplainedMs],['mesurée','validée',1600,1550,50]);
 assert.deepEqual(a.gaps.map(g=>[g.fromMs,g.toMs,g.after,g.before]),[[1000,1050,'pose-readback','début after-state-read']]);
 assert.equal(a.ownedMs.pose,650);assert.equal(a.ownedMs.validation,400);assert.equal(a.ownedMs['cut-suivant'],100);assert.equal(a.beyondCycleMs,0);
});
test('navigation suivante avant l’acceptation : le temps de validation au-delà du cycle est publié à part, pas ajouté',()=>{
 const j=journal();ev(j,'next-observed').ms=1400;const a=attr(j);ok(a);
 assert.deepEqual([a.cycleMs,a.attributedMs,a.unexplainedMs,a.beyondCycleMs],[1400,1350,50,100]);
 assert.equal(a.ownedMs.validation,300);assert.equal(a.ownedMs['cut-suivant'],0);
});
test('un span annexe réduit le trou ; sinon le trou reste déclaré',()=>{
 const a=attr(span(journal(),'command:state',1000,1050));ok(a);
 assert.deepEqual([a.unexplainedMs,a.ownedMs.annexes],[0,50]);assert.ok(a.annexLabels.includes('command:state'));
 const b=attr(span(journal(),'command:state',1010,1030));ok(b);assert.equal(b.unexplainedMs,30);assert.equal(b.gaps.length,2);
 const c=attr(span(journal(),'command:state',1e9,1e9+5));ok(c);assert.equal(c.unexplainedMs,50,'span hors cycle : sans effet');
 const d=attr(span(journal(),'command:state',1000,Infinity));assert.equal(d.unexplainedMs,50,'span invalide : ignoré');
});
test('étapes qui se chevauchent : temps commun compté une fois',()=>{
 const j=journal();j.events.find(e=>e.label==='after-state-read').fromMs=900;const a=attr(j);ok(a);
 assert.deepEqual([a.unexplainedMs,a.phaseOverlapMs,a.ownedMs.pose,a.ownedMs['capture-apres-pose']],[0,100,650,100]);
});
test('jalon absent : durée non mesurée, jamais zéro ; reste honnête',()=>{
 let j=journal();j.events=j.events.filter(e=>e.point!=='next-observed');let a=attr(j);
 assert.deepEqual([a.status,a.reason,a.cycleMs,a.attributedMs,a.unexplainedMs],['non mesuré','navigation-suivante-absente',null,null,null]);
 j=journal();j.events=j.events.filter(e=>e.point!=='accepted');a=attr(j);ok(a);
 assert.deepEqual([a.cycleMs,a.unexplainedMs],[1600,550],'validation et fin non expliquées');
 j=journal();j.events.find(e=>e.kind==='visit').navigationMs=null;a=attr(j);assert.deepEqual([a.status,a.reason,a.cycleMs,a.unexplainedMs],['non mesuré','navigation-absente',null,null]);
 const m=measure(j);assert.equal(m.attribution.measuredCycles,0);assert.equal(m.attribution.notMeasured,1);
 assert.match(toMarkdown(m),/Non mesurés \(cycle inconnu ou contexte invalide\) : 1/);
});
test('reportée sans pose : décision → navigation suivante, trou nommé',()=>{
 const j=journal();j.events=j.events.filter(e=>!['pose-readback','after-read','accepted'].includes(e.point)&&e.label!=='after-state-read');
 j.events.push({...j.events.find(e=>e.kind==='visit'),eventId:'d',kind:'point',point:'deferred',ms:360});
 const a=attr(j);ok(a);assert.deepEqual([a.outcome,a.cycleMs,a.unexplainedMs,a.gaps[0].after,a.gaps[0].before],['reportée sans pose',1600,1250,'decision','next-observed']);
 assert.equal(measure(j).attribution.byOutcome['reportée sans pose'].cycles,1);
});
test('ordre impossible : anomalie publiée, exclu des statistiques de signe et du temps attribué',()=>{
 for(const [nom,mut] of [['acceptation avant lecture après pose',j=>{ev(j,'accepted').ms=900;}],['navigation suivante avant lecture après pose',j=>{ev(j,'next-observed').ms=1050;}],
  ['horloge non monotone : suivante avant navigation',j=>{ev(j,'next-observed').ms=-50;}],['capture avant navigation',j=>{ev(j,'capture-received').ms=-5;}]]){
  const j=journal();mut(j);const m=measure(j),v=m.visits[0];
  assert.equal(v.chronology.coherent,false,nom);assert.ok(v.chronology.anomalies.length,nom);assert.equal(v.attribution.status,'ordre impossible',nom);
  assert.equal(v.attribution.unexplainedMs,null,nom);assert.equal(m.concurrence.visits,0,nom);assert.equal(m.concurrence.signedDeltaMs.n,0,nom);assert.equal(m.concurrence.anomalies.visits,1,nom);
  assert.equal(m.attribution.measuredCycles,0,nom);assert.equal(m.attribution.impossibleOrder,1,nom);
  assert.match(toMarkdown(m),/Anomalies d’ordre/,nom);assert.equal(m.coupes[0].status,'ordre impossible',nom);}
 // Les deux ordres permis entre acceptation et navigation suivante ne sont pas des anomalies.
 for(const next of [1400,1600]){const j=journal();ev(j,'next-observed').ms=next;assert.equal(measure(j).visits[0].chronology.coherent,true);}
 // Égalité permise.
 const j=journal();ev(j,'next-observed').ms=1500;const a=attr(j);ok(a);assert.equal(measure(j).concurrence.signedDeltaMs.median,0);
});
test('horloge atMs et valeurs extrêmes : réconciliation conservée',()=>{
 const j=journal();ev(j,'accepted').atMs=1450;ev(j,'next-observed').atMs=1440;const a=attr(j);ok(a);assert.equal(a.cycleMs,1440);
 const g=journal();for(const e of g.events)if(Number.isFinite(e.ms)&&e.kind!=='batch'&&e.kind!=='health'){e.ms+=1e12;for(const k of ['fromMs','toMs','navigationMs'])if(Number.isFinite(e[k]))e[k]+=1e12;}
 const b=attr(g);ok(b);assert.deepEqual([b.cycleMs,b.unexplainedMs],[1600,50]);
});
test('contexte invalide (deux ouvertures de visite) : non mesuré, jamais zéro',()=>{
 const j=journal();j.events.push({...j.events.find(e=>e.kind==='visit'),eventId:'o2'});const m=measure(j),a=m.visits[0].attribution;
 assert.deepEqual([a.status,a.cycleMs,a.unexplainedMs],['non mesuré',null,null]);assert.equal(m.visits[0].chronology,null);assert.equal(m.coupes[0].milestones,null);
 assert.match(toMarkdown(m),/\| non mesuré \| non mesuré \|/);
});
test('lot rouvert ou en ERREUR : la coupe garde son attribution et porte la marque d’exécution',()=>{
 const j=journal();j.events.find(e=>e.kind==='visit').lotSuspended=true;const m=measure(j);
 assert.equal(m.visits[0].attribution.status,'mesurée');assert.equal(m.coupes[0].execution,'lot-suspended');assert.match(toMarkdown(m),/validée \(lot-suspended\)/);
});
test('plusieurs lots : totaux additifs, tableau par coupe filtrable par lot',()=>{
 const a=journal(),b=journal();for(const e of b.events){e.batchId='B2';e.visitId=e.visitId&&'visit2';e.identity=e.identity&&id(200);}b.state.batch.id='B2';
 ev(b,'next-observed').ms=1400;
 const m=measure({events:[...a.events,...b.events],state:{sessionId:'S',batch:{id:'B'}}},{tous:true});
 assert.equal(m.lots.length,2);assert.equal(m.attribution.measuredCycles,2);
 assert.equal(m.attribution.cycleMs,m.lots[0].attribution.cycleMs+m.lots[1].attribution.cycleMs);assert.equal(m.attribution.unexplainedMs,100);assert.equal(m.attribution.notReconciled,0);
 assert.equal(m.coupes.length,2);const md=toMarkdown(m,{batchId:'B2'});assert.match(md,/Lot B2/);assert.doesNotMatch(md.split('Chronologie par coupe')[1],/\| 100 \|/);
 assert.match(toMarkdown(m),/Chronologie par coupe/);assert.doesNotMatch(toMarkdown(m,{coupes:false}),/Chronologie par coupe/);
});
test('chronologie par coupe : jalons triés, étapes, chevauchement, non expliqué, en JSON et en markdown',()=>{
 const j=journal();ev(j,'next-observed').ms=1400;const m=measure(j),r=m.coupes[0];
 assert.deepEqual(r.milestones.map(x=>x.point),['navigation','capture-received','proposed','decision','pose-readback','after-read','next-observed','accepted']);
 assert.equal(r.cut,100);assert.equal(r.unexplainedMs,50);assert.equal(r.overlap.nextMinusAcceptedMs,-100);assert.equal(r.overlap.beyondCycleMs,100);assert.equal(r.phaseMs['navigation-capture'],100);
 const md=toMarkdown(m);assert.match(md,/\| 23 \| 100 \| validée \| 1400 \| navigation 0, capture-received 100/);assert.match(md,/Temps attribué \(D-073/);
 assert.match(md,/non expliqué 50,0 ms|non expliqué 0,1 s/);
});
test('identités en dictionnaire {"__ref"} d’un bilan v4 : développées ; référence introuvable : signalée, contexte invalide',()=>{
 const j=journal(),ident=j.events[1].identity;
 const withRef=(i)=>({...j,dictionaries:{identities:[ident]},events:j.events.map(e=>e.identity?{...e,identity:{__ref:i}}:e)});
 const m=measure(withRef('identities:0'));assert.equal(m.refs.unresolved,0);assert.ok(m.refs.resolved>0);assert.equal(m.visits[0].validContext,true);assert.equal(m.visits[0].attribution.unexplainedMs,50);
 const bad=measure(withRef('identities:9'));assert.ok(bad.refs.unresolved>0);assert.equal(bad.visits[0].validContext,false);assert.equal(bad.visits[0].attribution.status,'non mesuré');
 assert.match(toMarkdown(bad),/non résolues/);
});

'use strict';
/* S7 (4.9.5.3) — repli des jalons `phase-timing` par visite à l'export, et lecture des DEUX formats par les outils.
 * Fixture : journal « ancien format » fabriqué (tests/helpers/journal-ancien-pli.cjs). Preuve demandée : sur un export ancien rejoué, les
 * chiffres de tools/perf-phases.cjs et de tools/perf-v3.cjs sont les mêmes avec le format ancien et le format replié. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const P=require('../src/phase-pli.js'),V1=require('../tools/perf-phases.cjs'),V3=require('../tools/perf-v3.cjs'),{journalAncien}=require('./helpers/journal-ancien-pli.cjs');
const octets=x=>Buffer.byteLength(JSON.stringify(x));
const sansPerdues=e=>{const o={...e};delete o.eventId;delete o.timestamp;return o;};
const canon=v=>Array.isArray(v)?v.map(canon):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().filter(k=>v[k]!==undefined).map(k=>[k,canon(v[k])])):v;
const cle=e=>`${e.clockId}|${String(e.seq).padStart(9,'0')}`;

test('repli : un événement par visite, formes rangées une fois, les autres événements intacts', () => {
 const j=journalAncien(),anc=j.events.filter(e=>e.type==='phase-timing'),r=P.plier(j.events);
 const pli=r.events.filter(e=>e.type===P.TYPE),formes=r.events.filter(e=>e.type===P.TYPE_FORMES);
 assert.equal(pli.length,12,'une visite, un événement');assert.equal(formes.length,1);
 assert.equal(r.events.filter(e=>e.type==='phase-timing').length,2+1,'lot (début, fin) et santé restent tels quels (pas de visite)');
 assert.equal(r.events.filter(e=>e.type==='batch-started').length,1);assert.equal(r.events.filter(e=>e.type==='esv-observation').length,1);
 assert.equal(r.bilan.jalonsLaisses,0);assert.equal(r.bilan.jalonsPlies,anc.filter(e=>e.visitId).length);
 for(const g of pli){assert.equal(g.rows.length,g.n);assert.ok(g.r.k.visit===1&&g.r.s['command:capture'][0]===1,'résumé de visite : comptes, durées par étape');assert.ok('open' in g.r.j&&'accepted' in g.r.j||'deferred' in g.r.j);}
 assert.equal(j.events.length,anc.length+2,'l\'entrée n\'est pas modifiée');
});

test('repli puis dépliage : chaque jalon d\'origine est rendu à l\'identique (hors eventId et timestamp)', () => {
 const j=journalAncien(),anc=j.events.filter(e=>e.type==='phase-timing'&&e.visitId).sort((a,b)=>cle(a)<cle(b)?-1:1);
 const retour=P.deplier(P.plier(j.events).events).filter(e=>e.type==='phase-timing'&&e.visitId).sort((a,b)=>cle(a)<cle(b)?-1:1);
 assert.equal(retour.length,anc.length);
 for(let i=0;i<anc.length;i++){assert.deepEqual(canon(sansPerdues(retour[i])),canon(sansPerdues(anc[i])),'jalon '+anc[i].seq);
  assert.equal(retour[i].eventId.length,36,'identifiant restitué de la longueur d\'origine');assert.ok(Math.abs(Date.parse(retour[i].timestamp)-Date.parse(anc[i].timestamp))<=5,'heure recalculée à quelques ms');}
 const ids=new Set(retour.map(e=>e.eventId));assert.equal(ids.size,retour.length,'identifiants restitués distincts');
 assert.equal(P.deplier(j.events),j.events,'ancien format : rendu tel quel');
});

test('le jalon qui porte son propre selector le garde seul : le contexte de la suite n\'en hérite pas', () => {
 const j=journalAncien(),r=P.deplier(P.plier(j.events).events).filter(e=>e.visitId);
 const decisions=r.filter(e=>e.point==='decision'),suivants=r.filter(e=>e.point==='proposed');
 assert.ok(decisions.length&&decisions.every(e=>e.selector==='moteur'&&e.selectedEngine==='geometry-candidate-v1'));
 assert.ok(suivants.every(e=>e.selector==='active-pilot-test'));
 assert.ok(r.filter(e=>e.kind==='span'&&e.label==='observe-lot').every(e=>e.selector==='active-pilot-test'));
});

test('mêmes chiffres : tools/perf-phases.cjs lit l\'ancien format et le format replié', () => {
 const j=journalAncien(),pl={...j,events:P.plier(j.events).events};
 assert.ok(P.estPlie(pl.events)&&!P.estPlie(j.events));
 const a=V1.measure(j),b=V1.measure(pl);
 assert.equal(a.available,true);assert.ok(a.visits.length===12&&a.cohort.n>0,'la fixture est mesurable');
 assert.deepEqual(b,a,'bilan V1 identique, ancien et replié');
 assert.equal(V1.toMarkdown(b),V1.toMarkdown(a));
});

test('mêmes chiffres : tools/perf-v3.cjs lit l\'ancien format et le format replié', () => {
 const j=journalAncien(),pl={...j,events:P.plier(j.events).events};
 const a=V3.comparer(j),b=V3.comparer(pl);
 assert.deepEqual(b,a);assert.equal(V3.toMarkdown(b),V3.toMarkdown(a));
});

test('l\'ordre de la base ne change pas le bilan (ordre canonique par horloge et numéro d\'ordre)', () => {
 const j=journalAncien(),renverse={...j,events:j.events.slice().reverse()};
 assert.deepEqual(V1.measure(renverse),V1.measure(j));
});

test('gain : les jalons repliés pèsent moins de 25 % de l\'ancien volume (fixture ; mesuré sur un vrai lot : 16 %)', () => {
 const j=journalAncien({visites:40}),r=P.plier(j.events);
 const avant=octets(j.events.filter(e=>e.type==='phase-timing')),apres=octets(r.events.filter(e=>e.type===P.TYPE||e.type===P.TYPE_FORMES||e.type==='phase-timing'));
 assert.ok(apres<0.25*avant,`${apres} octets contre ${avant}`);
 /* Journal où les jalons font 42 % du volume, la proportion mesurée sur un vrai lot (20,6 Mo sur 48,6 Mo) : le journal perd plus du tiers. */
 const autres={type:'adapter-progress',blob:'x'.repeat(Math.round(avant*(48.6/20.6-1)))};const total=octets([...j.events,autres]),replie=octets([...r.events,autres]);
 assert.ok(replie<=0.7*total,`journal : ${replie} contre ${total}`);
});

test('garde-fous : valeur réservée ou clé manquante, le groupe n\'est PAS replié et reste lisible tel quel', () => {
 const j=journalAncien({visites:4}),visite=j.events.find(e=>e.kind==='visit').visitId;
 const reserve=j.events.find(e=>e.visitId===visite&&e.point==='proposed');reserve.note='§1';
 const manque=j.events.find(e=>e.visitId!==visite&&e.visitId&&e.point==='proposed');delete manque.selector;
 const r=P.plier(j.events);
 assert.equal(r.events.filter(e=>e.type===P.TYPE).length,3,'trois visites sur quatre repliées : celle à valeur réservée reste telle quelle');assert.ok(r.bilan.jalonsLaisses>0);
 assert.ok(r.events.some(e=>e.type==='phase-timing'&&e.point==='proposed'&&e.visitId===visite),'jalons de la visite refusée gardés en clair');
 assert.equal(V1.measure({...j,events:r.events}).visits.length,V1.measure(j).visits.length);
 assert.deepEqual(P.deplier(r.events).filter(e=>e.visitId).map(e=>e.seq).sort((a,b)=>a-b),j.events.filter(e=>e.type==='phase-timing'&&e.visitId).map(e=>e.seq).sort((a,b)=>a-b));
});

test('l\'export du journal replie par défaut (réglage export.phaseTimingReplie) et le dit dans l\'en-tête', () => {
 const S=require('../src/settings.js');assert.equal(S.export.phaseTimingReplie,true);
 const src=require('node:fs').readFileSync(require('node:path').join(__dirname,'..','panel.js'),'utf8');
 assert.match(src,/eventsExport\(lu\.meta,lu\.events\)/);assert.match(src,/phaseTimingPli:r\.bilan/);
 assert.match(require('node:fs').readFileSync(require('node:path').join(__dirname,'..','panel.html'),'utf8'),/src\/phase-pli\.js/);
 
});

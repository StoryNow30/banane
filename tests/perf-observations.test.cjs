'use strict';
/* V1 (test 2) : lecture hors ligne des observations passives (tools/perf-phases).
 * Elles n'entrent ni dans les phases, ni dans la couverture, ni dans la cohorte :
 * une écriture observée (statut HTTP) est un acquittement de requête, pas une
 * preuve de relecture ni de qualité. Données synthétiques. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const {measure,toMarkdown}=require('../tools/perf-phases.cjs'),{journal,id}=require('./helpers/perf-phases.cjs');
const obs=(kind,o={})=>({type:'esv-observation',schema:1,eventId:JSON.stringify([kind,o]),kind,timeOrigin:1000,ms:1600,sessionId:'S',batchId:'B',observer:{id:'obs-1',seq:1},...o});
const write=(o={})=>obs('write',{status:204,outcome:'done',attempt:1,railPairId:'traj__00+1/2',bodyKeys:12,body:{a:1,b:2,c:3,d:4,e:5,f:6,RailType:'U50',SeenByOperator:true},startedEpochMs:1000+1450,endedEpochMs:1000+1600,durationMs:150,...o});
/* Journal de base : visite « visit » ouverte à 0 ms, acceptée à 1 500 ms ; une 2e visite ouverte à 2 000 ms. */
function withVisits(){const j=journal(),v=j.events.find(e=>e.kind==='visit'),ctx2={...v,visitId:'visit2',identity:id(101),eventId:'v2open',ms:2000,navigationMs:2000,batchSeq:50,seq:50};j.events.push(ctx2);return j;}
const strip=m=>{const {observations,...rest}=m;return rest;};

test('sans observation : « non mesuré », et le reste de la mesure est identique',()=>{
 const j=journal(),m=measure(j);assert.equal(m.observations.available,false);assert.match(m.observations.reason,/non mesuré/i);
 assert.match(toMarkdown(m),/## Observateur passif \(journalisation seule\)\n\nAucune observation passive/,'dit « non mesuré » au lieu de se taire : signal d’un observateur absent ou coupé');assert.doesNotMatch(toMarkdown(m),/Observations : \d+ écriture/);
 assert.equal(measure({events:[]}).observations.available,false);
});
test('écritures : statut, tentative, durée, champs numériques, liaison à la visite par fenêtre de temps, décalage à l’acceptation signé',()=>{
 const j=withVisits();j.events.push(write(),write({railPairId:'traj__00+2/3',startedEpochMs:1000+2450,endedEpochMs:1000+2600,eventId:'w2',attempt:2,status:503,body:{x:1}}),write({eventId:'w3',startedEpochMs:500,endedEpochMs:600,railPairId:'avant'}));
 const o=measure(j,{tous:true}).observations,r=o.writes.rows;
 assert.deepEqual([o.available,o.writes.n,o.writes.ok,o.writes.failed,o.writes.attemptsMax,o.writes.linked],[true,3,2,1,2,2]);assert.deepEqual(o.writes.byStatus,{204:2,503:1});
 assert.deepEqual([r[0].link,r[0].visitId,r[0].numericFields,r[0].bodyKeys,r[0].durationMs],['time-window','visit',6,12,150]);
 assert.equal(r[0].writeEndMinusAcceptedMs,100,'écriture terminée 100 ms après l’acceptation locale (époques)');
 assert.deepEqual([r[1].visitId,r[1].status,r[1].attempt],['visit2',503,2]);assert.equal(r[1].writeEndMinusAcceptedMs,null,'visite 2 sans acceptation : non mesuré, jamais zéro');
 assert.deepEqual([r[2].link,r[2].linkReason],[null,'no-window'],'avant toute visite : non reliée');
 const pv=Object.fromEntries(o.perVisit.map(v=>[v.visitId,v]));assert.deepEqual([pv.visit.serverWrite.observed,pv.visit.serverWrite.status,pv.visit2.serverWrite.status],[true,204,503]);
});
test('rien d’existant ne bouge : phases, couverture, cohorte, instrumentation identiques avec ou sans observations',()=>{
 const a=withVisits(),b=JSON.parse(JSON.stringify(a));b.events.push(write(),obs('list-page',{status:200,rows:3,counts:{valid:1,invalid:1,skipped:1},startedEpochMs:1,endedEpochMs:2}),obs('resource',{n:2,bytes:10,startedEpochMs:1100,endedEpochMs:1200}),obs('gap',{lost:2,reason:'ring-overflow'}));
 assert.deepEqual(strip(measure(b,{tous:true})),strip(measure(a,{tous:true})));
 assert.equal(measure(b).lots[0].instrumentation.eventCount,measure(a).lots[0].instrumentation.eventCount,'ces événements ne sont pas des jalons V1');
 assert.equal(measure(b).lots[0].coverage.complete,measure(a).lots[0].coverage.complete);
});
test('liste des coupes par chargement : lignes et comptes sommés par page ; un compte absent = non mesuré',()=>{
 const j=journal(),page=(o={})=>obs('list-page',{status:200,rows:1000,counts:{valid:900,invalid:60,skipped:40},startedEpochMs:10,endedEpochMs:20,...o});
 j.events.push(page({eventId:'p1',observer:{id:'A',seq:1}}),page({eventId:'p2',rows:269,counts:{valid:250,invalid:10,skipped:9},startedEpochMs:30,endedEpochMs:50,observer:{id:'A',seq:2}}),page({eventId:'p3',observer:{id:'B',seq:1},counts:null}));
 const l=measure(j,{tous:true}).observations.listPages;assert.equal(l.pages,3);
 const A=l.loads.find(x=>x.observer==='A'),B=l.loads.find(x=>x.observer==='B');
 assert.deepEqual([A.pages,A.rows,A.counts,A.firstEpochMs,A.lastEpochMs],[2,1269,{valid:1150,invalid:70,skipped:49},10,50]);assert.deepEqual([B.rows,B.counts],[1000,null]);
});
test('fichiers de points : fenêtres, nombre et octets, rattachés à la visite ; pertes dites par raison',()=>{
 const j=withVisits();j.events.push(obs('resource',{n:19,bytes:1500000,startedEpochMs:1000+100,endedEpochMs:1000+900}),obs('resource',{eventId:'r2',n:3,bytes:300,startedEpochMs:1000+2100,endedEpochMs:1000+2200}),
  obs('gap',{lost:5,reason:'ring-overflow'}),obs('gap',{eventId:'g2',lost:2,reason:'bridge-queue'}),obs('gap',{eventId:'g3',lost:1,reason:'ring-overflow'}));
 const o=measure(j,{tous:true}).observations,pv=Object.fromEntries(o.perVisit.map(v=>[v.visitId,v.resources]));
 assert.deepEqual([o.resources.windows,o.resources.n,o.resources.bytes,o.resources.firstStartMs,o.resources.lastEndMs],[2,22,1500300,1100,3200]);
 assert.deepEqual([pv.visit,pv.visit2],[{windows:1,n:19,bytes:1500000},{windows:1,n:3,bytes:300}]);assert.deepEqual([o.gaps.count,o.gaps.lost,o.gaps.byReason],[3,8,{'ring-overflow':6,'bridge-queue':2}]);
});
test('doublons écartés ; autre schéma, autre type ou autre genre ignorés',()=>{
 const j=journal(),w=write();j.events.push(w,{...w},{...w,schema:2,eventId:'s2'},{...w,type:'autre',eventId:'t2'},{...w,kind:'inconnu',eventId:'k2'});
 assert.equal(measure(j,{tous:true}).observations.writes.n,1);
});
test('Markdown : section dédiée, acquittement HTTP dit pour ce qu’il est, aucune « confirmation serveur » affirmée',()=>{
 const j=withVisits();j.events.push(write(),obs('gap',{lost:4,reason:'ring-overflow'}));const md=toMarkdown(measure(j,{tous:true}));
 assert.match(md,/## Observateur passif \(journalisation seule\)/);assert.match(md,/acquittement de la requête de la page, ni qualité de pose ni relecture/);
 assert.match(md,/\| traj__00\+1\/2 \| 204 \| 1 \| 150 \| 6 \| visit \| 100 \|/);assert.match(md,/4 observation\(s\) perdue\(s\)/);assert.match(md,/écart d’horloge entre processus non corrigé/);
 assert.doesNotMatch(md,/confirmé(e)? par le serveur/i);assert.match(md,/sauf l’acquittement HTTP observé/);
 assert.doesNotMatch(toMarkdown(measure(journal())),/sauf l’acquittement HTTP/);
});
test('observations sans aucun jalon V1 : V1 non mesuré, observations quand même publiées',()=>{
 const m=measure({events:[write()]},{tous:true});assert.equal(m.available,false);assert.equal(m.observations.writes.n,1);assert.equal(m.observations.writes.rows[0].link,null);
 const md=toMarkdown(m);assert.match(md,/Mesures V1 non mesurées/);assert.match(md,/Observateur passif/);
});
test('filet fetch : compté dans le bilan, dit pour ce qu’il est (écritures par fetch non vues) ; 0 dit aussi',()=>{
 const j=journal();j.events.push(obs('fetch-rails',{n:2,startedEpochMs:1100,endedEpochMs:1140,windowMs:250}),obs('fetch-rails',{eventId:'f2',n:3,startedEpochMs:1500,endedEpochMs:1600,windowMs:250}));
 const o=measure(j,{tous:true}).observations;assert.deepEqual([o.available,o.counts['fetch-rails'],o.fetchRails],[true,2,{windows:2,n:5}]);
 const md=toMarkdown(measure(j,{tous:true}));assert.match(md,/Requêtes fetch sur les chemins rails : 5 sur 2 fenêtre\(s\)/);assert.match(md,/non observées : l’observateur n’enveloppe pas fetch/);
 const k=journal();k.events.push(write());assert.deepEqual(measure(k,{tous:true}).observations.fetchRails,{windows:0,n:0});assert.match(toMarkdown(measure(k,{tous:true})),/Requêtes fetch sur les chemins rails : 0/);
});
test('marque de l’observateur (M6) : « aucune écriture » distinct de « observateur absent » ; installé avant les scripts oui/non/inconnu',()=>{
 const j=journal(),a=measure(j).observations;assert.equal(a.available,false);assert.match(a.reason,/observateur absent/i);assert.match(toMarkdown(measure(j)),/observateur absent/i);
 const mark=(o={})=>obs('observer',{version:1,world:'MAIN',installedBeforePageScripts:true,readyState:'loading',scriptsAtInstall:0,enabled:true,afterDenial:false,dropped:0,ignored:3,...o});
 j.events.push(mark());let o=measure(j).observations;
 assert.deepEqual([o.available,o.writes.n,o.observer.present,o.observer.marks,o.observer.version,o.observer.installedBeforePageScripts],[true,0,true,1,1,true]);
 let md=toMarkdown(measure(j));assert.match(md,/Observateur : présent \(version 1, installé avant les scripts de la page : oui\)/);assert.match(md,/Écritures : 0/);assert.doesNotMatch(md,/observateur absent/i);
 j.events.push(mark({eventId:'m2',installedBeforePageScripts:false,readyState:'complete',scriptsAtInstall:9}));o=measure(j).observations;assert.deepEqual([o.observer.marks,o.observer.installedBeforePageScripts,o.observer.late],[2,false,true]);
 assert.match(toMarkdown(measure(j)),/installé avant les scripts de la page : non \(au moins une marque tardive\)/);
 const k=journal();k.events.push(mark({installedBeforePageScripts:null,readyState:null,scriptsAtInstall:null}));assert.match(toMarkdown(measure(k)),/installé avant les scripts de la page : inconnu/);
});
test('résumé des listes avant la séance : par chargement et par clé, dernier résumé gardé, comptes seulement',()=>{
 const j=journal(),sum=(o={})=>obs('list-summary',{listKey:'p-key',pages:11,okPages:11,rows:10269,chars:12450000,counts:{valid:10154,invalid:115,skipped:0},firstStartedEpochMs:1000,lastEndedEpochMs:15000,durationMs:14000,beforeSession:true,observer:{id:'A',seq:7},receivedMs:1700,...o});
 j.events.push(sum(),sum({eventId:'s2',receivedMs:1800,pages:11,rows:10269}),sum({eventId:'s3',observer:{id:'B',seq:2},listKey:'q',pages:1,rows:null,counts:null,beforeSession:false}));
 const o=measure(j,{tous:true}).observations,s=o.listPages.summaries;
 assert.equal(o.counts['list-summary'],3);assert.deepEqual(s.map(x=>[x.observer,x.listKey,x.pages,x.rows,x.beforeSession]),[['A','p-key',11,10269,true],['B','q',1,null,false]],'doublon écarté (dernier reçu gardé)');
 assert.deepEqual([s[0].counts,s[0].durationMs,s[0].chars],[{valid:10154,invalid:115,skipped:0},14000,12450000]);
 const md=toMarkdown(measure(j,{tous:true}));assert.match(md,/Résumé des listes de coupes \(comptes seulement\) — chargement A, clé p-key, observé avant la séance : 11 page\(s\), 10269 ligne\(s\), valeurs de statut \{"valid":10154,"invalid":115,"skipped":0\}, 12450000 caractères, 14000 ms/);
 assert.match(md,/chargement B, clé q, vu pendant la séance : 1 page\(s\), non mesuré ligne\(s\), comptes non mesurés/);assert.doesNotMatch(md,/secret/);
});

/* BANC D'ÉVALUATION DU PLACEMENT — §5.2 du cahier 4.8.
 *
 * Le banc est le point de passage obligé de toute revendication chiffrée de la
 * 4.8. S'il se trompe, tout ce qui s'appuiera sur lui se trompera sans qu'on le
 * voie. Ces essais fixent donc ses règles de comptage, pas seulement son
 * fonctionnement.
 *
 * Deux d'entre eux encodent une règle du cahier plutôt qu'un comportement :
 * une régression d'interception ANNULE un gain de couverture (C3 prime sur C1),
 * et la couverture n'est jamais rendue seule.
 */
const {test}=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');
const Bench=require('../tools/bench-placement.cjs');

const ROOT=path.resolve(__dirname,'..');
const base=()=>Bench.scoreRun(Bench.fixtureRun(ROOT));

test('le banc retrouve la ligne de base 4.7 du lot terrain, sans la lire nulle part',()=>{
 const card=base();
 /* Ces nombres sont recalculés depuis les poses et les deltas de la fixture.
  * Ils doivent coïncider avec ceux que le cahier annonce — sinon l'un des deux
  * ment, et c'est une information en soi. */
 assert.equal(card.cuts,74);
 assert.equal(card.C1.treated,46);
 assert.equal(card.C1.coverage,0.6216);
 assert.equal(card.deferred.total,28);
 assert.equal(card.deferred.abstention,18,'18 cuts différés pour abstention GCV1');
 assert.equal(card.deferred.gauge,10,'10 cuts différés par le garde d’écartement');
 assert.equal(card.abstainedRails.left,16,'16 rails gauches abstenus');
 assert.equal(card.abstainedRails.right,3,'3 rails droits abstenus');
 assert.equal(card.C3.outOfContractRefused,10);
 assert.equal(card.C3.outOfContractApplied,0,'aucune paire hors contrat appliquée');
});

test('mêmes entrées, mêmes octets : la carte de score ne dépend pas de l’exécution',()=>{
 const a=JSON.stringify(base()),b=JSON.stringify(base());
 assert.equal(a,b,'deux notations du même jeu doivent être identiques');
 assert.ok(!/\d{4}-\d{2}-\d{2}T/.test(a),'aucun horodatage dans la carte de score');
});

test('la couverture n’est jamais rendue seule : C3 et les abstentions l’accompagnent toujours',()=>{
 const texte=Bench.render(base(),null);
 assert.match(texte,/C1\s+couverture/);
 assert.match(texte,/C3\s+interceptions/,'C3 doit figurer dans le même rendu que C1');
 assert.match(texte,/différés/,'le décompte des différés doit accompagner la couverture');
 assert.match(texte,/rails abstenus/);
});

test('sans correction humaine, C2 est déclaré non mesurable et non fabriqué',()=>{
 const card=base();
 assert.equal(card.C2.measurable,false);
 assert.equal(card.C2.errorByRail,null,'aucune distribution inventée');
 assert.match(card.C2.note,/non mesurable/);
});

test('le plancher de reproductibilité humaine est rappelé, mesuré ou non',()=>{
 /* Un cut avec référence, pour rendre C2 mesurable. */
 const run={id:'avec-reference',cuts:[{part:1,cut:1,
   before:refPair().before,statuses:{left:'candidate',right:'candidate'},
   deltas:{left:[0,0,0],right:[0,0,0]},reference:{left:[0,.001,0],right:[0,0,.001]}}]};
 const sans=Bench.render(Bench.scoreRun(run),null);
 assert.match(sans,/plancher de reproductibilité humaine : NON MESURÉ \(P2\)/,
   'sans plancher, le rendu doit dire qu’aucun écart n’est interprétable');
 const avec=Bench.render(Bench.scoreRun(run),'    plancher : 0.003 (P2)');
 assert.match(avec,/plancher : 0\.003/);
});

test('une paire non mesurable n’est pas comptée comme hors contrat',()=>{
 const cut={part:1,cut:1,before:{left:null,right:null},
   statuses:{left:'candidate',right:'candidate'},deltas:{left:[0,0,0],right:[0,0,0]}};
 assert.equal(Bench.outcome(cut).status,'deferred-unmeasurable');
 const card=Bench.scoreRun({id:'x',cuts:[cut]});
 assert.equal(card.C3.outOfContractRefused,0,'non mesurable ≠ refusé pour écartement');
 assert.equal(card.deferred.unmeasurable,1);
});

test('un rail abstenu diffère le cut entier, avant même la question de l’écartement',()=>{
 const cut={part:1,cut:1,before:refPair().before,
   statuses:{left:'unresolved',right:'candidate'},deltas:{left:null,right:[0,0,0]}};
 const out=Bench.outcome(cut);
 assert.equal(out.status,'deferred-abstention');
 assert.deepEqual(out.abstained,['left']);
 assert.equal(out.gauge,null,'aucune paire n’est mesurée quand un rail manque');
});

test('le mode 4.6 note ce que le lot a réellement fait : dix paires hors contrat APPLIQUÉES',()=>{
 /* Le lot du 21 septembre a tourné sans garde d'écartement. Le banc doit
  * pouvoir le constater à partir de ce que le moteur a commandé, et non de ce
  * qu'il aurait dû commander — sinon C3 ne vérifie que sa propre règle. */
 const card=Bench.scoreRun(Bench.fixtureRun(ROOT,'4.6'));
 assert.equal(card.C1.treated,56,'56 cuts réellement appliqués en lot');
 assert.equal(card.C3.outOfContractApplied,10,'dix d’entre eux hors contrat');
 assert.equal(card.C3.outOfContractRefused,0,'aucun garde ne les refusait alors');
 assert.equal(card.deferred.abstention,18);
});

test('C3 prime sur C1 : appliquer une paire hors contrat annule le gain de couverture',()=>{
 const reel=Bench.fixtureRun(ROOT),cardBase=Bench.scoreRun(reel);
 /* Une variante permissive : elle applique le cut 850, mesuré à 1 510,1 mm en
  * lot réel, donc hors contrat. Le cahier tranche — le gain est annulé. */
 const permissive={id:'variante-permissive',
   cuts:reel.cuts.map(c=>c.cut===850?{...c,applied:true}:c)};
 const verdict=Bench.compare(cardBase,Bench.scoreRun(permissive));
 assert.equal(verdict.interceptionRegressions,1);
 assert.deepEqual(verdict.interceptionRegressionCuts,['15/850']);
 assert.match(verdict.verdict,/REGRESSION_INTERCEPTION/);
 assert.match(verdict.verdict,/annulé/);
});

test('une couverture qui baisse parce qu’on cesse d’appliquer des paires fausses est un GAIN',()=>{
 /* La transition historique 4.6 → 4.7. Sans cette règle, le banc qualifierait
  * de régression le principal apport de sûreté de la 4.7. */
 const avant=Bench.scoreRun(Bench.fixtureRun(ROOT,'4.6'));
 const apres=Bench.scoreRun(Bench.fixtureRun(ROOT,'4.7'));
 const cmp=Bench.compare(avant,apres);
 assert.equal(cmp.coverageBefore,0.7568);
 assert.equal(cmp.coverageAfter,0.6216);
 assert.equal(cmp.interceptionGains,10);
 assert.equal(cmp.interceptionRegressions,0);
 assert.match(cmp.verdict,/GAIN DE JUSTESSE/);
 assert.equal(cmp.transitions['treated → deferred-gauge'],10);
});

test('la comparaison nomme chaque basculement, y compris ceux qui vont dans le mauvais sens',()=>{
 const reel=Bench.fixtureRun(ROOT),cardBase=Bench.scoreRun(reel);
 const perte={id:'perte',cuts:reel.cuts.map(c=>
   c.cut===reel.cuts.find(x=>x.statuses.left==='candidate'&&x.statuses.right==='candidate').cut
     ?{...c,statuses:{left:'unresolved',right:'candidate'},deltas:{left:null,right:c.deltas.right}}:c)};
 const cmp=Bench.compare(cardBase,Bench.scoreRun(perte));
 assert.equal(cmp.lost,1);
 assert.equal(cmp.recovered,0);
 assert.equal(cmp.verdict,'PERTE DE COUVERTURE');
 assert.ok(cmp.transitions['treated → deferred-abstention']>=1,'le basculement est nommé');
});

/* Paire de rails réelle, reprise de la fixture, pour les cas construits. */
function refPair(){
 const raw=Bench.fixtureRun(ROOT);
 return {before:raw.cuts.find(c=>c.deltas.left&&c.deltas.right).before};
}

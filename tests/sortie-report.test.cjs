'use strict';
/* Rapport de sortie 4.8 : C1 à C5 ensemble, rôles des lots respectés, aucun
 * chiffre d'erreur sans P2, faux nommés sur les seuls lots de validation relus. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const R=require('../tools/sortie-report.cjs');
const rapport=({label,part,state='STOPPED',applied,cuts,wrong=[],judged=0,refused=0,hors=0,evaluable=true})=>({lots:[{label,version:'4.7.16',batch:{part,state}}],
  total:{c1:{applied,distinctCuts:cuts,coveragePct:Math.round(applied/cuts*1000)/10},c4:{wrong:wrong.length,judgedApplied:judged,evaluable,wrongCuts:wrong.map(([cut,worstMm])=>({cut,worstMm}))},
    c3:{refused:Array(refused).fill({}),appliedOutOfContract:Array(hors).fill({})},c2:null}});
const fichiers={
  'a.json':rapport({label:'reglage',part:19,applied:14,cuts:28,wrong:[[1834,26.5]],judged:20}),
  'b.json':rapport({label:'valide-1',part:40,state:'COMPLETED',applied:85,cuts:100,wrong:[[4001,12.3]],judged:60,refused:2}),
  'c.json':rapport({label:'valide-2',part:41,state:'COMPLETED',applied:70,cuts:100,judged:40}),
  'd.json':rapport({label:'couverture',part:42,applied:90,cuts:100})};
const manifeste=(extra={})=>({lots:[{fichier:'a.json',role:'réglage',relecture:'complète'},{fichier:'b.json',role:'validation',relecture:'ciblée'},
  {fichier:'c.json',role:'validation',relecture:'complète'},{fichier:'d.json',role:'couverture',relecture:'aucune'}],bilans:['x'],...extra});
test('critères : C1 sur les lots de validation complets, C4 nommé sur les seuls lots de validation relus',()=>{
  const s=R.summarize(manifeste(),f=>fichiers[f]);
  assert.equal(s.criteres.C1.statut,'non tenu','70 % < 80 %');assert.match(s.criteres.C1.detail,/valide-2 : 70 %/);
  assert.equal(s.criteres.C4.statut,'seuil à trancher');assert.match(s.criteres.C4.detail,/1 faux sur 100 cuts jugés/);
  assert.match(s.criteres.C4.detail,/4001/);assert.doesNotMatch(s.criteres.C4.detail,/1834/,'un faux de réglage ne compte pas');
  assert.equal(s.criteres.C2.statut,'non publiable','sans P2, aucun chiffre d\'erreur');
  assert.equal(s.criteres.C3.statut,'tenu');assert.equal(s.criteres.C5.statut,'bilans tenus');
  const t=R.summarize(manifeste({seuilC4:{maxFaux:1}}),f=>fichiers[f]);assert.equal(t.criteres.C4.statut,'tenu');
});
test('sans lot de validation : non démontré, non mesuré ; une paire hors contrat appliquée fait tomber C3',()=>{
  const s=R.summarize({lots:[{fichier:'a.json',role:'réglage',relecture:'complète'}]},f=>fichiers[f]);
  assert.equal(s.criteres.C1.statut,'non démontré');assert.equal(s.criteres.C4.statut,'non mesuré');assert.equal(s.criteres.C5.statut,'sans bilan');
  const h={...fichiers,'e.json':rapport({label:'hors',part:43,applied:1,cuts:1,hors:1})};
  assert.equal(R.summarize({lots:[{fichier:'e.json',role:'réglage',relecture:'complète'}]},f=>h[f]).criteres.C3.statut,'non tenu');
  const md=R.toMarkdown(R.summarize(manifeste(),f=>fichiers[f]),{date:'d'});
  assert.match(md,/\| C1 \| \*\*non tenu\*\*/);assert.match(md,/couverture \| aucune .*non jugé/);
});
test('décisions D-057 : lot arrêté compté, reliquat exclu de C1, faux isolés expliqués, P2 reporté',()=>{
  const f={...fichiers,'r.json':rapport({label:'reliquat',part:40,applied:5,cuts:50,judged:5})};
  const m=manifeste({lotArreteCompte:true,seuilC4:{regle:'isolés expliqués',types:{'valide-1:4001':'premier passage'}},p2Reporte:'P2 reporté en 4.9'});
  m.lots.push({fichier:'r.json',role:'validation',relecture:'complète',c1:false});
  f['b.json']=rapport({label:'valide-1',part:40,state:'STOPPED',applied:85,cuts:100,wrong:[[4001,12.3]],judged:60});
  const s=R.summarize(m,x=>f[x]);
  assert.match(s.criteres.C1.detail,/valide-1 : 85 %/,'lot arrêté relu : compté');assert.doesNotMatch(s.criteres.C1.detail,/reliquat/,'c1:false : exclu');
  assert.equal(s.criteres.C4.statut,'tenu (faux isolés expliqués)');assert.match(s.criteres.C4.detail,/4001 \(12,3 mm, valide-1, premier passage\)/);
  assert.equal(s.criteres.C2.statut,'publié sans plancher');assert.match(s.criteres.C2.detail,/P2 reporté en 4\.9/);
  const sans=R.summarize({...m,seuilC4:{regle:'isolés expliqués',types:{}}},x=>f[x]);assert.equal(sans.criteres.C4.statut,'non tenu (faux sans type)');
  const couverture=R.summarize({...m,lots:[...m.lots,{fichier:'d.json',role:'validation',relecture:'aucune'}]},x=>f[x]);
  assert.doesNotMatch(couverture.criteres.C1.detail,/couverture/,'arrêté sans relecture : pas compté');
});

'use strict';
/* Outils hors navigateur : comparaison de deux rapports du banc, comparaison d'un relevé du vrai ESV au contrat.
 *   node --test tests/esv-maquette/outils.test.cjs */
const {test}=require('node:test'),assert=require('node:assert/strict');
const {comparer,markdown}=require('../../tools/banc-comparer.cjs');
const Contrat=require('../../tools/esv-contrat-comparer.cjs');
const rapport=(version,cuts,valides,differes)=>({version,etatFinal:'STOPPED',dureeLotMs:1000,differes,erreurs:[],commandes:{capture:cuts.length},
  cuts:cuts.map(c=>({cut:c,dureeMs:100+c,types:valides.includes(c)?['applied-verified']:['defer-finalized']})),
  ecrituresServeur:valides.map(c=>({rowKey:'23-'+c,status:'valid'})),ecartsReferenceMm:valides.map(c=>({rowKey:'23-'+c,gaucheMm:.5,droitMm:1}))});
test('banc-comparer : issues par cut, cuts différents, totaux, tableau',()=>{
  const c=comparer(rapport('4.8.6',[100,101,102],[102],2),rapport('4.9.0.15',[100,101,102],[100,102],1));
  assert.deepEqual(c.differents,[100]);assert.equal(c.cuts.find(x=>x.cut===100).A,'différé');assert.equal(c.cuts.find(x=>x.cut===100).B,'posé-validé');
  assert.deepEqual(c.cuts.find(x=>x.cut===102).ecartB,[.5,1]);assert.equal(c.A.poses,1);assert.equal(c.B.poses,2);
  const md=markdown(c);assert.match(md,/Cuts d'issue différente : 100/);assert.match(md,/\| 101 \| différé \| différé \|/);
});
test('esv-contrat-comparer : confirmée / infirmée / non relevée, et quoi changer',()=>{
  const r={quand:'t',libelle:{format:'Cut N of part P'},profil:{texte:'U50'},commandes:{manquantes:[],titreValider:'load next non validated cut'},compteur:{nombre:1,total:112},
    totalCuts:{nombre:1},potree:{nuages:1,clipTask:'SHOW_INSIDE',noeudsVisibles:55},camera:{projection0:5.000000006},scene:{rails:2},clavier:{ecouteurs:2},railActif:{classe:'selected'},navigation:{candidats:[{},{},{},{},{},{}]}};
  const c=Contrat.comparer(r);const v=Object.fromEntries(c.hypotheses.map(h=>[h.id,h.verdict]));
  assert.equal(v.H01,'confirmée');assert.equal(v.H04,'confirmée');assert.equal(v.H05,'infirmée','« M cuts » présent alors qu’ESV ne l’affiche pas');assert.equal(v.H12,'confirmée','tolérance numérique');assert.equal(v.H06,'non relevée','la liste n’est pas relevable depuis la page');
  assert.equal(v.H07,'infirmée');assert.equal(v.H08,'confirmée');assert.equal(v.H13,'infirmée','55 nœuds hors de la plage supposée');
  assert.ok(c.aChanger.some(x=>x.startsWith('H07')),'H07 à changer : '+JSON.stringify(c.aChanger));
});

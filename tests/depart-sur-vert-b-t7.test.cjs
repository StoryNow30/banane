'use strict';
/* Test 7, suite 2 (coordination, D-169, audit P-5 C1 et C2) — DÉPART SUR UN CUT VERT (suite des essais : SKIP, rouges derrière, premier cut rouge).
 * Avant : un lot parti d'un cut déjà validé le posait et le validait (`apply` + `validateAndNext`) pour passer au rouge
 * suivant ; sur une partie dont les rouges restants sont DERRIÈRE (relance de la partie 8, test 6), il sortait de la partie.
 * Maintenant : premier cut vert (liste d'ESV en mémoire de la page) → « cut non validé suivant » (Maj+Z, sans écriture)
 * jusqu'au premier rouge devant, puis le lot comme avant ; aucun rouge devant → arrêt sans rien envoyer, avec la liste des
 * rouges restants. ESV simulé avec sa liste (tests/helpers/esv-liste.cjs) ; données synthétiques. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const {lotListe,partie}=require('./helpers/esv-liste.cjs');
const surCut=(s,c)=>s.trace.filter(t=>t.cut===c).map(t=>t.a);
const depuis=(s,c)=>{const i=s.trace.findIndex(t=>t.cut===c);return i<0?[]:s.trace.slice(i);};

test('cut de départ passé (SKIP) : vert lui aussi, aucune écriture sur lui',async()=>{
 const s=await lotListe({liste:partie(12,{rouges:[3,7],passes:[1]}),depart:1});
 assert.deepEqual(surCut(s,1),['nextWithoutDecision']);assert.equal(s.statuts[1],'skipped');
 assert.deepEqual(depuis(s,3).map(t=>t.a+'@'+t.cut),['apply@3','validateAndNext@3','apply@7','validateInPlace@7']);
});

test('relance d’une partie dont les rouges restants sont DERRIÈRE le cut vert : rien n’est envoyé, l’avis les nomme, pas de sortie de la partie',async()=>{
 const s=await lotListe({liste:partie(12,{rouges:[1,3]}),depart:8});
 assert.deepEqual(s.trace,[],'0 pose, 0 validation, 0 navigation');assert.deepEqual(s.ecritures,[]);
 assert.equal(s.view.batch.state,'STOPPED');assert.equal(s.view.batch.error??null,null,'aucune erreur');
 assert.equal(s.view.batch.stoppedAtEnd.issue,'depart-sur-vert');assert.equal(s.view.batch.stoppedAtEnd.motif,'rouges-derriere');
 assert.deepEqual(s.view.batch.stoppedAtEnd.derriere,[1,3]);
 assert.equal(s.view.notice,'Partie 23 : le cut 8 est déjà validé. Plus aucun cut rouge après lui. Il reste 2 cuts rouges derrière : 1, 3. Aucune pose ni validation n’a été envoyée à ESV. Pour les traiter : ouvre le cut 1 dans ESV, puis lance un lot depuis ce cut.');
 const v=await s.b.api('resume');assert.match(v.notice,/^Lot déjà terminé : départ sur un cut vert, rien à traiter devant \(cut 8\)/);assert.deepEqual(s.ecritures,[]);
});

test('premier cut rouge : commandes identiques, à l’octet près, à celles d’un lot dont la page ne rend pas sa liste',async()=>{
 const o={liste:partie(12,{rouges:[2,4]}),depart:2};
 const s=await lotListe(o),ref=await lotListe({...o,table:false});
 assert.deepEqual(s.trace,ref.trace);assert.deepEqual(s.calls,ref.calls);
 assert.equal(s.b.store.events.filter(e=>e.type==='depart-sur-vert').length,0);
});

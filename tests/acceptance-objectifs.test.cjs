'use strict';
/* CHANTIER 5 — §14 G, objectifs : C1 à C5 rapportés ensemble ; C1 seul n'est
 * jamais un résultat ; le plancher P2 accompagne tout chiffre d'erreur.
 * `tools/acceptance-report.cjs` sur un lot synthétique (`helpers/acceptance-lot.cjs`). */
const {test}=require('node:test'),assert=require('node:assert/strict');
const A=require('../tools/acceptance-report.cjs');
const {pair,pilotCut,pilotLot,visit,relecture}=require('./helpers/acceptance-lot.cjs');
const T=[0,0,0];
function lots(){const make=(part,label)=>{const cuts=[pilotCut(part,600),pilotCut(part,601,{outcome:'deferred'}),pilotCut(part,602,{outcome:'gauge',gaugeMm:1520})];
    return {label,...pilotLot(part,cuts),corpus:null,relecture:relecture([visit(part,600,{before:pair(600,{},T),final:pair(600,{left:[2,0]},T)})])};};
  return [make(41,'lot A'),make(42,'lot B')];}
const sections=md=>md.split('\n### ').slice(1).map(s=>({titre:s.split('\n')[0],texte:s}));

test('§14 G : C1 n\'est jamais présenté seul : C2, C3, C4 et le plancher P2 l\'accompagnent, par partie et au total',()=>{
  for(const p2 of [null,{lateralMm:1.2,verticalMm:0.9,operators:1}]){
    const r=A.report(lots(),{p2}),md=A.toMarkdown(r),s=sections(md);
    assert.ok(s.length>=3,'une section par partie, puis le total');
    for(const {titre,texte} of s){
      for(const c of ['| C1 —','| C2 —','| C3 —','| C4 —'])assert.ok(texte.includes(c),`${titre} : ${c} manquant`);
      assert.match(texte,/plancher : P2/,`${titre} : plancher P2 absent de la ligne C2`);
      assert.match(texte,/C1 seul n’est pas un résultat/);}
    for(const part of [...Object.values(r.parts),r.total]){
      assert.ok(part.c1&&part.c2&&part.c3&&part.c4,'C1 à C4 ensemble dans le JSON');
      assert.equal(part.c2.floor.label,p2?'P2 (un opérateur)':'P2 non mesuré');}}
});

/* §14 G et C5 (cahier §6) : le rapport d'acceptation rapporte C1 à C4 ; C5, le
 * bilan des curseurs, vit dans `audit/curseurs-lot-2026-09-24.md` et
 * `audit/ecartement-voisin-2026-09-24.md`, sans lien depuis le rapport. */
test('§14 G : C5, le bilan des curseurs, est rapporté avec C1 à C4',
  {todo:'KI-056 proposé (audit/chantiers/acceptation.md) : le rapport d\'acceptation ne rapporte pas C5'},()=>{
  const md=A.toMarkdown(A.report(lots()));
  for(const {titre,texte} of sections(md))assert.match(texte,/\| C5 —/,`${titre} : C5 absent`);
});

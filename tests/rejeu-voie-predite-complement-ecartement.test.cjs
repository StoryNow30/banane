'use strict';
/* CH-053-M, sorti de rejeu-voie-predite.test.cjs : chaque essai de balayage coûte plusieurs secondes de nuage synthétique ;
 * un fichier par essai pour tenir sous la borne de 20 s du verify (mesuré : 62 s pour les trois ensemble). Fixture SYNTHÉTIQUE. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const T=require('../tools/rejeu-voie-predite.cjs');

test('CH-053-M, complément par l\'écartement : un rail trouvé par le moteur, l\'autre hors de sa fenêtre ⇒ l\'autre rail est cherché à l\'écartement de référence',()=>{
  /* Le rail droit est à 230 mm, hors de la fenêtre d'analyse de ±180 mm (à 150 mm, le moteur le trouve encore seul : mesuré). */
  const ctx2=T.fixtureSynthetique({premiers:0,coupes:4,decalageMm:{left:6,right:230}});
  const res2=T.executer(ctx2,['temoin','ecart-serie','ecart-balayage-reelle']);
  const t=res2.sorties.find(x=>x.synthese.id==='temoin').synthese,e=res2.sorties.find(x=>x.synthese.id==='ecart-serie'),f=res2.sorties.find(x=>x.synthese.id==='ecart-balayage-reelle');
  assert.equal(t.differes.poses,0,'le témoin diffère : aucun appui, le rail droit hors de la fenêtre');
  assert.equal(e.synthese.differes.poses,4);assert.equal(e.synthese.differes.juste10,4);assert.equal(e.synthese.differes.faux,0);
  assert.equal(e.detail.find(r=>r.cut===1).source,'ecart','le premier cut vient du complément ; en série, les suivants peuvent venir de la chaîne');
  for(const r of e.detail)assert.ok(r.pire<=5,`cut ${r.cut} : ${r.pire} mm`);
  /* Mémoire réelle (aucune chaîne sur ses propres poses) : chaque cut vient du complément. */
  for(const r of f.detail){assert.equal(r.source,'ecart',`cut ${r.cut} : ${r.source}`);assert.ok(r.pire<=5);}
});

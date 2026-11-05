'use strict';
/* CH-053-M, sorti de rejeu-voie-predite.test.cjs : chaque essai de balayage coûte plusieurs secondes de nuage synthétique ;
 * un fichier par essai pour tenir sous la borne de 20 s du verify (mesuré : 62 s pour les trois ensemble). Fixture SYNTHÉTIQUE. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const T=require('../tools/rejeu-voie-predite.cjs');

test('CH-053-M, balayage : sans aucun appui, une voie unique décalée de 230 mm est retrouvée par le balayage, jamais par le témoin',()=>{
  const ctx2=T.fixtureSynthetique({premiers:0,coupes:2});
  const res2=T.executer(ctx2,['temoin','balayage-serie']);
  const t=res2.sorties.find(x=>x.synthese.id==='temoin').synthese,b=res2.sorties.find(x=>x.synthese.id==='balayage-serie');
  assert.equal(t.differes.poses,0);
  assert.equal(b.synthese.differes.poses,2);assert.equal(b.synthese.differes.juste10,2);assert.equal(b.synthese.differes.faux,0);
  for(const r of b.detail){assert.equal(r.source,'balayage',`cut ${r.cut} : source ${r.source}`);assert.ok(r.pire<=5,`cut ${r.cut} : ${r.pire} mm`);}
});

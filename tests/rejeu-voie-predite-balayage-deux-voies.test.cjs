'use strict';
/* CH-053-M, sorti de rejeu-voie-predite.test.cjs : chaque essai de balayage coûte plusieurs secondes de nuage synthétique ;
 * un fichier par essai pour tenir sous la borne de 20 s du verify (mesuré : 62 s pour les trois ensemble). Fixture SYNTHÉTIQUE. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const T=require('../tools/rejeu-voie-predite.cjs');

test('CH-053-M, balayage : deux voies plausibles dans la portée du balayage ⇒ abstention (« plusieurs voies »), aucune pose',()=>{
  /* La vraie voie est à −230 mm de la pose de départ (décalage 230) ; une seconde voie, à +460 mm de la vraie, tombe à +230 mm du départ. */
  const ctx2=T.fixtureSynthetique({premiers:0,coupes:1,voiesMm:[460]});
  const res2=T.executer(ctx2,['balayage-serie']);
  const b=res2.sorties[0];
  assert.equal(b.synthese.differes.poses,0,'une seule des deux voies ne peut pas être choisie');
  for(const r of b.detail)assert.match(String(r.reason),/plusieurs-voies/);
});

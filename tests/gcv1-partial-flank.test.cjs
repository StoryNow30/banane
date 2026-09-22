'use strict';
/* Flanc partiel — décision de la direction du 22/09/2026 (cahier 4.8, amendement n°3).
 *
 * Capture Pilote réelle, partie 18, cut 6704 : 4 et 5 points de flanc, dessus
 * bien observé. Le moteur trouvait la bonne position et se taisait ; ta
 * relecture native l'a placée à 0,1 et 4,0 mm de la sienne. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const Shadow=require('../src/gcv1-shadow.js'),Candidate=require('../src/geometry-candidate-v1.js');
const {base}=require('./fixtures.cjs');
const capture=require('./corpus/pilot-part18-cut6704-partial-flank.json');
const SIDES=['left','right'];
const run=(pf,input=capture)=>{Shadow.configure({partialFlank:pf});try{return Shadow.scientificProposeBoth(input);}finally{Shadow.configure({partialFlank:true});}};

test('actif par défaut, pilotable, et refuse une valeur non booléenne',()=>{
  assert.equal(Shadow.state().partialFlank,true);
  assert.throws(()=>Shadow.configure({partialFlank:'oui'}),/booléen/);
  assert.equal(Shadow.configure({partialFlank:false}).partialFlank,false);
  assert.equal(Shadow.configure({partialFlank:true}).partialFlank,true);
});

test('sans la règle, 4 et 5 points de flanc font s’abstenir les deux rails',()=>{
  const s=run(false);
  for(const side of SIDES){assert.equal(s.rails[side].next.status,'unresolved');assert.equal(s.rails[side].next.motif,'flank');
    assert.ok(s.rails[side].astar.faceCount>=3&&s.rails[side].astar.faceCount<Candidate.DEFAULTS.minFace);}
  assert.equal(s.pairGauge,null,'aucune paire publiée, aucun écartement mesuré');
});

test('avec la règle, les deux rails sont publiés, l’écartement est vérifié et la position est celle de l’humain',()=>{
  const s=run(true);
  for(const side of SIDES){assert.equal(s.rails[side].next.status,'candidate');assert.equal(s.rails[side].partialFlankUsed,true);}
  assert.equal(s.pairGauge.gaugeClass,'NOMINAL');assert.equal(s.summary.pairGaugeRejected,false);
  // Références humaines (relecture native du 22/09), repère du rail initial.
  assert.ok(Math.abs(s.rails.left.next.delta[1]-(-0.0187))<=.005,'gauche à moins de 5 mm de la correction humaine');
  assert.ok(Math.abs(s.rails.right.next.delta[1]-0.0360)<=.005,'droite à moins de 5 mm de la correction humaine');
  const runtime=Shadow.toRuntimeRails(s);
  for(const side of SIDES){assert.equal(runtime[side].status,'candidate');assert.equal(runtime[side].parameters.partialFlank,true);
    assert.equal(runtime[side].gcv1.partialFlankUsed,true,'tracé dans chaque proposition appliquée');}
});

test('un rail déjà bien observé est strictement inchangé par la règle',()=>{
  const off=run(false,base),on=run(true,base);
  for(const side of SIDES){assert.deepEqual(on.rails[side].next.delta,off.rails[side].next.delta);
    assert.equal(on.rails[side].next.status,off.rails[side].next.status);assert.equal(on.rails[side].partialFlankUsed,false);}
});

test('la règle ne touche ni aux seuils gelés ni au contrat',()=>{
  assert.equal(Candidate.DEFAULTS.minFace,6);assert.equal(Candidate.DEFAULTS.minTop,15);
  assert.equal(Candidate.DEFAULTS.minTemplateLossRatio,1.5);assert.equal(Shadow.CONTRACT.minFace,6);
});

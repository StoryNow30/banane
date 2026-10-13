'use strict';
/* B1 (D-095), service worker réel en VM (montage : tests/helpers/b1-montage.cjs) : le repère T se
 * calibre sur la première écriture de validation relevée par l'observateur, les suivantes le
 * contrôlent ; l'indice et la géométrie s'accordent ; le journal ne garde rien d'absolu. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const {montage,lot,evts,deq,TABLE}=require('./helpers/b1-montage.cjs');

test('ombre : repère calibré par la première écriture de validation, indice et géométrie d’accord, voisins comptés ; rien d’absolu consigné',{timeout:60000},async()=>{
  const s=montage();await lot(s,100,102);const e=evts(s.b);
  assert.equal(e.length,3,'un événement par décision');
  assert.equal(e[0].etat,'sans-repere','premier cut : aucune validation encore, aucun voisin');assert.equal(s.demandes.length>=1,true);
  const c=e.filter(x=>x.etat==='calcule');assert.ok(c.length>=2,'les cuts suivants : calculés ('+e.map(x=>x.etat).join(',')+')');
  for(const x of c){deq([x.appariement.ok,x.appariement.indiceGeo,x.appariement.ecartIndice],[true,x.identity.cut,0]);assert.ok(x.appariement.geoMm<1,'pose de départ + T = ligne N');
    assert.ok(Math.round(x.appariement.secondMm)>=990,'ligne suivante à 1 m');deq(x.candidats,[-5,-4,-3,-2,-1,1,2,3,4,5].map(k=>x.identity.cut+k));
    assert.equal(x.gardes.length,10);assert.equal(x.regle,'inchange','premier passage déjà gardé par la voie du lot');assert.equal(x.changement,'aucun');
    const pairs=[-5,-4,-3,-2,-1,1,2,3,4,5].filter(k=>(x.identity.cut+k)%2===0).length;
    deq([x.repere.etat,x.repere.ecartMaxMm,x.table.debut,x.fenetre.valid,x.fenetre.operateur],['calibre',0,true,10,pairs]);assert.equal(x.mode,'ombre');}
  assert.ok(c.at(-1).repere.paires>=2,'les écritures suivantes contrôlent T : '+c.at(-1).repere.paires);
  const texte=JSON.stringify(e);assert.ok(!/\b(912345|6612345|512\.125)/.test(texte),'ni T ni position absolue');assert.ok(!texte.includes('RK-')&&!texte.includes(TABLE),'ni clé de ligne ni table');
  assert.ok(e.every(x=>x.batchId===s.b.get('engine').s.batch.id&&x.schema===1));
  const w=s.b.store.events.filter(x=>x.type==='esv-observation'&&x.kind==='write');assert.ok(w.length>=2&&w.every(x=>x.rowIndex>=100&&x.rowIndex<=102),'indice de ligne rangé avec l’écriture');
});

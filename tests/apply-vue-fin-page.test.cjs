'use strict';
/* 4.9.5.13 (analyse du lot 2:19 du 19/10 : le journal d'un `apply` ne gardait que « reçu » et une durée) — À LA FIN DE CHAQUE POSE, LA PAGE REND
 * LA POSITION DE CHAQUE RAIL DANS LA VUE ACTIVE D'ESV : `vueFin` = { version, pixelMm, left: { ndc:[x,y], dansVue }, right: … }. Le résultat
 * d'`apply` est consigné en entier par le moteur (`applied-verified`, champ `observed`) : le journal la garde. Lecture seule, après la pose ; une
 * lecture impossible est dite (`erreur`), jamais levée. Page ESV simulée (tests/helpers/page.cjs), données synthétiques. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const {page}=require('./helpers/page.cjs');
test('apply rend la position de chaque rail dans la vue à la fin de la pose', async()=>{
 const f=page(),before=await f.call('state');
 const r=await f.call('apply',before,{left:{delta:[0,.004,0]},right:{delta:[0,-.003,.001]}});
 assert.equal(r.vueFin?.version,'vue-fin-v1');
 for(const s of ['left','right']){assert.equal(r.vueFin[s].ndc.length,2);assert.ok(r.vueFin[s].ndc.every(Number.isFinite));assert.equal(typeof r.vueFin[s].dansVue,'boolean');}
 /* La vue active est celle du dernier rail posé (le droit, en « tel-quel ») : il y est au centre ; le gauche, posé dans sa propre vue, y tombe hors
  * champ (ESV a une vue par rail). C'est ce que le journal doit montrer. */
 assert.equal(r.vueFin.right.dansVue,true);assert.ok(Math.abs(r.vueFin.right.ndc[0])<.05);
 assert.equal(r.vueFin.left.dansVue,false);assert.ok(r.vueFin.left.ndc[0]<-1);assert.equal(r.vueFin.pixelMm,2.5);
});

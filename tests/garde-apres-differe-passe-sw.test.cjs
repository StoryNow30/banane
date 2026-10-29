'use strict';
/* CH-019 — GARDE « APRÈS UN DIFFÉRÉ » sous le profil livré « L1-se », la GCV2 forcée à « rien » sur le 112 : la garde diffère le 113 comme sous
 * « actuel » (le 114, appuis comptés sans la garde, est validé), et ce cut devient des restes de la deuxième passe (ici en ombre), comme tout différé du lot. Données synthétiques. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const {SCOPE,production,base,K,S,EsvTrou,attendre,ev,decisions}=require('./helpers/lot-profil.cjs');

test('L1-se : 113 différé par la garde, repris par la deuxième passe',async()=>{
 const adapter=new EsvTrou([]),b=production({adapter});
 b.ctx.BananeSettings={...b.ctx.BananeSettings,voiePrediteOmbre:{...S.voiePrediteOmbre,actif:false},lot:{...S.lot,passeDifferes:{...S.lot.passeDifferes,ecriture:false}}};
 const G=b.ctx.BananeGcv2L1;b.ctx.BananeGcv2L1={...G,deciderDiffere:a=>{const r=G.deciderDiffere(a);return a.capture.identity.cut!==112?r:{...r,decision:{...r.decision,etat:'rien',motif:'force'}};}};
 await b.api('connect',{tabId:1});await b.api('settings',{mode:'automatic-test'});
 adapter.identity.cut=111;adapter.rails=K.clone(base.rails);adapter.ajuster();
 await b.api('start',{part:23,start:111,end:115,...SCOPE});await b.settle();
 for(let i=0;i<100&&!ev(b,'passe-differes-ombre-fin').length;i++)await attendre(50);
 const j=v=>JSON.parse(JSON.stringify(v)),batch=j(b.get('engine').s.batch),d=j(Object.fromEntries(decisions(b)));
 assert.equal(batch.scope.lotProfil,'L1-se');
 assert.deepEqual(batch.deferred.map(x=>x.cut),[112,113]);assert.deepEqual(batch.processed.map(p=>p.cut),[111,114]);
 assert.equal(d[112].l1.etat,'rien');
 assert.deepEqual(j(ev(b,'garde-apres-differe').map(e=>e.identity.cut)),[113]);
 assert.deepEqual(j([...b.get('l1Restes').m.keys()].sort()),['23|fixture-frame|112','23|fixture-frame|113']);
 const vus=new Set(ev(b,'passe-differes-ombre').map(e=>e.identity?.cut));assert.ok(vus.has(113),'la passe redécide les cuts différés par la garde');
});

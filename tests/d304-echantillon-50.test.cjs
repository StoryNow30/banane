'use strict';
/* D-304 (opérateur, 08/11) : le témoin de qualité (lecture « référence ») passe d'un cut sur dix à un cut sur cinquante.
 * Mesure du 08/11 (« Vision 2 », partie 5) : 24 captures « référence » sur 222 = 36 % du temps de capture (4,5 s chacune
 * contre 0,65 s en rapide). Même hachage de Fibonacci que D-091, lu comme une fraction : référence dans le premier
 * cinquantième. La règle « echantillon » (un sur dix) reste lisible pour les journaux et réglages anciens. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const {page}=require('./helpers/page.cjs'),F=require('./v242/fixtures.cjs'),L=require('../vendor/lidar.js');
const T=require('../tools/perf-v3.cjs'),S=require('../src/settings.js');

test('un cut sur cinquante en référence, réparti sans paquets ; un sur dix reste lisible',()=>{
  const ref=T.REGLES.echantillon50;assert.equal(typeof ref,'function','règle echantillon50 connue de l’outil');
  let n=0;for(let c=0;c<100000;c++)if(ref(c)==='reference')n++;assert.ok(n>=1990&&n<=2010,n+' sur 100 000');
  const refs=[];for(let c=0;c<50000;c++)if(ref(c)==='reference')refs.push(c);
  const ecarts=refs.slice(1).map((c,i)=>c-refs[i]);assert.ok(Math.max(...ecarts)<=100&&Math.min(...ecarts)>=20,'écarts '+Math.min(...ecarts)+'..'+Math.max(...ecarts));
  for(let c=0;c<5000;c++)if(ref(c)==='reference')assert.equal(T.REGLES.echantillon(c),'reference','un témoin à 1/50 est aussi un témoin à 1/10 : cut '+c);
});

function lidarPage(cut){const f=page(),pc=F.object([0,0,0],'PointCloudOctree'),n=F.object([0,0,0],'Points');
  n.geometry={attributes:{position:F.buffer([[0,.01,.01],[0,1.425,.01]])}};pc.material={clipBoxes:[],clipTask:0,clipMethod:0};pc.visibleNodes=[{sceneNode:n}];
  f.ctx.viewer.scene.pointclouds=[pc];f.ctx.Potree=F.enums;f.nodes.get('O2N3DCutDescription').textContent=`Cut ${cut} of part 23`;f.ctx.BananeLidar.capture=opts=>L.capture(opts);return f;}

test('réglage livré (D-304) : la page suit la règle d’un sur cinquante et la consigne',async()=>{
  assert.equal(S.pilote.modeRapide,'echantillon50');const ref=T.REGLES.echantillon50;
  const cuts=[0,1,2,50,51,102,200];for(let c=0;c<400&&cuts.length<12;c++)if(ref(c)==='reference'&&!cuts.includes(c))cuts.push(c);
  for(const cut of cuts){const f=lidarPage(cut),out=await f.call('capture',await f.call('state'));
    assert.equal(out.readStrategy.lecture,ref(cut),`cut ${cut}`);assert.equal(out.readStrategy.regleLecture,'echantillon50');}
});

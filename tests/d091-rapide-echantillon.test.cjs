'use strict';
/* D-091 (4.9.0.9) : mode rapide généralisé, validé par la direction le 13 octobre (lot de 112 cuts de la 4.9.0.8 :
 * −64 % par cut, part posée, points lus et écartement identiques). Un cut sur dix reste en référence pour surveiller
 * la qualité : même hachage de Fibonacci que le tirage, lu comme une fraction ; référence dans le premier dixième.
 * Chaque étape de la page porte son heure (`pageMs`) et la règle est consignée à la fin de la capture. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const {page}=require('./helpers/page.cjs'),F=require('./v242/fixtures.cjs'),L=require('../vendor/lidar.js');
const T=require('../tools/perf-v3.cjs'),S=require('../src/settings.js');
const ref=T.REGLES.echantillon;

test('un cut sur dix en référence, régulièrement réparti, sans paquets',()=>{
  let n=0;for(let c=0;c<100000;c++)if(ref(c)==='reference')n++;assert.equal(n,10000);
  const refs=[];for(let c=0;c<20000;c++)if(ref(c)==='reference')refs.push(c);
  assert.deepEqual([...new Set(refs.slice(1).map((c,i)=>c-refs[i]))].sort((a,b)=>a-b),[5,8,13],'écart entre deux cuts de référence : 5, 8 ou 13 cuts');
  for(let debut=0;debut<19700;debut+=13){const k=refs.filter(c=>c>=debut&&c<debut+300).length;assert.ok(k>=28&&k<=32,`${k} cuts de référence dans ${debut}..${debut+299}`);}
  assert.equal(ref(0),'reference');assert.equal(ref(102),'reference');assert.equal(ref(100),'rapide');assert.equal(ref(101),'rapide');
});

function lidarPage(cut){const f=page(),pc=F.object([0,0,0],'PointCloudOctree'),n=F.object([0,0,0],'Points');
  n.geometry={attributes:{position:F.buffer([[0,.01,.01],[0,1.425,.01]])}};pc.material={clipBoxes:[],clipTask:0,clipMethod:0};pc.visibleNodes=[{sceneNode:n}];
  f.ctx.viewer.scene.pointclouds=[pc];f.ctx.Potree=F.enums;f.nodes.get('O2N3DCutDescription').textContent=`Cut ${cut} of part 23`;f.ctx.BananeLidar.capture=opts=>L.capture(opts);return f;}

test('réglage livré : la page suit la même règle que l’outil, la consigne, et date chaque étape',async()=>{
  assert.equal(S.pilote.modeRapide,'echantillon');
  for(let cut=0;cut<30;cut++){const f=lidarPage(cut),out=await f.call('capture',await f.call('state'));
    assert.equal(out.readStrategy.lecture,ref(cut),`cut ${cut}`);assert.equal(out.readStrategy.regleLecture,'echantillon');
    const fin=f.progress.find(p=>p.stage==='capture-ready');assert.equal(fin.detail.regleLecture,'echantillon');assert.equal(fin.detail.lecture,ref(cut));
    const heures=f.progress.map(p=>p.detail.pageMs);assert.ok(heures.length>=5&&heures.every(Number.isInteger),'chaque étape a son heure : '+heures);
    assert.deepEqual(heures,[...heures].sort((a,b)=>a-b),'heures croissantes');}
});

test('une étape sans détail reçoit aussi son heure ; un détail existant est gardé tel quel',async()=>{
  const f=lidarPage(100);await f.call('capture',await f.call('state'));
  const lu=f.progress.find(p=>p.stage==='capture-read');assert.deepEqual(Object.keys(lu.detail).sort(),['attempt','lecture','pageMs','regle','side']);
});

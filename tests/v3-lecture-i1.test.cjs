'use strict';
/* V3, expérience I1 (D-078, D-087) : lecture sans attendre une image d'ESV.
 *
 * Le pilote lit chaque vue avec `vendor/lidar.js`, fichier inchangé. Seule
 * l'option de pause existante change : sur un cut tiré « rapide », elle rend
 * la main à ESV par `scheduler.yield` (repli : canal de messages) au lieu d'un
 * `setTimeout(0)` qui attend souvent une image d'ESV. Le tirage est fixe et se
 * refait à partir du seul numéro de cut : un cut repris ou relu après F5 garde
 * son mode, et l'analyse peut le recalculer. Les cuts « référence » lisent
 * exactement comme la 4.9.0.5. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const {page}=require('./helpers/page.cjs'),F=require('./v242/fixtures.cjs');
const S=require('../src/settings.js'),L=require('../vendor/lidar.js'),B=require('../tools/native-capture-bench.cjs');

function points(rows){const n=F.object([0,0,0],'Points');n.geometry={attributes:{position:F.buffer(rows)}};return {sceneNode:n};}
function lidarPage({lectureI1,cut=100}={}){
 const marks=[],globals={scheduler:{yield:()=>{marks.push('scheduler.yield');return Promise.resolve();}}};
 if(lectureI1!==undefined)globals.BananeSettings={...S,pilote:{...S.pilote,lectureI1}};
 const f=page({globals}),pc=F.object([0,0,0],'PointCloudOctree');
 pc.material={clipBoxes:[],clipTask:0,clipMethod:0};pc.visibleNodes=[points([[0,.01,.01],[0,1.425,.01]])];
 f.ctx.viewer.scene.pointclouds=[pc];f.ctx.Potree=F.enums;f.nodes.get('O2N3DCutDescription').textContent=`Cut ${cut} of part 23`;
 const pauses=[];f.ctx.BananeLidar.capture=async opts=>{pauses.push(opts.pause);if(opts.pause)await opts.pause();return L.capture(opts);};
 return {...f,marks,pauses};}
const tirage=cut=>Math.imul(cut>>>0,2654435761)>>>31?'rapide':'reference';

test('réglage de la version de test : tirage cut par cut, affiché dans les réglages',()=>{
 assert.equal(S.pilote.lectureI1,'tirage');
 const ligne=S.describe().find(l=>l.nom==='Lecture rapide (V3, I1)');
 assert.ok(ligne,'ligne de réglage affichée');assert.equal(ligne.valeur,'un cut sur deux, tiré au sort');
});

test('le tirage est fixe, équilibré et se refait à partir du seul numéro de cut',()=>{
 assert.equal(tirage(100),'rapide');assert.equal(tirage(101),'reference');
 let rapides=0;for(let c=0;c<10000;c++)if(tirage(c)==='rapide')rapides++;
 assert.ok(rapides>4800&&rapides<5200,`${rapides} cuts rapides sur 10 000`);
});

test('cut tiré « rapide » : les deux vues lisent avec la pause qui rend la main à ESV, et le mode est consigné',async()=>{
 const f=lidarPage({cut:100}),before=await f.call('state');const out=await f.call('capture',before);
 assert.equal(f.pauses.length,2);assert.ok(f.pauses.every(p=>typeof p==='function'));
 assert.ok(f.marks.length>=2,'scheduler.yield appelé par la pause');
 assert.equal(out.readStrategy.lecture,'rapide');assert.equal(out.readStrategy.regleLecture,'tirage');
 assert.ok(f.progress.filter(p=>p.stage==='capture-read').every(p=>p.detail.lecture==='rapide'));
 assert.equal(f.progress.find(p=>p.stage==='capture-ready').detail.lecture,'rapide');
});

test('cut tiré « référence » : lecture identique à la 4.9.0.5, sans option de pause',async()=>{
 const f=lidarPage({cut:101}),before=await f.call('state');const out=await f.call('capture',before);
 assert.equal(f.pauses.length,2);assert.ok(f.pauses.every(p=>p===undefined));assert.equal(f.marks.length,0);
 assert.equal(out.readStrategy.lecture,'reference');
 assert.ok(f.progress.filter(p=>p.stage==='capture-read').every(p=>p.detail.lecture==='reference'));
 assert.equal(f.progress.find(p=>p.stage==='capture-ready').detail.lecture,'reference');
});

test('réglage « reference » : aucun cut rapide ; « toujours » : tous rapides ; valeur inconnue : référence',async()=>{
 for(const [regle,cut,attendu] of [['reference',100,'reference'],['toujours',101,'rapide'],['n-importe',100,'reference'],[undefined,100,'rapide']]){
   const f=lidarPage({lectureI1:regle,cut}),before=await f.call('state');const out=await f.call('capture',before);
   assert.equal(out.readStrategy.lecture,attendu,`${regle} / cut ${cut}`);
   assert.equal(f.pauses.every(p=>attendu==='rapide'?typeof p==='function':p===undefined),true,`${regle} / cut ${cut}`);
 }
});

test('une relecture du même cut garde son mode', async()=>{
 const f=lidarPage({cut:100}),before=await f.call('state');let reads=0;
 const unstable="Les nœuds LiDAR visibles ont changé pendant l'export. Attends la fin du chargement puis réessaie.";
 f.ctx.BananeLidar.capture=async opts=>{reads++;f.pauses.push(opts.pause);if(reads===1)throw Error(unstable);return L.capture(opts);};
 const out=await f.call('capture',before);
 assert.equal(reads,3);assert.ok(f.pauses.every(p=>typeof p==='function'));assert.equal(out.readStrategy.lecture,'rapide');
});

test('mêmes points qu\'au banc : le lecteur rend le même relevé, quelle que soit la pause (500 000 points, 20 nœuds)',async()=>{
 const ENUMS={ClipTask:{NONE:0,HIGHLIGHT:1,SHOW_INSIDE:2,SHOW_OUTSIDE:3},ClipMethod:{INSIDE_ANY:0,INSIDE_ALL:1}};
 const scn=B.scene(),canal=()=>new Promise(r=>{const c=new MessageChannel();c.port1.onmessage=()=>{c.port1.close();r();};c.port2.postMessage(0);});
 const lire=pause=>L.capture({viewer:scn.viewer,rails:[B.railState(scn.left),B.railState(scn.right)],origin:scn.origin,enums:ENUMS,guard:()=>{},meta:{},...(pause?{pause}:{})});
 const ref=await lire(null),rapide=await lire(canal);
 assert.ok(ref.pointsSceneRelative.length>1000);
 const sansHorloge=o=>({...o,capturedAt:null,quality:{...o.quality,durationMs:null}});
 assert.deepEqual(sansHorloge(rapide),sansHorloge(ref));
});

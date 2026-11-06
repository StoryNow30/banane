'use strict';
/* CH-062 — variante « trou » (`lot.signalEteint.declencheur`) : le signal reste vivant, mais une requête de points échoue (HTTP 502 vu par
 * l'observateur) et la capture suivante n'a plus que 20 % des points (le nœud perdu est dans la zone du rail). Allumée : rechargement au point
 * sûr suivant, une fois ; déclencheur « signal » seul : rien. Montage : tests/helpers/lot-signal.cjs. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const {REGLAGE,lotSignal,ev,etapes,valides,attendreLot,etape}=require('./helpers/lot-signal.cjs');
function trouAu113(adapter,b){const capture=adapter.capture.bind(adapter);
 adapter.capture=async e=>{const d=await capture(e);
  if(adapter.identity.cut===113&&!adapter.echecRelaye){adapter.echecRelaye=true;
   b.raw({kind:'esv-observation',observer:'obs-ch062',entries:[{seq:9000,kind:'resource',class:'point-resource',n:3,bytes:1000,startedEpochMs:Date.now(),endedEpochMs:Date.now()+5,windowMs:250,ept:3,statuts:{200:2,502:1},sansStatut:0,echecs:1,echecsCumules:1,dureeTotMs:10,dureeMaxMs:5}]});}
  if(adapter.identity.cut===113&&adapter.rechargements===0)d.pointsSceneRelative=d.pointsSceneRelative.filter((_,i)=>i%5===0);
  return d;};}
test('déclencheur « trou » : échec vu puis capture effondrée au 113 → rechargement au point sûr, une fois ; les cuts validés une fois',async()=>{
 const {b,adapter}=await lotSignal({reglage:{...REGLAGE,declencheur:'trou'},esv:{rechargee:true},start:110,end:115,avant:trouAu113});
 await etape(b,'repris',15000);const v=await attendreLot(b);
 assert.equal(adapter.rechargements,1);
 const d=ev(b,'lot-signal-eteint')[0];assert.equal(d.declencheur,'trou');assert.equal(d.action,'recharger');assert.equal(d.trou.par,'effet');assert.equal(d.identity.cut,113);
 assert.deepEqual(etapes(b).slice(0,4),['detecte','pause','recharge','repris']);
 const vs=valides(b);assert.equal(new Set(vs).size,vs.length,'chaque cut validé une fois');assert.equal(v.batch.stoppedAtEnd?.cut,115);
});

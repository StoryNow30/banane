'use strict';
/* CH-065 : la lecture directe du tampon (chantiers/CH-065/lidar-direct.patch) rend, champ par champ et au bit près, la sortie de capture()
 * d'origine (hors capturedAt et durationMs), lève les mêmes exceptions, et appelle guard()/pause() aux mêmes points. Nuages réels réduits de
 * tests/fixtures/captures-moteur.json dans la scène Potree factice de tools/ch065-scene.js : Float32 et Float64, entrelacé, indexé et normalisé
 * (boucle d'origine), non finis, découpe, drawRange fractionnaire, plafonds, pauses, transformation non finie, vue vide, un point, 505 000 points.
 * La parité sur les 4 647 nuages réels du 04 au 06/11 est faite par tools/ch065-parite-lidar.cjs. Valable avant et après application du patch. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const H=require('./helpers/ch065.cjs'),{scene,VARIANTES,THREE_FACTICE}=require('../tools/ch065-scene.js');
/* Les classes d'attribut de la scène tiennent lieu de THREE.BufferAttribute de la page : le patch les reconnaît par identité de fonction. */
/* Espion par le crochet des classes de la scène (leurs méthodes restent celles de la liste blanche du patch). `ESPION` (null hors mesure) compte les lectures de position ; `ment` décale chaque lecture par accesseur. */
let ESPION=null;
globalThis.CH065_ESPION=(a,i,v)=>{if(ESPION&&a.itemSize===3){ESPION.n++;if(ESPION.ment)return v+1e-3;}return v;};
globalThis.THREE=THREE_FACTICE;
const LO=H.lidar('origine'),LP=H.lidar('patche');
async function jouer(L,c,opts,espion){
  const sc=scene(c,opts),appels=[];ESPION=espion||null;
  const options={viewer:sc.viewer,rails:sc.rails,origin:sc.origin,enums:sc.enums,guard:()=>appels.push('g'),pause:async()=>{appels.push('p');},meta:{captureId:'ch065'}};
  for(const k of ['maxPoints','maxInspected','yieldEvery'])if(opts[k]!==undefined)options[k]=opts[k];
  try{const o=await L.capture(options);return {sortie:H.canon(o,['capturedAt','durationMs']),appels:appels.join(''),statut:o.status};}
  catch(e){return {erreur:(e?.name||'')+': '+e?.message,appels:appels.join('')};}
  finally{ESPION=null;}
}
test('CH-065 : mêmes sorties, mêmes exceptions, mêmes pauses, sur toutes les variantes de scène', async ()=>{
  const statuts=new Set(),erreurs=new Set();
  for(const [k,c] of H.captures().entries())for(const [nom,opts] of Object.entries(VARIANTES)){
    const a=await jouer(LO,c,{graine:k,...opts}),b=await jouer(LP,c,{graine:k,...opts});
    assert.deepEqual(b,a,`capture ${k}, variante ${nom}`);
    if(a.erreur)erreurs.add(a.erreur);else statuts.add(a.statut);
  }
  for(const s of ['complete-loaded-roi','partial-limit','partial-invalid-points','no-points','one-rail-empty'])assert.ok(statuts.has(s),'statut non couvert : '+s);
  assert.ok([...erreurs].some(e=>e.includes('Transformation non finie.')),'exception de transformation non couverte');
});
test('CH-065 : 505 000 points en 19 nœuds, comme une vue du terrain', async ()=>{
  const c=H.captures()[4],a=await jouer(LO,c,{total:505000}),b=await jouer(LP,c,{total:505000});
  assert.deepEqual(b,a);assert.equal(a.statut,'complete-loaded-roi');
});
test('CH-065 : le chemin direct sert sur un tampon flottant non indexé, et pas ailleurs', async ()=>{
  const c=H.captures()[0],n=c.pointsSceneRelative.length;
  for(const [nom,opts,direct] of [['Float32',{},true],['Float64',{type:Float64Array},true],['entrelacé',{entrelace:true},true],['indexé',{indexe:true},false],['normalisé',{normalise:true},false]]){
    globalThis.THREE=THREE_FACTICE;
    const e={n:0};await jouer(LP,c,opts,e);
    if(direct)assert.ok(e.n<n/4,`${nom} : ${e.n} lectures par accesseur pour ${n} points, le chemin direct n'a pas servi`);
    else assert.ok(e.n>=n,`${nom} : ${e.n} lectures par accesseur pour ${n} points, la boucle d'origine n'a pas servi`);
  }
});
test('CH-065 : sans THREE reconnu dans la page, accesseur non reconnu : boucle d\'origine, même sortie, chaque point lu par l\'accesseur', async ()=>{
  const c=H.captures()[0],n=c.pointsSceneRelative.length;
  try{globalThis.THREE=undefined;
    for(const opts of [{},{entrelace:true},{type:Float64Array},{yieldEvery:7},{drawRange:{start:3.7,count:1000.5}}]){
      const e={n:0},a=await jouer(LO,c,opts),b=await jouer(LP,c,opts,e);
      assert.deepEqual(b,a,JSON.stringify(opts));if(!opts.drawRange)assert.ok(e.n>=n,`${e.n} lectures par accesseur pour ${n} points : la lecture n'est pas passée par l'accesseur`);}}
  finally{globalThis.THREE=THREE_FACTICE;}
  /* Attribut sans accesseur : C.attribute lit lui-même le tableau, la lecture directe sert sans preuve. */
  const a=await jouer(LO,c,{sansAccesseur:true}),b=await jouer(LP,c,{sansAccesseur:true});assert.deepEqual(b,a);
});
/* Contre-exemples de Codex (PR #25), accesseur inconnu (propre à l'instance) sur le premier nœud :
 *  1. effet de bord : getZ(k+1) modifie Y du point k, déjà lu par l'origine ;
 *  2. exception : l'accesseur lève sur un indice que l'origine ne lit jamais (elle s'arrête au plafond de points retenus). */
async function codex(L,c,cas){
  const sc=scene(c,{graine:5}),e=sc.viewer.scene.pointclouds[0].visibleNodes[0],a=e.sceneNode.geometry.attributes.position,arr=a.array;
  const gx=a.getX.bind(a),gy=a.getY.bind(a),gz=a.getZ.bind(a);const lus=new Set();
  a.getX=i=>{lus.add(i);if(cas.leve!==undefined&&i===cas.leve)throw Error('accesseur : indice interdit '+i);return gx(i);};a.getY=i=>gy(i);
  a.getZ=i=>{if(cas.effet!==undefined&&i===cas.effet+1&&!cas.fait){cas.fait=true;arr[cas.effet*3+1]+=.05;}return gz(i);};
  const appels=[];
  try{const o=await L.capture({viewer:sc.viewer,rails:sc.rails,origin:sc.origin,guard:()=>appels.push('g'),pause:async()=>{appels.push('p');},meta:{},...(cas.maxPoints?{maxPoints:cas.maxPoints}:{})});
    return {s:H.canon(o,['capturedAt','durationMs']),appels:appels.join(''),lus:[...lus].sort((x,y)=>x-y).join(',')};}
  catch(err){return {erreur:err.message,appels:appels.join(''),lus:[...lus].sort((x,y)=>x-y).join(',')};}
}
test('CH-065 : contre-exemple 1 de Codex — accesseur à effet de bord : même sortie que l\'origine', async ()=>{
  const c=H.captures()[1];
  /* point k : premier point retenu du premier nœud, lu par l'origine avant getZ(k+1). */
  const sc=scene(c,{graine:5}),o=await LO.capture({viewer:sc.viewer,rails:sc.rails,origin:sc.origin,guard(){},pause:async()=>{},meta:{}});
  const k=o.pointSources.find(([n])=>n===0)[1];
  const a=await codex(LO,c,{effet:k}),b=await codex(LP,c,{effet:k});
  /* Rouge sur la tête précédente (preuve exhaustive puis lecture du tableau : la valeur modifiée était relue). */
  assert.deepEqual(b,a);
});
test('CH-065 : contre-exemple 2 de Codex — accesseur qui lève là où l\'origine ne lit pas : même sortie, aucune exception', async ()=>{
  const c=H.captures()[1],base=await codex(LO,c,{maxPoints:10});assert.ok(!base.erreur);
  /* L'indice piégé : le premier que l'origine ne lit jamais (ni sonde, ni point parcouru avant le plafond). */
  const lus=new Set(base.lus.split(',').map(Number));let leve=0;while(lus.has(leve))leve++;
  const cas={maxPoints:10,leve},a=await codex(LO,c,{...cas}),b=await codex(LP,c,{...cas});
  assert.ok(!a.erreur,'l\'origine ne doit pas lever');assert.deepEqual(b,a);
});
test('CH-065 : scénario du chef de CH-064 — maxPoints:3, accesseur inconnu : mêmes appels d\'accesseur que l\'origine, dans le même ordre', async ()=>{
  const c=H.captures()[2];
  const run=async L=>{const sc=scene(c,{graine:9}),log=[];
    for(const e of sc.viewer.scene.pointclouds[0].visibleNodes){const a=e.sceneNode.geometry.attributes.position;
      for(const k of ['getX','getY','getZ']){const g=a[k].bind(a);a[k]=i=>{log.push(k+i);return g(i);};}}
    const o=await L.capture({viewer:sc.viewer,rails:sc.rails,origin:sc.origin,guard(){},pause:async()=>{},meta:{},maxPoints:3});
    return {s:H.canon(o,['capturedAt','durationMs']),log:log.join(',')};};
  const a=await run(LO),b=await run(LP);assert.equal(b.log,a.log);assert.equal(b.s,a.s);
});
/* Journal des appels d'accesseur, sur la position ET sur les autres attributs lus dans la boucle (intensité, classification), posés
 * sur les instances : accesseurs inconnus. `piege(attribut,k,i,nième)` peut lever ou modifier le tableau. */
async function journalAppels(L,c,{opts={},options={},piege}={}){
  const sc=scene(c,{graine:11,...opts}),log=[];
  for(const [ni,e] of sc.viewer.scene.pointclouds[0].visibleNodes.entries())for(const [nom,a] of Object.entries(e.sceneNode.geometry.attributes)){
    const vus=new Map();
    for(const k of ['getX','getY','getZ']){if(typeof a[k]!=='function')continue;const g=a[k].bind(a);
      a[k]=i=>{const cle=k+i,n=(vus.get(cle)||0)+1;vus.set(cle,n);log.push(ni+'.'+nom+'.'+k+'('+i+')');if(piege)piege({ni,nom,k,i,n,a});return g(i);};}}
  try{const o=await L.capture({viewer:sc.viewer,rails:sc.rails,origin:sc.origin,guard(){},pause:async()=>{},meta:{},...options});
    return {sortie:H.canon(o,['capturedAt','durationMs']),log:log.join(' ')};}
  catch(e){return {erreur:e.message,dernier:log.at(-1),log:log.join(' ')};}
}
test('CH-065 : accesseurs inconnus sur la position et sur les attributs lus dans la boucle : même suite d\'appels, même entrelacement', async ()=>{
  const c=H.captures()[3];
  for(const options of [{},{maxPoints:5},{maxInspected:777},{yieldEvery:13}]){
    const a=await journalAppels(LO,c,{options}),b=await journalAppels(LP,c,{options});
    assert.equal(b.log,a.log,JSON.stringify(options));assert.equal(b.sortie,a.sortie);
    assert.ok(/intensity\.getX/.test(a.log),'l\'intensité doit être lue dans la boucle');}
});
test('CH-065 : arrêt au milieu d\'un nœud sur une erreur de l\'accesseur : même dernier appel, même exception', async ()=>{
  const c=H.captures()[3],base=await journalAppels(LO,c);
  /* Indice piégé : au milieu du premier nœud, lu par la boucle. */
  const m=Math.floor(base.log.split(' ').filter(s=>s.startsWith('0.position.getX(')).length/2);
  const lectures=base.log.split(' ').filter(s=>s==='0.position.getY('+m+')').length;
  const piege=({ni,nom,k,i,n})=>{if(ni===0&&nom==='position'&&k==='getY'&&i===m&&n===lectures)throw Error('accesseur : panne au point '+i);};
  const a=await journalAppels(LO,c,{piege}),b=await journalAppels(LP,c,{piege});
  assert.ok(a.erreur,'le piège doit faire lever l\'origine');assert.deepEqual(b,a);
});
test('CH-065 : getX qui lève à la troisième lecture de l\'indice 0 (Codex) : aucun appel en plus de l\'origine', async ()=>{
  const c=H.captures()[3];
  const piege=({ni,nom,k,i,n})=>{if(ni===0&&nom==='position'&&k==='getX'&&i===0&&n===3)throw Error('troisième lecture de l\'indice 0');};
  const a=await journalAppels(LO,c,{piege}),b=await journalAppels(LP,c,{piege});assert.deepEqual(b,a);
});
test('CH-065 : prototype de THREE remplacé après le chargement (Codex) : il n\'est pas cru, même sortie que l\'origine', async ()=>{
  const c=H.captures()[1],P=THREE_FACTICE.BufferAttribute.prototype,av=[P.getX,P.getY,P.getZ];
  const run=async L=>{const sc=scene(c,{graine:3}),a0=sc.viewer.scene.pointclouds[0].visibleNodes[0].sceneNode.geometry.attributes.position,cible=Math.floor(a0.count/2)+1;
    P.getX=function(i){return av[0].call(this,i)+(this===a0&&i===cible?.05:0);};P.getY=function(i){return av[1].call(this,i);};P.getZ=function(i){return av[2].call(this,i);};
    try{return H.canon(await L.capture({viewer:sc.viewer,rails:sc.rails,origin:sc.origin,guard(){},pause:async()=>{},meta:{}}),['capturedAt','durationMs']);}
    finally{[P.getX,P.getY,P.getZ]=av;}};
  assert.equal(await run(LP),await run(LO));
});
test('CH-065 : getX défini par un getter (propriété calculée) : inconnu, et le patch ne l\'invoque pas une fois de plus que l\'origine', async ()=>{
  const c=H.captures()[1];
  const run=async L=>{const sc=scene(c,{graine:4});let invocations=0;
    for(const e of sc.viewer.scene.pointclouds[0].visibleNodes){const a=e.sceneNode.geometry.attributes.position,g=THREE_FACTICE.BufferAttribute.prototype.getX;
      Object.defineProperty(a,'getX',{configurable:true,get(){invocations++;return g;}});}
    const o=await L.capture({viewer:sc.viewer,rails:sc.rails,origin:sc.origin,guard(){},pause:async()=>{},meta:{}});
    return {s:H.canon(o,['capturedAt','durationMs']),invocations};};
  const a=await run(LO),b=await run(LP);assert.deepEqual(b,a);
});
test('CH-065 : prototype de THREE modifié AVANT le chargement (Codex) : son code n\'est pas celui de la liste blanche, il n\'est pas cru', async ()=>{
  const P=THREE_FACTICE.BufferAttribute.prototype,av=P.getX,c=H.captures()[1];let cible=-1,visee=null;
  const falsifiee=function(i){return av.call(this,i)+(this===visee&&i===cible?.05:0);};
  P.getX=falsifiee;   // AVANT le chargement : l'instantané d'identité la prend pour référence
  try{const LM=H.lidar('patche');
    const run=async L=>{const sc=scene(c,{graine:3});visee=sc.viewer.scene.pointclouds[0].visibleNodes[0].sceneNode.geometry.attributes.position;cible=Math.floor(visee.count/2)+1;
      return H.canon(await L.capture({viewer:sc.viewer,rails:sc.rails,origin:sc.origin,guard(){},pause:async()=>{},meta:{}}),['capturedAt','durationMs']);};
    assert.equal(await run(LM),await run(LO));}
  finally{P.getX=av;}
});
test('CH-065 : three.js r124 authentique (corps de Potree 1.8.0) → lecture directe, même sortie ; un corps altéré d\'un caractère → boucle d\'origine', async ()=>{
  const R=require('./fixtures/ch065-three-r124.json'),c=H.captures()[0];
  /* Classes « r124 » : prototypes portant les fonctions dont le texte est exactement celui de three.js r124. */
  const fabriquer=(corps)=>{const fn=s=>(0,eval)('('+s+')');function BA(){}function IBA(){}
    for(const [K,cs] of [[BA,corps.BufferAttribute],[IBA,corps.InterleavedBufferAttribute]]){K.prototype.getX=fn(cs[0]);K.prototype.getY=fn(cs[1]);K.prototype.getZ=fn(cs[2]);}
    return {BufferAttribute:BA,InterleavedBufferAttribute:IBA};};
  const run=async(L,T)=>{const sc=scene(c,{graine:2});let lectures=0;
    /* Chaque position devient une instance « r124 » ; itemSize compté : l'accesseur r124 le lit à chaque appel, la lecture directe non. */
    for(const e of sc.viewer.scene.pointclouds[0].visibleNodes){const g=e.sceneNode.geometry,a=g.attributes.position,o=Object.create(T.BufferAttribute.prototype);
      Object.assign(o,{array:a.array,count:a.count,version:0,normalized:false});Object.defineProperty(o,'itemSize',{get(){lectures++;return 3;},enumerable:true});g.attributes.position=o;}
    const o=await L.capture({viewer:sc.viewer,rails:sc.rails,origin:sc.origin,guard(){},pause:async()=>{},meta:{}});
    return {s:H.canon(o,['capturedAt','durationMs']),lectures};};
  const avant=globalThis.THREE;
  try{
    const T=fabriquer(R);globalThis.THREE=T;const L124=H.lidar('patche'),LO124=H.lidar('origine');
    const a=await run(LO124,T),b=await run(L124,T);assert.equal(b.s,a.s);
    assert.ok(b.lectures<a.lectures/4,`r124 authentique : ${b.lectures} lectures d'itemSize contre ${a.lectures} à l'origine, la lecture directe n'a pas servi`);
    const alt={BufferAttribute:R.BufferAttribute.map((s,k)=>k?s:s.replace('index * this.itemSize','index*this.itemSize')),InterleavedBufferAttribute:R.InterleavedBufferAttribute};
    const T2=fabriquer(alt);globalThis.THREE=T2;const L2=H.lidar('patche');
    const a2=await run(LO124,T2),b2=await run(L2,T2);assert.equal(b2.s,a2.s);assert.equal(b2.lectures,a2.lectures,'corps altéré : boucle d\'origine');
  }finally{globalThis.THREE=avant;}
});
test('CH-065 : l\'essai a des dents — croire un accesseur inconnu est vu', async ()=>{
  const t=H.A.versions(H.RACINE,'vendor/lidar.js').patche,faux=t.replace('if(!a||!accesseursReconnus(a))return null;','if(!a)return null;');
  assert.notEqual(faux,t);const L=H.lidar('patche',faux),c=H.captures()[1];
  const run=async L=>{const sc=scene(c,{graine:3});const e=sc.viewer.scene.pointclouds[0].visibleNodes[0],a=e.sceneNode.geometry.attributes.position,cible=Math.floor(a.count/2)+1;
    const g=a.getX.bind(a);a.getX=i=>i===cible?g(i)+.05:g(i);
    return H.canon(await L.capture({viewer:sc.viewer,rails:sc.rails,origin:sc.origin,guard(){},pause:async()=>{},meta:{}}),['capturedAt','durationMs']);};
  assert.equal(await run(LP),await run(LO));assert.notEqual(await run(L),await run(LO));
});
test('CH-065 : l\'essai a des dents — la même somme dans un autre ordre (dernier bit) est vue', async ()=>{
  const t=H.A.versions(H.RACINE,'vendor/lidar.js').patche;
  const faux=t.replace('l0x=(t0[0]*x+t0[4]*y+t0[8]*z+t0[12])/w0','l0x=(t0[12]+t0[0]*x+t0[4]*y+t0[8]*z)/w0');
  assert.notEqual(faux,t);
  const L=H.lidar('patche',faux);let vu=false;
  for(const c of H.captures()){const a=await jouer(LO,c,{}),b=await jouer(L,c,{});if(H.canon(a)!==H.canon(b)){vu=true;break;}}
  assert.ok(vu,'un écart au dernier bit n\'a pas été vu');
});

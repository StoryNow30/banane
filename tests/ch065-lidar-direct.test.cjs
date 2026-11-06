'use strict';
/* CH-065 : la lecture directe du tampon (chantiers/CH-065/lidar-direct.patch) rend, champ par champ et au bit près, la sortie de capture()
 * d'origine (hors capturedAt et durationMs), lève les mêmes exceptions, et appelle guard()/pause() aux mêmes points. Nuages réels réduits de
 * tests/fixtures/captures-moteur.json dans la scène Potree factice de tools/ch065-scene.js : Float32 et Float64, entrelacé, indexé et normalisé
 * (boucle d'origine), non finis, découpe, drawRange fractionnaire, plafonds, pauses, transformation non finie, vue vide, un point, 505 000 points.
 * La parité sur les 4 647 nuages réels du 04 au 06/11 est faite par tools/ch065-parite-lidar.cjs. Valable avant et après application du patch. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const H=require('./helpers/ch065.cjs'),{scene,VARIANTES,THREE_FACTICE}=require('../tools/ch065-scene.js');
/* Les classes d'attribut de la scène tiennent lieu de THREE.BufferAttribute de la page : le patch les reconnaît par identité de fonction. */
globalThis.THREE=THREE_FACTICE;
const LO=H.lidar('origine'),LP=H.lidar('patche');
/* Espion : compte les lectures par accesseur en enveloppant les méthodes du PROTOTYPE (l'identité avec THREE est gardée). `ment` décale
 * toutes les lectures de position par accesseur : la lecture directe, si elle servait, ne le verrait pas. */
async function jouer(L,c,opts,espion){
  const sc=scene(c,opts),appels=[],protos=[THREE_FACTICE.BufferAttribute.prototype,THREE_FACTICE.InterleavedBufferAttribute.prototype],gardes=[];
  if(espion)for(const p of protos){const g=p.getX;gardes.push([p,g]);p.getX=function(i){if(this.itemSize===3){espion.n++;if(espion.ment)return g.call(this,i)+1e-3;}return g.call(this,i);};}
  const options={viewer:sc.viewer,rails:sc.rails,origin:sc.origin,enums:sc.enums,guard:()=>appels.push('g'),pause:async()=>{appels.push('p');},meta:{captureId:'ch065'}};
  for(const k of ['maxPoints','maxInspected','yieldEvery'])if(opts[k]!==undefined)options[k]=opts[k];
  try{const o=await L.capture(options);return {sortie:H.canon(o,['capturedAt','durationMs']),appels:appels.join(''),statut:o.status};}
  catch(e){return {erreur:(e?.name||'')+': '+e?.message,appels:appels.join('')};}
  finally{for(const [p,g] of gardes)p.getX=g;}
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
test('CH-065 : sans THREE reconnu dans la page, aucun accesseur n\'est cru : boucle d\'origine, même sortie', async ()=>{
  const c=H.captures()[0],n=c.pointsSceneRelative.length;
  try{globalThis.THREE=undefined;const e={n:0};const a=await jouer(LO,c,{}),b=await jouer(LP,c,{},e);
    assert.deepEqual(b,a);assert.ok(e.n>=n,`${e.n} lectures par accesseur pour ${n} points : la lecture directe a servi sans accesseur reconnu`);}
  finally{globalThis.THREE=THREE_FACTICE;}
  /* Attribut sans accesseur : C.attribute lit lui-même le tableau, la lecture directe sert. */
  const a=await jouer(LO,c,{sansAccesseur:true}),b=await jouer(LP,c,{sansAccesseur:true});assert.deepEqual(b,a);
});
test('CH-065 : un accesseur reconnu mais qui ne lit pas le tampon tel quel est vu sur les sondes : boucle d\'origine, même sortie', async ()=>{
  const c=H.captures()[2],ea={n:0,ment:true},eb={n:0,ment:true};
  const a=await jouer(LO,c,{},ea),b=await jouer(LP,c,{},eb);
  assert.deepEqual(b,a);assert.ok(eb.n>=c.pointsSceneRelative.length);
});
test('CH-065 : un accesseur qui diffère sur UN point hors des sondes est vu : boucle d\'origine, même sortie (défaut relevé par Codex sur le portage Rust)', async ()=>{
  const c=H.captures()[1];
  for(const [nom,opts] of [['Float32',{}],['entrelacé',{entrelace:true}]]){
    const run=async L=>{const sc=scene(c,{...opts,graine:3});const appels=[];
      /* Un nœud dont l'accesseur rend une autre valeur pour un seul point retenu, ni sonde, ni premier, ni dernier. */
      const e=sc.viewer.scene.pointclouds[0].visibleNodes[0],a=e.sceneNode.geometry.attributes.position,n=a.count,cible=Math.floor(n/2)+1;
      for(const k of ['getX','getY','getZ']){const g=a[k].bind(a);a[k]=i=>i===cible&&k==='getX'?g(i)+.05:g(i);}
      const o=await L.capture({viewer:sc.viewer,rails:sc.rails,origin:sc.origin,guard:()=>appels.push('g'),pause:async()=>{appels.push('p');},meta:{}});
      return {s:H.canon(o,['capturedAt','durationMs']),appels:appels.join(''),retenus:o.quality.retained};};
    const a=await run(LO),b=await run(LP);
    assert.deepEqual(b,a,nom);
  }
});
test('CH-065 : l\'essai a des dents — la même somme dans un autre ordre (dernier bit) est vue', async ()=>{
  const t=H.A.versions(H.RACINE,'vendor/lidar.js').patche;
  const faux=t.replace('l0x=(t0[0]*x+t0[4]*y+t0[8]*z+t0[12])/w0','l0x=(t0[12]+t0[0]*x+t0[4]*y+t0[8]*z)/w0');
  assert.notEqual(faux,t);
  const L=H.lidar('patche',faux);let vu=false;
  for(const c of H.captures()){const a=await jouer(LO,c,{}),b=await jouer(L,c,{});if(H.canon(a)!==H.canon(b)){vu=true;break;}}
  assert.ok(vu,'un écart au dernier bit n\'a pas été vu');
});

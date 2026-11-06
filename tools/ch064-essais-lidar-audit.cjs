'use strict';
/* CH-064 : essais des trois constats de l'audit externe sur ariane-lidar (PR n° 25, audit de 4ceb766), écrits ROUGES avant
 * leurs correctifs.
 *   node --test tools/ch064-essais-lidar-audit.cjs      (lancé par tools/ch064-essais.cjs ; rien dans tests/ ; données : banane-data)
 * P1 : deux capture() simultanées ne partagent plus l'état du noyau (file qui sérialise les captures, suspensions comprises).
 * P2 : la lecture directe du tableau n'est prise que sans accesseur, ou avec des accesseurs CONNUS (identité de fonction) ;
 *      un accesseur qui diffère du tableau hors des sondes ne change plus la sortie.
 * P3 : la garde de la tranche ne déborde plus en 32 bits (vrai WASM). */
const test=require('node:test'),assert=require('node:assert'),fs=require('node:fs');
const K=require('./ch064-l-commun.cjs'),S=require('./ch064-l-scene.cjs'),{comparer}=require('./ch064-comparer.cjs');
const pause=()=>new Promise(r=>setTimeout(r,0));
const premiere=()=>S.descriptions({max:1}).next().value;
/* Les accesseurs de la classe d'attribut des scènes reconstruites sont déclarés connus (comme ceux de three.js en page). */
function noyau(L,octets,sc){const nw=L.W.noyauWasm(octets);
 const pos=sc.viewer.scene.pointclouds.flatMap(p=>p.visibleNodes)[0].sceneNode.geometry.attributes.position;
 if(typeof L.W.accesseursConnus==='function')L.W.accesseursConnus(Object.getPrototypeOf(pos));return nw;}
const opts=sc=>({viewer:sc.viewer,rails:sc.rails,origin:sc.origin,enums:sc.enums,guard:()=>{},pause,meta:{captureId:'essai'}});
const net=o=>K.net({sortie:o});

test('P1 : deux capture() simultanées rendent chacune la sortie de l’origine',async()=>{
 const L=K.chargerNode(),octets=fs.readFileSync(K.construireWasm()),d=premiere();
 const a=S.construireScene(d,0,7),b=S.construireScene(d,0,7),bornes={bounds:[10,10,10]};
 const ra=net(await L.origine.capture(opts(a))),rb=net(await L.origine.capture({...opts(b),...bornes}));
 const nw=noyau(L,octets,a);globalThis.ArianeLidarNoyau=nw;
 try{const [wa,wb]=await Promise.all([L.variante.capture(opts(a)),L.variante.capture({...opts(b),...bornes})]);
  assert.deepStrictEqual(comparer(ra,net(wa),{max:5}),[],'capture A');
  assert.deepStrictEqual(comparer(rb,net(wb),{max:5}),[],'capture B (bornes larges)');
  assert.ok(nw.tranches()>0,'le noyau a servi');}
 finally{globalThis.ArianeLidarNoyau=undefined;}
});

test('P2 : un accesseur qui diffère du tableau hors des sondes ne change pas la sortie (lectures d’origine)',async()=>{
 const L=K.chargerNode(),octets=fs.readFileSync(K.construireWasm()),d=premiere(),sc=S.construireScene(d,0,7);
 const nw=noyau(L,octets,sc);
 // indice j du premier point retenu : sur chaque nœud, l'accesseur getY rend +0,5 en j (un seul indice, hors des sondes de son nœud)
 const ref0=await L.origine.capture(opts(sc)),src=ref0.pointSources[0];assert.ok(src,'un point retenu');const j=src[1];
 const sondes=new Set((ref0.nodes?.[src[0]]?.probes||[]).map(p=>p.sourceIndex));assert.ok(!sondes.has(j),'j hors des sondes');
 for(const e of sc.viewer.scene.pointclouds.flatMap(p=>p.visibleNodes)){const pos=e.sceneNode.geometry.attributes.position,y=pos.getY.bind(pos);pos.getY=i=>i===j?y(i)+0.5:y(i);}
 const ref=net(await L.origine.capture(opts(sc)));
 globalThis.ArianeLidarNoyau=nw;
 try{const w=net(await L.variante.capture(opts(sc)));assert.deepStrictEqual(comparer(ref,w,{max:5}),[]);}
 finally{globalThis.ArianeLidarNoyau=undefined;}
});

test('P3 : une tranche dont la taille déborde 32 bits est refusée (code 3), sans lecture, dans le vrai WASM',()=>{
 const X=new WebAssembly.Instance(new WebAssembly.Module(fs.readFileSync(K.construireWasm())),{}).exports;
 const E=new Float64Array(X.memory.buffer,X.lidar_etat(),24);
 for(const [n,stride] of [[2,0x20000000],[2,0x40000000],[3,0xAAAAAAAB],[4097,3],[1,2]]){E[5]=0;
  assert.strictEqual(X.lidar_parcourir_f64(n,stride,0,Infinity),0,'n='+n+' stride='+stride);assert.strictEqual(E[5],3,'refus n='+n+' stride='+stride);
  E[5]=0;assert.strictEqual(X.lidar_parcourir_f32(n,stride,0,Infinity),0);assert.strictEqual(E[5],3);}
});

test('P2 : un accesseur inconnu mais conforme au tableau sur tout le nœud laisse servir le noyau, sortie identique',async()=>{
 const L=K.chargerNode(),octets=fs.readFileSync(K.construireWasm()),d=premiere(),sc=S.construireScene(d,0,7),nw=L.W.noyauWasm(octets);
 // accesseurs propres à chaque attribut (donc inconnus), mais qui lisent exactement le tableau
 for(const e of sc.viewer.scene.pointclouds.flatMap(p=>p.visibleNodes)){const pos=e.sceneNode.geometry.attributes.position,a=pos.array;
  pos.getX=i=>a[3*i];pos.getY=i=>a[3*i+1];pos.getZ=i=>a[3*i+2];}
 const ref=net(await L.origine.capture(opts(sc)));globalThis.ArianeLidarNoyau=nw;
 try{const w=net(await L.variante.capture(opts(sc)));assert.deepStrictEqual(comparer(ref,w,{max:5}),[]);assert.ok(nw.tranches()>0,'le noyau a servi');}
 finally{globalThis.ArianeLidarNoyau=undefined;}
});

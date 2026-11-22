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
/* Les scènes reconstruites portent les accesseurs de three.js r124 (tools/ch064-l-scene.cjs), posé en THREE avant la coquille :
 * authentifiés, ils laissent servir le noyau, comme en page. */
function noyau(L,octets){return L.W.noyauWasm(octets);}
/* Coquille rechargée à neuf avec un THREE donné au chargement (instantané) ; rend {W, finir} (finir rend le THREE d'avant). */
function coquilleAvec(T){const avant=globalThis.THREE,chemin=require.resolve('../'+K.SOURCES.coquille);globalThis.THREE=T;delete require.cache[chemin];
 const W=require(chemin);return {W,finir(){globalThis.THREE=avant;delete require.cache[chemin];}};}
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

test('P2 : un accesseur inconnu, même conforme au tableau, laisse le nœud à la boucle d\u2019origine, sortie identique',async()=>{
 const L=K.chargerNode(),octets=fs.readFileSync(K.construireWasm()),d=premiere(),sc=S.construireScene(d,0,7),nw=L.W.noyauWasm(octets);
 // accesseurs propres à chaque attribut (donc inconnus), mais qui lisent exactement le tableau
 for(const e of sc.viewer.scene.pointclouds.flatMap(p=>p.visibleNodes)){const pos=e.sceneNode.geometry.attributes.position,a=pos.array;
  pos.getX=i=>a[3*i];pos.getY=i=>a[3*i+1];pos.getZ=i=>a[3*i+2];}
 const ref=net(await L.origine.capture(opts(sc)));globalThis.ArianeLidarNoyau=nw;
 try{const w=net(await L.variante.capture(opts(sc)));assert.deepStrictEqual(comparer(ref,w,{max:5}),[]);assert.strictEqual(nw.tranches(),0,'aucune tranche au noyau');assert.ok(L.W.refus()['accesseur inconnu']>0);}
 finally{globalThis.ArianeLidarNoyau=undefined;}
});

test('P2 : un accesseur qui rend autre chose qu\u2019un nombre (chaîne) donne la sortie de l\u2019origine',async()=>{
 const L=K.chargerNode(),octets=fs.readFileSync(K.construireWasm()),d=premiere(),sc=S.construireScene(d,0,7),nw=L.W.noyauWasm(octets);
 const ref0=await L.origine.capture(opts(sc)),j=ref0.pointSources[0][1];
 for(const e of sc.viewer.scene.pointclouds.flatMap(p=>p.visibleNodes)){const pos=e.sceneNode.geometry.attributes.position,a=pos.array;
  pos.getX=i=>i===j?String(a[3*i]):a[3*i];pos.getY=i=>a[3*i+1];pos.getZ=i=>a[3*i+2];}
 const ref=net(await L.origine.capture(opts(sc)));globalThis.ArianeLidarNoyau=nw;
 try{const w=net(await L.variante.capture(opts(sc)));assert.deepStrictEqual(comparer(ref,w,{max:5}),[]);
  assert.ok(ref.quality.nonFinitePositions>0,'la chaîne compte comme non finie dans l\u2019origine');}
 finally{globalThis.ArianeLidarNoyau=undefined;}
});

/* Audit de 01846d1 (PR n° 25) : la troisième voie (accesseur inconnu) appelait l'accesseur hors des lectures de l'origine.
 * Un accesseur inconnu laisse désormais le nœud à la boucle d'origine : mêmes appels, même ordre, mêmes effets. */
test('audit 01846d1, P2 : accesseur qui lève au-delà de la plage dessinée, sortie et fin de l\u2019origine',async()=>{
 const L=K.chargerNode(),octets=fs.readFileSync(K.construireWasm()),d=premiere(),nw=L.W.noyauWasm(octets);
 const fab=()=>{const sc=S.construireScene(d,0,7);
  for(const e of sc.viewer.scene.pointclouds.flatMap(p=>p.visibleNodes)){const g=e.sceneNode.geometry,pos=g.attributes.position,a=pos.array;g.drawRange={start:0,count:100};
   const lit=(i,k)=>{if(i>99)throw Error('accesseur : indice hors plage '+i);return a[3*i+k];};pos.getX=i=>lit(i,0);pos.getY=i=>lit(i,1);pos.getZ=i=>lit(i,2);}
  return sc;};
 const ref=await L.origine.capture(opts(fab()));assert.ok(ref.quality.inspected>0);
 globalThis.ArianeLidarNoyau=nw;
 try{const w=await L.variante.capture(opts(fab()));assert.deepStrictEqual(comparer(net(ref),net(w),{max:5}),[]);}
 finally{globalThis.ArianeLidarNoyau=undefined;}
});
test('audit 01846d1, P2 : accesseur à effet de bord (getZ(p+1) change Y du point p, p retenu), sortie de l\u2019origine',async()=>{
 const L=K.chargerNode(),octets=fs.readFileSync(K.construireWasm()),d=premiere(),nw=L.W.noyauWasm(octets);
 const p0=(await L.origine.capture(opts(S.construireScene(d,0,7)))).pointSources[0][1];
 const fab=()=>{const sc=S.construireScene(d,0,7);
  for(const e of sc.viewer.scene.pointclouds.flatMap(p=>p.visibleNodes)){const pos=e.sceneNode.geometry.attributes.position,a=pos.array;
   pos.getX=i=>a[3*i];pos.getY=i=>a[3*i+1];pos.getZ=i=>{if(i===p0+1)a[3*p0+1]+=0.25;return a[3*i+2];};}
  return sc;};
 const ref=net(await L.origine.capture(opts(fab())));
 globalThis.ArianeLidarNoyau=nw;
 try{const w=net(await L.variante.capture(opts(fab())));assert.deepStrictEqual(comparer(ref,w,{max:5}),[]);}
 finally{globalThis.ArianeLidarNoyau=undefined;}
});
test('accesseur inconnu et plafond maxPoints : aucun appel au-delà du dernier point que l\u2019origine lit',async()=>{
 const L=K.chargerNode(),octets=fs.readFileSync(K.construireWasm()),d=premiere(),nw=L.W.noyauWasm(octets),plafond={maxPoints:3};
 const r0=await L.origine.capture({...opts(S.construireScene(d,0,7)),...plafond}),[n3,i3]=r0.pointSources[2];
 // l'origine relit aussi les sondes du nœud (réparties sur toute la plage) : elles restent lisibles
 const sondes=new Set((r0.nodes?.[n3]?.probes||[]).map(p=>p.sourceIndex));assert.ok(sondes.size>0);
 const fab=()=>{const sc=S.construireScene(d,0,7);
  sc.viewer.scene.pointclouds.flatMap(p=>p.visibleNodes).forEach((e,k)=>{const pos=e.sceneNode.geometry.attributes.position,a=pos.array;
   const lit=(i,c)=>{if(k===n3&&i>i3&&!sondes.has(i))throw Error('accesseur : lu au-delà du plafond, indice '+i);return a[3*i+c];};pos.getX=i=>lit(i,0);pos.getY=i=>lit(i,1);pos.getZ=i=>lit(i,2);});
  return sc;};
 const ref=net(await L.origine.capture({...opts(fab()),...plafond}));globalThis.ArianeLidarNoyau=nw;
 try{const w=net(await L.variante.capture({...opts(fab()),...plafond}));assert.deepStrictEqual(comparer(ref,w,{max:5}),[]);}
 finally{globalThis.ArianeLidarNoyau=undefined;}
});

/* Audit de 906ec78 (PR n° 25). A : aucun appel d'accesseur par la coquille avant de savoir s'il est connu (un accesseur inconnu
 * ne voit que les appels de l'origine). B : les accesseurs de three.js sont pris en instantané au chargement de la coquille ; un
 * THREE remplacé ensuite n'est plus reconnu. */
test('audit 906ec78, P2 A : accesseur inconnu qui lève à la troisième lecture de l\u2019indice 0, sortie de l\u2019origine',async()=>{
 const L=K.chargerNode(),octets=fs.readFileSync(K.construireWasm()),d=premiere(),nw=L.W.noyauWasm(octets);
 const fab=()=>{const sc=S.construireScene(d,0,7);
  for(const e of sc.viewer.scene.pointclouds.flatMap(p=>p.visibleNodes)){const pos=e.sceneNode.geometry.attributes.position,a=pos.array;let n0=0;
   pos.getX=i=>{if(i===0&&++n0===3)throw Error('accesseur : troisième lecture de l\u2019indice 0');return a[3*i];};pos.getY=i=>a[3*i+1];pos.getZ=i=>a[3*i+2];}
  return sc;};
 const ref=net(await L.origine.capture(opts(fab())));globalThis.ArianeLidarNoyau=nw;
 try{const w=net(await L.variante.capture(opts(fab())));assert.deepStrictEqual(comparer(ref,w,{max:5}),[]);}
 finally{globalThis.ArianeLidarNoyau=undefined;}
});
test('audit 906ec78, P2 B : THREE remplacé après le chargement de la coquille, accesseur nouveau non reconnu, sortie de l\u2019origine',async()=>{
 const L=K.chargerNode(),octets=fs.readFileSync(K.construireWasm()),d=premiere();
 const proto=(dy)=>({getX(i){return this.array[3*i];},getY(i){return this.array[3*i+1]+(dy&&i===dy.j?dy.v:0);},getZ(i){return this.array[3*i+2];}});
 const avant=globalThis.THREE,chemin=require.resolve('../'+K.SOURCES.coquille);
 try{
  // three.js de la page au chargement de la coquille : un prototype ; la coquille est rechargée à neuf pour en prendre l'instantané
  const T1={BufferAttribute:function(){},InterleavedBufferAttribute:function(){}};T1.BufferAttribute.prototype=proto(null);globalThis.THREE=T1;
  delete require.cache[chemin];const W=require(chemin),nw=W.noyauWasm(octets);
  const j=(await L.origine.capture(opts(S.construireScene(d,0,7)))).pointSources[0][1];
  // puis THREE remplacé : son accesseur getY diffère du tableau en j (hors des sondes)
  const T2={BufferAttribute:function(){},InterleavedBufferAttribute:function(){}};T2.BufferAttribute.prototype=proto({j,v:0.5});globalThis.THREE=T2;
  const fab=()=>{const sc=S.construireScene(d,0,7);for(const e of sc.viewer.scene.pointclouds.flatMap(p=>p.visibleNodes))Object.setPrototypeOf(e.sceneNode.geometry.attributes.position,T2.BufferAttribute.prototype);return sc;};
  const ref=net(await L.origine.capture(opts(fab())));globalThis.ArianeLidarNoyau=nw;
  const w=net(await L.variante.capture(opts(fab())));assert.deepStrictEqual(comparer(ref,w,{max:5}),[]);
 }finally{globalThis.ArianeLidarNoyau=undefined;globalThis.THREE=avant;delete require.cache[chemin];}
});

/* Audit de 1f78142 (PR n° 25) : l'identité ne prouve pas la sémantique. Un accesseur n'est reconnu que si son TEXTE est un corps
 * de three.js de la liste blanche (r124), en plus de l'identité à l'instantané et au THREE courant. */
const corpsR124=nom=>require('../'+K.SOURCES.coquille).CORPS_THREE.r124.buffer[['getX','getY','getZ'].indexOf(nom)];
test('audit 1f78142, P2 : prototype THREE modifié AVANT l\u2019injection (getY décalé), non reconnu, sortie de l\u2019origine',async()=>{
 const L=K.chargerNode(),octets=fs.readFileSync(K.construireWasm()),d=premiere();
 const j=(await L.origine.capture(opts(S.construireScene(d,0,7)))).pointSources[0][1];
 const BA=function(){};BA.prototype={getX:function(i){return this.array[3*i];},getY:function(i){return this.array[3*i+1]+(i===j?0.5:0);},getZ:function(i){return this.array[3*i+2];}};
 const T={BufferAttribute:BA,InterleavedBufferAttribute:function(){}},{W,finir}=coquilleAvec(T);
 try{const nw=W.noyauWasm(octets),fab=()=>{const sc=S.construireScene(d,0,7);for(const e of sc.viewer.scene.pointclouds.flatMap(p=>p.visibleNodes))Object.setPrototypeOf(e.sceneNode.geometry.attributes.position,BA.prototype);return sc;};
  const ref=net(await L.origine.capture(opts(fab())));globalThis.ArianeLidarNoyau=nw;
  const w=net(await L.variante.capture(opts(fab())));assert.deepStrictEqual(comparer(ref,w,{max:5}),[]);assert.deepStrictEqual(W.threeReconnu(),[false,false]);}
 finally{globalThis.ArianeLidarNoyau=undefined;finir();}
});
test('audit 1f78142, P2 : getX(0) qui lève à sa deuxième invocation, maxPoints 0 : aucun appel de la coquille, sortie de l\u2019origine',async()=>{
 const L=K.chargerNode(),octets=fs.readFileSync(K.construireWasm()),d=premiere(),plafond={maxPoints:0};
 const fab=()=>{const n0=new WeakMap();const BA=function(){};BA.prototype={getX:function(i){if(i===0){const c=(n0.get(this)||0)+1;n0.set(this,c);if(c===2)throw Error('getX(0) : deuxième invocation');}return this.array[3*i];},
   getY:function(i){return this.array[3*i+1];},getZ:function(i){return this.array[3*i+2];}};
  const sc=S.construireScene(d,0,7);for(const e of sc.viewer.scene.pointclouds.flatMap(p=>p.visibleNodes))Object.setPrototypeOf(e.sceneNode.geometry.attributes.position,BA.prototype);return {sc,BA};};
 const f0=fab(),ref=net(await L.origine.capture({...opts(f0.sc),...plafond}));
 const f1=fab(),{W,finir}=coquilleAvec({BufferAttribute:f1.BA,InterleavedBufferAttribute:function(){}});
 try{globalThis.ArianeLidarNoyau=W.noyauWasm(octets);const w=net(await L.variante.capture({...opts(f1.sc),...plafond}));assert.deepStrictEqual(comparer(ref,w,{max:5}),[]);}
 finally{globalThis.ArianeLidarNoyau=undefined;finir();}
});
test('three.js authentique (accesseurs r124, THREE au chargement) : lecture directe servie par le noyau, sortie identique',async()=>{
 const L=K.chargerNode(),octets=fs.readFileSync(K.construireWasm()),d=premiere(),nw=L.W.noyauWasm(octets);
 assert.deepStrictEqual(L.W.threeReconnu(),[true,true]);
 const sc=()=>S.construireScene(d,0,7),pos=sc().viewer.scene.pointclouds.flatMap(p=>p.visibleNodes)[0].sceneNode.geometry.attributes.position;
 assert.strictEqual(Function.prototype.toString.call(Object.getPrototypeOf(pos).getX),corpsR124('getX'),'texte exact de three.js r124');
 const ref=net(await L.origine.capture(opts(sc())));globalThis.ArianeLidarNoyau=nw;
 try{const w=net(await L.variante.capture(opts(sc())));assert.deepStrictEqual(comparer(ref,w,{max:5}),[]);assert.ok(nw.tranches()>0,'lecture directe servie');}
 finally{globalThis.ArianeLidarNoyau=undefined;}
});

/* D-303 (relevé de l'opérateur sur ESV, 08/11) : Potree 1.8.0 garde sa PROPRE copie de three.js r124. Les attributs des nœuds sont
 * des BufferAttribute de cette copie : fonctions distinctes de celles de window.THREE, et texte indenté d'un cran de plus
 * (trois tabulations). Relevé : 1 363 lectures sur 1 363 refusées (« accesseur inconnu »), 0 / 24 nœuds lisibles en direct.
 * Ces essais sont écrits ROUGES avant le correctif. */
const POTREE_R124=['function ( index ) {\n\n\t\t\treturn this.array[ index * this.itemSize ];\n\n\t\t}',
 'function ( index ) {\n\n\t\t\treturn this.array[ index * this.itemSize + 1 ];\n\n\t\t}',
 'function ( index ) {\n\n\t\t\treturn this.array[ index * this.itemSize + 2 ];\n\n\t\t}'];
/* Une classe dont les accesseurs ont EXACTEMENT ce texte (une fonction évaluée rend son texte source tel quel). */
function copiePotree(textes=POTREE_R124){const BA=function(){};const f=textes.map(t=>(0,eval)('('+t+')'));
 BA.prototype={getX:f[0],getY:f[1],getZ:f[2]};return BA;}
const avecClasse=(d,BA)=>()=>{const sc=S.construireScene(d,0,7);for(const e of sc.viewer.scene.pointclouds.flatMap(p=>p.visibleNodes))Object.setPrototypeOf(e.sceneNode.geometry.attributes.position,BA.prototype);return sc;};
test('D-303 : copie de three.js r124 propre à Potree (texte relevé sur ESV) : lecture directe servie, sortie identique',async()=>{
 const L=K.chargerNode(),octets=fs.readFileSync(K.construireWasm()),d=premiere(),BA=copiePotree();
 assert.strictEqual(Function.prototype.toString.call(BA.prototype.getX),POTREE_R124[0],'texte exact du relevé');
 const {W,finir}=coquilleAvec(require('./ch064-l-scene.cjs').threeSynthetique());
 try{const nw=W.noyauWasm(octets),fab=avecClasse(d,BA);
  const ref=net(await L.origine.capture(opts(fab())));globalThis.ArianeLidarNoyau=nw;
  const w=net(await L.variante.capture(opts(fab())));assert.deepStrictEqual(comparer(ref,w,{max:5}),[]);
  assert.ok(nw.tranches()>0,'lecture directe servie');}
 finally{globalThis.ArianeLidarNoyau=undefined;finir();}
});
test('D-303 : copie au texte de Potree mais getY décalé (une tabulation de moins) : non reconnue, sortie de l’origine',async()=>{
 const L=K.chargerNode(),octets=fs.readFileSync(K.construireWasm()),d=premiere();
 const BA=copiePotree([POTREE_R124[0],'function ( index ) {\n\n\t\treturn this.array[ index * this.itemSize + 1 ] + 0;\n\n\t\t}',POTREE_R124[2]]);
 const {W,finir}=coquilleAvec(require('./ch064-l-scene.cjs').threeSynthetique());
 try{const nw=W.noyauWasm(octets),fab=avecClasse(d,BA);
  const ref=net(await L.origine.capture(opts(fab())));globalThis.ArianeLidarNoyau=nw;
  const w=net(await L.variante.capture(opts(fab())));assert.deepStrictEqual(comparer(ref,w,{max:5}),[]);
  assert.strictEqual(nw.tranches(),0,'aucune tranche au noyau');}
 finally{globalThis.ArianeLidarNoyau=undefined;finir();}
});
test('D-303 : une seconde copie au même texte, vue après la première, n’est pas reconnue (une seule copie épinglée)',async()=>{
 const L=K.chargerNode(),octets=fs.readFileSync(K.construireWasm()),d=premiere(),A=copiePotree(),B=copiePotree();
 const {W,finir}=coquilleAvec(require('./ch064-l-scene.cjs').threeSynthetique());
 try{const nw=W.noyauWasm(octets);globalThis.ArianeLidarNoyau=nw;
  await L.variante.capture(opts(avecClasse(d,A)()));const t1=nw.tranches();assert.ok(t1>0,'première copie servie');
  const ref=net(await L.origine.capture(opts(avecClasse(d,B)())));
  const w=net(await L.variante.capture(opts(avecClasse(d,B)())));assert.deepStrictEqual(comparer(ref,w,{max:5}),[]);
  assert.strictEqual(nw.tranches(),t1,'seconde copie : aucune tranche de plus');}
 finally{globalThis.ArianeLidarNoyau=undefined;finir();}
});

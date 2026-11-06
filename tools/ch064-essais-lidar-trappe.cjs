'use strict';
/* CH-064 (fusion de CH-064-L) : une trappe du module LiDAR autonome ne fait pas échouer capture(), et l'appel suivant est servi
 * par le WASM, identique à l'origine.
 *   node --test tools/ch064-essais-lidar-trappe.cjs     (lancé par tools/ch064-essais.cjs ; rien dans tests/ ; données : banane-data)
 * La trappe est SIMULÉE : une instance factice lève une WebAssembly.RuntimeError à la place du n-ième appel de parcours. Une
 * trappe réelle n'est pas atteignable par construction (aucune allocation, bornes vérifiées par le module) ; c'est le chemin de
 * reprise de la coquille qui est éprouvé : instance neuve, état d'avant l'appel rendu, tranche rejouée par le noyau JS.
 * Vues réelles reconstruites par tools/ch064-l-scene.cjs ; sortie ENTIÈRE de capture() comparée (Object.is), horodatages retirés. */
const test=require('node:test'),assert=require('node:assert'),fs=require('node:fs');
const K=require('./ch064-l-commun.cjs'),S=require('./ch064-l-scene.cjs'),{comparer}=require('./ch064-comparer.cjs');
const VUES=Number(process.env.CH064_TRAPPE_VUES||3);
/* instancier factice : la vraie instance, dont le parcours lève une RuntimeError au cible-ième appel (compté sur toutes les instances). */
function piegee(cible){let n=0;return m=>{const x=new WebAssembly.Instance(m,{}).exports,o={};for(const k of Object.keys(x))o[k]=x[k];
 for(const k of ['lidar_parcourir_f32','lidar_parcourir_f64'])o[k]=(...a)=>{if(++n===cible)throw new WebAssembly.RuntimeError('unreachable (trappe simulée)');return x[k](...a);};
 return o;};}
test('trappe LiDAR puis appel servi par le WASM et identique (vues réelles)',async t0=>{
 const L=K.chargerNode(),octets=fs.readFileSync(K.construireWasm()),pause=()=>Promise.resolve();
 let vues=0,essais=0;
 for(const d of S.descriptions({max:VUES})){for(let v=0;v<d.vues.length&&vues<VUES;v++){vues++;
  const sc=()=>S.construireScene(d,v,7+v);
  const ref=K.net(await K.executerCapture(L.origine,sc(),undefined,pause));
  // nombre de tranches d'une capture sans trappe
  const sain=L.W.noyauWasm(octets);assert.deepStrictEqual(comparer(ref,K.net(await K.executerCapture(L.variante,sc(),sain,pause)),{max:5}),[]);
  const t=sain.tranches();if(!t)continue;
  for(const cible of [...new Set([1,2,Math.ceil(t/2),t])].filter(c=>c<=t)){essais++;
   const nw=L.W.noyauWasm(octets,{instancier:piegee(cible)});
   const r1=K.net(await K.executerCapture(L.variante,sc(),nw,pause));
   assert.deepStrictEqual(comparer(ref,r1,{max:5}),[],'vue '+vues+', trappe à la tranche '+cible+' sur '+t);
   assert.strictEqual(nw.reprises(),1);
   const avant=nw.tranches(),r2=K.net(await K.executerCapture(L.variante,sc(),nw,pause));
   assert.deepStrictEqual(comparer(ref,r2,{max:5}),[],'vue '+vues+', appel suivant la trappe');
   assert.strictEqual(nw.reprises(),1,'aucune reprise de plus');assert.strictEqual(nw.tranches()-avant,t,'appel suivant servi en entier par le WASM');
   assert.strictEqual(nw.memoireOctets(),524288,'instance neuve, mémoire bornée');}}
  if(vues>=VUES)break;}
 t0.diagnostic(JSON.stringify({vues,trappes:essais}));
 assert.ok(vues>=1&&essais>=1,'au moins une vue réelle et une trappe');
});
test('une erreur qui n’est pas une trappe remonte telle quelle',async()=>{
 const L=K.chargerNode(),octets=fs.readFileSync(K.construireWasm());
 const nw=L.W.noyauWasm(octets,{instancier:m=>{const x=new WebAssembly.Instance(m,{}).exports,o={...x};o.lidar_parcourir_f32=o.lidar_parcourir_f64=()=>{throw new TypeError('autre');};return o;}});
 const d=S.descriptions({max:1}).next().value;
 const r=await K.executerCapture(L.variante,S.construireScene(d,0,7),nw,()=>Promise.resolve());
 assert.deepStrictEqual(r.erreur,{nom:'TypeError',message:'autre'});assert.strictEqual(nw.reprises(),0);
});

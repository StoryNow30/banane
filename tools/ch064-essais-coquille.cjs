'use strict';
/* CH-064 : essais de la coquille (codec VBA JS, chargeur du cœur), un par constat de l'audit externe de la PR n° 25.
 *   node --test tools/ch064-essais-coquille.cjs        (lancé par tools/ch064-essais.cjs ; rien dans tests/)
 * Chaque essai a été écrit ROUGE avant son correctif. */
const test=require('node:test'),assert=require('node:assert'),fs=require('node:fs');
const V=require('../ariane-rs/coquille/vba.js'),C=require('../ariane-rs/coquille/coeur.js'),{comparer}=require('./ch064-comparer.cjs'),{construire}=require('./ch064-construire.cjs');
const aller=v=>V.decoder(V.encoder(v));
let octets=null;const coeur=o=>C.creer(octets||(octets=fs.readFileSync(construire({silencieux:true}))),o);
test('P1 : une clé propre « __proto__ » (JSON.parse) reste une clé propre, sans toucher au prototype',()=>{
 const v=JSON.parse('{"__proto__":{"polluted":true},"a":1}'),w=aller(v);
 assert.deepStrictEqual(Object.keys(w),['__proto__','a']);assert.strictEqual(Object.getPrototypeOf(w),Object.prototype);
 assert.strictEqual(w.polluted,undefined);assert.deepStrictEqual(comparer(v,w),[]);
 assert.deepStrictEqual(comparer(v,coeur().appeler(0,v)),[]);});
test('P1 : la marque BOM en tête de chaîne est conservée',()=>{
 for(const s of ['﻿abc','﻿','a﻿b','﻿'.repeat(70)+'x'])assert.strictEqual(aller(s),s);
 assert.strictEqual(coeur().appeler(0,'﻿abc'),'﻿abc');});
test('P1 : une ligne d\u2019un bloc de nombres qui porte une propriété en plus n\u2019est jamais perdue : refus explicite',()=>{
 // spécification (chantiers/CH-064/vba.md) : un tableau à propriétés non indicielles est refusé, jamais altéré
 const a=[[1,2],[3,4]];a[0].extra=42;
 assert.throws(()=>V.encoder({a}),e=>e instanceof TypeError&&/propriétés non indicielles/.test(e.message));
 assert.deepStrictEqual(comparer({a:[[1,2],[3,4]]},aller({a:[[1,2],[3,4]]})),[]);});
test('P1 : mémoire épuisée dans le cœur : refus récupérable (HorsDomaine), instance neuve, appel suivant servi',()=>{
 const c=coeur();const gros=new Array(3e6).fill(0).map((_,i)=>({k:i})); // ~ 300 Mo d'arbre Rust : au-delà du plafond de 256 Mio
 assert.throws(()=>c.appeler(0,gros),e=>e.name==='HorsDomaine');
 assert.ok(c.etat().reinstanciations>=1);assert.strictEqual(c.appeler(0,7),7);});
test('P2 : bloc n×k qui déborde en 32 bits : erreur de trame, jamais une lecture tronquée',()=>{
 const t=new Uint8Array(32);t.set([0x56,0x42,0x41,0x01,0x09]);new DataView(t.buffer).setUint32(5,0x80000001,true);t[9]=2;
 const r=coeur().appelerOctets(0,t);const v=V.decoder(r.octets);
 assert.strictEqual(v&&v.__erreurVba,true);assert.match(v.message,/^VBA : /);});
test('P2 : la réponse de appelerOctets reste valable après un autre appel (copie)',()=>{
 const c=coeur();const r1=c.appelerOctets(0,V.encoder('premier'));const t1=Array.from(r1.octets);
 const r2=c.appelerOctets(0,V.encoder({autre:[1,2,3],et:'encore plus long, pour recouvrir'}));
 assert.deepStrictEqual(Array.from(r1.octets),t1);assert.strictEqual(V.decoder(r1.octets),'premier');r1.liberer();r2.liberer();});
/* Plafond de la mémoire linéaire du cœur (--max-memory = 256 Mio, ariane-rs/.cargo/config.toml) : refus PROPRE, mesuré
 * (fusion de CH-064-L). Le refus est une trappe du cœur (allocation impossible → arrêt), que la coquille change en HorsDomaine
 * après avoir recréé l'instance ; la façade rejoue alors le JS. L'appel suivant est servi normalement. */
const PLAFOND=256*1024*1024;
function refusMesure(t,c,f){const m0=c.memoireOctets(),t0=performance.now();let e=null;try{f();}catch(x){e=x;}const ms=performance.now()-t0;
 t.diagnostic(JSON.stringify({refusMs:Math.round(ms*10)/10,memoireAvant:m0,memoireApres:c.memoireOctets(),etat:c.etat()}));return e;}
test('plafond 256 Mio : une réservation au-delà est refusée proprement, l’appel suivant est servi',t=>{
 const c=coeur(),v={a:[1,-0,NaN],b:'é'};assert.deepStrictEqual(comparer(v,c.appeler(0,v)),[]);
 const e=refusMesure(t,c,()=>c.appelerOctets(1,new Uint8Array(PLAFOND+(16<<20))));
 assert.ok(e instanceof C.HorsDomaine,'HorsDomaine attendu, reçu '+e);
 assert.strictEqual(c.etat().reinstanciations,1);assert.ok(c.memoireOctets()<8*1024*1024,'instance neuve');
 assert.deepStrictEqual(comparer(v,c.appeler(0,v)),[]);assert.strictEqual(c.etat().reinstanciations,1);});
test('plafond 256 Mio : un appel qui le franchit en cours de calcul est refusé proprement, l’appel suivant est servi',t=>{
 // trame de 160 Mio (20 millions de nombres) : la réservation passe, le décodage (une seconde copie) franchit le plafond
 const c=coeur(),grand=new Float64Array(20e6).fill(0.5),trame=V.encoder(Array.from(grand));
 assert.ok(trame.length<PLAFOND&&2*trame.length>PLAFOND);
 const e=refusMesure(t,c,()=>c.appelerOctets(0,trame));
 assert.ok(e instanceof C.HorsDomaine,'HorsDomaine attendu, reçu '+e);assert.strictEqual(c.etat().reinstanciations,1);
 const v=[[1,2,3],[4,5,6]];assert.deepStrictEqual(comparer(v,c.appeler(0,v)),[]);assert.ok(c.memoireOctets()<8*1024*1024);});
test('plafond 256 Mio : la mémoire du cœur grandit jusqu’à 256 Mio exactement, et pas au-delà',()=>{
 // garde contre un réglage d'édition des liens hérité d'une dépendance (un build.rs de crate lié, constaté à la fusion de CH-064-L)
 coeur();const m=new WebAssembly.Instance(new WebAssembly.Module(octets),C.IMPORTS).exports.memory,page=65536;
 m.grow(PLAFOND/page-m.buffer.byteLength/page);assert.strictEqual(m.buffer.byteLength,PLAFOND);
 assert.throws(()=>m.grow(1),RangeError);});
/* Réinstanciation (plantage de la parité Chromium de la décision, `shadow` : 1 086 réinstanciations en 4 000 appels qui
 * dépassaient tous le seuil). Une instance n'est recréée que si la mémoire dépasse le seuil ET que le dernier appel en a
 * occupé moins du quart (mémoire gardée après un gros appel isolé) ; des appels qui en ont tous besoin gardent l'instance. */
test('réinstanciation : pas à chaque appel quand chaque appel a besoin de la mémoire ; oui après un gros appel isolé',()=>{
 const c=coeur({seuilReinstanciation:8*1024*1024}),grand=Array.from({length:1500000},(_,i)=>i*0.5),petit={a:1};
 for(let i=0;i<6;i++)assert.strictEqual(c.appeler(0,grand).length,grand.length);
 const apresGrands=c.etat().reinstanciations;
 assert.ok(apresGrands<=1,'des appels qui ont tous besoin de la mémoire ne recréent pas l’instance à chaque fois ('+apresGrands+')');
 assert.deepStrictEqual(c.appeler(0,petit),petit);
 assert.strictEqual(c.etat().reinstanciations,apresGrands+1,'après un petit appel, la mémoire gardée est rendue');
 assert.ok(c.memoireOctets()<8*1024*1024);});

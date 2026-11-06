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

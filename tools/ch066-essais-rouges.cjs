#!/usr/bin/env node
'use strict';
/* CH-066 : essais ROUGES des défauts trouvés côté JS (codec ariane-rs/coquille/vba.js et coquille coeur.js).
 *   node --test tools/ch066-essais-rouges.cjs
 * Rouges sur la tête de CH-064 au 06/11 ; verts avec chantiers/CH-066/correctif-coquille-js.patch. Hors du lanceur
 * tools/ch064-essais.cjs tant que le chef n'a pas corrigé. Références : chantiers/CH-066/rapport.md. */
const test=require('node:test'),assert=require('node:assert');
const fs=require('node:fs');
const Vba=require('../ariane-rs/coquille/vba.js');
const {comparer}=require('./ch066-fuzz-vba.cjs');
const refuse=(v,motif)=>assert.throws(()=>Vba.encoder(v),e=>e instanceof TypeError&&/^VBA : /.test(e.message)&&(!motif||motif.test(e.message)));
const identique=v=>{let t;try{t=Vba.encoder(v);}catch(e){if(e instanceof TypeError&&/^VBA : /.test(e.message))return;throw e;}
 assert.strictEqual(comparer(v,Vba.decoder(t)),null);};

test('J1 (P1) : indice non énumérable + clé en plus → refusé, ou rendu identique (aujourd\'hui : clé en plus perdue)',()=>{
 const a=[1,2];Object.defineProperty(a,'0',{value:1,enumerable:false,writable:true,configurable:true});a.extra=9;
 refuse(a,/propriétés non indicielles/);
 const b=[1,,3];Object.defineProperty(b,'0',{value:1,enumerable:false,writable:true,configurable:true});b.x='y';
 refuse(b);
});

test('J2 (P1) : sous-classe de Array, tableau sans prototype, ligne de bloc sous-classe → refusés (aujourd\'hui : rendus en Array simple)',()=>{
 class Sous extends Array{}
 refuse(Sous.from([1,2]),/tableau non simple/);
 const n=[1,2];Object.setPrototypeOf(n,null);refuse(n,/tableau sans prototype/);
 refuse([Sous.from([1,2]),[3,4]]);
 refuse({a:[Sous.from(['x'])]});
});

test('J4 (P2) : un objet métier { __erreurVba:true, nom, message } rendu par le cœur reste une valeur (aujourd\'hui : levé en Error)',()=>{
 const {construire}=require('./ch064-construire.cjs'),w=construire({silencieux:true});
 if(!w)return; // cargo absent : l'essai croisé ne peut pas tourner
 const coeur=require('../ariane-rs/coquille/coeur.js').creer(fs.readFileSync(w));
 const v={__erreurVba:true,nom:'Error',message:'valeur métier'};
 assert.deepStrictEqual(coeur.appeler(0,v),v);
 // et une vraie erreur du cœur est toujours levée
 assert.throws(()=>coeur.appeler(9999,null),e=>e instanceof Error&&/fonction inconnue 9999/.test(e.message));
});

test('J5 (P3) : UTF-8 invalide → TypeError préfixée « VBA : » (aujourd\'hui : erreur nue du TextDecoder, que la façade ne rattrape pas)',()=>{
 const F=(...x)=>Uint8Array.from([0x56,0x42,0x41,0x01,...x]);
 for(const t of [F(0x05,2,0,0,0,0xc0,0x80),F(0x05,3,0,0,0,0xed,0xa0,0x80),F(0x08,1,0,0,0,2,0,0,0,0xff,0xff,0x00)])
  assert.throws(()=>Vba.decoder(t),e=>e instanceof TypeError&&/^VBA : /.test(e.message));
});

test('Témoins (verts avant comme après) : les formes simples passent intactes',()=>{
 for(const v of [[-0,NaN,Infinity],[[1,2],[3,4]],[1,,3],{b:1,2:2,1:3},JSON.parse('{"__proto__":{"a":1}}'),'﻿a',[true,false],[]])identique(v);
 const a=[1,2];a.extra=1;refuse(a);
});

'use strict';
/* Rangement R (plan 5.0) : DECISIONS.md est un seul fichier, décisions dans l'ordre des numéros, sans double ni trou hors des
 * exceptions écrites dans tools/decisions-numeros.cjs (D-097 à D-099 : deux décisions chacune ; D-225 à D-229 : jamais attribués). */
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const N=require('../tools/decisions-numeros.cjs');

test('DECISIONS.md : numérotation croissante, doubles et trous limités aux exceptions connues',()=>{
 const r=N.verifier(fs.readFileSync(path.join(__dirname,'..','DECISIONS.md'),'utf8'));
 assert.ok(r.ok,N.rapport(r));
 assert.equal(r.min,1);assert.ok(r.max>=249);
 assert.deepEqual(r.autres,['4.4.2','4.4.3','4.7','4.7b','4.7c']);
});

test('le contrôle voit un double, un trou et un désordre',()=>{
 const base=n=>`## D-${String(n).padStart(3,'0')} — x\n`;
 const ok=[1,2,3].map(base).join('');
 assert.equal(N.verifier(ok).ok,true);
 const double=N.verifier([1,2,2,3].map(base).join(''));assert.equal(double.ok,false);assert.deepEqual(double.doublons.filter(d=>!d.connu).map(d=>d.n),[2]);
 const trou=N.verifier([1,3].map(base).join(''));assert.deepEqual(trou.trous,[{n:2,connu:false}]);
 const desordre=N.verifier([1,3,2].map(base).join(''));assert.deepEqual(desordre.desordre,[{apres:3,n:2}]);
});

'use strict';
/* CH-111 — src/qr.js (QR code du lien d'appairage). Ici : structure (taille par version, trois repères, lignes de synchronisation, module sombre fixe),
 * version choisie selon la longueur, refus au-delà de 213 octets. La LECTURE par un décodeur indépendant (jsQR 1.4.0, installé hors du dépôt) a été
 * mesurée le 12/11 : 107 textes de 1 à 213 octets, versions 1 à 10 et les 8 masques, tous relus à l'identique (rapport de CH-111). Pour la refaire :
 *   CH111_JSQR=/chemin/vers/node_modules/jsqr node --test tests/ch111-qr.test.cjs */
const {test}=require('node:test'),assert=require('node:assert/strict');
const Q=require('../src/qr.js');
const lien=['https:/','/ariane-telecommande.exemple.workers.dev/#k='].join('')+'0123456789ABCDEFGHJKMNPQRSTVWXYZ0123456789ABCDEFGHJKM';

test('structure : taille 17 + 4 v, repères, synchronisation, module sombre',()=>{
 for(const [t,v] of [['a',1],['x'.repeat(30),3],[lien,6],['y'.repeat(213),10]]){const q=Q.matrice(t);assert.equal(q.version,v,t.length+' octets');assert.equal(q.taille,17+4*v);
  const n=q.taille;for(const [cx,cy] of [[3,3],[n-4,3],[3,n-4]])for(let d=-3;d<=3;d++){
   assert.equal(q.sombre(cx+d,cy-3),true);assert.equal(q.sombre(cx-3,cy+d),true);assert.equal(q.sombre(cx+d,cy+3),true);assert.equal(q.sombre(cx+3,cy+d),true);
   if(Math.abs(d)<=1)assert.equal(q.sombre(cx+d,cy),true,'cœur du repère');}
  for(let i=8;i<n-8;i++){assert.equal(q.sombre(i,6),i%2===0);assert.equal(q.sombre(6,i),i%2===0);}
  assert.equal(q.sombre(8,n-8),true,'module sombre');}});

test('le même texte donne le même dessin ; trop long : refusé ; SVG sans rien d’autre que des chemins',()=>{
 assert.deepEqual(Q.matrice(lien).lignes,Q.matrice(lien).lignes);
 assert.throws(()=>Q.matrice('z'.repeat(214)),/trop long/);
 const s=Q.svg(lien);assert.match(s,/^<svg [^>]+><rect [^>]+\/><path d="[Mhvz0-9 -]+" fill="#000"\/><\/svg>$/);});

const jsqr=process.env.CH111_JSQR;
test('lecture par un décodeur indépendant (jsQR)',jsqr?{}:{skip:'CH111_JSQR non donné (mesure faite hors dépôt, voir l’en-tête)'},()=>{
 const jsQR=require(jsqr);let lus=0;
 for(let n=1;n<=213;n+=2){const t=Array.from({length:n},(_,i)=>String.fromCharCode(33+((i*7+n*13)%90))).join(''),q=Q.matrice(t),mod=4,marge=4,W=(q.taille+2*marge)*mod,img=new Uint8ClampedArray(W*W*4).fill(255);
  for(let y=0;y<q.taille;y++)for(let x=0;x<q.taille;x++)if(q.sombre(x,y))for(let dy=0;dy<mod;dy++)for(let dx=0;dx<mod;dx++){const i=(((y+marge)*mod+dy)*W+(x+marge)*mod+dx)*4;img[i]=img[i+1]=img[i+2]=0;}
  assert.equal(jsQR(img,W,W)?.data,t,n+' octets');lus++;}
 assert.equal(lus,107);});

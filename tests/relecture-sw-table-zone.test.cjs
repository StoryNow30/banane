'use strict';
/* Contre-revue de 9c03da5 : (1) une table de la liste d'ESV incomplète (première page non vue, rompue, tronquée) n'est jamais crue,
 * sinon les lignes sont décalées et le statut lu n'est pas celui du cut ; (2) un vert hors zone (liste « À contrôler ») reste en
 * ombre même si un fichier de réglages ouvre cette zone (D-180). */
const {test}=require('node:test'),assert=require('node:assert/strict');
const {H,j,PERMISSIF}=require('./helpers/relecture-essais.cjs');
for(const [nom,tweak] of [['première page non vue',t=>({...t,debut:false})],['table rompue',t=>({...t,rompue:true})],['table tronquée',t=>({...t,tronquee:true})]])
test(`table de la liste incomplète (${nom}) : le cut 109, traité à la main, n'est ni posé ni validé`,async()=>{
 const {b,adapter}=await H.lotRelecture({mode:'corriger',decisions:{108:13,109:14},reglagesProposes:PERMISSIF,relecture:{departMs:0},
  esv:a=>{a.lignes[109]={s:'valid',t:true,v:true};
   const v=a.voisins.bind(a);a.voisins=m=>{const r=v(m);if(!r.ok||!a.apresLot)return r;
    return {...r,table:tweak(r.table),rows:r.rows.map(x=>({...a.ligne(x.i+1),i:x.i}))};};}});
 await H.finPasse(b);
 assert.ok(!adapter.majEspace.some(x=>x.cut===109),`aucune validation sur le cut 109, vu : ${JSON.stringify(adapter.majEspace.map(x=>x.cut))}`);
});
for(const ouvert of [false,true])
test(`vert hors zone (liste « À contrôler », cut 150), interrupteur vert-hors-zone=${ouvert} : jamais corrigé`,async()=>{
 const f=j(PERMISSIF);f.zones['vert-hors-zone'].corriger=ouvert;
 const {b,adapter}=await H.lotRelecture({mode:'corriger',decisions:{150:14},reglagesProposes:f,relecture:{departMs:0},
  esv:(a,bb)=>{const prev=bb.ctx.vertsAControler;bb.ctx.vertsAControler=async x=>({...(await prev(x)),actif:true,verts:[{i:150}]});}});
 await H.finPasse(b);
 assert.ok(!adapter.majEspace.some(x=>x.cut===150),`aucune validation sur le cut 150, vu : ${JSON.stringify(adapter.majEspace.map(x=>x.cut))}`);
});

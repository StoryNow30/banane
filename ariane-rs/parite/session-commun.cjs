'use strict';
/* CH-070 : cas communs des bancs de parité d'ariane-session.
 *  - relevé : entrées des fonctions portées pendant les essais du tronc (tools/ch070-relever.cjs → $CH070_RELEVE_FICHIER,
 *    trames VBA) ; aucune donnée réelle (fixtures des essais) ;
 *  - réel : exports de banane-data (clone hors dépôt, tools/ch064-corpus.cjs), lus un à un, jamais copiés ;
 *  - variantes à graine fixe (mulberry32) : mêmes formes, valeurs perturbées. */
const fs=require('node:fs'),Vba=require('../coquille/vba.js');
function* releve(prefixe){const f=process.env.CH070_RELEVE_FICHIER;if(!f||!fs.existsSync(f))return;
 let i=0;for(const l of fs.readFileSync(f,'utf8').split('\n')){if(!l)continue;const o=JSON.parse(l);if(!o.f||!o.f.startsWith(prefixe))continue;
  yield {id:'releve-'+(i++)+'-'+o.f.slice(prefixe.length),f:o.f.slice(prefixe.length),entree:Vba.decoder(Buffer.from(o.t,'base64'))};}}
function graine(s){return function(){s|=0;s=s+0x6D2B79F5|0;let t=Math.imul(s^s>>>15,1|s);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296;};}
const choisir=(r,l)=>l[Math.floor(r()*l.length)];
/* Copie perturbée : mêmes clés, quelques valeurs changées (chaînes vidées ou « not-observed », nombres −0/NaN/1,5,
 * booléens inversés, champs retirés, tableaux mélangés). Au plus `taux` des feuilles. */
function perturber(v,r,taux=0.05,prof=0){
 if(prof>40)return v;
 if(Array.isArray(v)){const a=v.map(x=>perturber(x,r,taux,prof+1));if(r()<taux&&a.length>1){for(let i=a.length-1;i>0;i--){const j=Math.floor(r()*(i+1));[a[i],a[j]]=[a[j],a[i]];}}return a;}
 if(v&&typeof v==='object'){const o={};for(const k of Object.keys(v)){if(r()<taux/4)continue;o[k]=perturber(v[k],r,taux,prof+1);}return o;}
 if(r()>=taux)return v;
 if(typeof v==='string')return choisir(r,['','not-observed',v+'x',v.toUpperCase(),null]);
 if(typeof v==='number')return choisir(r,[-0,0,NaN,v+0.5,-v,null,String(v),1e21]);
 if(typeof v==='boolean')return !v;
 return choisir(r,[undefined,null,0,'',true]);
}
module.exports={releve,graine,perturber,choisir};

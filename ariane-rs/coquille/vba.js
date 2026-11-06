/* CH-064 : VBA (valeurs binaires Ariane, v1), codec JS. Spécification : chantiers/CH-064/vba.md.
 * encoder(valeur) → Uint8Array (trame canonique) ; decoder(octets, [debut, fin]) → valeur.
 * Refus explicites (TypeError « VBA : … ») plutôt qu'altération silencieuse. */
(function(root,factory){const api=factory();if(typeof module==='object')module.exports=api;else root.ArianeVba=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const ENTETE=[0x56,0x42,0x41,0x01],PROFONDEUR_MAX=512,te=new TextEncoder(),td=new TextDecoder('utf-8',{fatal:true});
 const refus=m=>{throw new TypeError('VBA : '+m);};
 const bienForme=typeof String.prototype.isWellFormed==='function'?s=>s.isWellFormed():s=>!/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?:^|[^\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(s);
 const PROTO_OBJ=Object.prototype;
 function Ecrivain(taille){this.o=new Uint8Array(taille||1<<16);this.dv=new DataView(this.o.buffer);this.p=0;}
 Ecrivain.prototype.place=function(n){if(this.p+n<=this.o.length)return;let t=this.o.length*2;while(t<this.p+n)t*=2;const o=new Uint8Array(t);o.set(this.o.subarray(0,this.p));this.o=o;this.dv=new DataView(o.buffer);};
 Ecrivain.prototype.u8=function(b){this.place(1);this.o[this.p++]=b;};
 Ecrivain.prototype.u32=function(n){if(n>0xffffffff)refus('longueur excessive');this.place(4);this.dv.setUint32(this.p,n,true);this.p+=4;};
 Ecrivain.prototype.f64=function(x){this.place(8);this.dv.setFloat64(this.p,x,true);this.p+=8;};
 Ecrivain.prototype.bourrage=function(){const r=this.p&7;if(r){const n=8-r;this.place(n);for(let i=0;i<n;i++)this.o[this.p++]=0;}};
 Ecrivain.prototype.chaine=function(s){if(!bienForme(s))refus('chaîne mal formée (surrogat isolé)');
  const n=s.length;this.place(4+n*3);let ascii=true;for(let i=0;i<n;i++){const c=s.charCodeAt(i);if(c>0x7f){ascii=false;break;}this.o[this.p+4+i]=c;}
  if(ascii){this.dv.setUint32(this.p,n,true);this.p+=4+n;return;}
  const r=te.encodeInto(s,this.o.subarray(this.p+4));this.dv.setUint32(this.p,r.written,true);this.p+=4+r.written;};
 /* Propriétés non indicielles : Object.keys compte les indices présents ET les autres clés. */
 function clesEnPlus(a,presents){return Object.keys(a).length!==presents;}
 function genre(a){ // 0x0A, 0x09 (avec k), 0x0B ou 0x06
  const n=a.length;if(!n)return [0x06];const t=a[0];
  if(typeof t==='number'){for(let i=1;i<n;i++)if(typeof a[i]!=='number')return [0x06];return [0x0A];}
  if(typeof t==='boolean'){for(let i=1;i<n;i++)if(typeof a[i]!=='boolean')return [0x06];return [0x0B];}
  if(Array.isArray(t)){const k=t.length;if(k<1||k>255)return [0x06];
   for(let i=0;i<n;i++){const r=a[i];if(!Array.isArray(r)||r.length!==k)return [0x06];for(let j=0;j<k;j++)if(typeof r[j]!=='number')return [0x06];}
   return [0x09,k];}
  return [0x06];
 }
 Ecrivain.prototype.valeur=function(v,prof){
  if(prof>PROFONDEUR_MAX)refus('profondeur excessive (cycle ?)');
  switch(typeof v){
   case 'undefined':return this.u8(0x00);
   case 'boolean':return this.u8(v?0x03:0x02);
   case 'number':this.u8(0x04);return this.f64(v);
   case 'string':this.u8(0x05);return this.chaine(v);
   case 'object':break;
   default:refus('type non pris en charge : '+typeof v);
  }
  if(v===null)return this.u8(0x01);
  if(Array.isArray(v)){
   const n=v.length;
   // Trous et propriétés non indicielles : le chemin rapide (blocs) suppose un tableau dense et nu.
   const g=genre(v);
   if(g[0]!==0x06){
    if(clesEnPlus(v,n))refus('tableau portant des propriétés non indicielles');
    if(g[0]===0x0A){this.u8(0x0A);this.u32(n);this.bourrage();this.place(n*8);for(let i=0;i<n;i++){this.dv.setFloat64(this.p,v[i],true);this.p+=8;}return;}
    if(g[0]===0x0B){this.u8(0x0B);this.u32(n);this.place(n);for(let i=0;i<n;i++)this.o[this.p++]=v[i]?1:0;return;}
    const k=g[1];this.u8(0x09);this.u32(n);this.u8(k);this.bourrage();this.place(n*k*8);
    for(let i=0;i<n;i++){const r=v[i];for(let j=0;j<k;j++){this.dv.setFloat64(this.p,r[j],true);this.p+=8;}}return;
   }
   {let presents=0;for(let i=0;i<n;i++)if(v[i]!==undefined||i in v)presents++;if(clesEnPlus(v,presents))refus('tableau portant des propriétés non indicielles');}
   this.u8(0x06);this.u32(n);
   for(let i=0;i<n;i++){const e=v[i];if(e===undefined&&!(i in v))this.u8(0x07);else this.valeur(e,prof+1);}
   return;
  }
  const proto=Object.getPrototypeOf(v);
  if(proto!==PROTO_OBJ)refus(proto===null?'objet sans prototype':'objet non simple : '+(v.constructor&&v.constructor.name||'?'));
  const cles=Object.keys(v);this.u8(0x08);this.u32(cles.length);
  for(let i=0;i<cles.length;i++){const c=cles[i];this.chaine(c);this.valeur(v[c],prof+1);}
 };
 function encoder(v,taille){const e=new Ecrivain(taille);for(const b of ENTETE)e.u8(b);e.valeur(v,0);return e.o.subarray(0,e.p);}
 // Taille de la trame sans l'écrire n'est pas fournie : l'écrivain grandit par doublement.

 function decoder(octets,debut=0,fin=octets.length){
  const o=octets,dv=new DataView(o.buffer,o.byteOffset,o.byteLength),base=o.byteOffset;let p=debut;
  const reste=n=>{if(p+n>fin)refus('trame tronquée');};
  const u32=()=>{reste(4);const n=dv.getUint32(p,true);p+=4;return n;};
  const chaine=()=>{const n=u32();reste(n);let s;
   if(n<64){let ascii=true;for(let i=0;i<n;i++)if(o[p+i]>0x7f){ascii=false;break;}
    if(ascii){s='';for(let i=0;i<n;i++)s+=String.fromCharCode(o[p+i]);p+=n;return s;}}
   s=td.decode(o.subarray(p,p+n));p+=n;return s;};
  const bourrage=()=>{while((p-debut)&7){reste(1);if(o[p++]!==0)refus('bourrage non nul');}};
  const nombres=n=>{reste(n*8);let vue=null;if(((base+p)&7)===0)vue=new Float64Array(o.buffer,base+p,n);const a=new Array(n);
   if(vue)for(let i=0;i<n;i++)a[i]=vue[i];else for(let i=0;i<n;i++)a[i]=dv.getFloat64(p+i*8,true);p+=n*8;return a;};
  function valeur(prof,dansTableau){
   if(prof>PROFONDEUR_MAX)refus('profondeur excessive');reste(1);const t=o[p++];
   switch(t){
    case 0x00:return undefined;case 0x01:return null;case 0x02:return false;case 0x03:return true;
    case 0x04:{reste(8);const x=dv.getFloat64(p,true);p+=8;return x;}
    case 0x05:return chaine();
    case 0x06:{const n=u32(),a=new Array(n);for(let i=0;i<n;i++){if(p<fin&&o[p]===0x07){p++;continue;}a[i]=valeur(prof+1,true);}return a;}
    case 0x07:refus(dansTableau?'trou mal placé':'trou hors tableau');
    case 0x08:{const n=u32(),r={};for(let i=0;i<n;i++){const c=chaine();r[c]=valeur(prof+1,false);}return r;}
    case 0x09:{const n=u32();reste(1);const k=o[p++];if(!n||!k)refus('bloc vide');bourrage();reste(n*k*8);
     const a=new Array(n);let vue=null;if(((base+p)&7)===0)vue=new Float64Array(o.buffer,base+p,n*k);
     for(let i=0;i<n;i++){const r=new Array(k);for(let j=0;j<k;j++)r[j]=vue?vue[i*k+j]:dv.getFloat64(p+(i*k+j)*8,true);a[i]=r;}p+=n*k*8;return a;}
    case 0x0A:{const n=u32();if(!n)refus('tableau de nombres vide');bourrage();return nombres(n);}
    case 0x0B:{const n=u32();if(!n)refus('tableau de booléens vide');reste(n);const a=new Array(n);for(let i=0;i<n;i++){const b=o[p++];if(b>1)refus('booléen invalide');a[i]=b===1;}return a;}
    case 0x0C:{const nom=chaine(),message=chaine();return {__erreurVba:true,nom,message};}
    default:refus('étiquette inconnue '+t);
   }
  }
  reste(4);for(let i=0;i<4;i++)if(o[p+i]!==ENTETE[i])refus('en-tête absent');p+=4;
  const v=valeur(0,false);if(p!==fin)refus('octets après la racine');return v;
 }
 return {ENTETE,encoder,decoder};
});

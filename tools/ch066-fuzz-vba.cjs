#!/usr/bin/env node
'use strict';
/* CH-066 : fuzz différentiel du format VBA (codec JS ariane-rs/coquille/vba.js, cœur Rust par la coquille coeur.js).
 *   node tools/ch066-fuzz-vba.cjs [--graine N] [--cas N] [--sans-coeur] [--json SORTIE]
 *                                 [--ecrire-trames FICHIER] [--lire-trames FICHIER]
 * Propriété JS : pour toute valeur v générée, encoder(v) est REFUSÉ par une TypeError « VBA : … », ou
 *   decoder(encoder(v)) est identique à v (Object.is sur chaque nombre, clés propres et leur ordre, symboles et propriétés
 *   non énumérables compris, descripteurs, prototypes, trous, identité des références partagées).
 * Propriété croisée (cœur WASM, fonction 0 = écho) : la trame JS revient du Rust OCTET POUR OCTET, et sa lecture JS est v.
 * Trames malformées (mutations de trames valides et trames forgées) : le JS et le Rust prennent la MÊME décision
 *   (refus des deux côtés, ou acceptation des deux côtés avec la même trame réencodée) ; tout refus JS est une
 *   TypeError « VBA : … ».
 * --ecrire-trames : écrit les trames valides générées (u32 longueur + octets) pour l'essai natif Rust
 *   (CH066_TRAMES_JS=FICHIER cargo test -p ariane-vba --test ch066_croise).
 * --lire-trames : lit des trames écrites par le Rust (CH066_TRAMES_RUST) et vérifie que le JS les relit et les réécrit
 *   octet pour octet.
 * Aucune donnée réelle : tout est tiré d'un générateur à graine fixe. Sortie : compte des cas, écarts par nature. */
const fs=require('node:fs'),path=require('node:path');
const Vba=require('../ariane-rs/coquille/vba.js');

/* ---------- générateur à graine fixe (xorshift128+ sur 32 bits, reproductible partout) ---------- */
function Alea(graine){let a=graine>>>0||1,b=0x9e3779b9,c=0x85ebca6b,d=0xc2b2ae35;
 const u32=()=>{const t=b<<9;let r=a*5;r=(r<<7|r>>>25)*9;c^=a;d^=b;b^=c;a^=d;c^=t;d=d<<11|d>>>21;return r>>>0;};
 for(let i=0;i<16;i++)u32();
 const ent=n=>Math.floor(u32()/4294967296*n);
 return {u32,ent,choix:t=>t[ent(t.length)],proba:p=>u32()/4294967296<p};}

/* ---------- valeurs ---------- */
const NOMBRES_SPECIAUX=[0,-0,NaN,Infinity,-Infinity,5e-324,-5e-324,2.2250738585072014e-308,2.225073858507201e-308,Number.MAX_VALUE,
 Number.MIN_SAFE_INTEGER,Number.MAX_SAFE_INTEGER,2**53,2**53+2,-(2**53)-2,2**64,1e308,0.1,-1.5,4294967295,4294967296,2**31,-(2**31)];
function nombre(r){
 switch(r.ent(5)){
  case 0:return r.choix(NOMBRES_SPECIAUX);
  case 1:{const dv=new DataView(new ArrayBuffer(8));dv.setUint32(0,r.u32());dv.setUint32(4,r.u32());return dv.getFloat64(0);} // bits quelconques (NaN à charge, sous-normaux)
  case 2:return r.ent(2000)-1000;
  case 3:return (r.u32()-2147483648)/r.u32();
  default:return (r.proba(.5)?-1:1)*2**(53+r.ent(970))*(1+r.ent(1000)/1000); // entiers au-delà de 2^53
 }
}
const CARACTERES=['a','Z','0','é','💥','\u0000','﻿',' ','￿','퟿','','\u{10FFFF}','"','\\','__proto__'];
function chaine(r,{malFormee=true}={}){
 const n=r.proba(.02)?100000+r.ent(200000):r.ent(12);let s='';
 if(n>1000)return 'x'.repeat(n-1)+r.choix(CARACTERES); // très longue
 for(let i=0;i<n;i++){
  if(malFormee&&r.proba(.03)){s+=r.choix(['\uD800','\uDBFF','\uDC00','\uDFFF']);continue;} // surrogat isolé
  s+=r.proba(.6)?String.fromCharCode(97+r.ent(26)):r.choix(CARACTERES);
 }
 return s;
}
const CLES=['a','b','z','__proto__','constructor','toString','hasOwnProperty','valueOf','0','1','2','10','-1','01','1.5','4294967294','4294967295','9007199254740993','','é','﻿','\u0000','length','__erreurVba','nom','message'];
function cle(r){return r.proba(.75)?r.choix(CLES):chaine(r);}

/* Une valeur quelconque, profondeur bornée. Les formes « exotiques » (prototype, descripteurs, symboles) sont tirées
 * à faible probabilité, pour couvrir le chemin général sans noyer le reste. */
function valeur(r,prof=0){
 const feuille=prof>=4||r.proba(.35+prof*.1);
 if(feuille){
  switch(r.ent(9)){
   case 0:return undefined;case 1:return null;case 2:return r.proba(.5);
   case 3:case 4:return nombre(r);
   case 5:case 6:return chaine(r);
   case 7:return r.choix([1n,Symbol('s'),()=>1,new Date(0),new Map(),/x/,new Float64Array(2),new Uint8Array(1),new ArrayBuffer(8),new Number(1),new String('x'),new Boolean(false)]);
   default:return r.proba(.5)?[]:{};
  }
 }
 switch(r.ent(9)){
  case 0:case 1:{const n=1+r.ent(8),a=[];for(let i=0;i<n;i++)a.push(nombre(r));return habiller(r,a);}       // 0A
  case 2:{const n=1+r.ent(6),a=[];for(let i=0;i<n;i++)a.push(r.proba(.5));return habiller(r,a);}               // 0B
  case 3:{const n=1+r.ent(5),k=r.proba(.1)?r.choix([255,256,257]):1+r.ent(4),a=[];                                // 09 de toutes tailles
   for(let i=0;i<n;i++){const l=[];for(let j=0;j<k;j++)l.push(nombre(r));a.push(l);}
   if(r.proba(.1))a[r.ent(n)].length=k-1; // une ligne plus courte : pas un bloc
   for(let i=0;i<n;i++)if(r.proba(.05))habiller(r,a[i]);
   return habiller(r,a);}
  case 4:case 5:{const n=r.ent(6),a=new Array(n);for(let i=0;i<n;i++)if(!r.proba(.15))a[i]=valeur(r,prof+1);return habiller(r,a);} // 06, trous
  default:{const o=r.proba(.04)?Object.create(null):{};const n=r.ent(6);
   for(let i=0;i<n;i++){const c=cle(r),v=valeur(r,prof+1);if(c==='__proto__')Object.defineProperty(o,c,{value:v,writable:true,enumerable:true,configurable:true});else o[c]=v;}
   return habiller(r,o);}
 }
}
/* Formes exotiques posées sur un tableau ou un objet. */
function habiller(r,x){
 if(!r.proba(.12))return x;
 switch(r.ent(9)){
  case 0:x.extra=1;break;                                                                          // propriété en plus
  case 1:x[Symbol('s')]=1;break;                                                                   // symbole
  case 2:Object.defineProperty(x,'cachee',{value:1,enumerable:false});break;                       // non énumérable
  case 3:Object.defineProperty(x,Array.isArray(x)&&x.length?'0':'g',{get:()=>7,enumerable:true,configurable:true});break; // accesseur
  case 4:if(Array.isArray(x)){Object.setPrototypeOf(x,class Sous extends Array{}.prototype);}else Object.setPrototypeOf(x,{herite:1});break; // prototype autre
  case 5:Object.freeze(x);break;
  case 6:if(Array.isArray(x)&&x.length){Object.defineProperty(x,'0',{value:x[0],enumerable:false,writable:true,configurable:true});x.extra=2;}break; // indice non énumérable + clé en plus
  case 7:Object.preventExtensions(x);break;
  default:if(Array.isArray(x))x.length+=1;else x.length=3;break;                                    // trou final / clé length
 }
 return x;
}

/* ---------- comparaison stricte ---------- */
function nature(chemin,quoi,a,b){return {chemin:chemin||'(racine)',quoi,attendu:montrer(a),obtenu:montrer(b)};}
function montrer(x){try{if(typeof x==='number')return Object.is(x,-0)?'-0':String(x);if(typeof x==='string')return JSON.stringify(x.length>40?x.slice(0,40)+'…':x);if(typeof x==='symbol'||typeof x==='bigint'||typeof x==='function')return String(x).slice(0,40);
 const s=JSON.stringify(x);return s===undefined?String(x):(s.length>80?s.slice(0,80)+'…':s);}catch{return '?';}}
function comparer(a,b){
 const vus=new Map(); // objet d'origine → objet décodé (identité des références partagées)
 function cmp(a,b,ch){
  if(typeof a!==typeof b)return nature(ch,'type',a,b);
  if(typeof a==='number')return Object.is(a,b)?null:(Number.isNaN(a)&&Number.isNaN(b)?null:nature(ch,'nombre',a,b));
  if(a===null||typeof a!=='object')return a===b?null:nature(ch,'valeur',a,b);
  if(b===null)return nature(ch,'valeur',a,b);
  if(vus.has(a))return vus.get(a)===b?null:nature(ch,'référence partagée dédoublée',a,b);
  vus.set(a,b);
  if(Array.isArray(a)!==Array.isArray(b))return nature(ch,'tableau/objet',a,b);
  if(Object.getPrototypeOf(a)!==Object.getPrototypeOf(b))return nature(ch,'prototype',a,b);
  if(Object.isExtensible(a)!==Object.isExtensible(b)||Object.isFrozen(a)!==Object.isFrozen(b))return nature(ch,'gel ou extensibilité',a,b);
  const ka=Reflect.ownKeys(a),kb=Reflect.ownKeys(b);
  for(let i=0;i<Math.max(ka.length,kb.length);i++){
   if(ka[i]===kb[i])continue;
   const manque=ka.find(k=>!kb.includes(k));
   if(manque!==undefined){const d=Object.getOwnPropertyDescriptor(a,manque);
    return nature(ch+'.'+String(manque),typeof manque==='symbol'?'clé symbole perdue':!d.enumerable?'propriété non énumérable perdue':'clé perdue',a[manque],undefined);}
   const enPlus=kb.find(k=>!ka.includes(k));
   if(enPlus!==undefined)return nature(ch+'.'+String(enPlus),'clé en plus',undefined,b[enPlus]);
   return nature(ch,'ordre des clés',ka.map(String),kb.map(String));
  }
  for(const k of ka){
   const da=Object.getOwnPropertyDescriptor(a,k),db=Object.getOwnPropertyDescriptor(b,k);
   if(('get' in da)!==('get' in db))return nature(ch+'.'+String(k),'accesseur devenu donnée',undefined,db.value);
   if(da.enumerable!==db.enumerable||da.configurable!==db.configurable||('writable' in da&&da.writable!==db.writable))return nature(ch+'.'+String(k),'descripteur',da,db);
   if('get' in da)continue;
   const e=cmp(da.value,db.value,ch+(Array.isArray(a)?'['+String(k)+']':'.'+String(k)));if(e)return e;
  }
  return null;
 }
 return cmp(a,b,'');
}

/* ---------- trames ---------- */
const egalOctets=(x,y)=>x.length===y.length&&Buffer.compare(Buffer.from(x.buffer,x.byteOffset,x.length),Buffer.from(y.buffer,y.byteOffset,y.length))===0;
const hex=(t,max=48)=>Buffer.from(t.buffer,t.byteOffset,Math.min(t.length,max)).toString('hex').replace(/(..)/g,'$1 ').trim()+(t.length>max?' …':'');
const estRefusVba=e=>e instanceof TypeError&&/^VBA : /.test(e.message);
function muter(r,t){
 const o=Uint8Array.from(t);
 switch(r.ent(7)){
  case 0:return o.slice(0,r.ent(o.length));                                               // tronquée
  case 1:{if(o.length>4)o[4+r.ent(o.length-4)]^=1<<r.ent(8);return o;}                    // un bit
  case 2:{if(o.length>4)o[4+r.ent(o.length-4)]=r.ent(256);return o;}                      // un octet
  case 3:{if(o.length<9)return o;const p=4+r.ent(o.length-8);new DataView(o.buffer).setUint32(p,r.choix([0xffffffff,0x7fffffff,0x80000001,0x20000000,0x10000,0]),true);return o;} // taille énorme
  case 4:{if(o.length>4)o[4+r.ent(o.length-4)]=0x0d+r.ent(0xf3);return o;}                 // étiquette inconnue
  case 5:{const p=Uint8Array.from([...o,...Array.from({length:1+r.ent(8)},()=>r.ent(256))]);return p;} // octets en plus
  default:{const a=4+r.ent(Math.max(1,o.length-4)),b=a+r.ent(8);return Uint8Array.from([...o.slice(0,a),...o.slice(b)]);} // trou dans la trame
 }
}
const F=(...x)=>Uint8Array.from([0x56,0x42,0x41,0x01,...x]);
const u32le=n=>[n&255,n>>>8&255,n>>>16&255,n>>>24&255];
/* Trames forgées : non canoniques mais lisibles, et cas limites de taille. */
const FORGEES=[
 ['06 de nombres (au lieu de 0A)',F(0x06,...u32le(2),0x04,0,0,0,0,0,0,0xf0,0x3f,0x04,0,0,0,0,0,0,0,0x40)],
 ['06 de booléens (au lieu de 0B)',F(0x06,...u32le(1),0x03)],
 ['objet à clé en double',F(0x08,...u32le(2),...u32le(1),0x61,0x02,...u32le(1),0x61,0x03)],
 ['objet à clés entières dans le désordre',F(0x08,...u32le(2),...u32le(1),0x62,0x01,...u32le(1),0x31,0x01)],
 ['erreur 0C imbriquée dans un tableau',F(0x06,...u32le(1),0x0c,...u32le(5),...Buffer.from('Error'),...u32le(1),0x78)],
 ['erreur 0C en racine',F(0x0c,...u32le(5),...Buffer.from('Error'),...u32le(1),0x78)],
 ['0A de longueur 0',F(0x0a,...u32le(0))],
 ['bloc k = 0',F(0x09,...u32le(1),0x00,0,0)],
 ['chaîne UTF-8 trop longue (C0 80)',F(0x05,...u32le(2),0xc0,0x80)],
 ['chaîne avec BOM UTF-8',F(0x05,...u32le(3),0xef,0xbb,0xbf)],
 ['chaîne surrogat encodé (ED A0 80)',F(0x05,...u32le(3),0xed,0xa0,0x80)],
 ['tableau n = 2^32-1 tronqué',F(0x06,...u32le(0xffffffff),0x07)],
 ['objet n = 2^32-1 tronqué',F(0x08,...u32le(0xffffffff))],
 ['bloc n×k débordant 2^32',F(0x09,...u32le(0x80000001),0x02,0,0,0,0,0,0)],
 ['tableau de 70 000 trous',F(0x06,...u32le(70000),...new Array(70000).fill(0x07))],
 ['513 tableaux imbriqués',F(...new Array(513).fill(0).flatMap(()=>[0x06,...u32le(1)]),0x00)],
 ['512 tableaux imbriqués',F(...new Array(512).fill(0).flatMap(()=>[0x06,...u32le(1)]),0x00)],
 ['512 tableaux n = 2^32-1 imbriqués puis tronqués',F(...new Array(512).fill(0).flatMap(()=>[0x06,...u32le(0xffffffff)]))],
 ['512 objets n = 2^32-1 imbriqués puis tronqués',F(...new Array(512).fill(0).flatMap(()=>[0x08,...u32le(0xffffffff),...u32le(1),0x61]))],
];

/* ---------- cas ciblés (déterministes) : chacun est aussi un essai rouge de tools/ch066-essais-rouges.cjs ---------- */
function cible(){
 const sousTableau=class Sous extends Array{};
 const sous=sousTableau.from([1,2]);
 const indiceCache=[1,2];Object.defineProperty(indiceCache,'0',{value:1,enumerable:false,writable:true,configurable:true});indiceCache.extra=9;
 const nonEnumTab=[1,2];Object.defineProperty(nonEnumTab,'x',{value:3,enumerable:false});
 const symTab=[1,2];symTab[Symbol('s')]=3;
 const symObj={a:1,[Symbol('s')]:2};
 const nonEnumObj={a:1};Object.defineProperty(nonEnumObj,'b',{value:2,enumerable:false});
 const getter={get a(){return 1;}};
 const gele=Object.freeze({a:1});
 const partage=[1,2],dag={x:partage,y:partage};
 const protoTab=[1,2];Object.setPrototypeOf(protoTab,null);
 const erreurLegitime={__erreurVba:true,nom:'Error',message:'valeur métier'};
 return [
  ['sous-classe de Array',sous],['ligne de bloc sous-classe',[sousTableau.from([1,2]),[3,4]]],['tableau sans prototype',protoTab],
  ['indice non énumérable + clé en plus',indiceCache],['tableau à propriété non énumérable',nonEnumTab],['tableau à clé symbole',symTab],
  ['objet à clé symbole',symObj],['objet à propriété non énumérable',nonEnumObj],['objet à accesseur',getter],['objet gelé',gele],
  ['références partagées',dag],['objet {__erreurVba:true,nom,message}',erreurLegitime],
  ['-0 et NaN',[-0,NaN,{a:-0}]],['U+FEFF en tête',['﻿a',{'﻿':1}]],['U+0000',['\u0000',{'\u0000':'\u0000'}]],
  ['clé __proto__',JSON.parse('{"__proto__":{"a":1},"b":2}')],['clé constructor',{constructor:1}],['clés numériques',{b:1,2:2,1:3,'-1':4,'01':5}],
  ['tableau creux',[1,,3]],['bloc 255',[new Array(255).fill(1.5)]],['bloc 256 (pas un bloc)',[new Array(256).fill(1.5)]],
 ];
}

/* ---------- exécution ---------- */
function main(){
 const args=process.argv.slice(2),opt=(n,d)=>args.includes(n)?args[args.indexOf(n)+1]:d;
 const graine=Number(opt('--graine',66)),cas=Number(opt('--cas',20000)),sortieJson=opt('--json',null);
 const r=Alea(graine);
 let coeur=null;
 if(!args.includes('--sans-coeur')){
  try{const {construire}=require('./ch064-construire.cjs'),w=construire({silencieux:true});if(w)coeur=require('../ariane-rs/coquille/coeur.js').creer(fs.readFileSync(w));}
  catch(e){console.error('cœur WASM indisponible : '+e.message.split('\n')[0]);}
 }
 const res={format:'ch066-fuzz-vba-v1',moteur:'node '+process.version,graine,coeur:!!coeur,
  valeurs:{generees:0,acceptees:0,refusees:0,identiques:0,croisees:0},trames:{generees:0,refusJs:0,refusRust:0,accepteesDesDeux:0},
  ecarts:{}};
 const noter=(cle,exemple)=>{const e=res.ecarts[cle]||(res.ecarts[cle]={n:0,exemples:[]});e.n++;if(e.exemples.length<3)e.exemples.push(exemple);};
 const valides=[];
 function essayerValeur(v,etiquette){
  res.valeurs.generees++;
  let t;
  try{t=Vba.encoder(v);}catch(e){if(estRefusVba(e)){res.valeurs.refusees++;return;}noter('JS encodeur : exception hors « VBA : » ('+e.constructor.name+')',{cas:etiquette,message:String(e.message).slice(0,120)});return;}
  res.valeurs.acceptees++;
  let w;try{w=Vba.decoder(t);}catch(e){noter('JS : trame de l\'encodeur refusée par le décodeur',{cas:etiquette,message:e.message,trame:hex(t)});return;}
  const d=comparer(v,w);
  if(d)noter('JS : valeur acceptée rendue modifiée — '+d.quoi,{cas:etiquette,...d});else res.valeurs.identiques++;
  if(t.length<1<<20&&valides.length<5000)valides.push(t);
  if(!coeur)return;
  res.valeurs.croisees++;
  let ro;try{ro=coeur.appelerOctets(0,t).octets;coeur.apresAppel();}catch(e){noter('Croisé : trame valide refusée ou trappe du cœur',{cas:etiquette,message:e.message,trame:hex(t)});return;}
  if(!egalOctets(ro,t)){noter('Croisé : la trame ne revient pas octet pour octet',{cas:etiquette,envoyee:hex(t),rendue:hex(ro)});return;}
  let x;try{x=coeur.appeler(0,v);coeur.apresAppel();}catch(e){noter('Croisé : écho levé en exception',{cas:etiquette,exception:e.constructor.name+' : '+e.message});return;}
  const d2=comparer(v,x);if(d2&&!d)noter('Croisé : valeur rendue modifiée par le cœur seul — '+d2.quoi,{cas:etiquette,...d2});
 }
 function essayerTrame(t,etiquette){
  res.trames.generees++;
  let j,okJ=false,ej=null;
  try{j=Vba.decoder(t);okJ=true;}catch(e){ej=e;if(!estRefusVba(e))noter('JS décodeur : exception hors « VBA : » ('+e.constructor.name+')',{cas:etiquette,message:String(e.message).slice(0,120),trame:hex(t)});}
  if(!okJ)res.trames.refusJs++;
  let reencJ=null;if(okJ){try{reencJ=Vba.encoder(j);}catch(e){reencJ=e;}}
  if(okJ&&!(reencJ instanceof Uint8Array&&egalOctets(reencJ,t)))noter('JS : trame lisible mais non canonique (decoder puis encoder ≠ trame)',{cas:etiquette,trame:hex(t),reencodee:reencJ instanceof Uint8Array?hex(reencJ):String(reencJ.message)});
  if(!coeur)return;
  let ro;try{ro=coeur.appelerOctets(0,t).octets;coeur.apresAppel();}catch(e){
   if(e&&e.name==='HorsDomaine'){noter('Rust : trappe du cœur (refus récupérable HorsDomaine)',{cas:etiquette,message:e.message,trame:hex(t),hauteEauOctets:coeur.etat().hauteEau});if(okJ)noter('Divergence : JS accepte, Rust trappe',{cas:etiquette,trame:hex(t)});return;}
   noter('Rust : exception de la coquille',{cas:etiquette,message:e.message});return;}
  const okR=!(ro.length>4&&ro[4]===0x0c&&(()=>{try{const e=Vba.decoder(ro);return e&&e.__erreurVba===true&&e.nom==='TypeError'&&/^VBA : /.test(e.message);}catch{return false;}})());
  if(!okR)res.trames.refusRust++;
  if(okR&&!egalOctets(ro,t))noter('Rust : décoder puis encoder ≠ trame',{cas:etiquette,trame:hex(t),rendue:hex(ro)});
  if(okJ&&okR)res.trames.accepteesDesDeux++;
  if(okJ!==okR)noter(okJ?'Divergence : JS accepte, Rust refuse':'Divergence : Rust accepte, JS refuse',{cas:etiquette,trame:hex(t),js:okJ?'accepte':ej.message,rust:okR?'accepte':Vba.decoder(ro).message});
 }
 for(const [nom,v] of cible())essayerValeur(v,'ciblé : '+nom);
 for(let i=0;i<cas;i++)essayerValeur(valeur(r),'aléatoire n° '+i+' (graine '+graine+')');
 for(const [nom,t] of FORGEES)essayerTrame(t,'forgée : '+nom);
 for(let i=0;i<cas&&valides.length;i++)essayerTrame(muter(r,r.choix(valides)),'mutation n° '+i+' (graine '+graine+')');
 if(opt('--ecrire-trames',null)){const f=opt('--ecrire-trames');const parts=[];for(const t of valides){parts.push(Buffer.from(u32le(t.length)),Buffer.from(t));}fs.writeFileSync(f,Buffer.concat(parts));res.tramesEcrites=valides.length;}
 if(opt('--lire-trames',null)){const b=fs.readFileSync(opt('--lire-trames'));let p=0,n=0,ok=0;
  while(p<b.length){const l=b.readUInt32LE(p);p+=4;const t=new Uint8Array(b.subarray(p,p+l));p+=l;n++;
   try{const v=Vba.decoder(t),u=Vba.encoder(v);if(egalOctets(u,t))ok++;else noter('Rust → JS : trame Rust relue et réécrite autrement par le JS',{trame:hex(t),reencodee:hex(u)});}
   catch(e){noter('Rust → JS : trame Rust refusée par le JS',{trame:hex(t),message:e.message});}}
  res.tramesRust={lues:n,identiques:ok};}
 if(coeur)res.coeurEtat=coeur.etat();
 if(sortieJson){fs.mkdirSync(path.dirname(path.resolve(sortieJson)),{recursive:true});fs.writeFileSync(sortieJson,JSON.stringify(res,null,1)+'\n');}
 console.log(JSON.stringify({valeurs:res.valeurs,trames:res.trames,tramesRust:res.tramesRust,ecarts:Object.fromEntries(Object.entries(res.ecarts).map(([k,v])=>[k,v.n]))},null,1));
 return res;
}
module.exports={Alea,valeur,comparer,cible,FORGEES,muter};
if(require.main===module)main();

'use strict';
/* CH-064-D : cas du banc de parité de la décision (ariane-rs/parite/decision.cjs).
 *   cas(modules, {fixtures, reel, variantes, graine, max})
 * (1) fixtures : appels relevés dans les essais du tronc (tools/ch064-d-fixtures.cjs → ariane-rs/dist/ch064-d-fixtures.v8) ;
 * (2) réel : entrées reconstruites des exports de banane-data (journaux et nuages des 04, 05 et 06/11 ; tools/ch064-d-reel.cjs) ;
 * (3) variantes : chaque fixture et chaque cas réel muté à graine fixe (une feuille remplacée par une valeur d'un lot de
 *     valeurs limites, ou une clé retirée), pour couvrir les branches de validation et de coercition.
 * Un cas = {id, entree:{module, f, args: base64 VBA du tableau d'arguments}} ; un appel dont les arguments ne passent pas en
 * VBA (Map, Set, fonctions…) est compté (`nonVba`) et laissé : il n'atteindrait jamais le cœur. */
const fs=require('node:fs'),path=require('node:path'),v8=require('node:v8');
const Vba=require('../ariane-rs/coquille/vba.js');
const RACINE=path.resolve(__dirname,'..');
const FIXTURES=path.join(RACINE,'ariane-rs','dist','ch064-d-fixtures.v8');
const compte={nonVba:0,fixtures:0,reel:0,variantes:0};
function graine(n){let a=n>>>0;return ()=>{a=a+0x6D2B79F5>>>0;let t=a;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return ((t^t>>>14)>>>0)/4294967296;};}
const LIMITES=[undefined,null,true,false,0,-0,1,-1,2,3,0.05,0.5,4.4,7.95,8,15,40,41,45,45.01,100,150,1420,1e21,1e-7,NaN,Infinity,-Infinity,
 '','a','0','1.5','vert','propose','defaut','R1','R3','first-pass','window','choice','crossing','deferred','pn','adv','abords','ecartement','vert-hors-zone',
 'differe','lot','rapide','reference','captured','signal','stabilite','shift-out-of-domain','s1','chaine','ariane-relecture-reglages-1',[],[1],[0,1,2],[null],{},{a:1}];
/* Une variante qui ferait tourner le JS sans fin (plages de cuts démesurées dans `selection`) n'est pas un cas : écartée. */
function borne(v,prof=0){if(typeof v==='number')return Number.isNaN(v)||Math.abs(v)<=1e5;if(!v||typeof v!=='object'||prof>8)return true;return Object.values(v).every(x=>borne(x,prof+1));}
const SURS={relectureOmbre:{selection:borne}};
function encoder(args){try{return Buffer.from(Vba.encoder(args)).toString('base64');}catch{compte.nonVba++;return null;}}
/* Feuilles et clés d'un arbre : chemins [[clé…]]. */
function chemins(v,p=[],out=[],prof=0){out.push(p);if(prof>6||v===null||typeof v!=='object')return out;
 if(Array.isArray(v)){for(let i=0;i<Math.min(v.length,12);i++)chemins(v[i],[...p,i],out,prof+1);}
 else for(const k of Object.keys(v).slice(0,40))chemins(v[k],[...p,k],out,prof+1);return out;}
function muter(args,alea){const a=v8.deserialize(v8.serialize(args)),cs=chemins(a).filter(c=>c.length>0);if(!cs.length)return null;
 const c=cs[Math.floor(alea()*cs.length)],parent=c.slice(0,-1).reduce((o,k)=>o[k],a),k=c[c.length-1];
 if(alea()<0.15&&!Array.isArray(parent))delete parent[k];
 else{const x=LIMITES[Math.floor(alea()*LIMITES.length)];parent[k]=x&&typeof x==='object'?v8.deserialize(v8.serialize(x)):x;}
 return a;}
function*cas(modules,{fixtures=true,reel=true,variantes=Number(process.env.CH064D_VARIANTES||4),graine:g=Number(process.env.CH064D_GRAINE||64),max=Infinity}={}){
 const alea=graine(g),base=[];
 if(fixtures&&fs.existsSync(FIXTURES)){for(const e of v8.deserialize(fs.readFileSync(FIXTURES)))if(modules.includes(e.module))base.push({id:'fixture-'+e.module+'.'+e.f+'-'+e.essai,module:e.module,f:e.f,args:v8.deserialize(e.args)});}
 if(reel){const R=require('./ch064-d-reel.cjs');for(const c of R.cas(modules,{max}))base.push(c);}
 let i=0;
 for(const c of base){const b=encoder(c.args);if(b===null)continue;compte[c.id.startsWith('fixture')?'fixtures':'reel']++;
  yield {id:c.id+'#'+(i++),entree:{module:c.module,f:c.f,args:b}};
  for(let k=0;k<variantes;k++){const m=muter(c.args,alea);if(!m)break;const sur=SURS[c.module]?.[c.f];if(sur&&!sur(m))continue;const bm=encoder(m);if(bm===null)continue;compte.variantes++;
   yield {id:c.id+'#'+(i++)+'-variante'+k,entree:{module:c.module,f:c.f,args:bm}};}}
}
module.exports={cas,compte,muter,graine};

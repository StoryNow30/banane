#!/usr/bin/env node
'use strict';
/* CH-064 : preuve d'aller-retour VBA sans perte sur TOUS les documents réels (exports des collections du 04 et du 05/11).
 *   node --max-old-space-size=8000 tools/ch064-vba-corpus.cjs [--json SORTIE] [--limite N]
 * Pour chaque document JSON : v = JSON.parse(texte) ;
 *   (1) JS : t = encoder(v), w = decoder(t), comparer(v, w) strict ;
 *   (2) Rust : la trame t traverse le cœur WASM (décodage Rust, réencodage Rust) et doit revenir OCTET POUR OCTET : les deux
 *       codecs sont donc canoniques et d'accord ; son décodage JS doit être égal à v.
 * Temps (médianes par Mo) : JSON.parse, JSON.stringify, encoder, decoder, traversée du cœur. Cas synthétiques en tête. */
const fs=require('node:fs'),path=require('node:path'),{performance}=require('node:perf_hooks');
const Vba=require('../ariane-rs/coquille/vba.js'),Coeur=require('../ariane-rs/coquille/coeur.js');
const {comparer}=require('./ch064-comparer.cjs'),{documents}=require('./ch064-corpus.cjs'),{construire}=require('./ch064-construire.cjs');
const SYNTHETIQUES=[undefined,null,true,false,0,-0,NaN,Infinity,-Infinity,5e-324,'',"é💥\u0000",[],[,],[undefined],[1,,3],[[1,2],[3,4]],[[1],[2,'x']],
 [true,false],[1,'a'],{},{a:undefined},{'2':1,'1':2,z:3,'-1':4},[[-0,NaN],[Infinity,1]],{p:[[1,2,3]]}];
const REFUSES=[[new Date(0),'objet non simple'],[new Map(),'objet non simple'],[1n,'bigint'],['\uD800','surrogat'],[Object.assign([1,2],{x:1}),'propriétés non indicielles'],[()=>1,'function'],[Object.assign(Object.create(null),{a:1}),'sans prototype']];
function compter(v){const c={records:0,clouds:0,events:0,points:0};if(v&&typeof v==='object')for(const k of ['records','clouds','events'])if(Array.isArray(v[k]))c[k]=v[k].length;
 const pile=[v];while(pile.length){const x=pile.pop();if(!x||typeof x!=='object')continue;if(Array.isArray(x)){if(typeof x[0]!=='number'&&!Array.isArray(x[0]))for(const e of x)pile.push(e);continue;}
  for(const k in x){const y=x[k];if(k==='pointsSceneRelative'&&Array.isArray(y))c.points+=y.length;else pile.push(y);}}return c;}
const med=a=>{const b=a.slice().sort((x,y)=>x-y);return b.length?b[b.length>>1]:null;};
function main(){
 const a=process.argv.slice(2),json=a.includes('--json')?a[a.indexOf('--json')+1]:null,limite=a.includes('--limite')?Number(a[a.indexOf('--limite')+1]):Infinity;
 const w=construire({silencieux:true});if(!w)throw Error('cargo absent');
 const coeur=Coeur.creer(fs.readFileSync(w),{seuilReinstanciation:256*1024*1024});
 const res={format:'ch064-vba-corpus-v1',moteur:'node '+process.version,synthetiques:{cas:0,identiques:0,ecarts:[]},refus:{cas:0,refuses:0,ecarts:[]},
  documents:0,octetsJson:0,octetsVba:0,identiquesJs:0,identiquesRust:0,trameRustIdentique:0,totaux:{records:0,clouds:0,events:0,points:0},echecs:[],
  msParMo:{jsonParse:[],jsonStringify:[],encoder:[],decoder:[],coeur:[]},memoireCoeur:null};
 for(const v of SYNTHETIQUES){res.synthetiques.cas++;const e1=comparer(v,Vba.decoder(Vba.encoder(v))),e2=comparer(v,coeur.appeler(0,v));
  if(!e1.length&&!e2.length)res.synthetiques.identiques++;else res.synthetiques.ecarts.push({cas:res.synthetiques.cas,js:e1,rust:e2});}
 for(const [v,motif] of REFUSES){res.refus.cas++;try{Vba.encoder(v);res.refus.ecarts.push('accepté : '+motif);}catch(e){if(e instanceof TypeError&&/^VBA : /.test(e.message))res.refus.refuses++;else res.refus.ecarts.push(motif+' : '+e.message);}}
 let n=0;
 for(const d of documents()){if(n++>=limite)break;
  const t0=performance.now(),v=JSON.parse(d.texte),t1=performance.now();JSON.stringify(v);const t2=performance.now();
  const trame=Vba.encoder(v,d.octets),t3=performance.now(),retour=Vba.decoder(trame),t4=performance.now();
  const r=coeur.appelerOctets(0,trame),t5=performance.now();const memeTrame=r.octets.length===trame.length&&Buffer.compare(Buffer.from(r.octets),Buffer.from(trame))===0;
  const viaRust=Vba.decoder(r.octets);r.liberer();coeur.apresAppel();
  const mo=d.octets/1048576;res.msParMo.jsonParse.push((t1-t0)/mo);res.msParMo.jsonStringify.push((t2-t1)/mo);res.msParMo.encoder.push((t3-t2)/mo);res.msParMo.decoder.push((t4-t3)/mo);res.msParMo.coeur.push((t5-t4)/mo);
  const eJs=comparer(v,retour,{max:5}),eRs=comparer(v,viaRust,{max:5});
  res.documents++;res.octetsJson+=d.octets;res.octetsVba+=trame.length;if(!eJs.length)res.identiquesJs++;if(!eRs.length)res.identiquesRust++;if(memeTrame)res.trameRustIdentique++;
  const c=compter(v);for(const k in c)res.totaux[k]+=c[k];
  if(eJs.length||eRs.length||!memeTrame)res.echecs.push({document:d.entree.replace(/[0-9a-f]{8}-[0-9a-f-]{27}/g,'…'),js:eJs,rust:eRs,memeTrame});
  process.stderr.write('.');
 }
 process.stderr.write('\n');
 for(const k in res.msParMo)res.msParMo[k]=Math.round(med(res.msParMo[k])*10)/10;
 res.memoireCoeur=coeur.etat();
 res.verdict=res.synthetiques.identiques===res.synthetiques.cas&&res.refus.refuses===res.refus.cas&&res.documents>0&&res.identiquesJs===res.documents&&res.identiquesRust===res.documents&&res.trameRustIdentique===res.documents?'IDENTIQUE':'ÉCART';
 const s=JSON.stringify(res,null,1);if(json)fs.writeFileSync(json,s+'\n');console.log(s);if(res.verdict!=='IDENTIQUE')process.exitCode=1;
}
main();

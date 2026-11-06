#!/usr/bin/env node
'use strict';
/* CH-064 : lanceur unique des essais du programme Rust, lancé À PART par l'intégrateur à chaque étape (jamais par verify).
 *   node tools/ch064-essais.cjs [--rapide] [--json SORTIE]
 * Étapes, dans l'ordre ; arrêt à la première en échec :
 *   1. cargo test (ariane-rs/)         2. cargo clippy -D warnings (méthodes de std divergentes interdites)
 *   3. construction WASM               4. sonde numérique, Node et Chromium : portages ariane-js à 0 divergence
 *   5. banc témoin + contrôle négatif (un port faussé doit être VU)
 *   6. aller-retour VBA sur le corpus réel (--rapide : 3 documents ; sinon tous)
 *   7. parité de chaque module porté (ariane-rs/parite/*.cjs hors témoin), dans Node puis dans Chromium (référence) ;
 *      --rapide : 15 nuages par module ; sinon tous les nuages réels
 *   8. lanceurs propres des sous-chantiers, s'ils sont présents (CH-064-L : tools/ch064-l-parite.cjs en Node puis dans
 *      Chromium, code 1 au premier écart ; tools/ch064-l-banc.cjs ; tools/ch064-l-fusion.cjs) */
const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const RACINE=path.resolve(__dirname,'..'),RS=path.join(RACINE,'ariane-rs');
const a=process.argv.slice(2),rapide=a.includes('--rapide'),json=a.includes('--json')?a[a.indexOf('--json')+1]:null;
const bilan={format:'ch064-essais-v1',debut:new Date().toISOString(),etapes:[]};
function etape(nom,f){const t0=Date.now();let ok=false,detail=null;try{detail=f();ok=detail!==false;}catch(e){detail=String(e.message||e).slice(0,2000);}
 bilan.etapes.push({nom,ok,secondes:Math.round((Date.now()-t0)/100)/10,detail});console.error((ok?'ok    ':'ÉCHEC ')+nom+(ok?'':' : '+JSON.stringify(detail).slice(0,500)));
 if(!ok){fin(1);}}
function fin(code){bilan.fin=new Date().toISOString();bilan.verdict=code?'ÉCHEC':'VERT';const s=JSON.stringify(bilan,null,1);if(json)fs.writeFileSync(json,s+'\n');console.log(s);process.exit(code);}
function lancer(cmd,args,opts={}){const r=spawnSync(cmd,args,{cwd:opts.cwd||RACINE,encoding:'utf8',maxBuffer:1<<28});
 if(r.status!==0)throw Error(cmd+' '+args.join(' ')+' : '+((r.stderr||'')+(r.stdout||'')).slice(-1500));return r.stdout;}
etape('cargo test',()=>{const o=lancer('cargo',['test','-q','--workspace'],{cwd:RS});return (o.match(/test result: ok\. (\d+) passed/g)||[]).reduce((s,l)=>s+Number(l.match(/(\d+) passed/)[1]),0)+' essais Rust';});
etape('cargo clippy',()=>{lancer('cargo',['clippy','-q','--workspace','--','-D','warnings'],{cwd:RS});return 'aucun avertissement';});
etape('construction WASM',()=>{const w=require('./ch064-construire.cjs').construire({silencieux:true});if(!w)throw Error('cargo absent');return path.relative(RACINE,w)+' '+fs.statSync(w).size+' octets';});
etape('sonde numérique (Node, Chromium)',()=>{const o=JSON.parse(lancer('node',['tools/ch064-sonde-math.cjs','--tirages','50000','--chromium']));
 const mauvais=[];for(const [m,d] of [['node',o.divergences],['chromium',o.chromium.divergences]])for(const k in d)if(k.startsWith('js_')&&d[k]!==0)mauvais.push(m+':'+k+'='+d[k]);
 if(mauvais.length)throw Error('portage divergent : '+mauvais.join(', '));return {node:o.moteur,chromium:o.chromium.moteur};});
etape('essais de la coquille (audit, PR n° 25 ; plafond de 256 Mio)',()=>{const o=lancer('node',['--test','tools/ch064-essais-coquille.cjs']);const m=o.match(/# pass (\d+)/);return (m?m[1]:'?')+' essais';});
/* trappe du module LiDAR autonome (fusion de CH-064-L) : reprise et appel suivant identique, vues réelles */
if(fs.existsSync(path.join(RACINE,'tools/ch064-essais-lidar-trappe.cjs')))etape('trappe LiDAR puis appel identique',()=>{const o=lancer('node',['--max-old-space-size=8000','--test','tools/ch064-essais-lidar-trappe.cjs']);const m=o.match(/# pass (\d+)/),f=o.match(/# fail (\d+)/);if(f&&f[1]!=='0')throw Error(o.slice(-1500));return (m?m[1]:'?')+' essais';});
etape('banc témoin et contrôle négatif',()=>{const P=require('./ch064-parite.cjs'),C=require('../ariane-rs/coquille/coeur.js'),w=require('./ch064-construire.cjs').construire({silencieux:true});
 const coeur=C.creer(fs.readFileSync(w)),t=require('../ariane-rs/parite/temoin.cjs');
 const bon=P.executer(t,coeur);if(bon.verdict!=='IDENTIQUE')throw Error('témoin : '+JSON.stringify(bon.ecarts));
 const faux={...t,rs:(e,c)=>{const v=c.appeler(0,e);return Object.is(v,-0)?0:v;}},mal=P.executer(faux,coeur);
 if(mal.verdict!=='ÉCART'||mal.identiques!==mal.cas-1)throw Error('le banc ne voit pas un −0 changé en +0');
 return {temoin:bon.identiques+'/'+bon.cas,controleNegatif:'écart vu ('+mal.ecarts[0].ecarts[0].raison+')'};});
etape('aller-retour VBA, corpus réel'+(rapide?' (rapide)':''),()=>{const args=['--max-old-space-size=8000','tools/ch064-vba-corpus.cjs'];if(rapide)args.push('--limite','3');
 const o=JSON.parse(lancer('node',args));if(o.verdict!=='IDENTIQUE')throw Error(JSON.stringify(o.echecs).slice(0,1000));
 return {documents:o.documents,octetsJson:o.octetsJson,totaux:o.totaux};});
const modules=fs.readdirSync(path.join(RS,'parite')).filter(n=>n.endsWith('.cjs')&&n!=='temoin.cjs').map(n=>n.slice(0,-4)).sort();
for(const m of modules)for(const nav of [false,true])etape('parité '+m+(nav?' (Chromium)':' (Node)'),()=>{
 const args=['--max-old-space-size=8000','tools/ch064-parite.cjs','--module',m];if(rapide)args.push('--nuages','15');if(nav)args.push('--chromium');
 const o=JSON.parse(lancer('node',args));if(o.verdict!=='IDENTIQUE')throw Error(JSON.stringify(o.ecarts).slice(0,1000));
 return {cas:o.cas,identiques:o.identiques,repli:o.bilanAdaptateur,empreinte:o.empreintes.js.slice(0,16)};});
/* --rapide : parité de L sur 15 captures, sans ses bancs de temps (qui ne sont pas des essais) ; sinon tout. */
const limiteL=rapide?['--max','15']:[];
const SOUS=[['CH-064-L parité (Node)','tools/ch064-l-parite.cjs',['--moteur','node',...limiteL]],['CH-064-L parité (Chromium)','tools/ch064-l-parite.cjs',['--moteur','chromium',...limiteL]],
 ...(rapide?[]:[['CH-064-L banc','tools/ch064-l-banc.cjs',[]],['CH-064-L fusion','tools/ch064-l-fusion.cjs',[]]])];
for(const [nom,f,args] of SOUS)if(fs.existsSync(path.join(RACINE,f)))etape(nom,()=>{const o=lancer('node',['--max-old-space-size=8000',f,...args]);return o.trim().split('\n').slice(-3).join(' | ').slice(0,400);});
fin(0);

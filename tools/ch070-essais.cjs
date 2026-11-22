#!/usr/bin/env node
'use strict';
/* CH-070 : lanceur des preuves d'ariane-session, À PART (jamais par verify) ; arrêt à la première étape en échec.
 *   CH070_RELEVE_FICHIER=<relevé> node tools/ch070-essais.cjs [--json SORTIE]
 *   1. cargo test -p ariane-session ; 2. clippy -D warnings, natif et wasm32 ; 3. relevé des essais du tronc (si
 *   $CH070_RELEVE_FICHIER est absent : tools/ch070-relever.cjs) ; 4. chaque banc ariane-rs/parite/session-*.cjs, dans
 *   Node puis dans Chromium (locale en-US), et session-resume / session-historique aussi en fr-FR. 0 écart exigé. */
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),{spawnSync}=require('node:child_process');
const RACINE=path.resolve(__dirname,'..'),RS=path.join(RACINE,'ariane-rs');
const a=process.argv.slice(2),json=a.includes('--json')?a[a.indexOf('--json')+1]:null,bilan={format:'ch070-essais-v1',debut:new Date().toISOString(),etapes:[]};
function fin(code){bilan.fin=new Date().toISOString();bilan.verdict=code?'ÉCHEC':'VERT';const s=JSON.stringify(bilan,null,1);if(json)fs.writeFileSync(json,s+'\n');console.log(s);process.exit(code);}
function lancer(cmd,args,opts={}){const r=spawnSync(cmd,args,{cwd:opts.cwd||RACINE,encoding:'utf8',maxBuffer:1<<28,env:{...process.env,...(opts.env||{})}});
 if(r.status!==0)throw Error(cmd+' '+args.join(' ')+' : '+((r.stderr||'')+(r.stdout||'')).slice(-1500));return r.stdout;}
function etape(nom,f){const t0=Date.now();let ok=false,detail=null;try{detail=f();ok=true;}catch(e){detail=String(e.message||e).slice(0,2000);}
 bilan.etapes.push({nom,ok,secondes:Math.round((Date.now()-t0)/100)/10,detail});console.error((ok?'ok    ':'ÉCHEC ')+nom);if(!ok)fin(1);}
etape('cargo test',()=>lancer('cargo',['test','-q','-p','ariane-session'],{cwd:RS}).match(/(\d+) passed/)?.[0]);
etape('cargo clippy (natif)',()=>{lancer('cargo',['clippy','-q','-p','ariane-session','--all-targets','--','-D','warnings'],{cwd:RS});return 'aucun avertissement';});
etape('cargo clippy (wasm32)',()=>{lancer('cargo',['clippy','-q','-p','ariane-session','--target','wasm32-unknown-unknown','--','-D','warnings'],{cwd:RS});return 'aucun avertissement';});
let releve=process.env.CH070_RELEVE_FICHIER;
if(!releve||!fs.existsSync(releve))etape('relevé des essais du tronc',()=>{releve=path.join(os.tmpdir(),'ch070-releve.jsonl');return JSON.parse(lancer('node',['tools/ch070-relever.cjs',releve]));});
const modules=fs.readdirSync(path.join(RS,'parite')).filter(n=>/^session-(?!commun|native-harnais).*\.cjs$/.test(n)).map(n=>n.replace(/\.cjs$/,'')).sort();
for(const m of modules)for(const [moteur,env] of [['node',{}],['chromium',{}],...(/resume|historique/.test(m)?[['chromium',{CH070_LOCALE:'fr-FR'}]]:[])])
 etape('parité '+m+' ('+moteur+(env.CH070_LOCALE?' '+env.CH070_LOCALE:'')+')',()=>{
  const args=['--max-old-space-size=8000','tools/ch070-parite.cjs','--module',m];if(moteur==='chromium')args.push('--chromium','--lot',m==='session-resume'?'2':'50');
  const r=JSON.parse(lancer('node',args,{env:{CH070_RELEVE_FICHIER:releve,CHROMIUM:process.env.CHROMIUM||'/opt/pw-browsers/chromium',...env}}));
  if(r.verdict!=='IDENTIQUE')throw Error(JSON.stringify(r.ecarts).slice(0,1500));
  return {cas:r.cas,identiques:r.identiques,navigateur:r.navigateur||r.moteur,servisParLeCoeur:r.bilanAdaptateur?.coeur,replis:r.bilanAdaptateur?.repliHorsDomaine??r.bilanAdaptateur?.repli};});
fin(0);

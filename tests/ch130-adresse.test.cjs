'use strict';
/* CH-130 (D-361) — L'ADRESSE DU RELAIS PAR DÉFAUT, SANS JAMAIS L'ÉCRIRE DANS LE DÉPÔT.
 * 1. Aucun hôte `<nom>.workers.dev` réel dans les fichiers suivis ni dans l'historique disponible (seuls les hôtes fabriqués `*.exemple.workers.dev`
 *    sont permis ; les jokers et gabarits comme `*.workers.dev` ou `<ton-sous-domaine>.workers.dev` ne sont pas des hôtes).
 * 2. `tools/relais_paquet.py` (appelé par tools/package.py, patch chantiers/CH-130/package.patch) lit l'adresse hors dépôt (variable ARIANE_RELAIS,
 *    sinon ~/.ariane/relais.txt), la contrôle et l'écrit dans le paquet seulement (`telecommande-relais.json`) ; sans source, rien.
 * 3. Le panneau propose : la dernière adresse saisie, sinon celle du paquet, sinon rien. */
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{spawnSync}=require('node:child_process');
const racine=path.resolve(__dirname,'..');
/* Un hôte réel : au moins une étiquette collée devant « workers.dev ». Écrit pour ne pas se reconnaître lui-même. */
const HOTE=new RegExp('([a-z0-9-]+[.])+'+'workers'+'[.]dev','gi');
const permis=h=>/^([a-z0-9-]+\.)*exemple\.workers\.dev$/i.test(h);
const git=(...a)=>spawnSync('git',['-C',racine,...a],{encoding:'utf8',maxBuffer:1<<28});

test('aucune adresse *.workers.dev réelle dans les fichiers suivis',()=>{
 const fichiers=git('ls-files','-z').stdout.split('\0').filter(Boolean),vus=[];
 for(const f of fichiers){let b;try{b=fs.readFileSync(path.join(racine,f));}catch{continue;}if(b.includes(0))continue;
  for(const m of b.toString('utf8').matchAll(HOTE))if(!permis(m[0]))vus.push(f+' : '+m[0].replace(/^[^.]+/,'<…>'));}
 assert.ok(fichiers.length>500,'liste des fichiers suivis lue');
 assert.deepEqual(vus,[]);
});

test('aucune adresse *.workers.dev réelle dans l’historique disponible (toutes branches)',()=>{
 const r=git('log','--all','-p','--format=commit %h');assert.equal(r.status,0,r.stderr);
 const vus=[];let c='';for(const l of r.stdout.split('\n')){if(l.startsWith('commit '))c=l.slice(7);else for(const m of l.matchAll(HOTE))if(!permis(m[0]))vus.push(c+' : '+m[0].replace(/^[^.]+/,'<…>'));}
 assert.deepEqual(vus,[]);
});

test('le fichier de réglage du paquet n’est jamais suivi ni écrit dans le dépôt',()=>{
 assert.equal(fs.existsSync(path.join(racine,'telecommande-relais.json')),false);
 assert.equal(git('ls-files','telecommande-relais.json').stdout.trim(),'');
 assert.match(fs.readFileSync(path.join(racine,'.gitignore'),'utf8'),/^telecommande-relais\.json$/m);
});

/* ——— tools/relais_paquet.py */
const py=spawnSync('python3',['--version']).status===0?null:'python3 absent';
const fabrique=()=>['https:/','/ariane-telecommande.exemple.','workers','.dev'].join('');
function lire(env={},fichier=null){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ch130-')),f=path.join(dir,'relais.txt');if(fichier!==null)fs.writeFileSync(f,fichier);
 const code=`import sys,json;sys.path.insert(0,${JSON.stringify(path.join(racine,'tools'))});import relais_paquet as R
try:
 a,src=R.lire(fichier=${JSON.stringify(f)})
 print(json.dumps({'adresse':a,'source':src,'contenu':R.contenu(a) if a else None}))
except ValueError as e:
 print(json.dumps({'erreur':str(e)}))`;
 const r=spawnSync('python3',['-c',code],{encoding:'utf8',env:{PATH:process.env.PATH,HOME:dir,...env}});assert.equal(r.status,0,r.stderr);return JSON.parse(r.stdout);}

test('relais_paquet : sans source, rien n’est injecté',py?{skip:py}:{},()=>{
 assert.deepEqual(lire(),{adresse:null,source:null,contenu:null});
});
test('relais_paquet : la variable ARIANE_RELAIS passe avant le fichier ; l’adresse est normalisée (https, hôte seul)',py?{skip:py}:{},()=>{
 const a=fabrique(),autre=a.replace('ariane-telecommande','autre');
 let r=lire({ARIANE_RELAIS:'  '+a+'/  '},autre);assert.equal(r.adresse,a);assert.equal(r.source,'variable');
 assert.deepEqual(JSON.parse(r.contenu),{relais:a});
 r=lire({},autre+'\n');assert.equal(r.adresse,autre);assert.equal(r.source,'fichier');
});
test('relais_paquet : une adresse qui n’est pas celle d’un Worker est refusée (le paquet ne se fabrique pas)',py?{skip:py}:{},()=>{
 for(const x of ['http://x.exemple.'+'workers.dev','https://x.exemple.'+'workers.dev/chemin','https://exemple.com','https://x.exemple.'+'workers.dev/#k=1','pas une adresse'])
  assert.match(lire({ARIANE_RELAIS:x}).erreur||'',/relais/i,x);
});

test('package.patch : appelle relais_paquet et n’écrit le réglage que dans le zip',()=>{
 const p=fs.readFileSync(path.join(racine,'chantiers/CH-130/package.patch'),'utf8');
 assert.match(p,/^\+\+\+ b\/tools\/package\.py$/m);
 assert.match(p,/^\+.*relais_paquet\.lire\(\)/m);assert.match(p,/^\+.*archive\.writestr\(relais_paquet\.NOM/m);
 assert.doesNotMatch(p,HOTE);
 const r=spawnSync('git',['-C',racine,'apply','--check',path.join(racine,'chantiers/CH-130/package.patch')],{encoding:'utf8'});
 assert.equal(r.status,0,'le patch s’applique au tronc : '+r.stderr);
});

test('package.py patché : sans source, paquet identique à aujourd’hui ; avec ARIANE_RELAIS, telecommande-relais.json en plus',py?{skip:py}:{},()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ch130-pq-'));
 const r0=spawnSync('git',['-C',racine,'worktree','add','--detach',path.join(dir,'w'),'HEAD'],{encoding:'utf8'});assert.equal(r0.status,0,r0.stderr);
 const w=path.join(dir,'w');
 try{
  /* L'arbre de travail en cours (fichiers non encore validés compris) : on y recopie les fichiers de ce chantier. */
  for(const f of ['tools/relais_paquet.py','chantiers/CH-130/package.patch']){fs.mkdirSync(path.dirname(path.join(w,f)),{recursive:true});fs.copyFileSync(path.join(racine,f),path.join(w,f));}
  const crc=out=>JSON.parse(spawnSync('python3',['-c',`import zipfile,sys,json;z=zipfile.ZipFile(sys.argv[1]);print(json.dumps(sorted([i.filename,i.CRC] for i in z.infolist() if i.filename not in ('BUILD','tools/package.py'))))`,out],{encoding:'utf8'}).stdout);
  /* Le paquet d'aujourd'hui (package.py non patché), pour comparer. */
  const r1=spawnSync('python3',[path.join(w,'tools/package.py'),'--output',path.join(dir,'avant.zip')],{encoding:'utf8',env:{PATH:process.env.PATH,HOME:dir}});assert.equal(r1.status,0,r1.stderr);
  const a=spawnSync('git',['-C',w,'apply',path.join(w,'chantiers/CH-130/package.patch')],{encoding:'utf8'});assert.equal(a.status,0,a.stderr);
  const zip=(env,nom)=>{const out=path.join(dir,nom);const r=spawnSync('python3',[path.join(w,'tools/package.py'),'--output',out],{encoding:'utf8',env:{PATH:process.env.PATH,HOME:dir,...env}});
   assert.equal(r.status,0,r.stderr);assert.doesNotMatch(r.stdout+r.stderr,HOTE,'l’adresse n’est pas écrite dans la sortie');
   const l=spawnSync('python3',['-c',`import zipfile,sys,json;z=zipfile.ZipFile(sys.argv[1]);n=z.namelist();print(json.dumps({'a':'telecommande-relais.json' in n,'c':z.read('telecommande-relais.json').decode() if 'telecommande-relais.json' in n else None}))`,out],{encoding:'utf8'});
   return JSON.parse(l.stdout);};
  assert.deepEqual(zip({},'sans.zip'),{a:false,c:null});
  assert.deepEqual(crc(path.join(dir,'sans.zip')),crc(path.join(dir,'avant.zip')),'sans source : le même paquet qu’aujourd’hui, fichier pour fichier (hors BUILD et tools/package.py, le fichier patché lui-même, que le paquet embarque)');
  assert.deepEqual(zip({ARIANE_RELAIS:fabrique()},'avec.zip'),{a:true,c:JSON.stringify({relais:fabrique()})});
 }finally{spawnSync('git',['-C',racine,'worktree','remove','--force',w]);}
});

/* ——— Le panneau : dernière saisie, sinon le paquet, sinon rien. */
test('panneau : l’adresse proposée est la dernière saisie, sinon celle du paquet, sinon vide',async()=>{
 global.ArianeTelecommandePanneau=undefined;require('../src/telecommande-panneau.js');const P=globalThis.ArianeTelecommandePanneau;
 const a=fabrique(),b=a.replace('ariane-telecommande','autre');
 assert.equal(await P.adresseProposee({memoire:()=>b,paquet:async()=>({relais:a})}),b);
 assert.equal(await P.adresseProposee({memoire:()=>null,paquet:async()=>({relais:a})}),a);
 assert.equal(await P.adresseProposee({memoire:()=>null,paquet:async()=>{throw Error('absent');}}),'');
 assert.equal(await P.adresseProposee({memoire:()=>null,paquet:async()=>({relais:'https://exemple.com'})}),'','une adresse du paquet qui n’est pas un Worker est ignorée');
 assert.equal(await P.adresseProposee({memoire:()=>{throw Error('stockage');},paquet:async()=>null}),'');
});

/* ——— Écart de version : un relais déployé avant CH-130 sert l'ancienne page (vue réduite) ; la feuille du panneau le dit en une ligne. */
test('panneau : relais ancien (404 sur le rendu) dit en une ligne ; relais à jour ou illisible : rien',async()=>{
 const P=globalThis.ArianeTelecommandePanneau,a=fabrique(),vus=[];
 const r=st=>async(u,o)=>{vus.push([u,o.method]);return {status:st,ok:st>=200&&st<300};};
 assert.equal(await P.relaisComplet(a,{lire:r(404)}),false);assert.deepEqual(vus[0],[a+'/telecommande-instantane.js','HEAD']);
 assert.equal(await P.relaisComplet(a,{lire:r(200)}),true);
 assert.equal(await P.relaisComplet(a,{lire:r(500)}),null);
 assert.equal(await P.relaisComplet(a,{lire:async()=>{throw Error('réseau');}}),null);
 assert.match(P.RELAIS_ANCIEN,/vue réduite/);assert.match(P.RELAIS_ANCIEN,/Redéploie/);
});
test('l’ancienne page (CH-111) reste servie par un relais ancien et lit toujours les mêmes champs : la vue de CH-130 ne fait qu’ajouter',()=>{
 const T=require('../src/telecommande.js'),v=T.vueReduite({s:{batch:null,connection:{status:'ready'}},relecture:null,file:null,passe:null,echo:false});
 for(const k of ['connexion','activite','lot','relecture','constellation','passe2','boutons'])assert.ok(Object.hasOwn(v,k),k);
 const r=spawnSync('git',['-C',racine,'show','0a78516:telecommande/telephone.html'],{encoding:'utf8'});
 if(r.status===0){const lus=new Set([...r.stdout.matchAll(/\bv\.(\w+)/g)].map(m=>m[1]));for(const k of lus)assert.ok(Object.hasOwn(v,k),'champ lu par l’ancienne page : '+k);}
});

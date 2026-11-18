#!/usr/bin/env node
/* La machine d'OpenCode est-elle prête ? (D-364, D-373 ; plan : fiches/PASSATION_OPENCODE.md § 1)
 * Vérifie tout ce qu'il faut pour faire le travail de l'intégrateur sans aide : Node 22, Python 3, clone complet du
 * dépôt (le verify lit l'historique), Playwright et Chromium (essais navigateur, maquette ESV), GitHub CLI connecté
 * (hub, pull requests, étiquettes, publications), identité git, clone de banane-data, adresse du relais hors dépôt,
 * motifs confidentiels du scan. N'affiche JAMAIS le contenu de l'adresse du relais ni des motifs.
 *   node tools/vps-pret.cjs          (texte ; code 0 si prêt, 1 sinon)
 *   node tools/vps-pret.cjs --json   (même chose en JSON) */
'use strict';
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),{spawnSync}=require('node:child_process');
const RACINE=path.join(__dirname,'..');
const navigateur=require(path.join(RACINE,'tests','esv-maquette','navigateur.cjs'));

const lancer=(cmd,args,opt={})=>{const p=spawnSync(cmd,args,{encoding:'utf8',cwd:RACINE,timeout:15000,...opt});return {ok:!p.error&&p.status===0,sortie:((p.stdout||'')+(p.stderr||'')).trim()};};

function points(env=process.env){
 const home=env.HOME||os.homedir(),P=[];
 const ajouter=(id,quoi,ok,detail,remede)=>P.push({id,quoi,ok:!!ok,detail:detail||'',remede:ok?'':remede});

 const maj=+process.versions.node.split('.')[0];
 ajouter('node','Node.js 22 ou plus',maj>=22,'v'+process.versions.node,'installer Node.js 22 (nodesource ou nvm)');

 const py=lancer('python3',['-V']);
 ajouter('python','Python 3 (paquet : tools/package.py)',py.ok,py.sortie,'apt-get install -y python3');

 const sh=lancer('git',['rev-parse','--is-shallow-repository']);
 ajouter('clone','Clone complet de banane (le verify lit l\'historique : typage-ch075)',sh.ok&&sh.sortie==='false',sh.sortie,'git fetch --unshallow');

 const tronc=lancer('git',['rev-parse','--verify','--quiet','origin/claude/50-test17']);
 ajouter('tronc','Tronc claude/50-test17 connu',tronc.ok,'','git fetch origin claude/50-test17');

 const nom=lancer('git',['config','user.name']),mel=lancer('git',['config','user.email']);
 ajouter('identite','Identité git (user.name, user.email)',nom.ok&&mel.ok,'','git config --global user.name … ; git config --global user.email …');

 const pw=navigateur.modulePlaywright();
 ajouter('playwright','Playwright (essais navigateur, maquette ESV)',!!pw,pw||'','npm i -g playwright, ou PLAYWRIGHT_MODULE=/chemin/vers/playwright');

 const chr=navigateur.executable();
 ajouter('chromium','Chromium (CHROMIUM=…)',!!chr&&fs.existsSync(chr),chr||'','npx playwright install chromium, puis CHROMIUM=<chemin> ; ou apt-get install -y chromium');

 const gh=lancer('gh',['auth','status']);
 ajouter('gh','GitHub CLI connecté (hub, pull requests, publications)',gh.ok,'','installer gh, puis gh auth login (droits d\'écriture sur banane et banane-data)');

 const data=env.BANANE_DATA||path.join(RACINE,'..','banane-data');
 ajouter('data','Clone de banane-data (branche claude/execute-prompt-00-18ra5a)',fs.existsSync(path.join(data,'.git')),data,'git clone --filter=blob:none --sparse … banane-data à côté de banane, ou BANANE_DATA=<chemin>');

 const fichierRelais=path.join(home,'.ariane','relais.txt');
 let relais=!!(env.ARIANE_RELAIS||'').trim();
 if(!relais){try{relais=fs.readFileSync(fichierRelais,'utf8').trim().length>0;}catch{relais=false;}}
 ajouter('relais','Adresse du relais hors dépôt (paquet)',relais,relais?'présente (contenu non affiché)':'',`l'opérateur la pose dans ${fichierRelais} (une ligne) ; jamais dans le dépôt`);

 const motifs=!!(env.ARIANE_MOTIFS_INTERDITS||'').trim();
 ajouter('motifs','Motifs confidentiels du scan (ARIANE_MOTIFS_INTERDITS)',motifs,motifs?'présents (contenu non affiché)':'','l\'opérateur les pose dans le profil du shell (export ARIANE_MOTIFS_INTERDITS=…), jamais dans le dépôt');
 return P;
}

if(require.main===module){
 const P=points(),pret=P.every(p=>p.ok);
 if(process.argv.includes('--json'))process.stdout.write(JSON.stringify({pret,points:P},null,1)+'\n');
 else{for(const p of P)console.log(`${p.ok?'OK ':'MANQUE'} ${p.quoi}${p.detail?' — '+p.detail:''}${p.ok?'':'\n       → '+p.remede}`);
  console.log(pret?'\nPrêt : la machine peut tout faire.':'\nPas prêt : poser ce qui manque, puis relancer.');}
 process.exit(pret?0:1);
}
module.exports={points};

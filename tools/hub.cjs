#!/usr/bin/env node
/* Hub Ariane : la messagerie entre les agents du projet (intégrateur Claude Code, exécutants Cursor ou GLM,
 * actions GitHub, opérateur). Le canal d'un chantier est sa pull request (branche `chantier/CH-NNN` vers le
 * tronc) : chaque message est un commentaire de cette PR, lisible par tous, horodaté, notifié sur le téléphone
 * de l'opérateur, et il réveille la session Claude Code abonnée. Protocole : hub/PROTOCOLE.md.
 *
 *   node tools/hub.cjs dire  --chantier CH-001 --de cursor --type rapport "texte"      (ou --fichier chemin.md)
 *   node tools/hub.cjs lire  --chantier CH-001 [--derniers 5]
 *   node tools/hub.cjs etat                                                               (chantiers ouverts)
 *
 * Sans `gh` (ou hors ligne), `dire --boite` écrit le message dans hub/boite/CH-NNN.md ; `--pousser` le commet
 * et le pousse sur la branche courante. Tout message est passé au scan des motifs interdits AVANT d'être envoyé :
 * courriel, adresse web hors liste blanche, code de projet ESV, UUID, et les motifs confidentiels lus dans la
 * variable ARIANE_MOTIFS_INTERDITS (jamais écrits ici). Un message qui en contient est refusé (code 2). */
'use strict';
const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');

const TYPES=['ticket','question','reponse','rapport','verdict','alerte','info'];
const EMETTEURS=['integrateur','cursor','glm','actions','operateur','agent'];
const LISTE_BLANCHE_WEB=[/^https?:\/\/(www\.)?w3\.org\//,/^https?:\/\/json-schema\.org\//,/^https?:\/\/scripts\.sil\.org\//,
 /^https?:\/\/github\.com\/(ateliertriay|Instrument)\//,/^https?:\/\/developer\.chrome\.com\//,/^https?:\/\/code\.claude\.com\//,
 /^https?:\/\/(www\.)?github\.com\/StoryNow30\//,/^https?:\/\/claude\.ai\//];
const MOTIFS_PUBLICS={
 courriel:/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g,
 web:/https?:\/\/[^\s"'<>)\]]+/g,
 projetESV:/Project__\d{6}|[Pp]rojet[_ ]?\d{6}_\d{6}/g,
 uuid:/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
};

/* Rend la liste des motifs trouvés (noms seulement, jamais les valeurs confidentielles). */
function verifierMessage(texte,env=process.env){
 const trouves=[];
 for(const [nom,re] of Object.entries(MOTIFS_PUBLICS)){
  const occ=[...texte.matchAll(re)].map(m=>m[0]).filter(v=>nom!=='web'||!LISTE_BLANCHE_WEB.some(w=>w.test(v)));
  if(occ.length)trouves.push({motif:nom,occurrences:occ.length});
 }
 const conf=(env.ARIANE_MOTIFS_INTERDITS||'').trim();
 if(conf){
  let re;try{re=new RegExp(conf,'gi');}catch{throw new Error('ARIANE_MOTIFS_INTERDITS : expression régulière invalide');}
  const n=[...texte.matchAll(re)].length;if(n)trouves.push({motif:'confidentiel',occurrences:n});
 }
 return trouves;
}

function heureParis(d=new Date()){
 const f=new Intl.DateTimeFormat('fr-FR',{timeZone:'Europe/Paris',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'});
 return f.format(d).replace(',','');
}

function formater({de,a='tous',type,chantier,texte,date}){
 if(!TYPES.includes(type))throw new Error(`type inconnu « ${type} » ; attendus : ${TYPES.join(', ')}`);
 if(!EMETTEURS.includes(de))throw new Error(`émetteur inconnu « ${de} » ; attendus : ${EMETTEURS.join(', ')}`);
 if(!/^CH-\d{3}$|^T\d{2}$|^hub$/.test(chantier))throw new Error(`chantier « ${chantier} » : attendu CH-NNN, TNN ou hub`);
 return `**[${de} → ${a}] ${type} · ${chantier} · ${heureParis(date)} Paris**\n\n${texte.trim()}\n\n---\n_hub Ariane · émetteur : ${de}_`;
}

function depot(){
 const p=spawnSync('git',['remote','get-url','origin'],{encoding:'utf8'});
 const m=(p.stdout||'').trim().match(/github\.com[:/]([^/]+)\/([^/.]+)/);
 if(!m)throw new Error('dépôt GitHub introuvable (git remote origin)');
 return {owner:m[1],repo:m[2]};
}
function gh(args,input){
 const p=spawnSync('gh',args,{encoding:'utf8',input});
 if(p.error)throw new Error('gh indisponible : installe GitHub CLI et lance « gh auth login »');
 if(p.status!==0)throw new Error(`gh ${args.slice(0,2).join(' ')} : ${(p.stderr||'').trim().split('\n')[0]}`);
 return p.stdout;
}
function numeroPR(chantier){
 const {owner,repo}=depot();
 const out=gh(['api',`repos/${owner}/${repo}/pulls?state=all&per_page=50&head=${owner}:${chantier==='hub'?'hub/journal':'chantier/'+chantier}`]);
 const prs=JSON.parse(out);if(!prs.length)return null;
 return prs.find(p=>p.state==='open')?.number??prs[0].number;
}
function dire(o){
 const texte=o.fichier?fs.readFileSync(o.fichier,'utf8'):o.texte;
 if(!texte||!texte.trim())throw new Error('message vide');
 const t=verifierMessage(texte);
 if(t.length){console.error('Message refusé, motifs interdits : '+t.map(x=>`${x.motif} (${x.occurrences})`).join(', '));process.exit(2);}
 const corps=formater({de:o.de,a:o.a,type:o.type,chantier:o.chantier,texte});
 if(o.boite)return boite(o.chantier,corps,o.pousser);
 const {owner,repo}=depot();const n=numeroPR(o.chantier);
 if(!n){console.error(`aucune PR pour ${o.chantier==='hub'?'hub/journal':'chantier/'+o.chantier} : ouvre-la (gh pr create --base claude/50-test17 --draft) ou utilise --boite`);process.exit(3);}
 const r=JSON.parse(gh(['api','-X','POST',`repos/${owner}/${repo}/issues/${n}/comments`,'-f',`body=${corps}`]));
 console.log(`envoyé : PR #${n}, commentaire ${r.id}`);
}
function boite(chantier,corps,pousser){
 const d=path.join(process.cwd(),'hub','boite');fs.mkdirSync(d,{recursive:true});
 const f=path.join(d,`${chantier}.md`);fs.appendFileSync(f,(fs.existsSync(f)?'\n\n':'')+corps+'\n');
 console.log(`écrit dans ${path.relative(process.cwd(),f)}`);
 if(pousser){
  const run=a=>{const p=spawnSync('git',a,{encoding:'utf8'});if(p.status!==0)throw new Error(`git ${a[0]} : ${p.stderr}`);return p.stdout;};
  run(['add',f]);run(['commit','-m',`hub : message ${chantier}`]);
  const br=run(['rev-parse','--abbrev-ref','HEAD']).trim();if(br==='claude/50-test17')throw new Error('refus : pas de boîte sur le tronc');
  run(['push','-u','origin',br]);console.log(`poussé sur ${br}`);
 }
}
function lire(o){
 const {owner,repo}=depot();const n=numeroPR(o.chantier);
 if(!n){console.log('aucune PR pour ce chantier');return;}
 const c=JSON.parse(gh(['api',`repos/${owner}/${repo}/issues/${n}/comments?per_page=100`]));
 const hub=c.filter(x=>/_hub Ariane/.test(x.body));
 for(const x of hub.slice(-(o.derniers||10)))console.log(x.body.replace(/\n---\n_hub Ariane.*$/s,'')+`\n   (${x.user?.login}, ${x.created_at})\n`);
 console.log(`${hub.length} message(s) hub, ${c.length-hub.length} autre(s) commentaire(s) · PR #${n}`);
}
function etat(){
 const {owner,repo}=depot();
 const prs=JSON.parse(gh(['api',`repos/${owner}/${repo}/pulls?state=open&per_page=50`]));
 const ch=prs.filter(p=>/^chantier\//.test(p.head.ref));
 if(!ch.length){console.log('aucun chantier ouvert');return;}
 for(const p of ch)console.log(`#${p.number}  ${p.head.ref.padEnd(18)}  ${p.draft?'brouillon':'prêt     '}  ${p.title}  (${p.updated_at})`);
}
function args(argv){
 const o={_:[]};for(let i=0;i<argv.length;i++){const a=argv[i];
  if(a.startsWith('--')){const k=a.slice(2);const v=argv[i+1];if(v===undefined||v.startsWith('--'))o[k]=true;else{o[k]=v;i++;}}else o._.push(a);}
 return o;
}
if(require.main===module){
 const o=args(process.argv.slice(2)),cmd=o._[0];
 try{
  if(cmd==='dire')dire({chantier:o.chantier,de:o.de||'agent',a:o.a||'tous',type:o.type||'info',texte:o._.slice(1).join(' '),fichier:o.fichier,boite:!!o.boite,pousser:!!o.pousser});
  else if(cmd==='lire')lire({chantier:o.chantier,derniers:Number(o.derniers)||10});
  else if(cmd==='etat')etat();
  else{console.log(fs.readFileSync(__filename,'utf8').split('\n').slice(1,14).join('\n'));process.exit(cmd?1:0);}
 }catch(e){console.error(e.message);process.exit(1);}
}
module.exports={verifierMessage,formater,TYPES,EMETTEURS};

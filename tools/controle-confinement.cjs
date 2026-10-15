#!/usr/bin/env node
'use strict';
/*
 * controle-confinement.cjs — contrôle, avant un commit ou un envoi, qu'un
 * dossier ne contient ni jeton de session, ni identifiant de projet ESV, ni
 * échange d'authentification, ni fichier HAR brut. Pensé pour le dépôt privé
 * du banc ESV (`banane-banc`) autant que pour ce dépôt. Lecture seule.
 *
 *   node tools/controle-confinement.cjs DOSSIER [--json]
 *
 * Sortie : liste des constats (fichier, ligne, motif) ; code 1 s'il y en a.
 * Les motifs sont volontairement larges : un faux positif se lit, un jeton
 * publié ne se rattrape pas.
 */
const fs=require('node:fs'),path=require('node:path');
const MOTIFS=[
  {nom:'identifiant de projet ESV (six chiffres, souligné, six chiffres, souligné, lettre, souligné)',re:/\b\d{6}_\d{6}_[A-Za-z]_/},
  {nom:'jeton porteur',re:/\bBearer\s+[A-Za-z0-9\-._~+/]{20,}/},
  {nom:'en-tête d’autorisation',re:/"?Authorization"?\s*[:=]\s*"?[A-Za-z]+\s+[A-Za-z0-9\-._~+/]{16,}/i},
  {nom:'jeton JWT',re:/\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/},
  {nom:'échange d’authentification Microsoft',re:/login\.microsoftonline\.com/i},
  {nom:'témoin de session',re:/\b(set-cookie|cookie)\s*[:=]\s*"?[^"\n]{40,}/i},
];
const IGNORER=new Set(['.git','node_modules']);
const TEXTE=new Set(['.js','.cjs','.mjs','.json','.md','.txt','.html','.css','.har','.csv','.yml','.yaml','.py','.sh']);
function marcher(d,out){for(const e of fs.readdirSync(d,{withFileTypes:true})){if(IGNORER.has(e.name))continue;const p=path.join(d,e.name);
  if(e.isDirectory())marcher(p,out);else out.push(p);}return out;}
function controler(dossier){
  const constats=[],fichiers=marcher(path.resolve(dossier),[]);
  for(const f of fichiers){const ext=path.extname(f).toLowerCase();
    if(ext==='.har')constats.push({fichier:f,ligne:0,motif:'fichier HAR brut (contient des en-têtes et des jetons : à nettoyer et à renommer avant tout dépôt)'});
    if(!TEXTE.has(ext))continue;const taille=fs.statSync(f).size;if(taille>64*1024*1024){constats.push({fichier:f,ligne:0,motif:'fichier de plus de 64 Mo non lu'});continue;}
    const lignes=fs.readFileSync(f,'utf8').split('\n');
    lignes.forEach((l,i)=>{for(const m of MOTIFS)if(m.re.test(l))constats.push({fichier:f,ligne:i+1,motif:m.nom,extrait:l.slice(0,60).replace(/[A-Za-z0-9]{12,}/g,s=>s.slice(0,4)+'…')});});}
  return {dossier:path.resolve(dossier),fichiers:fichiers.length,constats};
}
module.exports={controler,MOTIFS};
if(require.main===module){const d=process.argv[2];if(!d){console.error('Usage : DOSSIER [--json]');process.exit(2);}
  const r=controler(d);if(process.argv.includes('--json'))console.log(JSON.stringify(r,null,1));
  else{console.log(`${r.fichiers} fichiers lus, ${r.constats.length} constat(s).`);for(const c of r.constats)console.log(`${c.fichier}:${c.ligne} — ${c.motif}${c.extrait?' — '+c.extrait:''}`);}
  process.exitCode=r.constats.length?1:0;}

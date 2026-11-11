'use strict';
/* CH-108 : compare les styles calculés de deux rendus du panneau (relevés par chantiers/CH-104/outils/capturer.cjs avec STYLES=1) : la référence
 * (« tronc + maquettes/caractere/direction-d.css », FEUILLE_EN_PLUS) et le panneau construit. Regroupe les écarts par élément (classes), propriété et
 * valeurs, avec le nombre d'états où l'écart se voit. Sert à prouver que l'intégration suit la référence, et à lister ce qui s'en écarte exprès.
 * Usage : node chantiers/CH-108/outils/ecarts-styles.cjs REFERENCE/styles.json CONSTRUIT/styles.json [propriétés à ignorer, ex. width,height] */
const fs=require('node:fs');
const [A,B,ign]=process.argv.slice(2);if(!A||!B){console.error('Deux fichiers styles.json attendus.');process.exit(2);}
const ref=JSON.parse(fs.readFileSync(A,'utf8')),moi=JSON.parse(fs.readFileSync(B,'utf8'));
const IGNORE=new Set((ign||'').split(',').filter(Boolean));
const groupes=new Map();let manque=0;
for(const [etat,els] of Object.entries(ref)){const m=moi[etat];if(!m){manque++;continue;}
 for(const [k,props] of Object.entries(els)){const n=m[k];const nom=k.replace(/^\d+ /,'');
  if(!n){const g='ABSENT '+nom;groupes.set(g,(groupes.get(g)||new Set()).add(etat));continue;}
  for(const [p,v] of Object.entries(props)){if(IGNORE.has(p)||n[p]===v)continue;const g=`${nom} | ${p} | ${v} → ${n[p]}`;groupes.set(g,(groupes.get(g)||new Set()).add(etat));}}
 for(const k of Object.keys(m))if(!els[k]){const g='EN PLUS '+k.replace(/^\d+ /,'');groupes.set(g,(groupes.get(g)||new Set()).add(etat));}}
const lignes=[...groupes].sort((x,y)=>y[1].size-x[1].size||x[0].localeCompare(y[0]));
for(const [g,e] of lignes)console.log(String(e.size).padStart(4),g.slice(0,400),e.size<=3?'  ['+[...e].join(', ')+']':'');
console.log(`${lignes.length} écart(s) distinct(s) sur ${Object.keys(ref).length} états${manque?`, ${manque} état(s) absent(s) du second relevé`:''}`);

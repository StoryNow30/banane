#!/usr/bin/env node
'use strict';
/* CH-057 — enveloppe de `tools/rejeu-voie-predite.cjs` (version CH-056 : garde « après un différé » rejouée dans la boucle). Hors ligne, en ombre :
 * rien n'est activé, l'outil n'est pas modifié. Elle AJOUTE à la liste des variantes, avant d'appeler la fonction principale de l'outil :
 *   - la grille de réglage de la règle de voie `b1-ecart-serie` (CH-053-M / CH-055) : fenêtre d'acceptation autour de la voie (`fenetre`, mm) et
 *     choix du minimum local près d'elle (`choix`, mm) ; réglage livré (src/settings.js `voieB1EcartOmbre`) : fenêtre 30, choix 15 ;
 *   - la chaîne proposée : `b1-ecart-serie` AVEC la garde « après un différé » limitée aux PN et ADV (proposition CH-056), et avec la garde livrée.
 * Mêmes options que l'outil (`--corpus`, `--journal`, `--jointure`, `--liste-esv`, `--echo`, `--partie`, `--variantes`, `--detail`, `--sortie`…).
 *   node chantiers/CH-057/rejeu.cjs --liste
 */
const R=require('../../tools/rejeu-voie-predite.cjs');
const B1E={b1:true,ecart:'les-deux',memoire:'propre',vue:'deplacee'};
const GARDE_LIVREE={regle:'R3',coupures:2,appuisMin:2,zone:'tout'};
const GARDE_PN_ADV={regle:'R3',coupures:2,appuisMin:2,zone:'pn-adv'};
function variantesCH057(){
  const out=[];
  for(const f of [20,30,50])for(const c of [10,15,30]){
    if((f===30&&c===15)||c>f)continue; /* f30-c15 = b1-ecart-serie, déjà dans l'outil ; le choix ne dépasse pas la fenêtre */
    out.push(R.variante(`b1-ecart-serie-f${f}-c${c}`,{...B1E,fenetre:f,choix:c}));
  }
  out.push(R.variante('b1-ecart-serie-garde-livree',{...B1E,garde:GARDE_LIVREE}));
  out.push(R.variante('b1-ecart-serie-garde-pn-adv',{...B1E,garde:GARDE_PN_ADV}));
  return out;
}
function installer(){
  const connues=new Set(R.VARIANTES.map(v=>v.id));
  for(const v of variantesCH057())if(!connues.has(v.id))R.VARIANTES.push(v);
  return R.VARIANTES;
}
module.exports={variantesCH057,installer};
if(require.main===module){installer();try{R.main();}catch(e){console.error(e.stack||e);process.exitCode=1;}}

#!/usr/bin/env node
'use strict';
/* CH-057 — ce que le paquet a RÉELLEMENT écrit dans ESV par la deuxième passe des différés (événements `passe-differes-ecriture`,
 * résultat « ecrit », journal Orbite), jugé contre l'Écho. Juge = écart humain de la jointure (tools/jointure-echo-orbite.cjs) quand la base
 * est la pose vue à la première visite de l'Écho ET que l'écriture précède cette visite : la pose vue est alors la pose écrite (contrôle des
 * heures fait à la main pour les 04/11 et 05/11 : écritures 15:31Z et 07:46-08:16Z, sessions Écho ensuite). Lecture seule ; numéros de cut et mm.
 *   node chantiers/CH-057/ecritures-passe.cjs --journal J.json --projet 11 --jointures DOSSIER [--journal … --projet …] [--json S.json]
 * DOSSIER contient tableP-N.json (P = projet, N = partie) ; une partie sans table est « hors des 9 » (aucun Écho joint). */
const fs=require('node:fs'),path=require('node:path');
function ecritures(journal){return (journal.events||[]).filter(e=>e&&e.type==='passe-differes-ecriture'&&e.resultat==='ecrit'&&e.identity)
  .map(e=>({partie:e.identity.part,cut:e.identity.cut,passe:e.passe??null,instant:e.timestamp||null}));}
function juger(rows,projet,dossier){
  return rows.map(r=>{const f=path.join(dossier,`table${projet}-${r.partie}.json`);
    if(!fs.existsSync(f))return {...r,projet,jugement:'hors-des-9'};
    const t=JSON.parse(fs.readFileSync(f,'utf8')),l=(t.table||[]).find(x=>x.cut===r.cut);
    if(!l||!l.dansEcho)return {...r,projet,jugement:'pas-dans-echo'};
    const e=l.ecartHumain&&l.ecartHumain.maxDist3dMm;
    if(l.base!=='premiere-visite'||e==null)return {...r,projet,jugement:'sans-reference',etiquette:l.etiquetteEcho||null};
    return {...r,projet,jugement:e<=10?'juste':e<=50?'faux':'plus50',ecartMm:Math.round(e*10)/10,etiquette:l.etiquetteEcho||null};});
}
function bilan(rows){const b={ecrits:rows.length};for(const r of rows)b[r.jugement]=(b[r.jugement]||0)+1;return b;}
module.exports={ecritures,juger,bilan};
if(require.main===module){
  const a=process.argv.slice(2),J=[],P=[];let dossier=null,js=null;
  for(let i=0;i<a.length;i++){if(a[i]==='--journal')J.push(a[++i]);else if(a[i]==='--projet')P.push(a[++i]);else if(a[i]==='--jointures')dossier=a[++i];else if(a[i]==='--json')js=a[++i];}
  const rows=J.flatMap((f,i)=>juger(ecritures(JSON.parse(fs.readFileSync(f,'utf8'))),P[i],dossier));
  /* Aucun identifiant ni coordonnée : partie, cut, passe, instant, jugement, mm. */
  for(const r of rows)console.log(`${r.projet}:${r.partie}/${r.cut} passe ${r.passe} ${r.instant} → ${r.jugement}${r.ecartMm!=null?' '+r.ecartMm+' mm':''}${r.etiquette?' ('+r.etiquette+')':''}`);
  const b=bilan(rows);console.log(JSON.stringify(b));
  if(js)fs.writeFileSync(js,JSON.stringify({format:'ch057-ecritures-passe-v1',bilan:b,cuts:rows},null,1)+'\n');
}

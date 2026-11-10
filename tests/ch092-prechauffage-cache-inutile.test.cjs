'use strict';
/* CH-092 (relecture en adversaire de CH-085 et CH-088) — DÉFAUT « cache-inutile en voie potree ».
 * La règle d'arrêt de CH-077 (`coupesSansCache` coupes justes dont aucun nœud couvert n'est servi par le cache HTTP : arrêt pour la page,
 * src/prechauffage.js l. 446) est restée branchée en voie potree, où le cache HTTP ne joue plus aucun rôle (les nœuds sont chargés en mémoire par
 * load()). Chemin : Potree redemande au réseau un nœud que nous avons chargé (entrée de ressource à sa clé, une fois la nôtre reconnue) sur 5 coupes
 * prédites justes : `actif=false`, motif `cache-inutile`, plus aucun préchauffage (opération lointaine comprise) jusqu'au rechargement de la page.
 * Le déclencheur de terrain (Potree qui recharge un de nos nœuds) est SUPPOSÉ ; le mécanisme est reproduit ici.
 * Essai rouge marqué `todo`. Données synthétiques. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const {monter,contexte}=require('./ch092-prechauffage-monture.cjs');
const entree=c=>({name:'https://x.invalid/nuage/ept-data/'+c+'.laz',initiatorType:'fetch',responseStatus:200,transferSize:9000,decodedBodySize:9000});

test('voie potree : un nœud à nous redemandé par Potree hors cache, sur 6 coupes justes, n\'éteint pas le préchauffage',async()=>{
 const m=monter({horizon:1,candidatsMax:1},{statuts:Object.fromEntries([20,30,40,50,60,70,80,90].map(i=>[i,'invalid']))});const {pc,e,p}=m;
 let cut=20;const motifs=[];
 for(let k=0;k<7;k++){
  e.etiquette={part:23,cut};const r=p.apresCapture(contexte(pc,cut));await e.tourner(120);motifs.push((await r).motif);
  const cles=p._clesPourEssai();p.ressources(cles.map(entree));   /* les entrées de nos propres load() */
  cut+=10;e.etiquette={part:23,cut};p.annuler('capture');            /* arrivée sur la coupe prédite */
  if(cles[0])p.ressources([entree(cles[0])]);                         /* Potree redemande un de nos nœuds, par le réseau */
 }
 assert.ok(!motifs.includes('cache-inutile'),'motifs : '+motifs.join(', '));
 assert.equal(p.actif(),true,'préchauffage toujours allumé');
});

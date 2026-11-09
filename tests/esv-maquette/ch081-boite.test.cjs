'use strict';
/* CH-081 (D-311, Vision 8) — préchauffage avec le RÉGLAGE LIVRÉ (boîte de découpe, horizon 2, plafonds relevés) sur la maquette, forme RELEVÉE d'ESV (nœud
 * commun, EPT laszip, hiérarchie lue d'avance comme ESV), saut de 50 coupes. Comparé, dans la même séance, au réglage de CH-080c (cube, une coupe).
 * Ce que l'essai PROUVE sur la maquette : la zone est la boîte (`zone`), les deux modules sont chargés dans la page, des nœuds de la coupe lointaine sont
 * servis par le cache, aucune adresse dans les événements. La géométrie de la maquette est synthétique : le gain n'est pas celui d'ESV (SUPPOSÉ). */
const {test,after}=require('node:test'),assert=require('node:assert/strict');
const N=require('./navigateur.cjs'),O=require('./ch080-outils.cjs');
const raison=N.indisponible()||(O.adaptateurCH080()===null?'outil patch absent':null),opts=raison?{skip:raison}:{};
const ouverts=[];after(async()=>{for(const s of ouverts)await s.fermer().catch(()=>{});});
const sansAdresse=evts=>assert.ok(!/\/|ept-data|\.laz|\d+-\d+-\d+-\d+/.test(JSON.stringify(evts).replace(/"kind":"[^"]*"/g,'')),'aucune adresse');
const LIVRE=require('../../src/settings.js').lot.chargement.prechauffer;

test('réglage livré (boîte, horizon 2) contre CH-080c (cube) : zone boîte, nœuds de la coupe lointaine servis par le cache',opts,async()=>{
 const res={};
 for(const [nom,reglage] of [['cube',{}],['boite',{...LIVRE}]]){
  const s=await O.ouvrir({forme:'commun',pas:7,reglage});ouverts.push(s);
  const t=await s.transition();const p=t.evts.find(e=>e.kind==='prechauffage');
  assert.equal(p.zone,nom);assert.equal(p.saut,50);assert.ok(p.noeuds>0,'nœuds demandés : '+p.noeuds);sansAdresse(t.evts);
  res[nom]={noeuds:p.noeuds,cibles:p.cibles,cache:t.cache,total:t.noeuds,requetes:t.requetes,reposMs:t.reposMs};
  console.log(`# ${nom} : ${p.noeuds} nœuds demandés (${p.cibles} cible(s)), ${t.cache}/${t.noeuds} servis par le cache, ${t.requetes} requêtes, repos ${t.reposMs} ms`);
  await s.fermer();
 }
 assert.ok(res.boite.cache>=res.cube.cache,`boîte : au moins autant servis par le cache que le cube (${res.boite.cache} contre ${res.cube.cache})`);
});

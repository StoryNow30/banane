'use strict';
/* CH-080c — préchauffage d'une coupe éloignée avec la forme RELEVÉE dans ESV (relevé de console du 09/11) : nœud commun de Potree (PointCloudCopcGeometryNode
 * d'une PointCloudEptGeometry laszip), données par fetch(`${base}/ept-data/<clé>.laz`), hiérarchie par pages (`${base}/ept-hierarchy/<clé>.json`). Maquette
 * `eptForme=commun`, saut de 50 coupes. Ce que l'essai PROUVE sur la maquette (rouge avec le module d'avant CH-080c : `sans-adresse`, rien demandé) :
 *  - hiérarchie lue d'avance (une seule page, comme ESV pendant le lot : aucune requête ept-hierarchy) : nœuds de la coupe lointaine servis par le cache ;
 *  - hiérarchie par pages de 2 niveaux : pages de la zone lues, puis nœuds ; nœuds et pages servis par le cache ;
 *  - la forme est dite par l'événement (`formeNoeud`) ; aucune adresse dans les événements. Rien ici n'est vérifié sur le vrai ESV. */
const {test,after}=require('node:test'),assert=require('node:assert/strict');
const N=require('./navigateur.cjs'),O=require('./ch080-outils.cjs');
const raison=N.indisponible()||(O.adaptateurCH080()===null?'outil patch absent':null),opts=raison?{skip:raison}:{};
const ouverts=[];after(async()=>{for(const s of ouverts)await s.fermer().catch(()=>{});});
const sansAdresse=evts=>assert.ok(!/\/|ept-data|\.laz|\d+-\d+-\d+-\d+/.test(JSON.stringify(evts).replace(/"kind":"[^"]*"/g,'')),'aucune adresse');

test('forme relevée, hiérarchie lue d’avance (comme ESV) : nœuds de la coupe lointaine servis par le cache',opts,async()=>{
 const s=await O.ouvrir({forme:'commun',pas:7});ouverts.push(s);
 const t=await s.transition();const p=t.evts.find(e=>e.kind==='prechauffage');
 assert.equal(p.saut,50);assert.equal(p.sansNom,0);assert.equal(p.sansAdresse,0);assert.notEqual(p.motif,'sans-adresse');assert.ok(p.noeuds>0&&p.noeuds<=24);
 assert.ok((p.formeNoeud&4096)&&(p.formeNoeud&8192)&&(p.formeNoeud&16384),'forme commune dite : '+p.formeNoeud);assert.equal(t.hierarchies,0,'aucune page lue pendant le lot');
 assert.ok(t.cache>=8,`nœuds servis par le cache : ${t.cache} sur ${t.noeuds}`);sansAdresse(t.evts);
 console.log(`# commun, hiérarchie d'avance, saut 50 : ${p.noeuds} nœuds demandés, ${t.cache}/${t.noeuds} servis par le cache, ${t.requetes} requêtes, repos ${t.reposMs} ms`);
 await s.fermer();
});

test('forme relevée, hiérarchie par pages de 2 niveaux : pages de la zone lues, nœuds et pages servis par le cache',opts,async()=>{
 const s=await O.ouvrir({forme:'commun'});ouverts.push(s);
 const t=await s.transition();const p=t.evts.find(e=>e.kind==='prechauffage');
 assert.ok(p.hierarchies>=1&&p.deduits>0&&p.noeuds>0);assert.ok(p.noeuds+p.hierarchies<=24);
 assert.ok(t.cache>=5,`nœuds servis par le cache : ${t.cache} sur ${t.noeuds}`);assert.ok(t.hierCache>=1,`pages servies par le cache : ${t.hierCache} sur ${t.hierarchies}`);sansAdresse(t.evts);
 console.log(`# commun, pages de 2 niveaux, saut 50 : ${p.hierarchies} pages et ${p.noeuds} nœuds demandés, ${t.cache}/${t.noeuds} nœuds et ${t.hierCache}/${t.hierarchies} pages servis par le cache, repos ${t.reposMs} ms`);
 await s.fermer();
});

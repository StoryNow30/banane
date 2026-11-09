'use strict';
/* CH-080 (D-309) — préchauffage de la coupe suivante ÉLOIGNÉE, dans un vrai Chromium, sur la maquette EPT en mode `saut` (50 coupes entre deux coupes à
 * faire). Ce que l'essai PROUVE sur la maquette :
 *  - sans le correctif (adaptateur du tronc : fenêtre de ±10 lignes) : la coupe suivante n'est pas trouvée (`sans-suivante`), AUCUN nœud n'est servi
 *    par le cache (essai rouge du ticket) ;
 *  - avec : la coupe suivante est trouvée dans la liste d'ESV (`liste-esv`, saut 50), les nœuds connus de sa zone sont demandés et servis par le cache ;
 *  - aucun événement ne contient d'adresse ni de clé de nœud.
 * Rien ici n'est vérifié sur le vrai ESV (chantiers/CH-080/rapport.md). */
const {test,after}=require('node:test'),assert=require('node:assert/strict');
const N=require('./navigateur.cjs'),O=require('./ch080-outils.cjs');
const raison=N.indisponible()||(O.adaptateurCH080()===null?'outil patch absent':null),opts=raison?{skip:raison}:{};
const ouverts=[];after(async()=>{for(const s of ouverts)await s.fermer().catch(()=>{});});
const sansAdresse=evts=>{const t=JSON.stringify(evts).replace(/"kind":"[^"]*"/g,'');assert.ok(!/\/|ept-data|\.bin|\d+-\d+-\d+-\d+/.test(t),'aucune adresse ni clé : '+t);};

test('sans le correctif : saut de 50 coupes, sans-suivante, 0 nœud servi par le cache',opts,async()=>{
 const s=await O.ouvrir({correctif:false});ouverts.push(s);
 const t=await s.transition();assert.equal(t.suivant-t.cut,50,'la maquette saute de 50 coupes');assert.ok(t.noeuds>0);assert.equal(t.cache,0);
 const p=t.evts.filter(e=>e.kind==='prechauffage');assert.ok(p.length>=1);assert.equal(p[0].motif,'sans-suivante');assert.equal(p[0].noeuds,0);
 await s.fermer();
});

test('avec le correctif : coupe suivante prise dans la liste d’ESV (saut 50), nœuds de sa zone servis par le cache',opts,async()=>{
 const s=await O.ouvrir({correctif:true});ouverts.push(s);
 const t=await s.transition();const p=t.evts.filter(e=>e.kind==='prechauffage');
 assert.equal(p[0].predite,t.suivant);assert.equal(p[0].source,'liste-esv');assert.equal(p[0].saut,50);assert.ok(p[0].noeuds>0&&p[0].noeuds<=24,'nœuds demandés : '+p[0].noeuds);
 assert.ok(t.cache>0,`nœuds de la coupe suivante servis par le cache : ${t.cache} sur ${t.noeuds}`);
 sansAdresse(t.evts);
 console.log(`# saut 50 : ${p[0].noeuds} nœuds demandés (${p[0].octets} o, frontière ${p[0].frontiere}), ${t.cache}/${t.noeuds} servis par le cache, repos en ${t.reposMs} ms`);
 await s.fermer();
});

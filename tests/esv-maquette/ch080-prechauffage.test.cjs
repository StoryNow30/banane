'use strict';
/* CH-080 (D-309) — préchauffage de la coupe suivante ÉLOIGNÉE, dans un vrai Chromium, sur la maquette EPT en mode `saut` (50 coupes entre deux coupes à
 * faire). Ce que l'essai PROUVE sur la maquette :
 *  - sans le correctif (adaptateur du tronc : fenêtre de ±10 lignes) : la coupe suivante n'est pas trouvée (`sans-suivante`), AUCUN nœud n'est servi
 *    par le cache (essai rouge du ticket) ;
 *  - avec, hiérarchie éteinte : la coupe est trouvée (`liste-esv`, saut 50) mais seuls les nœuds déjà connus de Potree sont demandés (2 au plus) ;
 *  - avec, hiérarchie allumée (réglage livré) : les fichiers `ept-hierarchy` de la zone sont lus d'abord, puis les nœuds déduits ; nœuds ET fichiers de
 *    hiérarchie de la coupe suivante servis par le cache, chaîne plus courte ;
 *  - aucun événement ne contient d'adresse ni de clé de nœud.
 * Rien ici n'est vérifié sur le vrai ESV (chantiers/CH-080/rapport.md). */
const {test,after}=require('node:test'),assert=require('node:assert/strict');
const N=require('./navigateur.cjs'),O=require('./ch080-outils.cjs');
const raison=N.indisponible()||(O.adaptateurCH080()===null?'outil patch absent':null),opts=raison?{skip:raison}:{};
const ouverts=[];after(async()=>{for(const s of ouverts)await s.fermer().catch(()=>{});});
const sansAdresse=evts=>{const t=JSON.stringify(evts).replace(/"kind":"[^"]*"/g,'');assert.ok(!/\/|ept-data|\.bin|\d+-\d+-\d+-\d+/.test(t),'aucune adresse ni clé : '+t);};

/* Vision 6 (D-309) : une fois le patch intégré au tronc, l'adaptateur « sans le correctif » n'existe plus ; le cas se saute (il reste prouvé par l'historique du chantier). */
const integre=require('node:fs').readFileSync(require('node:path').join(N.racine,'src/adapter-page.js'),'utf8').includes('CH-080');
test('sans le correctif : saut de 50 coupes, sans-suivante, 0 nœud servi par le cache',integre?{skip:'patch CH-080 intégré au tronc'}:opts,async()=>{
 const s=await O.ouvrir({correctif:false});ouverts.push(s);
 const t=await s.transition();assert.equal(t.suivant-t.cut,50,'la maquette saute de 50 coupes');assert.ok(t.noeuds>0);assert.equal(t.cache,0);
 const p=t.evts.filter(e=>e.kind==='prechauffage');assert.ok(p.length>=1);assert.equal(p[0].motif,'sans-suivante');assert.equal(p[0].noeuds,0);
 await s.fermer();
});

test('avec le correctif, hiérarchie éteinte : coupe trouvée, seuls les nœuds déjà connus (2 au plus) servis par le cache',opts,async()=>{
 const s=await O.ouvrir({correctif:true,reglage:{hierarchie:false}});ouverts.push(s);
 const t=await s.transition();const p=t.evts.find(e=>e.kind==='prechauffage');
 assert.equal(p.source,'liste-esv');assert.equal(p.saut,50);assert.equal(p.hierarchies,0);assert.ok(p.frontiere>0,'frontières de la zone non lues');
 assert.ok(t.cache<=2,'cache : '+t.cache);assert.equal(t.hierCache,0);
 await s.fermer();
});

test('avec le correctif et la hiérarchie (réglage livré) : coupe prise dans la liste d’ESV (saut 50), nœuds et hiérarchie de sa zone servis par le cache',opts,async()=>{
 const s=await O.ouvrir({correctif:true});ouverts.push(s);
 const t=await s.transition();const p=t.evts.filter(e=>e.kind==='prechauffage');
 assert.equal(p[0].predite,t.suivant);assert.equal(p[0].source,'liste-esv');assert.equal(p[0].saut,50);assert.ok(p[0].noeuds>0&&p[0].noeuds<=24,'nœuds demandés : '+p[0].noeuds);
 assert.ok(p[0].hierarchies>=1&&p[0].hierarchies<=8,'fichiers de hiérarchie lus : '+p[0].hierarchies);assert.ok(p[0].deduits>0);assert.ok(p[0].noeuds+p[0].hierarchies<=24,'plafond');
 assert.ok(t.cache>=5,`nœuds de la coupe suivante servis par le cache : ${t.cache} sur ${t.noeuds}`);assert.ok(t.hierCache>=1,`hiérarchies servies par le cache : ${t.hierCache} sur ${t.hierarchies}`);
 sansAdresse(t.evts);
 console.log(`# saut 50 : ${p[0].hierarchies} hiérarchies et ${p[0].noeuds} nœuds demandés (${p[0].octets} o), ${t.cache}/${t.noeuds} nœuds et ${t.hierCache}/${t.hierarchies} hiérarchies servis par le cache, repos en ${t.reposMs} ms`);
 await s.fermer();
});

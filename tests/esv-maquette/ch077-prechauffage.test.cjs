'use strict';
/* CH-077 — préchauffage du cache du navigateur pour la coupe suivante, dans un vrai Chromium, sur la maquette en mode EPT (nœuds par adresse, en-têtes de
 * cache, chargement par étages) avec la copie patchée de l'adaptateur (tests/esv-maquette/ch077-outils.cjs). Ce que l'essai PROUVE sur la maquette :
 *  - sans préchauffage, AUCUN nœud de la coupe suivante n'est servi par le cache du navigateur (essai rouge du ticket) ;
 *  - avec, des nœuds de la coupe suivante le sont (`transferSize` nul), le bilan le dit, et le serveur reçoit moins de requêtes pendant le chargement ;
 *  - réponses `no-store` : rien n'est servi par le cache, l'événement d'en-têtes dit « no-store » ;
 *  - aucun événement ne contient d'adresse ni de clé de nœud.
 * Rien ici n'est vérifié sur le vrai ESV (le vrai cache d'ESV reste SUPPOSÉ : chantiers/CH-077/rapport.md). */
const {test,after}=require('node:test'),assert=require('node:assert/strict');
const N=require('./navigateur.cjs'),O=require('./ch077-outils.cjs');
const raison=N.indisponible()||(O.adaptateurPatche()===null?'outil patch absent':null),opts=raison?{skip:raison}:{};
const ouverts=[];after(async()=>{for(const s of ouverts)await s.fermer().catch(()=>{});});
const sansAdresse=evts=>{const t=JSON.stringify(evts).replace(/"kind":"[^"]*"/g,'');assert.ok(!/\/|ept-data|\.bin|\d+-\d+-\d+-\d+/.test(t),'aucune adresse ni clé : '+t);};

test('sans préchauffage : aucun nœud de la coupe suivante servi par le cache',opts,async()=>{
 const s=await O.ouvrir({prechauffer:false});ouverts.push(s);
 const t=await s.transition();assert.ok(t.noeuds>0,'la coupe suivante charge des nœuds');assert.equal(t.cache,0);
 assert.equal(t.evts.filter(e=>/^prechauffage/.test(e.kind)).length,0,'aucun événement de préchauffage');
 await s.fermer();
});

test('avec préchauffage : nœuds de la coupe suivante servis par le cache ; bilan juste ; aucune adresse',opts,async()=>{
 const s=await O.ouvrir({prechauffer:true});ouverts.push(s);
 const t1=await s.transition(),t2=await s.transition();
 const p=t1.evts.filter(e=>e.kind==='prechauffage');assert.ok(p.length>=1,'un préchauffage par capture');
 assert.equal(p[0].predite,t1.suivant,'coupe prédite = coupe chargée ensuite');assert.ok(p[0].noeuds>0&&p[0].noeuds<=24,'nœuds demandés : '+p[0].noeuds);
 assert.ok(t1.cache>0,`nœuds servis par le cache à la coupe suivante : ${t1.cache} sur ${t1.noeuds}`);
 const b=t2.evts.find(e=>e.kind==='prechauffage-bilan');assert.ok(b,'bilan à la capture suivante');assert.equal(b.juste,true);assert.ok(b.servisCache>0&&b.couverts>=b.servisCache);
 const h=[...t1.evts,...t2.evts].find(e=>e.kind==='prechauffage-entetes');assert.equal(h.classe,'max-age');assert.equal(h.maxAgeS,3600);
 sansAdresse([...t1.evts,...t2.evts]);
 console.log(`# préchauffage : ${p[0].noeuds} nœuds demandés (${p[0].octets} o), coupe suivante ${t1.cache}/${t1.noeuds} nœuds servis par le cache, chaîne ${t1.chaineMs} ms`);
 await s.fermer();
});

test('réponses no-store : rien servi par le cache, en-têtes « no-store »',opts,async()=>{
 const s=await O.ouvrir({prechauffer:true});ouverts.push(s);s.env.serveur.pannes({eptCache:'no-store'});
 const t=await s.transition();assert.equal(t.cache,0);
 const h=t.evts.find(e=>e.kind==='prechauffage-entetes');assert.equal(h?.classe,'no-store');sansAdresse(t.evts);
 await s.fermer();
});

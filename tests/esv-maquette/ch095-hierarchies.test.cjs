'use strict';
/* CH-095 — PANNE 2 : la boîte d'une coupe contient plus de `hierarchiesMax` (8) pages de hiérarchie non lues.
 * Vrai Chromium, maquette en forme relevée d'ESV et modèle mémoire de Potree 1.8.2, code de page DU TRONC, réglage LIVRÉ (voie potree, horizon 2,
 * `hierarchiesMax` 8). La panne est le paramètre `eptPas` de la maquette (`pagesHier` de tests/esv-maquette/ch095-outils.cjs) : 1 ou 2 niveaux par page
 * au lieu de toute la hiérarchie dans la page racine ; une coupe à faire toutes les 50, à 0,4 m (20 m entre deux cibles). Ce que les essais PROUVENT :
 *  - témoin sans préchauffage : Potree seul lit plus de 8 pages à l'arrivée sur la coupe lointaine (la boîte contient bien la panne) ;
 *  - opération proche (opération lointaine coupée) : l'opération FINIT avant le changement de coupe (événement non annulé), 8 pages par cible, et la
 *    DEUXIÈME cible du passage est servie (ses pages sont lues, sa boîte connaît plus de nœuds) ;
 *  - réglage livré (opération lointaine) : elle lit 8 pages et finit à l'arrivée ; l'opération proche du même passage et celle du passage suivant
 *    sont servies.
 * Plus de 8 pages non lues dans une boîte d'ESV : PROBABLE, non mesuré (relevé du 09/11 : toute la hiérarchie dans la page racine). */
const {test,after}=require('node:test'),assert=require('node:assert/strict');
const N=require('./navigateur.cjs');
const raison=N.indisponible(),opts=raison?{skip:raison}:{};
const O=raison?null:require('./ch095-outils.cjs');
const ouverts=[];after(async()=>{for(const s of ouverts)await s.fermer().catch(()=>{});});
const MAX=O?O.LIVRE.hierarchiesMax:8,SEANCE={cuts:151,saut:50,pas:.4};
const sansAdresse=evts=>assert.ok(!/\/|ept-data|\.laz|\d+-\d+-\d+-\d+/.test(JSON.stringify(evts).replace(/"kind":"[^"]*"/g,'')),'aucune adresse ni clé dans les événements');
/* Une transition avec relevé AVANT la validation : événements déjà postés, pages lues, boîte de la 2e cible. */
const passage=async(s,mortMs=2500)=>{const p0=s.pagesLues(),b0=await s.boite((await s.env.etat()).cut+100);
 const t=await s.transition({mortMs,avantValidation:async c=>({evts:await s.evenements(),pages:s.pagesLues()-p0,b2:await s.boite(c.cut+100)})});
 await new Promise(r=>setTimeout(r,1200));return {...t,b0,pagesArrivee:s.pagesLues()-p0,evts:[...t.extra.evts,...t.evts,...await s.evenements()]};};

test('opération proche, une page par nœud : plus de 8 pages non lues dans la boîte ; l\'opération finit, la deuxième cible est servie',opts,async()=>{
 const temoin=await O.ouvrir({...SEANCE,pagesHier:1,loin:false,prechauffer:false});ouverts.push(temoin);
 const t0=await passage(temoin,300);await temoin.fermer();
 assert.ok(t0.pagesArrivee>MAX,`témoin : Potree seul lit ${t0.pagesArrivee} pages à l'arrivée (plus de ${MAX})`);
 const s=await O.ouvrir({...SEANCE,pagesHier:1,loin:false});ouverts.push(s);
 const t=await passage(s);const avant=t.extra.evts.filter(e=>e.kind==='prechauffage');
 assert.equal(avant.length,1,'l\'opération a fini AVANT le changement de coupe');const p=avant[0];
 assert.equal(p.annule,false);assert.ok(['fini','plafond-noeuds'].includes(p.motif),'motif : '+p.motif);assert.equal(p.cibles,2);
 assert.equal(p.hierarchies,2*MAX,`${MAX} pages par cible, deux cibles`);assert.equal(t.extra.pages,2*MAX,'pages reçues par le serveur avant la validation');
 assert.ok(t.extra.b2.connus>t.b0.connus,`deuxième cible servie : sa boîte connaît ${t.extra.b2.connus} nœuds contre ${t.b0.connus}`);
 /* le passage suivant est servi aussi */
 const u=await passage(s);const q=u.extra.evts.filter(e=>e.kind==='prechauffage')[0];
 assert.ok(q&&q.annule===false&&q.hierarchies>0,'passage suivant : opération finie, des pages lues');
 sansAdresse([...t.evts,...u.evts]);
 console.log(`# une page par nœud : Potree seul ${t0.pagesArrivee} pages à l'arrivée ; préchauffage ${p.hierarchies} pages, ${p.memLances} load(), ${p.motif} en ${p.dureeMs} ms ; boîte de la 2e cible ${t.b0.connus} → ${t.extra.b2.connus} nœuds connus ; passage suivant ${q.motif}, ${q.hierarchies} pages, ${q.memLances} load()`);
 await s.fermer();
});

test('réglage livré (opération lointaine), deux niveaux par page : 8 pages puis fin à l\'arrivée ; l\'opération proche et le passage suivant sont servis',opts,async()=>{
 const temoin=await O.ouvrir({...SEANCE,pagesHier:2,prechauffer:false});ouverts.push(temoin);
 const t0=await passage(temoin,300);await temoin.fermer();
 assert.ok(t0.pagesArrivee>MAX,`témoin : Potree seul lit ${t0.pagesArrivee} pages à l'arrivée (plus de ${MAX})`);
 const s=await O.ouvrir({...SEANCE,pagesHier:2});ouverts.push(s);
 const t=await passage(s),u=await passage(s);
 const p=t.extra.evts.filter(e=>e.kind==='prechauffage')[0];assert.ok(p,'opération proche finie avant le changement de coupe');
 assert.equal(p.annule,false);assert.equal(p.hierarchies,MAX);assert.ok(p.memLances>0&&p.memCharges>0,'opération proche : des nœuds chargés');
 const l=[...t.evts,...u.evts].filter(e=>e.kind==='prechauffage-loin')[0];assert.ok(l,'bilan de l\'opération lointaine');
 assert.equal(l.motif,'arrivee');assert.equal(l.hierarchies,MAX);assert.ok(l.charges>0);assert.equal(l.echecs,0);
 const q=u.extra.evts.filter(e=>e.kind==='prechauffage')[0];assert.ok(q&&q.annule===false&&q.memLances>0,'passage suivant servi');
 assert.equal([...t.evts,...u.evts].filter(e=>/serveur/.test(e.motif||'')).length,0,'ni pause ni refus');sansAdresse([...t.evts,...u.evts]);
 console.log(`# deux niveaux par page : Potree seul ${t0.pagesArrivee} pages ; lointaine ${l.hierarchies} pages, ${l.lances} load(), ${l.charges} chargés à l'arrivée ; proche ${p.hierarchies} pages, ${p.memLances} load() ; passage suivant ${q.motif}, ${q.memLances} load()`);
 await s.fermer();
});

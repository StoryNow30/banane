'use strict';
/* CH-085 (lot « Vision 7 » du 09/11, ÉTABLI : nos fetch de préchauffage reçoivent 401, ceux de Potree 200) — VOIE POTREE sur la maquette : le serveur
 * exige l'en-tête `x-esv-jeton` que seul le Potree simulé envoie (panne `eptAuth`), forme relevée d'ESV, modèle mémoire de Potree 1.8.2, saut de 50.
 * Ce que l'essai PROUVE sur la maquette :
 *  - aujourd'hui (voie fetch) : nos requêtes reçoivent 401 et rien n'est en mémoire à l'arrivée au-delà de ce que Potree avait déjà ;
 *  - voie potree : ZÉRO requête refusée, les nœuds préchargés par node.load() sont chargés à l'arrivée, points affichés plus tôt ;
 *  - la coupe en cours garde tous ses nœuds ; aucune adresse dans les événements. Géométrie synthétique : le gain sur ESV reste SUPPOSÉ. */
const {test,after}=require('node:test'),assert=require('node:assert/strict');
const N=require('./navigateur.cjs'),O80=require('./ch080-outils.cjs');
const raison=N.indisponible()||(O80.adaptateurCH080()===null?'outil patch absent':null),opts=raison?{skip:raison}:{};
const O=raison?null:require('./ch083-outils.cjs');
const ouverts=[];after(async()=>{for(const s of ouverts)await s.fermer().catch(()=>{});});
const sansAdresse=evts=>assert.ok(!/\/|ept-data|\.laz|\d+-\d+-\d+-\d+/.test(JSON.stringify(evts).replace(/"kind":"[^"]*"/g,'')),'aucune adresse');

test('serveur authentifié : voie fetch refusée (401), voie potree : 0 refus, nœuds en mémoire à l\'arrivée',opts,async()=>{
 const r={};
 for(const voie of ['fetch','potree']){
  const s=await O.ouvrir({voie,auth:true,memoire:true});ouverts.push(s);const t=await s.transition();const p=t.evts.find(e=>e.kind==='prechauffage');
  r[voie]={t,p};
  console.log(`# voie ${voie} : ${t.refus} refus du serveur, arrivée ${t.arrivee.charges}/${t.arrivee.connus} chargés, points affichés ${t.afficheMs} ms, load() ${p.memLances}, motif ${p.motif}`);
  assert.deepEqual(t.apres,t.avant,'coupe en cours : mêmes nœuds connus, chargés, montés');assert.equal(t.liberes,0);
  sansAdresse(t.evts);await s.fermer();
 }
 assert.ok(r.fetch.t.refus>0,'aujourd\'hui : nos fetch reçoivent 401');assert.equal(r.fetch.p.memCharges,0,'aujourd\'hui : rien en mémoire (aucun 200)');
 assert.equal(r.potree.t.refus,0,'voie potree : aucune requête refusée');
 assert.ok(r.potree.p.memCharges>0,'voie potree : des nœuds chargés par node.load()');
 assert.ok(r.potree.t.arrivee.charges>=r.fetch.t.arrivee.charges+r.potree.p.memCharges-2,`chargés à l'arrivée : ${r.potree.t.arrivee.charges} contre ${r.fetch.t.arrivee.charges}`);
 assert.ok(r.potree.t.afficheMs<r.fetch.t.afficheMs,`points affichés plus tôt : ${r.potree.t.afficheMs} contre ${r.fetch.t.afficheMs} ms`);
});

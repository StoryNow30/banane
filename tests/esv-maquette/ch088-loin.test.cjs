'use strict';
/* CH-088 — OPÉRATION LOINTAINE sur la maquette (forme relevée d'ESV, modèle mémoire de Potree 1.8.2, voie potree, copie de l'adaptateur patchée par
 * chantiers/CH-088/adapter-page.patch) : 4 coupes à faire d'affilée puis un saut de 247 coupes. Ce que l'essai PROUVE sur la maquette :
 *  - avec l'opération lointaine, la cible est prise 3 coupes avant, ses nœuds sont chargés à l'arrivée en plus grand nombre, et les points de la
 *    coupe d'arrivée sont affichés plus tôt qu'avec le réglage de Vision 8 ;
 *  - événement `prechauffage-loin` (motif `arrivee`, 3 captures avant) et bilan à l'arrivée par l'arbre ; aucune adresse dans les événements.
 * Géométrie synthétique : le gain sur ESV reste SUPPOSÉ. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const N=require('./navigateur.cjs'),O88=require('./ch088-outils.cjs');
const raison=N.indisponible()||(O88.adaptateurCH088()===null?'outil patch absent':null),opts=raison?{skip:raison}:{};
const sansAdresse=evts=>assert.ok(!/\/|ept-data|\.laz|\d+-\d+-\d+-\d+/.test(JSON.stringify(evts).replace(/"kind":"[^"]*"/g,'')),'aucune adresse');

test('grand saut (247 coupes) : la cible est préchargée 3 coupes avant ; plus de nœuds chargés à l\'arrivée, points affichés plus tôt',opts,async()=>{
 const sans=await O88.grandSaut({loin:false}),avec=await O88.grandSaut({loin:true});
 for(const [n,r] of [['sans',sans],['avec',avec]])console.log(`# ${n} : arrivée ${r.t.arrivee.charges}/${r.t.arrivee.connus} chargés, points affichés ${r.t.afficheMs} ms ; loin ${JSON.stringify(r.loin.map(l=>[l.motif,l.captures,l.charges,l.prets,l.boite,l.potreeLui]))}`);
 assert.equal(sans.loin.length,0,'sans : aucune opération lointaine');
 const l=avec.loin.at(-1);assert.ok(l,'avec : une opération lointaine');assert.equal(l.motif,'arrivee');assert.equal(l.captures,3,'prise 3 coupes avant');assert.ok(l.charges>0);assert.equal(l.echecs,0);
 assert.ok(avec.t.arrivee.charges>sans.t.arrivee.charges,`chargés à l'arrivée : ${avec.t.arrivee.charges} contre ${sans.t.arrivee.charges}`);
 assert.ok(avec.t.afficheMs<sans.t.afficheMs,`points affichés : ${avec.t.afficheMs} contre ${sans.t.afficheMs} ms`);
 assert.deepEqual(avec.t.apres,avec.t.avant,'coupe en cours : mêmes nœuds');assert.equal(avec.t.liberes,0);
 sansAdresse(avec.evts);
});

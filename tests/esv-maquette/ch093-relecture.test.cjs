'use strict';
/* CH-093 — PASSAGE À LA RELECTURE sur la maquette (forme relevée d'ESV, modèle mémoire de Potree 1.8.2, voie potree, réglage livré, copie de
 * l'adaptateur patchée par chantiers/CH-093/adapter-page.patch) : fin du lot au cut 350, première coupe relue au cut 225 (125 coupes en arrière,
 * boîte jamais chargée). Ce que l'essai PROUVE sur la maquette :
 *  - avec une passe des différés de 3 cuts entre la fin du lot et la relecture, la première coupe relue est préchargée pendant la passe : plus de
 *    nœuds de sa boîte chargés à l'arrivée, points affichés plus tôt, dans le plafond de nœuds de l'opération lointaine (réglage livré) ;
 *  - sans passe, la commande de clôture part et l'opération lointaine arrive (`prechauffage-loin`, source `changement-mode`) : jamais moins de nœuds
 *    chargés à l'arrivée qu'avant (le gain dépend de l'avance, mesurée par le banc tools/ch093-banc.cjs) ;
 *  - aucun refus du serveur, aucun nœud libéré, aucune adresse dans les événements.
 * Géométrie synthétique : le gain sur ESV reste SUPPOSÉ. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const N=require('./navigateur.cjs'),O93=require('./ch093-outils.cjs');
const LIVRE=require('../../src/settings.js').lot.chargement.prechauffer,PLAFOND=LIVRE.loin.noeudsMax??LIVRE.noeudsMax;   /* CH-090 : plafond propre à l'opération lointaine */
const raison=N.indisponible()||(O93.adaptateurCH093()===null?'outil patch absent':null),opts=raison?{skip:raison}:{};
const sansAdresse=evts=>assert.ok(!/\/|ept-data|\.laz|\d+-\d+-\d+-\d+/.test(JSON.stringify(evts).replace(/"kind":"[^"]*"/g,'')),'aucune adresse');
const dire=(n,r)=>console.log(`# ${n} : arrivée ${r.arrivee.charges}/${r.arrivee.connus} chargés, points affichés ${r.afficheMs} ms, avance ${r.avanceReelleMs} ms ; loin ${JSON.stringify(r.loin.map(l=>[l.motif,l.source,l.captures,l.lances,l.charges]))}`);

test('passe de 3 cuts puis relecture : la première coupe relue est préchargée pendant la passe',opts,async()=>{
 const sans=await O93.seance({anticiper:false,passe:3}),avec=await O93.seance({anticiper:true,passe:3});dire('sans',sans);dire('avec',avec);
 assert.equal(sans.loin.length,0,'sans : aucune opération lointaine');
 const l=avec.loin.at(-1);assert.ok(l,'avec : une opération lointaine');
 assert.deepEqual([l.motif,l.source,l.cible,l.captures],['arrivee','changement-mode',225,3],'prise à la clôture du lot, gardée pendant les 3 captures de la passe');
 assert.ok(l.lances>0&&l.lances<=PLAFOND,`plafond de ${PLAFOND} nœuds de l'opération lointaine : ${l.lances}`);assert.equal(l.echecs,0);
 assert.ok(avec.arrivee.charges>=sans.arrivee.charges+10,`chargés à l'arrivée : ${avec.arrivee.charges} contre ${sans.arrivee.charges}`);
 assert.ok(avec.afficheMs<sans.afficheMs,`points affichés : ${avec.afficheMs} contre ${sans.afficheMs} ms`);
 for(const r of [sans,avec]){assert.equal(r.refus,0);assert.equal(r.liberes,0);assert.deepEqual(r.erreurs,[]);}
 sansAdresse(avec.evts);
});
test('sans passe : la commande de clôture part, l\'opération arrive ; jamais moins de nœuds chargés à l\'arrivée',opts,async()=>{
 const sans=await O93.seance({anticiper:false,avanceMs:600}),avec=await O93.seance({anticiper:true,avanceMs:600});dire('sans',sans);dire('avec',avec);
 assert.deepEqual(avec.commande,{lance:true});
 const l=avec.loin.at(-1);assert.ok(l);assert.deepEqual([l.motif,l.source,l.cible,l.captures],['arrivee','changement-mode',225,0]);
 assert.ok(avec.arrivee.charges>=sans.arrivee.charges,`chargés à l'arrivée : ${avec.arrivee.charges} contre ${sans.arrivee.charges}`);
 assert.equal(avec.refus,0);assert.equal(avec.liberes,0);sansAdresse(avec.evts);
});

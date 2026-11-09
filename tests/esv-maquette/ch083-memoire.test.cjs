'use strict';
/* CH-083 (D-314) — PHASE MÉMOIRE sur la maquette : forme relevée d'ESV et modèle mémoire de Potree 1.8.2 (load(), 4 en vol, 2 nœuds montés par image, LRU,
 * pointLoadLimit), saut de 50 coupes, réglage livré. Ce que l'essai PROUVE sur la maquette :
 *  - à l'arrivée sur la coupe suivante, les nœuds préchargés par Ariane sont `loaded` (compte `ept-arrivee`), bien plus que sans la phase ;
 *  - « points affichés » arrive plus tôt ;
 *  - la coupe EN COURS garde tous ses nœuds (chargés, montés) pendant le préchargement, et aucun nœud n'est libéré, sans pointLoadLimit (comme Potree)
 *    ni avec un pointLoadLimit égal aux points que la LRU tient déjà (un nœud préchargé n'entre pas dans la LRU) ;
 *  - aucune adresse dans les événements. La géométrie de la maquette est synthétique : le gain sur ESV reste SUPPOSÉ. */
const {test,after}=require('node:test'),assert=require('node:assert/strict');
const N=require('./navigateur.cjs'),O80=require('./ch080-outils.cjs');
const raison=N.indisponible()||(O80.adaptateurCH080()===null?'outil patch absent':null),opts=raison?{skip:raison}:{};
const O=raison?null:require('./ch083-outils.cjs');
const ouverts=[];after(async()=>{for(const s of ouverts)await s.fermer().catch(()=>{});});
const sansAdresse=evts=>assert.ok(!/\/|ept-data|\.laz|\d+-\d+-\d+-\d+/.test(JSON.stringify(evts).replace(/"kind":"[^"]*"/g,'')),'aucune adresse');

test('saut de 50 : les nœuds préchargés sont chargés à l\'arrivée ; points affichés plus tôt ; la coupe en cours garde tous ses nœuds',opts,async()=>{
 const r={};
 for(const memoire of [false,true]){
  const s=await O.ouvrir({memoire});ouverts.push(s);const t=await s.transition();const p=t.evts.find(e=>e.kind==='prechauffage');
  r[memoire]={t,p};
  console.log(`# mémoire ${memoire} : arrivée ${t.arrivee.charges}/${t.arrivee.connus} chargés, points affichés ${t.afficheMs} ms, load() ${p.memLances} (${p.memCharges} chargés, ${p.memOctets} octets décodés, tas ${p.tasAvantKo} → ${p.tasApresKo} Ko)`);
  assert.deepEqual(t.apres,t.avant,'coupe en cours : mêmes nœuds connus, chargés, montés, mêmes points dans la LRU');
  assert.equal(t.avant.charges,t.avant.connus,'coupe en cours entièrement chargée');assert.equal(t.liberes,0,'rien n\'est libéré (pointLoadLimit absent)');
  sansAdresse(t.evts);await s.fermer();
 }
 const on=r.true,off=r.false;
 assert.equal(off.p.memLances,null,'phase éteinte : aucun load()');
 assert.ok(on.p.memCharges>0&&on.p.memOctets>0,'phase allumée : des nœuds chargés, octets décodés comptés');
 assert.ok(on.t.arrivee.charges>=off.t.arrivee.charges+on.p.memCharges-2,`chargés à l'arrivée : ${on.t.arrivee.charges} contre ${off.t.arrivee.charges} (+${on.p.memCharges} préchargés)`);
 assert.ok(on.t.afficheMs<off.t.afficheMs,`points affichés plus tôt : ${on.t.afficheMs} contre ${off.t.afficheMs} ms`);
});

test('pointLoadLimit serré (= points que la LRU tient déjà) : le préchargement ne fait libérer aucun nœud de la coupe en cours',opts,async()=>{
 const s0=await O.ouvrir({memoire:true});ouverts.push(s0);const m=await s0.memoireEpt();await s0.fermer();
 const s=await O.ouvrir({memoire:true,limite:m.lruPoints});ouverts.push(s);
 const t=await s.transition();const p=t.evts.find(e=>e.kind==='prechauffage');
 console.log(`# limite ${m.lruPoints} points : ${p.memCharges} nœuds préchargés, coupe en cours ${t.apres.arbre}/${t.avant.arbre} montés, libérés pendant le temps mort : ${t.avant.arbre-t.apres.arbre}`);
 assert.ok(p.memCharges>0,'des nœuds préchargés');
 assert.deepEqual(t.apres,t.avant,'coupe en cours intacte : un nœud préchargé n\'entre pas dans la LRU');
 assert.equal(t.liberesCourant,0,'aucun nœud de la boîte affichée libéré');
 await s.fermer();
});

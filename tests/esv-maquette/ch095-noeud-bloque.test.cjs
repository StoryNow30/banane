'use strict';
/* CH-095 — PANNE 1 : un de nos load() reçoit un 502 ; le Potree simulé garde le nœud « en cours » et ne rend pas son compteur (CH-062).
 * Vrai Chromium, maquette en forme relevée d'ESV et modèle mémoire de Potree 1.8.2, code de page DU TRONC, réglage LIVRÉ (voie potree, ligne de base
 * des échecs, pause de 10 s). Séance : tests/esv-maquette/ch095-outils.cjs. Ce que les essais PROUVENT sur la maquette :
 *  1. la panne joue : une seule requête refusée, le nœud reste « en cours », le compteur brut reste à 1 au repos, Potree ne le redemande jamais, le
 *     reste de la boîte s'affiche ; le préchauffage se met en pause (`pause-serveur`), sans `refus-serveur` ;
 *  2. la capture des coupes suivantes n'est pas retardée par ce nœud : chaque vue sort à la règle « signal » (la ligne de base retire l'échec) ;
 *  3. APRÈS LA PAUSE, le préchauffage repart et charge — ROUGE sur le tronc au 10/11 (toutes les opérations sortent en `reseau-occupe`) : essai marqué
 *     `todo`, défaut décrit dans chantiers/CH-095/rapport.md ; à démarquer quand src/prechauffage.js est corrigé ;
 *  4. témoin, ligne de base coupée : la capture retombe au repli « stabilité » (la panne de CH-062), et le préchauffage, lui, repart.
 * Rien ici n'est mesuré sur ESV : le comportement du vrai Potree sur un 5xx est celui décrit par CH-062, repris tel quel par la maquette. */
const {test,after}=require('node:test'),assert=require('node:assert/strict');
const N=require('./navigateur.cjs');
const raison=N.indisponible(),opts=raison?{skip:raison}:{};
const O=raison?null:require('./ch095-outils.cjs'),O77=raison?null:require('./ch077-outils.cjs');
const ouverts=[];after(async()=>{for(const s of ouverts)await s.fermer().catch(()=>{});});
const prech=evts=>evts.filter(e=>e.kind==='prechauffage');
const sansAdresse=evts=>assert.ok(!/\/|ept-data|\.laz|\d+-\d+-\d+-\d+/.test(JSON.stringify(evts).replace(/"kind":"[^"]*"/g,'')),'aucune adresse ni clé dans les événements');
/* Séance commune des essais 1 à 3 : une transition saine, la panne, puis les coupes suivantes. */
const seance={s:null,tEchec:0,cle:null,evts:[],apres:[]};

test('502 sur un de nos load() : nœud gardé « en cours », compteur à 1, jamais redemandé ; préchauffage en pause ; capture toujours au signal',opts,async()=>{
 const s=seance.s=await O.ouvrir();ouverts.push(s);const srv=s.env.serveur;
 const t1=await s.transition();assert.deepEqual(t1.regles,['signal','signal'],'capture saine : règle du signal');
 assert.ok(prech(t1.evts).some(e=>e.memLances>0),'préchauffage sain : des load() à nous');
 await O77.attendre(async()=>await s.compteur()===0);
 s.pannes({eptEchec:{http:502,fois:1}});seance.tEchec=Date.now();   /* Potree est au repos : la prochaine requête de nœud est une des nôtres */
 const t2=await s.transition();seance.evts.push(...t1.evts,...t2.evts);
 assert.equal((srv.journal.echecsEpt||[]).length,1,'une requête refusée par le serveur');const cle=seance.cle=srv.journal.echecsEpt[0];
 const echec=(await s.journal('ept-echec'))[0];assert.equal(echec?.cle,cle);assert.equal(echec.cut,t2.cut,'échec pendant le temps mort de la coupe capturée : un chargement à nous, pas à Potree');
 const p=prech(t2.evts).at(-1);assert.ok(p,'événement de l\'opération');assert.equal(p.motif,'pause-serveur');assert.equal(p.annule,true);assert.ok(p.memLances>0);
 /* Coupes suivantes, pendant la pause : captures, état du nœud. */
 for(let i=0;i<2;i++){const t=await s.transition({mortMs:600});seance.apres.push(t);seance.evts.push(...t.evts);}
 for(const t of seance.apres)assert.deepEqual(t.regles,['signal','signal'],`coupe ${t.cut} : capture au signal malgré le nœud bloqué (${t.captureMs} ms)`);
 await O77.attendre(async()=>await s.compteur()===1,15000);await new Promise(r=>setTimeout(r,500));
 assert.equal(await s.compteur(),1,'compteur brut de Potree : +1 pour toujours');
 const boites=await Promise.all([t2.cut+1,t2.cut+2,t2.cut+3].map(c=>s.boite(c)));
 assert.ok(boites.some(b=>b&&b.clesEnCours.includes(cle)),'le nœud en échec est toujours « en cours » dans la boîte d\'une coupe suivante');
 assert.equal(srv.journal.ept[cle],1,'Potree ne redemande jamais le nœud');
 const aff=await s.journal('ept-affiche');assert.ok(seance.apres.every(t=>aff.some(a=>a.cut===t.cut)),'les coupes suivantes s\'affichent (le reste de la boîte)');
 assert.equal(seance.evts.filter(e=>e.motif==='refus-serveur').length,0,'aucun arrêt pour le lot');sansAdresse(seance.evts);
 console.log(`# 502 sur un load() à nous (coupe ${t2.cut}) : opération ${p.motif} après ${p.dureeMs} ms, ${p.memLances} load() ; captures suivantes ${seance.apres.map(t=>t.captureMs+' ms '+t.regles.join('/')).join(', ')} (saine : ${t1.captureMs} ms) ; compteur brut 1`);
});

test('après la pause (10 s), le préchauffage REPART et charge — rouge sur le tronc : `reseau-occupe` pour toujours',{...opts,todo:raison?undefined:'défaut du tronc (src/prechauffage.js : nœud en échec jamais sorti de `volNous` quand le 502 est vu avant `delaiMs`) : chantiers/CH-095/rapport.md'},async()=>{
 const s=seance.s;assert.ok(s&&seance.cle,'séance de l\'essai précédent');
 const reste=O.LIVRE.pauseMs+500-(Date.now()-seance.tEchec);if(reste>0)await new Promise(r=>setTimeout(r,reste));
 const ops=[];for(let i=0;i<3;i++){const t=await s.transition();ops.push(...prech(t.evts));}
 console.log(`# après la pause : ${ops.map(p=>`${p.motif} (${p.memLances??0} load())`).join(', ')}`);
 assert.ok(ops.length>0,'des opérations après la pause');
 assert.equal(ops.filter(p=>p.motif==='reseau-occupe').length,0,'aucune opération « réseau occupé » : Potree ne charge rien d\'autre');
 assert.ok(ops.some(p=>p.memLances>0&&p.memCharges>0),'des load() à nous, chargés, après la pause');
});

test('témoin, ligne de base coupée : la capture retombe au repli « stabilité » ; le préchauffage repart après la pause',opts,async()=>{
 const pauseMs=2000;   /* pause raccourcie pour le témoin seulement */
 const s=await O.ouvrir({ligneBase:false,reglage:{pauseMs}});ouverts.push(s);
 const t1=await s.transition();assert.deepEqual(t1.regles,['signal','signal']);await O77.attendre(async()=>await s.compteur()===0);
 s.pannes({eptEchec:{http:502,fois:1}});const t0=Date.now();
 const t2=await s.transition();assert.equal(prech(t2.evts).at(-1)?.motif,'pause-serveur');
 const t3=await s.transition({mortMs:600});
 assert.deepEqual(t3.regles,['stabilite','stabilite'],'sans ligne de base, le compteur bloqué ferme le signal : repli (CH-062)');
 const reste=pauseMs+500-(Date.now()-t0);if(reste>0)await new Promise(r=>setTimeout(r,reste));
 const ops=[];for(let i=0;i<2;i++)ops.push(...prech((await s.transition()).evts));
 console.log(`# témoin sans ligne de base : capture ${t3.captureMs} ms au repli (saine ${t1.captureMs} ms au signal) ; après la pause : ${ops.map(p=>`${p.motif} (${p.memLances??0} load())`).join(', ')}`);
 assert.ok(ops.some(p=>p.memLances>0&&p.memCharges>0),'sans ligne de base, le préchauffage repart (une place prise par le nœud bloqué)');
 await s.fermer();
});

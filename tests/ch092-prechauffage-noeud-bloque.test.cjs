'use strict';
/* CH-092 (relecture en adversaire de CH-085, CH-088, CH-089) — DÉFAUT « nœud bloqué » : après la pause de CH-089, le préchauffage ne repart plus.
 * Chemin : un de nos load() échoue (5xx d'ESV) ; Potree garde le nœud « en cours » pour toujours (CH-062). `nosEnVol()` (src/prechauffage.js, l. 411)
 * continue de le compter, pour la vie de la page :
 *  (1) avec la ligne de base de CH-062 (réglage livré `ligneDeBaseEchecs:true`), le compteur effectif retire l'échec : `chargements() !== nosEnVol()`
 *      pour toujours ; toute opération suivante sort en `reseau-occupe` (l. 696) et l'opération lointaine n'est plus jamais « libre » (l. 571) ;
 *  (2) sans ligne de base, deux nœuds bloqués occupent les `enVolMax` places (l. 502, l. 573) : plus aucun load(), l'opération tourne sans finir.
 * Dans les deux cas `actif` reste vrai et aucun `refus-serveur` n'est posté : la panne « un 502 arrête le préchauffage pour le lot » revient, muette.
 * Essais rouges marqués `todo`. Données synthétiques. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const {monter,contexte}=require('./ch092-prechauffage-monture.cjs');
const borne=r=>Promise.race([r,new Promise(f=>setTimeout(()=>f({motif:'jamais-fini'}),50))]);

test('un load() en échec (nœud gardé « en cours »), ligne de base allumée : après la pause, l\'opération suivante charge',async()=>{
 const m=monter({},{bloque:(nom,j)=>j.bloques.length<1&&j.appels.length>=2,ligneBase:true});const {pc,e,journal,p}=m;
 let r=p.apresCapture(contexte(pc));await e.tourner(300);assert.equal((await r).motif,'pause-serveur');assert.equal(journal.bloques.length,1);
 e.horloge+=10001;const avant=journal.appels.length;
 r=p.apresCapture(contexte(pc));await e.tourner(300);const ev=await borne(r);
 assert.equal(p.actif(),true);
 assert.notEqual(ev.motif,'reseau-occupe','réseau libre (compteur effectif 0) : pas « réseau occupé »');
 assert.ok(journal.appels.length>avant,'des load() après la pause');
});

test('deux load() en échec dans le même épisode, sans ligne de base : après la pause, l\'opération suivante charge et finit',async()=>{
 const m=monter({},{bloque:(nom,j)=>j.bloques.length<2&&j.appels.length>=2});const {pc,e,journal,p}=m;
 let r=p.apresCapture(contexte(pc));await e.tourner(300);assert.equal((await r).motif,'pause-serveur');assert.equal(journal.bloques.length,2);
 e.horloge+=10001;const avant=journal.appels.length;
 r=p.apresCapture(contexte(pc));await e.tourner(300);const ev=await borne(r);
 assert.equal(p.actif(),true);
 assert.ok(journal.appels.length>avant,'des load() après la pause');
 assert.notEqual(ev.motif,'jamais-fini','l\'opération finit');
});

/* CH-095 (maquette, navigateur, ÉTABLI) : le 502 est vu par l'observateur de ressources quelques ms après le load(), donc AVANT `delaiMs` ; la pause
 * part alors sans que le nœud bloqué soit sorti de nos chargements en vol : avec la ligne de base, le réseau n'était plus jamais « libre ». */
test('502 vu par l\'observateur avant delaiMs, nœud gardé « en cours », ligne de base allumée : après la pause, l\'opération suivante charge',async()=>{
 const m=monter({},{bloque:(nom,j)=>j.bloques.length<1&&j.appels.length>=2,ligneBase:true});const {pc,e,journal,p}=m;
 let vu=false;let r=p.apresCapture(contexte(pc));
 await e.tourner(60,()=>{if(!vu&&journal.bloques.length===1){vu=true;p.ressources([{name:'https://x.invalid/nuage/ept-data/'+journal.bloques[0]+'.laz',initiatorType:'fetch',responseStatus:502}]);}});
 assert.equal((await r).motif,'pause-serveur');assert.ok(e.horloge<2000,'pause partie avant delaiMs : '+e.horloge);
 e.horloge+=10001;const avant=journal.appels.length;
 r=p.apresCapture(contexte(pc));await e.tourner(300);const ev=await borne(r);
 assert.notEqual(ev.motif,'reseau-occupe','réseau libre : pas « réseau occupé »');assert.ok(journal.appels.length>avant,'des load() après la pause');assert.equal(p.actif(),true);
});

/* CH-095 (navigateur, ÉTABLI) : même panne SANS ligne de base (compteur brut : le nœud en échec y reste compté). La veille de l'opération prenait ce +1
 * pour « Potree qui repart » et annulait en `chargement` dès que nos places étaient prises. */
test('502 vu par l\'observateur avant delaiMs, sans ligne de base : après la pause, l\'opération suivante charge (pas « chargement »)',async()=>{
 const m=monter({},{bloque:(nom,j)=>j.bloques.length<1&&j.appels.length>=2});const {pc,e,journal,p}=m;
 let vu=false;let r=p.apresCapture(contexte(pc));
 await e.tourner(60,()=>{if(!vu&&journal.bloques.length===1){vu=true;p.ressources([{name:'https://x.invalid/nuage/ept-data/'+journal.bloques[0]+'.laz',initiatorType:'fetch',responseStatus:502}]);}});
 assert.equal((await r).motif,'pause-serveur');
 e.horloge+=10001;const charges=journal.charges.length;
 r=p.apresCapture(contexte(pc));await e.tourner(300);const ev=await borne(r);
 assert.notEqual(ev.motif,'chargement','le nœud bloqué n\'est pas « Potree qui repart »');assert.ok(journal.charges.length>charges+3,'des nœuds chargés après la pause : '+(journal.charges.length-charges));
});

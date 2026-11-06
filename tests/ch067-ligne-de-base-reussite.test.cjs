'use strict';
/* CH-067 (audit de CH-062) — ligne de base du compteur de chargement (src/adapter-page.js `chargementsEffectifs`, ALLUMÉE par défaut,
 * D-293) : « aucun chargement en cours » = `numNodesLoading − échecs === 0`, où `échecs` compte TOUTE requête `ept-data` vue au statut
 * 0 ou ≥ 400 pendant la vie de la page, pour toujours.
 * L'hypothèse (chantiers/CH-062/rapport.md § 0) : un nœud en échec n'est JAMAIS redemandé (Potree 1.8 d'origine). Elle n'est pas vérifiée
 * dans la page : si le même nœud est redemandé et réussit (réessai d'ESV, autre version de Potree, requête annulée au statut 0 puis
 * refaite), son +1 est rendu au compteur mais l'échec reste soustrait. Le compteur effectif passe alors à 0 pendant qu'un VRAI
 * chargement est en cours : la vue est lue « au signal », avant que ses points ne soient là — le contraire de la promesse écrite
 * dans le code (« un échec non vu […] : le repli d'aujourd'hui, jamais une lecture plus tôt »).
 * Scénario : le nœud « 0-0-0-0 » a rendu 502 puis 200 (même clé) ; un autre nœud est en vol (`numNodesLoading` = 1).
 * Attendu : repli « stabilité » (un échec suivi d'une réussite du même nœud n'est pas soustrait).
 * Page simulée au rythme des images (tests/helpers/esv-images.cjs), données synthétiques.
 *   node --test tests/ch067-ligne-de-base-reussite.test.cjs */
const {test}=require('node:test'),assert=require('node:assert/strict');
let ressources=[];
const P=require('./helpers/page.cjs'),pageOrig=P.page;
P.page=({globals={},...o}={})=>pageOrig({...o,globals:{...globals,
 PerformanceObserver:class{constructor(f){this.f=f;}observe(){this.f({getEntries:()=>ressources});}},
 BananeSettings:{...globals.BananeSettings,lot:{...globals.BananeSettings?.lot,signalEteint:{...globals.BananeSettings?.lot?.signalEteint,ligneDeBaseEchecs:true,declencheur:'signal',zoneRailM:3}}}}});
const {esv,nuage}=require('./helpers/esv-images.cjs');
const J=x=>JSON.parse(JSON.stringify(x??null));
const lus=f=>J(f.progress.filter(p=>p.stage==='capture-read').map(p=>p.detail));
async function lire(liste,chargements){ressources=liste;const f=esv({cut:100,chargements});nuage(f);const before=await f.call('state');await f.call('capture',before);return lus(f);}

test('témoin : un échec jamais redemandé, compteur bloqué à 1 : lecture au signal (comportement voulu de CH-062)',async()=>{
 const d=await lire([{name:'/x/ept-data/0-0-0-0.bin',responseStatus:502}],1);
 assert.deepEqual(d.map(x=>x.regle),['signal','signal']);
});

test('échec PUIS réussite du même nœud, un autre nœud en vol : repli, jamais une lecture au signal',async()=>{
 const d=await lire([{name:'/x/ept-data/0-0-0-0.bin',responseStatus:502},{name:'/x/ept-data/0-0-0-0.bin',responseStatus:200}],1);
 assert.deepEqual(d.map(x=>x.regle),['stabilite','stabilite'],'un vrai chargement est en cours : le compteur effectif ne doit pas valoir 0');
});

test('requête annulée (statut 0) puis refaite avec succès, un autre nœud en vol : repli',async()=>{
 const d=await lire([{name:'/x/ept-data/2-1-0-1.bin',responseStatus:0},{name:'/x/ept-data/2-1-0-1.bin',responseStatus:200}],1);
 assert.deepEqual(d.map(x=>x.regle),['stabilite','stabilite']);
});

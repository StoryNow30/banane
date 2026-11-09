'use strict';
/* CH-092 (relecture en adversaire de CH-085 et CH-088) — DÉFAUT « frontières au-delà de hierarchiesMax » et parcours de l'arbre à chaque image.
 * Chemin : la boîte de la cible contient plus de `hierarchiesMax` (8) nœuds dont la page de hiérarchie n'est pas lue. Après 8 loadHierarchy(), les
 * frontières restantes sont sautées (`continue`, src/prechauffage.js l. 504 et l. 582) mais restent dans `file` : la condition « cible finie »
 * (l. 499, l. 578) n'est jamais vraie. Conséquences :
 *  - opération proche : elle ne finit pas (aucun événement `prechauffage`) et ne passe jamais à la cible suivante du passage ;
 *  - opération lointaine : `selectionPotree` (parcours de l'arbre, jusqu'à 20 000 nœuds) tourne à CHAQUE image entre les captures, jusqu'à l'arrivée.
 * Et, sans frontière : l'opération proche refait ce parcours à chaque image même quand ses `enVolMax` places sont prises (l. 496-498), alors que
 * l'opération lointaine ne le fait que si une place est libre (l. 573). Le coût d'un parcours n'est pas mesuré ici.
 * Essais rouges marqués `todo`. Données synthétiques. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const {monter,contexte,tous}=require('./ch092-prechauffage-monture.cjs');
function frontieres(pc){let n9=0;for(const n of tous(pc))if(n.level===7&&n.boundingBox.min.x<=72&&n.boundingBox.max.x>=69){n9++;n.owner={};n.nodeinfo=undefined;n.loadHierarchy=async()=>{n.nodeinfo={pointCount:1000};};}return n9;}
function compterParcours(pc){const c={n:0},racine=pc.pcoGeometry.root,bb=racine.boundingBox;Object.defineProperty(racine,'boundingBox',{get(){c.n++;return bb;}});return c;}

test('opération proche, plus de 8 frontières dans la boîte : l\'opération finit quand plus rien n\'est lançable',async()=>{
 const m=monter({horizon:1,candidatsMax:1});const {pc,e,journal,p}=m;assert.ok(frontieres(pc)>8);
 let fini=null;p.apresCapture(contexte(pc)).then(x=>{fini=x;});
 await e.tourner(400);const appels=journal.appels.length;await e.tourner(400);
 assert.equal(m.potree.numNodesLoading,0,'plus rien en vol');assert.equal(journal.appels.length,appels,'plus rien de lancé');
 assert.ok(fini,'événement `prechauffage` posté (opération finie)');
});

test('opération lointaine, plus de 8 frontières dans la boîte : plus de parcours de l\'arbre quand plus rien n\'est lançable',async()=>{
 const m=monter({horizon:1,candidatsMax:1,loin:{actif:true,sautMin:11,coupesMax:40}});const {pc,e,journal,p}=m;assert.ok(frontieres(pc)>8);
 const c=compterParcours(pc);p.apresCapture(contexte(pc));
 await e.tourner(400);const appels=journal.appels.length,n0=c.n;await e.tourner(400);
 assert.equal(journal.appels.length,appels,'plus rien de lancé');
 assert.ok(c.n-n0<=1,`parcours de l'arbre pendant 400 images sans rien à lancer : ${c.n-n0}`);
});

test('opération proche, les 2 places prises : pas de parcours de l\'arbre à chaque image',async()=>{
 const m=monter({horizon:1,candidatsMax:1},{dureeImages:50});const {pc,e,p}=m;const c=compterParcours(pc);
 p.apresCapture(contexte(pc));await e.tourner(10);assert.equal(m.potree.numNodesLoading,2);const n0=c.n;await e.tourner(30);
 assert.equal(m.potree.numNodesLoading,2,'toujours 2 load() en vol, aucune place');
 assert.ok(c.n-n0<=1,`parcours de l'arbre en 30 images sans place libre : ${c.n-n0}`);
});

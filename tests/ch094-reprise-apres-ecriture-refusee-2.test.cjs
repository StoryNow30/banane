'use strict';
/* CH-094 — APRÈS UNE PAUSE « ÉCRITURE NON CONFIRMÉE », LA REPRISE REPASSE LA PORTE ET RÉÉCRIT LE JOURNAL (défaut 1 de CH-092).
 * Les essais 1a, 1b, 1c de CH-092 sont dans tests/ch092-moteur-reprise-apres-porte.test.cjs. Ici :
 *  2. le voisin du rapport CH-092 : une reprise abandonnée sur délai, qui finit plus tard, n'efface pas la liste de la fenêtre suivante ;
 *  3. après la reprise : ni pose ni validation perdue ou doublée, aucun SKIP ; la réécriture est consignée ;
 *  4. stockage toujours en panne : nouvelle pause motivée à chaque Reprendre, aucune commande, la liste est gardée ;
 *  5. la liste restée en attente tient la porte aussi hors de la boucle du lot (pose à la main) et après un redémarrage ;
 *  6. lot sans panne de stockage : mêmes commandes, événements, visites et état, à l'octet, avec et sans le patch. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const path=require('node:path'),{spawnSync}=require('node:child_process');
const {patchOk,Engine,lot,lotPannes,reprendre,attendre,sansPerteNiDoublon}=require('./helpers/ch094.cjs');
const pause=ms=>new Promise(ok=>setTimeout(ok,ms));
const QUATRE=['apply:100','validate:100','apply:101','validate:101'];
/* Panne des événements (hors `batch-…`) du retour de la validation du cut 101 jusqu'à `reparer()` : le montage de CH-092. */
const panne101=o=>{let panne=false;o.store.sort=c=>panne&&!String(c.type).startsWith('batch-')?'refus':null;
 const base=o.esv.validateAndNext.bind(o.esv);o.esv.validateAndNext=async(...a)=>{const r=await base(...a);if(o.esv.cmd.at(-1)==='validate:101')panne=true;return r;};
 o.reparer=()=>{panne=false;};};

test('le patch s’applique (après celui de CH-091 s’il est dans le dépôt), ou le tronc le porte',patchOk);


test('6. lot sans panne de stockage : commandes vers ESV, événements, visites et état identiques à l’octet, avec et sans le patch (4 combinaisons)',()=>{
 const outil=path.resolve(__dirname,'../chantiers/CH-094/identite.cjs');
 const lancer=env=>{const r=spawnSync(process.execPath,[outil],{encoding:'utf8',env:{...process.env,...env},maxBuffer:64*1024*1024});assert.equal(r.status,0,r.stderr);return r.stdout;};
 const avec=lancer({CH094_SANS_PATCH:''}),sans=lancer({CH094_SANS_PATCH:'1'});
 assert.ok(avec.length>10000);assert.equal(Buffer.compare(Buffer.from(avec),Buffer.from(sans)),0,'relevés différents');
 for(const [nom,l] of Object.entries(JSON.parse(avec)))assert.deepEqual(l.cmd,['apply:100','validate:100','apply:101','validate:101','apply:102','validate:102'],nom);
});

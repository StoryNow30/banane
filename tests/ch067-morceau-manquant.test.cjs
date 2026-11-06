'use strict';
/* CH-067 (audit de CH-059) — un morceau d'état ABSENT au démarrage n'est dit à personne.
 * src/storage.js `getState` recolle les listes, compte les morceaux absents dans `etat.etatMorceauxManquants`… et aucun module ne
 * lit ce champ (ni src/engine.js, ni background.js, ni le panneau : vérifié au 06/11). Le moteur reprend donc le lot sur une liste
 * TRONQUÉE, sans événement au journal ni consigne à l'opérateur ; la trace n'existe que dans l'état, invisible.
 * Scénario : lot en pause, 40 cuts posés (deux morceaux de `batch.processed`) ; le premier morceau manque au redémarrage du service
 * worker (disque abîmé, clé retirée par un autre outil) : le lot reprend avec 8 cuts posés, la fiche de fin de lot, la relecture et
 * le Rattrapage en oublient 32, et l'export du journal ne dit pas pourquoi.
 * Attendu : un événement `etat-morceaux-manquants` au journal (chemin, numéro de morceau), écrit par celui qui recolle.
 * Vrai moteur, vrai stockage, faux chrome.storage.local (tests/helpers/journee-etat.cjs), données synthétiques.
 *   node --test tests/ch067-morceau-manquant.test.cjs */
const {test}=require('node:test'),assert=require('node:assert/strict');
const J=require('./helpers/journee-etat.cjs'),M=require('../src/etat-morceaux.js');

test('morceau absent au démarrage : le lot reprend tronqué ET un événement le dit au journal',async()=>{
 const fc=J.fauxChrome(),s=J.magasin(fc);
 await s.setState({schemaVersion:4,mode:'observation',events:[],records:[],settings:{},
  batch:{id:'lot-m',state:'PAUSED',scope:{part:8},processed:Array.from({length:40},(_,i)=>({key:'k'+i,cut:i,identity:{part:8,cut:i}})),
   deferred:[],sequence:[],skipped:[],paused:[],interrupted:[],manuallyCompleted:[]}});
 const cle=M.cleMorceau('batch',['processed'],'lot-m',0);assert.ok(fc.disque.has(cle),'le morceau 0 a été écrit');
 fc.disque.delete(cle);
 const a=await J.ouvrir(fc);
 assert.equal(a.engine.s.batch.processed.length,8,'scénario : la liste est tronquée (morceau 1 seul)');
 const evs=[...a.store.tables.events.values()].filter(e=>e.type==='etat-morceaux-manquants');
 assert.equal(evs.length,1,'un événement au journal dit le morceau absent');
});

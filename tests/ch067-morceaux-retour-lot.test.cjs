'use strict';
/* CH-067 (audit de CH-059) — RETOUR ARRIÈRE EN PLEIN LOT vers un paquet antérieur (qui ignore les morceaux).
 * src/etat-morceaux.js coupe aussi les listes du LOT (`batch.processed`, `deferred`, `sequence`, …) et les écrit VIDES dans
 * `banane3State`. La parade du retour arrière (`enLigne`) ne couvre que `native.cloudIds` ; `tools/ch059-retour-arriere.cjs`
 * n'essaie qu'une session Écho, jamais un lot.
 * Scénario : lot de la partie 8 en pause au cut 43 (40 cuts posés, 3 différés) ; l'opérateur réinstalle le paquet précédent
 * (2bc1f56) ; son `getState` relit `banane3State` tel quel : lot PAUSED avec 0 posé et 0 différé. Rattrapage, relecture, compteurs
 * de la file et contrôle « déjà différé » (src/engine.js) travaillent à vide ; s'il diffère de nouveau le cut 41, la remise à
 * jour recolle les deux listes : le cut 41 deux fois, même clé.
 * Seul le dédoublonnage est intégré au tronc : la relecture complète du lot par un paquet antérieur reste une limite connue
 * (consigne : clore le lot avant tout retour arrière ; essais rouges gardés sur la branche chantier/CH-067).
 * Faux chrome.storage.local (tests/helpers/journee-etat.cjs), données synthétiques.   node --test tests/ch067-morceaux-retour-lot.test.cjs */
const {test}=require('node:test'),assert=require('node:assert/strict');
const J=require('./helpers/journee-etat.cjs');

const lot=()=>({id:'lot-r',state:'PAUSED',scope:{part:8},processed:Array.from({length:40},(_,i)=>({key:'k'+i,cut:i,identity:{part:8,cut:i}})),
 deferred:[41,42,43].map(c=>({key:'d'+c,cut:c,identity:{part:8,cut:c}})),sequence:[],skipped:[],paused:[],interrupted:[],manuallyCompleted:[]});
const etat=()=>({schemaVersion:4,mode:'observation',events:[],records:[],batch:lot(),settings:{}});

test('aller-retour : un cut différé de nouveau par le paquet antérieur n’est pas recollé deux fois',async()=>{
 const fc=J.fauxChrome(),s=J.magasin(fc);await s.setState(etat());
 /* Le paquet antérieur ne voit pas le cut 41 différé (liste vide) : il le diffère de nouveau, même clé, et réécrit tout l'état. */
 const ancien=JSON.parse(JSON.stringify(fc.disque.get('banane3State')));
 if(!ancien.batch.deferred.some(d=>d.key==='d41'))ancien.batch.deferred.push({key:'d41',cut:41,identity:{part:8,cut:41}});
 fc.disque.set('banane3State',ancien);
 const relu=await J.magasin(fc).getState(),cles=relu.batch.deferred.map(d=>d.key);
 assert.deepEqual(cles,[...new Set(cles)],'une clé de différé une seule fois');
});


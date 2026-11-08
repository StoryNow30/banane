'use strict';
/* D-305, piste 0 (lecture seule) : pour les nœuds ept-data téléchargés par ESV, l'observateur passif compte les réponses servies par
 * le cache du navigateur (transferSize 0, corps non vide) et sépare l'attente du serveur (début → premier octet) du transfert
 * (premier → dernier octet). Jamais d'adresse : les mêmes champs numériques que les autres relevés de ressources. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const {world,tick,ORIGIN}=require('./helpers/fake-page.cjs');require('../src/esv-observer.js');
const ept=(n,o={})=>({name:ORIGIN+'/data/ept-data/'+n+'.bin',startTime:100,responseStart:130,responseEnd:140,duration:40,transferSize:1000,decodedBodySize:1000,responseStatus:200,initiatorType:'xmlhttprequest',...o});
const fenetre=async w=>{w.runTimers();await tick();};

test('cache du navigateur, attente du serveur et transfert, par fenêtre ; aucune adresse dans le relevé',async()=>{
 const w=world();
 w.po().emit([ept('0-0-0-0'),ept('1-0-0-0',{startTime:200,responseStart:260,responseEnd:300}),ept('1-1-0-0',{transferSize:0,decodedBodySize:5000,startTime:400,responseStart:401,responseEnd:402})]);
 await fenetre(w);
 const r=w.observed().filter(x=>x.kind==='resource').at(-1);
 assert.deepEqual([r.ept,r.depuisCache,r.attenteServeurMs,r.transfertMs],[3,1,30+60+1,10+40+1]);
 assert.ok(!JSON.stringify(r).includes('ept-data'),'aucun chemin ni adresse');
});
test('sans réponse du cache ni premier octet connu : champs absents, rien d’inventé',async()=>{
 const w=world();
 w.po().emit([ept('0-0-0-0',{responseStart:undefined})]);await fenetre(w);
 const r=w.observed().filter(x=>x.kind==='resource').at(-1);
 assert.equal(r.ept,1);assert.ok(!('depuisCache' in r));assert.ok(!('attenteServeurMs' in r));assert.ok(!('transfertMs' in r));
});

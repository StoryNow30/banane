'use strict';
/* CH-080 (D-309) — L'OBSERVATEUR REND LA COUPE SUIVANTE, OÙ QU'ELLE SOIT, ET LE RELAIS GARDE `saut` ET `source`.
 * src/esv-observer.js `voisins` : à la demande, UNE ligne de plus au plus (`loin`) : la cible donnée (`cible`) ou la première ligne non validée après le
 * cut dans toute la table (`suivante`) ; sans demande, la réponse de CH-077 est inchangée. Relais (observateur puis service worker, `obsFields`) :
 * `saut` entier signé borné, `source` d'une liste fermée, nouveaux motifs ; une chaîne libre disparaît. Données synthétiques. */
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const O=require('../src/esv-observer.js'),{world}=require('./helpers/fake-page.cjs');

/* Table de 200 lignes : cut N en x = N, tout validé sauf 20 et 70 (la 71 passée). */
function tables(){const t=O.newTable(true),st={20:'invalid',70:'invalid',71:'skipped'};
 O.addRows(t,Array.from({length:200},(_,i)=>({RowKey:'r'+i,ExtractionStatus:st[i]||'valid',XLeftEdge:i,YLeftEdge:10,ZLeftEdge:10,XRightEdge:i,YRightEdge:11.435,ZRightEdge:10})));
 return new Map([['t',t]]);}
const monde={left:[20,10,10],right:[20,11.435,10]};

test('sans demande : réponse de CH-077 inchangée (fenêtre seule, aucun champ `loin`)',()=>{
 const r=O.voisins(tables(),{cut:20,fenetre:10,world:monde});assert.equal(r.ok,true);assert.equal('loin' in r,false);assert.equal(r.rows.length,21);
});

test('`suivante` : première ligne non validée après le cut dans TOUTE la table, une seule ligne rendue',()=>{
 const r=O.voisins(tables(),{cut:20,fenetre:10,world:monde,suivante:true});
 assert.equal(r.loin.i,70);assert.equal(r.loin.s,'invalid');assert.deepEqual(r.loin.e,[70,10,10,70,11.435,10]);assert.equal(r.rows.length,21,'fenêtre inchangée');
 assert.equal(O.voisins(tables(),{cut:70,fenetre:10,world:monde,suivante:true}).loin.i,71,'une ligne passée n’est pas validée');
 assert.equal(O.voisins(tables(),{cut:71,fenetre:10,world:monde,suivante:true}).loin,null,'plus rien devant : null');
});

test('`cible` : la ligne demandée, quel que soit son statut ; hors table : null',()=>{
 const t=tables();assert.equal(O.voisins(t,{cut:20,fenetre:10,world:monde,cible:150}).loin.i,150);assert.equal(O.voisins(t,{cut:20,fenetre:10,world:monde,cible:150}).loin.s,'valid');
 assert.equal(O.voisins(t,{cut:20,fenetre:10,world:monde,cible:900}).loin,null);assert.equal(O.voisins(t,{cut:20,fenetre:10,world:monde,cible:-3}).loin,null);
});

const ADRESSE=/\/|https?:|ept-data|\.bin|\d+-\d+-\d+-\d+/;
const EVTS=[{kind:'prechauffage',coupe:20,predite:70,op:3,saut:50,source:'liste-esv',noeuds:6,annule:false,motif:'fini',url:'/a/ept-data/1-0-0-0.bin'},
 {kind:'prechauffage',coupe:80,predite:30,op:4,saut:-50,source:'relu',noeuds:0,annule:false,motif:'saut-court'},
 {kind:'prechauffage',coupe:20,op:5,saut:'50',source:'/ept-data/1-0-0-0',motif:'indice-perime'},
 {kind:'prechauffage',coupe:20,op:6,saut:2.5,source:'passe-differes',motif:'sans-cible'}];
let ring=[];
test('observateur : `saut` (entier signé) et `source` (liste fermée) relayés ; nouveaux motifs connus ; aucune chaîne libre',()=>{
 const w=world();for(const event of EVTS)w.deliver({kind:'banane5:evt',event});
 ring=w.observed().filter(x=>x.kind==='prechauffage');assert.equal(ring.length,4);
 assert.deepEqual(ring.map(x=>[x.saut,x.source,x.motif]),[[50,'liste-esv','fini'],[-50,'relu','saut-court'],[null,null,'indice-perime'],[null,'passe-differes','sans-cible']]);
 assert.ok(!ADRESSE.test(JSON.stringify(ring).replace(/"kind":"[^"]*"/g,'')));
});

test('service worker : obsFields relit `saut` et `source` à l’identique de l’observateur',()=>{
 const src=fs.readFileSync(path.join(__dirname,'../background.js'),'utf8'),debut=src.indexOf('const obsInt='),fin=src.indexOf('}return null;}',src.indexOf('function obsFields('))+'}return null;}'.length;
 const ctx={OBS_REASONS:new Set()};vm.createContext(ctx);vm.runInContext(src.slice(debut,fin)+';this.obsFields=obsFields;',ctx);
 const lus=[...ring,...EVTS].map(x=>JSON.parse(JSON.stringify(ctx.obsFields(JSON.parse(JSON.stringify(x))))));
 assert.deepEqual(lus.slice(0,4).map(x=>[x.saut,x.source,x.motif]),ring.map(x=>[x.saut,x.source,x.motif]));
 assert.deepEqual(lus.slice(4).map(x=>[x.saut,x.source,x.motif]),ring.map(x=>[x.saut,x.source,x.motif]),'même réduction aux deux couches');
 assert.ok(!ADRESSE.test(JSON.stringify(lus).replace(/"kind":"[^"]*"/g,'')));
});

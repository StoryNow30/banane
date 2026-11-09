'use strict';
/* CH-083 — OBSERVATEUR ET RELAIS des champs de la phase mémoire (`memLances`, `memCharges`, `memOctets`, `memEchecs`, `memRefuses`, `memEnVolFin`,
 * `tasAvantKo`, `tasApresKo`) et de `limitePoints` (Potree.pointLoadLimit) dans `prechauffage-vue` : entiers bornés seulement, réduits par l'observateur
 * (src/esv-observer.js) puis relus tels quels par le service worker (background.js, `obsFields`) ; une chaîne ou une adresse glissée devient null.
 * Fausse page (tests/helpers/fake-page.cjs), données synthétiques. */
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {world}=require('./helpers/fake-page.cjs');
const CH=['memLances','memCharges','memOctets','memEchecs','memRefuses','memEnVolFin','tasAvantKo','tasApresKo'];
test('nouveaux champs : gardés en entiers, une adresse glissée devient null ; le service worker les relit tels quels',()=>{
 const w=world();
 w.deliver({kind:'banane5:evt',event:{kind:'prechauffage',coupe:20,predite:70,op:1,motif:'fini',memLances:28,memCharges:27,memOctets:448000,memEchecs:1,memRefuses:0,memEnVolFin:0,tasAvantKo:33297,tasApresKo:40555}});
 w.deliver({kind:'banane5:evt',event:{kind:'prechauffage',coupe:21,predite:71,op:2,motif:'fini',memLances:'/x/ept-data/1-0-0-0.laz',memOctets:-5}});
 w.deliver({kind:'banane5:evt',event:{kind:'prechauffage-vue',type:'orthographique',pointBudget:1000000,maxLevel:-1,limitePoints:5000000}});
 const ring=w.observed().filter(x=>/^prechauffage/.test(x.kind));assert.equal(ring.length,3);
 assert.deepEqual(CH.map(k=>ring[0][k]),[28,27,448000,1,0,0,33297,40555]);
 assert.equal(ring[1].memLances,null);assert.equal(ring[1].memOctets,null);assert.equal(ring[2].limitePoints,5000000);
 const src=fs.readFileSync(path.join(__dirname,'../background.js'),'utf8'),debut=src.indexOf('const obsInt='),fin=src.indexOf('}return null;}',src.indexOf('function obsFields('))+'}return null;}'.length;
 const ctx={OBS_REASONS:new Set()};vm.createContext(ctx);vm.runInContext(src.slice(debut,fin)+';this.obsFields=obsFields;',ctx);
 const lus=ring.map(x=>ctx.obsFields(JSON.parse(JSON.stringify(x))));
 assert.deepEqual(JSON.parse(JSON.stringify(lus)),JSON.parse(JSON.stringify(ring.map(({seq,...x})=>x))),'ce que l’observateur garde passe tel quel');
});

test('CH-085 : motif refus-serveur et diagnostic d\'authentification de la vue (booléens, compte) relayés',()=>{
 const w=world();
 w.deliver({kind:'banane5:evt',event:{kind:'prechauffage',coupe:20,predite:70,op:1,motif:'refus-serveur'}});
 w.deliver({kind:'banane5:evt',event:{kind:'prechauffage-vue',type:'orthographique',fetchNatif:false,credXhr:true,enTetesXhr:1}});
 const ring=w.observed().filter(x=>/^prechauffage/.test(x.kind));
 assert.equal(ring[0].motif,'refus-serveur');assert.deepEqual([ring[1].fetchNatif,ring[1].credXhr,ring[1].enTetesXhr],[false,true,1]);
 const src=fs.readFileSync(path.join(__dirname,'../background.js'),'utf8'),debut=src.indexOf('const obsInt='),fin=src.indexOf('}return null;}',src.indexOf('function obsFields('))+'}return null;}'.length;
 const ctx={OBS_REASONS:new Set()};vm.createContext(ctx);vm.runInContext(src.slice(debut,fin)+';this.obsFields=obsFields;',ctx);
 assert.deepEqual(JSON.parse(JSON.stringify(ring.map(x=>ctx.obsFields(JSON.parse(JSON.stringify(x)))))),JSON.parse(JSON.stringify(ring.map(({seq,...x})=>x))));
});

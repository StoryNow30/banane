'use strict';
/* CH-077 — RELAIS DES ÉVÉNEMENTS DU PRÉCHAUFFAGE, sans adresse : l'adaptateur de la page poste `prechauffage`, `prechauffage-bilan` et
 * `prechauffage-entetes` à l'observateur (src/esv-observer.js), qui les réduit ; le service worker (background.js, `obsFields`) les relit champ par
 * champ. Les deux couches ne gardent que des entiers bornés, des booléens et des motifs ou classes d'une liste fermée : un champ chaîne inattendu (une
 * adresse glissée dans un événement par erreur) disparaît. Fausse page (tests/helpers/fake-page.cjs), données synthétiques. */
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {world}=require('./helpers/fake-page.cjs');
const ADRESSE=/\/|https?:|ept-data|\.bin|\d+-\d+-\d+-\d+/;
const piege={url:'/nuage/ept-data/3-1-2-0.bin',cle:'3-1-2-0',adresses:['/a/ept-data/1-0-0-0.bin']};
const EVTS=[
 {kind:'prechauffage',coupe:20,predite:21,op:3,niveauMax:9,intersectants:40,charges:20,enCours:0,frontiere:2,candidats:20,noeuds:12,termines:12,octets:3000000,dureeMs:420,annule:false,motif:'fini',...piege},
 {kind:'prechauffage',coupe:20,predite:21,op:4,noeuds:2,annule:true,motif:'/nuage/ept-data/3-1-2-0.bin'},
 {kind:'prechauffage-bilan',coupe:21,predite:21,op:3,juste:true,demandes:12,potree:9,couverts:7,servisCache:7,cacheTotal:7,...piege},
 {kind:'prechauffage-entetes',classe:'max-age',maxAgeS:3600,etag:true,lastModified:false,expires:false,pragma:false,statut:200,valeur:'public, max-age=3600',...piege}];
const verifier=(sorties,etape)=>{for(const x of sorties){for(const [k,v] of Object.entries(x))if(k!=='kind')assert.ok(!(typeof v==='string'&&ADRESSE.test(v)),`${etape} : ${x.kind}.${k} = ${v}`);
  for(const k of ['url','cle','adresses','valeur'])assert.ok(!(k in x),`${etape} : champ ${k} retiré`);}};
let ring=[];
test('observateur : événements du préchauffage relayés, réduits aux comptes et aux classes',()=>{
 const w=world();for(const event of EVTS)w.deliver({kind:'banane5:evt',event});
 ring=w.observed().filter(x=>/^prechauffage/.test(x.kind));assert.equal(ring.length,4);verifier(ring,'observateur');
 assert.deepEqual([ring[0].coupe,ring[0].predite,ring[0].noeuds,ring[0].octets,ring[0].frontiere,ring[0].motif,ring[0].annule],[20,21,12,3000000,2,'fini',false]);
 assert.equal(ring[1].motif,null,'motif hors liste : null');
 assert.deepEqual([ring[2].juste,ring[2].potree,ring[2].couverts,ring[2].servisCache],[true,9,7,7]);
 assert.deepEqual([ring[3].classe,ring[3].maxAgeS,ring[3].etag,ring[3].statut],['max-age',3600,true,200]);
});
test('service worker : obsFields relit les événements du préchauffage champ par champ, sans chaîne libre',()=>{
 const src=fs.readFileSync(path.join(__dirname,'../background.js'),'utf8'),debut=src.indexOf('const obsInt='),fin=src.indexOf('}return null;}',src.indexOf('function obsFields('))+'}return null;}'.length;
 assert.ok(debut>0&&fin>debut);const ctx={OBS_REASONS:new Set()};vm.createContext(ctx);vm.runInContext(src.slice(debut,fin)+';this.obsFields=obsFields;',ctx);
 const lus=[...ring,...EVTS].map(x=>ctx.obsFields(JSON.parse(JSON.stringify(x))));
 assert.ok(lus.every(Boolean),'les trois sortes sont connues du service worker');verifier(lus,'service worker');
 assert.deepEqual(JSON.parse(JSON.stringify(lus.slice(0,4))),JSON.parse(JSON.stringify(ring.map(({seq,...x})=>x))),'ce que l’observateur garde passe tel quel (hors numéro d’ordre)');
});

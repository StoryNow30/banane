'use strict';
/* CH-081 — OBSERVATEUR ET RELAIS : `premiere` (première ligne non validée de toute la table, hors le cut courant) ; nouveaux champs du préchauffage
 * (`zone`, `cibles`, `calibree` ; bilan `utiles`, `inutiles` ; événement `prechauffage-vue`) réduits par l'observateur (src/esv-observer.js) puis relus
 * par le service worker (background.js, `obsFields`) : entiers bornés, booléens et listes fermées seulement ; une adresse glissée disparaît ; source
 * `changement-mode` et motifs `plafond-lot`, `deja-prechauffe` connus. Fausse page (tests/helpers/fake-page.cjs), données synthétiques. */
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const O=require('../src/esv-observer.js'),{world}=require('./helpers/fake-page.cjs');
const ADRESSE=/\/|https?:|ept-data|\.bin|\d+-\d+-\d+-\d+/;
function tables(st){const t=O.newTable(true);
 O.addRows(t,Array.from({length:200},(_,i)=>({RowKey:'r'+i,ExtractionStatus:st[i]||'valid',XLeftEdge:i,YLeftEdge:10,ZLeftEdge:10,XRightEdge:i,YRightEdge:11.435,ZRightEdge:10})));
 return new Map([['t',t]]);}
const monde={left:[190,10,10],right:[190,11.435,10]};
const piege={url:'/nuage/ept-data/3-1-2-0.bin',cle:'3-1-2-0'};
const EVTS=[
 {kind:'prechauffage',coupe:190,predite:5,op:3,noeuds:12,annule:false,motif:'plafond-lot',saut:-185,source:'changement-mode',zone:'boite',cibles:2,calibree:true,...piege},
 {kind:'prechauffage',coupe:20,predite:21,op:4,motif:'deja-prechauffe',zone:'/x/ept-data/1-0-0-0.bin',cibles:-1,calibree:'oui'},
 {kind:'prechauffage-bilan',coupe:21,predite:21,op:3,juste:true,demandes:12,potree:9,couverts:7,servisCache:7,cacheTotal:7,utiles:6,inutiles:4,...piege},
 {kind:'prechauffage-vue',type:'orthographique',demiLargeurMm:200,demiHauteurMm:228,profondeurM:20000,champDeg:null,pointBudget:1000000,maxLevel:-1,minNodeSize:30,boites:1,position:'844565,6519774',...piege}];

test('observateur : `premiere` rend la première ligne non validée de toute la table, hors le cut courant',()=>{
 const r=O.voisins(tables({5:'invalid',190:'invalid'}),{cut:190,fenetre:10,world:monde,premiere:true});
 assert.equal(r.ok,true);assert.equal(r.loin.i,5);
 assert.equal(O.voisins(tables({190:'invalid'}),{cut:190,fenetre:10,world:monde,premiere:true}).loin,null,'le cut courant n’est pas sa propre suivante');
 assert.equal('loin' in O.voisins(tables({}),{cut:190,fenetre:10,world:monde}),false,'rien demandé : réponse de CH-077 inchangée');
});

let ring=[];
test('observateur puis service worker : nouveaux champs réduits, aucune adresse ni position',()=>{
 const w=world();for(const event of EVTS)w.deliver({kind:'banane5:evt',event});
 ring=w.observed().filter(x=>/^prechauffage/.test(x.kind));assert.equal(ring.length,4);
 assert.deepEqual([ring[0].motif,ring[0].source,ring[0].saut,ring[0].zone,ring[0].cibles,ring[0].calibree],['plafond-lot','changement-mode',-185,'boite',2,true]);
 assert.deepEqual([ring[1].motif,ring[1].zone,ring[1].cibles,ring[1].calibree],['deja-prechauffe',null,null,null],'hors liste : null');
 assert.deepEqual([ring[2].utiles,ring[2].inutiles],[6,4]);
 assert.deepEqual([ring[3].camera/* CH-088 : l'ancien `type` relu en `camera` */,ring[3].demiLargeurMm,ring[3].pointBudget,ring[3].maxLevel,ring[3].boites],['orthographique',200,1000000,-1,1]);
 const src=fs.readFileSync(path.join(__dirname,'../background.js'),'utf8'),debut=src.indexOf('const obsInt='),fin=src.indexOf('}return null;}',src.indexOf('function obsFields('))+'}return null;}'.length;
 const ctx={OBS_REASONS:new Set()};vm.createContext(ctx);vm.runInContext(src.slice(debut,fin)+';this.obsFields=obsFields;',ctx);
 const lus=ring.map(x=>ctx.obsFields(JSON.parse(JSON.stringify(x))));assert.ok(lus.every(Boolean),'les quatre sortes sont connues du service worker');
 assert.deepEqual(JSON.parse(JSON.stringify(lus)),JSON.parse(JSON.stringify(ring.map(({seq,...x})=>x))),'ce que l’observateur garde passe tel quel');
 for(const x of [...ring,...lus]){for(const [k,v] of Object.entries(x))if(k!=='kind')assert.ok(!(typeof v==='string'&&ADRESSE.test(v)),`${x.kind}.${k} = ${v}`);
  for(const k of ['url','cle','position'])assert.ok(!(k in x),`champ ${k} retiré`);}
});

test('service worker : la cible de la relecture et de la passe porte `apres` (horizon 2), jamais le lot',()=>{
 const src=fs.readFileSync(path.join(__dirname,'../background.js'),'utf8'),a=src.indexOf('function avecPrechauffage('),b=src.indexOf('\n',src.indexOf('return {...etat,prechauffage',a));
 const ctx={globalThis:{BananeCore3:{uid:()=>'u'}}};vm.createContext(ctx);vm.runInContext(src.slice(a,b+1)+';this.f=avecPrechauffage;',ctx);
 const e={identity:{part:23,cut:20}};
 assert.deepEqual(JSON.parse(JSON.stringify(ctx.f(e,30,'relu',31).prechauffage)),{part:23,de:20,cut:30,source:'relu',op:'u',apres:31});
 assert.equal('apres' in ctx.f(e,30,'relu',undefined).prechauffage,false,'sans cut d’après : champ absent');
 assert.ok(/avecPrechauffage\(etat,suivanteRelue,'relu',apresRelue(,loinRelue)?\)/.test(src)&&/avecPrechauffage\(etat,E\?\.suivante,'passe-differes',E\?\.apres(,E\?\.loin)?\)/.test(src));   /* CH-088 : `loin` en plus */
});

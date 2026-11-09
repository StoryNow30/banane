'use strict';
/* CH-088 — RELAIS ET BILAN : (1) `prechauffage-vue` porte `camera` ; le champ `type` qu'il portait jusqu'ici écrasait le type de l'enveloppe du journal
 * (`esv-observation`) : lot « Vision 8 » du 09/11, ÉTABLI, 3 événements présents mais lus « orthographique » et invisibles aux outils ; (2) nouveaux
 * champs du bilan à l'arrivée et événement `prechauffage-loin`, réduits par l'observateur puis relus par le service worker (entiers, booléens, listes
 * fermées) ; (3) demande `loin` à l'observateur (liste du lot) ; (4) cible lointaine de la relecture et de la passe jointe par le service worker ;
 * (5) tools/bilan-lot.cjs compte la voie potree et relit la vue (ancienne forme comprise). Données synthétiques. */
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const O=require('../src/esv-observer.js'),{world}=require('./helpers/fake-page.cjs'),B=require('../tools/bilan-lot.cjs');
const ADRESSE=/\/|https?:|ept-data|\.bin|\d+-\d+-\d+-\d+/;
const SRC=fs.readFileSync(path.join(__dirname,'../background.js'),'utf8');
function obsFields(){const debut=SRC.indexOf('const obsInt='),fin=SRC.indexOf('}return null;}',SRC.indexOf('function obsFields('))+'}return null;}'.length;
 const ctx={OBS_REASONS:new Set()};vm.createContext(ctx);vm.runInContext(SRC.slice(debut,fin)+';this.obsFields=obsFields;',ctx);return ctx.obsFields;}
function tables(st){const t=O.newTable(true);
 O.addRows(t,Array.from({length:200},(_,i)=>({RowKey:'r'+i,ExtractionStatus:st[i]||'valid',XLeftEdge:i,YLeftEdge:10,ZLeftEdge:10,XRightEdge:i,YRightEdge:11.435,ZRightEdge:10})));
 return new Map([['t',t]]);}
const monde={left:[20,10,10],right:[20,11.435,10]};
const piege={url:'/nuage/ept-data/3-1-2-0.bin',cle:'3-1-2-0'};

test('observateur : `loin` suit la chaîne des non validés et rend la première à ≥ S de la précédente, avec `avant` et `saut`',()=>{
 const T=tables({20:'invalid',21:'invalid',22:'invalid',25:'invalid',90:'invalid',91:'invalid'});
 const r=O.voisins(T,{cut:20,fenetre:10,world:monde,loin:11});
 assert.equal(r.ok,true);assert.equal(r.loin.i,90);assert.equal(r.loin.avant,3,'21, 22, 25 avant');assert.equal(r.loin.saut,65);
 assert.equal(O.voisins(T,{cut:20,fenetre:10,world:monde,loin:11,max:2}).loin,null,'au-delà de max lignes : rien');
 assert.equal(O.voisins(T,{cut:91,fenetre:10,world:monde,loin:11}).loin,null,'aucune plus loin');
 assert.equal(O.voisins(tables({20:'invalid',31:'invalid'}),{cut:20,fenetre:10,world:monde,loin:11}).loin.avant,0,'la suivante elle-même');
 assert.equal('loin' in O.voisins(T,{cut:20,fenetre:10,world:monde}),false,'rien demandé : réponse inchangée');
});

test('observateur puis service worker : vue en `camera` (jamais `type`), bilan à l\'arrivée et opération lointaine réduits',()=>{
 const w=world();
 const evts=[{kind:'prechauffage-vue',camera:'orthographique',pointBudget:2000000,limitePoints:4000000,maxLevel:-1,fetchNatif:true,credXhr:false,enTetesXhr:0,...piege},
  {kind:'prechauffage-vue',type:'perspective',pointBudget:1},   /* ancien module */
  {kind:'prechauffage-bilan',coupe:70,predite:70,op:3,juste:true,demandes:4,potree:0,couverts:0,servisCache:0,cacheTotal:0,utiles:0,inutiles:0,boite:17,prets:12,nousPrets:9,nousEnVol:2,boiteFin:18,potreeLui:5,nousApres:2,...piege},
  {kind:'prechauffage-loin',coupe:20,cible:90,saut:70,avant:3,source:'liste-esv',captures:3,msAvant:2400,lances:14,charges:12,chargesFin:14,echecs:0,hierarchies:1,octets:900000,enVolArrivee:2,boite:17,prets:14,nousPrets:12,nousEnVol:2,boiteFin:18,potreeLui:3,nousApres:2,plafond:false,pauses:4,dureeMs:3100,motif:'arrivee',...piege},
  {kind:'prechauffage-loin',coupe:20,cible:90,saut:-70,source:'/x',motif:'n-importe',plafond:'oui'}];
 for(const event of evts)w.deliver({kind:'banane5:evt',event});
 const ring=w.observed().filter(x=>/^prechauffage/.test(x.kind));assert.equal(ring.length,5);
 assert.equal(ring[0].camera,'orthographique');assert.equal(ring[1].camera,'perspective','ancienne forme relue');
 for(const v of ring.slice(0,2))assert.equal('type' in v,false,'jamais de champ `type`');
 assert.deepEqual([ring[2].boite,ring[2].prets,ring[2].nousPrets,ring[2].nousEnVol,ring[2].boiteFin,ring[2].potreeLui,ring[2].nousApres],[17,12,9,2,18,5,2]);
 assert.deepEqual([ring[3].cible,ring[3].saut,ring[3].source,ring[3].captures,ring[3].msAvant,ring[3].prets,ring[3].potreeLui,ring[3].plafond,ring[3].motif],[90,70,'liste-esv',3,2400,14,3,false,'arrivee']);
 assert.deepEqual([ring[4].saut,ring[4].source,ring[4].motif,ring[4].plafond],[-70,null,null,null],'hors liste : null');
 const f=obsFields(),lus=ring.map(x=>f(JSON.parse(JSON.stringify(x))));assert.ok(lus.every(Boolean),'connus du service worker');
 assert.deepEqual(JSON.parse(JSON.stringify(lus)),JSON.parse(JSON.stringify(ring.map(({seq,...x})=>x))),'ce que l’observateur garde passe tel quel');
 /* enveloppe du journal (background.js, `add`) : {type:'esv-observation', ...champs} : le type reste celui de l'enveloppe */
 for(const x of lus){const e={type:'esv-observation',...x};assert.equal(e.type,'esv-observation',x.kind);}
 assert.ok(/type:'esv-observation',schema:1,observer:\{[^}]*\},\.\.\.fields/.test(SRC),'l’enveloppe étale les champs après son type');
 for(const x of [...ring,...lus]){for(const [k,v] of Object.entries(x))if(k!=='kind')assert.ok(!(typeof v==='string'&&ADRESSE.test(v)),`${x.kind}.${k} = ${v}`);
  for(const k of ['url','cle'])assert.ok(!(k in x),`champ ${k} retiré`);}
 /* une vue d'ancien module passée telle quelle au service worker : `type` relu en `camera`, jamais rendu */
 const v=f({kind:'prechauffage-vue',type:'orthographique'});assert.equal(v.camera,'orthographique');assert.equal('type' in v,false);
});

test('service worker : cible lointaine de la relecture et de la passe jointe à la capture (`loin`), réglage lu',()=>{
 const a=SRC.indexOf('function avecPrechauffage('),b=SRC.indexOf('\n return null;}',SRC.indexOf('function cibleLoinListe('))+'\n return null;}'.length;
 const S={lot:{chargement:{prechauffer:{actif:true,loin:{actif:true,sautMin:11,coupesMax:3}}}}};
 const ctx={globalThis:{BananeCore3:{uid:()=>'u'},BananeSettings:S}};vm.createContext(ctx);vm.runInContext(SRC.slice(a,b)+';this.f=avecPrechauffage;this.c=cibleLoinListe;',ctx);
 assert.deepEqual(JSON.parse(JSON.stringify(ctx.c(20,[21,22,90,91]))),{cut:90,avant:2,saut:68});
 assert.equal(ctx.c(20,[21,22,23,24,90]),null,'au-delà de coupesMax');
 assert.deepEqual(JSON.parse(JSON.stringify(ctx.c(500,[30]))),{cut:30,avant:0,saut:-470},'en arrière aussi');
 const e={identity:{part:23,cut:20}};
 assert.deepEqual(JSON.parse(JSON.stringify(ctx.f(e,21,'relu',22,{cut:90,avant:2,saut:68}).prechauffage)),{part:23,de:20,cut:21,source:'relu',op:'u',apres:22,loin:{cut:90,avant:2,saut:68}});
 assert.equal('loin' in ctx.f(e,21,'relu',22,undefined).prechauffage,false,'réglage éteint : champ absent');
 S.lot.chargement.prechauffer.loin.actif=false;assert.equal(ctx.c(20,[90]),undefined);
 assert.ok(/avecPrechauffage\(etat,suivanteRelue,'relu',apresRelue,loinRelue\)/.test(SRC)&&/avecPrechauffage\(etat,E\?\.suivante,'passe-differes',E\?\.apres,E\?\.loin\)/.test(SRC));
});

test('bilan de lot : voie potree comptée par l\'arbre, opérations lointaines, vue relue (ancienne forme comprise)',()=>{
 const t=s=>`2026-11-09T17:50:${String(s).padStart(2,'0')}.000Z`,o=(s,x)=>({eventId:'e'+s+x.kind,timestamp:t(s),type:'esv-observation',...x});
 const evs=[{eventId:'v1',timestamp:t(1),type:'orthographique',kind:'prechauffage-vue',pointBudget:2000000,limitePoints:4000000,fetchNatif:true,enTetesXhr:0,credXhr:false,maxLevel:-1},
  o(2,{kind:'prechauffage',memLances:6,memCharges:4,memEchecs:0,motif:'coupe'}),
  o(3,{kind:'prechauffage-bilan',juste:true,boite:17,prets:12,nousPrets:9,nousEnVol:2,boiteFin:18,potreeLui:4,nousApres:2}),
  o(4,{kind:'prechauffage-bilan',juste:true,potree:3}),
  o(5,{kind:'prechauffage-loin',motif:'arrivee',captures:3,msAvant:2400,lances:14,charges:12,echecs:0,boite:17,prets:14,nousPrets:12,nousEnVol:2,boiteFin:18,potreeLui:3,nousApres:2})];
 const b=B.bilan(evs.map(e=>({...e,_ms:Date.parse(e.timestamp)}))).prechauffage;
 assert.deepEqual(b.memoire,{lances:6,charges:4,echecs:0});
 assert.deepEqual([b.arrivee.n,b.arrivee.boite,b.arrivee.prets,b.arrivee.nousPrets,b.arrivee.potreeLui,b.arrivee.partPrete],[1,17,12,9,4,0.75]);
 assert.deepEqual([b.loin.n,b.loin.lances,b.loin.charges,b.loin.capturesMediane,b.loin.msAvantMediane,b.loin.arrivee.prets,b.loin.arrivee.potreeLui],[1,14,12,3,2400,14,3]);
 assert.equal(b.vue.length,1,'la vue de l’ancienne forme est relue');assert.equal(b.vue[0].camera,'orthographique');assert.equal(b.vue[0].limitePoints,4000000);
 const md=B.markdown(B.bilan(evs.map(e=>({...e,_ms:Date.parse(e.timestamp)}))));
 assert.ok(/Arrivée \(voie potree, 1 bilans\)/.test(md)&&/Opérations lointaines : 1/.test(md)&&/pointLoadLimit 4 000 000/.test(md),md);
});

'use strict';
/* 5.0 — VERTS À CONTRÔLER, module commun (src/verts-a-controler.js), sur des données SYNTHÉTIQUES : une voie droite inventée, des cuts
 * tous les mètres, un lot avec un rouge isolé, une grappe de différés et un PN. Le module classe les verts, les groupe en plages
 * lisibles, estime le temps de relecture ; il ne rend aucune position et ne garde ni un cut du lot, ni un vert déjà traité. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const V=require('../src/verts-a-controler.js');

/* Bords d'un cut (mètres, repère inventé) : `dg` élargit l'écartement, `dzL` monte le rail gauche (mm). */
const bords=(i,{dg=0,dzL=0}={})=>({left:[i,-0.7175-dg/2000,dzL/1000],right:[i,0.7175+dg/2000,0]});
function partie({mal={}}={}){
 const lot=[{cut:20,differe:false},{cut:40,differe:true},{cut:41,differe:true},{cut:42,differe:false},{cut:43,differe:true},{cut:44,differe:false},
  {cut:59,differe:false},{cut:60,differe:false},{cut:62,differe:false},{cut:63,differe:false}];
 const auLot=new Set(lot.map(x=>x.cut)),lignes=[];
 for(let i=0;i<120;i++)lignes.push({i,statut:auLot.has(i)?'invalid':'valid',operateur:false,bords:bords(i,mal[i]||{})});
 return {partie:7,lot,lignes,zonesPN:[{debut:59,fin:63}]};
}

test('candidats : verts de la fenêtre du lot et de la plage du PN ; ni cut du lot, ni vert traité, ni ligne invalide',()=>{
 const e=partie();e.lignes.find(x=>x.i===38).operateur=true;e.lignes.find(x=>x.i===37).statut='skipped';
 const S=V.signaux(e),ids=S.signaux.map(s=>s.i);
 for(const c of [20,40,41,42,43,44,59,60,62,63])assert.ok(!ids.includes(c),'cut du lot '+c);
 assert.ok(!ids.includes(38),'vert déjà traité par un opérateur');assert.ok(!ids.includes(37),'ligne SKIP');
 assert.ok(ids.includes(19)&&ids.includes(21)&&ids.includes(45)&&ids.includes(61),'voisins des rouges et vert du PN');
 assert.ok(!ids.includes(100)&&!ids.includes(30),'vert loin de tout cut du lot');
 assert.equal(S.reference.ecartementMm,1435,'médiane des verts de la partie');
 assert.deepEqual(S.zones,[{debut:59,fin:63,controle:[55,69]}],'plage du PN : 4 cuts avant, 6 après');
 const t=V.signaux({...e,lot:[]},{touteLaPartie:true});assert.equal(t.signaux.length,108,'sans lot (partie humaine) : tous les verts valides, non traités');
});

test('signaux : un mauvais écartement, un rail qui saute en hauteur, la densité de rouges et le différé voisin',()=>{
 const e=partie({mal:{47:{dg:30},21:{dzL:35}}}),S=V.signaux(e),s=i=>S.signaux.find(x=>x.i===i);
 assert.equal(s(47).ecartementMm,30);assert.ok(s(21).voieVerticaleMm>=34&&s(21).deniveleMm>=34,'saut vertical du rail gauche');
 assert.equal(s(39).rouges,5);assert.equal(s(39).distDiffere,1);assert.equal(s(25).rouges,1);assert.equal(s(48).ecartementMm,0);
 /* Poses d'Ariane : la hauteur du vert contre la voie qu'elle a posée de part et d'autre. */
 const P=V.signaux({...e,posees:[{i:20,bords:bords(20)},{i:22,bords:bords(22)}]});assert.ok(P.signaux.find(x=>x.i===21).hauteurPosesMm>=34);
 assert.equal(V.signaux(e).signaux.find(x=>x.i===21).hauteurPosesMm,null,'sans poses d\'Ariane : inconnu');
});

test('score : les verts suspects passent devant ; raisons dans l\'ordre de leur poids ; seuil livré',()=>{
 const C=V.classer(partie({mal:{47:{dg:30},21:{dzL:35}}}));
 assert.deepEqual(C.verts.slice(0,2).map(v=>v.i).sort((a,b)=>a-b),[21,47]);
 assert.equal(C.verts.find(v=>v.i===47).raisons[0],'ecartement');assert.ok(['hauteur','denivele'].includes(C.verts.find(v=>v.i===21).raisons[0]));
 for(let k=1;k<C.verts.length;k++)assert.ok(C.verts[k-1].score>=C.verts[k].score,'trié par score');
 const n=V.noter({ecartementMm:null,deniveleMm:null,voieVerticaleMm:null,voieLateraleMm:null,hauteurPosesMm:null,rouges:0,distDiffere:null,pn:null});
 assert.deepEqual(n,{score:0,raisons:[]});
 /* Zone morte : un écart de 2 mm ne compte pas. */
 assert.equal(V.noter({ecartementMm:2,rouges:0}).score,0);assert.ok(V.noter({ecartementMm:12,rouges:0}).score>0);
});

test('liste : plages groupées comme on les parcourt (PN, différé, grappe, écartement), nombre de cuts et temps estimé',()=>{
 const L=V.liste(partie({mal:{47:{dg:30},21:{dzL:35},61:{dg:25},100:{dg:40}}}));
 assert.equal(L.format,'ariane-verts-a-controler-1');assert.equal(L.partie,7);
 const lib=L.plages.map(p=>p.libelle);
 assert.ok(lib.includes('PN 59–63'),lib.join(' | '));
 assert.ok(lib.some(l=>/^autour du différé 43$|^autour des différés 4\d–4\d$/.test(l)),lib.join(' | '));
 assert.ok(L.plages.every((p,k)=>!k||L.plages[k-1].debut<p.debut),'dans l\'ordre des cuts');
 assert.ok(!L.verts.some(v=>v.i===100),'loin de tout rouge : hors de la liste, même mal extrait');
 assert.equal(L.aControler,L.verts.length);assert.equal(L.aControler,L.plages.reduce((a,p)=>a+p.nombre,0));
 assert.equal(L.tempsEstimeS,Math.round(L.aControler*V.DEFAULTS.tempsParVertS));assert.equal(V.DEFAULTS.tempsParVertS,3.7);
 assert.ok(L.verts.every(v=>v.score>=V.DEFAULTS.seuil));
 const txt=JSON.stringify(L);assert.ok(!/bords|left|right|-0\.71/.test(txt),'aucune position dans la liste');
});

test('libellés : écartement isolé, hauteur, grappe et voisin',()=>{
 const S={differes:[],cutsLot:[100,103,105],zones:[]};
 const p=V.plages([{i:200,score:2,raisons:['ecartement'],pn:null},{i:300,score:2,raisons:['hauteur'],pn:null},{i:301,score:2,raisons:['denivele'],pn:null},{i:104,score:2,raisons:['grappe'],pn:null}],S);
 assert.deepEqual(p.map(x=>[x.libelle,x.nombre,x.cutsTexte]),[['grappe 100–105',1,'104'],['écartement, cut 200',1,'200'],['hauteur, cuts 300–301',2,'300, 301']]);
});

test('instantané E1 : lignes, statut et drapeau « traité » ; bords gardés pour le calcul seulement',()=>{
 const dec={n:3,st:[0,1,0],fl:[0,0,1],ed:[0,0,0,0,14350,0, 10000,0,0,10000,14350,0, 20000,0,0,20000,14350,0]};
 const L=V.lignesDeInstantane(dec);
 assert.deepEqual(L.map(x=>[x.i,x.statut,x.operateur]),[[0,'valid',false],[1,'invalid',false],[2,'valid',true]]);
 assert.deepEqual(L[0].bords,{left:[0,0,0],right:[0,1.435,0]});
 assert.deepEqual(V.lignesDeInstantane(null),[]);
});

test('cuts d\'une plage en texte court',()=>{assert.equal(V.compacter([1666,1655,1664,1665]),'1655, 1664–1666');assert.equal(V.compacter([3,4]),'3, 4');assert.equal(V.compacter([]),'');});

test('durée lisible',()=>{assert.equal(V.duree(140),'2 min 20 s');assert.equal(V.duree(45),'45 s');assert.equal(V.duree(120),'2 min');assert.equal(V.duree(NaN),'');});

test('module pur : aucun accès à chrome, au réseau, au stockage ni à une commande d\'ESV',()=>{
 const src=require('node:fs').readFileSync(require('node:path').join(__dirname,'../src/verts-a-controler.js'),'utf8');
 for(const m of [/chrome\./,/fetch\(/,/XMLHttpRequest/,/sendMessage/,/indexedDB/,/localStorage/,/require\(/])assert.ok(!m.test(src),String(m));
});

test('zone d\'ADV (règles métier, rail de plus) : ses verts deviennent candidats, même loin de tout rouge ; la géométrie décide ; libellé « ADV »',()=>{
 /* Zone d'ADV reconnue 85–110 (plage déjà marginée) ; le vert 100 est mal extrait (écartement +30 mm), 95 est juste. */
 const e={...partie({mal:{100:{dg:30}}}),zonesADV:[[85,110]]};
 const sans=V.signaux({...e,zonesADV:[]}).signaux.map(s=>s.i);assert.ok(!sans.includes(100)&&!sans.includes(95),'sans zone : hors de la fenêtre du lot');
 const S=V.signaux(e),s=i=>S.signaux.find(x=>x.i===i);
 assert.ok(s(100)&&s(95),'avec la zone : candidats');assert.deepEqual(s(100).adv,{debut:85,fin:110});assert.deepEqual(S.zonesADV,[{debut:85,fin:110,controle:[85,110]}]);
 assert.equal(V.DEFAULTS.poids.adv,0,'poids livré nul : la zone ne fait entrer que des verts suspects par leur géométrie');
 const L=V.liste(e),ids=L.verts.map(v=>v.i);assert.ok(ids.includes(100)&&!ids.includes(95));
 const p=L.plages.find(x=>x.cuts.includes(100));assert.equal(p.motif,'adv');assert.equal(p.libelle,'ADV 85–110');
 assert.deepEqual(L.zonesADV,[{debut:85,fin:110,controle:[85,110]}]);
 /* Un poids non nul (mesuré, non livré) ferait entrer toute la zone. */
 assert.ok(V.liste(e,{poids:{...V.DEFAULTS.poids,adv:1}}).verts.map(v=>v.i).includes(95));
 assert.ok(!/positionSceneRelative|bords|"left"|"right"/.test(JSON.stringify(L)),'aucune position');
});

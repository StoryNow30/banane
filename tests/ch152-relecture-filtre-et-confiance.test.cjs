'use strict';
/* CH-152 (D-380, D-381) — filtre géométrique pur sur la liste d'ESV et distinction entre la sentinelle S1 et une confiance A* basse.
 * Toutes les coordonnées sont fabriquées, en dixièmes de millimètre comme dans la table décompactée de src/liste-memoire.js. */
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const F=require('../src/relecture-filtre-liste.js');
const O=require('../src/relecture-ombre.js');
const Q=require('../src/relecture-critere.js');
const {base,K}=require('./fixtures.cjs');

const GAUGE=14350;                         // 1 435 mm en dixièmes de millimètre
function table(n=50){
 const t={n,st:Array(n).fill(0),fl:Array(n).fill(0),ed:Array(6*n).fill(null)};
 for(let i=0;i<n;i++)ligne(t,i,[i*10000,0,0],[i*10000,GAUGE,0]);
 return t;
}
function ligne(t,i,g,d){t.ed.splice(6*i,6,...g,...d);}
function bosse(t,i,mm=4,rail='left'){t.ed[6*i+(rail==='left'?1:4)]+=Math.round(mm*10);}
const cutsDe=s=>s.cuts.map(c=>c.cut);
const zonesDe=s=>Object.fromEntries(s.cuts.map(c=>[c.cut,c.zone]));
function selection(cuts,{traverses=[]}={}){
 const parZone={pn:0,adv:0,abords:0,'vert-hors-zone':0,ecartement:0};
 for(const c of cuts)parZone[c.zone]=(parZone[c.zone]||0)+1;
 return {format:'ariane-relecture-selection-1',version:'essai',partie:1,total:cuts.length,traverses:traverses.length,parZone,
  tempsEstimeS:cuts.length*3+traverses.length,plafondCuts:null,plafondParZone:{adv:null,abords:null,'vert-hors-zone':20,ecartement:20},
  plages:[{debut:cuts[0]?.cut??0,fin:cuts.at(-1)?.cut??0,motifs:['adv'],zone:'adv',libelle:'essai',relus:cuts.length,traverses}],
  cuts:cuts.map((c,i)=>({plage:0,...c})),horsPlafond:[]};
}

test('D1 — UMD navigateur et valeurs par défaut',()=>{
 const ctx={};vm.createContext(ctx);vm.runInContext(fs.readFileSync(path.join(__dirname,'../src/relecture-filtre-liste.js'),'utf8'),ctx);
 assert.ok(ctx.BananeRelectureFiltreListe);
 assert.deepEqual({...F.DEFAULTS},{actif:true,flecheMaxMm:3.5,ecartementMaxMm:6,voisinsFenetre:4,voisinsMinParCote:1,margeDiffereCuts:2,zonesExclues:['pn']});
 assert.ok(Object.isFrozen(F.DEFAULTS.zonesExclues));
});

test('D1 — evaluerCut : ligne invalide ou sans encadrement valide, jamais lisse',()=>{
 const t=table(10);
 for(const [table,cut] of [[null,4],[t,-1],[t,10],[t,1.5]])assert.deepEqual(F.evaluerCut({table,cut}),{lisse:false,raison:'ligne-non-valide'});
 t.st[4]=1;assert.deepEqual(F.evaluerCut({table:t,cut:4}),{lisse:false,raison:'ligne-non-valide'});t.st[4]=0;
 t.ed[6*4+2]=null;assert.deepEqual(F.evaluerCut({table:t,cut:4}),{lisse:false,raison:'ligne-non-valide'});t.ed[6*4+2]=0;
 assert.deepEqual(F.evaluerCut({table:t,cut:0}),{lisse:false,raison:'sans-encadrement'});
 assert.deepEqual(F.evaluerCut({table:t,cut:9}),{lisse:false,raison:'sans-encadrement'});
 for(let i=0;i<=3;i++)t.st[i]=1;for(let i=5;i<=9;i++)t.st[i]=2;
 assert.deepEqual(F.evaluerCut({table:t,cut:4}),{lisse:false,raison:'sans-encadrement'});
 t.st.fill(0);
 assert.equal(F.evaluerCut({table:t,cut:4,options:{voisinsMinParCote:2,voisinsFenetre:1}}).raison,'sans-encadrement');
});

test('D1 — evaluerCut : flèche maximale des deux rails, voisins valides les plus proches et médiane d’écartement',()=>{
 const t=table(12),r=F.evaluerCut({table:t,cut:5});
 assert.deepEqual(r,{lisse:true,flecheMm:0,ecartementMm:1435,ecartRefMm:0,voisins:[4,6],raison:'lisse'});
 t.st[4]=1;t.ed[6*6+1]=null;
 const saute=F.evaluerCut({table:t,cut:5});assert.deepEqual(saute.voisins,[3,7]);assert.equal(saute.lisse,true);
 bosse(t,5,4);const fleche=F.evaluerCut({table:t,cut:5});
 assert.equal(fleche.lisse,false);assert.equal(fleche.raison,'fleche');assert.equal(fleche.flecheMm,4);
 bosse(t,5,-4);bosse(t,5,3.5,'right');
 const droite=F.evaluerCut({table:t,cut:5});assert.equal(droite.flecheMm,3.5);assert.equal(droite.lisse,true,'le seuil de flèche est inclusif');
});

test('D1 — evaluerCut : écartement 3D contre la médiane locale ou la référence fournie',()=>{
 const t=table(12);
 /* Les deux rails s’écartent de 3,5 mm chacun : flèche au seuil, mais écartement à +7 mm de la médiane. */
 bosse(t,5,-3.5);bosse(t,5,3.5,'right');
 const local=F.evaluerCut({table:t,cut:5});
 assert.equal(local.lisse,false);assert.equal(local.raison,'ecartement');assert.equal(local.flecheMm,3.5);assert.equal(local.ecartementMm,1442);assert.equal(local.ecartRefMm,7);
 const u=table(12);
 assert.equal(F.evaluerCut({table:u,cut:5,referenceEcartementMm:1441}).ecartRefMm,6);
 assert.equal(F.evaluerCut({table:u,cut:5,referenceEcartementMm:1441}).lisse,true);
 assert.equal(F.evaluerCut({table:u,cut:5,referenceEcartementMm:1442}).raison,'ecartement');
});

test('D1 — filtrerSelection : les gardes absolues priment, seuls les verts lisses d’ADV ou d’abords sont écartés',()=>{
 const t=table(40);bosse(t,22,5);
 const original=selection([
  {cut:2,role:'lot',zone:'adv'},
  {cut:4,role:'vert',zone:'pn'},
  {cut:6,role:'vert',zone:'adv'},
  {cut:8,role:'differe',zone:'abords'},
  {cut:10,role:'vert',zone:'adv'},
  {cut:12,role:'vert',zone:'adv'},
  {cut:14,role:'vert',zone:'ecartement'},
  {cut:16,role:'vert',zone:'adv'},
  {cut:18,role:'vert',zone:'abords'},
  {cut:20,role:'vert',zone:'adv'},
  {cut:22,role:'vert',zone:'abords'},
  {cut:24,role:'vert',zone:'vert-hors-zone'},
  {cut:26,role:'vert',zone:'adv'}
 ]),avant=JSON.stringify(original);
 const out=F.filtrerSelection(original,{table:t,differes:[8,30],alertesGardeVoie:[{identity:{cut:18}}],aControler:[12]});
 assert.equal(JSON.stringify(original),avant,'entrée non mutée');
 assert.deepEqual(out.filtresListe.map(x=>x.cut),[16,20,26]);
 assert.deepEqual(out.filtresListe[0],{cut:16,zone:'adv',flecheMm:0,ecartRefMm:0,voisins:[15,17]});
 assert.deepEqual(cutsDe(out),[2,4,6,8,10,12,14,18,22,24]);
 assert.equal(zonesDe(out)[22],'abords','la bosse reste à relire');assert.equal(out.total,10);assert.equal(out.tempsEstimeS,30);
 assert.equal(out.parZone.adv,4);assert.equal(out.parZone.abords,3);assert.equal(out.parZone.ecartement,1);
 assert.equal(out.plages[0].relus,10);
});

test('D1 — filtrerSelection : plages vidées, compteurs de traversées et temps recalculés ; sans table ou coupé, identité stricte',()=>{
 const t=table(30),s=selection([{cut:10,role:'vert',zone:'adv'},{cut:11,role:'vert',zone:'adv'}],{traverses:[9]});
 const out=F.filtrerSelection(s,{table:t});
 assert.deepEqual(cutsDe(out),[]);assert.deepEqual(out.plages,[]);assert.equal(out.traverses,0);assert.equal(out.tempsEstimeS,0);assert.equal(out.filtresListe.length,2);
 const avant=JSON.stringify(s);
 assert.strictEqual(F.filtrerSelection(s,{}),s);
 assert.strictEqual(F.filtrerSelection(s,{options:{actif:false}}),s);
 assert.strictEqual(F.filtrerSelection(s,{table:t,options:{actif:false}}),s);
 assert.equal(JSON.stringify(s),avant);
});

test('D1 — selection : sans table ou filtre coupé, sortie strictement identique ; avec table, filtresListe exposé',()=>{
 const t=table(30),entree={partie:1,total:30,zonesADV:[[5,12]]};
 const sans=O.selection(entree),sansNull=O.selection({...entree,tableListe:null});
 assert.equal(JSON.stringify(sansNull),JSON.stringify(sans),'sans table : mêmes octets JSON');assert.equal('filtresListe' in sans,false);
 assert.deepEqual(O.selection({...entree,tableListe:t},{filtreListe:{actif:false}}),sans);
 const avec=O.selection({...entree,tableListe:t});
 assert.deepEqual(cutsDe(avec),[]);assert.deepEqual(avec.plages,[]);assert.equal(avec.total,0);assert.equal(avec.parZone.adv,0);assert.equal(avec.tempsEstimeS,0);
 assert.deepEqual(avec.filtresListe.map(x=>x.cut),[5,6,7,8,9,10,11,12]);
 const parOption=O.selection(entree,{filtreListe:{table:t}});
 assert.deepEqual(cutsDe(parOption),[]);assert.deepEqual(parOption.filtresListe,avec.filtresListe);
});

const scienceS1=(next={status:'candidate',topRows:15,faceCount:6,slopeLimited:false})=>({rails:{
 left:{s1Changed:true,astar:{confidence:0},next},
 right:{s1Changed:false,astar:{confidence:91},next:{status:'candidate',topRows:20,faceCount:8,slopeLimited:false}}
}});
test('D2 — juger : confiance A* conservée et soutien géométrique S1 qualifié par rail',()=>{
 const capture=K.clone(base),decision={stage:'window',positions:{left:capture.rails.left.positionSceneRelative,right:capture.rails.right.positionSceneRelative}};
 const j=O.juger({capture,decision,science:scienceS1()});
 assert.deepEqual(j.confiance,{left:0,right:91});assert.deepEqual(j.confianceAstar,j.confiance);
 assert.deepEqual(j.s1,{left:true,right:false});assert.deepEqual(j.s1Soutenu,{left:true,right:false});
 for(const next of [
  {status:'candidate',topRows:14,faceCount:6,slopeLimited:false},
  {status:'candidate',topRows:15,faceCount:5,slopeLimited:false},
  {status:'candidate',topRows:15,faceCount:6,slopeLimited:true},
  {status:'unresolved',topRows:15,faceCount:6,slopeLimited:false}
 ])assert.equal(O.juger({capture,decision,science:scienceS1(next)}).s1Soutenu.left,false);
});

function jugementConfiance({s1=false,soutien,astar=0,alias=false}={}){
 const j={etage:'window',appuis:[1,2],poseCalculee:{left:[0,0,0],right:[1,0,0]},
  ecartMm:{left:{long:0,lat:14,vert:1},right:{long:0,lat:13,vert:0}},
  confiance:{left:astar,right:95},s1:{left:s1,right:false}};
 if(alias)j.confianceAstar={left:0,right:95};
 if(soutien!==undefined)j.s1Soutenu={left:soutien,right:false};
 return j;
}
const entreeCritere=j=>({zone:'abords',role:'vert',skipOmbre:{raison:null},ecartementMm:1436,ecartementRefMm:1435,jugement:j});

test('D2 — reglages : seuils A* optionnels par zone ou globaux, absents par défaut ; valeurs invalides fermées',()=>{
 const f=structuredClone(Q.DEFAUT);f.confianceAstarMin=65;f.admettreS1Soutenu=true;
 f.zones.abords.confianceAstarMin=70;f.zones.abords.bloquerAstarZero=true;
 const r=Q.reglages(f,'propose');
 assert.equal(r.confianceAstarMin,65);assert.equal(r.admettreS1Soutenu,true);
 assert.equal(r.zones.abords.confianceAstarMin,70);assert.equal(r.zones.abords.bloquerAstarZero,true);assert.deepEqual(r.invalides,[]);
 const habituel=Q.reglages(Q.DEFAUT);
 assert.equal('confianceAstarMin' in habituel,false);assert.equal('confianceAstarMin' in habituel.zones.abords,false);
 const mal=structuredClone(Q.DEFAUT);mal.confianceAstarMin=-1;mal.admettreS1Soutenu=1;
 mal.zones.abords.confianceAstarMin='70';mal.zones.abords.bloquerAstarZero='oui';
 const q=Q.reglages(mal,'propose');
 for(const champ of ['confianceAstarMin','admettreS1Soutenu','zones.abords.confianceAstarMin','zones.abords.bloquerAstarZero'])assert.ok(q.invalides.includes(champ),champ);
 assert.equal(Q.correctionPermise(q).ok,false);
});

test('D2 — qualifierConfiance : S1 soutenu admis, S1 faible et vraie confiance A* basse refusés',()=>{
 const Z={confianceMin:0,confianceAstarMin:70,bloquerAstarZero:true};
 assert.equal(Q.qualifierConfiance(jugementConfiance({s1:true,soutien:true}),Z,{}),null,'la sentinelle S1 soutenue n’est pas une confiance A* nulle');
 assert.equal(Q.qualifierConfiance(jugementConfiance({s1:true}),Z,{}),null,'une pose calculée est le repli de soutien des anciens jugements');
 const faible=Q.qualifierConfiance(jugementConfiance({s1:true,soutien:false}),Z,{});
 assert.equal(faible.regle,'confiance');assert.match(faible.raison,/confiance A\* du rail gauche 0 sous 70/);
 const astar=Q.qualifierConfiance(jugementConfiance({s1:false,soutien:true}),Z,{});
 assert.equal(astar.regle,'confiance');assert.match(astar.raison,/confiance A\* du rail gauche 0 sous 70/);
 assert.equal(Q.qualifierConfiance(jugementConfiance({s1:false,soutien:true,astar:99,alias:true}),{confianceMin:0,confianceAstarMin:70},{}).regle,'confiance','la confiance A* explicite est prioritaire');
 assert.equal(Q.qualifierConfiance(jugementConfiance({s1:false,astar:71}),{confianceMin:0,confianceAstarMin:70},{}),null);
 assert.equal(Q.qualifierConfiance(jugementConfiance({s1:false,astar:65}),{confianceMin:0,confianceAstarMin:0},{confianceAstarMin:70}).regle,'confiance','0 en zone laisse le seuil global s’appliquer');
 assert.equal(Q.qualifierConfiance(jugementConfiance({s1:false,astar:85}),{confianceMin:90,confianceAstarMin:70},{}).regle,'confiance');
 assert.equal(Q.qualifierConfiance(jugementConfiance({s1:true,soutien:true}),{confianceMin:80,confianceAstarMin:0},{}).regle,'confiance','le seuil historique reste inchangé sans option S1');
 assert.equal(Q.qualifierConfiance(jugementConfiance({s1:true,soutien:true}),{confianceMin:80,confianceAstarMin:70},{admettreS1Soutenu:true}),null);
 const absent=jugementConfiance({s1:true,soutien:true});absent.confiance.left=null;
 assert.equal(Q.qualifierConfiance(absent,Z,{admettreS1Soutenu:true}).regle,'confiance');
});

test('D2 — jugement complet : le plancher A* bloque une pose A* dégradée mais pas le repêchage S1 géométriquement fort',()=>{
 const f=structuredClone(Q.DEFAUT);f.zones.abords.confianceMin=0;f.zones.abords.confianceAstarMin=70;
 const R=Q.reglages(f,'propose');
 const s1=Q.juger(entreeCritere(jugementConfiance({s1:true,soutien:true})),R);
 assert.equal(s1.corriger,true,s1.raison);
 const astar=Q.juger(entreeCritere(jugementConfiance({s1:false,soutien:true})),R);
 assert.equal(astar.corriger,false);assert.equal(astar.regle,'confiance');assert.match(astar.raison,/confiance A\*/);
});

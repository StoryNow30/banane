'use strict';
/* CH-079 (D-308) — la garde de voie et le serrage du lot, EN OMBRE : données synthétiques seulement (aucune donnée terrain dans le dépôt). */
const {test}=require('node:test'),assert=require('node:assert/strict');
const G=require('../src/garde-voie-ombre.js'),S=require('../src/serrage-lot-ombre.js');
/* Pose en scène (m) d'un écartement `mm`, centrée sur y=0, rails le long de x. */
const pose=(mm,x=0)=>({left:[x,-mm/2000,0],right:[x,mm/2000,0]});
/* Table décompactée de la liste : n lignes toutes valides (st 0, fl 0) à l'écartement `mm` (bords en 1/10 mm, monde). */
const table=(n,mm,{invalides=[]}={})=>{const st=[],fl=[],ed=[];for(let i=0;i<n;i++){st.push(invalides.includes(i)?1:0);fl.push(0);const g=mm*10;ed.push(i*1000,-g/2,0,i*1000,g/2,0);}return {n,st,fl,ed};};
const interdits=/https?:|[0-9a-f]{8}-[0-9a-f]{4}-|projectId|esv\./i;

test('garde : un écartement juste au voisinage ne fait pas de pause',()=>{
  const e=G.evaluer({cut:50,positions:pose(1436),table:table(100,1435),valide:true});
  assert.equal(e.auraitPause,false);assert.equal(e.referenceMm,1435);assert.ok(Math.abs(e.ecartAuVoisinageMm-1)<0.01);
});
test('garde : une voie à 25 mm de ses voisins aurait fait une pause',()=>{
  const e=G.evaluer({cut:50,positions:pose(1460),table:table(100,1435),valide:true});
  assert.equal(e.auraitPause,true);assert.match(e.motif,/voie/);
});
test('garde : seuil réglable, et seulement sur un cut que le lot valide',()=>{
  assert.equal(G.evaluer({cut:50,positions:pose(1460),table:table(100,1435),valide:true,reglage:{seuilMm:30}}).auraitPause,false);
  assert.equal(G.evaluer({cut:50,positions:pose(1460),table:table(100,1435),valide:false}).auraitPause,false);
});
test('garde : la référence ne lit que les lignes valides à ±fenêtre ; sans voisin, défaut 1435',()=>{
  const t=table(100,1435);for(let i=0;i<100;i++)if(Math.abs(i-50)>3){t.ed[6*i+1]=-9000;t.ed[6*i+4]=9000;}   // lointaines : écartement 1800
  assert.equal(G.evaluer({cut:50,positions:pose(1435),table:t,valide:true,reglage:{fenetre:3,voisinesMin:3}}).referenceMm,1435);
  assert.equal(G.evaluer({cut:50,positions:pose(1435),table:null,valide:true}).referenceMm,1435);
  assert.equal(G.evaluer({cut:50,positions:pose(1435),table:table(100,1435,{invalides:Array.from({length:100},(_,i)=>i)}),valide:true}).referenceMm,1435);
});
test('garde : les lignes validées par le lot (drapeaux non nuls) sont des voisins ; « avantSeulement » ignore les cuts suivants',()=>{
  const t=table(100,1435);for(let i=0;i<100;i++)t.fl[i]=3;                 // toutes validées par le lot
  assert.equal(G.referenceVoisins(t,50).source,'voisins');
  const u=table(100,1435);for(let i=51;i<=55;i++){u.ed[6*i+1]=-9000;u.ed[6*i+4]=9000;}   // les suivantes sont à 1800
  const R5={...G.REGLAGE,fenetre:5};
  assert.equal(G.referenceVoisins(u,50,{...R5,avantSeulement:true}).mm,1435);
  assert.ok(G.referenceVoisins(u,50,R5).mm>1435);
});
test('garde : événement sans adresse ni identifiant, sans effet sur ses entrées',()=>{
  const entree={cut:50,positions:pose(1460),table:table(100,1435),valide:true},avant=JSON.stringify(entree);
  const e=G.evaluer(entree);assert.equal(JSON.stringify(entree),avant);assert.doesNotMatch(JSON.stringify(e),interdits);
  assert.deepEqual(Object.keys(e).sort(),['auraitPause','cut','ecartAuVoisinageMm','ecartMm','motif','referenceMm','version'].sort());
});
test('garde : entrée invalide → événement d\'erreur, jamais d\'exception',()=>{
  const e=G.evaluer({cut:3,positions:null,table:null,valide:true});assert.equal(e.auraitPause,false);assert.ok(e.motif);
});
test('serrage : un lot serré de 8 mm est desserré de 4 mm par rail',()=>{
  const e=S.evaluer({cut:7,positions:pose(1427),table:table(100,1435)});
  assert.equal(e.ecartAvantMm,1427);assert.equal(e.ecartApresMm,1435);
  assert.ok(Math.abs(e.deltaGaucheMm+4)<0.01&&Math.abs(e.deltaDroiteMm-4)<0.01);
});
test('serrage : un écartement déjà juste ne bouge pas ; un écart hors plafond (mauvaise voie) n\'est pas « corrigé »',()=>{
  const j=S.evaluer({cut:7,positions:pose(1435),table:table(100,1435)});assert.equal(j.deltaGaucheMm,0);assert.equal(j.deltaDroiteMm,0);
  const f=S.evaluer({cut:7,positions:pose(1460),table:table(100,1435)});assert.equal(f.deltaGaucheMm,0);assert.equal(f.ecartApresMm,1460);
});
test('serrage : sans effet sur ses entrées, événement sans adresse',()=>{
  const entree={cut:7,positions:pose(1427),table:table(100,1435)},avant=JSON.stringify(entree);
  const e=S.evaluer(entree);assert.equal(JSON.stringify(entree),avant);assert.doesNotMatch(JSON.stringify(e),interdits);
  assert.deepEqual(Object.keys(e).sort(),['cut','deltaDroiteMm','deltaGaucheMm','ecartApresMm','ecartAvantMm','referenceMm','version'].sort());
});
test('les deux modules sont purs : pas d\'horloge, de stockage ni de lecture de la décision',()=>{
  const fs=require('node:fs');for(const f of ['garde-voie-ombre','serrage-lot-ombre']){const t=fs.readFileSync(__dirname+'/../src/'+f+'.js','utf8');
    assert.doesNotMatch(t,/Date\.now|chrome\.|indexedDB|fetch\(|Math\.random/);assert.doesNotMatch(t,/require\(['"]\.\/(lot-decision|engine|adapter-page)/);}
});

'use strict';
/* E1 (5.0) : tools/diff-liste.cjs, deux formes d'entrée (deux instantanés ; instantané + écritures d'un journal).
 * Fixtures SYNTHÉTIQUES : voie inventée qui tourne (la direction des voisins doit donner un latéral signé). */
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{spawnSync}=require('node:child_process');
const LM=require('../src/liste-memoire.js'),D=require('../tools/diff-liste.cjs');
const EDGES=['XLeftEdge','YLeftEdge','ZLeftEdge','XRightEdge','YRightEdge','ZRightEdge'],TABLE='traj__synthetique';
/* Voie le long de +y (la gauche à x−0,7175 m, la droite à x+0,7175 m) : latéral = ±x, vertical = z. */
const monde=i=>[100000-0.7175,200000+i,50,100000+0.7175,200000+i,50];
const ID=i=>TABLE+'/RK-'+String(i).padStart(8,'0');
function snap(n,{partie=3,at='2026-10-15T10:00:00Z',modif={},statuts={},flags={},cle=LM.empreinte(TABLE)}={}){const st=[],fl=[],ed=[];
  for(let i=0;i<n;i++){st.push(statuts[i]??0);fl.push(flags[i]??1);const e=monde(i).map(LM.dm);const m=modif[i];if(m)for(const [j,mm] of Object.entries(m))e[j]+=Math.round(mm*10);ed.push(...e);}
  return LM.compacter({st,fl,ed},{partie,at,cle});}
const ecriture=(i,dx=0,dz=0)=>({kind:'write',status:204,rowIndex:i,railPairId:ID(i),timestamp:'2026-10-15T09:00:00Z',
  body:{ExtractionStatus:'valid',TreatedByOperator:true,...Object.fromEntries(EDGES.map((k,j)=>[k,monde(i)[j]+(j===0?dx:0)+(j===2?dz:0)]))}});
const dossier=fs.mkdtempSync(path.join(os.tmpdir(),'diff-liste-'));
const ecrire=(nom,o)=>{const f=path.join(dossier,nom);fs.writeFileSync(f,JSON.stringify(o));return f;};
const cli=(...a)=>spawnSync(process.execPath,[path.join(__dirname,'..','tools','diff-liste.cjs'),...a],{encoding:'utf8'});

test('deux instantanés : latéral et vertical par rail, statut, drapeaux, verts modifiés, invalides devenus valides',()=>{
  const A=snap(30,{statuts:{12:1}}),B=snap(30,{modif:{5:{0:8},9:{2:-4}},statuts:{12:0,20:1},flags:{9:3}});
  const fa=ecrire('a.json',A),fb=ecrire('b.json',B),sortie=path.join(dossier,'s.json');
  const r=cli(fa,fb,'--detail','--json',sortie);assert.equal(r.status,0,r.stderr);
  const j=JSON.parse(fs.readFileSync(sortie,'utf8')),parCut=Object.fromEntries(j.cuts.map(c=>[c.cut,c]));
  assert.deepEqual(Object.keys(parCut).map(Number),[5,9,12,20]);
  assert.deepEqual([parCut[5].mode,parCut[5].gauche.vert,parCut[5].droite.d3],['profil',0,0]);
  assert.equal(Math.abs(parCut[5].gauche.lat),8);assert.equal(parCut[9].gauche.vert,-4);assert.equal(parCut[9].gauche.lat,0);
  assert.deepEqual(parCut[9].drapeaux,[1,3]);assert.deepEqual(parCut[12].statut,['invalid','valid']);assert.deepEqual(parCut[20].statut,['valid','invalid']);
  assert.equal(j.classes.invalidesDevenusValides,1);assert.equal(j.classes.vertsExtractionModifies,2);assert.equal(j.classes.statutsChanges,2);
  assert.match(r.stdout,/Verts d’extraction .* modifiés > 1 mm : 2 sur/);assert.match(r.stdout,/profil local/);
  assert.ok(!/100000|200000/.test(r.stdout+JSON.stringify(j)),'aucune coordonnée en sortie');
});

test('instantané + journal : cuts d’Ariane inchangés / > 1 / > 5 / > 10 mm ; table du journal reconnue par son empreinte',()=>{
  const ev=[1,2,3,4,5,6].map(i=>ecriture(i)).concat([{kind:'write',status:502,rowIndex:7,railPairId:ID(7),body:ecriture(7).body},{kind:'write',status:204,rowIndex:8,railPairId:'autre/RK-8',body:ecriture(8).body},{kind:'list-summary'}]);
  const B=snap(10,{modif:{2:{0:0.5},3:{0:3},4:{2:7},5:{3:-12},8:{0:40}}});
  const r=cli('--journal',ecrire('j.json',{events:ev}),ecrire('b.json',B),'--json',path.join(dossier,'s2.json'));assert.equal(r.status,0,r.stderr);
  const j=JSON.parse(fs.readFileSync(path.join(dossier,'s2.json'),'utf8')),c=j.classes;
  assert.equal(j.forme,'journal-contre-instantane');
  assert.deepEqual([c.arianeComparables,c.arianeInchanges,c.arianeSup1,c.arianeSup5,c.arianeSup10],[6,3,3,2,1]);
  assert.deepEqual(j.cuts.filter(x=>x.classe==='ariane').map(x=>x.cut),[3,4,5]);
  assert.equal(j.cuts.find(x=>x.cut===3).gauche.d3,3);assert.equal(j.cuts.find(x=>x.cut===4).gauche.vert,7);assert.equal(j.cuts.find(x=>x.cut===5).droite.d3,12);
  assert.ok(!j.cuts.some(x=>x.cut===7||x.cut===8),'refus 502 et autre table ignorés');
  assert.match(r.stdout,/> 1 mm 3 .* > 5 mm 2 · > 10 mm 1/);
});

test('deux instantanés + journal : les cuts d’Ariane sont séparés des verts d’extraction ; parties ou listes différentes refusées ; sans voisins : 3D dit',()=>{
  const A=snap(12),B=snap(12,{modif:{3:{0:6},7:{0:6}}});
  const r=D.comparer({...LM.decompacter(A),ariane:new Set([3])},LM.decompacter(B));
  assert.deepEqual([r.classes.arianeComparables,r.classes.arianeSup5,r.classes.vertsExtractionModifies],[1,1,1]);
  const un=LM.decompacter(snap(1,{modif:{0:{0:5}}})),ref=LM.decompacter(snap(1));
  const r1=D.comparer(ref,un);assert.equal(r1.classes.sansRepere3d,1);assert.equal(r1.cuts[0].mode,'3d');assert.equal(r1.cuts[0].gauche.lat,null);
  assert.notEqual(cli(ecrire('a3.json',snap(5,{partie:3})),ecrire('a4.json',snap(5,{partie:4}))).status,0);
  assert.notEqual(cli(ecrire('c1.json',snap(5,{cle:'aaaa'})),ecrire('c2.json',snap(5,{cle:'bbbb'}))).status,0);
  assert.equal(cli().status,2);
});

/* A0 — RECHERCHE CONTRAINTE PAR LA PAIRE. Cahier 4.8, §3.4.
 *
 * Deux propriétés décident si cet outil est utilisable, et elles sont testées
 * ici plutôt que supposées.
 *
 * L'OBSERVATION NE DOIT RIEN CHANGER. La grille est récupérée par le rappel
 * `lab.onCoarse` de `geometry-candidate-v1.js`, fichier GELÉ. Passer un `lab`
 * active des chemins expérimentaux dans ce fichier ; il faut donc prouver
 * qu'avec ce seul rappel le placement publié reste identique, sinon on
 * mesurerait un moteur qui n'est pas celui qui tourne en production.
 *
 * AUCUN COUPLE HORS CONTRAT NE DOIT SORTIR. La contrainte d'écartement est ce
 * qui transforme le garde en générateur ; si elle fuit, l'outil propose
 * exactement ce que la 4.7 a été écrite pour refuser.
 */
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const A0=require('../tools/pair-search.cjs');
const Candidate=require('../src/geometry-candidate-v1.js');
const Gauge=require('../src/gauge.js');
const C=require('../vendor/capture-core.js');

const CORPUS=path.join(__dirname,'corpus');
const capture=()=>JSON.parse(fs.readFileSync(path.join(CORPUS,'banane-lidar-part-23-cut-2855-1788941885642.json'),'utf8'));

test('observer la grille ne change pas le placement publié',()=>{
 /* La propriété qui autorise à lire un fichier gelé sans le modifier. */
 const data=capture();
 for(const side of ['left','right']){
  const analysis=A0.analyseRail(data,side);
  assert.ok(analysis.untouched,
    `le rappel onCoarse a modifié le résultat publié pour ${side} — la mesure ne porterait pas sur le moteur de production`);
  assert.ok(Array.isArray(analysis.grid)&&analysis.grid.length>100,
    'la grille doit être rendue en entier, pas échantillonnée');
  for(const cell of analysis.grid.slice(0,50))
   assert.ok(Number.isFinite(cell.u)&&Number.isFinite(cell.z)&&Number.isFinite(cell.loss));
 }
});

test('seuls les minima LOCAUX sont retenus, pas tout le creux',()=>{
 /* Deux puits séparés, plus du bruit entre les deux. Sans la condition de
  * voisinage on rendrait des centaines de cellules du même creux. */
 const grid=[];
 for(let u=-0.06;u<=0.06;u+=0.003)for(let z=-0.03;z<=0.03;z+=0.003){
  const a=Math.hypot(u+0.04,z+0.01),b=Math.hypot(u-0.04,z-0.01);
  grid.push({u:Math.round(u*1e6)/1e6,z:Math.round(z*1e6)/1e6,loss:Math.min(a,b*1.3)});
 }
 const minima=A0.localMinima(grid,0.02);
 assert.ok(minima.length>=2&&minima.length<=8,`attendu quelques minima, obtenu ${minima.length}`);
 assert.ok(minima[0].loss<=minima[minima.length-1].loss,'les minima sont classés par perte croissante');
 /* Les deux puits doivent être représentés, et séparés. */
 const distincts=minima.filter((m,i)=>minima.slice(0,i).every(o=>Math.hypot(o.u-m.u,o.z-m.z)>=0.02));
 assert.ok(distincts.length>=2,'les deux puits doivent apparaître comme des hypothèses distinctes');
});

test('aucun couple hors contrat ne sort de l’énumération',()=>{
 const data=capture();
 const signs={left:A0.profileSign(data,'left'),right:A0.profileSign(data,'right')};
 assert.ok(signs.left&&signs.right,'le signe du profil doit être déterminé');
 const minima={};
 for(const side of ['left','right'])minima[side]=A0.localMinima(A0.analyseRail(data,side).grid,
   Candidate.DEFAULTS.alternativeSeparation);
 const pairs=A0.admissiblePairs(minima,signs,data.rails);
 for(const pair of pairs){
  const verif=Gauge.assessPair(data.rails,pair.deltas,C);
  assert.equal(verif.admissible,true,`couple hors contrat proposé : ${pair.gaugeMm} mm`);
  assert.ok(['NOMINAL','TOLERANCE'].includes(pair.gaugeClass),`classe inattendue : ${pair.gaugeClass}`);
  assert.ok(pair.gaugeMm>=Gauge.CONTRACT.lowMm&&pair.gaugeMm<=Gauge.CONTRACT.maximumMm);
 }
});

test('le classement est déterministe : mêmes entrées, même ordre',()=>{
 const data=capture();
 const signs={left:A0.profileSign(data,'left'),right:A0.profileSign(data,'right')};
 const minima={};
 for(const side of ['left','right'])minima[side]=A0.localMinima(A0.analyseRail(data,side).grid,
   Candidate.DEFAULTS.alternativeSeparation);
 const a=A0.admissiblePairs(minima,signs,data.rails);
 const b=A0.admissiblePairs(minima,signs,data.rails);
 assert.equal(JSON.stringify(a),JSON.stringify(b));
});

test('un profil sans contour ne produit aucun signe, donc aucune paire',()=>{
 const data=capture();
 const sansContour={...data,rails:{...data.rails,left:{...data.rails.left,profileContours:[]}}};
 assert.equal(A0.profileSign(sansContour,'left'),null,
   'sans contour, on rend null plutôt que de deviner un signe');
});

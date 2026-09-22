#!/usr/bin/env node
'use strict';
/*
 * A0 — RECHERCHE CONTRAINTE PAR LA PAIRE. Cahier 4.8, §3.4 et §5.3.
 *
 *   node tools/pair-search.cjs --input SESSION.json [--json SORTIE]
 *
 * CE QUE LE MOTEUR JETTE. `propose()` balaie environ 1 400 positions par rail
 * et conserve TOUTES leurs pertes, puis ne garde que le minimum global. Le
 * critère `lossRatio >= 1,5` ne compare que le meilleur au second. La mesure
 * KI-032 — aucune paire admissible dans le competitive set sur les dix cuts
 * hors contrat — ne dit donc pas que la bonne réponse est absente de la grille.
 * Elle dit qu'elle n'est pas dans la bande des 1,5×.
 *
 * CE QUE FAIT CET OUTIL. Il énumère les minima locaux des DEUX rails, forme
 * les couples, et ne garde que ceux dont l'écartement prévu tient dans le
 * contrat. Le garde d'écartement cesse d'être un veto en aval pour devenir une
 * CONTRAINTE DE GÉNÉRATION : les couples physiquement impossibles ne sont
 * jamais formés. C'est de l'information aujourd'hui inutilisée.
 *
 * LE FICHIER GELÉ N'EST PAS TOUCHÉ. La grille est récupérée par le rappel
 * `lab.onCoarse`, déjà présent dans `geometry-candidate-v1.js`. Aucun autre
 * drapeau `lab` n'est passé, donc aucun chemin expérimental ne s'active et le
 * placement publié reste identique — ce que l'outil vérifie lui-même à chaque
 * rail, et signale si jamais ce n'était pas le cas.
 *
 * CE QU'IL NE FAIT PAS. Il ne publie rien, ne commande rien, ne modifie aucun
 * seuil. Il mesure ce que la contrainte de paire permettrait de retrouver.
 */
const fs=require('node:fs'),path=require('node:path');
const K=require('../src/core.js'),C=require('../vendor/capture-core.js');
const Candidate=require('../src/geometry-candidate-v1.js');
const Gauge=require('../src/gauge.js');
const Lab=require('./placement-lab.cjs');
const SIDES=['left','right'];
const round=(v,n=6)=>Number.isFinite(v)?Math.round(v*10**n)/10**n:null;
const median=a=>{if(!a.length)return NaN;const b=a.slice().sort((x,y)=>x-y),i=b.length>>1;return b.length%2?b[i]:(b[i-1]+b[i])/2;};

/* Signe du profil, recalculé exactement comme `propose()` le fait : c'est lui
 * qui convertit une position de grille en delta publiable. Quatre lignes
 * recopiées d'un fichier gelé, en lecture seule — les dupliquer est le prix à
 * payer pour ne pas le modifier. */
function profileSign(capture,side){
  const rail=capture.rails?.[side];if(!rail)return null;
  const contour=rail.profileContours?.reduce((a,b)=>(b.verticesSceneRelative?.length||0)>(a?.verticesSceneRelative?.length||0)?b:a,null);
  if(!contour)return null;
  const shape=contour.verticesSceneRelative.map(p=>C.point(rail.sceneRelativeToProfileLocal,p));
  const sign=Math.sign(median(shape.map(p=>p[1])));
  return sign||null;
}

/* Minima LOCAUX de la grille. Un point est retenu s'il est le plus bas de son
 * voisinage : sans cette condition on rendrait 1 400 positions voisines du même
 * creux. `separation` est le même paramètre que le moteur utilise déjà pour
 * qualifier son « alternative », donc les hypothèses sont comparables. */
function localMinima(grid,separation){
  const minima=[];
  for(const cell of grid){
    let lowest=true;
    for(const other of grid){
      if(other===cell)continue;
      if(Math.hypot(other.u-cell.u,other.z-cell.z)>=separation)continue;
      if(other.loss<cell.loss){lowest=false;break;}
    }
    if(lowest)minima.push(cell);
  }
  return minima.sort((a,b)=>a.loss-b.loss);
}

/* Une position de grille, exprimée comme le delta que le moteur publierait. */
const deltaOf=(cell,sign)=>[0,sign*cell.u,cell.z];

/* Couples admissibles, classés. Le classement est DÉTERMINISTE — somme des
 * pertes normalisées par le meilleur de chaque rail. C'est le socle du §3.5 :
 * il ne demande ni données ni modèle. Le score appris du chantier A1 viendra
 * remplacer ce classement, pas cette énumération. */
function admissiblePairs(minima,signs,rails,limit=12){
  const out=[];
  const best={left:minima.left[0]?.loss??null,right:minima.right[0]?.loss??null};
  for(const left of minima.left.slice(0,limit))for(const right of minima.right.slice(0,limit)){
    const deltas={left:deltaOf(left,signs.left),right:deltaOf(right,signs.right)};
    const gauge=Gauge.assessPair(rails,deltas,C);
    if(!gauge.measurable||!gauge.admissible)continue;
    const ratio=(best.left?left.loss/best.left:1)+(best.right?right.loss/best.right:1);
    out.push({left:{u:round(left.u),z:round(left.z),loss:round(left.loss,9),
        rank:minima.left.indexOf(left),lossRatio:round(best.left?left.loss/best.left:null,4)},
      right:{u:round(right.u),z:round(right.z),loss:round(right.loss,9),
        rank:minima.right.indexOf(right),lossRatio:round(best.right?right.loss/best.right:null,4)},
      deltas,gaugeMm:round(gauge.predictedMm,3),gaugeClass:gauge.gaugeClass,score:round(ratio,4)});
  }
  return out.sort((a,b)=>a.score-b.score);
}

/* Un rail, analysé. `onCoarse` rend la grille ; le résultat publié est comparé
 * à celui obtenu sans le rappel, pour prouver que l'observation n'altère rien. */
function analyseRail(capture,side){
  let grid=null,best=null;
  const observed=Candidate.propose(capture,side,{lab:{onCoarse:(cells,info)=>{grid=cells;best=info.best;}}});
  const plain=Candidate.propose(capture,side);
  const untouched=JSON.stringify(observed.delta)===JSON.stringify(plain.delta)
    &&observed.status===plain.status;
  return {grid,best,proposal:plain,untouched};
}

/* LA SEULE QUESTION QUI COMPTE. Trouver un couple dont l'écartement rentre
 * dans le contrat ne prouve RIEN : avec quelques minima par rail et un contrat
 * large de 65 mm, une combinaison peut y tomber par hasard. Ce qui prouve
 * quelque chose, c'est la distance du couple retenu à la correction humaine.
 * Sans référence, l'outil dit « non mesurable » plutôt que d'annoncer un
 * succès qu'il n'a pas établi. */
function referenceDistance(pair,references,signs){
  const out={};
  for(const side of SIDES){
    const reference=references[side];
    if(!reference||reference.status!=='candidate'||!Array.isArray(reference.deltaLocal)){out[side]=null;continue;}
    const d=pair.deltas[side].map((v,i)=>v-reference.deltaLocal[i]);
    out[side]={lateral:round(d[1]),vertical:round(d[2]),euclidean:round(Math.hypot(...d))};
  }
  return out;
}

function analyseVisit(prepared,references){
  const capture=prepared.pair?.status==='ready'?prepared.pair.capture:null;
  if(!capture)return {status:'excluded',reason:prepared.pair?.reasons?.[0]||'pair-not-ready'};
  const rails={},minima={},signs={},proposals={};
  let observationChangedResult=false;
  for(const side of SIDES){
    const sign=profileSign(capture,side);
    if(!sign)return {status:'excluded',reason:'profile-sign-unavailable'};
    signs[side]=sign;
    const analysis=analyseRail(capture,side);
    if(!analysis.grid)return {status:'excluded',reason:'coarse-grid-unavailable:'+side};
    if(!analysis.untouched)observationChangedResult=true;
    minima[side]=localMinima(analysis.grid,Candidate.DEFAULTS.alternativeSeparation);
    proposals[side]=analysis.proposal;
    rails[side]=capture.rails[side];
  }
  const pairs=admissiblePairs(minima,signs,rails);
  /* Distance à la référence humaine, pour le meilleur couple ET pour le
   * meilleur couple ATTEIGNABLE — celui qui, parmi les couples admissibles,
   * serre le plus la référence. L'écart entre les deux dit ce qu'un meilleur
   * classement pourrait gagner : c'est la question du chantier A1. */
  const referenced=references&&SIDES.some(side=>references[side]?.status==='candidate');
  let bestByScore=null,bestByReference=null;
  if(referenced&&pairs.length){
    bestByScore=referenceDistance(pairs[0],references,signs);
    let meilleur=null,distance=Infinity;
    for(const pair of pairs){
      const d=referenceDistance(pair,references,signs);
      const total=SIDES.reduce((sum,side)=>sum+(d[side]?.euclidean??0),0);
      const mesurables=SIDES.filter(side=>d[side]).length;
      if(!mesurables)continue;
      if(total<distance){distance=total;meilleur={pair,d};}
    }
    const somme=d=>SIDES.reduce((total,side)=>total+(d[side]?.euclidean??0),0);
    const mesures=d=>SIDES.filter(side=>d[side]).length;
    bestByReference=meilleur?{sidesMeasured:mesures(meilleur.d),
      distanceSum:round(somme(meilleur.d)),
      perSide:Object.fromEntries(SIDES.map(side=>[side,meilleur.d[side]?.euclidean??null])),
      rankInScore:pairs.indexOf(meilleur.pair)}:null;
    if(bestByScore)bestByScore={sidesMeasured:mesures(bestByScore),distanceSum:round(somme(bestByScore)),
      perSide:Object.fromEntries(SIDES.map(side=>[side,bestByScore[side]?.euclidean??null]))};
  }
  /* Ce que le moteur publie aujourd'hui, mesuré de la même façon, pour que la
   * comparaison porte sur les mêmes grandeurs. */
  const published=SIDES.every(side=>Array.isArray(proposals[side].delta))
    ?Gauge.assessPair(rails,{left:proposals.left.delta,right:proposals.right.delta},C):null;
  /* Ce que le moteur publie, mesuré contre la même référence. */
  const engineDistance=referenced&&SIDES.every(side=>Array.isArray(proposals[side].delta))
    ?referenceDistance({deltas:{left:proposals.left.delta,right:proposals.right.delta}},references,signs):null;
  return {status:'analysed',observationChangedResult,referenced,
    engineDistance,bestPairDistance:bestByScore,reachable:bestByReference,
    minimaCount:{left:minima.left.length,right:minima.right.length},
    engine:{statuses:Object.fromEntries(SIDES.map(s=>[s,proposals[s].status])),
      gaugeMm:published?round(published.predictedMm,3):null,
      gaugeClass:published?published.gaugeClass:null,
      admissible:published?published.admissible:null},
    admissiblePairs:pairs.length,best:pairs[0]||null,pairs:pairs.slice(0,5)};
}

function run(argv=process.argv.slice(2)){
  const input=argv[argv.indexOf('--input')+1],out=argv.includes('--json')?argv[argv.indexOf('--json')+1]:null;
  if(!input||argv.indexOf('--input')<0){console.error('Usage : --input SESSION.json [--json SORTIE]');process.exit(1);}
  const session=JSON.parse(fs.readFileSync(input,'utf8'));
  /* Même indexation que `native-offline-evaluate` : le point de reprise est
   * retrouvé par `chunkId`, pas par `captureId`. */
  const clouds=new Map((session.clouds||[]).map(cloud=>[cloud.chunkId||cloud.captureId,cloud]));
  const rows=[];
  for(const record of session.records||[]){
    let prepared;try{prepared=Lab.prepareVisit(record,clouds,session.events||[]);}catch(e){rows.push({cut:record.identity?.cut,status:'excluded',reason:'prepare:'+e.message});continue;}
    const references={};
    for(const side of SIDES){
      try{references[side]=prepared.rails[side]?.status==='ready'
        ?Lab.referenceFor(record,side,prepared.rails[side].initialRail,prepared.rails[side].snapshotAcquiredThroughAt)
        :{status:'unavailable'};}catch(e){references[side]={status:'unavailable',reason:e.message};}
    }
    let analysis;try{analysis=analyseVisit(prepared,references);}catch(e){analysis={status:'error',reason:e.message};}
    rows.push({cut:record.identity?.cut,part:record.identity?.part,...analysis});
  }
  const analysed=rows.filter(r=>r.status==='analysed');
  const withPairs=analysed.filter(r=>r.admissiblePairs>0);
  const engineAdmissible=analysed.filter(r=>r.engine.admissible===true);
  const withReference=analysed.filter(r=>r.referenced&&r.reachable);
  const tampered=analysed.filter(r=>r.observationChangedResult);
  console.log('════ A0 — RECHERCHE CONTRAINTE PAR LA PAIRE ════');
  console.log(`visites analysées            ${analysed.length} / ${rows.length}`);
  console.log(`observation sans effet       ${tampered.length===0?'OUI — le placement publié est identique avec et sans le rappel':'NON ⚠ '+tampered.length+' rail(s) modifié(s)'}`);
  if(analysed.length){
    const ml=median(analysed.map(r=>r.minimaCount.left)),mr=median(analysed.map(r=>r.minimaCount.right));
    console.log(`minima locaux par rail       médiane gauche ${ml} · droite ${mr}`);
    console.log('');
    console.log(`moteur : paire publiée et admissible   ${engineAdmissible.length} / ${analysed.length}`);
    console.log(`A0     : au moins un couple admissible  ${withPairs.length} / ${analysed.length}`);
    console.log('');
    console.log('── La seule mesure qui tranche : distance à la correction humaine ──');
    if(!withReference.length){
      console.log('  AUCUNE visite ne porte de référence humaine exploitable.');
      console.log('  Qu’un couple admissible existe ne prouve donc RIEN ici : avec quelques');
      console.log('  minima par rail et un contrat large de 65 mm, une combinaison peut y');
      console.log('  tomber par hasard. Verdict : NON MESURABLE sur ce jeu.');
    }else{
      /* Unités de scène. `physicalCalibrationStatus` n'atteste PAS les
       * millimètres ; l'écartement étant rendu par `distance × 1000`, on
       * affiche l'équivalent en mm à titre indicatif, et on le dit. */
      const mm=v=>Number.isFinite(v)?` (~${(v*1000).toFixed(1)} mm indicatif)`:'';
      const stat=(rows,label)=>{
        const v=rows.filter(Number.isFinite).sort((a,b)=>a-b);
        if(!v.length)return console.log(`  ${label.padEnd(38)}non mesurable`);
        console.log(`  ${label.padEnd(38)}médiane ${v[v.length>>1]}${mm(v[v.length>>1])} · max ${v[v.length-1]}`);
      };
      const deuxRails=withReference.filter(r=>r.reachable.sidesMeasured===2);
      console.log(`  visites référencées                   ${withReference.length}  (dont ${deuxRails.length} sur les deux rails)`);
      stat(withReference.map(r=>r.reachable.distanceSum),'couple le plus proche atteignable');
      stat(withReference.map(r=>r.bestPairDistance?.distanceSum),'couple choisi par le score actuel');
      const ranks=withReference.map(r=>r.reachable.rankInScore).filter(Number.isInteger).sort((a,b)=>a-b);
      if(ranks.length){
        const zero=ranks.filter(r=>r===0).length;
        console.log(`  rang du meilleur dans le classement   médiane ${ranks[ranks.length>>1]} · rang 0 dans ${zero}/${ranks.length} cas`);
      }
      console.log('');
      console.log('  Lecture : « atteignable » est un oracle sur l’ensemble admissible —');
      console.log('  il dit ce qu’un classement PARFAIT donnerait. L’écart avec le score');
      console.log('  actuel est exactement ce que le chantier A1 aurait à gagner.');
    }
  }
  const card={format:'banane-pair-search-v1',contract:Gauge.CONTRACT.version,
    separation:Candidate.DEFAULTS.alternativeSeparation,
    summary:{analysed:analysed.length,total:rows.length,observationChangedResult:tampered.length,
      engineAdmissible:engineAdmissible.length,withAdmissiblePairs:withPairs.length,
      referenced:withReference.length},
    rows};
  if(out)fs.writeFileSync(out,JSON.stringify(card,null,2)+'\n');
  return card;
}
module.exports={localMinima,admissiblePairs,profileSign,analyseRail,analyseVisit,run};
if(require.main===module)run();

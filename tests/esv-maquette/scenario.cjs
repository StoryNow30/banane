'use strict';
/*
 * scenario.cjs — construit une PARTIE SYNTHÉTIQUE pour la maquette ESV à partir
 * des captures déjà versionnées dans tests/corpus/ (points en repère scène,
 * aucune coordonnée monde réelle, aucun identifiant de projet).
 *
 * Chaque cut de la partie reprend la géométrie d'une capture du corpus (rails,
 * contours de profil, nœuds de points) posée dans un monde factice : cut k à
 * k × 1 m le long de la direction du rail. Les coordonnées monde sont donc
 * inventées ; les coordonnées scène (ce qu'Ariane exporte) sont celles du corpus.
 *
 *   const S=require('./scenario.cjs'); S.construire({cuts:12,debut:100,part:23})
 *
 * Statuts : par défaut, un cut sur cinq « valid », un sur sept « skipped »,
 * les autres « invalid » (l'ordre est fixe, le scénario est reproductible).
 */
const fs=require('node:fs'),path=require('node:path');
const C=require('../../vendor/capture-core.js');
const racine=path.resolve(__dirname,'../..');
/* Corpus privé possible (captures banane-lidar-… hors dépôt) : BANANE_MAQUETTE_CORPUS=/chemin */
const corpusDir=process.env.BANANE_MAQUETTE_CORPUS||path.join(racine,'tests/corpus');
const ORIGINE_MONDE=[1200.5,850.25,42];   /* factice */
const PAS_M=1;                            /* un cut par mètre (D-098) */
let cacheCorpus=null;
function corpus(){
  if(cacheCorpus)return cacheCorpus;
  const fichiers=fs.readdirSync(corpusDir).filter(f=>/^banane-lidar-part-\d+-cut-\d+-\d+\.json$/.test(f)).sort();
  cacheCorpus=fichiers.map(f=>({nom:f.replace(/-\d+\.json$/,''),capture:JSON.parse(fs.readFileSync(path.join(corpusDir,f),'utf8'))}));
  if(!cacheCorpus.length)throw Error('tests/corpus : aucune capture banane-lidar.');
  return cacheCorpus;
}
const arrondi=(v,d=6)=>Math.round(v*10**d)/10**d;
/* Décomposition d'une matrice affine (colonnes) en position, quaternion, échelle. */
function decomposer(m){
  const position=[m[12],m[13],m[14]],scale=[0,4,8].map(i=>Math.hypot(m[i],m[i+1],m[i+2]));
  const r=[0,1,2].map(c=>[0,1,2].map(l=>m[c*4+l]/scale[c])); /* r[c][l] = colonne c, ligne l */
  const R=(l,c)=>r[c][l],t=R(0,0)+R(1,1)+R(2,2);let q;
  if(t>0){const s=Math.sqrt(t+1)*2;q=[(R(2,1)-R(1,2))/s,(R(0,2)-R(2,0))/s,(R(1,0)-R(0,1))/s,.25*s];}
  else if(R(0,0)>R(1,1)&&R(0,0)>R(2,2)){const s=Math.sqrt(1+R(0,0)-R(1,1)-R(2,2))*2;q=[.25*s,(R(0,1)+R(1,0))/s,(R(0,2)+R(2,0))/s,(R(2,1)-R(1,2))/s];}
  else if(R(1,1)>R(2,2)){const s=Math.sqrt(1+R(1,1)-R(0,0)-R(2,2))*2;q=[(R(0,1)+R(1,0))/s,.25*s,(R(1,2)+R(2,1))/s,(R(0,2)-R(2,0))/s];}
  else{const s=Math.sqrt(1+R(2,2)-R(0,0)-R(1,1))*2;q=[(R(0,2)+R(2,0))/s,(R(1,2)+R(2,1))/s,.25*s,(R(1,0)-R(0,1))/s];}
  return {position,quaternion:q,scale};
}
/* Contour de repli (forme en U, 3 lignes) quand une pose n'a pas de contour exporté : seul le signe du y moyen compte pour gauche/droite. */
const CONTOUR_REPLI=side=>{const s=side==='left'?1:-1;return [[[0,s*.036,0],[0,s*.036,-.05],[0,s*.01,-.05]],[[0,s*.01,-.05],[0,s*.01,-.12],[0,s*.07,-.12]],[[0,s*.07,-.12],[0,s*.07,-.15],[0,s*.005,-.15]]];};
function rail(capture,side,origine){
  const r=capture.rails[side],rm=r.railLocalToSceneRelative,pm=r.profileLocalToSceneRelative;
  const monde=C.multiply(C.translation(origine),rm),profilDansRail=C.multiply(C.inverse(rm),pm);
  const inv=r.sceneRelativeToProfileLocal||C.inverse(pm);
  const contours=(r.profileContours||[]).length?r.profileContours.map(c=>c.verticesSceneRelative.map(v=>C.point(inv,v).map(x=>arrondi(x,6)))):CONTOUR_REPLI(side);
  const centreY=contours.flat().reduce((a,p)=>a+p[1],0)/Math.max(1,contours.flat().length);
  if((side==='left')!==(centreY>0))throw Error(`Contour ${side} : côté inattendu (y moyen ${centreY}).`);
  return {...decomposer(monde),rotation:r.rotation||[0,0,0,'XYZ'],profil:{...decomposer(profilDansRail),rotation:r.profileRotation||[0,0,0,'XYZ']},contours};
}
function noeuds(capture){
  const parNoeud=new Map();
  capture.pointSources.forEach(([n,i],k)=>{if(!parNoeud.has(n))parNoeud.set(n,[]);parNoeud.get(n).push(k);});
  const inten=capture.attributes?.intensity||[],classe=capture.attributes?.classification||[];
  return capture.nodes.map((node,n)=>{const ks=parNoeud.get(n)||[];
    /* Un nœud sans point dans les fenêtres existe quand même dans la vue d'ESV :
     * il garde quelques points loin des rails, pour que l'inventaire le compte. */
    const positions=ks.length?ks.flatMap(k=>capture.pointsSceneRelative[k].map(x=>arrondi(x,6))):[12+n,20,-3, 12.5+n,20.5,-3.2, 13+n,21,-2.8];
    return {source:node.id,positions,intensite:ks.map(k=>inten[k]??0),classe:ks.map(k=>classe[k]??0)};});
}
/* Découpe réelle d'une capture : matrices scène → cube unité (données, pas du code). */
function decoupe(capture){const c=capture.clouds?.[0]?.clipping;if(!c||!Array.isArray(c.boxesSceneRelativeToUnit)||!c.boxesSceneRelativeToUnit.length)return null;
  return {task:c.task||'SHOW_INSIDE',method:c.method||'INSIDE_ANY',boites:c.boxesSceneRelativeToUnit.map(m=>m.slice())};}
function construire(options={}){
  const nb=Number(options.cuts??12),debut=Number(options.debut??100),part=Number(options.part??23),partie2=Number(options.partie2??4);
  const base=corpus(),direction=base[0].capture.rails.left.railLocalToSceneRelative.slice(0,3);
  const statut=i=>i%5===4?'valid':i%7===6?'skipped':'invalid';
  const partie=(numero,premier,n,decalageIndex)=>{
    const cuts=[];
    for(let i=0;i<n;i++){const src=base[(decalageIndex+i)%base.length],k=decalageIndex+i;
      const origine=ORIGINE_MONDE.map((v,j)=>arrondi(v+direction[j]*PAS_M*k,6));
      cuts.push({cut:premier+i,index:i,status:statut(k),origine,source:src.nom,shape:src.capture.shape||'U50',
        rails:{left:rail(src.capture,'left',origine),right:rail(src.capture,'right',origine)},noeuds:noeuds(src.capture),decoupe:decoupe(src.capture)});}
    return {part:numero,table:`maquette-${numero}`,cuts};
  };
  return {format:'banane-esv-maquette-scenario-v1',monde:{origine:ORIGINE_MONDE,pas:PAS_M,direction},
    camera:{echelle:5,profondeur:1e-4},decoupe:{dimensions:[7,5,.6]},
    /* CH-017 : `parties` (défaut 2) : parties de plus, de `partie2` cuts chacune, numérotées à la suite (file de parties). */
    parties:[partie(part,debut,nb,0),...Array.from({length:Math.max(1,Number(options.parties??2))-1},(_,i)=>partie(part+1+i,1,partie2,nb+i*partie2))]};
}
/* Lignes de la liste des coupes (forme de fiches/FICHE_B1.md, valeurs factices). La page d'ESV affiche
 * « Cut N » pour la ligne d'indice N (lecture du code d'ESV, mission B ; B1 s'y fie) : la liste porte donc une
 * ligne par indice de 0 au plus grand cut, et les indices sans cut rejouable sont des lignes « valid » sans bords (validées avant le lot ; sans bords, B1 ne s'y appuie pas). */
function lignes(partie){
  const parCut=new Map(partie.cuts.map(c=>[c.cut,c])),max=Math.max(-1,...partie.cuts.map(c=>c.cut)),out=[];
  for(let i=0;i<=max;i++){const c=parCut.get(i);
    if(!c){out.push({RowKey:`${partie.part}-${i}`,PK:partie.table,CutNumber:i,ExtractionStatus:'valid',TreatedByOperator:true,SeenByOperator:true,Index:i});continue;} /* ligne validée hors rejeu, sans bords : jamais un appui */
    const L=c.rails.left.position,R=c.rails.right.position;
    out.push({RowKey:`${partie.part}-${i}`,PK:partie.table,CutNumber:i,ExtractionStatus:c.status,
      TreatedByOperator:c.status!=='invalid',SeenByOperator:c.status!=='invalid',SuccessLeft:c.status==='valid',SuccessRight:c.status==='valid',
      XLeftEdge:L[0],YLeftEdge:L[1],ZLeftEdge:L[2],XRightEdge:R[0],YRightEdge:R[1],ZRightEdge:R[2],
      RailSpacing:arrondi(Math.hypot(...R.map((v,j)=>v-L[j])),4),TrajAzimuth:0,Index:i});}
  return out;
}
module.exports={construire,lignes,corpus,rail,noeuds,decoupe,decomposer,arrondi,ORIGINE_MONDE,PAS_M};
if(require.main===module){const s=construire({cuts:Number(process.argv[2]||12)});
  console.log(JSON.stringify({parties:s.parties.map(p=>({part:p.part,cuts:p.cuts.length,statuts:p.cuts.map(c=>c.status[0]).join('')})),
    premier:{cut:s.parties[0].cuts[0].cut,noeuds:s.parties[0].cuts[0].noeuds.length,points:s.parties[0].cuts[0].noeuds.reduce((a,n)=>a+n.positions.length/3,0)}},null,1));}

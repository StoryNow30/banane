'use strict';
/* CH-065 : la recherche de pose élaguée (chantiers/CH-065/geometrie-elaguee.patch) rend, au bit près, ce que rend la recherche d'origine :
 * poses, statuts, motifs, confiances, métriques, grilles grossières et exceptions, sur les quatre entrées de la géométrie (moteur V4.6 gelé,
 * candidat GCV1, composition du lot, grille de la décision du lot). Captures réelles réduites de tests/fixtures/captures-moteur.json, et des
 * variantes déplacées, éclaircies et hors domaine (|u| ≥ 1 : boucle d'origine). La parité sur les 4 647 nuages réels du 04 au 06/11 est
 * faite par tools/ch065-parite-geometrie.cjs (chantiers/CH-065/rapport.md). Valable avant et après application du patch. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const H=require('./helpers/ch065.cjs');
const O=H.geometrie('origine'),P=H.geometrie('patche');
function variantes(){
  const out=[];
  for(const [k,c] of H.captures().entries()){
    out.push(['capture '+k,c]);
    if(k>=3)continue;
    const dec=[[.004,-.003,.002],[-.011,.007,-.005]][k%2];
    out.push(['capture '+k+' déplacée',{...c,pointsSceneRelative:c.pointsSceneRelative.map(p=>[p[0]+dec[0],p[1]+dec[1],p[2]+dec[2]])}]);
    if(k===2)out.push(['capture '+k+' un point sur trois',{...c,pointsSceneRelative:c.pointsSceneRelative.filter((p,i)=>i%3===0),
      visibleByClipBoxes:c.visibleByClipBoxes?.filter((p,i)=>i%3===0)}]);
  }
  return out;
}
const entrees=(M,c,lab)=>({
  v46:H.essayer(()=>M.G.proposeBoth(c)),
  candidat:H.essayer(()=>M.Cand.proposeBoth(c)),
  composition:H.essayer(()=>M.S.scientificProposeBoth(c)),
  decision:['left','right'].map(side=>{let grille=null;const r=H.essayer(()=>M.Cand.propose(c,side,{lab:{...lab,onCoarse(g){grille=g;}}}));return {r,grille};}),
});
const LAB={uSeeds:[.02],replaceOrigin:false,recenterWindow:true,partialFaceKeep:true};
test('CH-065 : chaque patch est entier ou absent dans l\'arbre, jamais à moitié', ()=>{
  for(const f of H.A.FICHIERS)assert.doesNotThrow(()=>H.A.versions(H.RACINE,f),f);
});
test('CH-065 : mêmes sorties au bit près, quatre entrées, captures réelles et variantes', ()=>{
  let candidats=0;
  for(const [nom,c] of variantes()){
    const a=entrees(O,c,LAB),b=entrees(P,c,LAB);
    assert.equal(H.canon(b),H.canon(a),nom);
    for(const s of ['left','right'])if(a.v46.ok?.[s]?.status==='candidate')candidats++;
  }
  assert.ok(candidats>=5,'trop peu de rails posés pour que l\'essai dise quelque chose : '+candidats);
});

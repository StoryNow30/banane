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
test('CH-065 : chaque sous-ensemble de patchs rend la même chose (l\'opérateur peut choisir patch par patch)', ()=>{
  const c=H.captures()[3],ref=H.canon(entrees(O,c,LAB));
  for(const noms of [['geometrie-elaguee-lot'],['geometrie-elaguee-v46'],['mediane-exacte'],['geometrie-elaguee-lot','mediane-exacte']]){
    const textes={};for(const f of ['src/geometry.js','src/geometry-candidate-v1.js']){const v=H.A.versions(H.RACINE,f);textes[f]=H.A.patcher(f,v.origine,noms);}
    assert.equal(H.canon(entrees(H.geometrie('patche',textes),c,LAB)),ref,noms.join('+'));
  }
});
test('CH-065 : hors du domaine de l\'élagage (|u| ≥ 1), la boucle d\'origine est gardée et rend la même chose', ()=>{
  const c=H.captures()[0];
  for(const u of [1.5,-3])assert.equal(H.canon(entrees(P,c,{...LAB,uSeeds:[u]}).decision),H.canon(entrees(O,c,{...LAB,uSeeds:[u]}).decision));
});
test('CH-065 : mêmes exceptions (paramètre invalide, profil absent) et mêmes refus', ()=>{
  const c=H.captures()[1];
  for(const [nom,f] of [['grille',M=>M.G.proposeBoth(c,{grid:.5})],['profil',M=>M.Cand.propose({...c,rails:{}},'left')],
    ['incohérent',M=>M.Cand.proposeBoth(c,{pairedSupportLateral:.1,maxSingleRailLateral:.05})],['sans points',M=>M.G.proposeBoth({...c,pointsSceneRelative:[]})]]){
    const a=H.essayer(()=>f(O)),b=H.essayer(()=>f(P));assert.equal(H.canon(b),H.canon(a),nom);
  }
});
test('CH-065 : l\'essai a des dents — une fenêtre trop étroite (20 mm < 25 mm) est vue', ()=>{
  const f='src/geometry-candidate-v1.js',t=H.A.versions(H.RACINE,f).patche;
  const faux=t.replace('borne(u+a[0]-.026),fin=borne(u+a[0]+.026)','borne(u+a[0]-.020),fin=borne(u+a[0]+.020)');
  assert.notEqual(faux,t);
  const M=H.geometrie('patche',{[f]:faux}),c=H.captures()[0];
  assert.notEqual(H.canon(entrees(M,c,LAB).decision),H.canon(entrees(O,c,LAB).decision));
});

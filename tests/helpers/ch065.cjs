'use strict';
/* CH-065 : charge, dans le même processus, la version d'origine et la version patchée des modules touchés par les patchs
 * (chantiers/CH-065/appliquer.cjs), quel que soit l'état de l'arbre (avant ou après application par l'intégrateur).
 * Les dépendances non patchées sont les vraies (capture-core, brain, gauge, convention) ; les modules patchés sont compilés depuis
 * leur texte, avec une résolution de `require` qui renvoie la variante voulue. */
const path=require('node:path'),Module=require('node:module');
const RACINE=path.resolve(__dirname,'../..'),A=require(path.join(RACINE,'chantiers/CH-065/appliquer.cjs'));
function compiler(texte,fichier,remplacements={}){
  const abs=path.join(RACINE,fichier),m=new Module(abs,module);m.filename=abs;m.paths=Module._nodeModulePaths(path.dirname(abs));
  const base=m.require.bind(m);m.require=id=>id in remplacements?remplacements[id]:base(id);
  m._compile(texte,abs);return m.exports;
}
/* sens : 'origine' ou 'patche'. Le texte d'un module patché peut être remplacé (`textes`) pour les essais de mutation. */
function geometrie(sens,textes={}){
  const t=f=>textes[f]??A.versions(RACINE,f)[sens];
  const G=compiler(t('src/geometry.js'),'src/geometry.js');
  const Cand=compiler(t('src/geometry-candidate-v1.js'),'src/geometry-candidate-v1.js');
  const Brain=compiler(require('node:fs').readFileSync(path.join(RACINE,'src/geometry-brain.js'),'utf8'),'src/geometry-brain.js',{'./geometry.js':G});
  const S=require(path.join(RACINE,'src/gcv1-shadow.js'))._createForTest(Brain,Cand,require(path.join(RACINE,'vendor/capture-core.js')),
    require(path.join(RACINE,'src/gauge.js')),require(path.join(RACINE,'src/placement-convention.js')));
  return {G,Cand,Brain,S};
}
function lidar(sens,texte){return compiler(texte??A.versions(RACINE,'vendor/lidar.js')[sens],'vendor/lidar.js');}
/* Sérialisation canonique au bit : signe du zéro, NaN et infinis écrits ; fonctions écartées ; clés d'horodatage écartées. */
function canon(v,ignorer=[]){
  if(typeof v==='number')return Object.is(v,-0)?'-0':Number.isNaN(v)?'NaN':v===Infinity?'Inf':v===-Infinity?'-Inf':String(v);
  if(v===null||v===undefined)return String(v);
  if(typeof v==='function')return 'fn';
  if(typeof v!=='object')return JSON.stringify(v);
  if(ArrayBuffer.isView(v))return '['+Array.from(v,x=>canon(x)).join(',')+']';
  if(Array.isArray(v))return '['+v.map(x=>canon(x,ignorer)).join(',')+']';
  return '{'+Object.keys(v).filter(k=>!ignorer.includes(k)).map(k=>JSON.stringify(k)+':'+canon(v[k],ignorer)).join(',')+'}';
}
const essayer=f=>{try{return {ok:f()};}catch(e){return {erreur:(e?.name||'')+': '+(e?.message||String(e))};}};
const captures=()=>require(path.join(RACINE,'tests/fixtures/captures-moteur.json')).captures;
module.exports={RACINE,A,compiler,geometrie,lidar,canon,essayer,captures};

'use strict';
/* CH-065 : la médiane du patch `mediane-exacte` (src/geometry-candidate-v1.js) rend la même valeur au bit près (Object.is) que la médiane
 * d'origine : longueurs paires et impaires, égalités, -0 et +0 (seuls ou mêlés), NaN, infinis, tableaux typés, valeurs non numériques, tableau vide.
 * Les sorties de la géométrie sur les nuages réels sont comparées par tests/ch065-geometrie-elaguee.test.cjs et tools/ch065-parite-geometrie.cjs. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const H=require('./helpers/ch065.cjs');
const f='src/geometry-candidate-v1.js',v=H.A.versions(H.RACINE,f);
const MO=H.compiler(v.origine,f).median,MP=H.compiler(H.A.patcher(f,v.origine,['mediane-exacte']),f).median;
let s=7;const alea=()=>((s=(s*1664525+1013904223)>>>0)/4294967296);
const memes=(a,nom)=>{const x=MO(a.slice?a.slice():a),y=MP(a.slice?a.slice():a);assert.ok(Object.is(x,y),`${nom} : ${x} contre ${y}`);};
test('CH-065 : médiane identique sur des tableaux aléatoires, avec égalités', ()=>{
  for(let k=0;k<4000;k++){const n=1+Math.floor(alea()*60),q=alea()<.5?1000:7;
    memes(Array.from({length:n},()=>Math.round((alea()-.5)*q)/q*(alea()<.1?1e-9:1)),'aléatoire '+k);}
});
test('CH-065 : cas limites (zéros signés, NaN, infinis, vide, non numériques, tableaux typés)', ()=>{
  const cas={vide:[],un:[3],deux:[2,1],zeros:[0,0,1,-1],moinsZeros:[-0,-0,1,-1],melange1:[-0,0],melange2:[0,-0],melange3:[1,-0,0,-1],melange4:[-0,0,0,-0,5,-5],
    nan:[NaN,1,2],nanPair:[1,NaN,3,2],infinis:[Infinity,-Infinity,0,1],infDoubles:[Infinity,Infinity,1,2],texte:['3',1,2],indefini:[undefined,1,2],
    trou:[1,,3],type64:new Float64Array([3,1,2,0]),type32:new Float32Array([.1,.2,.3,.4]),grand:[1e308,-1e308,1e308,5]};
  for(const [nom,a] of Object.entries(cas))memes(a,nom);
});
test('CH-065 : l\'essai a des dents — un tri natif sans la garde des zéros mêlés est vu', ()=>{
  const faux=H.A.patcher(f,v.origine,['mediane-exacte']).replace('if(ok&&!(pz&&nz))','if(ok)');
  const MF=H.compiler(faux,f).median;assert.ok(!Object.is(MO([0,-0,5]),MF([0,-0,5])));
});

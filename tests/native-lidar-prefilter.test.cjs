/* REJET PRÉALABLE DU LECTEUR — la propriété qui le rend acceptable.
 *
 * Mesuré sur le lot du 22 septembre : chaque capture lit un nœud Potree
 * d'environ 39 000 points et n'en retient que 2 %, et 92 % des captures sont
 * interrompues par l'opérateur — pas par leur budget. La fenêtre utile était
 * donc dépensée à transformer des points voués au rebut.
 *
 * Le rejet préalable n'est légitime QUE s'il est conservatif : il doit pouvoir
 * écarter des points inutiles, jamais un point que `inBox` aurait retenu. Ces
 * essais fixent cette propriété, parce qu'une boîte englobante trop serrée
 * ferait silencieusement disparaître des points du corpus — le genre de défaut
 * qu'aucun compteur ne montrerait.
 */
const {test}=require('node:test');
const assert=require('node:assert/strict');
const L=require('../src/native-lidar.js');
const C=require('../vendor/capture-core.js');
const {rawRoiBounds,inBox}=L._test;

const BOUNDS=[0.5,0.4,0.3];
const inside=(box,p)=>p.every((v,i)=>v>=box.lo[i]&&v<=box.hi[i]);

/* Générateur déterministe : mêmes points d'un essai à l'autre. */
function prng(seed){let x=seed>>>0;return()=>((x=(x*1664525+1013904223)>>>0)/4294967296);}

/* Transformation quelconque mais réaliste : rotation, échelle, translation. */
function transform(a,b,c,scale,t){
 const R=C.multiply(C.multiply(C.rotation?.([0,0,1],a)||C.identity(),C.identity()),C.identity());
 return C.multiply(C.translation(t),C.multiply(R,[scale,0,0,0, 0,scale,0,0, 0,0,scale,0, 0,0,0,1]));
}

test('la boîte englobante ne peut jamais écarter un point que la ROI accepte',()=>{
 const random=prng(20260922);
 let dansRoi=0,horsRoi=0;
 for(let essai=0;essai<40;essai++){
  const angle=random()*Math.PI*2,scale=0.5+random()*2;
  const cos=Math.cos(angle),sin=Math.sin(angle);
  const M=[cos*scale,sin*scale,0,0, -sin*scale,cos*scale,0,0, 0,0,scale,0,
    (random()-0.5)*4,(random()-0.5)*4,(random()-0.5)*2,1];
  const box=rawRoiBounds(M,BOUNDS);
  assert.ok(box,'une transformation inversible doit donner une boîte');
  const inverse=C.inverse(M);
  /* Les points sont tirés DANS le repère profil, sur une boîte un peu plus
   * large que la ROI : environ la moitié tombe dedans, l'autre juste dehors.
   * C'est exactement là que la propriété se joue — tirer au hasard dans tout
   * l'espace ne produirait presque aucun point utile. */
  for(let n=0;n<400;n++){
   const local=[(random()-0.5)*2*BOUNDS[0]*1.6,(random()-0.5)*2*BOUNDS[1]*1.6,(random()-0.5)*2*BOUNDS[2]*1.6];
   const raw=C.point(inverse,local);
   if(inBox(local,BOUNDS)){
    dansRoi++;
    assert.ok(inside(box,raw),
      'point dans la ROI mais hors de la boîte englobante — le rejet préalable le perdrait');
   }else horsRoi++;
  }
 }
 assert.ok(dansRoi>2000,`échantillon dans la ROI trop pauvre : ${dansRoi}`);
 assert.ok(horsRoi>2000,`échantillon hors ROI trop pauvre : ${horsRoi}`);
});

test('une transformation non inversible rend null, et le chemin complet reprend',()=>{
 /* Matrice dégénérée : l'axe z s'effondre. Aucun rejet ne doit en découler. */
 const degeneree=[1,0,0,0, 0,1,0,0, 0,0,0,0, 0,0,0,1];
 const box=rawRoiBounds(degeneree,BOUNDS);
 assert.equal(box,null,'pas de boîte sur une géométrie douteuse : on transforme tout');
});

test('la boîte englobe bien les huit coins, et pas seulement le centre',()=>{
 /* Rotation de 45° : la boîte doit s'élargir d'un facteur racine de deux sur
  * les deux axes tournés, sinon elle coupe les coins de la ROI. */
 const a=Math.PI/4,cos=Math.cos(a),sin=Math.sin(a);
 const M=[cos,sin,0,0, -sin,cos,0,0, 0,0,1,0, 0,0,0,1];
 const box=rawRoiBounds(M,BOUNDS);
 const attenduXY=(BOUNDS[0]+BOUNDS[1])/Math.SQRT2;
 for(const axe of [0,1]){
  assert.ok(Math.abs(box.hi[axe]-attenduXY)<1e-9,
    `axe ${axe} : demi-étendue ${box.hi[axe]}, attendue ${attenduXY}`);
 }
 assert.ok(Math.abs(box.hi[2]-BOUNDS[2])<1e-9,'l’axe non tourné garde son étendue');
});

test('sans rotation ni échelle, la boîte est exactement la ROI',()=>{
 const box=rawRoiBounds(C.identity(),BOUNDS);
 for(let axe=0;axe<3;axe++){
  assert.ok(Math.abs(box.lo[axe]+BOUNDS[axe])<1e-12);
  assert.ok(Math.abs(box.hi[axe]-BOUNDS[axe])<1e-12);
 }
});

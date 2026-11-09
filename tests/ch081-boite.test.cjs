'use strict';
/* CH-081 (D-311) — ZONE DU PRÉCHAUFFAGE : boîte de découpe d'ESV de la coupe suivante, module de page `src/prechauffage-boite.js`.
 * Essais purs (Node), géométrie synthétique. Ils prouvent :
 *  - la boîte suit les rails : centre au milieu, axe travers sur les rails, axe long dans la voie, vertical ; 4 × 0,5 × 2 m par défaut (mesure du corpus) ;
 *  - le test d'intersection est celui de Potree 1.8 À L'IDENTIQUE (plans construits comme `Potree_update_visibility.js` depuis la boîte unité
 *    transformée, puis `THREE.Frustum.intersectsBox`), sur 20 000 cas tirés au hasard et pour une voie de cap quelconque ;
 *  - elle prend les nœuds de côté (jusqu'à 2 m du milieu) et du haut que le cube de 0,75 m manque, et laisse ceux de l'avant que le cube prend ;
 *  - la calibration lit les dimensions sur la boîte de Potree de la coupe courante seulement si elle est centrée et alignée ;
 *  - rails absents, confondus ou trop écartés : aucune zone. Données synthétiques. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const B=require('../src/prechauffage-boite.js');

/* ---- référence : Potree 1.8, Potree_update_visibility.js (boîte de découpe) + THREE.Frustum.intersectsBox, recopiés en clair */
const app=(m,p)=>[0,1,2].map(i=>m[i]*p[0]+m[4+i]*p[1]+m[8+i]*p[2]+m[12+i]);
function plansPotree(M){const P=v=>app(M,v),sub=(a,b)=>a.map((x,i)=>x-b[i]),nrm=v=>{const l=Math.hypot(...v);return v.map(x=>x/l);};
 const pl=(n,q)=>[...n,-(n[0]*q[0]+n[1]*q[1]+n[2]*q[2])],out=[];
 for(const ax of [0,1,2]){const e=[0,0,0];e[ax]=.5;const px=P(e),nx=P(e.map(x=>-x)),n=nrm(sub(nx,px));out.push(pl(n,px),pl(n.map(x=>-x),nx));}return out;}
const intersectsBox=(pl,[lo,hi])=>pl.every(([x,y,z,w])=>(x>0?hi[0]:lo[0])*x+(y>0?hi[1]:lo[1])*y+(z>0?hi[2]:lo[2])*z+w>=0);
/* matrice monde de la boîte unité d'ESV pour des rails L, R (dims : travers, long, haut) */
function matriceEsv(L,R,{travers=4,long=.5,haut=2}={}){const dx=R[0]-L[0],dy=R[1]-L[1],l=Math.hypot(dx,dy),u=[dx/l,dy/l,0],t=[-u[1],u[0],0],c=[0,1,2].map(i=>(L[i]+R[i])/2);
 return [u[0]*travers,u[1]*travers,0,0, t[0]*long,t[1]*long,0,0, 0,0,haut,0, c[0],c[1],c[2],1];}
const voie=(cap,x0=844000,y0=6519000,z=172)=>{const u=[Math.cos(cap),Math.sin(cap)];return {L:[x0,y0,z],R:[x0+1.435*u[0],y0+1.435*u[1],z+.01]};};
let graine=7;const alea=()=>(graine=(graine*1103515245+12345)%2147483648)/2147483648;

test('boîte : centre au milieu des rails, axes travers / long / vertical, 4 × 0,5 × 2 m par défaut',()=>{
 assert.deepEqual({...B.DIMS_ESV},{travers:4,long:.5,haut:2});
 const {L,R}=voie(0),b=B.boiteCoupe(L,R);
 assert.ok(Math.abs(b.centre[0]-(L[0]+.7175))<1e-9&&Math.abs(b.centre[1]-L[1])<1e-9&&Math.abs(b.centre[2]-(L[2]+.005))<1e-9);
 assert.deepEqual(b.axes[0],[1,0,0]);assert.deepEqual(b.axes[2],[0,0,1]);assert.deepEqual(b.demi,[2,.25,1]);
 assert.equal(b.plans.length,6);
 assert.deepEqual({...B.dimensions({travers:3,long:99,haut:'x'})},{travers:3,long:.5,haut:2},'hors bornes : la mesure');
});

test('intersection identique à Potree 1.8 (plans de la boîte unité + THREE.Frustum.intersectsBox) : 20 000 cas, caps quelconques',()=>{
 let n=0,dedans=0;
 for(let i=0;i<20000;i++){const cap=alea()*2*Math.PI,{L,R}=voie(cap,844000+alea()*50,6519000+alea()*50),b=B.boiteCoupe(L,R),ref=plansPotree(matriceEsv(L,R));
  const s=[.1,.5,1.9,3.7,7.4][Math.floor(alea()*5)],c=[0,1,2].map(k=>b.centre[k]+(alea()-.5)*(k===2?4:8)),lo=c.map(v=>v-s*alea()),hi=lo.map(v=>v+s),bm=[lo,hi];
  const a=B.coupeBoite(b,bm),r=intersectsBox(ref,bm);assert.equal(a,r,`cas ${i}`);n++;if(a)dedans++;}
 assert.equal(n,20000);assert.ok(dedans>2000&&dedans<18000,'cas des deux côtés : '+dedans);
});

test('nœuds de côté et du haut pris, nœud de l\'avant laissé : là où le cube de 0,75 m se trompe',()=>{
 const {L,R}=voie(0,0,0,0),z=B.zone(L,R),cube=(bm,r=.75)=>[L,R].some(p=>[0,1,2].every(i=>bm[0][i]<=p[i]+r&&bm[1][i]>=p[i]-r));
 const cote=[[2.4,-.1,-.1],[2.6,.1,.1]],   /* à 1,7 m du rail droit, dans la boîte (travers ±2 m autour du milieu 0,7175) */
  haut=[[.5,-.1,.85],[.7,.1,.95]],          /* 0,9 m au-dessus des rails */
  avant=[[0,.4,0],[.2,.6,0]];               /* 0,4 m devant : hors de la boîte (±0,25 m en long) */
 assert.equal(z.coupe(cote),true);assert.equal(cube(cote),false);
 assert.equal(z.coupe(haut),true);assert.equal(cube(haut),false);
 assert.equal(z.coupe(avant),false);assert.equal(cube(avant),true);
 assert.equal(z.distance([[0,-.05,-.05],[.1,.05,.05]]),.6175);assert.equal(z.distance([[.6,-.1,-.1],[.8,.1,.1]]),0);
});

test('calibration sur la boîte de Potree de la coupe courante : dimensions lues si centrée et alignée, sinon null',()=>{
 const {L,R}=voie(1.1);
 assert.deepEqual(Object.fromEntries(Object.entries(B.calibrer(matriceEsv(L,R,{travers:3.5,long:.6,haut:2.2}),L,R)).map(([k,v])=>[k,+v.toFixed(9)])),{travers:3.5,long:.6,haut:2.2});
 assert.ok(B.calibrer(new Float64Array(matriceEsv(L,R)),L,R),'Float64Array accepté');
 const decale=matriceEsv(L,R);decale[12]+=.2;assert.equal(B.calibrer(decale,L,R),null,'centre à 20 cm : refusée');
 const {L:L2,R:R2}=voie(1.3);assert.equal(B.calibrer(matriceEsv(L2,R2),L,R),null,'tournée de 11° : refusée');
 assert.equal(B.calibrer(null,L,R),null);assert.equal(B.calibrer([1,2,3],L,R),null);
 const geante=matriceEsv(L,R,{travers:50});assert.equal(B.calibrer(geante,L,R),null,'hors bornes : refusée');
});

test('rails absents, confondus, trop écartés ou non finis : aucune zone',()=>{
 assert.equal(B.zone(null,[0,0,0]),null);assert.equal(B.zone([0,0,0],[0,0,0]),null);
 assert.equal(B.zone([0,0,0],[3.5,0,0]),null);assert.equal(B.zone([0,0,0],[NaN,1,0]),null);
 assert.equal(B.coupeBoite(null,[[0,0,0],[1,1,1]]),false);
 assert.ok(Object.isFrozen(B.zone([0,0,0],[1.435,0,0])));
});

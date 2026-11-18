'use strict';
/* CH-070 : parité de voisins (src/esv-observer.js, table observée) contre ariane-session::observateur (296). Tables
 * RÉELLES : instantanés de la liste d'ESV de banane-data (ariane-liste-partie*.json), décompactés (src/liste-memoire.js)
 * puis remis en lignes d'ESV et chargés par newTable/addRows du module ; demandes tirées à graine fixe autour des
 * lignes (bords bruités), demandes invalides, tables vides. */
const E=require('../../src/esv-observer.js'),LM=require('../../src/liste-memoire.js'),F=require('../coquille/facade-session.js'),{graine}=require('./session-commun.cjs');
const corpus=()=>{try{return require('../../tools/ch064-corpus.cjs');}catch{return null;}};
let facade=null;const fa=coeur=>{if(!facade||facade.coeur!==coeur)facade={coeur,O:F.observateur(coeur,E)};return facade.O;};
const NOMS=['valid','invalid','skipped','autre'],EDGES=['XLeftEdge','YLeftEdge','ZLeftEdge','XRightEdge','YRightEdge','ZRightEdge'];
function table(snap){const d=LM.decompacter(snap);if(!d)return null;const t=E.newTable(true),rows=[];
 for(let i=0;i<d.n;i++){const o={RowKey:'r'+i,ExtractionStatus:NOMS[d.st[i]],TreatedByOperator:!!(d.fl[i]&1),SeenByOperator:!!(d.fl[i]&2)};
  EDGES.forEach((k,j)=>{const v=d.ed[6*i+j];if(v!==null)o[k]=v/1e4;});rows.push(o);}
 E.addRows(t,rows);t.pages=1;return t;}
function* listes(max){const C=corpus();if(!C)return;const vus=new Set();let n=0;
 for(const z of C.zips())for(const e of C.entrees(z)){if(n>=max||!/ariane-liste-partie/.test(e)||vus.has(e))continue;vus.add(e);
  let j;try{j=JSON.parse(require('node:child_process').execFileSync('unzip',['-p',z,e],{maxBuffer:2**31-1,encoding:'utf8'}));}catch{continue;}
  const t=table(j);if(t){n++;yield [t,j];}}}
/* Les tables ne passent pas par la VBA de l'entrée du banc (Map) : l'entrée est {k, req}, la table est retrouvée ici. */
const TABLES=new Map();
module.exports={nom:'session-observateur',description:'src/esv-observer.js : voisins (table observée)',sources:['src/esv-observer.js'],
 *cas({max=Infinity}={}){let k=0;TABLES.set('vide',new Map());
  for(const [t,snap] of listes(Math.min(max,12))){const nom='liste-'+(k++),r=graine(5000+k);TABLES.set(nom,new Map([['T'+k,t]]));let premier=true;
   for(let q=0;q<200;q++){const i=Math.floor(r()*t.rk.length),o=6*i,b=j=>t.ed[o+j]+(r()-.5)*0.02;
    const req={cut:Math.max(0,i+Math.floor((r()-.5)*6)),fenetre:1+Math.floor(r()*10),world:{left:[b(0),b(1),b(2)],right:[b(3),b(4),b(5)]}};
    yield {id:nom+'-'+q,entree:premier?{k:nom,cle:'T'+k,req,snap}:{k:nom,cle:'T'+k,req}};premier=false;}
   for(const req of [null,{cut:-1,fenetre:2,world:{left:[0,0,0],right:[0,0,0]}},{cut:1,fenetre:11,world:{left:[0,0,0],right:[0,0,0]}},{cut:1,fenetre:1,world:{left:[0,0],right:[0,0,0]}},{cut:t.rk.length+5,fenetre:3,world:{left:[0,0,0],right:[0,0,0]}}])
    yield {id:nom+'-invalide-'+JSON.stringify(req).length,entree:{k:nom,cle:'T'+k,req}};}
  yield {id:'vide',entree:{k:'vide',req:{cut:1,fenetre:1,world:{left:[0,0,0],right:[0,0,0]}}}};},
 js(e){return E.voisins(TABLES.get(e.k),structuredClone(e.req));},
 rs(e,coeur){return fa(coeur).voisins(TABLES.get(e.k),structuredClone(e.req));},
 bilan:()=>facade?facade.O.compteurs():null,
 /* Chromium : la page reconstruit chaque table à partir de l'instantané porté par le premier cas qui la cite */
 navigateur:{scripts:['src/liste-memoire.js',{chemin:'src/esv-observer.js',global:'BananeEsvObserver'},'ariane-rs/coquille/vba.js','ariane-rs/coquille/coeur.js','ariane-rs/coquille/facade-session.js'],
  preparer:`coeur=>{const E=BananeEsvObserver,LM=BananeListeMemoire,N=['valid','invalid','skipped','autre'],ED=['XLeftEdge','YLeftEdge','ZLeftEdge','XRightEdge','YRightEdge','ZRightEdge'];
   const T=new Map([['vide',new Map()]]),construire=s=>{const d=LM.decompacter(s),t=E.newTable(true),rows=[];for(let i=0;i<d.n;i++){const o={RowKey:'r'+i,ExtractionStatus:N[d.st[i]],TreatedByOperator:!!(d.fl[i]&1),SeenByOperator:!!(d.fl[i]&2)};ED.forEach((k,j)=>{const v=d.ed[6*i+j];if(v!==null)o[k]=v/1e4;});rows.push(o);}E.addRows(t,rows);t.pages=1;return t;};
   return {E,O:ArianeFacadeSession.observateur(coeur,E),T,table:e=>{if(e.snap&&!T.has(e.k))T.set(e.k,new Map([[e.cle,construire(e.snap)]]));return T.get(e.k);}};}`,
  js:'(e,t)=>t.E.voisins(t.table(e),structuredClone(e.req))',rs:'(e,t)=>t.O.voisins(t.table(e),structuredClone(e.req))',bilan:'t=>t.O.compteurs()'}};

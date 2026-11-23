(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory();
  else root.BananeRelectureFiltreListe=factory();
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 /* CH-152 (D-380) — PRÉ-FILTRE GÉOMÉTRIQUE DE LA RELECTURE SUR LA LISTE D'ESV.
  * Module pur : aucune capture, navigation, requête ou écriture. La table est celle de src/liste-memoire.js, décompactée : statut 0 = valid,
  * six bords monde par ligne, gauche X Y Z puis droit X Y Z, en dixièmes de millimètre. Seule une ligne valide, encadrée de lignes valides
  * et localement lisse peut être écartée des visites 3D. Toutes les gardes métier restent dans filtrerSelection : un doute laisse le cut à relire. */
 const DEFAULTS=Object.freeze({actif:true,flecheMaxMm:3.5,ecartementMaxMm:6.0,voisinsFenetre:4,voisinsMinParCote:1,margeDiffereCuts:2,zonesExclues:Object.freeze(['pn','adv'])});
 const r1=v=>Number.isFinite(v)?Math.round(v*10)/10+0:null;
 const entier=v=>Number.isInteger(v)&&v>=0;
 const tableau=v=>Array.isArray(v)||typeof ArrayBuffer!=='undefined'&&ArrayBuffer.isView(v);
 const nombre=(v,d,min=0)=>Number.isFinite(v)&&v>=min?v:d;
 const entierOu=(v,d,min=0)=>Number.isInteger(v)&&v>=min?v:d;
 function cfgDe(options){const o=options&&typeof options==='object'?options:{};
  return {actif:o.actif!==false,flecheMaxMm:nombre(o.flecheMaxMm,DEFAULTS.flecheMaxMm),ecartementMaxMm:nombre(o.ecartementMaxMm,DEFAULTS.ecartementMaxMm),
   voisinsFenetre:entierOu(o.voisinsFenetre,DEFAULTS.voisinsFenetre,1),voisinsMinParCote:entierOu(o.voisinsMinParCote,DEFAULTS.voisinsMinParCote,1),
   margeDiffereCuts:entierOu(o.margeDiffereCuts,DEFAULTS.margeDiffereCuts),zonesExclues:Array.isArray(o.zonesExclues)?o.zonesExclues.filter(z=>typeof z==='string'):DEFAULTS.zonesExclues,
   tempsParCutS:nombre(o.tempsParCutS,3),tempsTraverseS:nombre(o.tempsTraverseS,1)};}
 function bords(table,i){if(!table||!entier(table.n)||!entier(i)||i>=table.n||!tableau(table.st)||!tableau(table.ed)||table.st[i]!==0)return null;
  const e=table.ed.slice(6*i,6*i+6);return e.length===6&&e.every(Number.isFinite)?e:null;}
 const point=(e,o)=>[e[o],e[o+1],e[o+2]];
 const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]);
 const ecartement=e=>distance(point(e,0),point(e,3))/10;   // dixièmes de mm → mm
 function mediane(valeurs){const v=valeurs.filter(Number.isFinite).slice().sort((a,b)=>a-b);if(!v.length)return null;const m=v.length>>1;return v.length%2?v[m]:(v[m-1]+v[m])/2;}

 /* Une ligne est lisse si chacun de ses bords est près de l'interpolation des bords valides les plus proches avant et après, et si son
  * écartement reste près de celui des voisins. L'interpolation par indice de coupe évite toute projection ambiguë sur une corde dégénérée. */
 function evaluerCut({table,cut,referenceEcartementMm=null,options={}}={}){
  const cfg=cfgDe(options),e=bords(table,cut);if(!e)return {lisse:false,raison:'ligne-non-valide'};
  const avant=[],apres=[],voisins=[];
  for(let j=Math.max(0,cut-cfg.voisinsFenetre);j<=Math.min(table.n-1,cut+cfg.voisinsFenetre);j++){
   if(j===cut)continue;const b=bords(table,j);if(!b)continue;voisins.push({j,e:b});if(j<cut)avant.push(j);else apres.push(j);}
  if(avant.length<cfg.voisinsMinParCote||apres.length<cfg.voisinsMinParCote)return {lisse:false,raison:'sans-encadrement'};
  const jAv=avant.at(-1),jAp=apres[0],a=bords(table,jAv),z=bords(table,jAp),t=(cut-jAv)/(jAp-jAv);let flecheMm=0;
  for(const o of [0,3]){const p=point(a,o),q=point(z,o),actuel=point(e,o),interpole=[0,1,2].map(k=>p[k]+t*(q[k]-p[k]));flecheMm=Math.max(flecheMm,distance(actuel,interpole)/10);}
  const g=ecartement(e),ref=Number.isFinite(referenceEcartementMm)?referenceEcartementMm:mediane(voisins.map(v=>ecartement(v.e))),ecartRefMm=Math.abs(g-ref);
  const lisse=flecheMm<=cfg.flecheMaxMm&&ecartRefMm<=cfg.ecartementMaxMm;
  return {lisse,flecheMm:r1(flecheMm),ecartementMm:r1(g),ecartRefMm:r1(ecartRefMm),voisins:[jAv,jAp],raison:lisse?'lisse':flecheMm>cfg.flecheMaxMm?'fleche':'ecartement'};
 }

 /* Numéros simples, objets d'événement, ou plages déjà marginées : toutes les formes acceptées par la sélection sont protégées telles quelles. */
 function ajouterCuts(x,out,table,profondeur=0,paireRacinePlage=false){
  if(profondeur>8||x==null)return;if(entier(x)){out.add(x);return;}
  const max=entier(table?.n)?table.n-1:20000;
  const plage=(a,z)=>{if(!entier(a)||!entier(z))return;const d=Math.max(0,Math.min(a,z)),f=Math.min(max,Math.max(a,z));for(let c=d;c<=f;c++)out.add(c);};
  if(x instanceof Set){for(const v of x)ajouterCuts(v,out,table,profondeur+1);return;}
  if(Array.isArray(x)){if(x.length===2&&x.every(entier)&&(profondeur>0||paireRacinePlage))plage(x[0],x[1]);else for(const v of x)ajouterCuts(v,out,table,profondeur+1);return;}
  if(typeof x!=='object')return;
  if(entier(x.cut)){out.add(x.cut);return;}if(entier(x.i)){out.add(x.i);return;}
  if(entier(x.debut)&&entier(x.fin)){plage(x.debut,x.fin);return;}
  for(const k of ['identity','controle','cuts','alertes','zones'])if(x[k]!==undefined)ajouterCuts(x[k],out,table,profondeur+1);
 }

 /* Filtre une sélection déjà plafonnée. Sans table, ou coupé, l'objet d'origine est rendu tel quel : aucune clé ajoutée, aucune valeur changée. */
 function filtrerSelection(sel,{table,differes=[],alertesGardeVoie=[],aControler=[],options={}}={}){
  if(!sel||!Array.isArray(sel.cuts)||!table||options?.actif===false)return sel;const cfg=cfgDe(options);if(!cfg.actif)return sel;
  const diff=new Set(),alertes=new Set(),controle=new Set();
  ajouterCuts(differes,diff,table);ajouterCuts(alertesGardeVoie,alertes,table);ajouterCuts(aControler,controle,table,0,true);
  for(const c of sel.cuts)if(c.role==='differe')diff.add(c.cut);
  const cuts=[],filtresListe=[];
  for(const c of sel.cuts){
   const protege=c.role!=='vert'||cfg.zonesExclues.includes(c.zone)||c.zone==='ecartement'||alertes.has(c.cut)||controle.has(c.cut)||[...diff].some(d=>Math.abs(c.cut-d)<=cfg.margeDiffereCuts);
   if(protege||!['adv','abords'].includes(c.zone)){cuts.push(c);continue;}
   const r=evaluerCut({table,cut:c.cut,options:cfg});if(!r.lisse){cuts.push(c);continue;}
   filtresListe.push({cut:c.cut,zone:c.zone,flecheMm:r.flecheMm,ecartRefMm:r.ecartRefMm,voisins:r.voisins});
  }
  const relus=new Map();for(const c of cuts)relus.set(c.plage,(relus.get(c.plage)||0)+1);
  const indices=new Map(),plages=[];
  for(const [i,p] of (Array.isArray(sel.plages)?sel.plages:[]).entries()){
   const n=relus.get(i)||0;if(!n)continue;indices.set(i,plages.length);plages.push({...p,relus:n});}
  const gardes=cuts.map(c=>indices.has(c.plage)?{...c,plage:indices.get(c.plage)}:c);
  const traverses=Array.isArray(sel.plages)?plages.reduce((n,p)=>n+(Array.isArray(p.traverses)?p.traverses.length:0),0):sel.traverses||0;
  const noms=['pn','adv','abords','vert-hors-zone','ecartement',...Object.keys(sel.parZone||{})],parZone={};
  for(const z of new Set(noms))parZone[z]=gardes.filter(c=>c.zone===z).length;
  return {...sel,total:gardes.length,traverses,parZone,tempsEstimeS:Math.round(gardes.length*cfg.tempsParCutS+traverses*cfg.tempsTraverseS),plages,cuts:gardes,filtresListe};
 }
 return {DEFAULTS,evaluerCut,filtrerSelection};
});

'use strict';
/* CH-074 (J5) : cas DÉRIVÉS de gcv2-l1 pour le banc de parité de la décision (tools/ch064-d-cas.cjs).
 * Les essais du tronc appellent surtout `deciderDiffere`, `deciderL1e` et `resumer` ; les fonctions qu'elles enchaînent
 * (hypothesesDuCut, casDuDiffere, accords, brut, coder, probas, meilleurePaire, voieGeometrique, voieAbsolue…) ne sont
 * pas appelées en direct. Ici, pour chaque appel `deciderDiffere` relevé dans les essais (fixtures, ariane-rs/dist/), le JS
 * du tronc est rejoué sous les leviers relevés, et ses entrées intermédiaires deviennent des appels directs de ces fonctions.
 * Seules les ENTRÉES viennent du JS ; les deux côtés du banc recalculent la sortie. Rien n'est écrit. */
const fs=require('node:fs'),path=require('node:path'),v8=require('node:v8');
const RACINE=path.resolve(__dirname,'..');
const FIXTURES=path.join(RACINE,'ariane-rs','dist','ch064-d-fixtures.v8');
const SIDES=['left','right'];
const clone=v=>v8.deserialize(v8.serialize(v));
function*cas(){
 if(!fs.existsSync(FIXTURES))return;
 const L1=require(path.join(RACINE,'src/gcv2-l1.js'));
 let i=0;
 for(const e of v8.deserialize(fs.readFileSync(FIXTURES))){
  if(e.module!=='gcv2L1'||e.f!=='deciderDiffere')continue;
  const leviers=e.leviers?v8.deserialize(e.leviers):null;
  const x=v8.deserialize(e.args)[0];
  if(!x||!x.capture||!x.modele)continue;
  if(leviers)L1.reglerLeviers(leviers);
  const out=[];
  try{
   const r=L1.deciderDiffere(clone(x));
   const {capture,science}=x,cut=capture.identity.cut,mod=x.modele,lv=leviers?{leviers}:{};
   const c=(f,...args)=>out.push({id:'derive-'+f+'-'+(i++),module:'gcv2L1',f,args:clone(args),...lv});
   const vs=(x.voisins||[]).filter(v=>v&&v.identity&&v.positions&&v.rails).map(v=>({identity:{part:v.identity.part,cut:v.identity.cut,frameId:v.identity.frameId??null},
     positions:{left:v.positions.left.slice(),right:v.positions.right.slice()},stage:'verifie',source:'lot',decalage:L1.decalageDepuisDepart(v.rails,v.positions)}));
   c('variante',capture,science,[],x.options);
   c('variante',capture,science,x.appuis||[],x.options);
   for(const v of x.voisins||[])if(v&&v.rails&&v.positions){c('decalageDepuisDepart',v.rails,v.positions);for(const s of SIDES)c('decalage',v.rails[s],v.positions[s]);}
   c('decalagesH6',capture.identity,vs);
   const seul=L1.variante(capture,science,[],x.options),chaine=L1.variante(capture,science,(x.appuis||[]).slice(),x.options);
   c('hypothesesDuCut',{capture,science,seul,chaine,appuisAvant:(x.appuis||[]).slice(),voisins:vs,gMed:r.gMed,voisinsLot:vs,departEsv:null});
   c('hypothesesDuCut',{capture,science,seul,voisins:vs,gMed:r.gMed});
   c('casDuDiffere',{cut,zone:x.zone,hyp:r.hyp,gMed:r.gMed,voieRef:r.cas.voieRef});
   for(const s of SIDES){
    c('accords',r.hyp.rails[s]);
    const hs=r.cas.rails[s].hyps;
    for(const h of hs.slice(0,4)){c('coder',mod.fit,h.x);c('probas',mod,h.x);}
    const h0=r.hyp.rails[s][0];if(h0)c('brut',h0,r.hyp.rail[s],{zone:x.zone,role:'differe'},{nProches5:1,nOrigines:1});
    c('soutienRail',capture,s,[0,0,0]);
    for(const h of hs.slice(0,3)){c('soutienRail',capture,s,h.decal);}
   }
   c('meilleurePaire',r.cas,r.decision.probas,L1.REGLE);
   c('meilleurePaire',r.cas,r.decision.probas);
   c('deciderL1',r.cas,mod);
   c('deciderL1',r.cas,mod,L1.REGLE_V);
   c('deciderL1',r.cas,mod,L1.REGLE,r.decision.probas);
   c('deciderL1e',r.cas,mod,x.reference,capture);
   c('deciderL1e',r.cas,mod,null,capture);
   const hl=r.cas.rails.left.hyps,hr=r.cas.rails.right.hyps;
   if(hl.length&&hr.length){
    c('ecartementPaire',r.cas,hl[0],hr[hr.length-1]);
    const decal={left:hl[hl.length-1].decal,right:hr[0].decal};
    c('ecartementDecal',capture,decal);
    c('ordreRails',capture,decal);c('ordreRails',capture,decal,{left:0.2,right:0.7});
    const ref=x.reference&&Number.isFinite(x.reference.mm)?x.reference.mm:1435;
    for(const s of SIDES)c('ramenerRail',capture,decal,s,ref);
    c('corrigerDecal',{capture,decal,ref,ordre:['left','right']});
    c('corrigerDecal',{capture,decal,ref:ref+20,ordre:['right','left']});
    c('corrigerPoseChaine',capture,decal,x.reference||{mm:ref});
    c('positionsDe',capture,{left:{decal:decal.left},right:{decal:decal.right}});
    c('contreChaine',r,decal,5);
    c('ecartAVoie',capture,cut,r.cas.voisinsAbs,decal);
   }
   c('voieGeometrique',capture,(x.voisins||[]).concat(x.voisinsTransport||[]),cut,6);
   c('voieAbsolue',capture,cut,r.cas.voisinsAbs);
   c('voieAbsolue',capture,cut,r.cas.voisinsAbs,6,3,{parCutMm:40,baseMm:15});
   c('rechercheRecentree',capture,{left:[0,0],right:[3,-2]});
   c('resumer',r);
   /* voieDeListe : instantané SYNTHÉTIQUE de la liste d'ESV (aucune donnée réelle), rails le long de la voie autour de la pose de départ,
    * en 1e-4 m, translatés d'un repère monde fixe ; quelques lignes non valides ou touchées. */
   if(Number.isInteger(cut)&&cut>=0&&cut<1e5){
    const L=capture.rails.left.positionSceneRelative,R=capture.rails.right.positionSceneRelative;
    for(const [dx,bruit] of [[0,0],[1234.5,0.0004],[0,0.01]]){
     const n=cut+12,ed=[],st=[],fl=[];
     for(let j=0;j<n;j++){const d=(j-cut)*0.7;
      ed.push(...[L[0]+dx+d,L[1]+0.3*d,L[2]].map(v=>Math.round(v*1e4)),...[R[0]+dx+d,R[1]+0.3*d+bruit*(j%3),R[2]+0.0001*(j%2)].map(v=>Math.round(v*1e4)));
      st.push(j%5===2?1:0);fl.push(j%7===3?1:0);}
     c('voieDeListe',{n,ed,st,fl},cut,capture);
    }
    c('voieDeListe',{n:cut+1,ed:[],st:[],fl:[]},cut,capture);
   }
   for(const tr of ['log','log10','abs','bool','id'])for(const v of [0,-0,1.5,-3,1e-15,true,null,NaN,'a'])c('transfo',tr,v);
  }catch{/* entrée que le JS refuse : aucun cas dérivé */}
  finally{if(leviers)L1.reglerLeviers(null);}
  yield* out;
 }
}
module.exports={cas};

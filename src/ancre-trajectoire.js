/* Ariane 5.0 (CH-124, D-352) — ANCRE DE TRAJECTOIRE : l'axe de la voie relevée, lu dans la liste d'ESV de la partie.
 *
 * Chaque coupe d'ESV est un plan vertical perpendiculaire à la trajectoire du véhicule de mesure ; les deux bords d'une ligne de la liste sont
 * dans le plan de sa coupe, quels que soient les rails visés. Le véhicule roule sur la voie relevée : sa trajectoire, puis l'axe de cette voie,
 * se déduisent donc de la liste seule, sans aucune pose d'Ariane ni de l'opérateur (chantiers/CH-124/rapport.md) :
 *  1. TRAJECTOIRE : son travers se chemine de plan en plan (le pas va le long de la moyenne des deux normales, jusqu'au plan suivant) ; mesuré : le
 *     cheminement parti d'une pose par défaut d'ESV (extraction échouée, écartement 1 500,0 mm, centrée sur la trajectoire) retombe sur la pose par
 *     défaut suivante à 0,3 mm en médiane, jusqu'à 200 m ;
 *  2. AXE DE LA VOIE : modèle cinématique à deux pivots sur l'axe de la voie, distants de `w`, le point de référence de la trajectoire en
 *     porte-à-faux de `a` au-delà du pivot proche, du côté `sens` (±1, sens des numéros de cut, choisi par partie au plus petit coût). Petits angles,
 *     s0 = abscisse du point de référence, τ_s0(d) = écart en travers de la trajectoire en s0+d à sa tangente en s0, o(s) = écart de l'axe à la
 *     trajectoire :   o(s0 + sens·a) = g·[τ_s0(sens·(a+w)) + o(s0 + sens·(a+w))] − τ_s0(sens·a),  g = a/(a+w) ;
 *  3. CONSTANTE en travers (montage, origine du cheminement) : médiane du résidu des lignes de VOIE COURANTE INTACTES (statut valide, aucun
 *     drapeau, écartement plausible) dans une fenêtre de cuts autour du cut.
 * L'ancre SE TAIT (rend `{muet}`) quand elle n'est pas établie : ligne absente, bout de liste, pas de voie courante, sens non établi avec une forte
 * correction, pose de départ de la capture qui ne se cale pas sur la ligne du cut.
 * Module pur, sans dépendance, commun au banc (tools/banc-differes.cjs) et au service worker (background.js). Rien ici ne commande ESV. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;else root.BananeAncreTrajectoire=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const VERSION='ancre-trajectoire-1';
 /* Réglage figé (chantiers/CH-124/reglage-fige.md). `thetaMm` : au-delà de cet écart en travers entre le milieu d'une pose et l'axe, la pose est refusée. */
 const REGLAGE=Object.freeze({thetaMm:75,a:4,w:14,pasM:0.25,ecartMinMm:1428,ecartMaxMm:1446,fenetres:Object.freeze([200,400,800,1600]),minLignes:30,margeM:2,
   sensRapportMin:1.10,sensFaibleMaxMm:20,rigideMaxMm:2,calageMaxMm:5,blocCout:400,plafondCoutMm:40,minLignesListe:100});
 const fini=v=>typeof v==='number'&&Number.isFinite(v);
 const reglage=r=>Object.freeze({...REGLAGE,...(r&&typeof r==='object'?r:{})});
 function mediane(v){const s=Array.from(v).sort((p,q)=>p-q),m=s.length>>1;return s.length?(s.length%2?s[m]:(s[m-1]+s[m])/2):null;}

 /* Lignes présentes d'une table décompactée (src/liste-memoire.js : n, st, fl, ed = six bords par ligne au dixième de mm, monde) : milieu, direction
  * gauche (du bord droit vers le bord gauche, en plan), normale du plan de coupe, écartement 3D. */
 function lignes(table){
   if(!table||!Number.isInteger(table.n)||!table.ed||!table.st||!table.fl)return null;
   const n=table.n,pos=new Int32Array(n).fill(-1),idx=[];
   for(let i=0;i<n;i++){let ok=true;for(let j=0;j<6;j++)if(!fini(table.ed[6*i+j])){ok=false;break;}
     if(!ok)continue;const dx=(table.ed[6*i]-table.ed[6*i+3])/1e4,dy=(table.ed[6*i+1]-table.ed[6*i+4])/1e4;if(!(Math.hypot(dx,dy)>0.5))continue;pos[i]=idx.length;idx.push(i);}
   const m=idx.length,Mx=new Float64Array(m),My=new Float64Array(m),ex=new Float64Array(m),ey=new Float64Array(m),ecart=new Float64Array(m),st=new Uint8Array(m),fl=new Uint8Array(m);
   for(let k=0;k<m;k++){const i=idx[k],e=table.ed,o=6*i,dx=(e[o]-e[o+3])/1e4,dy=(e[o+1]-e[o+4])/1e4,dz=(e[o+2]-e[o+5])/1e4,g=Math.hypot(dx,dy);
     Mx[k]=(e[o]+e[o+3])/2e4;My[k]=(e[o+1]+e[o+4])/2e4;ex[k]=dx/g;ey[k]=dy/g;ecart[k]=1000*Math.hypot(dx,dy,dz);st[k]=table.st[i]&3;fl[k]=table.fl[i]&7;}
   return {n,m,idx,pos,Mx,My,ex,ey,ecart,st,fl};
 }
 /* Série : abscisse cheminée s (m), cap θ de la normale (rad, déroulé), travers o0 (mm, vers la gauche) du milieu de chaque ligne par rapport à la
  * trajectoire cheminée depuis la première ligne (constante arbitraire). Normale n = (ey, −ex) : gauche × verticale. */
 function serie(Lg){
   const m=Lg.m,s=new Float64Array(m),th=new Float64Array(m),o0=new Float64Array(m);
   let l=0,cap=Math.atan2(-Lg.ex[0],Lg.ey[0]);th[0]=cap;
   for(let k=1;k<m;k++){
     const pnx=Lg.ey[k-1],pny=-Lg.ex[k-1],qnx=Lg.ey[k],qny=-Lg.ex[k];
     const Tx=Lg.Mx[k-1]+l*Lg.ex[k-1],Ty=Lg.My[k-1]+l*Lg.ey[k-1];
     let tx=pnx+qnx,ty=pny+qny;const nt=Math.hypot(tx,ty);tx/=nt;ty/=nt;
     const lam=((Lg.Mx[k]-Tx)*qnx+(Lg.My[k]-Ty)*qny)/(tx*qnx+ty*qny);
     l=(Tx+lam*tx-Lg.Mx[k])*Lg.ex[k]+(Ty+lam*ty-Lg.My[k])*Lg.ey[k];
     s[k]=s[k-1]+lam;const c=Math.atan2(qny,qnx);let d=c-cap;while(d>Math.PI)d-=2*Math.PI;while(d<-Math.PI)d+=2*Math.PI;th[k]=th[k-1]+d;cap=c;o0[k]=-1000*l;
   }
   return {s,th,o0};
 }
 /* Grille fine le long de la trajectoire : cap interpolé et sa primitive. */
 function grille(S,m,pas){
   const s0=S.s[0],g=Math.max(2,Math.floor((S.s[m-1]-s0)/pas)+1),th=new Float64Array(g),I=new Float64Array(g);let k=0;
   for(let j=0;j<g;j++){const x=s0+j*pas;while(k<m-2&&S.s[k+1]<x)k++;const u=(x-S.s[k])/((S.s[k+1]-S.s[k])||1);th[j]=S.th[k]+u*(S.th[k+1]-S.th[k]);}
   for(let j=1;j<g;j++)I[j]=I[j-1]+(th[j]+th[j-1])/2*pas;
   return {s0,g,th,I,pas};
 }
 /* Écart prédit de l'axe à la trajectoire (m), constante nulle, sur la grille fine. */
 function predire(G,a,w,sens){
   const gg=a/(a+w),na=Math.round(a/G.pas),nw=Math.round(w/G.pas),m=G.g,o=new Float64Array(m),th=G.th,I=G.I,pas=G.pas;
   const tau=(i0,j)=>(I[j]-I[i0])-th[i0]*(j-i0)*pas;
   if(sens>0){for(let i1=m-1;i1>=0;i1--){const i0=i1-na,iA=i1+nw;o[i1]=i0<0||iA>=m?0:gg*(tau(i0,iA)+o[iA])-tau(i0,i1);}}
   else{for(let i1=0;i1<m;i1++){const i0=i1+na,iA=i1-nw;o[i1]=i0>=m||iA<0?0:gg*(tau(i0,iA)+o[iA])-tau(i0,i1);}}
   return o;
 }
 function auxLignes(S,G,o,m){const out=new Float64Array(m);for(let k=0;k<m;k++){const x=(S.s[k]-G.s0)/G.pas,j=Math.min(G.g-2,Math.max(0,Math.floor(x))),u=x-j;out[k]=1000*(o[j]+u*(o[j+1]-o[j]));}return out;}
 /* Coût d'un sens : moyenne de min(|résidu recentré par bloc de cuts|, plafond) sur les lignes de voie courante. */
 function cout(S,plein,p,m,R){
   let somme=0,nb=0;
   for(let b=0;b<m;b+=R.blocCout){const v=[];for(let k=b;k<Math.min(m,b+R.blocCout);k++)if(plein[k])v.push(S.o0[k]-p[k]);if(v.length<10)continue;const c=mediane(v);for(const x of v){somme+=Math.min(Math.abs(x-c),R.plafondCoutMm);nb++;}}
   return nb?somme/nb:Infinity;
 }
 /* Modèle d'une partie, à calculer une fois par lot : { ok, … } ou { ok:false, raison }. `r` : réglage (défaut REGLAGE). */
 function preparer(table,r){
   const R=reglage(r),Lg=lignes(table);
   if(!Lg||Lg.m<R.minLignesListe)return {ok:false,raison:'liste',version:VERSION};
   const m=Lg.m,S=serie(Lg),bout=R.a+R.w+R.margeM,plein=new Uint8Array(m);let nPlein=0;
   for(let k=0;k<m;k++){plein[k]=Lg.st[k]===0&&Lg.fl[k]===0&&Lg.ecart[k]>R.ecartMinMm&&Lg.ecart[k]<R.ecartMaxMm&&S.s[k]-S.s[0]>=bout&&S.s[m-1]-S.s[k]>=bout?1:0;nPlein+=plein[k];}
   if(nPlein<R.minLignes)return {ok:false,raison:'voie-courante',version:VERSION};
   const G=grille(S,m,R.pasM),pP=auxLignes(S,G,predire(G,R.a,R.w,1),m),pM=auxLignes(S,G,predire(G,R.a,R.w,-1),m),cP=cout(S,plein,pP,m,R),cM=cout(S,plein,pM,m,R);
   if(!fini(cP)||!fini(cM))return {ok:false,raison:'voie-courante',version:VERSION};
   const sens=cP<=cM?1:-1,p=sens>0?pP:pM,res=new Float64Array(m);for(let k=0;k<m;k++)res[k]=S.o0[k]-p[k];
   return {ok:true,version:VERSION,R,Lg,S,m,plein,p,res,sens,rapportSens:Math.max(cP,cM)/Math.max(Math.min(cP,cM),1e-9),cout:Math.min(cP,cM),lignesPleines:nPlein,bout};
 }
 function constanteLocale(Mo,k){
   for(const W of Mo.R.fenetres){const v=[];for(let j=Math.max(0,k-W);j<=Math.min(Mo.m-1,k+W);j++)if(Mo.plein[j])v.push(Mo.res[j]);if(v.length>=Mo.R.minLignes)return {c:mediane(v),n:v.length,fenetre:W};}
   return null;
 }
 /* Axe de la voie au cut : { mm } = travers de l'axe par rapport au MILIEU DE LA LIGNE du cut (vers la gauche), ou { muet: motif }. */
 function axe(Mo,cut){
   if(!Mo||!Mo.ok)return {muet:Mo&&Mo.raison||'modele'};
   const k=Number.isInteger(cut)&&cut>=0&&cut<Mo.Lg.n?Mo.Lg.pos[cut]:-1;if(k<0)return {muet:'ligne-absente'};
   if(Mo.S.s[k]-Mo.S.s[0]<Mo.bout||Mo.S.s[Mo.m-1]-Mo.S.s[k]<Mo.bout)return {muet:'bout-de-liste'};
   if(Mo.rapportSens<Mo.R.sensRapportMin&&Math.abs(Mo.p[k])>Mo.R.sensFaibleMaxMm)return {muet:'sens'};
   const c=constanteLocale(Mo,k);if(!c)return {muet:'voie-courante'};
   return {mm:-(Mo.res[k]-c.c),cinematiqueMm:Mo.p[k],lignes:c.n,fenetre:c.fenetre};
 }
 /* État d'un lot : le modèle et le calage monde − scène (translation constante dans une séance), établi cut après cut sur la ligne de chaque cut. */
 function creer(table,r){return {modele:preparer(table,r),grappes:[],parCut:new Map()};}
 /* Calage d'un cut : translation monde − scène de chaque rail (ligne du cut − pose de départ de la capture) ; « rigide » si les deux rails donnent
  * la même à `rigideMaxMm` près. Noté une fois par cut ; les translations rigides sont regroupées (à `calageMaxMm`). */
 function noter(E,cut,capture){
   if(E.parCut.has(cut))return E.parCut.get(cut);
   const Mo=E.modele,out={rigide:false,T:null};E.parCut.set(cut,out);
   if(!Mo||!Mo.ok)return out;
   const k=Number.isInteger(cut)&&cut>=0&&cut<Mo.Lg.n?Mo.Lg.pos[cut]:-1,ra=capture&&capture.rails;
   const pL=ra&&ra.left&&ra.left.positionSceneRelative,pR=ra&&ra.right&&ra.right.positionSceneRelative;
   if(k<0||!Array.isArray(pL)||!Array.isArray(pR)||!pL.slice(0,3).every(fini)||!pR.slice(0,3).every(fini))return out;
   const e=E.table.ed,o=6*cut,TL=[0,1,2].map(i=>e[o+i]/1e4-pL[i]),TR=[0,1,2].map(i=>e[o+3+i]/1e4-pR[i]);
   if(1000*Math.hypot(TL[0]-TR[0],TL[1]-TR[1],TL[2]-TR[2])>Mo.R.rigideMaxMm)return out;
   out.rigide=true;out.T=[0,1,2].map(i=>(TL[i]+TR[i])/2);
   const g=E.grappes.find(x=>1000*Math.hypot(x.t[0]-out.T[0],x.t[1]-out.T[1],x.t[2]-out.T[2])<=Mo.R.calageMaxMm);
   if(g){g.t=g.t.map((v,i)=>(v*g.n+out.T[i])/(g.n+1));g.n++;}else E.grappes.push({t:out.T.slice(),n:1});
   return out;
 }
 /* Translation du lot : la grappe la plus fournie, si elle est seule en tête. */
 function translation(E){
   const g=E.grappes.slice().sort((x,y)=>y.n-x.n);
   return g.length&&(g.length===1||g[0].n>g[1].n)?g[0]:null;
 }
 /* Écart en travers (mm, signé, vers la gauche) entre le milieu d'une pose (`positions` : { left, right } en scène relative) et l'axe prédit.
  * Rend { ecartMm, axeMm, poseMm, … } ou { muet: motif }. */
 function ecartPose(E,cut,capture,positions){
   const Mo=E&&E.modele;if(!Mo||!Mo.ok)return {muet:Mo&&Mo.raison||'modele'};
   const ax=axe(Mo,cut);if(ax.muet)return ax;
   const c=noter(E,cut,capture);if(!c.rigide)return {muet:'calage-ligne'};
   const g=translation(E);if(!g||1000*Math.hypot(g.t[0]-c.T[0],g.t[1]-c.T[1],g.t[2]-c.T[2])>Mo.R.calageMaxMm)return {muet:'calage-lot'};
   const pL=positions&&positions.left,pR=positions&&positions.right;
   if(!Array.isArray(pL)||!Array.isArray(pR)||!pL.slice(0,3).every(fini)||!pR.slice(0,3).every(fini))return {muet:'pose'};
   const k=Mo.Lg.pos[cut],x=(pL[0]+pR[0])/2+c.T[0]-Mo.Lg.Mx[k],y=(pL[1]+pR[1])/2+c.T[1]-Mo.Lg.My[k],poseMm=1000*(x*Mo.Lg.ex[k]+y*Mo.Lg.ey[k]);
   return {ecartMm:poseMm-ax.mm,axeMm:ax.mm,poseMm,cinematiqueMm:ax.cinematiqueMm,lignes:ax.lignes,fenetre:ax.fenetre};
 }
 /* Le levier : { refus: true|false, ecartMm, axeMm, thetaMm } (arrondis), ou { muet }. */
 const r1=v=>fini(v)?Math.round(v*10)/10:null;
 function juger(E,cut,capture,positions){
   const x=ecartPose(E,cut,capture,positions);if(x.muet)return {muet:x.muet};
   const theta=E.modele.R.thetaMm;
   return {refus:Math.abs(x.ecartMm)>theta,ecartMm:r1(x.ecartMm),axeMm:r1(x.axeMm),cinematiqueMm:r1(x.cinematiqueMm),thetaMm:theta};
 }
 /* État complet d'un lot depuis la table décompactée de la liste (null sans table). */
 function etat(table,r){if(!table)return null;const E=creer(table,r);E.table=table;return E;}
 return {VERSION,REGLAGE,reglage,lignes,serie,grille,predire,preparer,axe,etat,noter,translation,ecartPose,juger};
});

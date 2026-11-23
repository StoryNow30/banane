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
   sensRapportMin:1.10,sensFaibleMaxMm:20,seuilCourbeSensMm:10,minLignesCourbe:20,maxFlecheVertMm:55,maxGauchissementMm:40,
   rigideMaxMm:2,calageMaxMm:5,blocCout:400,plafondCoutMm:40,minLignesListe:100,
   /* CH-154 (Lot C4, N+ à haute pureté) : reprise sur le pool restreint à l'axe avec seuil d'acceptation resserré à `thetaRepriseMm` (25 mm). */
   reprise:true,thetaRepriseMm:25});
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
 /* CH-156 (C5a) : coût évalué sur les seules lignes de voie courante en courbe (max(|pP|,|pM|) >= seuilCourbeSensMm),
  * évitant qu'une longue ligne droite (où pP ≈ pM ≈ 0) ne dilue `rapportSens` sous 1,10. */
 function coutCourbe(S,plein,pP,pM,m,R){
   let errP=0,errM=0,nb=0;const seuil=R.seuilCourbeSensMm??10;
   for(let b=0;b<m;b+=R.blocCout){
     const vP=[],vM=[];
     for(let k=b;k<Math.min(m,b+R.blocCout);k++)if(plein[k]){vP.push(S.o0[k]-pP[k]);vM.push(S.o0[k]-pM[k]);}
     if(vP.length<10)continue;
     const cP0=mediane(vP),cM0=mediane(vM);
     for(let k=b;k<Math.min(m,b+R.blocCout);k++){
       if(!plein[k]||Math.max(Math.abs(pP[k]),Math.abs(pM[k]))<seuil)continue;
       errP+=Math.min(Math.abs((S.o0[k]-pP[k])-cP0),R.plafondCoutMm);
       errM+=Math.min(Math.abs((S.o0[k]-pM[k])-cM0),R.plafondCoutMm);
       nb++;
     }
   }
   if(nb<(R.minLignesCourbe??20))return null;
   return {n:nb,sens:errP<=errM?1:-1,rapport:Math.max(errP,errM)/Math.max(Math.min(errP,errM),1e-9)};
 }
 /* CH-156 (C5a) : orientation optionnelle par `trajAzimuth` lorsqu'une table non compactée porte l'azimut de trajectoire. */
 function sensParAzimuth(table,Lg){
   const az=table&&table.trajAzimuth;
   if(!Array.isArray(az)&&!ArrayBuffer.isView(az))return null;
   if(az.length<table.n)return null;
   let deg=false;
   for(let k=0;k<Lg.m;k++){const v=az[Lg.idx[k]];if(fini(v)&&Math.abs(v)>2*Math.PI+0.1){deg=true;break;}}
   const evalConv=geo=>{
     let pos=0,neg=0,absSum=0,n=0;
     for(let k=0;k<Lg.m;k++){
       const raw=az[Lg.idx[k]];if(!fini(raw))continue;
       const rad=deg?raw*Math.PI/180:raw;
       const ux=geo?Math.sin(rad):Math.cos(rad),uy=geo?Math.cos(rad):Math.sin(rad);
       const nx=Lg.ey[k],ny=-Lg.ex[k],dot=ux*nx+uy*ny;
       absSum+=Math.abs(dot);n++;if(dot>0.5)pos++;else if(dot<-0.5)neg++;
     }
     if(n<20||absSum/n<0.85)return null;
     const maj=Math.max(pos,neg),accord=maj/n;
     if(accord<0.90)return null;
     return {sens:pos>=neg?1:-1,accord,rapport:accord/Math.max(1-accord,0.05)};
   };
   const a=evalConv(false),b=evalConv(true);
   if(a&&b)return a.accord>=b.accord?a:b;
   return a||b;
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
   const sensGlobal=cP<=cM?1:-1,rapportSensGlobal=Math.max(cP,cM)/Math.max(Math.min(cP,cM),1e-9);
   const courbe=coutCourbe(S,plein,pP,pM,m,R),az=sensParAzimuth(table,Lg);
   let sens=sensGlobal,rapportSens=rapportSensGlobal;
   if(courbe&&courbe.sens===sensGlobal&&courbe.rapport>rapportSens)rapportSens=courbe.rapport;
   if(az&&rapportSens<R.sensRapportMin){sens=az.sens;rapportSens=Math.max(rapportSens,az.rapport);}
   const p=sens>0?pP:pM,res=new Float64Array(m);for(let k=0;k<m;k++)res[k]=S.o0[k]-p[k];
   return {ok:true,version:VERSION,R,Lg,S,m,plein,p,res,sens,rapportSens,rapportSensGlobal,rapportSensCourbe:courbe?courbe.rapport:null,cout:Math.min(cP,cM),lignesPleines:nPlein,bout};
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
 /* CH-153 (Lot C1, D-380 / D-381) — GRAINE D'AXE (« gA ») : projette l'axe de la voie relevée en décalages [latMm, vertMm]
  * dans le repère profil de chaque rail de départ de la capture, à ±gRefMm/2 autour de l'axe. Se tait dès que l'ancre ou le calage est muet. */
 function projProfil(M,p){
   const [x,y,z]=p,w=M[3]*x+M[7]*y+M[11]*z+M[15];
   if(!fini(w)||Math.abs(w)<1e-15)return null;
   const out=[(M[0]*x+M[4]*y+M[8]*z+M[12])/w,(M[1]*x+M[5]*y+M[9]*z+M[13])/w,(M[2]*x+M[6]*y+M[10]*z+M[14])/w];
   return out.every(fini)?out:null;
 }
 function graineAxe(E,cut,capture,gRefMm=1437){
   const Mo=E&&E.modele;if(!Mo||!Mo.ok)return {muet:Mo&&Mo.raison||'modele'};
   const ax=axe(Mo,cut);if(ax.muet)return ax;
   const c=noter(E,cut,capture);if(!c.rigide)return {muet:'calage-ligne'};
   const g=translation(E);if(!g||1000*Math.hypot(g.t[0]-c.T[0],g.t[1]-c.T[1],g.t[2]-c.T[2])>Mo.R.calageMaxMm)return {muet:'calage-lot'};
   const ra=capture&&capture.rails;if(!ra||!ra.left||!ra.right)return {muet:'rails'};
   const k=Mo.Lg.pos[cut],demi=(fini(gRefMm)&&gRefMm>1000?gRefMm:1437)/2000;
   const Cx=Mo.Lg.Mx[k]+(ax.mm/1000)*Mo.Lg.ex[k],Cy=Mo.Lg.My[k]+(ax.mm/1000)*Mo.Lg.ey[k];
   const out={axeMm:r1(ax.mm),cinematiqueMm:r1(ax.cinematiqueMm),thetaMm:Mo.R.thetaMm};
   for(const [s,sg] of [['left',1],['right',-1]]){
     const M=ra[s].sceneRelativeToProfileLocal,p0=ra[s].positionSceneRelative;
     if(!Array.isArray(M)||M.length!==16||!Array.isArray(p0)||p0.length<3)return {muet:'rails'};
     const pCible=[Cx+sg*demi*Mo.Lg.ex[k]-c.T[0],Cy+sg*demi*Mo.Lg.ey[k]-c.T[1],p0[2]];
     const q=projProfil(M,pCible),o=projProfil(M,p0);
     if(!q||!o)return {muet:'projection'};
     out[s]=[r1(1000*(q[1]-o[1])),r1(1000*(q[2]-o[2]))];
   }
   return out;
 }
 /* CH-154 (N+) : jugement d'une pose d'un cut déjà noté (calage connu), sans sa capture (voisin ou appui du lot). */
 function jugerConnu(E,cut,positions){if(!E||!E.parCut||!E.parCut.has(cut))return {muet:'non-note'};return juger(E,cut,null,positions);}
 /* CH-154 (N+) : intervalle des décalages en travers [min, max] (mm, repère profil de chaque rail de départ) autour de l'axe ± demi-contrat ± θ. */
 function fenetres(E,cut,capture,contrat=[1420,1470]){
   const ra=capture&&capture.rails,pL=ra&&ra.left&&ra.left.positionSceneRelative,pR=ra&&ra.right&&ra.right.positionSceneRelative;
   if(!Array.isArray(pL)||!Array.isArray(pR))return {muet:'pose'};
   const x=ecartPose(E,cut,capture,{left:pL,right:pR});if(x.muet)return {muet:x.muet};
   const Mo=E.modele,k=Mo.Lg.pos[cut],ex=Mo.Lg.ex[k],ey=Mo.Lg.ey[k],th=Mo.R.thetaMm,centre=-x.ecartMm;
   const g0=1000*Math.abs((pL[0]-pR[0])*ex+(pL[1]-pR[1])*ey),lo=(contrat[0]-g0)/2,hi=(contrat[1]-g0)/2,out={centreMm:centre};
   for(const [s,a,b] of [['left',centre+lo-th,centre+hi+th],['right',centre-hi-th,centre-lo+th]]){
     const P=ra[s].profileLocalToSceneRelative,sg=Array.isArray(P)&&P.length===16&&fini(P[4])&&fini(P[5])?(P[4]*ex+P[5]*ey>=0?1:-1):1;
     out[s]=sg>0?[a,b]:[-b,-a];}
   return out;
 }
 /* CH-156 (C5b) — GARDE PURE DE COURBURE / FLÈCHE LONGITUDINALE SUR 5 COUPES :
  * Détecte une pose erronée en hauteur ou tordue qui reste proche de l'axe en travers (invisible au seul seuil θ = 75 mm),
  * en comparant ses coordonnées profil [lat, vert] à la droite locale des voisins validés proches (±fenetreCuts),
  * pondérée en travers par la courbure cinématique locale dθ/ds de `Mo`. */
 function proj4(M,p){
   const [x,y,z]=p,w=M[3]*x+M[7]*y+M[11]*z+M[15];
   if(!fini(w)||Math.abs(w)<1e-15)return null;
   const out=[(M[0]*x+M[4]*y+M[8]*z+M[12])/w,(M[1]*x+M[5]*y+M[9]*z+M[13])/w,(M[2]*x+M[6]*y+M[10]*z+M[14])/w];
   return out.every(fini)?out:null;
 }
 function jugerCourbure(E,cut,capture,positions,voisins,opts={}){
   const R=E?.modele?.R||REGLAGE,fenetre=opts.fenetreCuts??3,minVois=opts.minVoisins??2;
   const maxVert=opts.maxFlecheVertMm??R.maxFlecheVertMm??55,maxGauch=opts.maxGauchissementMm??R.maxGauchissementMm??40;
   const ra=capture&&capture.rails;
   if(!ra?.left?.sceneRelativeToProfileLocal||!ra?.right?.sceneRelativeToProfileLocal||!positions?.left||!positions?.right)return {muet:'rails'};
   const decDe=(s,pos)=>{const M=ra[s].sceneRelativeToProfileLocal,o=proj4(M,ra[s].positionSceneRelative),q=proj4(M,pos);
     return o&&q?[q[0]-o[0],1000*(q[1]-o[1]),1000*(q[2]-o[2])]:null;};
   const poseDec={left:decDe('left',positions.left),right:decDe('right',positions.right)};
   if(!poseDec.left||!poseDec.right)return {muet:'pose'};
   const vs=[];const vus=new Set();
   for(const v of voisins||[]){
     const vc=v?.identity?.cut??v?.cut;
     if(!Number.isInteger(vc)||vc===cut||Math.abs(vc-cut)>fenetre||vus.has(vc)||!v?.positions?.left||!v?.positions?.right)continue;
     const dl=decDe('left',v.positions.left),dr=decDe('right',v.positions.right);
     if(!dl||!dr)continue;
     vus.add(vc);vs.push({cut:vc,left:dl,right:dr});
   }
   if(vs.length<minVois)return {muet:'voisins'};
   /* Courbure cinématique dθ/ds (rad/m) au cut si le modèle est disponible : */
   let kappa=0;const Mo=E?.modele;
   if(Mo?.ok&&Number.isInteger(cut)&&cut>=0&&cut<Mo.Lg.n){
     const k=Mo.Lg.pos[cut],k0=Math.max(0,k-2),k1=Math.min(Mo.m-1,k+2);
     if(k>=0&&Mo.S.s[k1]-Mo.S.s[k0]>0.5)kappa=(Mo.S.th[k1]-Mo.S.th[k0])/(Mo.S.s[k1]-Mo.S.s[k0]);
   }
   const fit=(s,idx,corrCourbure=false)=>{
     const P=vs.map(v=>[v[s][0],v[s][idx]-(corrCourbure?500*kappa*v[s][0]*v[s][0]:0)]);
     const n=P.length,mx=P.reduce((a,q)=>a+q[0],0)/n,my=P.reduce((a,q)=>a+q[1],0)/n,sxx=P.reduce((a,q)=>a+(q[0]-mx)**2,0);
     const b=sxx>1e-4?P.reduce((a,q)=>a+(q[0]-mx)*(q[1]-my),0)/sxx:0,a=my-b*mx;
     const res=n>=3?Math.max(...P.map(q=>Math.abs(q[1]-(a+b*q[0])))):0;
     return {pred:a,res};
   };
   const zL=fit('left',2,false),zR=fit('right',2,false),yL=fit('left',1,true),yR=fit('right',1,true);
   if(Math.max(zL.res,zR.res)>15)return {muet:'voisins-incoherents'};
   const flecheVertMm=Math.max(Math.abs(poseDec.left[2]-zL.pred),Math.abs(poseDec.right[2]-zR.pred));
   const flecheLatMm=Math.max(Math.abs(poseDec.left[1]-yL.pred),Math.abs(poseDec.right[1]-yR.pred));
   const gauchissementMm=Math.abs((poseDec.left[2]-poseDec.right[2])-(zL.pred-zR.pred));
   const refus=flecheVertMm>maxVert||gauchissementMm>maxGauch;
   return {refus,flecheVertMm:r1(flecheVertMm),flecheLatMm:r1(flecheLatMm),gauchissementMm:r1(gauchissementMm),voisins:vs.length};
 }
 /* État complet d'un lot depuis la table décompactée de la liste (null sans table). */
 function etat(table,r){if(!table)return null;const E=creer(table,r);E.table=table;return E;}
 return {VERSION,REGLAGE,reglage,lignes,serie,grille,predire,preparer,axe,etat,noter,translation,ecartPose,juger,graineAxe,jugerConnu,fenetres,jugerCourbure};
});

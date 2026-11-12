/* CH-111 — QR CODE du lien d'appairage de la télécommande (panneau). Encodeur minimal d'après la norme ISO/IEC 18004 : mode octets,
 * correction d'erreur M, versions 1 à 10 (jusqu'à 213 octets), choix du masque par les quatre pénalités. Aucune dépendance, rien ne sort.
 * `matrice(texte)` -> {taille, version, masque, sombre(x, y)} ; `svg(texte, {marge, module})` -> chaîne SVG (modules sombres en currentColor). */
(function(root,factory){const m=factory();if(typeof module==='object'&&module.exports)module.exports=m;root.ArianeQR=m;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
/* Niveau M : [codes de correction par bloc, [blocs, octets de données], [blocs, octets de données]]. */
const M=[null,[10,[1,16]],[16,[1,28]],[26,[1,44]],[18,[2,32]],[24,[2,43]],[16,[4,27]],[18,[4,31]],[22,[2,38],[2,39]],[22,[3,36],[2,37]],[26,[4,43],[1,44]]];
const ALIGN=[null,[],[6,18],[6,22],[6,26],[6,30],[6,34],[6,22,38],[6,24,42],[6,26,46],[6,28,50]];
const capacite=v=>{const [,a,b]=M[v];return a[0]*a[1]+(b?b[0]*b[1]:0);};
/* Corps de Galois GF(256), polynôme 0x11D. */
function mul(x,y){let z=0;for(let i=7;i>=0;i--){z=(z<<1)^((z>>>7)*0x11D);z^=((y>>>i)&1)*x;}return z&255;}
function diviseur(deg){const r=new Array(deg).fill(0);r[deg-1]=1;let x=1;
 for(let i=0;i<deg;i++){for(let j=0;j<deg;j++){r[j]=mul(r[j],x);if(j+1<deg)r[j]^=r[j+1];}x=mul(x,2);}return r;}
function reste(data,div){const r=div.map(()=>0);for(const b of data){const f=b^r.shift();r.push(0);div.forEach((c,i)=>{r[i]^=mul(c,f);});}return r;}
function octets(texte){return [...new TextEncoder().encode(String(texte))];}
function choisirVersion(n){for(let v=1;v<=10;v++){const bits=4+(v<10?8:16)+8*n;if(bits<=capacite(v)*8)return v;}throw Error('Texte trop long pour le QR code ('+n+' octets, 213 au plus).');}
function codewords(data,v){
 const bits=[];const put=(val,len)=>{for(let i=len-1;i>=0;i--)bits.push((val>>>i)&1);};
 put(4,4);put(data.length,v<10?8:16);for(const b of data)put(b,8);
 const cap=capacite(v)*8;put(0,Math.min(4,cap-bits.length));while(bits.length%8)bits.push(0);
 const cw=[];for(let i=0;i<bits.length;i+=8)cw.push(bits.slice(i,i+8).reduce((a,b)=>a<<1|b,0));
 for(let p=0xEC;cw.length<capacite(v);p^=0xEC^0x11)cw.push(p);
 const [ec,a,b]=M[v],blocs=[];let k=0;
 for(const [nb,len] of [a,b].filter(Boolean))for(let i=0;i<nb;i++){blocs.push(cw.slice(k,k+len));k+=len;}
 const div=diviseur(ec),ecs=blocs.map(x=>reste(x,div)),out=[],max=Math.max(...blocs.map(x=>x.length));
 for(let i=0;i<max;i++)for(const x of blocs)if(i<x.length)out.push(x[i]);
 for(let i=0;i<ec;i++)for(const x of ecs)out.push(x[i]);return out;}
function construire(v,cw,masque){const n=17+4*v,mod=[...Array(n)].map(()=>new Array(n).fill(false)),fn=[...Array(n)].map(()=>new Array(n).fill(false));
 const set=(x,y,d)=>{mod[y][x]=d;fn[y][x]=true;};
 const finder=(cx,cy)=>{for(let dy=-4;dy<=4;dy++)for(let dx=-4;dx<=4;dx++){const x=cx+dx,y=cy+dy;if(x<0||y<0||x>=n||y>=n)continue;const d=Math.max(Math.abs(dx),Math.abs(dy));set(x,y,d!==2&&d!==4);}};
 for(let i=0;i<n;i++){set(6,i,i%2===0);set(i,6,i%2===0);}
 finder(3,3);finder(n-4,3);finder(3,n-4);
 const al=ALIGN[v];for(let i=0;i<al.length;i++)for(let j=0;j<al.length;j++){if(i===0&&j===0||i===0&&j===al.length-1||i===al.length-1&&j===0)continue;
  for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++)set(al[i]+dx,al[j]+dy,Math.max(Math.abs(dx),Math.abs(dy))!==1);}
 const format=m=>{const data=(0<<3)|m;let r=data;for(let i=0;i<10;i++)r=(r<<1)^((r>>>9)*0x537);const b=((data<<10)|r)^0x5412,bit=i=>((b>>>i)&1)===1;
  for(let i=0;i<=5;i++)set(8,i,bit(i));set(8,7,bit(6));set(8,8,bit(7));set(7,8,bit(8));for(let i=9;i<15;i++)set(14-i,8,bit(i));
  for(let i=0;i<8;i++)set(n-1-i,8,bit(i));for(let i=8;i<15;i++)set(8,n-15+i,bit(i));set(8,n-8,true);};
 format(0);/* réserve les places ; réécrit avec le masque choisi */
 if(v>=7){let r=v;for(let i=0;i<12;i++)r=(r<<1)^((r>>>11)*0x1F25);const b=v<<12|r;
  for(let i=0;i<18;i++){const d=((b>>>i)&1)===1,a=n-11+i%3,c=Math.floor(i/3);set(a,c,d);set(c,a,d);}}
 let i=0;for(let right=n-1;right>=1;right-=2){if(right===6)right=5;
  for(let vert=0;vert<n;vert++)for(let j=0;j<2;j++){const x=right-j,haut=((right+1)&2)===0,y=haut?n-1-vert:vert;
   if(!fn[y][x]&&i<cw.length*8){mod[y][x]=((cw[i>>>3]>>>(7-(i&7)))&1)===1;i++;}}}
 const MASQUES=[(x,y)=>(x+y)%2===0,(x,y)=>y%2===0,x=>x%3===0,(x,y)=>(x+y)%3===0,(x,y)=>(Math.floor(x/3)+Math.floor(y/2))%2===0,
  (x,y)=>x*y%2+x*y%3===0,(x,y)=>(x*y%2+x*y%3)%2===0,(x,y)=>((x+y)%2+x*y%3)%2===0];
 for(let y=0;y<n;y++)for(let x=0;x<n;x++)if(!fn[y][x]&&MASQUES[masque](x,y))mod[y][x]=!mod[y][x];
 format(masque);return mod;}
/* Pénalités N1 à N4 de la norme (le masque le moins pénalisé est retenu). */
function penalite(m){const n=m.length;let p=0;
 const lignes=[...m,...m[0].map((_,x)=>m.map(r=>r[x]))];
 for(const l of lignes){let run=1;for(let i=1;i<=n;i++){if(i<n&&l[i]===l[i-1])run++;else{if(run>=5)p+=run-2;run=1;}}
  for(let i=0;i+11<=n;i++){const s=l.slice(i,i+11).map(Number).join('');if(s==='10111010000'||s==='00001011101')p+=40;}}
 for(let y=0;y<n-1;y++)for(let x=0;x<n-1;x++){const c=m[y][x];if(c===m[y][x+1]&&c===m[y+1][x]&&c===m[y+1][x+1])p+=3;}
 const noirs=m.flat().filter(Boolean).length;p+=Math.floor(Math.abs(noirs*20-n*n*10)/(n*n))*10;return p;}
function matrice(texte){const data=octets(texte),v=choisirVersion(data.length),cw=codewords(data,v);
 let best=null;for(let k=0;k<8;k++){const m=construire(v,cw,k),p=penalite(m);if(!best||p<best.p)best={m,p,k};}
 const m=best.m;return {taille:m.length,version:v,masque:best.k,sombre:(x,y)=>m[y]?.[x]===true,lignes:m.map(r=>r.slice())};}
function svg(texte,{marge=4,module=4}={}){const q=matrice(texte),t=q.taille+2*marge;let d='';
 for(let y=0;y<q.taille;y++)for(let x=0;x<q.taille;x++)if(q.sombre(x,y))d+=`M${x+marge} ${y+marge}h1v1h-1z`;
 return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${t} ${t}" width="${t*module}" height="${t*module}" shape-rendering="crispEdges" role="img" aria-label="QR code d’appairage"><rect width="${t}" height="${t}" fill="#fff"/><path d="${d}" fill="#000"/></svg>`;}
return Object.freeze({matrice,svg});
});

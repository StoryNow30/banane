/* Ariane 5 — ÉCRAN DE LANCEMENT : une fusée à deux propulseurs décolle des rails (≈ 4,7 s ; un clic ou une touche le passe).
 * Pure présentation, dessinée en canvas : aucun message au service worker, aucune lecture de l'état d'Ariane, rien n'attend cet écran (le panneau se
 * charge dessous). La simulation (fumée, étincelles) avance par pas fixes de 1/60 s : le rendu ne dépend pas de la cadence de l'écran, et
 * `window.__lancementManuel` (essais) fige la lecture pour rendre n'importe quel instant `__lancementRendre(t)`.
 * Chronologie (s) : 0–0,7 nuit, vapeur aux tuyères ; 0,7 allumage (flamme, tremblement, fumée au sol) ; 1,5 décollage (accélération, les rails
 * défilent puis s'effacent, le ciel passe du crépuscule à l'espace) ; 3,1 onde de lumière et titre ; 4,3 sortie en fondu. */
(function(){
 const el=document.getElementById('lancement'),toile=document.getElementById('lancement-toile');if(!el)return;
 const T={ign:.7,lift:1.5,rev:3.1,sortie:4.3,fin:4.75};
 let ferme=false,raf=0,timer=0;
 const fermer=()=>{if(ferme)return;ferme=true;cancelAnimationFrame(raf);clearTimeout(timer);el.classList.add('fini');el.hidden=true;document.removeEventListener('keydown',fermer,true);};
 el.addEventListener('click',fermer);document.addEventListener('keydown',fermer,true);
 const calme=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;
 /* Titre : une lettre après l'autre, puis un balayage de lumière (CSS). */
 const nom=el.querySelector('.lanc-nom h2');
 if(nom){const txt=nom.textContent;nom.textContent='';[...txt].forEach((c,i)=>{const s=document.createElement('span');s.textContent=c===' '?' ':c;s.style.setProperty('--i',i);nom.appendChild(s);});}
 if(calme||!toile||!toile.getContext){el.classList.add('calme');timer=setTimeout(fermer,1500);return;}
 const g=toile.getContext('2d');if(!g){el.classList.add('calme');timer=setTimeout(fermer,1500);return;}
 const clamp=(x,a=0,b=1)=>Math.min(b,Math.max(a,x)),lerp=(a,b,t)=>a+(b-a)*t,lisse=(a,b,x)=>{const t=clamp((x-a)/(b-a));return t*t*(3-2*t);};
 const mix=(c1,c2,t)=>c1.map((v,i)=>Math.round(lerp(v,c2[i],t)));
 const rgb=c=>`rgb(${c[0]},${c[1]},${c[2]})`;
 let W=0,H=0,dpr=1;
 function taille(){dpr=Math.min(2,window.devicePixelRatio||1);W=el.clientWidth||360;H=el.clientHeight||560;toile.width=Math.round(W*dpr);toile.height=Math.round(H*dpr);}
 /* Aléa déterministe (mulberry32) : deux rendus du même instant sont identiques. */
 let graine=7;const alea=()=>{graine|=0;graine=graine+0x6D2B79F5|0;let t=Math.imul(graine^graine>>>15,1|graine);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};
 const etoiles=[];for(let i=0;i<110;i++)etoiles.push({x:alea(),y:alea(),r:.4+alea()*1.3,ph:alea()*6.28,z:.2+alea()*.8});
 let parts=[],tSim=0;
 /* Géométrie : le point de fuite, la voie, la fusée. */
 const U=()=>Math.min(W,H*.62)*.027;
 const vp=()=>({x:W/2,y:H*.40});
 function montee(q){return q<=0?0:.5*H*.62*q*q;}            /* hauteur gagnée par la fusée (px) */
 function vitesse(q){return q<=0?0:H*.62*q;}                 /* px/s */
 function etatFusee(t){const q=t-T.lift,haut=montee(q);return {q,haut,y:H*.80-haut,v:vitesse(q),
   flamme:clamp((t-T.ign)/.55)*(t<T.lift?lerp(.35,.6,clamp((t-T.ign)/.8)):1),trem:t>T.ign&&t<T.lift+.35?lerp(.4,1.6,clamp((t-T.ign)/.8)):0};}
 /* Fumée, vapeur et étincelles. */
 function pas(dt,t){const f=etatFusee(t),u=U();
  const rate=(t>=T.ign&&t<T.lift+1.1)?(t<T.lift?110:70):(t<T.ign?10:0);
  for(let k=0;k<rate*dt+(alea()<rate*dt%1?1:0);k++){const bx=[-2.4,0,2.4][Math.floor(alea()*3)]*u,sol=t<T.lift+.5;
   parts.push({t:'f',x:W/2+bx+(alea()-.5)*u,y:f.y+u*.5,vx:(alea()-.5)*(sol?260:90)*(t<T.ign?.2:1),vy:sol?(alea()-.6)*18:60+alea()*50,r:u*(.9+alea()*1.1),vie:0,max:1.5+alea()*1.2,a:t<T.ign?.18:.5});}
  if(f.flamme>.4)for(let k=0;k<(t<T.lift?3:5);k++){const bx=[-2.4,0,2.4][Math.floor(alea()*3)]*u,a=Math.PI/2+(alea()-.5)*1.1,v=180+alea()*320;
   parts.push({t:'e',x:W/2+bx,y:f.y+u*1.5,vx:Math.cos(a)*v*(alea()<.5?-1:1)*.5,vy:Math.sin(a)*v,r:.7+alea()*1.3,vie:0,max:.35+alea()*.5,a:1});}
  const descente=(f.q>0?f.v*.5:0);
  parts=parts.filter(p=>{p.vie+=dt;if(p.vie>=p.max)return false;p.x+=p.vx*dt;p.y+=(p.vy+descente)*dt;
   if(p.t==='f'){p.vx*=1-1.4*dt;p.r+=u*1.6*dt;}else p.vy+=300*dt;return true;});}
 function avancer(t){if(t<tSim){parts=[];tSim=0;graine=7;}while(tSim+1/60<=t){tSim+=1/60;pas(1/60,tSim);}}
 /* Ciel, étoiles, rails. */
 function ciel(t,f){const alt=clamp(f.haut/(H*.9));
  const haut=mix([14,26,58],[2,3,10],alt),bas=mix([196,108,72],[8,14,34],clamp(alt*1.3));
  const d=g.createLinearGradient(0,0,0,H);d.addColorStop(0,rgb(haut));d.addColorStop(.5,rgb(mix(haut,bas,.35)));d.addColorStop(1,rgb(bas));g.fillStyle=d;g.fillRect(0,0,W,H);
  const p=vp(),h=g.createRadialGradient(p.x,p.y+f.haut*.55,0,p.x,p.y+f.haut*.55,W*.9);h.addColorStop(0,`rgba(255,170,110,${.42*(1-alt)})`);h.addColorStop(1,'rgba(255,170,110,0)');g.fillStyle=h;g.fillRect(0,0,W,H);
  for(const s of etoiles){const y=(s.y*H+f.haut*.25*s.z)%H,tw=.55+.45*Math.sin(t*3+s.ph);
   g.globalAlpha=clamp(.25+alt*.75)*tw;g.fillStyle='#dfe7fb';g.beginPath();g.arc(s.x*W,y,s.r,0,6.283);g.fill();
   if(f.v>H*.3&&s.z>.6&&t<T.rev){g.globalAlpha*=.5;g.strokeStyle='#dfe7fb';g.lineWidth=s.r*.7;g.beginPath();g.moveTo(s.x*W,y-f.v*.03*s.z);g.lineTo(s.x*W,y);g.stroke();}}
  g.globalAlpha=1;}
 function rails(t,f){const p=vp(),chute=f.haut*.85,alpha=1-lisse(.5,1.9,f.q);if(alpha<=0)return;
  const y0=p.y+chute,A=(H-p.y)*1.0,R=W*.30,defil=(f.q>0?(f.q*f.q)*H*.55:0);
  g.save();g.globalAlpha=alpha;
  /* Traverses : profondeur d = 1 (bas de l'écran) à l'infini ; espacement constant en profondeur, décalage = avance de la voie. */
  const L=14,esp=.26;for(let k=-2;k<26;k++){const d=1+((k*esp-(defil/H)*1.2)%(L*esp)+L*esp)%(L*esp);
   const y=y0+A/d,w=R*1.22/d,ep=Math.max(1,5/d);if(y>H+20||y<y0)continue;
   g.strokeStyle=`rgba(86,98,128,${.85/(1+d*.12)})`;g.lineWidth=ep*1.4;g.beginPath();g.moveTo(p.x-w,y);g.lineTo(p.x+w,y);g.stroke();}
  for(const sg of [-1,1]){const g2=g.createLinearGradient(0,y0,0,H);g2.addColorStop(0,'rgba(143,160,196,0)');g2.addColorStop(.35,'rgba(160,176,210,.8)');g2.addColorStop(1,'rgba(200,212,238,1)');
   g.strokeStyle=g2;g.lineWidth=Math.max(2,W*.009);g.lineCap='round';g.beginPath();g.moveTo(p.x,y0);g.lineTo(p.x+sg*R*1.1,y0+A);g.stroke();
   g.strokeStyle='rgba(255,255,255,.35)';g.lineWidth=1;g.beginPath();g.moveTo(p.x,y0);g.lineTo(p.x+sg*R*1.1-sg*2,y0+A);g.stroke();}
  g.restore();}
 /* Fusée à deux propulseurs, flammes additives. */
 function fusee(t,f){const u=U(),x=W/2+(f.trem?Math.sin(t*90)*f.trem:0),b=f.y;if(b<-u*30)return;
  const tuyeres=[-2.4,0,2.4];
  g.save();g.globalCompositeOperation='lighter';
  if(f.flamme>0){const lueur=g.createRadialGradient(x,b+u*2,0,x,b+u*2,W*.55);lueur.addColorStop(0,`rgba(255,160,70,${.5*f.flamme})`);lueur.addColorStop(1,'rgba(255,120,40,0)');g.fillStyle=lueur;g.fillRect(0,0,W,H);
   tuyeres.forEach((tx,i)=>{const L=u*(3+11*f.flamme)*(1+.14*Math.sin(t*70+i*2)),w=u*(tx?.85:1.05);
    for(const [c,k] of [['rgba(255,120,30,.55)',1],['rgba(255,190,90,.8)',.68],['rgba(255,250,215,.95)',.38]]){
     g.fillStyle=c;g.beginPath();g.moveTo(x+tx*u-w*k,b);g.quadraticCurveTo(x+tx*u-w*k*.9,b+L*.55*k,x+tx*u,b+L*k+ (k<1?0:0));g.quadraticCurveTo(x+tx*u+w*k*.9,b+L*.55*k,x+tx*u+w*k,b);g.closePath();g.fill();}});}
  g.restore();
  /* Corps : propulseurs latéraux, étage central, coiffe. */
  const corps=(cx,w,h,nez,coul)=>{const gr=g.createLinearGradient(cx-w/2,0,cx+w/2,0);gr.addColorStop(0,coul[0]);gr.addColorStop(.45,coul[1]);gr.addColorStop(1,coul[2]);
   g.fillStyle=gr;g.beginPath();g.moveTo(cx-w/2,b);g.lineTo(cx-w/2,b-h);g.quadraticCurveTo(cx-w/2,b-h-nez*.7,cx,b-h-nez);g.quadraticCurveTo(cx+w/2,b-h-nez*.7,cx+w/2,b-h);g.lineTo(cx+w/2,b);g.closePath();g.fill();};
  for(const sg of [-1,1]){const cx=x+sg*2.4*u;corps(cx,1.7*u,9*u,2.6*u,['#aeb7ca','#f4f7fd','#9aa5bd']);
   g.fillStyle='#d8402b';g.beginPath();g.moveTo(cx-.85*u,b-9*u);g.quadraticCurveTo(cx-.85*u,b-11.2*u,cx,b-11.6*u);g.quadraticCurveTo(cx+.85*u,b-11.2*u,cx+.85*u,b-9*u);g.closePath();g.fill();
   g.fillStyle='#3a4258';g.fillRect(cx-.65*u,b,1.3*u,.9*u);}
  corps(x,3*u,14*u,4.2*u,['#b7c0d3','#fbfcff','#a3aec6']);
  g.fillStyle='#d8402b';g.fillRect(x-1.5*u,b-6.2*u,3*u,.7*u);g.fillRect(x-1.5*u,b-14*u,3*u,.55*u);
  g.fillStyle='#2a3b66';g.beginPath();g.arc(x,b-10.2*u,.95*u,0,6.283);g.fill();g.strokeStyle='#8fa0c4';g.lineWidth=u*.25;g.stroke();
  g.fillStyle='#9fc0ff';g.beginPath();g.arc(x-.3*u,b-10.5*u,.28*u,0,6.283);g.fill();
  g.fillStyle='#3a4258';g.fillRect(x-1*u,b,2*u,1.1*u);
  g.fillStyle='#8c97b0';for(const sg of [-1,1]){g.beginPath();g.moveTo(x+sg*1.5*u,b-1.5*u);g.lineTo(x+sg*2.1*u,b+.4*u);g.lineTo(x+sg*1.5*u,b);g.closePath();g.fill();}}
 function particules(f,t){const dis=1-lisse(T.rev-.3,T.rev+.7,t);g.save();g.globalAlpha=dis;for(const p of parts){const k=p.vie/p.max;
   if(p.t==='f'){const a=p.a*(1-k)*(k<.12?k/.12:1);g.fillStyle=`rgba(${200-k*40|0},${205-k*40|0},${222-k*30|0},${a})`;g.beginPath();g.arc(p.x,p.y,p.r,0,6.283);g.fill();}
   else{g.save();g.globalCompositeOperation='lighter';g.fillStyle=`rgba(255,${190-k*90|0},${90-k*60|0},${1-k})`;g.beginPath();g.arc(p.x,p.y,p.r,0,6.283);g.fill();g.restore();}}g.restore();}
 function onde(t){const q=t-T.rev;if(q<0||q>1.1)return;const r=lerp(0,Math.max(W,H)*.75,1-Math.pow(1-q/1.1,3)),a=(1-q/1.1)*.55;
  g.save();g.globalCompositeOperation='lighter';g.strokeStyle=`rgba(150,185,255,${a})`;g.lineWidth=2+6*(1-q/1.1);g.beginPath();g.arc(W/2,H*.40,r,0,6.283);g.stroke();
  const c=g.createRadialGradient(W/2,H*.40,0,W/2,H*.40,Math.max(W,H)*.5);c.addColorStop(0,`rgba(140,175,255,${.25*(1-q/1.1)})`);c.addColorStop(1,'rgba(140,175,255,0)');g.fillStyle=c;g.fillRect(0,0,W,H);g.restore();}
 function rendre(t){if(!W)taille();avancer(t);const f=etatFusee(t);
  g.setTransform(dpr,0,0,dpr,0,0);g.clearRect(0,0,W,H);
  ciel(t,f);rails(t,f);
  g.save();g.beginPath();g.rect(0,0,W,H);g.clip();particules(f,t);fusee(t,f);g.restore();
  onde(t);
  /* Entrée en fondu depuis le noir ; le titre et la sortie sont gérés par le CSS ou ce rideau. */
  const noir=1-lisse(0,.45,t);if(noir>0){g.fillStyle=`rgba(0,0,0,${noir})`;g.fillRect(0,0,W,H);}
  const sortie=lisse(T.sortie,T.fin,t);el.style.opacity=String(1-sortie);
  el.classList.toggle('titre',t>=T.rev);}
 window.__lancementRendre=t=>{rendre(t);};
 addEventListener('resize',()=>{taille();});
 taille();
 if(window.__lancementManuel){rendre(0);return;}
 const t0=performance.now();
 const boucle=now=>{if(ferme)return;const t=(now-t0)/1000;rendre(t);if(t>=T.fin)return fermer();raf=requestAnimationFrame(boucle);};
 raf=requestAnimationFrame(boucle);
 timer=setTimeout(fermer,T.fin*1000+800);   /* filet : même si l'affichage est suspendu, l'écran part */
})();

'use strict';
/* 5.0 — « déplacer la vue » : les gestes d'Ariane (src/gestes-vue.js) sont ceux que Chromium produit pour un vrai geste, et
 * le relevé de l'Écho résume ceux de l'opérateur. La référence navigateur (tests/fixtures/gestes-chromium.json) vient de
 * `node tools/releve-gestes-vue.cjs navigateur --fixture …` : gestes de confiance par le protocole du navigateur, Chromium 141. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const G=require('../src/gestes-vue.js'),REF=require('./fixtures/gestes-chromium.json');
const alea=()=>.5;
/* Motif : types dans l'ordre, sans l'approche (déplacements avant le premier geste), une série (pointermove, mousemove) réduite à un couple. */
function motif(types){const t=types.slice();while(t.length&&/move$/.test(t[0]))t.shift();const out=[];
  for(let i=0;i<t.length;i++){if(t[i]==='pointermove'&&t[i+1]==='mousemove'){if(!(out.at(-2)==='pointermove'&&out.at(-1)==='mousemove'))out.push('pointermove','mousemove');i++;continue;}out.push(t[i]);}return out;}
const classe={pointer:'PointerEvent',mouse:'MouseEvent',wheel:'WheelEvent'};

test('glisser au bouton gauche : même suite que Chromium, sans le click final par défaut (ESV poserait le rail)',()=>{
 const seq=G.sequenceGlisser({x0:400,y0:300,x1:480,y1:320,alea});
 assert.deepEqual(motif(seq.map(d=>d.type)),REF.glisserGauche.motif.filter(t=>t!=='click'));
 assert.equal(REF.glisserGauche.motif.at(-1),'click','Chromium termine un glisser par un click (relevé)');
 const avecClic=G.sequenceGlisser({x0:400,y0:300,x1:480,y1:320,alea,reglages:{clicFinal:true}});
 assert.deepEqual(motif(avecClic.map(d=>d.type)),REF.glisserGauche.motif,'avec clicFinal : la suite de Chromium à l\'identique');
 /* Champs par type, comme Chromium (sauf ce que la page ne peut pas reproduire : isTrusted). */
 for(const d of avecClic.filter(x=>x.init.buttons!==0||!/move/.test(x.type))){
  const ref=REF.glisserGauche.champs[d.type];if(!ref)continue;
  assert.equal(classe[d.genre],ref.classe,d.type+' : classe');
  for(const k of ['button','buttons','pressure','detail','pointerId','pointerType'])if(k in ref&&!(k==='detail'&&ref.classe==='PointerEvent'&&d.type!=='click'))
   assert.equal(d.init[k]??(k==='detail'?0:undefined),ref[k],d.type+' : '+k);
 }
 /* Le pointeur arrive puis le glisser va de (x0, y0) à (x1, y1), à pas entiers. */
 const moves=seq.filter(d=>d.type==='mousemove');assert.deepEqual([moves[0].init.clientX,moves[0].init.clientY],[400,300]);
 assert.deepEqual([moves.at(-1).init.clientX,moves.at(-1).init.clientY],[480,320]);
 assert.ok(moves.every(d=>Number.isInteger(d.init.clientX)&&Number.isInteger(d.init.clientY)));
 const duree=seq.reduce((a,d)=>a+d.apresMs,0);assert.ok(duree>=200&&duree<=700,'durée humaine : '+duree+' ms');
});

test('molette : même suite que Chromium, deltaY ±100, wheelDeltaY ∓120 (un wheel synthétique naïf a le mauvais signe)',()=>{
 const seq=G.sequenceMolette({x:400,y:300,crans:2,sens:1,alea});
 assert.deepEqual(motif(seq.map(d=>d.type)),REF.molette.motif);
 const w=seq.filter(d=>d.type==='wheel');
 for(const k of ['deltaY','deltaMode','wheelDeltaY','buttons'])assert.equal(w[0].init[k],REF.molette.champs.wheel[k],'cran de dézoom : '+k);
 const zoom=G.sequenceMolette({x:400,y:300,crans:1,sens:-1,alea}).find(d=>d.type==='wheel');
 for(const k of ['deltaY','wheelDeltaY'])assert.equal(zoom.init[k],REF.molette.zoom[k],'cran de zoom : '+k);
 assert.equal(REF.synthetique.wheelDeltaYNaif,100,'relevé : sans wheelDeltaY, Chromium donne +100 à un wheel synthétique (vrai geste : −120)');
 assert.equal(REF.synthetique.wheelVersMousewheel,0,'relevé : un wheel synthétique n\'atteint jamais un écouteur mousewheel historique');
 assert.ok(w[1].apresMs>=60&&w[1].apresMs<=140,'crans espacés à la main');
 /* Le pointeur est amené au point avant le premier cran (la visionneuse zoome vers la dernière position connue). */
 assert.deepEqual(seq.slice(0,2).map(d=>d.type),['pointermove','mousemove']);
});

test('construire : constructeurs de la page, champs d\'écran, bulles et composition comme Chromium',()=>{
 const faits=[];class E{constructor(t,i){this.type=t;this.i=i;faits.push(this.constructor.name);}}
 const w={screenX:10,screenY:20,PointerEvent:class PointerEvent extends E{},MouseEvent:class MouseEvent extends E{},WheelEvent:class WheelEvent extends E{}};
 const e=G.construire({genre:'wheel',type:'wheel',init:{clientX:5,clientY:6,deltaY:100}},w);
 assert.equal(e.constructor.name,'WheelEvent');assert.deepEqual([e.i.screenX,e.i.screenY,e.i.bubbles,e.i.composed,e.i.view],[15,26,true,true,w]);
 assert.equal(G.construire({genre:'pointer',type:'pointerdown',init:{clientX:0,clientY:0}},w).constructor.name,'PointerEvent');
});

test('besoin : dézoom et glissement pour ramener une cible dans la marge de 1 %',()=>{
 const b=G.besoin([1.15,0.2],{width:800,height:600});
 assert.equal(b.dans,false);assert.ok(Math.abs(b.dezoom-1.15/.99)<1e-12);assert.ok(Math.abs(b.panPx-.16*400)<1e-9);
 assert.equal(G.besoin([.5,-.98],{width:800,height:600}).dans,true);
});

test('caméra : taille du pixel, déplacement dans le repère de la caméra (mm), zoom ; jamais de position',()=>{
 const cam=(x,s)=>({cameraToSceneRelative:[0,1,0,0, 0,0,1,0, 1,0,0,0, 10,x,0,1],projection:[s,0,0,0, 0,s,0,0, 0,0,-1e-4,0, 0,0,0,1],viewport:{width:800,height:600}});
 assert.ok(Math.abs(G.pixelMm(cam(0,5))-.5)<1e-12,'±0,2 sur 800 px : 0,5 mm');
 deq(G.resumeCamera(cam(0,5)),{mmPx:.5,vue:[800,600]});
 deq(G.ecartCamera(cam(0,5),cam(.05,5/1.2)),{deplacementMm:[50,0,0],zoom:1.2});
 assert.ok(!/cameraToSceneRelative|projection/.test(JSON.stringify(G.resumeCamera(cam(3,5)))));
});
function deq(a,b,m){assert.deepEqual(JSON.parse(JSON.stringify(a)),JSON.parse(JSON.stringify(b)),m);}

/* ------------------------------------------------------------------ relevé de l'Écho */
function releveur(){
 let t=0,cam={cameraToSceneRelative:[0,1,0,0, 0,0,1,0, 1,0,0,0, 10,0,0,1],projection:[5,0,0,0, 0,5,0,0, 0,0,-1e-4,0, 0,0,0,1],viewport:{width:800,height:600}};
 const taches=[],resumes=[],vue={id:'vue'};
 const R=new G.Releveur({lireCamera:()=>JSON.parse(JSON.stringify(cam)),emettre:r=>resumes.push(r),planifier:(fn,ms)=>taches.push({at:t+ms,fn}),maintenant:()=>t,estVue:x=>x===vue});
 const avancer=ms=>{const fin=t+ms;for(;;){taches.sort((a,b)=>a.at-b.at);const k=taches[0];if(!k||k.at>fin)break;taches.shift();t=k.at;k.fn();}t=fin;};
 const ev=(type,o={})=>R.evenement({type,isTrusted:true,target:vue,pointerId:1,pointerType:'mouse',clientX:0,clientY:0,...o});
 return {R,ev,avancer,resumes,vue,bouger:(dx,s)=>{cam.cameraToSceneRelative[13]+=dx;if(s)cam.projection[0]=s;},at:ms=>{t=ms;}};
}
test('Écho : un glisser au bouton gauche résumé en un événement (longueur, direction, durée, bouton, clic, caméra avant et après)',()=>{
 const r=releveur();r.at(1000);r.ev('pointerdown',{button:0,buttons:1,clientX:400,clientY:300});
 for(let i=1;i<=10;i++){r.avancer(16);r.ev('pointermove',{buttons:1,clientX:400+6*i,clientY:300+2*i});}
 r.bouger(.03);r.avancer(20);r.ev('pointerup',{button:0,buttons:0,clientX:460,clientY:320});r.ev('click',{button:0});
 r.avancer(2000);
 assert.equal(r.resumes.length,1);const g=r.resumes[0];
 assert.equal(g.type,'glisser');assert.equal(g.bouton,0);assert.equal(g.pas,10);assert.equal(g.clic,true);
 deq([g.dxPx,g.dyPx,g.distancePx,g.longueurPx,g.dureeMs],[60,20,63.2,63.2,180]);
 deq(g.camera.avant,{mmPx:.5,vue:[800,600]});deq(g.camera.deplacementMm,[30,0,0]);assert.equal(g.camera.zoom,1);assert.equal(g.camera.stable,true);
 assert.ok(!/cameraToSceneRelative|projection|"pos"/.test(JSON.stringify(g)),'aucune position');
 assert.ok(JSON.stringify(g).length<600,'poids sobre : '+JSON.stringify(g).length+' octets');
});
test('Écho : crans de molette regroupés en une série (nombre, sens, deltaY, durée, caméra) ; un simple clic et un événement synthétique ne sont pas relevés',()=>{
 const r=releveur();r.at(5000);
 for(let i=0;i<3;i++){if(i)r.avancer(90);r.ev('wheel',{deltaY:100,deltaMode:0,wheelDeltaY:-120,clientX:400,clientY:300});}
 r.bouger(0,5/1.331);r.avancer(3000);
 r.ev('pointerdown',{button:0,buttons:1,clientX:10,clientY:10});r.ev('pointerup',{button:0,clientX:10,clientY:10});r.ev('click');r.avancer(500);
 r.R.evenement({type:'wheel',isTrusted:false,target:r.vue,deltaY:100});r.avancer(1000);
 assert.equal(r.resumes.length,1,JSON.stringify(r.resumes));const m=r.resumes[0];
 assert.equal(m.type,'molette');assert.equal(m.crans,3);assert.equal(m.sens,1);deq(m.deltaY,[100,100,100]);assert.equal(m.deltaMode,0);assert.equal(m.wheelDeltaY,-120);
 assert.equal(m.dureeMs,180);assert.equal(m.intervalleMs,90);assert.equal(m.camera.zoom,1.331);
});
test('Écho : glisser au bouton droit relevé avec son menu contextuel ; deux séries de molette séparées par une pause',()=>{
 const r=releveur();r.ev('pointerdown',{button:2,buttons:2,clientX:100,clientY:100});r.ev('contextmenu');r.ev('pointermove',{buttons:2,clientX:140,clientY:100});
 r.ev('pointerup',{button:2,clientX:140,clientY:100});r.ev('auxclick',{button:2});r.avancer(2000);
 r.ev('wheel',{deltaY:100});r.avancer(1000);r.ev('wheel',{deltaY:-100});r.avancer(2000);
 deq(r.resumes.map(x=>[x.type,x.bouton??x.sens,x.menuContextuel??null,x.auxclic??null]),[['glisser',2,true,true],['molette',1,null,null],['molette',-1,null,null]]);
});
test('Écho : hors de la vue d\'ESV, rien n\'est relevé',()=>{
 const r=releveur(),ailleurs={id:'bouton'};
 r.R.evenement({type:'pointerdown',isTrusted:true,target:ailleurs,button:0,clientX:0,clientY:0});r.R.evenement({type:'pointerup',isTrusted:true,target:ailleurs,clientX:50,clientY:0});
 r.R.evenement({type:'wheel',isTrusted:true,target:ailleurs,deltaY:100});r.avancer(3000);assert.equal(r.resumes.length,0);
});

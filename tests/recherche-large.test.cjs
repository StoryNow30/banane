'use strict';
/* CH-034 — RECHERCHE LARGE (src/recherche-large.js) : le moteur gelé relancé sur des graines régulièrement espacées en travers du rail de
 * départ, union des cellules fortes, paires à l'écartement du contrat, puis une décision qui ne lit que le nuage : « différer » (une paire
 * au moins aussi bonne existe loin de la pose du lot) ou « choisir » (la meilleure paire large remplace la pose du lot si elle est unique).
 * Données synthétiques (tests/helpers/gcv2-jeu-fixture.cjs) : deux rails à 1 450 mm, plus une copie des deux rails décalée de 150 mm (un
 * « leurre » complet, comme un rail d'appareil de voie), de même écartement. Aucune donnée de terrain. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const F=require('./helpers/gcv2-jeu-fixture.cjs');
const RL=require('../src/recherche-large.js');
const L=require('../src/lot-decision.js');
const C=require('../vendor/capture-core.js');

/* Capture : vrais rails en (12, −4) et (10, −3) mm, et, à `leurreMm` en travers (vers l'extérieur du rail gauche, donc même écartement), une copie
 * des deux rails avec `partLeurre` des points du dessus (1 = aussi fournie que la vraie). */
function captureLeurre({leurreMm=150,partLeurre=1,graine=7}={}){
 const cap=F.capture({graine,leurre:false});
 const rnd=F.alea(graine+1),pts=[];
 const copie=(y,sign,bu,bz)=>{const n=Math.round(40*partLeurre);
  for(let i=0;i<n;i++)pts.push([0,y+sign*(bu+0.015+i*0.035/39),bz+(rnd()-0.5)*0.0008]);
  for(let i=0;i<11;i++)pts.push([0,y+sign*(bu+(rnd()-0.5)*0.0008),bz-0.012-i*0.002]);};
 /* Rail gauche : sign +1 (contour vers +y) ; décaler les deux rails de −leurre en y les éloigne de la voie du même côté. */
 copie(-leurreMm/1000,1,0.012,-0.004);copie(1.45-leurreMm/1000,-1,0.010,-0.003);
 cap.pointsSceneRelative=cap.pointsSceneRelative.concat(pts);cap.visibleByClipBoxes=cap.pointsSceneRelative.map(()=>true);
 return cap;}
const pos=(cap,s,latMm,vertMm)=>L.positionOf(cap.rails[s],[0,latMm/1000,vertMm/1000]);
/* Décalages vrais dans le repère profil de chaque rail de départ (le rail droit a son contour vers −y : son gabarit est à −10 mm en travers). */
const VRAI={left:[12,-4],right:[-10,-3]},LEURRE=150;
const V=(s,d=0)=>[VRAI[s][0]-d,VRAI[s][1]];
const R=RL.reglage({actif:true});

test('réglage : absent = livré ÉTEINT ; false = coupé ; clé par clé ; illisible = coupé (ce levier change la pose : jamais par erreur de réglage)',()=>{
 assert.equal(RL.DEFAUT.actif,false);
 assert.deepEqual(RL.reglage(undefined),{ok:true,...RL.DEFAUT});
 assert.equal(RL.reglage(false).actif,false);
 const r=RL.reglage({actif:true,mode:'choisir',loinMm:60});assert.equal(r.ok,true);assert.equal(r.mode,'choisir');assert.equal(r.loinMm,60);assert.equal(r.porteeMm,RL.DEFAUT.porteeMm);
 for(const v of ['oui',{actif:'oui'},{actif:true,mode:'autre'},{actif:true,pasMm:0},{actif:true,rapport:0.5},{actif:true,zones:'adv'}]){const x=RL.reglage(v);assert.equal(x.ok,false,JSON.stringify(v));assert.equal(x.actif,false);}
 assert.deepEqual(RL.reglage({actif:true,zones:['adv']}).zones,['adv']);
});

test('cellules larges : les deux vrais rails ET les deux leurres à 150 mm sont des cellules fortes, en décalages depuis la pose de départ',()=>{
 const cap=captureLeurre();
 const c=RL.cellules(cap,R);
 assert.ok(c.relances>=5,'plusieurs relances du moteur');
 for(const s of ['left','right']){
  const pres=(lat,vert)=>c[s].find(x=>Math.hypot(x.lat-lat,x.vert-vert)<=8);
  const vrai=pres(...V(s)),leurre=pres(...V(s,LEURRE));
  assert.ok(vrai,s+' : le vrai rail est une cellule forte');assert.ok(leurre,s+' : le leurre à 150 mm est une cellule forte');
  for(const x of c[s]){assert.ok(Number.isFinite(x.loss)&&x.top>=15&&x.face>=6,'cellule forte');}
 }
});

test('paires : classées par produit des pertes, à l\'écartement du contrat ; un leurre moins fourni fait une paire moins bonne',()=>{
 const cap=captureLeurre({partLeurre:0.5});
 const p=RL.paires(cap,RL.cellules(cap,R),R);
 assert.ok(p.length>=2);
 for(const x of p)assert.ok(x.gaugeMm>=1420&&x.gaugeMm<=1470,'écartement admissible');
 for(let i=1;i<p.length;i++)assert.ok(p[i].prod>=p[i-1].prod,'ordre');
 assert.ok(Math.abs(p[0].left.lat-VRAI.left[0])<=8,'la meilleure paire est la vraie (gauche)');assert.ok(Math.abs(p[0].right.lat-VRAI.right[0])<=8,'(droite)');
});

test('mode différer : pose du lot sur le leurre, vraie paire aussi bonne à 150 mm → différer (concurrence) ; pose sur le vrai rail, leurre faible → garde ; pose hors de toute paire forte → différer',()=>{
 const cap=captureLeurre({partLeurre:1});
 const surLeurre={left:pos(cap,'left',...V('left',LEURRE)),right:pos(cap,'right',...V('right',LEURRE))};
 const d=RL.decider({capture:cap,positions:surLeurre,R});
 assert.equal(d.etat,'differer',JSON.stringify(RL.resumer(d)));assert.equal(d.motif,'concurrence');assert.ok(d.concurrente&&Math.abs(d.concurrente.left.lat-VRAI.left[0])<=8);
 const cap2=captureLeurre({partLeurre:0.35});
 const surVrai={left:pos(cap2,'left',...V('left')),right:pos(cap2,'right',...V('right'))};
 const g=RL.decider({capture:cap2,positions:surVrai,R});
 assert.equal(g.etat,'garde',JSON.stringify(g));
 const nullePart={left:pos(cap2,'left',70,-4),right:pos(cap2,'right',-70,-3)};
 const n=RL.decider({capture:cap2,positions:nullePart,R});
 assert.equal(n.etat,'differer');assert.equal(n.motif,'pose-sans-paire-forte');
 /* Pose sans paire forte mais la meilleure paire est PROCHE (30 mm) : gardée (règle affinée, `sansPaireLoin`) ; règle du protocole : différée. */
 const presque={left:pos(cap2,'left',12+30,-4),right:pos(cap2,'right',-10+30,-3)};
 const pr=RL.decider({capture:cap2,positions:presque,R});assert.equal(pr.etat,'garde',JSON.stringify(RL.resumer(pr)));assert.equal(pr.motif,'pose-sans-paire-forte-proche');
 const pr2=RL.decider({capture:cap2,positions:presque,R:RL.reglage({actif:true,sansPaireLoin:false})});assert.equal(pr2.etat,'differer');assert.equal(pr2.motif,'pose-sans-paire-forte');
 assert.ok(Number.isFinite(d.ms)&&d.version===RL.VERSION);
 /* Aucune coordonnée de scène dans le résumé : des millimètres et des comptes. */
 assert.equal(JSON.stringify(RL.resumer(d)).includes('positionSceneRelative'),false);
});

test('mode choisir : pose du lot sur un leurre moins bon → remplacée par la vraie paire (positions de scène) ; leurre aussi bon → différer (ambigu) ; pose déjà sur la meilleure → garde',()=>{
 const Rc=RL.reglage({actif:true,mode:'choisir'});
 const cap=captureLeurre({partLeurre:0.5});
 const surLeurre={left:pos(cap,'left',...V('left',LEURRE)),right:pos(cap,'right',...V('right',LEURRE))};
 const d=RL.decider({capture:cap,positions:surLeurre,R:Rc});
 assert.equal(d.etat,'remplacer',JSON.stringify(RL.resumer(d)));
 assert.ok(C.distance(d.positions.left,pos(cap,'left',...V('left')))*1000<=8&&C.distance(d.positions.right,pos(cap,'right',...V('right')))*1000<=8);
 const cap2=captureLeurre({partLeurre:1});
 const a=RL.decider({capture:cap2,positions:{left:pos(cap2,'left',...V('left',LEURRE)),right:pos(cap2,'right',...V('right',LEURRE))},R:Rc});
 /* Deux paires aussi bonnes : différée (ambiguë), ou gardée si la paire du lot est elle-même la meilleure ; jamais remplacée par une paire aussi bonne. */
 assert.ok(a.etat==='differer'&&a.motif==='ambigu'||a.etat==='garde'&&a.motif==='meilleure-proche',JSON.stringify(RL.resumer(a)));
 const g=RL.decider({capture:cap,positions:{left:pos(cap,'left',...V('left')),right:pos(cap,'right',...V('right'))},R:Rc});
 assert.equal(g.etat,'garde');
});

test('nuage sans aucune paire forte (points trop rares) : garde, motif aucune-paire-forte (absence de preuve, pas une preuve contre la pose)',()=>{
 const cap=captureLeurre();cap.pointsSceneRelative=cap.pointsSceneRelative.filter((_,i)=>i%9===0);cap.visibleByClipBoxes=cap.pointsSceneRelative.map(()=>true);
 const d=RL.decider({capture:cap,positions:{left:pos(cap,'left',...V('left')),right:pos(cap,'right',...V('right'))},R});
 assert.equal(d.etat,'garde',JSON.stringify(RL.resumer(d)));assert.equal(d.motif,'aucune-paire-forte');assert.equal(d.nPaires,0);
});

test('pureté : aucune lecture des réglages globaux, entrée illisible = garde (une panne ne change jamais la commande)',()=>{
 const avant=globalThis.BananeSettings;globalThis.BananeSettings={lot:{rechercheLarge:{actif:true,mode:'choisir'}}};
 try{
  const cap=captureLeurre();
  assert.equal(RL.decider({capture:null,positions:null,R}).etat,'garde');
  assert.equal(RL.decider({capture:{rails:cap.rails,pointsSceneRelative:[]},positions:{left:pos(cap,'left',...V('left')),right:pos(cap,'right',...V('right'))},R}).etat,'garde');
  assert.equal(RL.decider({capture:cap,positions:{left:pos(cap,'left',...V('left')),right:pos(cap,'right',...V('right'))},R:RL.reglage(false)}).etat,'garde');
 }finally{globalThis.BananeSettings=avant;}
});

/* § 2.8 du journal : soutien minimal de la paire qui contredit la pose (dessus ≥ soutienTop, flanc ≥ soutienFace sur les deux rails), et mode « choisir sûr ». */
test('soutien : une concurrente pauvre (dessus < soutienTop) ne diffère plus ; livré à 0 = règle examinée ; clés illisibles = coupé',()=>{
 assert.equal(RL.DEFAUT.soutienTop,0);assert.equal(RL.DEFAUT.soutienFace,0);
 for(const v of [{actif:true,soutienTop:-1},{actif:true,soutienFace:'x'}]){const x=RL.reglage(v);assert.equal(x.ok,false);assert.equal(x.actif,false);}
 const cap=captureLeurre({partLeurre:1});
 const surLeurre={left:pos(cap,'left',...V('left',LEURRE)),right:pos(cap,'right',...V('right',LEURRE))};
 const d=RL.decider({capture:cap,positions:surLeurre,R});assert.equal(d.etat,'differer');
 const top=Math.min(d.concurrente.left.top,d.concurrente.right.top);assert.ok(top>=15);
 const g=RL.decider({capture:cap,positions:surLeurre,R:RL.reglage({actif:true,soutienTop:top+1})});
 assert.equal(g.etat,'garde',JSON.stringify(RL.resumer(g)));assert.equal(g.motif,'pose-unique');
 const d2=RL.decider({capture:cap,positions:surLeurre,R:RL.reglage({actif:true,soutienTop:top})});assert.equal(d2.etat,'differer');
 /* Pose sans paire forte : la meilleure paire loin doit elle aussi être soutenue pour différer. */
 const cap2=captureLeurre({partLeurre:0.35});
 const nullePart={left:pos(cap2,'left',70,-4),right:pos(cap2,'right',-70,-3)};
 const n=RL.decider({capture:cap2,positions:nullePart,R});assert.equal(n.etat,'differer');
 const n2=RL.decider({capture:cap2,positions:nullePart,R:RL.reglage({actif:true,soutienTop:10000})});assert.equal(n2.etat,'garde');assert.equal(n2.motif,'pose-sans-paire-forte-pauvre');
});

test('mode choisir-sur : remplace seulement si la meilleure est loin, unique, soutenue et la pose du lot absente ou `rapport` fois moins bonne ; sinon la règle « différer »',()=>{
 const Rs=RL.reglage({actif:true,mode:'choisir-sur'});assert.equal(Rs.ok,true);
 const cap=captureLeurre({partLeurre:0.5});
 const surLeurre={left:pos(cap,'left',...V('left',LEURRE)),right:pos(cap,'right',...V('right',LEURRE))};
 const d=RL.decider({capture:cap,positions:surLeurre,R:Rs});
 assert.equal(d.etat,'remplacer',JSON.stringify(RL.resumer(d)));assert.equal(d.motif,'meilleure-unique');
 assert.ok(C.distance(d.positions.left,pos(cap,'left',...V('left')))*1000<=8);
 /* Même pose, meilleure paire pauvre (soutien exigé au-delà de ses points) : plus de remplacement, mais la règle « différer » s'applique (concurrence). */
 const top=Math.min(d.meilleure.left.top,d.meilleure.right.top);
 const d2=RL.decider({capture:cap,positions:surLeurre,R:RL.reglage({actif:true,mode:'choisir-sur',soutienTop:top+1})});
 assert.notEqual(d2.etat,'remplacer');
 /* Leurre aussi bon que la vraie paire : ni unique ni 1,5 × moins bonne : différer (concurrence), jamais remplacer. */
 const cap2=captureLeurre({partLeurre:1});
 const a=RL.decider({capture:cap2,positions:{left:pos(cap2,'left',...V('left',LEURRE)),right:pos(cap2,'right',...V('right',LEURRE))},R:Rs});
 assert.equal(a.etat,'differer',JSON.stringify(RL.resumer(a)));assert.equal(a.motif,'concurrence');
 /* Pose déjà sur la meilleure : garde. Pose nulle part, meilleure loin et unique : remplacer. */
 const g=RL.decider({capture:cap,positions:{left:pos(cap,'left',...V('left')),right:pos(cap,'right',...V('right'))},R:Rs});assert.equal(g.etat,'garde');
 const cap3=captureLeurre({partLeurre:0.35});
 const n=RL.decider({capture:cap3,positions:{left:pos(cap3,'left',70,-4),right:pos(cap3,'right',-70,-3)},R:Rs});
 assert.equal(n.etat,'remplacer',JSON.stringify(RL.resumer(n)));
 const n2=RL.decider({capture:cap3,positions:{left:pos(cap3,'left',70,-4),right:pos(cap3,'right',-70,-3)},R:RL.reglage({actif:true,mode:'choisir-sur',soutienTop:10000})});
 assert.equal(n2.etat,'garde','meilleure pauvre, pose sans paire forte : ni remplacée ni différée');
});

/* Temps (JOURNAL § 2.11) : graines sur les PICS de densité du nuage (amas de points à la hauteur du dessus de rail) au lieu de la grille ; relance 0 reprise de la science
 * du lot quand elle est fournie. Mêmes cellules, moins de relances. */
test('graines « pics » : les mêmes paires (vraie et leurre à 150 mm) avec moins de relances que la grille ; la science du lot fournie épargne la relance 0',()=>{
 assert.equal(RL.DEFAUT.grainesMode,'grille');
 assert.equal(RL.reglage({actif:true,grainesMode:'autre'}).ok,false);
 const Rp=RL.reglage({actif:true,grainesMode:'pics'});assert.equal(Rp.ok,true);
 const cap=captureLeurre({partLeurre:1});
 const g=RL.grainesPics(cap,Rp);
 assert.ok(g.includes(0)&&g.length>=2&&g.length<=4,'graines : 0 et le pic du leurre : '+JSON.stringify(g));
 assert.ok(g.some(x=>Math.abs(Math.abs(x)-LEURRE)<=40),'une graine près du leurre : '+JSON.stringify(g));
 const cg=RL.cellules(cap,R),cp=RL.cellules(cap,Rp);
 assert.ok(cp.relances<cg.relances,`moins de relances (${cp.relances} < ${cg.relances})`);
 const pg=RL.paires(cap,cg,R),pp=RL.paires(cap,cp,Rp);
 const cle=p=>[p.left.lat,p.left.vert,p.right.lat,p.right.vert].map(v=>Math.round(v)).join(',');
 for(const p of pg.slice(0,4))assert.ok(pp.some(q=>Math.hypot(q.left.lat-p.left.lat,q.left.vert-p.left.vert)<=3&&Math.hypot(q.right.lat-p.right.lat,q.right.vert-p.right.vert)<=3),'paire de la grille retrouvée : '+cle(p));
 const surLeurre={left:pos(cap,'left',...V('left',LEURRE)),right:pos(cap,'right',...V('right',LEURRE))};
 const d=RL.decider({capture:cap,positions:surLeurre,R:Rp});assert.equal(d.etat,'differer');assert.equal(d.motif,'concurrence');
 /* Science du lot fournie : la relance 0 est reprise, une relance de moins, mêmes cellules. */
 const Sh=require('../src/gcv1-shadow.js');const science=Sh.scientificProposeBothAvecReservoir(cap);
 const cs=RL.cellules(cap,Rp,science);assert.equal(cs.relances,cp.relances-1);assert.equal(cs.left.length,cp.left.length);assert.equal(cs.right.length,cp.right.length);
 const ds=RL.decider({capture:cap,positions:surLeurre,R:Rp,science});assert.equal(ds.etat,'differer');assert.equal(ds.cellules.relances,cp.relances-1);
 /* Nuage vide de pics (points rares) : seule la graine 0. */
 const cap2=captureLeurre();cap2.pointsSceneRelative=cap2.pointsSceneRelative.filter((_,i)=>i%20===0);cap2.visibleByClipBoxes=cap2.pointsSceneRelative.map(()=>true);
 assert.deepEqual(RL.grainesPics(cap2,Rp),[0]);
});

test('graines « pics », amas large : un amas continu de 300 mm de large (dalle, appareil de voie) reçoit une graine tous les 120 mm au plus, aucun point à plus de 60 mm d\'une graine ; un amas étroit garde une seule graine',()=>{
 const Rp=RL.reglage({actif:true,grainesMode:'pics'});
 /* Nappe de points dense et continue de −330 à −30 mm en travers du rail gauche (300 mm), à la hauteur du dessus : un seul amas. */
 const cap=captureLeurre({partLeurre:0});
 const nappe=[];for(let y=-0.330;y<=-0.030;y+=0.004)for(let k=0;k<3;k++)nappe.push([0,y+k*0.001,-0.004]);
 cap.pointsSceneRelative=cap.pointsSceneRelative.concat(nappe);cap.visibleByClipBoxes=cap.pointsSceneRelative.map(()=>true);
 const g=RL.grainesPics(cap,Rp);
 assert.ok(g.includes(0),'graine 0 : '+JSON.stringify(g));
 for(let y=-330;y<=-30;y+=10)assert.ok(g.some(x=>Math.abs(x-y)<=60),`point à ${y} mm à ≤ 60 mm d'une graine : `+JSON.stringify(g));
 assert.ok(g.length<=6,'pas plus de 6 graines : '+JSON.stringify(g));
 /* Amas étroit (le leurre de 150 mm du § ci-dessus) : une graine et une seule près de lui. */
 const g2=RL.grainesPics(captureLeurre({partLeurre:1}),Rp);
 assert.equal(g2.filter(x=>Math.abs(Math.abs(x)-LEURRE)<=60).length,1,'une seule graine près du leurre : '+JSON.stringify(g2));
});

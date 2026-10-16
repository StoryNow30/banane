'use strict';
/* 5.0 (audit 5.0, I8) — LES DEUX REJEUX EMPLOIENT LE MODULE COMMUN « RECENTRER SUR LA VOIE » (src/voie-recentree.js), ou
 * vérifient qu'ils concordent avec lui.
 *   - tools/rejeu-voie-predite.cjs : vue nécessaire, caméras élargies, trace du moteur, règle et mesures viennent du module ;
 *     `ombreLot` rejoue l'ombre d'Orbite (`evaluerDiffere`, le code même de l'extension) sur un lot et doit poser ce que la
 *     règle prudente du rejeu pose ;
 *   - tools/memoire-differes.cjs : le recalage de (b) dans le pool est `choisirDansLePool` ; `concorder` compare cette forme
 *     hors ligne au moteur recentré sur le vrai nuage (`recentrer`, la forme de l'extension).
 * Données synthétiques seulement. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const V=require('../src/voie-recentree.js'),Shadow=require('../src/gcv1-shadow.js');
const R=require('../tools/rejeu-voie-predite.cjs'),G=require('../tools/memoire-differes.cjs');

test('rejeu de la voie prédite : les fonctions de vue, de trace et de règle sont celles du module',()=>{
 assert.equal(R.vueNecessaire,V.vueNecessaire);assert.equal(R.camerasLarges,V.camerasLarges);assert.equal(R.regleAccepte,V.regle);
 const src=fs.readFileSync(path.join(__dirname,'..','tools','rejeu-voie-predite.cjs'),'utf8');
 assert.match(src,/require\('\.\.\/src\/voie-recentree\.js'\)/);
 assert.ok(!/function vueNecessaire|function regleAccepte|function traceMoteur|function camerasLarges/.test(src),'plus de copie locale');
});

test('rejeu de la voie prédite : l\'ombre d\'Orbite rejouée sur un lot pose exactement ce que pose la règle prudente du rejeu',{timeout:60000},()=>{
 const ctx=R.fixtureSynthetique();
 const res=R.executer(ctx,['temoin','regle-wc-e10-p10']);
 const regle=res.sorties.find(x=>x.synthese.id==='regle-wc-e10-p10');
 const poses=regle.detail.filter(r=>r.classe==='differee'&&r.posee).map(r=>r.cut);
 const o=R.ombreLot(ctx,res.temoin);
 assert.deepEqual(o.evenements.map(e=>e.identity.cut),[4,5,6,7],'un événement par cut différé du lot');
 assert.deepEqual(o.evenements.filter(e=>e.verdict.posable).map(e=>e.identity.cut),poses,'mêmes poses que la règle du rejeu');
 assert.ok(poses.length>=3,'la fixture fait poser une série : '+poses);
 assert.equal(o.resume.differes,4);assert.equal(o.resume.posables,poses.length);
 assert.ok(o.resume.octetsJson>0&&o.resume.octetsParEvenement>0,'le poids est mesuré');
 /* Les poses de l'ombre sont jugées comme celles du rejeu (même écart à la vérité, au dixième de mm). */
 for(const e of o.evenements.filter(x=>x.verdict.posable)){const d=regle.detail.find(r=>r.cut===e.identity.cut);
  assert.ok(Math.abs(V.ecartPose(e.poseMm,ctx.ref.get(e.identity.cut).mic)-d.pire)<0.2,`cut ${e.identity.cut}`);}
});

test('mémoire des différés : le recalage de (b) dans le pool est celui du module',()=>{
 const src=fs.readFileSync(path.join(__dirname,'..','tools','memoire-differes.cjs'),'utf8');
 assert.match(src,/voie-recentree\.js/);assert.match(src,/choisirDansLePool/);
 const c=(fla,fve,perte=1)=>({fla,fve,perte,haut:20,flanc:8,pente:0});
 const cas={partie:1,cut:12,serie:{id:10,rang:2,longueur:3},reponse:{mic:{gauche:[0,-150,0],droite:[0,-150,0]}},
  geometrie:{ecartement0:[0,1440,0],axes:{gauche:[[1,0,0],[0,1,0],[0,0,1]],droite:[[1,0,0],[0,1,0],[0,0,1]]}},
  rails:{gauche:{pool:[c(-149,0),c(-60,0)]},droite:{pool:[c(-151,1)]}},
  voisinsMic:[{cut:11,ecart:-1,mic:{gauche:[-1,-150,0],droite:[-1,-150,0]}},{cut:10,ecart:-2,mic:{gauche:[-2,-150,0],droite:[-2,-150,0]}}]};
 const avant=[{cut:11,reponse:{mic:{gauche:[0,-150,0],droite:[0,-150,0]}}},{cut:10,reponse:{mic:{gauche:[0,-150,0],droite:[0,-150,0]}}}];
 const p={base:'M',K:3,porteDisp:10,nBack:0,minMemoire:1,mode:'moteur',tol:15};
 const b=G.poserB(p,cas,avant);
 assert.deepEqual(b.pose,{gauche:[-149,0],droite:[-151,1]});
 assert.deepEqual(b.pose,V.choisirDansLePool({gauche:cas.rails.gauche.pool,droite:cas.rails.droite.pool},{gauche:[-150,0],droite:[-150,0]},()=>true).pose);
 /* Le réglage de l'ombre de l'Écho est celui retenu hors partie par G1 (D-148), fixé dans le module. */
 assert.deepEqual(G.REGLAGE_OMBRE,{base:'M',K:V.MEMOIRE_SERIE.K,porteDisp:V.MEMOIRE_SERIE.porteDispersionMm,nBack:0,minMemoire:1,mode:'moteur',tol:V.POOL.tolMm});
});

/* Capture fabriquée (comme tests/memoire-differes.test.cjs) : repère profil = repère de scène, rails à 1,44 m, l'opérateur pose
 * le rail à (dla, dve) mm du départ ; ici toute la voie est décalée de 200 à 215 mm, hors de la fenêtre du moteur (±180 mm). */
function alea(graine){let a=graine>>>0;return()=>{a=(Math.imul(a,1664525)+1013904223)>>>0;return a/4294967296;};}
const trans=(x,y,z)=>[1,0,0,0,0,1,0,0,0,0,1,0,x,y,z,1];
function rail(x,y0,sign){const contour=[];for(let y=0;y<=0.064+1e-12;y+=0.001)contour.push([x,y0+sign*y,0]);for(let z=-0.001;z>=-0.04-1e-12;z-=0.001)contour.push([x,y0,z]);
 return {positionSceneRelative:[x,y0,0],profileOriginSceneRelative:[x,y0,0],sceneRelativeToProfileLocal:trans(-x,-y0,0),profileLocalToSceneRelative:trans(x,y0,0),railLocalToSceneRelative:trans(x,y0,0),profileContours:[{type:'Line',verticesSceneRelative:contour}]};}
function pointsRail(x,y0,sign,dla,dve,rnd){const pts=[],bu=dla/1000,bz=dve/1000;
 for(let i=0;i<60;i++){const u=0.015+i*(0.035/59);pts.push([x+(rnd()-0.5)*0.05,y0+bu+sign*u,bz+(rnd()-0.5)*0.004]);}
 for(let i=0;i<20;i++){const z=-0.012-i*(0.02/19);pts.push([x+(rnd()-0.5)*0.05,y0+bu+sign*(rnd()-0.5)*0.004,bz+z]);}return pts;}
function captureFabriquee(cut,mic,rnd){const x=cut,L=rail(x,0,1),Rr=rail(x,1.44,-1);
 const points=[...pointsRail(x,0,1,mic.gauche[1],mic.gauche[2],rnd),...pointsRail(x,1.44,-1,mic.droite[1],mic.droite[2],rnd)];
 return {cut,part:91,identity:{part:91,cut,frameId:'cadre-synthetique'},rails:{left:L,right:Rr},pointsSceneRelative:points,visibleByClipBoxes:points.map(()=>true)};}
const railJ=(lat,vert)=>({repere:'profil',longitudinalMm:0,lateralMm:lat,verticalMm:vert,dist3dMm:Math.hypot(lat,vert)});

test('mémoire des différés : la forme hors ligne (pool) et la forme de l\'extension (moteur recentré) concordent',{timeout:120000},()=>{
 const rnd=alea(11),cuts=[101,102,103,104];
 const mics=Object.fromEntries(cuts.map((c,i)=>[c,{gauche:[0,200+5*i,2],droite:[0,200+5*i,-1]}]));
 const captures=new Map(cuts.map(c=>[c,captureFabriquee(c,mics[c],rnd)]));
 const jeu=cuts.map(c=>({type:'cut',partie:91,cut:c,classe:'differee',traits:{},contexte:{}}));
 const table=cuts.map(c=>({partie:91,cut:c,classe:'differee',referenceHumaine:'observee',base:'premiere-visite',ecartHumain:{gauche:railJ(mics[c].gauche[1],mics[c].gauche[2]),droite:railJ(mics[c].droite[1],mics[c].droite[2])}}));
 const {cas}=G.construireCas({partie:91,jeu,jointure:{table},corpus:cb=>[...captures.values()].forEach(cb)});
 const out=G.concorder(cas,c=>captures.get(c),{Shadow});
 assert.equal(out.lignes.length,4);
 const tete=out.lignes.find(l=>l.cut===101);assert.equal(tete.memoire,'sans-memoire','la tête de série n\'a pas de mémoire');
 const suite=out.lignes.filter(l=>l.cut!==101);
 assert.ok(suite.every(l=>l.pool.pose&&l.moteur.pose),JSON.stringify(suite.map(l=>[l.cut,l.pool.raison,l.moteur.stage])));
 for(const l of suite){assert.ok(l.ecartEntreMm<=3,`cut ${l.cut} : ${l.ecartEntreMm} mm entre les deux formes`);assert.equal(l.jugementMoteur,'juste5');assert.equal(l.jugementPool,'juste5');}
 assert.equal(out.resume.lesDeuxPosent,3);assert.equal(out.resume.concordantes,3);
});

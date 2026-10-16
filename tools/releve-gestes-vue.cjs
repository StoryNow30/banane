#!/usr/bin/env node
'use strict';
/*
 * releve-gestes-vue.cjs — relevés du chantier « déplacer la vue » (5.0, fiches/DEPLACER_VUE.md), dans un vrai Chromium.
 * Hors du banc `verify` (comme tools/navigateur-*.cjs). Aucune adresse d'ESV : une page locale, ou la maquette ESV locale.
 *
 *   node tools/releve-gestes-vue.cjs navigateur [--fixture tests/fixtures/gestes-chromium.json]
 *        A. Ce que Chromium produit pour de VRAIS gestes (souris et molette de confiance, par le protocole du navigateur) :
 *           types, ordre, champs ; ce qu'il fait des mêmes gestes SYNTHÉTIQUES ; et la suite émise par src/gestes-vue.js.
 *   node tools/releve-gestes-vue.cjs maquette --maquette DOSSIER [--json SORTIE.json]
 *        B. La maquette ESV (tests/esv-maquette de la branche claude/esv-locale-audit, DOSSIER = racine de ce dépôt-là) avec
 *           l'adaptateur de CE dépôt : la vue réagit-elle aux gestes synthétiques ? requêtes de nœuds par geste ? la vue au cut
 *           suivant ? taille du pixel ?
 *        C. Même maquette + MODÈLE DE NAVIGATION SUPPOSÉ (tests/helpers/modele-navigation.js) : `amenerDansLaVue` et `apply`
 *           avec déplacement de vue, sous deux hypothèses (zoom gardé ou remis au recentrage).
 *
 * Nécessite Playwright et Chromium (PLAYWRIGHT_BROWSERS_PATH, défaut /opt/pw-browsers ; ou CHROMIUM=…). Lancer avec `nice`.
 */
const path=require('node:path'),fs=require('node:fs');
const racine=path.join(__dirname,'..'),lire=f=>fs.readFileSync(path.join(racine,f),'utf8');
const G=require('../src/gestes-vue.js');
function playwright(){for(const p of [process.env.PLAYWRIGHT_MODULE,'playwright','/opt/node22/lib/node_modules/playwright'].filter(Boolean)){try{return require(p);}catch{/* suivant */}}
  throw Error('Playwright introuvable (PLAYWRIGHT_MODULE=/chemin/vers/playwright).');}
function executable(){if(process.env.CHROMIUM)return process.env.CHROMIUM;const base=process.env.PLAYWRIGHT_BROWSERS_PATH||'/opt/pw-browsers';
  const d=fs.existsSync(base)?fs.readdirSync(base).find(x=>/^chromium-\d+$/.test(x)):null;return d?path.join(base,d,'chrome-linux','chrome'):undefined;}
const arg=(nom,def=null)=>{const i=process.argv.indexOf(nom);return i>0?process.argv[i+1]:def;};
const TYPES=['pointerover','pointerenter','pointerdown','pointermove','pointerup','pointercancel','pointerrawupdate','mouseover','mouseenter','mousedown','mousemove','mouseup','click','auxclick','contextmenu','wheel'];
const CHAMPS=['button','buttons','pressure','detail','deltaX','deltaY','deltaMode','wheelDeltaY','pointerId','pointerType','cancelable','composed','bubbles'];
/* Motif d'une suite : les types dans l'ordre, sans les déplacements d'approche (avant le premier geste) ; une série de couples
 * (pointermove, mousemove) est réduite à un seul couple. */
function motif(liste,ignorer=[]){const t=liste.map(e=>e.type).filter(x=>!ignorer.includes(x));
  while(t.length&&/move$/.test(t[0]))t.shift();
  const out=[];for(let i=0;i<t.length;i++){
    if(t[i]==='pointermove'&&t[i+1]==='mousemove'){if(!(out[out.length-2]==='pointermove'&&out[out.length-1]==='mousemove'))out.push('pointermove','mousemove');i++;continue;}
    out.push(t[i]);}
  return out;}
async function navigateur(){
  const pw=playwright(),b=await pw.chromium.launch({executablePath:executable(),headless:true});
  try{
    const p=await b.newPage({viewport:{width:1000,height:700}});
    await p.setContent(`<!doctype html><meta charset="utf-8"><canvas id="vue" width="800" height="600" style="position:absolute;left:40px;top:40px"></canvas><div id="autre" style="position:absolute;left:860px;top:40px;width:100px;height:100px"></div>`);
    await p.addScriptTag({content:lire('src/gestes-vue.js')});
    await p.evaluate(({TYPES,CHAMPS})=>{window.__L=[];const t0=performance.now();
      for(const t of TYPES)window.addEventListener(t,e=>{const o={type:e.type,isTrusted:e.isTrusted,classe:e.constructor.name,cible:e.target.id||e.target.nodeName,ms:Math.round(e.timeStamp-t0),x:e.clientX,y:e.clientY};
        for(const k of CHAMPS)if(e[k]!==undefined)o[k]=e[k];__L.push(o);},{capture:true,passive:true});
      window.__legacy=[];document.getElementById('vue').addEventListener('mousewheel',e=>__legacy.push({isTrusted:e.isTrusted,wheelDelta:e.wheelDelta,deltaY:e.deltaY}),{passive:true});},{TYPES,CHAMPS});
    const releve=async f=>{await p.evaluate(()=>{__L.length=0;__legacy.length=0;});await f();await p.waitForTimeout(150);return p.evaluate(()=>({evenements:__L.slice(),legacy:__legacy.slice()}));};
    const R={chromium:b.version(),date:new Date().toISOString().slice(0,10)};
    await p.mouse.move(440,340);
    R.glisserGauche=await releve(async()=>{await p.mouse.down({button:'left'});await p.mouse.move(520,360,{steps:8});await p.mouse.up({button:'left'});});
    await p.mouse.move(440,340);
    R.glisserDroit=await releve(async()=>{await p.mouse.down({button:'right'});await p.mouse.move(480,340,{steps:4});await p.mouse.up({button:'right'});});
    await p.mouse.move(800,340);
    R.glisserSortant=await releve(async()=>{await p.mouse.down();await p.mouse.move(900,80,{steps:4});await p.mouse.up();});
    await p.mouse.move(440,340);
    R.moletteDezoom=await releve(async()=>{await p.mouse.wheel(0,100);await p.waitForTimeout(80);await p.mouse.wheel(0,100);});
    R.moletteZoom=await releve(async()=>{await p.mouse.wheel(0,-100);});
    R.clicSimple=await releve(async()=>{await p.mouse.down();await p.mouse.up();});
    /* Synthétiques : ce que la page voit, et ce qu'elle ne voit pas. */
    R.wheelSynthetiqueNaif=await releve(()=>p.evaluate(()=>document.getElementById('vue').dispatchEvent(new WheelEvent('wheel',{bubbles:true,cancelable:true,composed:true,clientX:440,clientY:340,deltaY:100,view:window}))));
    R.mousewheelSynthetique=await releve(()=>p.evaluate(()=>document.getElementById('vue').dispatchEvent(new WheelEvent('mousewheel',{bubbles:true,cancelable:true,composed:true,clientX:440,clientY:340,deltaY:100,wheelDeltaY:-120,view:window}))));
    R.sourisSynthetique=await releve(()=>p.evaluate(()=>{const c=document.getElementById('vue');for(const t of ['mousedown','mousemove','mouseup'])c.dispatchEvent(new MouseEvent(t,{bubbles:true,cancelable:true,composed:true,clientX:440,clientY:340,button:0,buttons:t==='mouseup'?0:1,view:window}));}));
    /* La suite d'Ariane (src/gestes-vue.js), émise dans la page. */
    const ariane=(fn,args)=>releve(()=>p.evaluate(async([fn,args])=>{const G=window.BananeGestesVue,seq=G[fn]({...args,alea:()=>.5});
      await G.emettre(document.getElementById('vue'),seq,{fenetre:window,attendre:ms=>new Promise(r=>setTimeout(r,ms))});},[fn,args]));
    R.arianeGlisser=await ariane('sequenceGlisser',{x0:440,y0:340,x1:520,y1:360});
    R.arianeGlisserClicFinal=await ariane('sequenceGlisser',{x0:440,y0:340,x1:520,y1:360,reglages:{clicFinal:true}});
    R.arianeMolette=await ariane('sequenceMolette',{x:440,y:340,crans:2,sens:1});
    /* Lecture : motifs comparés (le `pointerrawupdate` n'existe que s'il a un écouteur ; ici il en a un). */
    const sans=['pointerrawupdate','pointerover','pointerenter','mouseover','mouseenter'];
    R.comparaison={
      glisser:{chromium:motif(R.glisserGauche.evenements,sans),ariane:motif(R.arianeGlisser.evenements,sans),arianeClicFinal:motif(R.arianeGlisserClicFinal.evenements,sans)},
      molette:{chromium:motif(R.moletteDezoom.evenements,sans),ariane:motif(R.arianeMolette.evenements,sans)},
      clicApresGlisser:R.glisserGauche.evenements.some(e=>e.type==='click'),
      clicApresGlisserSortant:R.glisserSortant.evenements.find(e=>e.type==='click')?.cible??null,
      menuContextuelGlisserDroit:R.glisserDroit.evenements.findIndex(e=>e.type==='contextmenu'),
      mousewheelHistoriquePourWheelDeConfiance:R.moletteDezoom.legacy.length,
      mousewheelHistoriquePourWheelSynthetique:R.wheelSynthetiqueNaif.legacy.length,
      wheelDeltaYSynthetiqueNaif:R.wheelSynthetiqueNaif.evenements.find(e=>e.type==='wheel')?.wheelDeltaY??null,
      wheelDeltaYConfiance:R.moletteDezoom.evenements.find(e=>e.type==='wheel')?.wheelDeltaY??null,
      wheelDeltaYAriane:R.arianeMolette.evenements.find(e=>e.type==='wheel')?.wheelDeltaY??null,
      pointeurPourSourisSynthetique:R.sourisSynthetique.evenements.some(e=>e.type.startsWith('pointer')||e.type==='click'),
    };
    return R;
  }finally{await b.close();}
}
/* Fixture des essais : motifs et champs par type (sans horloge ni position). */
function fixture(R){
  const champs=liste=>{const out={};for(const e of liste){if(out[e.type])continue;out[e.type]=Object.fromEntries(['classe',...CHAMPS.filter(k=>k!=='bubbles')].filter(k=>e[k]!==undefined).map(k=>[k,e[k]]));}return out;};
  const sans=['pointerrawupdate','pointerover','pointerenter','mouseover','mouseenter'];
  return {format:'ariane-gestes-chromium-v1',chromium:R.chromium,date:R.date,source:'tools/releve-gestes-vue.cjs navigateur (gestes de confiance par le protocole du navigateur)',
    glisserGauche:{motif:motif(R.glisserGauche.evenements,sans),champs:champs(R.glisserGauche.evenements)},
    glisserDroit:{motif:motif(R.glisserDroit.evenements,sans),champs:champs(R.glisserDroit.evenements)},
    molette:{motif:motif(R.moletteDezoom.evenements,sans),champs:champs(R.moletteDezoom.evenements),zoom:champs(R.moletteZoom.evenements).wheel,mousewheelHistorique:R.moletteDezoom.legacy[0]||null},
    clicSimple:{motif:motif(R.clicSimple.evenements,sans)},
    synthetique:{wheelVersMousewheel:R.comparaison.mousewheelHistoriquePourWheelSynthetique,wheelDeltaYNaif:R.comparaison.wheelDeltaYSynthetiqueNaif,pointeurPourSouris:R.comparaison.pointeurPourSourisSynthetique}};
}

/* ------------------------------------------------------------------ B et C : maquette */
const PAGE_FILES=['vendor/capture-core.js','vendor/lidar.js','src/core.js','src/settings.js','src/lod-signature.js','src/merge-clouds.js','src/native-lidar.js','src/native-page.js','src/gestes-vue.js','src/adapter-page.js'];
async function maquette(dossier){
  dossier=dossier?path.resolve(dossier):null;
  if(!dossier||!fs.existsSync(path.join(dossier,'tests/esv-maquette/serveur.cjs')))throw Error('--maquette DOSSIER : racine d\'un dépôt qui contient tests/esv-maquette (branche claude/esv-locale-audit).');
  const {demarrer}=require(path.join(dossier,'tests/esv-maquette/serveur.cjs'));
  const pw=playwright(),b=await pw.chromium.launch({executablePath:executable(),headless:true});const sortie={};
  async function ouvrir(modele){
    const serveur=await demarrer();const p=await b.newPage({viewport:{width:1200,height:1000}});const erreurs=[];p.on('pageerror',e=>erreurs.push(e.message));
    await p.goto(`${serveur.url}/tests/esv-maquette/esv.html?cuts=6&latence=20`);await p.evaluate(()=>window.__maquette.pret);await p.waitForFunction(()=>window.__maquette.etat().railsPrets);
    await p.addScriptTag({content:`window.__ARIANE_PROPRIETAIRE={id:'releve',version:'releve',versionName:'releve'};window.__messages=[];addEventListener('message',e=>{if(e.data?.kind==='banane3:progress')window.__messages.push(e.data);});`});
    for(const f of PAGE_FILES)await p.addScriptTag({content:lire(f)});
    if(modele){await p.evaluate(m=>{window.__modeleNavigation=m;},modele);await p.addScriptTag({content:lire('tests/helpers/modele-navigation.js')});}
    const appel=(action,args=[])=>p.evaluate(([action,args])=>new Promise(res=>{const id='i'+Math.random();
      const f=e=>{if(e.data?.kind==='banane3:result'&&e.data.id===id){removeEventListener('message',f);res(e.data);}};addEventListener('message',f);
      postMessage({kind:'banane3:command',id,channel:'releve',proprietaire:'releve',action,args,sentAt:Date.now()},location.origin);}),[action,args]);
    const camera=()=>p.evaluate(()=>{const c=window.viewer.scene.getActiveCamera(),m=c.matrixWorld.elements,P=c.projectionMatrix.elements,w=window.viewer.renderer.domElement.getBoundingClientRect().width;
      return {pos:[m[12],m[13],m[14]],echelle:P[0],mmPx:2/P[0]/w*1000,vue:[w,window.viewer.renderer.domElement.getBoundingClientRect().height]};});
    const requetes=async()=>(await (await fetch(serveur.url+'/maquette/journal')).json()).requetes.filter(r=>/ept-data/.test(r.chemin)).length;
    return {p,serveur,erreurs,appel,camera,requetes,fermer:async()=>{await p.close();await serveur.fermer();}};
  }
  const ecart=(a,b)=>({deplacementMm:a.pos.map((v,i)=>Math.round((b.pos[i]-v)*1e4)/10),zoom:Math.round(a.echelle/b.echelle*1000)/1000});
  /* Une cible à `mm` du rail gauche, dans le plan de coupe, vers le rail droit (le latéral de la vue). */
  const decaleur=etat=>{const L=etat.rails.left.positionSceneRelative,R=etat.rails.right.positionSceneRelative,u=[R[0]-L[0],R[1]-L[1]],n=Math.hypot(...u);
    return (p,mm)=>[p[0]+u[0]/n*mm/1000,p[1]+u[1]/n*mm/1000,p[2]];};
  /* B : maquette seule, gestes synthétiques d'Ariane. */
  {const m=await ouvrir(null);try{
    const etat=(await m.appel('state')).result;await m.appel('capture',[etat]).catch(()=>null);
    const c0=await m.camera(),r0=await m.requetes();
    await m.p.evaluate(async()=>{const G=window.BananeGestesVue,c=window.viewer.renderer.domElement,r=c.getBoundingClientRect(),x=r.left+r.width/2,y=r.top+r.height/2;
      await G.emettre(c,G.sequenceMolette({x,y,crans:3,sens:1,alea:()=>.5}),{fenetre:window,attendre:ms=>new Promise(res=>setTimeout(res,ms))});});
    await m.p.waitForTimeout(400);const c1=await m.camera(),r1=await m.requetes();
    await m.p.evaluate(async()=>{const G=window.BananeGestesVue,c=window.viewer.renderer.domElement,r=c.getBoundingClientRect();
      await G.emettre(c,G.sequenceGlisser({x0:r.left+150,y0:r.top+700,x1:r.left+350,y1:r.top+700,alea:()=>.5}),{fenetre:window,attendre:ms=>new Promise(res=>setTimeout(res,ms))});});
    await m.p.waitForTimeout(400);const c2=await m.camera(),r2=await m.requetes();
    const rails=(await m.appel('state')).result.rails;
    const amener=(await m.appel('amenerDansLaVue',['left',decaleur({rails})(rails.left.positionSceneRelative,260),etat.identity,{essai:true}])).result;
    /* Le cut suivant : la vue y est-elle recalculée (centre et échelle) ? */
    const cSel=await m.camera();await m.appel('next',[etat.identity]);await m.p.waitForFunction(()=>window.__maquette.etat().railsPrets);await m.p.waitForTimeout(300);const cSuiv=await m.camera();
    const journal=await m.p.evaluate(()=>window.__maquette.journal.filter(e=>!['noeuds-charges'].includes(e.type)).slice(-12).map(e=>e.type));
    sortie.maquette={pixel:{mmPx:Math.round(c0.mmPx*1000)/1000,vuePx:c0.vue},molette3Crans:{...ecart(c0,c1),requetesNoeuds:r1-r0},glisser200Px:{...ecart(c1,c2),requetesNoeuds:r2-r1},
      amenerDansLaVue:amener,cutSuivant:{echelleRelative:Math.round(cSuiv.echelle/c0.echelle*1e6)/1e6,mmPx:Math.round(cSuiv.mmPx*1000)/1000},journalPage:journal,erreurs:m.erreurs};
  }finally{await m.fermer();}}
  /* C : maquette + modèle supposé, deux hypothèses. */
  for(const persiste of [true,false]){const m=await ouvrir({persisteSelect:persiste,facteurCran:1.1,amortiImages:3});try{
    const etat=(await m.appel('state')).result;await m.appel('capture',[etat]).catch(()=>null);const avant=(await m.appel('state')).result;
    const r0=await m.requetes(),c0=await m.camera();
    const L=avant.rails.left.positionSceneRelative,decal=decaleur(avant);
    const amener=(await m.appel('amenerDansLaVue',['left',decal(L,260),avant.identity,{essai:true}])).result;
    const c1=await m.camera();
    const amenerGlisser=(await m.appel('amenerDansLaVue',['left',decal(L,260),avant.identity,{essai:true,dezoomMax:1.01}])).result;
    const c2=await m.camera();
    /* Pose : rails déplacés de 210 mm (hors de la vue de ±200 mm), comme une décision de lot sur une voie décalée. */
    const proposals=Object.fromEntries(['left','right'].map(s=>[s,{delta:[0,.21,0]}]));
    const pose=await m.appel('apply',[avant,proposals,{deplacerVue:{cotes:{left:{geste:'dezoom'},right:{geste:'dezoom'}},dezoomMax:1.5,glissementPxMax:250,gestesMax:3}}]);
    const c3=await m.camera(),apres=(await m.appel('state')).result;
    const ecartPose=['left','right'].map(s=>{const a=avant.rails[s].positionSceneRelative,b=apres.rails[s].positionSceneRelative;return Math.round(Math.hypot(b[0]-a[0],b[1]-a[1],b[2]-a[2])*1e4)/10;});
    const nav=await m.p.evaluate(()=>window.__navigation),rPose=await m.requetes();
    /* Le cut suivant, après la remise : échelle habituelle ? */
    await m.appel('next',[apres.identity]);await m.p.waitForFunction(()=>window.__maquette.etat().railsPrets);await m.p.waitForTimeout(300);const c4=await m.camera();
    sortie['modele'+(persiste?'ZoomGarde':'ZoomRemis')]={amenerDezoom:amener,zoomApresEssai:ecart(c0,c1).zoom,amenerGlisser:amenerGlisser,zoomApresEssaiGlisser:ecart(c0,c2).zoom,
      pose:pose.error?{erreur:pose.error}:{ok:true,rapport:pose.result?.deplacerVue??null,deplacementPoseMm:ecartPose},zoomApresPose:ecart(c0,c3).zoom,cutSuivant:{echelleRelative:Math.round(c4.echelle/c0.echelle*1e6)/1e6},requetesNoeudsPendantLesGestes:rPose-r0,navigation:nav,erreurs:m.erreurs};
  }finally{await m.fermer();}}
  await b.close();return sortie;
}

(async()=>{
  const mode=process.argv[2];
  if(mode==='navigateur'){const R=await navigateur();const f=arg('--fixture');
    if(f){fs.writeFileSync(path.resolve(f),JSON.stringify(fixture(R),null,1)+'\n');console.error('fixture écrite : '+f);}
    process.stdout.write(JSON.stringify(process.argv.includes('--complet')?R:{chromium:R.chromium,comparaison:R.comparaison},null,1)+'\n');return;}
  if(mode==='maquette'){const S=await maquette(arg('--maquette'));const j=arg('--json');if(j)fs.writeFileSync(path.resolve(j),JSON.stringify(S,null,1)+'\n');process.stdout.write(JSON.stringify(S,null,1)+'\n');return;}
  console.error('Usage : node tools/releve-gestes-vue.cjs navigateur [--fixture F] [--complet] | maquette --maquette DOSSIER [--json F]');process.exit(2);
})().catch(e=>{console.error(e.stack||e.message);process.exit(1);});

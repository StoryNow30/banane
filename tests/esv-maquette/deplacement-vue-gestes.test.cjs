'use strict';
/* CH-018 : les trois gestes de déplacement de la vue (src/deplacement-vue.js) joués sur la maquette ESV, dans un vrai Chromium.
 * CE QUE LA MAQUETTE SIMULE : rien par elle-même (elle n'écoute ni la molette ni le glisser sur sa vue). On lui greffe le modèle de
 * navigation de tests/helpers/modele-navigation.js, que j'ai écrit : zoom à la molette (`wheel`, ou `mousewheel` seul = vue sourde au
 * `wheel` synthétique), translation au glisser du bouton choisi (gauche ou droit). Le modèle compte les événements reçus.
 * CE QU'ELLE NE SIMULE PAS : ESV. Quel geste le vrai ESV prend est INCONNU ; les essais montrent seulement que le module distingue,
 * par la caméra mesurée, le geste qui marche de ceux qui ne marchent pas, et le journal le dit. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const N=require('./navigateur.cjs');
const raison=N.indisponible(),opts=raison?{skip:raison}:{};

async function preparer(modele){
  const env=await N.ouvrir({maquette:{cuts:4,latence:10,latenceRails:0}});
  await env.injecter();
  for(const f of ['src/gestes-vue.js','src/deplacement-vue.js'])await env.page.addScriptTag({content:N.lire(f)});
  await env.page.evaluate(m=>{window.__modeleNavigation=m;},modele);
  await env.page.addScriptTag({content:N.lire('tests/helpers/modele-navigation.js')});
  return env;
}
/* Joue `geste` dans la page : caméra lue par `cameraSnapshot`, relue immobile (3 lectures égales à 80 ms), sans rien cliquer. */
function jouer(page,geste,tentativesMax=2){
  return page.evaluate(async([geste,tentativesMax])=>{
    const D=window.BananeDeplacementVue,L=window.BananeLidar,cv=window.viewer.renderer.domElement,r=cv.getBoundingClientRect();
    const lire=()=>L.cameraSnapshot(window.viewer,[0,0,0]);
    const immobile=async()=>{let prec=null,n=0;for(let i=0;i<40;i++){await new Promise(f=>setTimeout(f,80));const c=lire(),k=JSON.stringify([c.cameraToSceneRelative,c.projection]);n=k===prec?n+1:0;prec=k;if(n>=2)return c;}return lire();};
    const emettre=seq=>window.BananeGestesVue.emettre(cv,seq,{fenetre:window,attendre:ms=>new Promise(f=>setTimeout(f,ms))});
    const x=Math.round(r.left+r.width/2),y=Math.round(r.top+r.height/2);
    const plan={x,y,crans:3,sens:1,x0:x-100,y0:y,x1:x+60,y1:y};
    const journal=window.__journal||(window.__journal=new D.Journal());
    const res=await D.deplacer({geste,plan,lireCamera:lire,emettre,immobile,journal,tentativesMax});
    return {res,resume:journal.resume(),nav:{...window.__navigation,options:undefined}};
  },[geste,tentativesMax]);
}

test('vue sourde à la molette synthétique, glisser gauche suivi : seul glisse-synthetique marche',opts,async()=>{
  const env=await preparer({molette:'mousewheel',boutonGlisser:0,facteurCran:1.1,gainGlisser:1,amortiImages:0});
  try{
    const a=await jouer(env.page,'molette');
    assert.equal(a.res.ok,false);assert.equal(a.res.raison,'camera-immobile');assert.equal(a.res.tentatives,2);
    const b=await jouer(env.page,'clic-droit');
    assert.equal(b.res.ok,false);assert.equal(b.res.raison,'camera-immobile');
    assert.ok(b.nav.evenements.contextmenu>=1,'le contextmenu est bien arrivé à la vue');
    const c=await jouer(env.page,'glisse-synthetique');
    assert.equal(c.res.ok,true,JSON.stringify(c.res));assert.equal(c.res.preuve.type,'deplacement');
    assert.ok(Math.abs(c.res.preuve.deplacementMm-160*0.524)<8,'160 px × 0,524 mm : '+c.res.preuve.deplacementMm);
    const R=c.resume;assert.equal(R.meilleur,'glisse-synthetique');
    assert.equal(R.gestes.molette.immobiles,2);assert.equal(R.gestes['glisse-synthetique'].mouvements,1);
    assert.deepEqual(env.erreurs,[]);
  }finally{await env.fermer();}
});

test('vue qui prend le glisser au bouton droit : seul clic-droit marche',opts,async()=>{
  const env=await preparer({molette:'mousewheel',boutonGlisser:2,facteurCran:1.1,gainGlisser:1,amortiImages:0});
  try{
    const a=await jouer(env.page,'glisse-synthetique');assert.equal(a.res.ok,false);assert.equal(a.res.raison,'camera-immobile');
    const b=await jouer(env.page,'clic-droit');assert.equal(b.res.ok,true,JSON.stringify(b.res));
    assert.equal(b.resume.meilleur,'clic-droit');
  }finally{await env.fermer();}
});

test('vue qui prend la molette (wheel) : molette marche, preuve = dézoom mesuré',opts,async()=>{
  const env=await preparer({molette:'wheel',boutonGlisser:0,facteurCran:1.1,gainGlisser:1,amortiImages:3});
  try{
    const a=await jouer(env.page,'molette');assert.equal(a.res.ok,true,JSON.stringify(a.res));
    assert.equal(a.res.tentatives,1);assert.equal(a.res.preuve.type,'zoom');
    assert.ok(Math.abs(a.res.preuve.zoom-Math.pow(1.1,3))<0.01,'3 crans de 1,1 : '+a.res.preuve.zoom);
    assert.equal(a.nav.crans,3);
  }finally{await env.fermer();}
});

test('aucun click dans la vue, quel que soit le geste',opts,async()=>{
  const env=await preparer({molette:'wheel',boutonGlisser:0,facteurCran:1.1,gainGlisser:1,amortiImages:0});
  try{
    await env.page.evaluate(()=>{window.__clics=0;for(const t of ['click','auxclick'])window.addEventListener(t,()=>window.__clics++,true);});
    for(const g of ['molette','clic-droit','glisse-synthetique'])await jouer(env.page,g,1);
    assert.equal(await env.page.evaluate(()=>window.__clics),0);
  }finally{await env.fermer();}
});

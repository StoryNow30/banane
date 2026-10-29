'use strict';
/* CH-018 : déplacement de la vue, le geste est un réglage (molette, clic-droit, glisse-synthetique), éteint par défaut.
 * Monde simulé SANS navigateur : une caméra, et un `emettre` qui la bouge (ou non) selon les événements reçus. Ce n'est pas ESV.
 * Ce que les essais prouvent : la preuve de succès est le mouvement MESURÉ de la caméra, jamais l'envoi du geste ; le plafond
 * de tentatives tient ; le journal dit, par geste, ce qui a marché. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const D=require('../src/deplacement-vue.js'),G=require('../src/gestes-vue.js'),REF=require('./fixtures/gestes-chromium.json');
const alea=()=>.5;

const camera=(x=0,y=0,echelle=5)=>({cameraToSceneRelative:[1,0,0,0, 0,1,0,0, 0,0,1,0, x,y,0,1],projection:[echelle,0,0,0, 0,echelle,0,0, 0,0,-1,0, 0,0,0,1],viewport:{width:800,height:600}});
/* Monde : `reponses[type de geste]` = fonction (caméra) -> caméra, ou absent (vue sourde). */
function monde(reponses={}){
  const m={cam:camera(),emissions:[],types:[]};
  m.lireCamera=()=>m.cam;
  m.immobile=async()=>m.cam;
  m.emettre=async seq=>{m.types.push(seq.map(d=>d.type));
    const geste=seq.some(d=>d.type==='wheel')?'molette':seq.some(d=>d.type==='contextmenu')?'clic-droit':seq.some(d=>d.type==='pointerdown')?'glisse-synthetique':'rien';
    m.emissions.push(geste);const f=reponses[geste];const reponse=typeof f==='function'?f:Array.isArray(f)?f[m.emissions.filter(g=>g===geste).length-1]:null;
    if(reponse)m.cam=reponse(m.cam);return {evenements:seq.length};};
  return m;
}
const dezoom=f=>c=>camera(c.cameraToSceneRelative[12],c.cameraToSceneRelative[13],c.projection[0]/f);
const panne=(dx,dy)=>c=>camera(c.cameraToSceneRelative[12]+dx,c.cameraToSceneRelative[13]+dy,c.projection[0]);
const plan={x:400,y:300,crans:3,sens:1,x0:300,y0:300,x1:380,y1:300};
async function lancer(m,geste,extra={}){
  const journal=extra.journal||new D.Journal();
  const r=await D.deplacer({geste,plan,lireCamera:m.lireCamera,emettre:m.emettre,immobile:m.immobile,journal,alea,...extra});
  return {r,journal};
}

test('éteint par défaut, geste molette, trois gestes connus, tout autre geste refusé',()=>{
  assert.equal(D.DEFAUTS.actif,false);assert.equal(D.DEFAUTS.geste,'molette');
  assert.deepEqual([...D.GESTES],['molette','clic-droit','glisse-synthetique']);
  assert.equal(D.reglages().actif,false);assert.equal(D.reglages().geste,'molette');
  const ok=D.reglages({actif:true,geste:'clic-droit',tentativesMax:2});assert.equal(ok.actif,true);assert.equal(ok.geste,'clic-droit');assert.equal(ok.erreur,null);
  const mauvais=D.reglages({actif:true,geste:'telepathie'});assert.equal(mauvais.actif,false,'geste inconnu : le module reste éteint');assert.equal(mauvais.erreur,'geste-inconnu');
  assert.equal(D.reglages({actif:true,tentativesMax:99}).tentativesMax,D.PLAFOND_TENTATIVES,'le plafond de tentatives ne se dépasse pas par réglage');
  assert.equal(D.reglages({actif:true,tentativesMax:0}).tentativesMax,1);
  assert.ok(Object.isFrozen(D.DEFAUTS));
});

test('clic droit : suite de Chromium (pointerdown bouton 2, contextmenu, déplacements, pointerup), sans auxclick ni click par défaut',()=>{
  const seq=G.sequenceClicDroit({x0:300,y0:300,x1:380,y1:320,alea}),t=seq.map(d=>d.type);
  const i=t.indexOf('pointerdown');assert.ok(i>=0);
  assert.equal(seq[i].init.button,2);assert.equal(seq[i].init.buttons,2);
  assert.deepEqual(t.slice(i,i+3),['pointerdown','mousedown','contextmenu'],'sous Linux, contextmenu part dès l\'appui');
  assert.equal(t.at(-1),'mouseup');assert.ok(!t.includes('click'));assert.ok(!t.includes('auxclick'));
  assert.ok(t.includes('pointermove'));
  assert.equal(G.sequenceClicDroit({x0:300,y0:300,x1:380,y1:320,alea,reglages:{auxclicFinal:true}}).at(-1).type,'auxclick');
  assert.equal(seq.find(d=>d.type==='pointerup').init.button,2);
  /* Même motif que la référence Chromium (relevé de confiance), hors auxclick final. */
  const motif=[];while(/move$/.test(t[0]))t.shift();for(let k=0;k<t.length;k++){if(t[k]==='pointermove'&&t[k+1]==='mousemove'){if(motif.at(-1)!=='mousemove')motif.push('pointermove','mousemove');k++;continue;}motif.push(t[k]);}
  assert.deepEqual(motif,REF.glisserDroit.motif.filter(x=>x!=='auxclick'));
});

test('aucun des trois gestes n\'émet de click (ESV pose le rail courant sur un clic dans la vue)',async()=>{
  for(const g of D.GESTES){const m=monde();await lancer(m,g,{reglages:D.reglages({actif:true,geste:g})});
    for(const t of m.types)assert.ok(!t.includes('click'),g+' : '+t.join(','));}
});

test('molette qui marche : preuve = zoom mesuré, une seule émission',async()=>{
  const m=monde({molette:dezoom(1.1)});const {r,journal}=await lancer(m,'molette');
  assert.equal(r.ok,true);assert.equal(r.geste,'molette');assert.equal(r.tentatives,1);assert.equal(m.emissions.length,1);
  assert.ok(r.preuve.zoom>1.09&&r.preuve.zoom<1.11);assert.equal(r.preuve.type,'zoom');
  assert.equal(journal.resume().gestes.molette.mouvements,1);
});

test('molette sourde : caméra immobile sur toutes les tentatives, plafond tenu, raison camera-immobile',async()=>{
  const m=monde();const {r,journal}=await lancer(m,'molette',{tentativesMax:3});
  assert.equal(r.ok,false);assert.equal(r.raison,'camera-immobile');assert.equal(r.tentatives,3);assert.equal(m.emissions.length,3,'exactement 3 émissions, pas une de plus');
  const j=journal.resume().gestes.molette;assert.equal(j.tentatives,3);assert.equal(j.immobiles,3);assert.equal(j.mouvements,0);assert.equal(j.taux,0);
});

test('l\'envoi du geste ne prouve rien : un succès vient du mouvement, pas de l\'émission',async()=>{
  const m=monde();const {r}=await lancer(m,'clic-droit',{tentativesMax:1});
  assert.equal(m.emissions.length,1);assert.equal(r.ok,false,'geste émis mais caméra immobile : pas de succès');
  /* Un mouvement sous le seuil (bruit d'arrondi) n'est pas un mouvement. */
  const m2=monde({'clic-droit':panne(1e-6,0)});assert.equal((await lancer(m2,'clic-droit',{tentativesMax:1})).r.ok,false);
});

test('réessai : une première tentative immobile, une seconde qui bouge',async()=>{
  const m=monde({molette:[null,dezoom(1.1)]});const {r,journal}=await lancer(m,'molette',{tentativesMax:3});
  assert.equal(r.ok,true);assert.equal(r.tentatives,2);assert.equal(m.emissions.length,2,'on s\'arrête dès que la caméra a bougé');
  const j=journal.resume().gestes.molette;assert.equal(j.tentatives,2);assert.equal(j.immobiles,1);assert.equal(j.mouvements,1);assert.equal(j.taux,.5);
});

test('molette dans le mauvais sens (zoom au lieu de dézoom) : arrêt tout de suite, pas de réessai',async()=>{
  const m=monde({molette:dezoom(1/1.1)});const {r,journal}=await lancer(m,'molette',{tentativesMax:3});
  assert.equal(r.ok,false);assert.equal(r.raison,'sens-inverse');assert.equal(m.emissions.length,1);
  assert.equal(journal.resume().gestes.molette.sensInverses,1);
});

test('clic droit et glisse synthétique : la caméra se déplace, preuve en mm dans le repère de la caméra',async()=>{
  for(const g of ['clic-droit','glisse-synthetique']){
    /* Un glisser de 80 px vers la droite : la caméra part vers la gauche (le fond suit la souris), 80 px × 0,5 mm. */
    const m=monde({[g]:panne(-0.04,0)});const {r,journal}=await lancer(m,g);
    assert.equal(r.ok,true,g);assert.equal(r.preuve.type,'deplacement');assert.ok(Math.abs(r.preuve.deplacementMm-40)<0.5,g+' : '+r.preuve.deplacementMm);
    assert.equal(m.emissions[0],g);assert.equal(journal.resume().gestes[g].mouvements,1);}
});

test('glisser dans le mauvais sens : sens-inverse, signalé, sans réessai',async()=>{
  const m=monde({'glisse-synthetique':panne(0.04,0)});const {r}=await lancer(m,'glisse-synthetique',{tentativesMax:3});
  assert.equal(r.ok,false);assert.equal(r.raison,'sens-inverse');assert.equal(m.emissions.length,1);
});

test('caméra illisible : arrêt sans émettre une seconde fois',async()=>{
  const m=monde({molette:dezoom(1.1)});m.lireCamera=()=>null;
  const {r}=await lancer(m,'molette',{tentativesMax:3});assert.equal(r.ok,false);assert.equal(r.raison,'camera-illisible');assert.equal(m.emissions.length,0,'pas de geste à l\'aveugle');
});

test('la garde d\'annulation levée par emettre traverse, rien n\'est avalé',async()=>{
  const m=monde();m.emettre=async()=>{throw Error('Action interrompue.');};
  await assert.rejects(()=>lancer(m,'molette'),/interrompue/);
});

test('geste inconnu : refusé sans rien émettre',async()=>{
  const m=monde();const {r}=await lancer(m,'telepathie');assert.equal(r.ok,false);assert.equal(r.raison,'geste-inconnu');assert.equal(m.emissions.length,0);
});

test('journal : par geste, cumulé sur plusieurs appels, sans position ni coordonnée absolue',async()=>{
  const journal=new D.Journal();
  await lancer(monde({molette:dezoom(1.1)}),'molette',{journal});
  await lancer(monde(),'molette',{journal,tentativesMax:2});
  await lancer(monde({'clic-droit':panne(-0.03,0.01)}),'clic-droit',{journal});
  const R=journal.resume();
  assert.equal(R.version,D.VERSION);
  assert.equal(R.gestes.molette.tentatives,3);assert.equal(R.gestes.molette.mouvements,1);assert.equal(R.gestes.molette.immobiles,2);
  assert.equal(R.gestes['clic-droit'].mouvements,1);assert.equal(R.gestes['glisse-synthetique'].tentatives,0);
  assert.equal(R.meilleur,'clic-droit','le geste au meilleur taux (au moins une tentative)');
  const s=JSON.stringify(R);assert.ok(!/cameraToSceneRelative|projection|positionScene/.test(s));
  assert.ok(R.gestes['clic-droit'].deplacementMedianMm>0);
});

test('journal vide : aucun meilleur geste inventé',()=>{
  const R=new D.Journal().resume();assert.equal(R.meilleur,null);assert.deepEqual(Object.keys(R.gestes),[...D.GESTES]);
});

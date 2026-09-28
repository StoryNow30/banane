'use strict';
/* 4.8.0 (terrain du 28/09, partie 15) — ESV pose le rail sur le pixel ENTIER du
 * clic. Vue de 416 px pour 0,4 unité de scène (0,96 mm par pixel, fenêtre
 * d'ESV rétrécie) : un seul clic laissait le rail à plus de 1 mm de la cible
 * sur une partie des poses (« le clic n'a pas produit le déplacement
 * demandé »). Un second clic décalé d'un demi-pixel la ramène sous 1 mm. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const C=require('../vendor/capture-core.js'),K=require('../src/core.js'),{page}=require('./helpers/page.cjs');
/* ESV simulé : vue orthographique de 0,4 unité, clic tronqué au pixel (arrondi `arrondi`). */
function esvAuPixel(f,{largeur=416,hauteur=493,arrondi=Math.floor}={}){
  const cam=f.ctx.viewer.scene.getActiveCamera(),k=2/.4;cam.projectionMatrix={elements:[k,0,0,0,0,k,0,0,0,0,1,0,0,0,0,1]};
  let cote='left';for(const [id,s] of [['O2N3DCutLRClick','left'],['O2N3DCutRRClick','right']]){const n=f.nodes.get(id),c=n.click.bind(n);n.click=()=>{cote=s;c();};}
  const clics=[];
  f.ctx.viewer.renderer.domElement={getBoundingClientRect:()=>({left:0,top:0,width:largeur,height:hauteur}),dispatchEvent:e=>{
    const x=arrondi(e.clientX),y=arrondi(e.clientY);clics.push([e.clientX,e.clientY]);
    const rail=cote==='left'?f.left:f.right,monde=C.point(C.worldMatrix(cam),[(x/(largeur/2)-1)/k,(1-y/(hauteur/2))/k,-.2]);
    [rail.position.x,rail.position.y,rail.position.z]=monde;}};
  return clics;}
const deltas=[];for(let i=0;i<12;i++)deltas.push({left:{delta:[0,.0031*i-.017,.0027*i-.013]},right:{delta:[0,-.0023*i+.011,.0019*i-.009]}});
for(const arrondi of [Math.floor,Math.round,Math.ceil])
  test(`vue de 416 px, clic arrondi par ${arrondi.name} : chaque pose finit à 1 mm de la cible au plus`,async()=>{
    for(const proposals of deltas){const f=page();esvAuPixel(f,{arrondi});const before=await f.call('state');
      const r=await f.call('apply',before,proposals),cible=K.expectedPoses(before,proposals);
      for(const s of ['left','right'])assert.ok(C.distance(r.rails[s].positionSceneRelative,cible[s].positionSceneRelative)<=.001,`${s} ${JSON.stringify(proposals[s].delta)}`);}
  });
test('rail qui ne bouge pas : même refus qu’avant, sans nouveau clic inutile',async()=>{
  const f=page();const clics=esvAuPixel(f);f.ctx.viewer.renderer.domElement.dispatchEvent=e=>{clics.push(e);};
  const before=await f.call('state');
  await assert.rejects(f.call('apply',before,deltas[0]),/^Error: Le clic n’a pas produit le déplacement demandé pour left\. État à réconcilier\.$/);
  assert.equal(clics.length,1);
});
test('vue trop petite : le refus dit l’écart et la taille du pixel',async()=>{
  const f=page();esvAuPixel(f,{largeur:120,hauteur:140});const before=await f.call('state');let refus=null;
  for(const p of deltas){try{await f.call('apply',before,p);}catch(e){refus=e;break;}}
  assert.ok(refus,'au moins une pose refusée à 3,3 mm par pixel');
  assert.match(refus.message,/rail posé à \d+,\d mm de la cible, vue ESV à 3,33 mm par pixel \(agrandis la fenêtre d’ESV\)\. État à réconcilier\./);
});

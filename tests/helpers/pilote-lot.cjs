'use strict';
/* Lot Pilote GCV1 dans le service worker réel (`background.js` en vm, ESV
 * simulé), pour les essais d'acceptation du chantier 5. La composition GCV1 de
 * banc publie la science de la fixture à chaque armement ; comme la façade GCV1
 * du service worker, les rails du moteur sont attribués à GCV1 (sans cela, le
 * moteur refuse de différer : RAIL_NOT_ATTRIBUTED_TO_GCV1). */
const Shadow=require('../../src/gcv1-shadow.js'),K=require('../../src/core.js'),{Engine}=require('../../src/engine.js'),{base}=require('../fixtures.cjs');
const {withCameras}=require('./navigateur.cjs'),{background,gcv1Shadow}=require('./fond-relecture.cjs');
const SIDES=['left','right'],science=Shadow.scientificProposeBoth(base);
class EngineGCV1 extends Engine{async analyze(...a){const p=await super.analyze(...a);
  for(const s of SIDES)if(p?.rails?.[s])p.rails[s].geometryEngine='geometry-candidate-v1';return p;}}
/* `decision` : module de décision injecté (réel, espion ou factice). `start`
 * seulement : l'essai conduit lui-même la suite (`b.settle()`). */
async function pilote(decision,{start=100,end=101,policy='defer',lotDecision='apply',settings=require('../../src/settings.js'),esv=null}={}){
  const b=background({shadow:gcv1Shadow(science),globals:{BananeLotDecision:decision,BananeSettings:settings,BananeCore3:K,BananeEngine3:{Engine:EngineGCV1}}});
  // `esv` : réglage de l'ESV simulé avant le lot (navigation, silence…).
  if(esv)esv(b.adapter);
  const capture=b.adapter.capture.bind(b.adapter),captured=[];
  b.adapter.capture=async(...a)=>{const c=withCameras(await capture(...a));captured.push({cut:c.identity.cut,rails:K.clone(c.rails)});return c;};
  const applied=[],apply=b.adapter.apply.bind(b.adapter);
  b.adapter.apply=async(before,proposals)=>{applied.push(K.clone(proposals));return apply(before,proposals);};
  await b.api('connect',{tabId:1});await b.api('settings',{mode:'automatic-test'});
  await b.api('start',{part:23,start,end,testConfirmed:true,allowNavigationEvidence:true,lowConfidence:'attempt',
    geometryEngine:'geometry-candidate-v1',unresolvedPolicy:policy,lotDecision});
  return {b,captured,applied,observed:()=>b.store.events.filter(e=>e.type==='gcv1-shadow-observed').map(e=>e.lotObservation)};
}
async function lot(decision,options){const r=await pilote(decision,options);const view=await r.b.settle();return {...r,view,observed:r.observed()};}
module.exports={pilote,lot,science,SIDES};

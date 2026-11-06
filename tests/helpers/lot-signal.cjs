'use strict';
/* CH-062 — montage des essais « signal de fin de chargement d'ESV éteint pendant le LOT » (tests/lot-signal-eteint*.test.cjs).
 * Service worker réel en VM, moteur et GCV1 réels (tests/helpers/lot-profil.cjs). ESV simulé :
 *  - chaque capture porte la règle d'attente de ses vues : « stabilite » (repli) tant que la page n'a pas été rechargée par Ariane, « signal » ensuite
 *    (`signalApres:false` : le signal ne revient jamais) ;
 *  - chaque validation fait voir à l'observateur passif l'écriture de validation d'ESV (forme de src/esv-observer.js), sauf `preuve:false` ;
 *  - `chrome.tabs.reload` est imité : la page commence à se recharger (chargementEsvReset, comme chrome.tabs.onUpdated « loading »), ESV reste muet
 *    `muetMs`, puis répond sur une NOUVELLE page (pageId neuf), au même cut, ou sur la partie `partieApres` (ESV qui rouvre une autre partie),
 *    ou jamais (`jamaisPret`). Données synthétiques. */
const {production,base,K,S,SCOPE,attendre,EsvVue}=require('./lot-profil.cjs');

class EsvSignalLot extends EsvVue{
 constructor(o={}){super([]);this.rechargee=false;this.rechargements=0;this.muet=false;this.regles=[];this.relayer=null;
  Object.assign(this,{signalApres:true,muetMs:60,jamaisPret:false,partieApres:null,preuve:true},o);}
 sourd(){if(this.muet)throw Error('Adaptateur ESV sans réponse (simulé).');}
 async ping(){this.sourd();return {...await super.ping(),label:{pageId:this.identity.pageId,part:this.identity.part,cut:this.identity.cut}};}
 async state(){this.sourd();return super.state();}
 async capture(e){this.sourd();const d=await super.capture(e);const regle=this.rechargee&&this.signalApres?'signal':'stabilite';this.regles.push([this.identity.cut,regle]);
  d.readStrategy={...(d.readStrategy||{}),lecture:'rapide',attempts:['left','right'].map(side=>({side,attempt:1,status:'captured',regle}))};return d;}
 async validateAndNext(...a){this.sourd();const cut=this.identity.cut;const r=await super.validateAndNext(...a);
  if(this.preuve&&this.relayer){const t=Date.now();this.relayer([{seq:cut,kind:'write',method:'PUT',status:200,outcome:'done',attempt:1,railPairId:`traj/RK-${cut}`,bodyKeys:3,
   body:{ExtractionStatus:'valid',SeenByOperator:true,TreatedByOperator:true},rowIndex:cut,startedEpochMs:t,endedEpochMs:t+5,durationMs:5}]);}
  return r;}
}
const REGLAGE={actif:true,lectures:3,rechargementsMax:1,preuveMs:400,delaiAvantMs:0,sondageMs:20,attenteRepriseMs:3000,silenceListeMs:0,attenteSansListeMs:0};
/* Lot de `start` à `end` (partie 23). `reglage` : `lot.signalEteint` (undefined : le livré). */
async function lotSignal({reglage,esv={},start=111,end=115,avant=null}={}){
 const adapter=new EsvSignalLot(esv),b=production({adapter});
 b.ctx.BananeSettings={...b.ctx.BananeSettings,voiePrediteOmbre:{...S.voiePrediteOmbre,actif:false},deplacerVue:{...S.deplacerVue,actif:false},
  lot:{...S.lot,gardeApresDiffere:false,rechercheLarge:{...S.lot.rechercheLarge,actif:false},...(reglage!==undefined?{signalEteint:reglage}:{})}};
 adapter.relayer=entries=>b.raw({kind:'esv-observation',observer:'obs-ch062',entries});
 b.ctx.chrome.tabs.reload=async()=>{adapter.rechargements++;adapter.muet=true;b.get('chargementEsvReset')();
  if(!adapter.jamaisPret)setTimeout(()=>{adapter.muet=false;adapter.rechargee=true;adapter.identity.pageId='page-rechargee-'+adapter.rechargements;
   if(Number.isInteger(adapter.partieApres))adapter.identity.part=adapter.partieApres;},adapter.muetMs);};
 if(avant)avant(adapter,b);
 await b.api('connect',{tabId:1});await b.api('settings',{mode:'automatic-test'});
 adapter.identity.cut=start;adapter.rails=K.clone(base.rails);
 await b.api('start',{part:23,start,end,...SCOPE});
 return {b,adapter};
}
const ev=(b,type)=>b.store.events.filter(e=>e.type===type);
const etapes=b=>ev(b,'lot-signal-eteint').map(e=>e.etape);
const valides=b=>ev(b,'validation-accepted').map(e=>e.identity.cut);
const FINIS=['COMPLETED','FINISHED_WITH_UNCONFIRMED_ACTIONS','STOPPED','ERROR'];
/* Attend la fin du lot (moteur au repos, lot clos), ou un état donné ; rend la vue. */
async function attendreLot(b,{etat=null,ms=12000,quand=null}={}){const t=Date.now();
 for(;;){const e=b.get('engine'),s=e.s.batch?.state;
  if(!e.task&&!e.busy&&(etat?s===etat&&(!quand||quand()):FINIS.includes(s)))return b.api('view');
  if(Date.now()-t>ms)throw Error(`lot : état ${s} après ${ms} ms ; étapes ${JSON.stringify(etapes(b))} ; avis ${e.s.notice}`);
  await attendre(15);}}
async function etape(b,nom,ms=8000){const t=Date.now();for(;;){const e=ev(b,'lot-signal-eteint').find(x=>x.etape===nom);if(e)return e;
 if(Date.now()-t>ms)throw Error(`étape « ${nom} » absente : ${JSON.stringify(ev(b,'lot-signal-eteint').map(x=>[x.etape,x.motif]))} ; ${b.get('engine').s.notice}`);await attendre(15);}}
module.exports={EsvSignalLot,REGLAGE,lotSignal,ev,etapes,valides,attendreLot,etape,attendre,S};

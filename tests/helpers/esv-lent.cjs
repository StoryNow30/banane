'use strict';
/* 4.8.0 — ESV rafraîchi pendant un lot (direction, 27/09). ESV lent : le remède
 * est F5. Après F5, ESV repart du PREMIER cut non validé de la partie (le
 * premier différé), la page change de repère ; Ariane revient au cut du lot
 * par « cut non validé suivant », sans rien valider, puis rattache le lot à la
 * nouvelle page, appuis translatés. */
const L=require('../../src/lot-decision.js'),S=require('../../src/settings.js'),K=require('../../src/core.js');
const {pilote}=require('./pilote-lot.cjs');
const MUET='Adaptateur ESV sans réponse. Clique sur Connecter ; après une mise à jour, recharge ESV.';
const reglages=extra=>({...S,lot:{...S.lot,stateRetryMs:1,rafraichirPauseMs:1,rafraichirAttenteMs:5000,...extra}});
/* 101 différé (garde), 102 : lecture instable une fois. */
const espion={...L,decideCut(args){if(args.capture.identity.cut===101)return {version:L.DEFAULTS.version,stage:'deferred',reason:'guard',guardDeferred:true,guardMm:40,anchorsUsed:[100]};return L.decideCut(args);}};
const DECALAGE=[12.5,-3,0.25];
function decaler(rails,d){const r=K.clone(rails);for(const side of ['left','right']){const x=r[side];
  x.positionSceneRelative=x.positionSceneRelative.map((v,i)=>v+d[i]);
  for(const k of ['railLocalToSceneRelative','profileLocalToSceneRelative'])if(Array.isArray(x[k]))[12,13,14].forEach((j,i)=>x[k][j]+=d[i]);}return r;}
/* ESV simulé : lecture instable au 1er passage sur 102 ; F5 → nouvelle page, adaptateur absent jusqu'à la réinjection, premier non validé affiché. */
const esvLent=esv=>{const capture=esv.capture.bind(esv),state=esv.state.bind(esv),next=esv.next.bind(esv);let instable=true,absent=false,decalage=null;
  esv.capture=async(...a)=>{if(esv.identity.cut===102&&instable){instable=false;throw Error('Niveau de détail non stabilisé.');}return capture(...a);};
  esv.onReload=()=>{absent=true;decalage=DECALAGE;Object.assign(esv.identity,{pageId:'page-apres-F5',frameId:'repere-apres-F5',cut:101});esv.rails=decaler(esv.rails,DECALAGE);esv.recharges=(esv.recharges||0)+1;};
  esv.onInject=()=>{absent=false;};
  esv.state=async(...a)=>{if(absent)throw Error(MUET);return state(...a);};
  esv.next=async(...a)=>{const r=await next(...a);if(decalage){esv.rails=decaler(esv.rails,decalage);return state();}return r;};};
const attendreFin=async r=>{for(let i=0;i<400;i++){const v=await r.b.api('view');if(!['RUNNING','PAUSED'].includes(v.batch?.state)||v.batch?.stoppedAtEnd)return v;await new Promise(x=>setTimeout(x,5));}return r.b.api('view');};

module.exports={pilote,espion,esvLent,reglages,attendreFin,DECALAGE,L};

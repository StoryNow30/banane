'use strict';
require('./relecture-reglable.cjs');   /* test 27 : les empreintes de base de ces essais sont celles d'un lot sans relecture (choix réglable, coupée) */
/* 4.9.5.13 (test 13) — montage commun des essais du PROFIL DU LOT (tests/lot-profil-*.test.cjs) : service worker réel en VM, moteur et GCV1 réels, ESV
 * simulé avec une caméra par rail (tests/helpers/deplacer-vue-lot.cjs). Un essai lourd par fichier (délai de 20 s par fichier de tools/verify.cjs). */
const crypto=require('node:crypto');
const {lot,neutre,decisions,metier,SCOPE,EsvVue}=require('./deplacer-vue-lot.cjs');
const {production,memoire}=require('./perf-production.cjs'),{base,K}=require('../fixtures.cjs');
const S=require('../../src/settings.js');
const GOLDEN=require('../fixtures/lot-sans-vue-50-base.json');
const h=x=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
const VERSION_GOLDEN='4.9.5.4',VERSION=require('../../manifest.json').version;
const versionGolden=x=>JSON.parse(JSON.stringify(x).split(`"extensionVersion":"${VERSION}"`).join(`"extensionVersion":"${VERSION_GOLDEN}"`));
const ev=(b,type)=>b.store.events.filter(e=>e.type===type);
const scopeDe=b=>b.get('engine').s.batch.scope;
const attendre=ms=>new Promise(r=>setTimeout(r,ms));
/* Montage du différé : cuts 111 à 113, le 112 capturé sans point (le moteur s'abstient, la chaîne le diffère). La GCV2 est forcée sur le 112 :
 * `etat` 'poser-sans-valider' ou 'valider', la paire étant la pose de la chaîne du 111 (même rails de départ). */
class EsvTrou extends EsvVue{ajuster(){this.noPoints=this.identity.cut===112;}}
async function lotDiffere({etat=null,panne=false,profil=null,garde=false}={}){
 const adapter=new EsvTrou([]),b=production({adapter});
 /* Test 25 (D-268) : le déplacement de la vue est livré ALLUMÉ ; ces montages comparent les commandes à celles de la base, donc il est coupé ici (essayé dans tests/deplacer-vue-*.test.cjs). */
 const Sx={...b.ctx.BananeSettings,voiePrediteOmbre:{...S.voiePrediteOmbre,actif:false},deplacerVue:{...S.deplacerVue,actif:false}};if(profil)Sx.lot={...S.lot,profil};
 /* CH-019 : la garde « après un différé » (livrée allumée) différerait le 113 (1 appui, après le 112) ; coupée ici (`garde:undefined` : le livré). */
 if(garde!==undefined)Sx.lot={...(Sx.lot||S.lot),gardeApresDiffere:garde};b.ctx.BananeSettings=Sx;
 const G=b.ctx.BananeGcv2L1,forcees=[];
 b.ctx.BananeGcv2L1={...G,deciderDiffere:a=>{
  if(panne)throw Error('panne simulée de la GCV2');
  const r=G.deciderDiffere(a);if(!etat||a.capture.identity.cut!==112)return r;
  const p0=b.store.events.find(e=>e.type==='gcv1-shadow-observed'&&e.identity?.cut===111)?.lotObservation?.positions;
  const paire={left:{decal:G.decalage(a.capture.rails.left,p0.left)},right:{decal:G.decalage(a.capture.rails.right,p0.right)}};
  const d={...r.decision,etat,motif:etat==='valider'?null:'sous-tau',p:etat==='valider'?0.9:0.2,paire,hypothese:'H1',ecartDepartMm:Math.max(...['left','right'].map(s=>Math.hypot(...paire[s].decal)))};
  forcees.push(d);return {...r,decision:d,positions:G.positionsDe(a.capture,paire)};}};
 await b.api('connect',{tabId:1});await b.api('settings',{mode:'automatic-test'});
 adapter.identity.cut=111;adapter.rails=K.clone(base.rails);adapter.ajuster();
 await b.api('start',{part:23,start:111,end:113,...SCOPE});await b.settle();await attendre(30);
 return {b,adapter,forcees};
}
const d112=x=>decisions(x.b).find(([c])=>c===112)[1];
module.exports={lot,neutre,decisions,metier,SCOPE,EsvVue,production,memoire,base,K,S,GOLDEN,h,versionGolden,ev,scopeDe,attendre,EsvTrou,lotDiffere,d112};

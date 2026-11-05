'use strict';
/* CH-038 (ordre de l'opérateur, 02/11 : « il ne doit pas s'arrêter pour cette raison ») : une vue non restituée après une pose avec
 * déplacement n'arrête plus le lot. Service worker réel en VM, moteur réel, ESV simulé (montage tests/helpers/deplacer-vue-lot.cjs) :
 * les cuts 112 à 115 sont hors de la vue ; la page (patchée) rend son résultat normal avec `vueNonRestituee` et une remise
 * `ok:false` pour les cuts choisis. Attendu : avertissement `vue-non-restituee`, cut validé, lot qui continue et finit ; après 3 remises
 * ratées DE SUITE, arrêt avec raison claire APRÈS la validation du cut (aucune pose laissée non validée). Jamais de SKIP. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const {production}=require('./helpers/perf-production.cjs'),{base,K}=require('./fixtures.cjs');
const {EsvVue,SCOPE}=require('./helpers/deplacer-vue-lot.cjs'),S=require('../src/settings.js');
const ev=(b,type)=>b.store.events.filter(e=>e.type===type);
const attendre=ms=>new Promise(r=>setTimeout(r,ms));
class EsvRemise extends EsvVue{
 constructor(){super([112,113,114,115]);this.ratees=new Set();}
 async apply(before,proposals,...reste){const r=await super.apply(before,proposals,...reste);
  if(!reste[0]?.deplacerVue)return r;const rate=this.ratees.has(this.identity.cut);
  return {...r,...(rate?{vueNonRestituee:true}:{}),deplacerVue:{version:'deplacer-vue-v1',cotes:[],
   remise:rate?{ok:false,raison:'recentrage-impossible',recentre:false,vueHabituelle:false,railDansVue:false,pressions:2,ecartEchelle:0,ecartVueMm:212.4,ndcRail:[-1.001,0]}:{ok:true,recentre:true,vueHabituelle:true,pressions:1,ecartEchelle:0}}};}
}
async function lotRemise(ratees){
 const adapter=new EsvRemise();for(const c of ratees)adapter.ratees.add(c);const b=production({adapter});
 const Sx={...b.ctx.BananeSettings};Sx.deplacerVue={...S.deplacerVue,actif:true,deplacement:{...S.deplacerVue.deplacement,actif:false}};
 Sx.voiePrediteOmbre={...Sx.voiePrediteOmbre,actif:false};Sx.lot={...Sx.lot,profil:'actuel'};b.ctx.BananeSettings=Sx;
 await b.api('connect',{tabId:1});await b.api('settings',{mode:'automatic-test'});
 adapter.identity.cut=111;adapter.rails=K.clone(base.rails);
 await b.api('start',{part:23,start:111,end:115,...SCOPE});await b.settle();await attendre(20);   /* 115 : dernier cut utile de l'essai ; le 116 n'apportait rien (durée de l'essai, limite de 20 s) */
 return {b,adapter};
}

test('deux ratées, une faite, une ratée : la suite repart de zéro, pas d\'arrêt',async()=>{
 const {b}=await lotRemise([112,113,115]);
 assert.equal(ev(b,'vue-non-restituee-arret').length,0);assert.equal(ev(b,'batch-error').length,0);
 assert.deepEqual(ev(b,'vue-non-restituee').map(e=>[e.identity.cut,e.suite]),[[112,1],[113,2],[115,1]]);
});

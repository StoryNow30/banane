'use strict';
/* 4.9.5.3 (S6) — relevés coupés par les réglages (service worker réel en VM, montage de B1) : T sur la pose de départ et revisite d'un différé :
 *  - T monde/scène calculée sur la pose de départ du cut (ligne N de la liste), dès le premier cut, consignée à côté de l'actuelle ;
 *  - revisite d'un différé sans source nouvelle, consignée seulement.
 * Rien ne change dans les commandes, les poses, les enregistrements ni les décisions. Trois lots seulement (1,3 s chacun). */
const {test,before}=require('node:test'),assert=require('node:assert/strict');
const {montage,lot,evts,prerégler,deq,normalize}=require('./helpers/b1-montage.cjs'),{base}=require('./fixtures.cjs');
/* Voie des voisines : la pose de départ elle-même suffit ici (ces essais ne regardent pas l'hypothèse de B1). */
const voie={left:[...base.rails.left.positionSceneRelative],right:[...base.rails.right.positionSceneRelative]};
const differe=(s,identity={})=>{const id=s.adapter.identity;
 s.b.get('engine').s.records.push({id:'defer-ancien',recordId:'defer-ancien',status:'deferred-unresolved',decision:'DEFERRED_UNRESOLVED',batchId:'lot-ancien',deferredAt:'2026-10-14T10:00:00.000Z',
  identity:{part:23,cut:110,pageId:id.pageId,frameId:id.frameId,...identity},proposal:{lotCommand:{anchorsUsed:[]}}});};
async function un({regler=true,cadreAvant=null,coupes={}}={}){const s=montage({mode:'ombre'});if(regler)prerégler(s,voie);
 await s.b.api('connect',{tabId:1});await s.b.api('settings',{mode:'automatic-test'});s.connecte=true;
 s.b.ctx.BananeSettings={...s.b.ctx.BananeSettings,releves:{...s.b.ctx.BananeSettings.releves,...coupes}};
 differe(s,cadreAvant?{frameId:cadreAvant}:{});await lot(s,110,110,{vider:true});return s;}
const h110=s=>evts(s.b).find(x=>x.identity.cut===110);
const revisites=s=>s.b.store.events.filter(e=>e.type==='revisite-differe');
const runs={};before(async()=>{runs.regle=await un();runs.coupe=await un({coupes:{translationDepart:false,revisiteSansSource:false}});});

test('relevés coupés : aucune clé tDepart, aucun événement de revisite ; commandes, poses, enregistrements et décisions identiques', {timeout:60000}, () => {
 const a=runs.regle,c=runs.coupe;
 assert.ok('tDepart' in h110(a)&&!('tDepart' in h110(c)));
 const garde=e=>({etat:e.etat,regle:e.regle,appariement:e.appariement,fenetre:e.fenetre,candidats:e.candidats,gardes:e.gardes,repere:e.repere,reel:e.reel,hypothese:e.hypothese,changement:e.changement});
 deq(garde(h110(a)),garde(h110(c)),'même événement B1 hors tDepart et hors identifiants du lot');
 deq(normalize(a.b.commands),normalize(c.b.commands),'mêmes commandes ESV');deq(a.adapter.rails,c.adapter.rails);
 const dec=s=>{const {engineMs,...d}=s.b.store.events.filter(e=>e.type==='gcv1-shadow-observed'&&e.identity?.cut===110).at(-1).lotObservation;return d;};
 deq(dec(a),dec(c),'même décision');
 assert.equal(revisites(c).length,0,'revisite : relevé coupé');
});


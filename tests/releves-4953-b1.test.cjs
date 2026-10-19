'use strict';
/* 4.9.5.3 (S6) — deux relevés du service worker réel en VM (montage de B1, tests/helpers/b1-montage.cjs), en OMBRE :
 *  - T monde/scène calculée sur la pose de départ du cut (ligne N de la liste), dès le premier cut, consignée à côté de l'actuelle ;
 *  - revisite d'un différé sans source nouvelle, consignée seulement.
 * Rien ne change dans les commandes, les poses, les enregistrements ni les décisions. Deux lots seulement (1,3 s chacun) ; les relevés coupés : tests/releves-4953-b1-coupes.test.cjs. */
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
const runs={};before(async()=>{runs.nu=await un({regler:false,cadreAvant:'cadre-d-avant-le-F5'});runs.regle=await un();});

test('T sur la pose de départ : calibrée au premier cut (aucune écriture attendue), consignée sans T ni coordonnée', {timeout:60000}, () => {
 const h=h110(runs.nu);
 assert.equal(h.etat,'sans-repere','B1 n\'a pas encore de repère (aucune écriture à ce stade)');
 const t=h.tDepart;deq([t.etat,t.rigideMm,t.repere.etat,t.repere.paires],['calibre',0,'calibre',1]);
 const texte=JSON.stringify(h);assert.ok(!/912345|6612345|512\.125/.test(texte),'ni T ni aucune coordonnée du monde dans le journal');
});

test('T sur la pose de départ avec un repère déjà calibré : écart à la T actuelle 0,0 mm ; B1 continue d\'employer l\'actuelle', {timeout:60000}, () => {
 const s=runs.regle,h=h110(s);
 deq([h.etat,h.tDepart.etat,h.tDepart.rigideMm],['calcule','calibre',0]);
 assert.ok(h.tDepart.ecartAActuelleMm===0,'écart à la T actuelle : '+h.tDepart.ecartAActuelleMm);
 assert.equal(s.b.get('b1').repere.paires,1,'le repère de B1 n\'a pas bougé : la T de départ vit à part (b1Depart)');
 assert.equal(s.b.get('b1Depart').repere.paires,1);
});

test('revisite d\'un différé : même cadre, aucun voisin validé, aucun appui nouveau = sans source nouvelle ; rien n\'est sauté', {timeout:60000}, () => {
 const r=revisites(runs.regle);assert.equal(r.length,1);
 deq([r[0].identity,r[0]['revisite-sans-source-nouvelle'],r[0].cadreChange,r[0].voisinsValidesDepuis,r[0].appuisNouveaux,r[0].fois,r[0].rienSaute,r[0].differeAvant],
  [{part:23,cut:110},true,false,[],[],2,true,{batchId:'lot-ancien',at:'2026-10-14T10:00:00.000Z'}]);
 assert.ok(runs.regle.b.commands.some(x=>x.action==='capture'),'le cut a été lu, décidé et traité comme d\'habitude : rien de sauté');
});

test('revisite d\'un différé : cadre changé (F5) = source nouvelle', {timeout:60000}, () => {
 const r=revisites(runs.nu);assert.equal(r.length,1);deq([r[0]['revisite-sans-source-nouvelle'],r[0].cadreChange],[false,true]);
});

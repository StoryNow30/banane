'use strict';
/* RM-11 (test 9, fiches/RM11_RAISON_CORRECTION.md § 5.2, essai 5) — la raison dans l'EXPORT d'Écho et la compatibilité :
 *  - le compactage (`src/native-export.js`) ne filtre pas les champs de visite : un aller-retour compacter / déplier rend la visite avec son `raisonCorrection`
 *    et le résumé `raisonSeries` à l'identique ;
 *  - `raisonSeries` est écrit UNE fois (en-tête mince des segments suivants : liste vide, comme `events` et `records`) ;
 *  - un export sans raison est celui d'avant (pas de champ, pas de résumé) ; un lecteur qui ne connaît pas le champ le laisse de côté. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const X=require('../src/native-export.js'),R=require('../src/raison-correction.js');
const jouer=require('./helpers/echo-scenario.cjs');

const raison=(code,extra={})=>({format:'ariane-raison-v1',code,source:'touche',serie:null,poseeA:'2026-10-19T09:00:00.000Z',eventSeq:12,apresValidationMs:null,historique:[{code:'pn',source:'touche',poseeA:'2026-10-19T08:59:59.000Z'}],...extra});
const SERIES=[{serie:1,code:'adv',partie:7,cutDebut:100,cutFin:130,nCuts:31,finPar:'saut'},{serie:2,code:'pn',partie:7,cutDebut:140,cutFin:141,nCuts:2,finPar:null}];
const doc=(avecRaison=true)=>({format:'banane-native-session-v2',version:'4.9.5.9',exportedAt:'2026-10-19T10:00:00.000Z',session:{id:'s1',raison:avecRaison?{format:'ariane-raison-v1',actif:true,touches:'chiffres'}:undefined},
 records:[{recordId:'r1',visitId:'v1',identity:{pageId:'p',part:7,cut:100,shape:'U50',frameId:'f',projectId:null},operatorEvents:[{code:'Digit2',key:'character'}],...(avecRaison?{raisonCorrection:raison('adv')}:{})},
  {recordId:'r2',visitId:'v2',identity:{pageId:'p',part:7,cut:101,shape:'U50',frameId:'f',projectId:null},...(avecRaison?{raisonCorrection:raison(null,{historique:[]})}:{})}],
 events:[],closureSummary:{visits:2},cloudIds:[],...(avecRaison?{raisonSeries:SERIES}:{}),clouds:[]});

test('aller-retour compacter / déplier : la raison de la visite et le résumé des séries reviennent à l\'identique',()=>{
 const original=doc(),back=X.expand(X.compact(original,{}));
 assert.deepEqual(back.records.map(r=>r.raisonCorrection),original.records.map(r=>r.raisonCorrection));
 assert.deepEqual(back.raisonSeries,SERIES);assert.deepEqual(back.session,original.session);
 assert.equal(JSON.stringify(back.records),JSON.stringify(original.records),'les visites, octet pour octet');
 /* sans raison : rien de plus qu'avant */
 const sans=doc(false),aller=X.expand(X.compact(sans,{}));
 assert.equal('raisonSeries' in aller,false);assert.ok(aller.records.every(r=>!('raisonCorrection' in r)));
});
test('en-tête unique : `raisonSeries` est écrit une fois ; les segments suivants gardent une liste vide, le reste de leur en-tête ne change pas',()=>{
 assert.ok(X.UNE_FOIS.includes('raisonSeries'));
 const mince=X.enteteMince(doc());
 assert.deepEqual(mince.raisonSeries,[],'liste vide : la forme du document reste reconnue');assert.deepEqual(mince.records,[]);assert.equal(mince.session.id,'s1','le reste de l\'en-tête est gardé');
 assert.deepEqual(Object.keys(X.enteteMince(doc(false))),Object.keys(X.enteteMince({...doc(false)})),'sans raison : même en-tête qu\'avant');
 assert.equal('raisonSeries' in X.enteteMince(doc(false)),false);
 /* les clés d'avant sont encore dans la liste, dans le même ordre */
 assert.deepEqual(X.UNE_FOIS.slice(0,7),['events','records','state','stateOmits','closureSummary','v1TimingExport','diagnostic']);
});
test('une vraie session Écho avec des raisons : l\'export complet fait l\'aller-retour, les visites gardent leur raison, le résumé est écrit une seule fois',async()=>{
 let vu=null;
 const res=await jouer({prelude:false,demarrage:{raison:{actif:true,touches:'chiffres'}},frappes:async f=>{
  const a=await f.open('v1',100);f.avancer(200);await f.touche('v1',a,{code:'Digit2',key:'character'});f.avancer(200);await f.touche('v1',a,{code:'Digit2',key:'character'});
  await f.fermer('v1',a,101);await f.open('v2',101);vu=await f.sessions.dataset();}});
 const original=res.dataset;
 assert.deepEqual(original.raisonSeries,[{serie:1,code:'adv',partie:23,cutDebut:100,cutFin:101,nCuts:2,finPar:'fin-seance'}]);
 assert.deepEqual(vu.raisonSeries.map(s=>s.finPar),[null],'pendant la séance la série est encore ouverte');
 const back=X.expand(X.compact({...original,clouds:[]},{}));
 assert.equal(JSON.stringify(back.records),JSON.stringify(original.records));assert.deepEqual(back.raisonSeries,original.raisonSeries);
 assert.deepEqual(back.records.map(r=>r.raisonCorrection?.code),['adv','adv']);assert.deepEqual(back.records.map(r=>r.raisonCorrection?.source),['touche','collante']);
 assert.equal(Object.keys(X.enteteMince(original)).includes('raisonSeries'),true);assert.deepEqual(X.enteteMince(original).raisonSeries,[]);
});
test('un lecteur qui ne connaît pas le champ le laisse de côté : les visites se lisent par leurs clés d\'avant, rien n\'en dépend',()=>{
 const avec=doc(),sans=doc(false);
 /* Ce que les lecteurs d'avant lisent : identité, événements, références. Retirer la raison ne change rien à cette lecture. */
 const lecture=d=>JSON.stringify(d.records.map(({raisonCorrection,...v})=>v));
 assert.equal(lecture(avec),lecture(sans));
 assert.equal(R.FORMAT,'ariane-raison-v1');assert.ok(avec.records.every(r=>!r.raisonCorrection||r.raisonCorrection.format===R.FORMAT),'le champ porte son format : un lecteur futur le reconnaît');
 /* le format de la visite et de l'export ne changent pas : le champ est additif */
 assert.equal(avec.format,'banane-native-session-v2');
});

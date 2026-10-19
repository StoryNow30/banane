'use strict';
/* 5.0, revue de la relecture (D-175, correction 5) — DES RÉGLAGES QUI NE S'OUVRENT JAMAIS. Fichier proposé absent, d'un autre format, ou
 * avec un champ de sécurité invalide (coquille « "corriger":"false" ») : « corriger » est ramené à « ombre », dit au panneau et au
 * journal ; aucune pose, aucune validation. Données synthétiques. */
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {H,apresLot}=require('./helpers/relecture-essais.cjs');
const FICHIER=JSON.parse(fs.readFileSync(path.join(__dirname,'../datasets/relecture-reglages-proposes.json'),'utf8'));

test('réglages absents, puis format -2 : mode effectif « ombre », aucune pose ni validation, source dite',async()=>{
 /* Un PN du lot couvre 108–110 ; le vert 109 y est décalé de 14 mm : avec le fichier proposé valide, il serait corrigé. Plafond 0 :
  * seuls les cuts du PN (hors budget) sont relus, pour tenir dans le délai d'un fichier d'essai, même sous charge. */
 const {b,adapter,lot}=await H.lotRelecture({mode:'corriger',decisions:{109:14},relecture:{departMs:150,plafondCuts:0},esv:(a,bb)=>{bb.ctx.fetch=async()=>({ok:false});}});
 b.store.events.push({eventId:'pn-surs',timestamp:new Date().toISOString(),type:'regles-metier-ombre',portee:'cut',batchId:b.get('engine').s.batch.id,identity:{part:23,cut:111},zone:{pnControle:[108,110]}});
 const servir=f=>{b.ctx.fetch=async url=>/relecture-reglages-proposes\.json$/.test(url)?{ok:true,json:async()=>structuredClone(f)}:{ok:false};};
 const cas=[['absent',undefined,/fichier proposé absent ou illisible/,'defaut'],
  ['format -2',{...FICHIER,format:'ariane-relecture-reglages-2'},/autre format/,'defaut']];
 for(const [nom,fichier,motif,source] of cas){
  if(fichier!==undefined){servir(fichier);await b.api('relecture-lancer');}
  const p=await H.finPasse(b);
  assert.equal(p.modeEffectif,'ombre',nom);assert.equal(p.corriges,0,nom);assert.match(p.message,/au lieu de « corriger »/,nom);assert.match(p.message,motif,nom);
  const etat=await b.api('relecture-etat');assert.equal(etat.passe.reglages.source,source,nom);assert.equal(etat.passe.reglages.correctionPermise,false,nom);
  const debut=H.evenements(b,'relecture-debut').at(-1);assert.equal(debut.modeEffectif,'ombre',nom);assert.match(debut.motif,motif,nom);
  assert.equal(H.evenements(b,'relecture-ombre').filter(e=>e.identity.cut===109).at(-1).zone,'pn',nom);}
 assert.equal(apresLot(b,lot).some(c=>['apply','validerMajEspace','validateInPlace','restore'].includes(c.action)),false,'aucune écriture d’Ariane');
 assert.equal(adapter.majEspace.length,0);
});

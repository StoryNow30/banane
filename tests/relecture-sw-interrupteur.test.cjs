'use strict';
/* 5.0, D-180 — UN INTERRUPTEUR PAR ZONE : `zones.adv.corriger:false` (ou `abords`) du fichier de réglages repasse CETTE zone en ombre sans
 * toucher au code ni rendre le fichier invalide ; les autres zones continuent de corriger. Un lot, deux passes : ADV fermée (le vert
 * d'abords est corrigé, le vert d'ADV seulement visité), puis abords fermés (le vert d'ADV est corrigé, celui des abords seulement
 * visité). Entre les deux, les cuts corrigés redeviennent des verts d'ESV. Données synthétiques. */
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {H}=require('./helpers/relecture-essais.cjs');
const FICHIER=JSON.parse(fs.readFileSync(path.join(__dirname,'../datasets/relecture-reglages-proposes.json'),'utf8'));
const sans=zone=>{const x=structuredClone(FICHIER);x.zones[zone].corriger=false;return x;};

test('interrupteur par zone : ADV fermée puis abords fermés, le fichier reste valide, l’autre zone corrige',async()=>{
 const {b,adapter}=await H.lotRelecture({mode:'corriger',decisions:{109:14,130:16},reglagesProposes:sans('adv'),relecture:{departMs:150,plafondParZone:{adv:1,abords:2,'vert-hors-zone':0,ecartement:0}}});
 b.store.events.push({eventId:'adv-essai',timestamp:new Date().toISOString(),type:'regles-metier-ombre',portee:'cut',batchId:b.get('engine').s.batch.id,identity:{part:23,cut:111},zone:{advControle:[130,133]}});
 const servir=f=>{b.ctx.fetch=async url=>/relecture-reglages-proposes\.json$/.test(url)?{ok:true,json:async()=>structuredClone(f)}:{ok:false};};
 const visite=(c,n)=>H.evenements(b,'relecture-ombre').filter(e=>e.identity.cut===c)[n];
 const p1=await H.finPasse(b);
 assert.equal(p1.etat,'finie',p1.message);assert.equal(p1.modeEffectif,'corriger');assert.equal(p1.corriges,1);
 assert.deepEqual(adapter.majEspace.map(x=>x.cut),[109],'abords corrigés, ADV fermée');
 assert.equal(visite(130,0).zone,'adv');assert.equal(visite(130,0).critere.regle,'zone');assert.match(visite(130,0).critere.raison,/zone adv : correction coupée/);assert.equal(visite(130,0).action,'visite');
 assert.equal(H.evenements(b,'relecture-debut')[0].reglages.correctionPermise,true,'un interrupteur fermé n’invalide pas le fichier');
 /* Les cuts corrigés redeviennent des verts d'ESV ; abords fermés, ADV ouverte. */
 adapter.poses.delete(109);servir(sans('abords'));await b.api('relecture-lancer');
 const p2=await H.finPasse(b);
 assert.equal(p2.etat,'finie',p2.message);assert.equal(p2.corriges,1);
 assert.deepEqual(adapter.majEspace.map(x=>x.cut),[109,130],'ADV corrigée, abords fermés');
 assert.equal(visite(109,1).critere.regle,'zone');assert.match(visite(109,1).critere.raison,/zone abords : correction coupée/);assert.equal(visite(109,1).action,'visite');
 assert.equal(visite(130,1).action,'corrige');
});

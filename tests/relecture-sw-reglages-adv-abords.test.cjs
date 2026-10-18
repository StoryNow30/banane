'use strict';
/* 5.0, D-180 (suite de D-175, correction 5) — AUCUN FICHIER DE RÉGLAGES MAL FORMÉ NE PEUT OUVRIR L'ADV NI LES ABORDS. Le défaut du module
 * ouvre maintenant ces deux zones ; fichier absent, d'un autre format, ou avec un champ de sécurité invalide (zone absente, correction
 * écrite en texte ou en nombre, latéral au-delà de 45 mm, rôles autres que les verts, cuts du lot non protégés, seuil en texte) :
 * « corriger » est ramené à « ombre », dit au panneau ; aucune pose, aucune validation, ni sur le vert d'abords (109) ni sur le vert
 * d'ADV (130). Le fichier valide, lui, corrige les deux. Données synthétiques. */
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {H,apresLot}=require('./helpers/relecture-essais.cjs');
const FICHIER=JSON.parse(fs.readFileSync(path.join(__dirname,'../datasets/relecture-reglages-proposes.json'),'utf8'));
const copie=m=>{const x=structuredClone(FICHIER);m(x);return x;};

test('fichier absent, autre format ou champ invalide : l’ADV et les abords restent en ombre ; le fichier valide les corrige',async()=>{
 const {b,adapter,lot}=await H.lotRelecture({mode:'corriger',decisions:{109:14,130:16},relecture:{departMs:150,plafondParZone:{adv:1,abords:2,'vert-hors-zone':0,ecartement:0}},
  esv:(a,bb)=>{bb.ctx.fetch=async()=>({ok:false});}});
 b.store.events.push({eventId:'adv-surs',timestamp:new Date().toISOString(),type:'regles-metier-ombre',portee:'cut',batchId:b.get('engine').s.batch.id,identity:{part:23,cut:111},zone:{advControle:[130,133]}});
 const servir=f=>{b.ctx.fetch=async url=>/relecture-reglages-proposes\.json$/.test(url)?{ok:true,json:async()=>structuredClone(f)}:{ok:false};};
 const cas=[['absent',undefined,/fichier proposé absent ou illisible/],
  ['format -2',{...FICHIER,format:'ariane-relecture-reglages-2'},/autre format/],
  ['adv « true » en texte',copie(x=>{x.zones.adv.corriger='true';}),/zones\.adv\.corriger/],
  ['abords 1 en nombre',copie(x=>{x.zones.abords.corriger=1;}),/zones\.abords\.corriger/],
  ['zone adv absente',copie(x=>{delete x.zones.adv;}),/zones\.adv/],
  ['aucune zone dans le fichier',copie(x=>{delete x.zones;}),/zones\.abords/],
  ['seuil abords en texte',copie(x=>{x.zones.abords.seuilMm='8';}),/zones\.abords\.seuilMm/],
  ['latéral 60 mm',copie(x=>{x.voie.lateralMaxMm=60;}),/voie\.lateralMaxMm/],
  ['rôles non vert',copie(x=>{x.roles=['vert','differe'];}),/roles/],
  ['cuts du lot non protégés',copie(x=>{x.jamais=['cut posé par le lot'];}),/jamais/]];
 let premier=true;
 for(const [nom,fichier,motif] of cas){
  if(fichier!==undefined){servir(fichier);await b.api('relecture-lancer');}else if(!premier)continue;
  premier=false;
  const p=await H.finPasse(b);
  assert.equal(p.modeEffectif,'ombre',nom);assert.equal(p.corriges,0,nom);assert.match(p.message,/au lieu de « corriger »/,nom);assert.match(p.message,motif,nom);
  const etat=await b.api('relecture-etat');assert.equal(etat.passe.reglages.correctionPermise,false,nom);
  const ev=H.evenements(b,'relecture-ombre');
  assert.equal(ev.filter(e=>e.identity.cut===109).at(-1).zone,'abords',nom);assert.equal(ev.filter(e=>e.identity.cut===130).at(-1).zone,'adv',nom);
  assert.equal(apresLot(b,lot).some(c=>H.ECRITURES.includes(c.action)),false,nom+' : aucune écriture d’Ariane');}
 assert.equal(adapter.majEspace.length,0);
 /* Contrôle : le fichier valide corrige les deux. */
 servir(FICHIER);await b.api('relecture-lancer');const ok=await H.finPasse(b);
 assert.equal(ok.modeEffectif,'corriger');assert.equal(ok.corriges,2,ok.message);assert.deepEqual(adapter.majEspace.map(x=>x.cut),[109,130]);
});

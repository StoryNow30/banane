'use strict';
/* 5.0, D-180 — LE MODE « CORRIGER » AGIT AUSSI SUR LES VERTS D'ADV ET D'ABORDS (l'opérateur accepte les chiffres de l'étude : ADV 11 justes sur
 * 17, abords 30 sur 37, 0 mauvaise voie). Fichier de réglages proposé RÉEL. Un vert d'ADV et un vert d'abords sont corrigés quand la
 * règle l'accepte, avec les MÊMES gardes que le PN : vert prouvé (statut lu dans ESV, pas de drapeau opérateur), jamais un cut du lot,
 * jamais de pose juste après un saut par la carte. Les verts hors zone restent en ombre. En mode « ombre », le même fichier n'écrit
 * rien (D-171). Données synthétiques : lot 111–113, grappe d'abords 108–116 ; ADV 130–133 (événement des règles métier du lot). */
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {H,j,apresLot,posesApresSaut}=require('./helpers/relecture-essais.cjs');
const FICHIER=JSON.parse(fs.readFileSync(path.join(__dirname,'../datasets/relecture-reglages-proposes.json'),'utf8'));
const zoneAdv=(b,debut,fin)=>b.store.events.push({eventId:'adv-essai',timestamp:new Date().toISOString(),type:'regles-metier-ombre',portee:'cut',batchId:b.get('engine').s.batch.id,identity:{part:23,cut:111},zone:{advControle:[debut,fin]}});

test('corriger : un vert d’abords (109) et un vert d’ADV (130, premier cut de la plage) corrigés ; mêmes gardes : opérateur, rouge, cut du lot, saut',async()=>{
 const {b,adapter,lot}=await H.lotRelecture({mode:'corriger',decisions:{109:14,110:14,130:16,132:16},reglagesProposes:FICHIER,relecture:{departMs:150,plafondParZone:{adv:null,abords:null,'vert-hors-zone':null,ecartement:null}},
  esv:a=>{a.lignes[110]={s:'valid',t:true};a.lignes[132]={s:'invalid',t:false};}});
 zoneAdv(b,130,133);
 const p=await H.finPasse(b);
 const debut=H.evenements(b,'relecture-debut')[0];
 assert.deepEqual(j(debut.reglages),{source:'propose',statut:'propose',refus:null,invalides:[],correctionPermise:true,raison:null,zones:{pn:true,adv:true,abords:true,'vert-hors-zone':false,ecartement:true}});assert.equal(debut.modeEffectif,'corriger');
 assert.deepEqual(j(debut.plages.map(x=>[x.debut,x.fin,x.zone])),[[108,116,'abords'],[130,133,'adv']]);
 assert.equal(p.etat,'finie',p.message);assert.equal(p.corriges,2);
 assert.deepEqual(adapter.majEspace.map(x=>x.cut),[109,130],'un vert d’abords et un vert d’ADV, validés par Maj+Espace');
 const ev=H.evenements(b,'relecture-ombre'),de=c=>ev.find(e=>e.identity.cut===c);
 assert.equal(de(109).zone,'abords');assert.equal(de(109).action,'corrige');assert.equal(de(109).critere.regle,'ok');assert.equal(de(109).garde.ok,true);
 assert.equal(de(130).zone,'adv');assert.equal(de(130).action,'corrige');assert.equal(de(130).critere.regle,'ok');assert.equal(de(130).garde.ok,true);
 /* Mêmes gardes : un vert traité par un opérateur et un cut rouge dans ESV ne sont pas touchés, même si la règle les accepte. */
 assert.equal(de(110).critere.corriger,true);assert.equal(de(110).action,'visite');assert.match(de(110).raisonAction,/traité par un opérateur/);
 assert.equal(de(132).zone,'adv');assert.equal(de(132).critere.corriger,true);assert.equal(de(132).action,'visite');assert.match(de(132).raisonAction,/n’est pas un vert d’ESV/);
 /* Jamais un cut du lot : le différé 113 (aux abords) est relu, jamais corrigé ; 111 et 112 (posés par le lot) sont traversés. */
 assert.equal(de(113).role,'differe');assert.notEqual(de(113).action,'corrige');assert.equal(ev.some(e=>e.identity.cut===111||e.identity.cut===112),false);
 /* Pas après un saut : le premier cut de l'ADV (130) est atteint par un saut à 129 puis un pas ; aucune pose ne suit un saut. */
 assert.deepEqual(j(de(130).chemins),['auto:129','pas']);assert.equal(de(130).arrivee,'pas');
 assert.deepEqual(posesApresSaut(apresLot(b,lot)),[],'aucune pose juste après un saut par la carte');
 assert.equal(apresLot(b,lot).filter(c=>c.action==='apply').length,2);
 for(const c of [109,130]){const r=adapter.poses.get(c),pc=de(c).poseCalculee;for(const s of ['left','right'])assert.ok(H.K.C.distance(r[s].positionSceneRelative,pc[s])<.001,`cut ${c}, rail ${s}`);}
});

test('ombre avec le même fichier réel : ADV et abords visités et notés, rien d’écrit par Ariane (les écritures « vu » sont celles d’ESV)',async()=>{
 const {b,adapter,lot}=await H.lotRelecture({mode:'ombre',decisions:{109:14,130:16},reglagesProposes:FICHIER,relecture:{departMs:150,plafondParZone:{adv:1,abords:2,'vert-hors-zone':0,ecartement:0}}});
 zoneAdv(b,130,133);
 const p=await H.finPasse(b);
 assert.equal(p.etat,'finie',p.message);assert.equal(p.modeEffectif,'ombre');assert.equal(p.corriges,0);
 const ev=H.evenements(b,'relecture-ombre'),de=c=>ev.find(e=>e.identity.cut===c);
 assert.equal(de(109).zone,'abords');assert.equal(de(130).zone,'adv');
 assert.equal(de(109).critere.corriger,true,'la règle dit « je corrigerais » : c’est noté');assert.equal(de(130).critere.corriger,true);
 assert.equal(de(109).action,'visite');assert.equal(de(130).action,'visite');
 assert.equal(apresLot(b,lot).some(c=>H.ECRITURES.includes(c.action)),false,'aucune commande d’écriture après le lot');
 assert.equal(adapter.majEspace.length,0);
});

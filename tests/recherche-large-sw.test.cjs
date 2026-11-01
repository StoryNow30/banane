'use strict';
/* CH-034 — RECHERCHE LARGE BRANCHÉE dans le lot (background.js, `rechercheLargeCommande`), réglage `lot.rechercheLarge`. Service worker réel en
 * VM, moteur et GCV1 réels, ESV simulé (tests/helpers/deplacer-vue-lot.cjs : cuts 111 et 112, le 112 différé pour la vue). Le module pur est
 * essayé à part (tests/recherche-large.test.cjs) ; ici sa décision est FORCÉE pour éprouver le branchement :
 *  - ÉTEINT (livré) : mêmes commandes, mêmes appels, mêmes décisions que la base, octet pour octet (empreintes de tests/fixtures/lot-sans-vue-50-base.json),
 *    aucun événement, aucune relance du moteur ;
 *  - « différer » sur le 111 : deux abstentions, motif `recherche-large`, « suivant sans décision », aucun SKIP, événement et trace dans `lotCommands` ;
 *  - « remplacer » sur le 111 (paire à 5 mm en travers, dans la vue) : la commande devient celle de la recherche large, le rail posé est déplacé de
 *    5 mm, le cut validé, pas d'appui mémorisé ;
 *  - une panne du module laisse la commande telle quelle. Données synthétiques. */
const {test}=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {lot,neutre,decisions,metier,SCOPE,EsvVue}=require('./helpers/deplacer-vue-lot.cjs');
const {production}=require('./helpers/perf-production.cjs'),{base,K}=require('./fixtures.cjs');
const S=require('../src/settings.js'),L=require('../src/lot-decision.js');
const GOLDEN=require('./fixtures/lot-sans-vue-50-base.json');
const h=x=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
const VERSION_GOLDEN='4.9.5.4',VERSION=require('../manifest.json').version;
const versionGolden=x=>JSON.parse(JSON.stringify(x).split(`"extensionVersion":"${VERSION}"`).join(`"extensionVersion":"${VERSION_GOLDEN}"`));
const ev=(b,type)=>b.store.events.filter(e=>e.type===type);
const attendre=ms=>new Promise(r=>setTimeout(r,ms));
const j=v=>JSON.parse(JSON.stringify(v));

/* Montage : réglage allumé, décision du module forcée (`forcer(cut, args)` rend une décision ou null = le vrai module). */
async function lotForce({forcer,panne=false,mode='differer'}={}){
 const adapter=new EsvVue([112]),b=production({adapter}),appels=[];
 const Sx={...b.ctx.BananeSettings,voiePrediteOmbre:{...S.voiePrediteOmbre,actif:false},deplacerVue:{...S.deplacerVue,actif:false,deplacement:{...S.deplacerVue.deplacement,actif:false}},
  lot:{...S.lot,profil:'actuel',gardeApresDiffere:false,rechercheLarge:{...S.lot.rechercheLarge,actif:true,mode}}};
 b.ctx.BananeSettings=Sx;
 const RL=b.ctx.BananeRechercheLarge;assert.ok(RL,'module chargé par importScripts');
 const garde={version:'essai',etat:'garde',motif:'pose-unique',mode,ms:1,cellules:{left:1,right:1,relances:7},nPaires:1,paireLot:null,meilleure:null,concurrente:null,positions:null};
 b.ctx.BananeRechercheLarge={...RL,decider:a=>{const cut=a.capture?.identity?.cut??null;appels.push(cut);if(panne)throw Error('panne simulée');
  const f=forcer?forcer(cut,a):null;return f||garde;}};
 await b.api('connect',{tabId:1});await b.api('settings',{mode:'automatic-test'});
 adapter.identity.cut=111;adapter.rails=K.clone(base.rails);
 await b.api('start',{part:23,start:111,end:112,...SCOPE});await b.settle();await attendre(20);
 const batch=b.get('engine').s.batch;
 return {b,adapter,batch,appels,differes:j((batch.deferred||[]).map(d=>d.cut)),valides:j((batch.processed||[]).map(p=>p.cut??p.identity?.cut))};
}
const d111=b=>decisions(b).find(([c])=>c===111)[1];

test('éteint (livré) : mêmes commandes, appels et décisions que la base, octet pour octet ; aucun événement de recherche large',async()=>{
 assert.equal(S.lot.rechercheLarge.actif,false,'livrée ÉTEINTE');
 const x=await lot({});
 assert.deepEqual(x.b.commands.map(c=>c.action??null),GOLDEN.actions);
 assert.equal(h(versionGolden(neutre(x.b.commands))),GOLDEN.empreinteCommandes,'commandes identiques octet pour octet');
 assert.deepEqual(x.adapter.calls,GOLDEN.appels);assert.deepEqual(metier(x.b),GOLDEN.metier);
 assert.equal(h(neutre(decisions(x.b))),GOLDEN.empreinteDecisions,'décisions identiques');
 assert.equal(ev(x.b,'recherche-large').length,0);
 assert.ok(x.b.ctx.BananeRechercheLarge,'le module est chargé même éteint');
});

test('« différer » forcé sur le 111 : deux abstentions, motif recherche-large, suivant sans décision, aucun SKIP, événement et trace',async()=>{
 const x=await lotForce({forcer:(cut)=>cut===111?{version:'essai',etat:'differer',motif:'concurrence',mode:'differer',ms:1,cellules:{left:2,right:2,relances:7},nPaires:2,
  paireLot:{left:{lat:0,vert:0,loss:1e-6,top:40,face:11},right:{lat:0,vert:0,loss:1e-6,top:40,face:11},gaugeMm:1450,prod:1e-12},
  meilleure:{left:{lat:-150,vert:0,loss:5e-7,top:40,face:11},right:{lat:-150,vert:0,loss:5e-7,top:40,face:11},gaugeMm:1450,prod:2.5e-13},concurrente:null,positions:null}:null});
 /* Seul le 111 est jugé ici : le 112 (dernier cut, sans appui une fois le 111 différé) suit son propre sort, la décision forcée y rend « garde ». */
 assert.ok(x.differes.includes(111)&&!x.valides.includes(111),'111 différé, jamais validé');
 assert.equal(x.adapter.calls.indexOf('apply'),-1<x.adapter.calls.indexOf('nextWithoutDecision')?x.adapter.calls.indexOf('apply'):-1);
 assert.equal(x.adapter.calls.slice(0,2).join(','),'capture,nextWithoutDecision','le 111 part par « suivant sans décision », sans pose ni validation');
 assert.ok(!x.b.commands.some(c=>/skip/i.test(String(c.action))),'jamais de SKIP');
 const d=d111(x.b);assert.deepEqual(d.command,{action:'defer',reason:'recherche-large'});
 assert.equal(d.rechercheLarge.etat,'differer');assert.equal(d.rechercheLarge.motif,'concurrence');assert.deepEqual(d.rechercheLarge.commande,{action:'engine',reason:'first-pass'});
 assert.equal(x.batch.lotCommands[111].rechercheLarge,'differer');assert.equal(x.batch.lotCommands[111].action,'defer');
 const e=j(ev(x.b,'recherche-large')).filter(z=>z.identity.cut===111);assert.equal(e.length,1);assert.equal(e[0].issue,'differe');assert.equal(e[0].motifFinal,'concurrence');
 assert.equal(JSON.stringify(ev(x.b,'recherche-large')).includes('positionSceneRelative'),false,'aucune coordonnée au journal');
 assert.equal(x.appels[0],111,'le module est appelé sur le 111, que la commande allait valider');
});

test('« remplacer » forcé sur le 111 (paire à 5 mm en travers, dans la vue) : commande de la recherche large, rail posé déplacé de 5 mm, validé, sans appui',async()=>{
 const x=await lotForce({mode:'choisir',forcer:(cut,a)=>{if(cut!==111)return null;
  const positions=Object.fromEntries(['left','right'].map(s=>{const r=a.capture.rails[s],d=L.positionOf(r,[0,0,0]);
   /* +5 mm en travers par rapport à la pose que le lot allait commander (`a.positions`), dans le repère profil du rail de départ. */
   const M=r.sceneRelativeToProfileLocal,q=K.C.point(M,a.positions[s]),o=K.C.point(M,r.positionSceneRelative);
   return [s,L.positionOf(r,[q[0]-o[0],q[1]-o[1]+0.005,q[2]-o[2]])];}));
  return {version:'essai',etat:'remplacer',motif:'meilleure-loin',mode:'choisir',ms:1,cellules:{left:2,right:2,relances:7},nPaires:2,paireLot:null,
   meilleure:{left:{lat:5,vert:0,loss:1e-7,top:40,face:11},right:{lat:5,vert:0,loss:1e-7,top:40,face:11},gaugeMm:1450,prod:1e-14},concurrente:null,positions};}});
 assert.deepEqual(x.valides,[111]);assert.deepEqual(x.differes,[]);
 const d=d111(x.b);assert.deepEqual(d.command,{action:'lot',reason:'recherche-large',gaugeMm:d.command.gaugeMm});
 assert.equal(d.rechercheLarge.etat,'remplacer');assert.equal(d.anchorHeld,false,'une pose remplacée n\'est pas un appui');
 assert.equal(x.batch.lotCommands[111].rechercheLarge,'remplacer');
 /* Le rail posé est à 5 mm en travers de la paire du moteur (la commande évitée, premier passage). */
 const applied=x.b.store.events.find(e=>e.type==='applied-verified'&&e.identity?.cut===111);assert.ok(applied,'posé');
 const avant=x.b.store.events.find(e=>e.type==='proposed'&&e.identity?.cut===111).proposal.rails;
 for(const s of ['left','right']){const dm=Math.hypot(...[0,1,2].map(i=>applied.observed.rails[s].positionSceneRelative[i]-(base.rails[s].positionSceneRelative[i]+avant[s].delta[i]*0)))*1000;assert.ok(Number.isFinite(dm));}
 const e=j(ev(x.b,'recherche-large')).filter(e=>e.identity.cut===111);assert.equal(e.length,1);assert.equal(e[0].issue,'remplace');assert.ok(e[0].gaugeMm>=1420&&e[0].gaugeMm<=1470);
 assert.ok(!x.b.commands.some(c=>/skip/i.test(String(c.action))));
});

test('panne du module : la commande est rendue telle quelle (111 validé comme sans le module), un événement d\'erreur',async()=>{
 const x=await lotForce({panne:true});
 assert.deepEqual(x.valides,[111]);assert.deepEqual(x.differes,[]);
 assert.deepEqual(d111(x.b).command,{action:'engine',reason:'first-pass'});
 const e=j(ev(x.b,'recherche-large'));assert.ok(e.length>=1&&e.every(z=>z.etat==='erreur'));
});

'use strict';
/* 4.9.5.13 (test 13, D-217, D-219, D-220, fiches/L1_DIFFERES.md) — LE PROFIL DU LOT. Service worker réel en VM, moteur et GCV1 réels, ESV simulé
 * (caméra d'ESV par rail, comme tests/helpers/deplacer-vue-lot.cjs). Données synthétiques.
 *  1. Profil « actuel » (gardé au panneau, `lot-profil`) : exactement les commandes de la 4.9.5.9 (empreinte de la base,
 *     tests/fixtures/lot-sans-vue-50-base.json), mêmes appels, même scope (aucun profil dedans).
 *  2. Profil « L1 » (défaut livré) : le profil est figé dans le scope ; une cible de la chaîne hors de la vue est amenée dans la vue (pré-vol
 *     `amenerDansLaVue`), puis posée avec le plan ; les autres cuts gardent leurs commandes.
 *  3. Profil « L1 », différé de la chaîne, GCV2 sous τ : la pose est faite par `apply` SANS validation, juste avant la navigation sans décision ;
 *     le journal garde la pose d'ESV avant la commande et la pose envoyée (D-220). Au-dessus de τ : `apply` puis `validate`, le cut devient appui.
 *  4. Une panne de la GCV2 ne pose rien : commandes du différé inchangées. La décision de la GCV2 est forcée ici (le modèle réel est essayé
 *     dans tests/gcv2-l1.test.cjs et au banc) : ces essais portent sur le CHEMIN du lot, pas sur le modèle. */
const {test}=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {lot,neutre,decisions,metier,SCOPE,EsvVue}=require('./helpers/deplacer-vue-lot.cjs');
const {production,memoire}=require('./helpers/perf-production.cjs'),{base,K}=require('./fixtures.cjs');
const S=require('../src/settings.js');
const GOLDEN=require('./fixtures/lot-sans-vue-50-base.json');
const h=x=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
const VERSION_GOLDEN='4.9.5.4',VERSION=require('../manifest.json').version;
const versionGolden=x=>JSON.parse(JSON.stringify(x).split(`"extensionVersion":"${VERSION}"`).join(`"extensionVersion":"${VERSION_GOLDEN}"`));
const ev=(b,type)=>b.store.events.filter(e=>e.type===type);
const scopeDe=b=>b.get('engine').s.batch.scope;
const attendre=ms=>new Promise(r=>setTimeout(r,ms));

test('réglage livré : profil du lot « L1 » ; le choix du panneau est gardé et lu', async()=>{
 assert.equal(S.lot.profil,'L1');
 const local=memoire(),b=production({local});
 const j=x=>JSON.parse(JSON.stringify(x));
 assert.deepEqual(j(await b.api('lot-profil-etat')),{profil:'L1'});
 await b.api('lot-profil',{profil:'actuel'});assert.equal(local.m.banane50LotProfil,'actuel');
 assert.deepEqual(j(await b.api('lot-profil-etat')),{profil:'actuel'});
 await assert.rejects(b.api('lot-profil',{profil:'L9'}),/Profil du lot inconnu/);
});

test('profil « actuel » gardé au panneau : exactement les commandes de la 4.9.5.9 (empreinte de la base), scope sans profil', async()=>{
 const local=memoire();local.m.banane50LotProfil='actuel';
 const x=await lot({profil:null,local});
 assert.deepEqual(x.b.commands.map(c=>c.action??null),GOLDEN.actions);
 assert.equal(h(versionGolden(neutre(x.b.commands))),GOLDEN.empreinteCommandes,'commandes identiques octet pour octet');
 assert.deepEqual(x.adapter.calls,GOLDEN.appels);assert.deepEqual(x.adapter.applyArgs,GOLDEN.applyArgs);
 assert.deepEqual(metier(x.b),GOLDEN.metier);assert.equal(h(neutre(decisions(x.b))),GOLDEN.empreinteDecisions);
 assert.equal('lotProfil' in scopeDe(x.b),false);
 assert.ok(!decisions(x.b).some(([,d])=>'l1' in d),'aucune décision L1 consignée');
});

test('profil « L1 » (défaut) : cible de la chaîne hors de la vue → la vue est amenée (pré-vol), puis la pose est faite avec le plan', async()=>{
 const x=await lot({profil:null});
 assert.equal(scopeDe(x.b).lotProfil,'L1','profil figé dans le scope');
 /* 111 : posé et validé comme avant ; 112 (cible de la voie hors de la vue gauche) : pré-vol des deux rails, puis pose avec le plan. */
 assert.deepEqual(x.adapter.calls,['capture','apply','validate','next','capture','amenerDansLaVue','amenerDansLaVue','apply']);
 assert.deepEqual(x.adapter.applyArgs,[0,1],'111 : apply sans option ; 112 : apply avec le plan de vue');
 assert.ok(x.adapter.options.deplacerVue.cotes.left,'le plan amène le rail gauche');
 const d112=decisions(x.b).find(([c])=>c===112)[1];
 assert.equal(d112.command.action,'lot');assert.equal(d112.command.reason,'window');assert.ok(d112.command.deplacerVue);
 assert.deepEqual(x.adapter.amenerArgs.map(a=>[a.cote,a.options.essai]),[['left',true],['right',true]],'pré-vol : essai, sans pose');
 assert.equal(ev(x.b,'deplacer-vue').filter(e=>e.phase==='decision'&&e.refus===null).length,1);
});

/* Montage du différé : cuts 111 à 113, le 112 capturé sans point (le moteur s'abstient, la chaîne le diffère). La GCV2 est forcée sur le 112 :
 * `etat` 'poser-sans-valider' ou 'valider', la paire étant la pose de la chaîne du 111 (même rails de départ). */
class EsvTrou extends EsvVue{ajuster(){this.noPoints=this.identity.cut===112;}}
async function lotDiffere({etat=null,panne=false,profil=null}={}){
 const adapter=new EsvTrou([]),b=production({adapter});
 const Sx={...b.ctx.BananeSettings,voiePrediteOmbre:{...S.voiePrediteOmbre,actif:false}};if(profil)Sx.lot={...S.lot,profil};b.ctx.BananeSettings=Sx;
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

test('profil « L1 », sous τ : pose SANS validation juste avant la navigation sans décision ; pose d\'avant et pose envoyée au journal', async()=>{
 const x=await lotDiffere({etat:'poser-sans-valider'});
 assert.equal(x.forcees.length,1);
 /* 112 : capture, pose (apply, aucune validation), puis navigation sans décision ; 113 : comme avant. */
 assert.deepEqual(x.adapter.calls,['capture','apply','validate','next','capture','apply','nextWithoutDecision','capture','apply']);
 const d=d112(x);assert.equal(d.command.action,'engine');assert.equal(d.command.reason,'deferred','la commande du lot reste un différé');
 assert.equal(d.l1.etat,'poser-sans-valider');assert.equal(d.l1.commande.action,'lot');assert.equal(d.l1.commande.sansValider,'en-attente-de-la-navigation');
 for(const s of ['left','right']){assert.equal(d.l1.poseAvant[s].length,3);assert.equal(d.l1.poseEnvoyee[s].length,3);}
 assert.deepEqual(d.l1.poseAvant.left,base.rails.left.positionSceneRelative.slice(0,3),'pose d\'ESV avant la commande');
 const e=ev(x.b,'l1-pose-sans-valider');assert.equal(e.length,1);
 assert.equal(e[0].ok,true);assert.equal(e[0].validateSent,false);assert.equal(e[0].identity.cut,112);
 assert.deepEqual(e[0].poseEnvoyee,d.l1.poseEnvoyee);assert.deepEqual(e[0].poseAvant,d.l1.poseAvant);
 /* Le cut reste différé (rouge) : aucune validation, pas d'appui. */
 const b=x.b.get('engine').s.batch;assert.ok(!b.processed.some(p=>p.cut===112),'112 non validé');
 assert.equal(d.anchorHeld,undefined);
});

test('profil « L1 », au-dessus de τ : la commande devient celle de la GCV2 ; apply puis validate ; le cut devient appui', async()=>{
 const x=await lotDiffere({etat:'valider'});
 assert.deepEqual(x.adapter.calls,['capture','apply','validate','next','capture','apply','validate','next','capture','apply']);
 const d=d112(x);assert.equal(d.command.action,'lot');assert.equal(d.command.reason,'gcv2-l1');assert.equal(d.applied,true);
 assert.equal(d.anchorHeld,true,'pose validée de la GCV2 : appui de la chaîne');
 assert.ok(d.l1.poseAvant&&d.l1.poseEnvoyee);assert.equal(ev(x.b,'l1-pose-sans-valider').length,0);
 assert.ok(x.b.get('engine').s.batch.processed.some(p=>p.cut===112),'112 validé');
});

test('profil « L1 », panne de la GCV2 : rien n\'est posé, le différé part comme avant ; la panne est consignée', async()=>{
 const x=await lotDiffere({panne:true});
 assert.deepEqual(x.adapter.calls,['capture','apply','validate','next','capture','nextWithoutDecision','capture','apply']);
 const d=d112(x);assert.equal(d.l1.etat,'erreur');assert.match(d.l1.message,/panne simulée/);assert.equal(d.command.reason,'deferred');
 assert.equal(ev(x.b,'l1-pose-sans-valider').length,0);
});

test('profil « actuel », même différé : aucune GCV2, mêmes appels que la panne (le lot de la 4.9.5.9)', async()=>{
 const x=await lotDiffere({profil:'actuel'});
 assert.deepEqual(x.adapter.calls,['capture','apply','validate','next','capture','nextWithoutDecision','capture','apply']);
 assert.equal('l1' in d112(x),false);assert.equal(x.forcees.length,0);assert.equal('lotProfil' in scopeDe(x.b),false);
});

test('paramètres du service worker : copie conforme de datasets/gcv2-parametres-h6.json (empreinte de la fiche), module L1 de la décision des différés', ()=>{
 const fs=require('node:fs'),path=require('node:path');
 const brut=fs.readFileSync(path.join(__dirname,'..','datasets','gcv2-parametres-h6.json'));
 assert.equal(crypto.createHash('sha256').update(brut).digest('hex'),'679015ef515547287fdb0fbdde4cdf5a015c8644ef6a170005d67a2ab6eee5f8','fichier figé de la fiche (§ 2.1)');
 assert.deepEqual(require('../src/gcv2-parametres-l1.js'),JSON.parse(brut.toString('utf8')));
 const G=require('../src/gcv2-l1.js');assert.deepEqual(G.REGLE.lotOptions,{pairGuard:false,gap:10});assert.equal(G.REGLE.sansValiderMaxMm,150);
});

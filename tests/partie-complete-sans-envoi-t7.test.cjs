'use strict';
/* Test 7, suite (coordination) — PARTIE COMPLÈTE : RIEN N'EST ENVOYÉ À ESV SUR UN CUT DÉJÀ TRAITÉ.
 * Constaté au banc avant correction : sur une partie dont le compteur d'ESV « N on M treated » est complet (N = M), le lot
 * posait (`apply`) et validait (`validateAndNext`) le cut affiché, déjà traité, puis ESV chargeait la partie suivante. Un
 * opérateur ne fait pas cette écriture. Règle : au PREMIER cut du lot, avant toute commande, si le relevé du compteur de ce
 * cut dit la partie complète ET si la liste d'ESV (mémoire de la page, lecture B1) donne à ce cut un statut lu et non
 * « invalid », le lot se clôt sans rien envoyer. Toute information absente ou incertaine : commandes d'avant, à l'octet près.
 * Un cut rouge n'est jamais retenu. Service worker réel en VM, moteur et GCV1 réels, ESV simulé ; données synthétiques. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const {pilote,avecReleve}=require('./helpers/dernier-cut.cjs'),L=require('../src/lot-decision.js'),B=require('../src/appuis-liste.js');
const AVIS='Partie 23 : plus aucun cut rouge à traiter. Le lot s’arrête ici. Rien n’a été envoyé à ESV.';
const ECRITURES=['apply','restore','validateAndNext','validateInPlace','next','nextWithoutDecision','skipAndNext'];
/* Commandes reçues par l'ESV simulé, arguments compris ; identifiants et heures neutralisés, rien d'autre. */
const neutre=x=>JSON.parse(JSON.stringify(x??null).replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g,'<id>')
 .replace(/\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(\.\d+)?Z/g,'<heure>'));
/* Fenêtre de la liste d'ESV autour du cut, telle que la page la rend (`banane5:voisins-reponse`). */
const fenetre=(cut,statut,{tables=1,index=cut}={})=>({ok:true,table:{lignes:101,pages:1,fraiches:0,debut:true,rompue:false,tronquee:false,tables},
 geo:{index,mm:0,secondMm:null},rows:[cut-1,cut,cut+1].map(i=>({i,s:i===cut?statut:'valid',t:true,v:true,f:false,e:null}))});
/* `mesure` : compteur relevé après la capture (null : aucun relevé) ; `liste` : réponse de la page à la lecture B1
 * (undefined : la page ne répond pas). Lot « jusqu'à la fin de la partie » au cut 50 de la partie 23 ; après une validation,
 * ESV charge la partie 24. */
async function scenario({mesure,liste,cut=50,module=true}={}){let b0=null;const trace=[],lectures=[];
 const r=await pilote(L,{start:cut,end:0,endMode:'partie',globals:module?{BananeAppuisListe:B}:{},esv:(e,b)=>{b0=b;e.identity.cut=cut;avecReleve(mesure)(e,b);
  e.next=async function(){this.calls.push('next');this.identity={...this.identity,part:24,cut:1};return this.state();};
  for(const a of ECRITURES)if(typeof e[a]==='function'){const f=e[a].bind(e);e[a]=async(...x)=>{trace.push(neutre({a,x}));return f(...x);};}
  const envoyer=b.ctx.chrome.tabs.sendMessage;
  b.ctx.chrome.tabs.sendMessage=async(id,m)=>{if(m?.kind!=='b1-voisins')return envoyer(id,m);lectures.push(m.cut);
   if(liste===undefined)throw Error('page sans réponse');return JSON.parse(JSON.stringify(typeof liste==='function'?liste(m):liste));};}});
 const view=await r.b.settle();
 return {view,trace,lectures,calls:[...r.b.adapter.calls],ecritures:r.b.adapter.calls.filter(c=>c!=='capture'),b:r.b,b0};}

test('partie complète (compteur N = M) et cut affiché vert : 0 commande envoyée à ESV, lot clos avec l’avis',async()=>{
 for(const statut of ['valid','skipped']){
  const s=await scenario({mesure:{total:101,traites:101},liste:fenetre(50,statut)});
  assert.deepEqual(s.ecritures,[],`aucune écriture (${statut}) : ${s.calls}`);assert.deepEqual(s.trace,[]);
  assert.equal(s.view.batch.state,'STOPPED');assert.equal(s.view.notice,AVIS);
  assert.equal(s.view.batch.stoppedAtEnd.issue,'partie-sans-rouge');assert.equal(s.view.batch.stoppedAtEnd.applied,false);
  assert.equal(s.view.batch.processed.length,0);assert.equal(s.view.batch.deferred.length,0);
  const ev=s.b.store.events.filter(e=>e.type==='batch-stopped-at-end').at(-1);
  assert.equal(ev.reason,'partie-sans-rouge');assert.equal(ev.lastCut,50);assert.equal(ev.total,101);assert.equal(ev.statut,statut);
  /* « Reprendre » ne rejoue rien. */
  const v=await s.b.api('resume');assert.equal(v.batch.state,'STOPPED');assert.match(v.notice,/^Lot déjà terminé : partie sans cut rouge \(cut 50\)/);
  assert.deepEqual(s.b.adapter.calls.filter(c=>c!=='capture'),[]);}
});

test('tout autre cas : commandes envoyées à ESV identiques, à l’octet près, à celles d’un lot sans relevé (comportement d’avant)',async()=>{
 const ref=await scenario({mesure:null,liste:undefined,module:false});
 assert.deepEqual(ref.calls,['capture','apply','validate','next'],'référence : pose, validation, partie suivante');
 assert.deepEqual(ref.trace.map(x=>x.a),['apply','validateAndNext','next'],'la navigation de l’ESV simulé passe par `next`');
 for(const [nom,o] of [
   ['partie complète, cut affiché ROUGE',{mesure:{total:101,traites:101},liste:fenetre(50,'invalid')}],
   ['partie complète, statut illisible',{mesure:{total:101,traites:101},liste:fenetre(50,'autre')}],
   ['partie complète, page sans réponse',{mesure:{total:101,traites:101},liste:undefined}],
   ['partie complète, page qui refuse',{mesure:{total:101,traites:101},liste:{ok:false,reason:'sans-table'}}],
   ['partie complète, deux tables et ligne non rapprochée',{mesure:{total:101,traites:101},liste:fenetre(50,'valid',{tables:2,index:12})}],
   ['partie complète, ligne du cut absente',{mesure:{total:101,traites:101},liste:{...fenetre(50,'valid'),rows:[]}}],
   ['partie complète, module de lecture absent',{mesure:{total:101,traites:101},liste:fenetre(50,'valid'),module:false}],
   ['il reste des rouges (N < M), cut vert',{mesure:{total:101,traites:90},liste:fenetre(50,'valid')}],
   ['compteur absent',{mesure:null,liste:fenetre(50,'valid')}],
   ['compteur illisible (plusieurs compteurs)',{mesure:i=>({requestId:'r',at:new Date().toISOString(),identity:{pageId:i.pageId,part:i.part,cut:i.cut},compteur:{traites:101,total:101},compteursVus:2}),liste:fenetre(50,'valid')}],
   ['relevé d’un autre cut',{mesure:i=>({requestId:'r',at:new Date().toISOString(),identity:{pageId:i.pageId,part:i.part,cut:49},compteur:{traites:101,total:101}}),liste:fenetre(50,'valid')}],
   ['relevé d’une autre partie',{mesure:i=>({requestId:'r',at:new Date().toISOString(),identity:{pageId:i.pageId,part:22,cut:i.cut},compteur:{traites:101,total:101}}),liste:fenetre(50,'valid')}],
   ['relevé antérieur au début du cut',{mesure:i=>({requestId:'r',at:'2020-01-01T00:00:00.000Z',identity:{pageId:i.pageId,part:i.part,cut:i.cut},compteur:{traites:101,total:101}}),liste:fenetre(50,'valid')}]]){
  const s=await scenario(o);
  assert.deepEqual(s.calls,ref.calls,nom);assert.deepEqual(s.trace,ref.trace,nom+' : arguments identiques');
  assert.doesNotMatch(String(s.view.notice),/Rien n’a été envoyé à ESV/,nom);}
});

test('la liste n’est lue que si le compteur dit la partie complète, et une seule fois, au premier cut',async()=>{
 const reste=await scenario({mesure:{total:101,traites:90},liste:fenetre(50,'valid')});
 assert.equal(reste.lectures.filter(c=>c===50).length,reste.lectures.length,'aucune lecture en plus d’un autre cut');
 const avant=await scenario({mesure:null,liste:fenetre(50,'valid')});
 const complet=await scenario({mesure:{total:101,traites:101},liste:fenetre(50,'invalid')});
 assert.equal(complet.lectures.length-avant.lectures.length,1,'une lecture de la liste, en mémoire de la page, pour le seul premier cut');
 assert.equal(reste.lectures.length,avant.lectures.length,'partie incomplète : aucune lecture ajoutée');
});

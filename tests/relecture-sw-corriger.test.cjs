'use strict';
/* 5.0 (D-170 à D-176) — RELECTURE APRÈS LE LOT, service worker réel (tests/helpers/relecture-lot.cjs) : corriger : seuls les verts
 * PROUVÉS (statut lu dans ESV) qui passent la règle prudente sont posés, par la commande `apply` du lot (clic « tout-recentre »), puis
 * validés par Maj+Espace, le geste de Mic (revue, correction 4), qui valide SUR PLACE (D-179) : preuve = l'écriture « valid » de la
 * ligne ET le même cut toujours affiché ; la passe avance ensuite d'UN PAS vers le cut suivant. Jamais de pose juste après un saut par
 * la carte : le premier cut d'une plage est atteint par un pas (correction 3).
 * Données synthétiques. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const {H,GOLDEN,empreinteLot,j,sansRelecture,PERMISSIF,apresLot,posesApresSaut}=require('./helpers/relecture-essais.cjs');

test('corriger : verts prouvés qui passent la règle, `apply` du lot puis Maj+Espace sur place, prouvé par l’écriture et le même cut ; puis un pas ; premier cut de plage atteint par un pas',async()=>{
 const {b,adapter,lot,local}=await H.lotRelecture({mode:'corriger',decisions:{108:13,109:14,110:[14,2],115:20,116:90},reglagesProposes:PERMISSIF});
 const p=await H.finPasse(b);
 assert.equal(empreinteLot(sansRelecture(lot)),GOLDEN.empreinteCommandes,'le lot avant la passe est celui de la base');
 assert.equal(p.etat,'finie',p.message);assert.equal(p.modeEffectif,'corriger');assert.equal(p.corriges,3);assert.equal(p.refusees,0);
 assert.deepEqual(adapter.majEspace.map(x=>x.cut),[108,109,115]);assert.deepEqual(adapter.applyArgs.slice(2).map(x=>x.cut),[108,109,115]);
 assert.deepEqual(j(adapter.majEspace.map(x=>x.scope)),[{part:23,pageId:adapter.identity.pageId},{part:23,pageId:adapter.identity.pageId},{part:23,pageId:adapter.identity.pageId}]);
 /* Correction 3 : 108, premier cut de la plage et corrigeable, est atteint par un saut au cut 107 puis un pas ; aucune pose ne suit un saut.
  * D-179 : Maj+Espace valide sur place, ESV reste sur le même cut ; la passe fait ensuite un pas vers le cut suivant (109 après 108,
  * 110 après 109, 116 après 115) : jamais un saut, jamais une pose juste après un saut. */
 assert.deepEqual(adapter.allees.map(a=>[a.cut,a.chemin]),[[107,'auto'],[108,'pas'],[109,'pas'],[110,'pas'],[113,'pas'],[114,'pas'],[115,'pas'],[116,'pas']]);
 {const suite=apresLot(b,lot).filter(c=>['goToCut','validerMajEspace'].includes(c.action));
  for(let i=0;i<suite.length;i++)if(suite[i].action==='validerMajEspace'){const n=suite[i+1];
   assert.equal(n?.action,'goToCut','après Maj+Espace, la passe avance (un pas)');assert.equal(n.args[1].chemin,'pas');assert.equal(n.args[0].cut,suite[i].args[0].cut+1,'vers le cut suivant');}}
 const apres=apresLot(b,lot);assert.deepEqual(posesApresSaut(apres),[],'aucune pose juste après un saut par la carte');
 for(const a of ['validateAndNext','validateInPlace','skipAndNext','next','nextWithoutDecision','restore'])assert.equal(apres.some(c=>c.action===a),false,a);
 /* Le chemin de la pose d'un rouge, clic « tout-recentre » (T-5 : jamais de clic direct) ; relu ; puis Maj+Espace. */
 const poses=apres.filter(c=>c.action==='apply');
 for(const c of poses){assert.deepEqual(j(c.args[2]),{clicHumain:'tout-recentre'});assert.ok(['left','right'].every(s=>Array.isArray(c.args[1][s].delta)&&c.args[1][s].delta.length===3));}
 const i=apres.findIndex(c=>c.action==='apply');assert.deepEqual(apres.slice(i-1,i+3).map(c=>c.action),['state','apply','state','validerMajEspace']);
 assert.deepEqual(j(apres.find(c=>c.action==='validerMajEspace').args.slice(1)),[{part:23,pageId:adapter.identity.pageId}],'aucune option : le simulateur échouerait');
 /* Aucune marque propre à la relecture dans ce qui part vers la page, lot compris (R7). */
 assert.equal(/relecture/i.test(JSON.stringify(apres)),false);assert.equal(/relecture/i.test(JSON.stringify(lot)),false);
 const ev=H.evenements(b,'relecture-ombre'),de=c=>ev.find(e=>e.identity.cut===c);
 for(const c of [108,109,115]){assert.equal(de(c).action,'corrige',`cut ${c}`);assert.equal(de(c).garde.ok,true);assert.deepEqual(j(de(c).statutEsv),{statut:'valid',operateur:false,vu:false});}
 assert.deepEqual(['108','109','110','116'].map(c=>de(+c).arrivee),['pas','pas','pas','pas']);assert.deepEqual(j(de(108).chemins),['auto:107','pas']);assert.deepEqual(j(de(109).chemins),['pas']);
 assert.equal(de(110).action,'visite');assert.equal(de(110).critere.regle,'coherence','les deux rails ne sont pas cohérents');
 assert.equal(de(116).action,'visite');assert.equal(de(116).critere.regle,'voie','jamais de changement de voie');
 assert.equal(de(114).action,'visite');assert.equal(de(113).role,'differe');
 /* La pose d'ESV des cuts corrigés est la pose calculée (relue à 1 mm), leur ligne est validée, et aucune intention ne reste. */
 for(const c of [108,109,115]){const r=adapter.poses.get(c),pc=de(c).poseCalculee;
  for(const s of ['left','right'])assert.ok(H.K.C.distance(r[s].positionSceneRelative,pc[s])<.001,`cut ${c}, rail ${s}`);}
 assert.equal('banane50RelectureIntention' in local.m,false);
 assert.match(p.message,/^Relecture finie : 7 cuts relus, 3 corrigés ; ESV a marqué \d+ cuts « vu »\.$/);
 const fin=H.evenements(b,'relecture-fin')[0];assert.equal(fin.corriges,3);assert.equal(fin.issue,'fin');
});

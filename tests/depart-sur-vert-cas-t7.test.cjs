'use strict';
/* Test 7, suite 2 — DÉPART SUR UN CUT VERT : CAS LIMITES. Information absente : rien ne change (on ne sait pas que le cut est
 * vert). Information présente mais douteuse, cut vert : arrêt sans rien envoyer. Navigation refusée par ESV : arrêt dit,
 * rien d'écrit. Partie complète : la règle d'avant. ESV simulé avec sa liste ; données synthétiques. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const {lotListe,partie}=require('./helpers/esv-liste.cjs');
const surCut=(s,c)=>s.trace.filter(t=>t.cut===c).map(t=>t.a);
const table=st=>({key:'traj',debut:true,rompue:false,tronquee:false,st:st.map(x=>({valid:0,invalid:1,skipped:2,autre:3})[x]),fl:st.map(()=>0),ed:[]});

test('cut vert et information douteuse : arrêt sans rien envoyer, avec la raison',async()=>{
 for(const [nom,o,motif,avis] of [
   ['liste et compteur en désaccord',{liste:partie(12,{rouges:[2,4]}),depart:0,pageTables:st=>({ok:true,tables:[table(st.map((x,i)=>i===6?'invalid':x))]})},'liste-incoherente',/ne concorde pas avec le compteur \(2 restants\)/],
   ['cut non validé suivant passé (SKIP)',{liste:partie(12,{rouges:[4],passes:[2]}),depart:0},'suivant-non-rouge',/Le cut non validé suivant \(2\) n’est pas rouge/],
   ['premier rouge au-delà du lot',{liste:partie(12,{rouges:[9]}),depart:0,fin:5},'hors-du-lot',/Le premier cut rouge après lui \(9\) est au-delà du dernier cut du lot \(5\)/]]){
  const s=await lotListe(o);
  assert.deepEqual(s.trace,[],nom+' : aucune commande');assert.equal(s.view.batch.state,'STOPPED',nom);
  assert.equal(s.view.batch.stoppedAtEnd.motif,motif,nom);assert.match(s.view.notice,avis,nom);assert.match(s.view.notice,/Rien n’a été envoyé à ESV\./,nom);}
});

test('navigation refusée par ESV (aucun cut non validé devant pour ESV) : arrêt dit, rien d’écrit, aucune erreur',async()=>{
 /* La table de la page annonce un rouge au cut 6 qu'ESV n'a pas : « cut non validé suivant » est désactivé, rien ne part. */
 const s=await lotListe({liste:partie(12,{rouges:[1,3]}),depart:8,pageTables:st=>({ok:true,tables:[table(st.map((x,i)=>i===3?'valid':i===9?'invalid':x))]})});
 assert.deepEqual(s.ecritures.filter(c=>c!=='nextWithoutDecision'),[],'aucune écriture');assert.equal(s.view.batch.state,'STOPPED');assert.equal(s.view.batch.error??null,null);
 assert.equal(s.view.batch.stoppedAtEnd.motif,'navigation');
 assert.match(s.view.notice,/^Partie 23 : le cut 8 est déjà validé ; rien n’y a été écrit\. La navigation vers le cut rouge 9 n’est pas partie/);
 const ev=s.b.store.events.filter(e=>e.type==='depart-sur-vert').at(-1);assert.equal(ev.ok,false);assert.equal(ev.refus,'NAVIGATION_COMMAND_UNAVAILABLE');
 assert.equal(ev.commandSent,false,'bouton désactivé : la page refuse avant tout clic');
});

test('partie complète, cut vert : la règle d’avant (rien n’est envoyé, « plus aucun cut rouge »)',async()=>{
 const s=await lotListe({liste:partie(12,{}),depart:5});
 assert.deepEqual(s.trace,[]);assert.equal(s.view.batch.stoppedAtEnd.issue,'partie-sans-rouge');
 assert.equal(s.view.notice,'Partie 23 : plus aucun cut rouge à traiter. Le lot s’arrête ici. Rien n’a été envoyé à ESV.');
});

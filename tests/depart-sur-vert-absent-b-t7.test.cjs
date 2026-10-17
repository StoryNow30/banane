'use strict';
/* Test 7, suite 2 — DÉPART SUR UN CUT VERT : INFORMATION ABSENTE. Information absente : rien ne change (on ne sait pas que le cut est
 * vert). Information présente mais douteuse, cut vert : arrêt sans rien envoyer. Navigation refusée par ESV : arrêt dit,
 * rien d'écrit. Partie complète : la règle d'avant. ESV simulé avec sa liste ; données synthétiques. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const {lotListe,partie}=require('./helpers/esv-liste.cjs');
const surCut=(s,c)=>s.trace.filter(t=>t.cut===c).map(t=>t.a);
const table=st=>({key:'traj',debut:true,rompue:false,tronquee:false,st:st.map(x=>({valid:0,invalid:1,skipped:2,autre:3})[x]),fl:st.map(()=>0),ed:[]});

test('information absente (table d’une autre longueur, table incomplète) : comportement d’avant, à l’octet près',async()=>{
 const o={liste:partie(8,{rouges:[2]}),depart:0};
 const ref=await lotListe({...o,table:false});
 /* Le comportement d'avant pose et valide le cut 0, vert : ici, Ctrl+Entrée, parce que le compteur ne laisse qu'un cut à
  * traiter et que `dernierCutCertain` le prend pour le cut affiché (audit P-5, C1). */
 assert.deepEqual(surCut(ref,0),['apply','validateInPlace'],'référence : le comportement d’avant écrit sur le cut 0');
 for(const [nom,x] of [['table d’une autre longueur',{pageTables:st=>({ok:true,tables:[table(st.slice(0,6))]})}],['table incomplète',{pageTables:st=>({ok:true,tables:[{...table(st),tronquee:true}]})}]]){
  const s=await lotListe({...o,...x});
  const r=nom==='compteur absent'?await lotListe({...o,table:false,releve:false}):ref;
  assert.deepEqual(s.trace,r.trace,nom);assert.equal(surCut(s,0)[0],'apply',nom);
  assert.equal(s.b.store.events.filter(e=>e.type==='depart-sur-vert').length,0,nom);}
});

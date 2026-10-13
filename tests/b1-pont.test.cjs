'use strict';
/* B1 (D-095) : le pont (src/bridge.js, monde isolé) relaie la demande de voisins du
 * service worker à l'observateur de la page et rend sa réponse, copiée et bornée.
 * Aucune requête vers ESV ; demande invalide refusée ; page muette : délai. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const plat=x=>JSON.parse(JSON.stringify(x===undefined?null:x));
const {bridge}=require('./helpers/bridge.cjs');
const world={left:[1,2,3],right:[1,3.435,3]};
const demande=(f,m)=>f.uiMessage({kind:'b1-voisins',cut:12,fenetre:5,world,...m});

test('demande relayée à la page, réponse rendue (copie bornée), une seule fois',()=>{
  const f=bridge(),n=f.sent.length,replies=demande(f);
  const q=f.sent.at(-1);assert.equal(f.sent.length,n+1);assert.deepEqual(plat(q),{kind:'banane5:voisins',id:q.id,cut:12,fenetre:5,world});
  const rep={kind:'banane5:voisins-reponse',v:1,id:q.id,ok:true,geo:{index:12,mm:0.1,secondMm:990},rows:[{i:11,s:'valid',e:[1,2,3,4,5,6]}],table:{lignes:900}};
  f.emit({...rep,id:'autre'});assert.equal(replies.length,0,'autre identifiant : ignoré');
  f.emit(rep);rep.rows[0].i=99;assert.equal(replies.length,1);assert.equal(replies[0].rows[0].i,11,'copie : la page ne change plus ce qui est parti');
  assert.equal(replies[0].ok,true);f.emit(rep);assert.equal(replies.length,1,'une réponse par demande');
  assert.ok(!f.traces.length,'rien d’autre envoyé au service worker');
});
test('demande invalide : refusée sans rien poster ; page muette : délai ; réponse trop grosse : refus',()=>{
  const f=bridge(),n=f.sent.length;
  for(const m of [{cut:-1},{cut:'3'},{fenetre:0},{fenetre:11},{world:{left:[1,2],right:[1,2,3]}},{world:{left:[1,2,NaN],right:[1,2,3]}}])
    assert.equal(demande(f,m)[0].reason,'demande-invalide',JSON.stringify(m));
  assert.equal(f.sent.length,n,'rien posté à la page');
  const r=demande(f),t=[...f.timers.entries()].at(-1);assert.equal(t[1].ms,500);t[1].fn();assert.deepEqual(plat(r),[{ok:false,reason:'page-sans-reponse'}]);
  const g=bridge(),big=demande(g),q=g.sent.at(-1);g.emit({kind:'banane5:voisins-reponse',id:q.id,ok:true,rows:[{pad:'x'.repeat(20000)}]});assert.deepEqual(plat(big),[{ok:false,reason:'trop-gros'}]);
});
test('réglage « off » rendu par le service worker : le pont demande à la page d’oublier sa table',async()=>{
  const f=bridge({observationReply:()=>({accept:true,stored:1,tableListe:false})});
  f.emit({kind:'banane5:esv-observation',v:1,observer:'o',entry:{seq:1,kind:'resource',n:1}});
  const t=[...f.timers.entries()].at(-1);f.timers.delete(t[0]);await t[1].fn();
  assert.ok(f.sent.some(m=>m.kind==='banane5:config'&&m.table===false&&!('enabled' in m)));
});

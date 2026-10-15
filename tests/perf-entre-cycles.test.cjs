'use strict';
/* M1 (relecture du test 3, angle mesure) : le temps ENTRE deux cycles consécutifs (de `next-observed` de la visite k à
 * `navigationMs` de la visite k+1) n'était ni attribué ni « non expliqué » : sur le vrai lot, 199 s dont 112 s sans
 * aucune étape. L'outil le publie à part (rien n'est ajouté au cycle), avec la part couverte par une étape de k ou de
 * k+1 et le reste « sans étape entre cycles », et découpe la durée du lot. Données fabriquées. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const V1=require('../tools/perf-phases.cjs'),{journal,id}=require('./helpers/perf-phases.cjs');
const pt=(j,p,v='visit')=>j.events.find(e=>e.point===p&&e.visitId===v);
/* Deux visites : la 2e (coupe 101) part `ecart` ms après la « navigation suivante » de la 1re. */
function deuxVisites(ecart=700,{lien=true,raison='observed-target',decale=null}={}){
 const j=journal(),v1=j.events.filter(e=>e.visitId==='visit'),fin=j.events.filter(e=>e.kind==='batch'&&e.point==='end'||e.kind==='health');
 const d=1600+ecart,v2=v1.filter(e=>e.kind!=='batch'&&e.kind!=='health').map(e=>{const c={...e,eventId:'2'+e.eventId,visitId:'visit2',identity:id(101),ms:e.ms+d};
  if(Number.isFinite(c.fromMs)){c.fromMs+=d;c.toMs+=d;}if(c.kind==='visit'){c.navigationMs=d;c.navigationReason=raison;}return c;});
 for(const e of fin)e.ms+=d;for(const h of fin.filter(e=>e.kind==='health'))h.visits=2;
 pt(j,'next-observed').nextIdentity=lien?id(101):id(102);
 if(decale)decale(j);
 j.events=[...j.events.filter(e=>!fin.includes(e)),...v2,...fin];j.events.forEach((e,i)=>{e.batchSeq=i+1;e.seq=i+1;});
 j.state.batch.sequence=[{identity:id(100)},{identity:id(101)}];return j;
}
test('700 ms entre deux cycles : publiés « entre cycles », sans étape, hors du cycle',()=>{
 const m=V1.measure(deuxVisites(700)),a=m.attribution,l=m.lots[0],b=l.attribution.betweenCycles;
 assert.equal(a.cycleMs,3200,'rien n’est ajouté au cycle');assert.equal(a.attributedMs+a.unexplainedMs,a.cycleMs);
 assert.ok(b,'bilan « entre cycles » du lot');
 assert.equal(b.transitions,1);assert.equal(b.ms,700);assert.equal(b.coveredMs,0);assert.equal(b.uncoveredMs,700);assert.equal(b.unlinked,0);
 assert.deepEqual(a.betweenCycles&&{n:a.betweenCycles.transitions,ms:a.betweenCycles.ms,sans:a.betweenCycles.uncoveredMs},{n:1,ms:700,sans:700},'ensemble');
 // Durée du lot (−10 → 3910 = 3920 ms) = avant 10 + cycles 3200 + entre 700 + après 10 + autres 0.
 const p=l.attribution.partition;assert.ok(p,'découpage de la durée du lot');
 assert.deepEqual({lot:p.lotMs,avant:p.beforeMs,cycles:p.cyclesMs,entre:p.betweenMs,apres:p.afterMs,autres:p.otherMs,recouvrement:p.overlapMs},
  {lot:3920,avant:10,cycles:3200,entre:700,apres:10,autres:0,recouvrement:0});
 assert.equal(p.beforeMs+p.cyclesMs+p.betweenMs+p.afterMs+p.otherMs-p.overlapMs,p.lotMs,'la somme vaut la durée du lot');
 const md=V1.toMarkdown(m,{coupes:false});
 assert.match(md,/sans étape entre cycles 0,7 s/,'à côté du non expliqué');
 assert.match(md,/Entre cycles : 1 transition\(s\) reliée\(s\), 0,7 s/);
 assert.match(md,/Durée des lots 3,9 s = avant le premier cycle 0,0 s \+ cycles mesurés 3,2 s \+ entre cycles 0,7 s/);
});
test('acceptation de la visite k tombée entre les cycles : comptée « couverte » (validation de k), pas « sans étape »',()=>{
 const j=deuxVisites(700,{decale:j=>{pt(j,'accepted').ms=1900;}});
 const b=V1.measure(j).lots[0].attribution.betweenCycles;
 assert.equal(b.ms,700);assert.equal(b.validationMs,300,'1600 → 1900 : validation de k');assert.equal(b.coveredMs,300);assert.equal(b.uncoveredMs,400);
});
test('lien incertain (cible annoncée ≠ visite suivante, ou navigation non observée) : non relié, rien publié comme entre cycles',()=>{
 for(const opts of [{lien:false},{raison:'unobserved'}]){
  const b=V1.measure(deuxVisites(700,opts)).lots[0].attribution.betweenCycles;
  assert.equal(b.transitions,0);assert.equal(b.ms,0);assert.equal(b.unlinked,1);}
});

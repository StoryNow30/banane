const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const L=require('../tools/pair-lab.cjs');
/* Banc d'arbitrage de paire — HORS LIGNE. Ces tests verrouillent trois choses :
 * qu'aucun candidat n'est fabriqué, que la décision ne voit aucune valeur
 * humaine, et que les cuts réservés restent hors de tout réglage. Ils
 * reproduisent aussi les chiffres de l'audit indépendant, pour que les deux
 * bancs restent comparables. */
const root=path.resolve(__dirname,'..');
const source=JSON.parse(fs.readFileSync(path.join(root,'datasets/automatic/offline-evaluation-v4.3.0.json')));
const rows=L.build();

test('les trois candidats sont LUS dans le corpus, jamais fabriqués',()=>{
 let lus=0;
 for(const x of source.results){
  const row=rows.find(r=>r.part===x.identity.part&&r.cut===x.identity.cut);
  for(const side of ['left','right']){
   const m=x.proposal[side].metrics,ta=m.templateAmbiguity||{},c=row.candidates[side];
   // chaque candidat reprend exactement les valeurs du fichier, sans retouche
   assert.deepEqual(c.graine,[0,m.seed[0],m.seed[1]]);
   assert.deepEqual(c.surface,[0,m.surfaceIntersection[0],m.surfaceIntersection[1]]);
   assert.deepEqual(c.alternative,[0,ta.alternative[0],ta.alternative[1]]);
   assert.equal(Object.keys(c).length,3,'aucun quatrième candidat');
   lus+=3;
  }
 }
 assert.equal(lus,660,'220 rails × 3 placements exposés');
 assert.ok(rows.every(r=>r.combinations.length===9),'9 combinaisons par cut');
});

test('la composante x vaut exactement zéro dans le corpus : l’assemblage (0,y,z) est exact',()=>{
 const deltas=source.results.flatMap(x=>['left','right'].map(s=>x.proposal[s].delta).filter(Boolean));
 assert.equal(deltas.length,173,'173 rails résolus portent un delta');
 assert.ok(deltas.every(d=>d[0]===0),'la recherche du moteur est bidimensionnelle');
});

test('effectifs d’abstention : 47 rails, 42 cuts — deux comptes différents',()=>{
 const rails=rows.reduce((n,r)=>n+['left','right'].filter(s=>r.rails[s].status==='unresolved').length,0);
 const cuts=rows.filter(r=>!L.engineApplies(r));
 assert.equal(rails,47);
 assert.equal(cuts.length,42);
 assert.equal(cuts.filter(r=>r.part===17).length,5);
 assert.equal(cuts.filter(r=>r.part===20).length,37);
});

test('les chiffres de l’audit indépendant sont reproduits à la convention 10×10⁻³',()=>{
 const p17=rows.filter(r=>r.part===17),p20=rows.filter(r=>r.part===20);
 assert.equal(p17.filter(r=>L.recoverable(r)).length,26,'part 17 : 26/26');
 assert.equal(p20.filter(r=>L.recoverable(r)).length,78,'part 20 : 78/84');
 assert.deepEqual(rows.filter(r=>!L.recoverable(r)).map(r=>r.cut).sort((a,b)=>a-b),
   [485,1512,1664,1665,3908,3909]);
 const abst20=p20.filter(r=>!L.engineApplies(r));
 assert.equal(abst20.length,37);
 assert.equal(abst20.filter(r=>L.recoverable(r)).length,31,'31 des 37 abstentions sont récupérables');
 const mauvais=p20.filter(r=>L.engineApplies(r)&&(L.appliedError(r)??0)>L.TOLERANCE_ORACLE);
 assert.deepEqual(mauvais.map(r=>r.cut).sort((a,b)=>a-b),[1,1422,4568,5123,6576,9041,9044]);
 assert.ok(mauvais.every(r=>L.recoverable(r)),'chacun avait déjà une bonne combinaison exposée');
});

test('la décision ne lit aucune valeur humaine',()=>{
 /* Contrôle mécanique : on efface la référence humaine, et la politique doit
  * rendre exactement les mêmes décisions. Si une valeur humaine fuyait dans
  * l'ancre ou la porte, ce test tomberait. */
 const aveugle=JSON.parse(JSON.stringify(rows));
 for(const r of aveugle)for(const s of ['left','right'])r.rails[s].humanDeltaLocal=null;
 for(let i=0;i<rows.length;i++){
  const a=L.decide(rows[i],rows,{R:5,K:3});
  const b=L.decide(aveugle[i],aveugle,{R:5,K:3});
  assert.deepEqual({d:a.decision,g:a.left,dr:a.right},{d:b.decision,g:b.left,dr:b.right},
    `cut ${rows[i].cut} : la décision change quand on retire l’humain`);
 }
});

test('les cuts réservés 9031–9047 ne servent ni de socle d’ancrage ni de réglage',()=>{
 const reserves=rows.filter(r=>r.reserved);
 assert.equal(reserves.length,17);
 assert.ok(reserves.every(r=>r.cut>=9031&&r.cut<=9047));
 /* Retirer entièrement les cuts réservés ne doit rien changer à l'ancre d'un
  * cut non réservé : ils sont déjà exclus du socle. */
 const sansReserve=rows.filter(r=>!r.reserved);
 for(const part of [17,20]){
  const a=L.anchorFor(rows,part,null,5),b=L.anchorFor(sansReserve,part,null,5);
  assert.deepEqual(a,b,`part ${part} : l’ancre dépend d’un cut réservé`);
 }
 // Le balayage ne compte aucun cut réservé.
 const s=L.sweep(rows,5,[3])[0];
 assert.equal(s.arbitrated+s.abstained+s.untouched,sansReserve.length);
});

test('l’ancre est estimée par part, sur les seuls cuts fortement discriminés',()=>{
 for(const part of [17,20]){
  const a=L.anchorFor(rows,part,null,5);
  assert.ok(a&&a.base>=5,`part ${part} : socle insuffisant`);
  assert.ok(a.dispersion>0);
 }
 // Leave-one-out : le cut jugé ne participe jamais à sa propre ancre.
 const cible=rows.find(r=>r.part===20&&!r.reserved&&L.settled(r,5));
 const avec=L.anchorFor(rows,20,null,5),sans=L.anchorFor(rows,20,cible.cut,5);
 assert.equal(sans.base,avec.base-1);
});

test('la politique ne touche jamais un cut fortement discriminé des deux côtés',()=>{
 for(const r of rows){
  if(!L.settled(r,5))continue;
  assert.equal(L.decide(r,rows,{R:5,K:3}).decision,'moteur');
 }
});

test('la porte de plausibilité refuse les cuts sans candidat compatible',()=>{
 /* 3908, 1512 et 3909 n'ont aucune combinaison exposée proche de la vérité :
  * le banc doit s'abstenir plutôt que d'appliquer le moins mauvais. */
 for(const cut of [3908,1512,3909]){
  const r=rows.find(x=>x.cut===cut);
  assert.equal(L.recoverable(r),false,`cut ${cut} devrait être non récupérable`);
  assert.equal(L.decide(r,rows,{R:5,K:3}).decision,'abstention',`cut ${cut} : la porte doit se fermer`);
 }
});

test('le balayage de K est livré entier, sans valeur retenue',()=>{
 const s=L.sweep(rows,5,[1,2,3,5,10]);
 assert.equal(s.length,5);
 assert.ok(s.every(x=>x.regressed>=0&&x.recovered>=0));
 // la couverture croît avec K : la porte s'ouvre
 for(let i=1;i<s.length;i++)assert.ok(s[i].arbitrated>=s[i-1].arbitrated,'couverture non monotone');
});

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

/* ---- tour « famille seulement » ---------------------------------------- */

test('le moteur applique la graine : sa préférence fine est déjà déterminée',()=>{
 /* C'est ce fait qui autorise à reprendre la graine comme représentant de la
  * famille, y compris pour un rail abstenu, SANS inventer de règle
  * graine-contre-surface. */
 let resolus=0;
 for(const x of source.results)for(const s of ['left','right']){
  const p=x.proposal[s];
  if(!p.delta)continue;
  resolus++;
  assert.deepEqual(p.delta,[0,p.metrics.seed[0],p.metrics.seed[1]],
    'le delta appliqué doit être exactement la graine');
 }
 assert.equal(resolus,173);
 assert.equal(L.familyRepresentative('best'),'graine');
 assert.equal(L.familyRepresentative('alternative'),'alternative');
 assert.throws(()=>L.familyRepresentative('autre'),/Famille inconnue/);
});

test('la relation de paire appliquée est celle du couple (graine, graine)',()=>{
 const row=rows.find(r=>L.settled(r,5));
 const parGraine=row.combinations.find(c=>c.left==='graine'&&c.right==='graine').pair;
 assert.equal(L.appliedPair(row),parGraine);
});

test('la partition en familles est structurelle, pas métrique',()=>{
 assert.deepEqual(L.FAMILIES,{best:['graine','surface'],alternative:['alternative']});
 /* Un critère de distance serait un seuil nouveau : le moteur garantit
  * alternativeSeparation contre coarseBest, pas contre la graine affinée. */
 const sep=source.engine.parameters.alternativeSeparation;
 const proches=source.results.flatMap(x=>['left','right'].map(s=>{
  const m=x.proposal[s].metrics,a=m.templateAmbiguity.alternative;
  return Math.hypot(a[0]-m.seed[0],a[1]-m.seed[1]);
 })).filter(d=>d<sep).length;
 assert.equal(proches,29,'29 alternatives sont à moins de alternativeSeparation de leur graine');
});

test('« famille seulement » n’arbitre jamais une variante fine',()=>{
 for(const r of rows){
  const d=L.decideFamily(r,rows,{R:5,K:3});
  if(d.decision!=='arbitrée')continue;
  assert.ok(['graine','alternative'].includes(d.left),'surface ne doit jamais être choisie');
  assert.ok(['graine','alternative'].includes(d.right),'surface ne doit jamais être choisie');
  assert.equal(d.left,L.familyRepresentative(d.familyLeft));
  assert.equal(d.right,L.familyRepresentative(d.familyRight));
 }
});

test('« famille seulement » supprime les régressions, à tous les K du balayage',()=>{
 for(const s of L.sweep(rows,5,[1,2,3,5,10],L.decideFamily))
  assert.equal(s.regressed,0,`K=${s.K} : régression inattendue`);
 // la politique fine, elle, en produit — c'est la raison d'être de ce tour
 assert.ok(L.sweep(rows,5,[3],L.decide)[0].regressed>0,
   'la politique fine doit conserver ses régressions, sinon la comparaison n’a plus d’objet');
});

test('les corrections matérielles sont conservées par « famille seulement »',()=>{
 for(const cut of [5123,6576,9041]){
  const r=rows.find(x=>x.cut===cut);
  const d=L.decideFamily(r,rows,{R:5,K:3});
  assert.equal(d.decision,'arbitrée',`cut ${cut} doit rester arbitré`);
  const avant=L.appliedError(r),apres=L.measure(r,d.left,d.right);
  assert.ok(apres<avant,`cut ${cut} : ${apres} devrait être meilleur que ${avant}`);
  assert.ok(avant>L.TOLERANCE_ORACLE&&apres<=L.TOLERANCE_ORACLE,
    `cut ${cut} : le mauvais choix matériel doit repasser sous la convention d’évaluation`);
 }
});

test('l’artefact figé est déterministe et son empreinte est recalculable',()=>{
 const a=L.freeze(rows),b=L.freeze(rows);
 assert.equal(a.sha256,b.sha256,'deux gels doivent donner la même empreinte');
 assert.equal(a.decisions.length,110);
 assert.deepEqual(Object.keys(a.decisions[0].byK),['1','2','3','5','10'],'aucun K n’est choisi');
 // recalcul indépendant, exactement comme le ferait un tiers
 const crypto=require('node:crypto');
 const canonique=JSON.stringify({format:a.format,policy:a.policy,source:a.source,
   parameters:a.parameters,reserved:a.reserved,decisions:a.decisions});
 assert.equal(crypto.createHash('sha256').update(canonique).digest('hex'),a.sha256);
 assert.deepEqual(a.sha256Covers,['format','policy','source','parameters','reserved','decisions']);
 // l'horodatage ne doit PAS entrer dans l'empreinte
 assert.ok(!a.sha256Covers.includes('frozenAt'));
 assert.equal(a.reserved.cuts.length,17);
});

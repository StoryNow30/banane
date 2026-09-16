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
 assert.ok(s.every(x=>x.regressed>=0&&x.recoveredAtOracleTolerance>=0));
 // la couverture croît avec K : la porte s'ouvre
 for(let i=1;i<s.length;i++)assert.ok(s[i].arbitrated>=s[i-1].arbitrated,'couverture non monotone');
});

test('les compteurs du balayage se referment exactement — « recovered » était faux',()=>{
 /* Revue Astra. L'ancien compteur `recovered` incrémentait pour tout cut arbitré
  * dont le moteur n'appliquait rien, SANS regarder l'erreur obtenue. Trois
  * compteurs le remplacent et doivent se recomposer sans reste. */
 assert.ok(!('recovered' in L.sweep(rows,5,[3])[0]),'le compteur fautif ne doit plus exister');
 for(const decider of [L.decide,L.familyDecider('pair-joint'),L.familyDecider('lock-resolved-rail')])
  for(const s of L.sweep(rows,5,[1,2,3,5,10],decider)){
   assert.equal(s.untouched+s.abstained+s.arbitrated,
     rows.filter(r=>!r.reserved).length,`K=${s.K} : le total ne couvre pas les cuts de conception`);
   assert.equal(s.untouchedSettled+s.untouchedNothingToArbitrate,s.untouched);
   assert.equal(s.arbitratedAbstention+s.arbitratedApplied,s.arbitrated);
   assert.equal(s.recoveredAtOracleTolerance+s.arbitratedButOutsideTolerance
     +s.abstentionNotMeasurable,s.arbitratedAbstention,`K=${s.K} : reste sur les abstentions arbitrées`);
   assert.equal(s.corrected+s.regressed+s.unchanged+s.appliedNotMeasurable,s.arbitratedApplied);
  }
 /* Et le compteur corrigé mord réellement : à K=3, la politique fine arbitre 26
  * abstentions dont 3 ressortent AU-DESSUS de la convention d'évaluation.
  * L'ancien compteur les aurait toutes annoncées « récupérées ». */
 const f=L.sweep(rows,5,[3],L.decide)[0];
 assert.equal(f.arbitratedAbstention,26);
 assert.equal(f.recoveredAtOracleTolerance,23);
 assert.equal(f.arbitratedButOutsideTolerance,3);
});

/* ---- tour « famille seulement » ---------------------------------------- */

test('sur les rails effectivement résolus, le delta appliqué est exactement la graine',()=>{
 /* Formulation exacte (revue Astra). Ce fait porte sur les rails que le moteur a
  * RÉSOLUS. Il justifie d'utiliser la graine comme REPRÉSENTANT de la famille
  * best, sans inventer de règle graine-contre-surface. Il ne dit rien d'un rail
  * abstenu : là, le moteur n'a rien appliqué du tout. */
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
 /* Le pendant de l'affirmation : sur un rail abstenu, le moteur n'a RIEN
  * appliqué. On ne peut donc pas dire qu'il « avait décidé d'appliquer la
  * graine » sur ce rail. Les 47 rails abstenus n'ont aucun delta. */
 let abstenus=0;
 for(const x of source.results)for(const s of ['left','right']){
  if(x.proposal[s].status!=='unresolved')continue;
  abstenus++;
  assert.ok(!x.proposal[s].delta,'un rail abstenu ne doit porter aucun delta appliqué');
 }
 assert.equal(abstenus,47);
 assert.equal(resolus+abstenus,220);
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

test('« famille seulement » supprime les régressions, à tous les K et dans les deux variantes',()=>{
 for(const v of L.VARIANTS)
  for(const s of L.sweep(rows,5,[1,2,3,5,10],L.familyDecider(v)))
   assert.equal(s.regressed,0,`${v} K=${s.K} : régression inattendue`);
 // la politique fine, elle, en produit — c'est la raison d'être de ce tour
 assert.ok(L.sweep(rows,5,[3],L.decide)[0].regressed>0,
   'la politique fine doit conserver ses régressions, sinon la comparaison n’a plus d’objet');
});

/* ---- deux variantes explicitement distinctes ----------------------------- */

test('« settled » est une condition de CUT : pair-joint peut déplacer un rail déjà résolu',()=>{
 /* Le défaut relevé par Astra, mesuré. `settled(row,R)` exige que les DEUX
  * rails soient discriminés ; un cut à un rail abstenu parcourt donc toutes les
  * familles et peut déplacer le rail déjà `candidate`. */
 const attendu={1:[5123,6576],2:[1665,5123,6576,9041],
                3:[1665,5123,6576,9041,9106],5:[1665,5123,6576,9041,9106],
                10:[1665,5123,6576,9041,9106]};
 for(const K of [1,2,3,5,10]){
  const touches=rows.filter(r=>L.resolvedRailsMoved(r,
    L.decideFamily(r,rows,{R:5,K,variant:'pair-joint'})).length).map(r=>r.cut).sort((a,b)=>a-b);
  assert.deepEqual(touches,attendu[K],`K=${K} : cuts déplaçant un rail déjà résolu`);
 }
 /* Cas le plus net : le rail gauche du cut 9106 a un lossRatio de 11.55, bien
  * au-dessus de R=5, et se fait pourtant déplacer parce que son partenaire
  * s'abstient. */
 const r9106=rows.find(r=>r.cut===9106);
 assert.ok(r9106.rails.left.lossRatio>5);
 assert.equal(r9106.rails.left.status,'candidate');
 assert.equal(r9106.rails.right.status,'unresolved');
 assert.equal(L.settled(r9106,5),false);
});

test('lock-resolved-rail ne déplace jamais un rail déjà résolu, à aucun K',()=>{
 for(const K of [1,2,3,5,10])for(const r of rows){
  const d=L.decideFamily(r,rows,{R:5,K,variant:'lock-resolved-rail'});
  assert.deepEqual(L.resolvedRailsMoved(r,d),[],`cut ${r.cut} K=${K}`);
  if(d.decision!=='arbitrée')continue;
  for(const s of ['left','right'])
   if(r.rails[s].status==='candidate')
    assert.equal(s==='left'?d.left:d.right,'graine',`cut ${r.cut} : rail ${s} doit rester sur sa graine`);
 }
 // un rail déjà résolu n'ouvre qu'une famille ; un rail abstenu les ouvre toutes
 assert.deepEqual(L.openFamilies({status:'candidate'},'lock-resolved-rail'),['best']);
 assert.deepEqual(L.openFamilies({status:'unresolved'},'lock-resolved-rail'),['best','alternative']);
 assert.deepEqual(L.openFamilies({status:'candidate'},'pair-joint'),['best','alternative']);
 assert.throws(()=>L.openFamilies({status:'unresolved'},'autre'),/Variante inconnue/);
});

test('les deux variantes sont réellement distinctes, et le banc n’en choisit aucune',()=>{
 const diff=K=>rows.filter(r=>{
  const a=L.decideFamily(r,rows,{R:5,K,variant:'pair-joint'});
  const b=L.decideFamily(r,rows,{R:5,K,variant:'lock-resolved-rail'});
  const k=d=>d.decision==='arbitrée'?`${d.left}/${d.right}`:`${d.decision}:${d.reason}`;
  return k(a)!==k(b);
 }).length;
 assert.deepEqual([1,2,3,5,10].map(diff),[27,28,29,29,29],'nombre de cuts qui divergent');
 assert.deepEqual(L.VARIANTS,['pair-joint','lock-resolved-rail']);
 // aucune variante par défaut n'est présentée comme retenue : les deux sont figées
 assert.equal(L.freeze(rows,{variant:'pair-joint'}).variant,'pair-joint');
 assert.equal(L.freeze(rows,{variant:'lock-resolved-rail'}).variant,'lock-resolved-rail');
 assert.throws(()=>L.freeze(rows,{variant:'autre'}),/Variante inconnue/);
});

test('sous lock-resolved-rail, un cut sans rail abstenu n’est pas arbitrable',()=>{
 /* Conséquence directe et assumée : si les deux rails sont déjà `candidate`,
  * la seule option ouverte est le couple que le moteur applique déjà. Le banc
  * le dit explicitement plutôt que de le confondre avec une abstention. */
 let n=0;
 for(const r of rows){
  if(L.settled(r,5))continue;
  if(r.rails.left.status!=='candidate'||r.rails.right.status!=='candidate')continue;
  n++;
  const d=L.decideFamily(r,rows,{R:5,K:3,variant:'lock-resolved-rail'});
  assert.equal(d.decision,'moteur');
  assert.equal(d.reason,'aucun-rail-abstenu');
 }
 assert.equal(n,27);
 // et donc lock-resolved-rail n'arbitre AUCUN cut que le moteur avait résolu
 for(const s of L.sweep(rows,5,[1,2,3,5,10],L.familyDecider('lock-resolved-rail')))
  assert.equal(s.arbitratedApplied,0,`K=${s.K}`);
});

test('la comparaison des deux variantes est livrée entière, gains ET pertes',()=>{
 const pj=L.sweep(rows,5,[1,2,3,5,10],L.familyDecider('pair-joint'));
 const lk=L.sweep(rows,5,[1,2,3,5,10],L.familyDecider('lock-resolved-rail'));
 // GAIN de lock : jamais moins de récupérations sous la convention d'évaluation,
 // et strictement moins de placements qui en ressortent.
 for(let i=0;i<5;i++){
  assert.equal(lk[i].recoveredAtOracleTolerance,pj[i].recoveredAtOracleTolerance,
    `K=${pj[i].K} : les récupérations sous tolérance doivent être identiques`);
  assert.ok(lk[i].arbitratedButOutsideTolerance<=pj[i].arbitratedButOutsideTolerance);
 }
 // PERTE de lock : les corrections matérielles disparaissent entièrement.
 for(const s of lk)assert.equal(s.corrected,0,`K=${s.K} : lock ne corrige rien, par construction`);
 for(const K of [1,2,3,5,10])
  assert.ok(L.sweep(rows,5,[K],L.familyDecider('pair-joint'))[0].corrected>0,
    `K=${K} : pair-joint doit conserver des corrections, sinon la perte n’est pas mesurable`);
});

test('les corrections matérielles : conservées par pair-joint, perdues par lock-resolved-rail',()=>{
 for(const cut of [5123,6576,9041]){
  const r=rows.find(x=>x.cut===cut);
  const d=L.decideFamily(r,rows,{R:5,K:3,variant:'pair-joint'});
  assert.equal(d.decision,'arbitrée',`cut ${cut} doit rester arbitré sous pair-joint`);
  const avant=L.appliedError(r),apres=L.measure(r,d.left,d.right);
  assert.ok(apres<avant,`cut ${cut} : ${apres} devrait être meilleur que ${avant}`);
  assert.ok(avant>L.TOLERANCE_ORACLE&&apres<=L.TOLERANCE_ORACLE,
    `cut ${cut} : le mauvais choix matériel doit repasser sous la convention d’évaluation`);
  /* Ces trois corrections passent TOUTES par le déplacement d'un rail déjà
   * résolu. lock-resolved-rail ne peut donc pas les produire : c'est la perte,
   * énoncée sans l'atténuer. */
  assert.ok(L.resolvedRailsMoved(r,d).length>0,`cut ${cut} : la correction déplace un rail résolu`);
  const l=L.decideFamily(r,rows,{R:5,K:3,variant:'lock-resolved-rail'});
  assert.equal(l.decision,'moteur');
  assert.equal(l.reason,'aucun-rail-abstenu');
 }
});

test('l’artefact figé est déterministe et son empreinte est recalculable',()=>{
 for(const variant of L.VARIANTS){
  const a=L.freeze(rows,{variant}),b=L.freeze(rows,{variant});
  assert.equal(a.sha256,b.sha256,`${variant} : deux gels doivent donner la même empreinte`);
  assert.equal(a.decisions.length,110);
  assert.deepEqual(Object.keys(a.decisions[0].byK),['1','2','3','5','10'],'aucun K n’est choisi');
  // recalcul indépendant, exactement comme le ferait un tiers
  const crypto=require('node:crypto');
  const canonique=JSON.stringify({format:a.format,policy:a.policy,variant:a.variant,source:a.source,
    parameters:a.parameters,reserved:a.reserved,decisions:a.decisions});
  assert.equal(crypto.createHash('sha256').update(canonique).digest('hex'),a.sha256);
  assert.deepEqual(a.sha256Covers,
    ['format','policy','variant','source','parameters','reserved','decisions']);
  // l'horodatage ne doit PAS entrer dans l'empreinte
  assert.ok(!a.sha256Covers.includes('frozenAt'));
  assert.equal(a.reserved.cuts.length,17);
 }
 // la variante entre dans l'empreinte : deux artefacts, deux SHA
 assert.notEqual(L.freeze(rows,{variant:'pair-joint'}).sha256,
                 L.freeze(rows,{variant:'lock-resolved-rail'}).sha256);
});

test('les deux artefacts figés livrés correspondent au banc, et l’ancien est supersédé',()=>{
 const fs=require('node:fs'),path=require('node:path');
 const dir=path.resolve(__dirname,'../audit');
 assert.ok(!fs.existsSync(path.join(dir,'pair-arbitration-policy-v1.json')),
   'l’artefact 33a654… du tour précédent doit avoir été retiré, pas laissé à côté des nouveaux');
 for(const variant of L.VARIANTS){
  const p=path.join(dir,`pair-arbitration-policy-${variant}-v1.json`);
  const lu=JSON.parse(fs.readFileSync(p));
  const calcule=L.freeze(rows,{variant});
  assert.equal(lu.variant,variant);
  assert.equal(lu.sha256,calcule.sha256,`${variant} : l’artefact livré ne correspond plus au banc`);
  assert.deepEqual(lu.decisions,calcule.decisions);
 }
});

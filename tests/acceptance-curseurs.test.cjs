'use strict';
/* CHANTIER 5 — §14 C : chaque valeur de curseur retenue est traçable jusqu'à son
 * bilan ; un curseur modifié sans bilan fait échouer la revue (cahier §8, C5).
 *
 * Ce que ces essais prouvent : la valeur dans le code est celle qu'écrit le
 * tableau de décision du bilan (`audit/curseurs-lot-2026-09-24.md`,
 * `audit/ecartement-voisin-2026-09-24.md`) et la décision datée (D-035, D-044,
 * D-047, D-050) ; tout réglage de `src/lot-decision.js` est inventorié ; le
 * rejeu « règles actuelles » est la décision du Pilote. Ce qu'ils ne prouvent
 * PAS : que les chiffres des bilans se reproduisent — il faut pour cela les
 * données relues (privées) et `tools/cursor-sweep.cjs`. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const L=require('../src/lot-decision.js'),Candidate=require('../src/geometry-candidate-v1.js'),O=require('../src/continuity-observer.js');
const A=require('../tools/acceptance-report.cjs');
const ROOT=path.join(__dirname,'..');
const plat=t=>t.replace(/\*\*/g,'').replace(/\s+/g,' ');
const lire=f=>plat(fs.readFileSync(path.join(ROOT,f),'utf8'));
function decision(id){const src=fs.readFileSync(path.join(ROOT,'DECISIONS.md'),'utf8'),i=src.indexOf(`## ${id} `);
  assert.ok(i>=0,`${id} absente de DECISIONS.md`);const j=src.indexOf('\n## D-',i+1);return plat(src.slice(i,j<0?undefined:j));}

const LOT='audit/curseurs-lot-2026-09-24.md',VOISIN='audit/ecartement-voisin-2026-09-24.md',PN='audit/passage-niveau-lecteur-2026-09-25.md';
/* Curseurs de la décision sur le lot : valeur, ligne du bilan, décision datée. */
const CURSEURS=[
  {cle:'guardMm',valeur:30,bilan:LOT,extrait:'| `guardMm` | 30 | Conservé.',decision:'D-047',mention:'`guardMm` 30'},
  {cle:'chooseMm',valeur:15,bilan:LOT,extrait:'| `chooseMm` | 15 | Conservé.',decision:'D-047',mention:'`chooseMm` 15'},
  {cle:'chainMm',valeur:15,bilan:LOT,extrait:'| `chainMm` | 15 (était 10) | Desserré en 4.7.15',decision:'D-047',mention:'`chainMm` 10 → 15 mm'},
  {cle:'gap',valeur:3,bilan:LOT,extrait:'| `gap` | 3 | Conservé.',decision:'D-047',mention:'`gap` 3'},
  {cle:'anchors',valeur:2,bilan:LOT,extrait:'| `anchors` | 2 | Conservé.',decision:'D-047',mention:'`anchors` 2'},
  {cle:'pairGuard',valeur:true,bilan:LOT,extrait:'| Garde de paire | active | Conservée (D-044)',decision:'D-044',mention:'Garde de paire active'},
  {cle:'minTop',valeur:5,bilan:LOT,extrait:'| `minTop` du choix | 5 (était 15) | Desserré en 4.7.16 (D-050)',decision:'D-050',mention:'`minTop` du choix : 5'},
  {cle:'minFace',valeur:3,bilan:LOT,extrait:'| `minFace` du choix | 3 | Conservé.',decision:'D-047',mention:'`minFace` 3'},
  {cle:'maxDzMm',valeur:20,bilan:LOT,extrait:'| `maxDzMm` du choix | 20 | Conservé.',decision:'D-047',mention:'`maxDzMm` 20'},
  {cle:'gaugeGuardMm',valeur:20,bilan:VOISIN,extrait:'Garde seule à 20 mm, activée en 4.7.16',decision:'D-050',mention:'Garde d\'écartement voisin, 20 mm'},
  /* Paramètres de la règle mesurée, jamais déplacés seuls : traçables, sans bilan de variation (rapport du chantier 5). */
  {cle:'gaugeCount',valeur:3,bilan:VOISIN,extrait:'comparé à la médiane de celui des 3 appuis les plus proches',decision:'D-050',mention:'médiane des 3 appuis les plus proches',sansVariation:true},
  {cle:'gaugeGap',valeur:10,bilan:VOISIN,extrait:'des 3 appuis les plus proches, à 10 cuts au plus',decision:null,sansVariation:true},
  /* 4.7.18 (KI-057) : règle d'appui, mesurée sur le même banc (`audit/appui-pose-2026-09-24.md`), D-052. */
  {cle:'anchorRule',valeur:'placed',bilan:'audit/appui-pose-2026-09-24.md',extrait:'Retenu : un appui est un cut posé',decision:'D-052',mention:'Un appui est un cut posé'},
  /* 4.7.19 (KI-058) : lecteur « passage à niveau » en dernier recours et voie encadrée, D-053.
   * Mesurés actifs contre coupés ; leurs seuils n'ont pas été déplacés seuls. */
  {cle:'crossing',valeur:true,bilan:PN,extrait:'| `crossing` | actif, en dernier recours |',decision:'D-053',mention:'`crossing` en dernier recours'},
  {cle:'crossingVoieMm',valeur:10,bilan:PN,extrait:'| `crossingVoieMm` | 10 |',decision:'D-053',mention:'`crossingVoieMm` 10',sansVariation:true},
  {cle:'framed',valeur:true,bilan:PN,extrait:'| `framed` | actif |',decision:'D-053',mention:'`framed` actif'},
  {cle:'frameGap',valeur:8,bilan:PN,extrait:'| `frameGap` | 8 |',decision:'D-053',mention:'`frameGap` 8',sansVariation:true},
  {cle:'frameAnchors',valeur:3,bilan:PN,extrait:'| `frameAnchors` | 3 |',decision:'D-053',mention:'`frameAnchors` 3',sansVariation:true}];
/* Réglages qui ne sont pas des curseurs : identifiant des règles consignées,
 * options de MESURE écartées du Pilote (D-050), éligibilité (D-039), journal. */
const HORS_CURSEURS={version:'lot-decision-v6',gaugeChoice:false,gaugeTargetStudy:false,maxCandidates:6,
  eligibleMotifs:['ambiguity','gauge-out-of-contract','flank','minTop','slope','window']};

test('§14 C : chaque curseur de la décision sur le lot a sa valeur, son bilan et sa décision datée',()=>{
  for(const c of CURSEURS){
    assert.equal(L.DEFAULTS[c.cle],c.valeur,`${c.cle} : ${L.DEFAULTS[c.cle]} dans le code, ${c.valeur} au bilan`);
    assert.ok(lire(c.bilan).includes(plat(c.extrait)),`${c.cle} : « ${c.extrait} » absent de ${c.bilan}`);
    if(c.decision)assert.ok(decision(c.decision).includes(plat(c.mention)),`${c.cle} : « ${c.mention} » absent de ${c.decision}`);}
  /* La décision consigne ses réglages : le rejeu d'un lot les relit (D-046, D-047, D-050). */
  const consignes=['version','pairGuard','chainMm','gaugeGuardMm','minTop','anchorRule','crossing','framed'];
  assert.deepEqual(consignes.filter(k=>!(k in L.DEFAULTS)),[]);
});

test('§14 C : aucun réglage de la décision sur le lot n\'échappe à l\'inventaire',()=>{
  const connus=new Set([...CURSEURS.map(c=>c.cle),...Object.keys(HORS_CURSEURS)]);
  assert.deepEqual(Object.keys(L.DEFAULTS).filter(k=>!connus.has(k)),[],'réglage nouveau : bilan et décision datée d\'abord');
  for(const [k,v] of Object.entries(HORS_CURSEURS))assert.deepEqual(Array.isArray(v)?[...L.DEFAULTS[k]]:L.DEFAULTS[k],v,k);
  assert.ok(decision('D-050').includes('Écartés : aide au choix par l\'écartement et « cible »'),'options de mesure écartées par D-050');
});

test('§14 C : curseurs du moteur (§8), valeurs du code et bilan D-035',()=>{
  const d035=decision('D-035'),cahier=lire('BANANE_4.8_CAHIER.md');
  assert.equal(Candidate.DEFAULTS.minTop,15);assert.ok(d035.includes('| `minTop` | 15 |'));assert.ok(cahier.includes('| `minTop` | 15 |'));
  assert.equal(Candidate.DEFAULTS.minFace,6);assert.ok(d035.includes('| `minFace` | 6, avec flanc partiel 3–5 points'));
  assert.equal(Candidate.DEFAULTS.minTemplateLossRatio,1.5);assert.ok(d035.includes('| Competitive set `loss/lmin` (ambiguïté) | 1,5 |'));
  assert.ok(d035.includes('| Garde d\'ambiguïté S1 | active |'));
  /* Seuil de confiance neutralisé en Pilote GCV1 (KI-033) : forcé à « tenter » à la création du lot. */
  assert.ok(d035.includes('| Seuil de confiance | neutralisé en Pilote GCV1 |'));
  assert.match(fs.readFileSync(path.join(ROOT,'background.js'),'utf8'),/startArgs\.lowConfidence='attempt';/);
  assert.equal(O.FRESHNESS_MS,1500);assert.ok(d035.includes('| Fenêtre de fraîcheur de la référence | 1 500 ms |'));
  assert.match(fs.readFileSync(path.join(ROOT,'tools/placement-lab.cjs'),'utf8'),/freshness>1500/);
});

test('§14 C : le rejeu « règles actuelles » est exactement la décision du Pilote',()=>{
  const {pairGuard,chainMm,gaugeGuardMm,minTop,anchorRule,crossing,framed}=L.DEFAULTS;
  assert.deepEqual(A.rulesFor(null,true),{pairGuard,chainMm,gaugeGuardMm,minTop,anchorRule,crossing,framed});
  assert.deepEqual(A.lotRules([],null,true),{pairGuard,chainMm,gaugeGuardMm,minTop,anchorRule,crossing,framed,source:'actuelles'});
});

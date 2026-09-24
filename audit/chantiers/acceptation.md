# Chantier 5 — tests d'acceptation §14 et invariants §7

**24 septembre 2026.** Matrice d'acceptation du cahier 4.8 (§7.1 à §7.10, §14 A
à I, règles conservées §5.4 et §5.5, règles de la décision sur le lot), essais
manquants, contrôle de la matrice au banc. Aucun code de production modifié.

Base : commit `155dbec` (code 4.7.16 TEST, branche `claude/banane-48-cahier`).
Branche de travail : `claude/banane-acceptance-matrix-psos53`, et non
`chantier-48/acceptation-4716` comme l'écrit la consigne du dépôt : la session
ne pousse que sur la branche qui lui est attribuée. Cette branche était sur
`5928be4` (4.7.0) ; elle a été avancée en *fast-forward* sur `155dbec` (aucun
historique réécrit, aucune poussée forcée).

Aucune donnée terrain n'a été utilisée : ce chantier ne mesure rien sur les
collectes ; il prouve ce que les essais couvrent. Aucun chiffre de couverture ou
de faux n'est donc produit ici.

## 1. Fait

- **`tests/ACCEPTANCE_MATRIX.md`** : 43 exigences, une ligne chacune — §7.1 à
  §7.10 ; §14 A (plus A.1 à A.11 : DEFERRED_UNRESOLVED, protocole durable,
  garde à deux étages, VALIDATE, SKIP explicite, reprise manuelle, G8.1,
  Observation, Assisté, Natif, Pilote normal) et §14 B à I ; §5.4 a à d et
  §5.5 ; LOT-1 à LOT-8 (KI-053, D-050 garde jamais cible, aucune option passée
  par le Pilote, règles consignées et relues par le rejeu, deux rails exigés et
  appuis, garde de paire, vue d'ESV, « Observer seulement »). Pour chacune : les
  essais (fichier › nom exact), le statut, et ce que l'essai prouve réellement —
  et ce qu'il ne prouve pas.
- **`tools/acceptance-matrix-check.cjs`** (CommonJS, sans dépendance, lecture
  seule). Échoue si une ligne désigne un fichier ou un essai inexistant, si une
  exigence manque ou est répétée, si un statut n'est pas COUVERT, PARTIEL ou
  MANQUANT, si une ligne COUVERT s'appuie sur un essai « todo » ou « skip » ou
  sur aucun essai, si une ligne MANQUANT cite un essai qui s'exécute, et si §14 B
  est plus couvert que le plus faible des §7. Tout chemin cité dans la matrice
  (bilan, outil, fixture) doit exister. Les noms d'essais sont lus dans le
  source, sans exécuter les essais : littéraux, gabarits `${…}` et
  concaténations `'a '+x+' b'` (reconnus par motif).
- **27 essais nouveaux, 11 fichiers** (dont un helper) :

| Fichier | Essais | Exigences |
|---|---|---|
| `tests/acceptance-matrix.test.cjs` | 4 | la matrice au banc ; le contrôleur lui-même (fautes détectées, todo/skip, §14 B dérivé, noms construits) |
| `tests/acceptance-non-regression.test.cjs` + `tests/fixtures/essais-4.7.0.json` | 1 | §14 A : les 547 essais de la 4.7.0 (liste figée, commit `efe6bab`) existent et s'exécutent |
| `tests/acceptance-curseurs.test.cjs` | 4 | §14 C : valeur du code = tableau de décision du bilan = décision datée ; inventaire complet des réglages ; curseurs du moteur (D-035) ; rejeu « actuelles » = Pilote |
| `tests/acceptance-decision-lot.test.cjs` | 5 | §7.1, LOT-2 (garde jamais cible, sur une grille de minima construite), LOT-5 (deux rails, choix jamais appui), LOT-1 (repli `expected-poses-failed`), LOT-4 (règles du lot transmises à la décision au rejeu) |
| `tests/acceptance-pilote.test.cjs` + `tests/helpers/pilote-lot.cjs` | 3 | LOT-3 (appel réel dans le service worker : aucune option), LOT-1 (erreur de commande rattrapée par `background.js` : `guard-error`), §14 E et §7.2 (le dernier garde du moteur refuse une paire hors contrat commandée par la décision) |
| `tests/acceptance-provenance.test.cjs` | 1 | §14 I : rejeu métamorphique — changer la seule relecture ne change aucune entrée de la décision |
| `tests/acceptance-provenance-pilote.test.cjs` | 2 (dont 1 todo) | §14 I dans le Pilote : reprise manuelle ; « Réessayer ce cut » (KI-055) |
| `tests/acceptance-contrat.test.cjs` | 2 | §14 D : sortie rejouable à l'identique ; abstention toujours motivée |
| `tests/acceptance-objectifs.test.cjs` | 2 (dont 1 todo) | §14 G : C1 jamais seul, P2 toujours là ; C5 (KI-056) |
| `tests/acceptance-commandes-dom.test.cjs` | 3 | §5.5 : boutons ESV désactivés (validation, navigation sans décision, sélection de rail) |

- Aucun fichier gelé, du moteur ou du panneau modifié (`git diff --stat 155dbec`
  ne touche que `tests/`, `tools/acceptance-matrix-check.cjs`, ce rapport et le
  relevé du banc `audit/verification.*`).

## 2. Vérifié (commandes exécutées, sorties)

**Banc de départ**, `node tools/verify.cjs` à `155dbec` :

```
{"tests":712,"suites":0,"pass":710,"fail":0,"cancelled":0,"skipped":2,"todo":0}
Bench mode: partial. Native corpus: absent (3 files). Skipped: 2 — skipped is not passed.
```

**Banc final**, même commande, à la tête de la branche :

```
{"tests":739,"suites":0,"pass":735,"fail":0,"cancelled":0,"skipped":2,"todo":2}
Syntax: 36 runtime files. Geometry unchanged: true. Engine matches V4.6.0 baseline: true.
Bench mode: partial. Native corpus: absent (3 files). Skipped: 2 — skipped is not passed.
```

Les 2 essais ignorés sont ceux du corpus Natif privé, absent du clone public
(`native-geometry-audit`, `package`) : c'est attendu, et un essai ignoré n'est
pas un essai réussi. Les 2 « todo » sont les défauts KI-055 et KI-056 (§4). Le
banc ne tourne qu'en mode partiel ici ; le mode complet (`--full`) exige le
corpus.

**Contrôle de la matrice**, `node tools/acceptance-matrix-check.cjs` :

```
Matrice : 43 exigences, 176 essais désignés — COUVERT 37, PARTIEL 6, MANQUANT 0.
Essais « todo » (défauts connus) : 2
Sans preuve complète : §14 C PARTIEL ; §14 G PARTIEL ; §14 H PARTIEL ; §14 I PARTIEL ; §5.4 a PARTIEL ; §5.4 d PARTIEL
Contrôle réussi.
```

Le contrôleur sait échouer : sur une copie de la matrice avec un nom tronqué, un
fichier inexistant, une exigence renommée (§7.9) et un statut « TERMINÉ »,
`node tools/acceptance-matrix-check.cjs --matrix COPIE` rend le code 1 et les
quatre erreurs, une par faute.

**Noms d'essais.** L'extracteur relève 709 déclarations au banc de départ ;
elles couvrent les 712 noms de la sortie TAP (un gabarit et une concaténation,
déclarés dans des boucles, donnent 5 essais) : 0 nom TAP non reconnu.

**§14 A — non-régression.** Liste relevée par `git archive efe6bab tests` puis
l'extracteur : 547 déclarations (545 exécutées, 2 ignorées faute du corpus).
Les 547 existent encore au même fichier, sous le même nom et dans le même mode.
Trois fichiers d'essais ont changé depuis la 4.7.0 (`git diff --numstat
5928be4 155dbec -- tests/`) ; différences relues, **aucune assertion affaiblie** :
`adapter.test.cjs` (constantes de lecture 4.7.2 ; l'interdiction de toute
commande dans la lecture Natif est intacte), `background.test.cjs` (harnais
déplacé dans `helpers/`, fin de session Natif rendue en résumé 4.7.3 — le
contrôle « aucune commande » est intact, un contrôle de taille s'ajoute),
`gcv1-shadow.test.cjs` (calage coupé dans un essai de tuyauterie, testé à part).

**Temps.** Aucun essai nouveau ne dépasse 1,7 s sous la charge du banc (10 s par
essai). Deux essais existants en sont proches : `lot-decision-navigateur`
(7,9 s) et `lot-decision-navigateur-defaut` (7,5 s), déjà à ces valeurs au banc
de départ.

**KI-055 reproduit** (§4) : l'essai « todo » échoue sur « la pose de
l'opérateur est entrée dans la capture analysée ». Au niveau du moteur seul :

```sh
node -e "
const {Engine}=require('./src/engine.js'),{MemoryStore,SimulatedESV,K}=require('./tests/fixtures.cjs');
(async()=>{const a=new SimulatedESV(),e=new Engine(a,new MemoryStore());await e.init();a.noPoints=true;e.s.mode='automatic-test';
 await e.startBatch({part:23,start:100,end:100,testConfirmed:true,lowConfidence:'attempt',allowNavigationEvidence:true});await e.task;
 const h=K.expectedPoses({rails:a.rails},{left:{delta:[0,.03,0]},right:{delta:[0,-.03,0]}});a.rails=h;a.noPoints=false;
 await e.retryPaused();await e.task;console.log(e.s.batch.state,'capture = pose opérateur :',K.equalPoses(e.s.before?.rails||(await e.store.getCloud(e.s.lidarId)).rails,h));})();"
```

Sortie : `PAUSED_UNRESOLVED_RAIL capture = pose opérateur : true`.

**Appui non placé** (question Q2), service worker réel, reprise depuis la voie
à 3 mm dont la commande se replie sur le moteur :

```sh
node -e "
const L=require('./src/lot-decision.js'),{base}=require('./tests/fixtures.cjs'),{pilote,SIDES}=require('./tests/helpers/pilote-lot.cjs');
(async()=>{const far=Object.fromEntries(SIDES.map(s=>[s,base.rails[s].positionSceneRelative.map((v,i)=>v+(i===0?.25:0))]));
 const r=await pilote({...L,decideCut:()=>({version:'lot-decision-v4',stage:'window',fromPredictionMm:3,anchorsUsed:[99],positions:far,anchor:true})},{start:100,end:100});
 const v=await r.b.settle();console.log(JSON.stringify(r.observed().map(o=>o.command)),JSON.stringify(v.batch.lotObservation.anchors.map(a=>a.identity.cut)));})();"
```

Sortie : `[{"action":"engine","reason":"gauge-HIGH_INVALID"}] [100]` — la
décision n'est pas commandée, le cut devient appui quand même.
`background.js` consigne l'appui dans `observeLot` (l. 150), appelé avant
`commandLot` (l. 89) et indépendamment de son issue ; le rejeu (`replayLot`)
fait de même.

**Harnais fidèle.** Les rails runtime de la façade GCV1 portent
`geometryEngine:'geometry-candidate-v1'` (`Shadow.toRuntimeRails`, vérifié) : le
harnais `helpers/pilote-lot.cjs` fait de même pour les rails du moteur de banc,
sans quoi le moteur refuse de différer (`RAIL_NOT_ATTRIBUTED_TO_GCV1`).

## 3. Supposé (non vérifié)

- Les essais du service worker sont des **tests simulés** (cahier §11) : ESV,
  Chrome et le stockage sont des doubles. Rien ici n'est une preuve terrain.
- KI-055 suppose un geste réel de l'opérateur : lot en politique « pause »,
  cut en pause pour rail non résolu, rails déplacés dans ESV, puis
  « Réessayer ». Sa fréquence sur le terrain n'est pas mesurée.
- Les chiffres des bilans de curseurs (C5) ne sont pas rejoués : il faut les
  données relues (privées) et `tools/cursor-sweep.cjs`. Les essais §14 C
  vérifient la cohérence code ↔ bilan ↔ décision, pas les chiffres.
- La recherche contrainte par la paire (A0) n'est pas en production ; §14 E est
  prouvé sur l'outil `tools/pair-search.cjs` et sur le chemin réellement en
  production (choix par la voie, dernier garde du moteur).

## 4. Défauts révélés — KI proposés (non corrigés ici)

| KI proposé | Gravité proposée | Problème | Essai « todo » |
|---|---|---|---|
| **KI-055** | Moyenne | **« Réessayer ce cut » après un déplacement manuel des rails : la pose de l'opérateur devient l'entrée du moteur et de la décision sur le lot.** `Engine.retryPaused()` archive la capture du cut puis en relit une nouvelle sans comparer les rails à la pose de départ, alors que `resume()` refuse ce cas (« Rails modifiés depuis la lecture interrompue »). Contredit §10 et §14 I (aucune correction humaine dans l'entrée moteur) ; au jugement, un tel cut serait comparé à une pose qui a servi d'entrée. Correctif à décider : refuser la reprise comme `resume()`, ou marquer la capture « pose humaine » et l'exclure des mesures. `src/engine.js` est épinglé : un correctif dans `background.js` (`dispatch('retry')`) ou une mise à jour déclarée de la baseline. | `tests/acceptance-provenance-pilote.test.cjs` › « §14 I : « Réessayer ce cut » après un déplacement manuel des rails ne doit pas analyser la pose de l'opérateur » |
| **KI-056** | Faible | **Le rapport d'acceptation ne rapporte pas C5.** §14 G exige C1 à C5 ensemble ; `tools/acceptance-report.cjs` écrit « C1 à C4 sont rapportés ensemble » et C5 (bilan des curseurs) ne vit que dans `audit/curseurs-lot-2026-09-24.md` et `audit/ecartement-voisin-2026-09-24.md`. Correctif possible : une ligne C5 qui cite les valeurs retenues, leur bilan et leur décision. | `tests/acceptance-objectifs.test.cjs` › « §14 G : C5, le bilan des curseurs, est rapporté avec C1 à C4 » |

## 5. Exigences qui restent sans preuve complète

| Exigence | Ce qui manque |
|---|---|
| §14 C curseurs | `gaugeCount` 3 et `gaugeGap` 10 : traçables à la règle mesurée (`audit/ecartement-voisin-2026-09-24.md`), jamais déplacés seuls — pas de bilan de variation ; `minTop` du moteur : bilan déclaré incomplet (D-035, n°11 §11.3) ; chiffres des bilans non rejouables au banc public. |
| §14 G objectifs | C5 absent du rapport d'acceptation (KI-056). |
| §14 H interface, §5.4 a et d | Côté panneau, sans essai : l'annonce de la décision sur le lot effective (« Décision sur le lot dans ce lot : appliquée / observée seulement », `panel.js`) ; le message de `PAUSED_AFTER_STATE_MISSING` (« … ne compte jamais une réussite qu'il n'a pas vue ») ; le libellé « Terminé avec actions non confirmées » ; le numéro de cut sur « Archiver le résultat interrompu · cut N » ; la note de `PAUSED_DEFER_NAVIGATION_UNCERTAIN` sans intention en vol. Le panneau étant modifié en parallèle (« La ligne »), ces essais sont laissés à l'équipe principale, sur le modèle de `tests/panel-ligne.test.cjs` (panneau réel en vm). |
| §14 I provenance | « Réessayer ce cut » (KI-055). |

Tout le reste est COUVERT au sens de la matrice : un essai exécuté au banc
prouve l'exigence telle qu'écrite, avec les limites dites dans la ligne (KI-030
pour §7.3, reprise depuis la voie non rejouée deux fois pour §14 D).

## 6. Questions pour la direction

1. **KI-055** : après un déplacement manuel des rails pendant une pause,
   « Réessayer » doit-il être refusé (comme « Reprendre ») ou repartir de la
   pose de l'opérateur, capture marquée et exclue des mesures ?
2. **Appui d'un cut non placé.** Le n°10 écrit « avec pour appuis les cuts déjà
   placés du même lot » ; le code (et le rejeu, à l'identique) retient comme
   appui toute décision « premier passage » ou « reprise à 15 mm » au moment de
   l'analyse, même si la commande est ensuite repliée (cible hors de la vue,
   erreur, dernier garde). Faut-il un appui « placé » (appliqué et validé) ou
   « résolu par la décision » ? Aucun faux mesuré ne l'implique à ce jour ; un
   changement modifierait les décisions suivantes et le rejeu des lots relus.
3. **`gaugeCount` et `gaugeGap`** : curseurs du §8 (bilan de variation à faire,
   C5) ou paramètres de la règle mesurée en bloc ?
4. **C5 dans le rapport** (KI-056) : une ligne C5 dans chaque rapport
   d'acceptation, ou le seul rapport de sortie de la 4.8 ?
5. **Écart de numérotation** : la consigne place les règles conservées au §5.5,
   le cahier au §5.4 ; la matrice suit le cahier (§5.4 a à d) et traite le §5.5
   (boutons DOM) à part.
6. **Temps du banc** : deux essais existants (`lot-decision-navigateur*`) sont à
   7,5–7,9 s sur 10 sous charge ; un banc plus chargé ou une machine plus lente
   les ferait échouer. Les découper avant la 4.8.0-rc ?

## 7. Mode d'emploi

```sh
node tools/acceptance-matrix-check.cjs            # contrôle, code 1 à la moindre faute
node tools/acceptance-matrix-check.cjs --json     # détail par ligne
node --test tests/acceptance-*.test.cjs           # essais du chantier
node tools/verify.cjs                             # banc complet (lance aussi le contrôle)
```

Ajouter une exigence : une ligne dans la matrice, son identifiant dans
`REQUIRED` de l'outil. Retirer une ligne fait échouer le banc. Un essai qui
révèle un défaut s'écrit `test(nom,{todo:'KI-… proposé'},…)` : il reste au banc,
visible, et ne compte jamais comme preuve.

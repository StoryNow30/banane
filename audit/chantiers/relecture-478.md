# Relecture indépendante — 4.7.12 : la décision sur le lot qui commande

**24 septembre 2026.** Relecteur indépendant : aucune ligne relue n'est de moi.
Je n'ai rien corrigé dans le code. Ma branche ajoute seulement des essais qui
démontrent des défauts, un outil de relevé en lecture seule et ce rapport.

- **Code relu** : `claude/banane-48-cahier`, commit `7a2144c` (4.7.12). La
  consigne initiale visait la 4.7.8 (`a74c225`). Le complément du 24/09 a
  réorienté la relecture vers la 4.7.12 ; ce qui reste de la relecture 4.7.8
  est au §6.
- **Branche poussée** : `claude/banane-relecture-478-vnvl2u`, avance rapide
  depuis `7a2144c`, sans réécriture. La consigne demandait
  `chantier-48/relecture-478` : la session n'autorise que la branche désignée.
  Une branche `chantier-48/relecture-478` existe déjà sur le dépôt (`6834266`) ;
  je ne l'ai pas lue, pour rester indépendant.
- **Données** : `banane-data`, branche `claude/banane-47-gate-audit-vaktr1`,
  commit `5f7904a`. Les archives sont extraites avec `7z x` dans un dossier
  local, noté `$D` ci-dessous (voir §7).
- **Ce que j'ai vu de l'équipe** : le dépôt au commit relu, dont `DECISIONS.md`
  et `KNOWN_ISSUES.md`. En récupérant la branche, j'ai aussi vu les titres des
  commits postérieurs à `a74c225`, dont celui qui annonce KI-048. Je n'ai
  consulté leur contenu qu'après avoir reproduit le défaut moi-même (§6).

Sauf mention contraire, les commandes se lancent depuis la racine du dépôt
`banane`.

## 1. Synthèse

| N° | Gravité | Constat |
|---|---|---|
| B1 | **BLOQUANT** | La garde de continuité est contournée : quand elle retire le premier passage et que la reprise depuis la voie ne peut pas être commandée (cible hors de la vue, caméra inconnue, relecture des positions ou écartement refusé, erreur), `commandRails` rend la paire du moteur **que la garde vient de retirer**, et le Pilote l'applique. |
| I1 | IMPORTANT | La garde de paire (D-044) ne fait pas « que différer » : elle retire un appui et change donc les décisions suivantes. Sur p34, 1835 et 1837 deviennent des **choix à un seul appui**, le régime de KI-050. Son efficacité hors de l'échantillon qui l'a inspirée n'est pas établie. |
| I2 | IMPORTANT | Le C4 publié repose surtout sur des cuts « acceptés sans retouche » (D-040), jugés sans erreur **par construction** : 56 des 79 cuts jugés sur p31 et p31b. Le compte de la décision sur le lot (`byLotCommand`) ne sépare pas validés et acceptés. |
| I3 | IMPORTANT | KI-052 n'est corrigé que sur le chemin documenté. Un « Reprendre » cliqué sur le cut archivé fait passer le lot en ERROR, état qu'aucune action ne relance ensuite, et la mémoire des appuis du lot est perdue. |
| I4 | IMPORTANT | Contrat : D-040 à D-044 changent le juge (D-040), lèvent la condition « 0 faux » (D-042) et ajoutent une garde (D-044). Aucun amendement du cahier ne les porte : le registre du §17 s'arrête au n°9. |
| M1 | MINEUR | Le rejeu « selon la version du lot » lit la version de l'extension **à l'export**. `lotObservation.version` vaut toujours `lot-decision-v1`, bien que la 4.7.12 ait changé les règles. |
| M2 | MINEUR | Les appuis sont mémorisés au moment de la décision, avant toute application : une reprise non commandée (hors vue) ou une application refusée reste un appui. |
| M3 | MINEUR | La garde de paire n'est pas appliquée au passage relancé (« window ») : 0 cas sur 57 reprises ou choix de 5 lots. |
| M4 | MINEUR | Plusieurs seuils n'ont pas de bilan au §8 ni dans `DECISIONS.md` : marge de vue 0,99, choix de caméra à 0,5 NDC, 24 minima, tolérance de position 1e-5, 40 appuis, 500 ms. |
| M5 | MINEUR | L'en-tête de `src/lot-decision.js` dit encore « Ce module ne commande rien ». Le banc Natif de `tools/choice-anchor-study.cjs` mémorise les appuis sans plafond, contrairement au Pilote. `commandLot` relit la capture sans mesurer ce temps. |
| M6 | MINEUR | Le banc complet est **rouge sur cette machine dès le commit relu** : `tests/background.test.cjs` (10,1 s) est annulé à 10 s. Les essais navigateur (9,7 et 8,9 s) sont à la limite, et tous deux ont été annulés quand une autre charge tournait. |

Ce qui tient, **vérifié** : parités rejeu/terrain (p33 lot 1 21/21, lot 2 83/83,
p34 96/96 ; p34 93/96 avec les règles 4.7.12, conforme à D-044) ; ordre de
chargement du service worker (KI-048 corrigé) ; écartement utilisé en
admissibilité seulement ; jamais un seul rail commandé ; un choix ne devient
jamais appui ; lot « observer seulement » inchangé ; temps de décision
acceptable (§4).

## 2. Constats

### B1 — BLOQUANT : la paire retirée par la garde de continuité est appliquée par repli

**Où.** `src/lot-decision.js:111` : un premier passage à plus de 30 mm de la voie
reçoit `guardDeferred` et part vers la reprise. `src/lot-decision.js:194-198`
ne diffère le cut que si la décision **finit** en `deferred`. Si elle finit en
`window` ou `choice`, tous les replis de `commandRails` rendent `runtimeRails`
(ligne 186) : `vue-inconnue` (215), `hors-vue` (217), `position-mismatch` (210),
`expected-poses-failed` (209) et `gauge-*` (212). `background.js:117` remet
alors la proposition du moteur telle quelle à `Engine.apply()`. De même, une
exception dans `observeLot` ou `commandLot` (`background.js:87-90`) laisse la
proposition du moteur : les gardes sont ouvertes en cas d'erreur.

**Pourquoi c'est bloquant.** La paire commandée est celle que le système vient
lui-même de déclarer incompatible avec la voie. Le déclencheur est exactement
celui de la partie 33 (KI-051, D-043) : pose ESV de départ à plus de 20 cm des
rails, plus un champignon parallèle près de cette pose (appareil de voie,
contre-rail). C'est le mode d'échec « décalage commun » du §16, que la garde
devait arrêter.

**Reproduction (vérifié).**

```
$ node --test tests/relecture-478-garde-hors-vue.test.cjs
ok 1 - préalables du scénario : moteur applicable sur une paire fausse, retirée par la garde, cible de la voie hors de la vue
not ok 2 - garde retirée, cible hors de la vue : la paire retirée du moteur ne doit pas être commandée # TODO constat B1 …
  error: 'action engine/hors-vue-left : paire du moteur commandée à 156.2 mm de la vraie position'
not ok 3 - garde retirée, caméra inconnue : même repli, même paire retirée # TODO constat B1 …
  error: 'action engine/vue-inconnue-left'

$ node --test tests/relecture-478-commande-garde.test.cjs      # de bout en bout : service worker + Engine.apply()
not ok 1 - garde de continuité puis cible hors de la vue : le Pilote ne doit pas appliquer la proposition retirée # TODO constat B1 …
  error: commande [{"action":"engine","reason":"hors-vue-left","ndc":[1.4,-0.294]}] ; appliqué : lidar-template-supported+lidar-template-supported
```

Balayage de la pose ESV sur la fixture du banc (appuis justes, vues de ±0,2 ;
script de travail non versionné, dont le cas à 210 mm est l'essai versionné
ci-dessus) : de 100 à 200 mm, la reprise est commandée, à 8,6 mm de la
position du moteur sur la fixture ; **de 210 à 240 mm, la paire du moteur, à
156 mm, est commandée**.

**Sur le terrain (vérifié) : 0 occurrence.** Sur les trois lots qui commandent
(4.7.10, p33 lots 1 et 2 ; 4.7.11, p34), la garde n'a retiré que 8101 et 8103,
tous deux différés sans reprise (`defer/guard`). Commande :
`node tools/lot-command-scan.cjs --lot "$D/…/pilote p33 lot 2" …` (sortie au §4).
Le chemin est donc atteignable mais pas encore observé.

**Effet sur la mesure.** Dans ce cas, `tools/acceptance-report.cjs` compte le
cut comme posé par le moteur (commande `engine`). Il juge en revanche la
décision sur le lot sur la position de la voie, qui est juste. La faute
n'apparaît donc ni dans `byLotCommand` ni dans `lotDecision.newWrong` ; elle
reste un faux « du moteur ».

**Correction suggérée (non faite) :** quand `decision.guardDeferred` ou
`pairGuarded` est vrai, tout repli de `commandRails` diffère le cut, comme aux
lignes 194-198. Dans `background.js`, une erreur de `commandLot` sur une
décision retirée par une garde diffère le cut au lieu de rendre la proposition
du moteur. Pour une erreur de `observeLot`, on ne sait pas si une garde aurait
retiré le cut : choisir entre différer (sûr) et la 4.7.9 (couverture) revient à
la direction. Les essais ci-dessus passeront alors ; il suffira de retirer
`todo`.

### I1 — IMPORTANT : la garde de paire change les décisions suivantes

D-044 affirme : « La garde ne fait que différer : son seul risque est une perte
de couverture ». C'est vrai du cut gardé, pas du lot. Le cut gardé ne devient
pas appui, donc la prédiction des cuts suivants change.

```
$ node tools/lot-command-scan.cjs --ricochet --lot "$D/2026-09-24_v4.7.11_/pilote p34=p34"
   garde de paire : 1834 first-pass → deferred (pair-guard), appuis [1832,1831]
   garde de paire : 1835 deferred → choice, appuis [1832]
   garde de paire : 1837 window → choice, appuis [1836]
```

1835 (différé en 4.7.11) et 1837 (reprise en 4.7.11) deviennent des **choix à un
seul appui**. C'est le régime de KI-050 : 1 faux sur 19 jugés, contre 0 sur 23
à deux appuis (chiffres de l'équipe, non refaits). La garde crée donc de nouveaux placements, dans la catégorie la
moins sûre. La parité 93/96 de D-044 le montrait déjà ; la conclusion « seul
risque = couverture » n'en a pas tenu compte.

Échantillon (vérifié par lecture de `audit/garde-paire-verification-2026-09-24.md`
et par rejeu, voir §4) : la règle a été formée sur 241 et 409, puis mesurée sur
les mêmes données. Sur les quatre jeux qu'elle n'avait pas vus, elle ne se
déclenche jamais, et son premier déclenchement réel (1834) n'est pas encore
jugé. Son efficacité hors échantillon n'est donc pas établie. Seule son absence
de coût est établie, et seulement sur le cut gardé.

### I2 — IMPORTANT : le C4 repose surtout sur des acceptations

D-040 fait d'une visite sans retouche ni validation une acceptation, jugée
**sans erreur par construction** (`tools/acceptance-report.cjs:224-236`). Dans
les rapports publiés :

```
$ node -e "for(const f of ['acceptance-p31-2026-09-24','acceptance-p31b-2026-09-24']){const t=require('./audit/'+f+'.json').total;console.log(f,t.c4.wrong+'/'+t.c4.judgedApplied,JSON.stringify(t.c4.judgedByBasis))}"
acceptance-p31-2026-09-24 0/34 {"validé":9,"accepté-sans-retouche":25}
acceptance-p31b-2026-09-24 0/45 {"validé":14,"accepté-sans-retouche":31}
```

Sur les cuts que la décision sur le lot commande (4.7.10 et après), une
acceptation rend son erreur nulle d'office. Seule une retouche peut la
contredire. `c4.byLotCommand` (`tools/acceptance-report.cjs:375`) ne sépare pas
validés et acceptés. C'est une décision de la direction, pas un défaut de code.
Mais le « 0 faux » d'un lot relu surtout par acceptation est une preuve
nettement plus faible qu'un « 0 faux » sur cuts validés. Le protocole F1
(`LIRE_EN_PREMIER.md`) demande d'ailleurs de valider chaque cut.

### I3 — IMPORTANT : KI-052, reprise sur le cut archivé

Correctif de la 4.7.12 (`background.js:238`) : sans proposition, « Reprendre »
remet l'étape à `capture`. Si l'opérateur reprend **avant** de quitter le cut
archivé, la reprise relit ce cut. `Engine.apply()` refuse alors d'écrire (cible
bloquée) et le lot passe en ERROR. Ensuite :

```
$ node --test tests/relecture-478-reprise-archivage.test.cjs
not ok 1 - « Reprendre » sur le cut archivé, puis cut suivant : le lot doit rester reprenable # TODO constat I3 …
  error: après la reprise sur le cut archivé (ERROR : Ce cut a un résultat incertain archivé : aucune nouvelle écriture automatique dans cette page.) : close-uncertain : accepté ; resume : Aucun lot à reprendre. ; stop : accepté ; resume : Cible différente : cut
```

Une fois sur le cut suivant, ni « Reprendre », ni « Arrêter » puis
« Reprendre » ne relance le lot. Aucune commande n'est envoyée,
ce qui est l'essentiel. Mais il faut un nouveau lot, et **la mémoire des appuis
est perdue** : le cut suivant repart sans appui, donc sans garde de continuité.
Les faux isolés 398 et 402 étaient justement des premiers passages sans appui.

Deux remarques sur le correctif lui-même :

- il modifie `engine.s.batch.step` hors du moteur, sans événement ;
- il le fait avant les contrôles de `Engine.resume()` : si la reprise est
  refusée, l'état en mémoire diffère de l'état persisté.

### I4 — IMPORTANT : décisions prises hors amendement

Le §17 du cahier (le contrat) dit : « Tout ajout ou modification prend la forme
d'un amendement numéroté et daté […]. Un sujet qui n'est ni dans le corps ni
dans un amendement est hors périmètre. » Le registre s'arrête au n°9
(`grep -n '^## Amendement' BANANE_4.8_CAHIER.md`). Or depuis :

- D-040 change la référence du critère C4 ;
- D-041 et D-042 font commander la décision sur le lot, et D-042 lève la
  condition « 0 faux » posée par D-041 ;
- D-043 borne la couverture par la vue d'ESV ;
- D-044 ajoute une garde.

Le n°9 §9.3 prévoyait l'activation « en 4.7.9 seulement après la décision D2,
sur mesure terrain » ; `PLAN_4.8.md` aussi. Ce sont des décisions légitimes de
la direction, mais elles ne sont pas dans le contrat.

### M1 à M6 — MINEUR

- **M1, version des règles rejouées.** `background.js:215,218` passe `VERSION`
  (l'extension courante) à `buildDiagnostic`. `rulesFor`
  (`tools/acceptance-report.cjs:283`) lit cette version. Un lot fait en 4.7.11
  puis exporté après une mise à jour serait rejoué avec les règles 4.7.12 ;
  la parité tomberait à 93/96 (p34, vérifié). C'est visible, mais
  `--decision-par-rejeu` attribuerait alors des décisions 4.7.12 à un lot
  4.7.11. Un lot repris à travers une mise à jour mélange aussi deux règles.
  `lotObservation.version` (`src/lot-decision.js:25`) n'a pas changé avec la
  garde de paire. Suggestion : dater les règles dans la décision elle-même.
- **M2, appuis avant application.** `background.js:134` mémorise l'appui dès la
  décision. Une reprise `window` à moins de 10 mm devient appui même si
  `commandRails` se replie (hors vue) ou si `Engine.apply()` échoue ; de même
  pour un premier passage refusé à l'étage B ou archivé. Terrain : 0 cas
  (aucune commande `engine/window` sur les 5 lots).
- **M3, garde de paire limitée au premier passage.** `src/lot-decision.js:107` ;
  le passage relancé (`again`, ligne 116) n'est pas contrôlé. Mesure : 0 reprise
  ou choix signalé sur 57, 5 lots (`--ricochet`, §4).
- **M4, seuils sans bilan** (§8, C5) : `VIEW_MARGIN` 0,99
  (`src/lot-decision.js:172`), caméra à 0,5 NDC (178), 24 minima (71),
  `MATCH_SCENE` 1e-5 (184), `lot.maxAnchors` 40, `ACCEPT_MIN_MS` 500
  (`tools/acceptance-report.cjs:61`), `MIN_JUDGED_SHARE` 0,8. Ce sont surtout
  des tolérances techniques ; le cahier demande pourtant un bilan pour chaque
  curseur touché.
- **M5, cohérence.**
  - L'en-tête de `src/lot-decision.js:23-24` (« Ce module ne commande rien :
    en 4.7.8… ») contredit le commentaire de `commandRails`.
  - `tools/choice-anchor-study.cjs:60` ajoute les appuis par `push`, sans
    `rememberAnchor` ni plafond de 40 : le banc Natif n'est pas strictement le
    Pilote. L'effet est probablement nul, car les appuis sont à 3 numéros au
    plus.
  - `commandLot` relit la capture dans IndexedDB (`background.js:113`) hors de
    `engineMs`.
- **M6, banc à la limite de temps.** Voir la sortie du banc au §4.
  `tests/lot-decision-navigateur.test.cjs` prend 9,7 s et
  `tests/lot-decision-navigateur-defaut.test.cjs` 8,9 s, seuls (commande :
  `time node --test --test-timeout=10000 <fichier>`). Pendant la simulation de
  la partie 20, les deux ont été annulés.

## 3. Questions du chantier, relues sur la 4.7.12

1. **Le module peut-il commander hors de ce qui est voulu ?** Dans un lot
   « observer seulement », non : `commandLot` n'est appelé que si
   `scope.lotDecision==='apply'` (`background.js:89`). L'essai de l'équipe
   `a GCV1 pilot batch created with lotDecision apply commands…; observe changes
   nothing` passe. Dans un lot « appliquer », la commande respecte les
   invariants : deux rails, écartement relu puis revérifié par l'étage B,
   identité et état contrôlés par `Engine.apply()`, aucun SKIP. **Sauf B1** :
   le repli rend une proposition qu'une garde a refusée.
2. **Parité** : vérifiée, p33 21/21 et 83/83, p34 96/96 (§4).
3. **Jugement** : `referenceFor` pour les cuts validés, référence lue après
   coup, aucune position humaine en entrée, ordre par horodatage ; aucune
   fuite trouvée. Réserve I2 (acceptations).
4. **Règles du cahier** : l'écartement n'est qu'un critère d'admissibilité
   (`src/lot-decision.js:137-138`, `211-212` ; aucune cible 1435, vérifié par
   `grep`) ; jamais un seul rail ; un choix ne devient jamais appui (ligne 140) ;
   chaînage à 10 mm (ligne 122). Seuils : M4.
5. **KI-047** : le risque réel est désormais doublé par B1. Garde manquante :
   différer tout repli après retrait. KI-050 et I1 : les choix à un appui se
   multiplient quand une garde retire un appui.
6. **Temps (KI-046)** : acceptable (§4).
7. **Conditions de D2 et D3** : §5.

## 4. Vérifié — commandes et sorties

**Chargement du service worker** (fichiers de `background.js` exécutés dans
l'ordre d'`importScripts`, sans `module`) :

```
$ time node --test --test-timeout=10000 tests/lot-decision-navigateur.test.cjs          # pass 1, real 9,729 s
$ time node --test --test-timeout=10000 tests/lot-decision-navigateur-defaut.test.cjs   # pass 1, real 8,936 s
```

Mon propre script sur `a74c225` (4.7.8), avant de lire KI-048 : grille vide
sous l'ordre du service worker (§6). Sur `7a2144c`, l'ordre est corrigé et
l'essai de l'équipe le vérifie.

**Parités et garde de paire sur les lots terrain :**

```
$ node --max-old-space-size=10000 tools/acceptance-report.cjs --lot "$D/2026-09-24_v4.7.11_/pilote p34=p34" --rejeu-lot --json p34.json
total : C1 73/96 = 76 % · C4 0 faux / 0 jugés (non évaluable) … · lot 73/96, 0 faux / 0 · exclus 0 · lot incomplet
  → version 4.7.11, règles {"pairGuard":false}, parité {"compared":96,"identical":96}
  … --regles-actuelles → règles {"pairGuard":true}, parité {"compared":96,"identical":93}
$ … --lot "$D/2026-09-24_v4.7.10_/pilote p33 lot 2=p33b" --rejeu-lot [--regles-actuelles]   → 83/83 (les deux)
$ … --lot "$D/2026-09-24_v4.7.10_/pilote p33=p33a"        --rejeu-lot [--regles-actuelles]   → 21/21 (les deux)
```

**Relevé des lots** (`tools/lot-command-scan.cjs`, ce commit) :

```
$ node --max-old-space-size=8000 tools/lot-command-scan.cjs --ricochet \
    --lot "$D/2026-09-24_v4.7.8_/pilote p31=p31 (4.7.8)" --lot "$D/2026-09-24_v4.7.9_/pilote p31 fin=p31 fin (4.7.9)" \
    --lot "$D/2026-09-24_v4.7.10_/pilote p33=p33 lot 1 (4.7.10)" --lot "$D/2026-09-24_v4.7.10_/pilote p33 lot 2=p33 lot 2 (4.7.10)" \
    --lot "$D/2026-09-24_v4.7.11_/pilote p34=p34 (4.7.11)"
p31 (4.7.8) : 50/50 observations avec décision · étapes {"first-pass":35,"deferred":13,"window":2} · commandes {"aucune":50}
   décision : moteur relancé n=8, médiane 426 ms, p90 498, max 498 · sans relance n=42, max 1 ms · cut traité : médiane 6414 ms, p90 7522 (n=35)
   reprises et choix dont le passage relancé serait signalé : aucun
p31 fin (4.7.9) : 78/78 … étapes {"deferred":6,"first-pass":48,"choice":10,"window":14} · commandes {"aucune":78}
   décision : moteur relancé n=24, médiane 635 ms, p90 1225, max 1414 · … cut traité : médiane 7290 ms, p90 9047 (n=47)
p33 lot 1 (4.7.10) : 21/21 … commandes {"engine/first-pass":18,"lot/window":3}
   décision : moteur relancé n=3, médiane 453 ms, p90 496, max 496 · … cut traité : médiane 5577 ms, p90 6752 (n=20)
p33 lot 2 (4.7.10) : 83/83 … commandes {"engine/deferred":16,"engine/first-pass":59,"defer/guard":2,"lot/window":3,"lot/choice":3}
   8101 : deferred (garde 69.7 mm) → commande defer/guard ; Pilote : DEFERRED_UNRESOLVED
   8103 : deferred (garde 133.3 mm) → commande defer/guard ; Pilote : DEFERRED_UNRESOLVED
   décision : moteur relancé n=10, médiane 370 ms, p90 1014, max 1014 · … cut traité : médiane 7349 ms, p90 8320 (n=65)
p34 (4.7.11) : 96/96 … commandes {"engine/first-pass":58,"engine/deferred":23,"lot/window":3,"lot/choice":12}
   décision : moteur relancé n=17, médiane 223 ms, p90 278, max 280 · … cut traité : médiane 6455 ms, p90 7765 (n=73)
   garde de paire : 1834 first-pass → deferred (pair-guard), appuis [1832,1831]
   garde de paire : 1835 deferred → choice, appuis [1832]
   garde de paire : 1837 window → choice, appuis [1836]
(pour chaque lot) reprises et choix dont le passage relancé serait signalé : aucun
```

Lecture : le moteur n'est relancé que pour les cuts repris. La décision prend
alors 223 à 635 ms en médiane (max 1 414 ms), pour un cut traité en 5,6 à 7,3 s
en médiane : 3 à 10 % du cycle quand elle a lieu, rien sinon. KI-046 : aucun
effet à craindre à ce niveau. Ce qui n'est pas mesuré : la seconde lecture de la
capture par `commandLot`.

**Garde de paire sur la partie 20 longue** (`tools/choice-anchor-study.cjs`,
banc Natif, un passage) :

```
$ node --max-old-space-size=12000 tools/choice-anchor-study.cjs garde.json --natif "$D/p20long=p20long"                     # 9 min 41 s
  actuelle   165 appliqués · 3 faux / 106 jugés   (faux : 398 159,9 mm, 402 273 mm, 983 15 mm)
$ node --max-old-space-size=12000 tools/choice-anchor-study.cjs sans.json --sans-garde-paire --natif "$D/p20long=p20long"   # 9 min 33 s
  actuelle   166 appliqués · 5 faux / 107 jugés   (faux : 398, 402, 409 140,5 mm, 241 40,5 mm, 983)
Cuts qui changent (comparaison des lignes des deux relevés) :
  241  first-pass, 2 appuis, FAUX 40,5  → différé
  409  first-pass, 0 appui,  FAUX 140,5 → différé
  243  —                               → window, 1 appui, juste 3 mm
  245  first-pass, 1 appui             → first-pass, 2 appuis (non jugé)
```

`$D/p20long` : les segments 07-05 à 07-23 de `2026-09-23_v4.7.6_/session nativ/`.
Conforme à `audit/garde-paire-verification-2026-09-24.md`. Le cut gagné, 243,
l'est lui aussi par une reprise à **un seul** appui (I1).

**Essais du périmètre et banc complet :**

```
$ node tools/verify.cjs                 # ma branche
Bench mode: partial (native corpus absent: 2 tests skipped, not passed)
# tests 691  # pass 684  # fail 0  # cancelled 1  # skipped 2  # todo 4
not ok 4 - tests/background.test.cjs    error: 'test timed out after 10000ms'
Error: Failed: --test …                  (sortie 1)

$ git worktree add --detach wt 7a2144c && cd wt && node tools/verify.cjs     # commit relu, sans mes fichiers
# tests 685  # pass 682  # fail 0  # cancelled 1  # skipped 2  # todo 0
not ok 4 - tests/background.test.cjs    (sortie 1)

$ node --test --test-timeout=10000 tests/background.test.cjs     # seul, deux fois
# pass 26  # fail 0  # cancelled 1   real 0m10.108s / 0m10.113s
```

- **Ignorés** : les 2 tests du corpus Natif privé (`datasets/native/`
  absent) ; c'est normal.
- **TODO** : les 4 démonstrations B1 et I3.
- **Annulé** : `tests/background.test.cjs`. Ce fichier de 27 essais dépasse la
  limite de 10 s sur cette machine, **dès le commit relu**. Le relevé versé par
  l'équipe (`audit/verification.txt` de `7a2144c`) donne 686 / 684 / 0 annulé :
  le fichier est à la limite, et le résultat dépend de la machine.
- **Tout le reste passe**, dont les essais navigateur (KI-048), `lot-command`,
  l'acceptation et la garde de paire.

Je n'ai pas versé le relevé régénéré (`audit/verification.*` remis dans leur
état versé). Correction suggérée, dans le style demandé par la consigne :
découper `tests/background.test.cjs`, par exemple en sortant les deux essais de
lot 4.7.8 et 4.7.10 dans leur propre fichier.

## 5. Conditions de D2 (déjà prise) et de D3

D2 a été prise par D-041 et D-042 : la décision commande depuis la 4.7.10. Les
conditions ci-dessous sont donc celles qui l'auraient fondée ; elles restent
celles de D3.

**Avant tout nouveau lot F sur une partie où ESV part loin des rails :**
corriger B1 et retirer `todo` des deux essais B1.

**Mesures sur F1 (lots Pilote relus en Natif), par partie et par lot complet :**

| Mesure | Seuil | Pourquoi |
|---|---|---|
| C1 sur cuts distincts (D-038), lot complet | ≥ 80 % | objectif intermédiaire ; un lot arrêté ne compte pas |
| C4 sur cuts **validés**, rapporté à part des acceptations | 0 faux, avec au moins 30 cuts validés appliqués par partie | I2 : une acceptation est nulle par construction |
| C4 des cuts commandés par la décision (`byLotCommand`), par étape (`window`, `choice`) **et par nombre d'appuis** | 0 faux sur au moins 20 choix jugés à 2 appuis ; choix à 1 appui rapportés à part | KI-050, I1 |
| Faux « du moteur » que la voie contredisait (`guardDeferred` puis commande `engine`) | 0, et 0 occurrence du chemin B1 | B1 |
| Faux de la décision que le Pilote 4.7.9 n'aurait pas faits (`lotDecision.newWrong`) | 0 | règle d'arrêt de LIRE_EN_PREMIER |
| Déclenchements de la garde de paire, jugés | chacun jugé ; aucun juste perdu ; cuts voisins dont la décision change rapportés | I1 |
| Parité rejeu/terrain avec les règles de la version du lot | 100 % | M1 |
| C2 (médiane et p90, latéral et vertical) sur cuts validés | non dégradés face à la 4.7.6, P2 à côté | §6 C2 |
| C3 : paires appliquées hors contrat | 0 | invariant |
| Temps de décision (`engineMs`, moteur relancé) | p90 ≤ 1,5 s ; cycle par cut non allongé de plus de 10 % | KI-046 |
| Partie tenue à l'écart de tout réglage | au moins une | généralisation (D-037) |

**Mesures sur F2 (P2, un seul opérateur) :** au moins 30 cuts replacés en
aveugle, rails éloignés de 5 cm au moins avant la pose, quelques jours après la
première pose. Rapporter médiane et p90, latéral et vertical, ainsi que la part
des écarts au-delà de 10 mm. **Condition :** si cette part n'est pas nulle, le
seuil « faux > 10 mm » mesure en partie le bruit de l'opérateur, et C4 doit être
relu à la lumière de P2. ESV n'ouvre pas une même partie dans deux projets : P2
ne peut porter que sur **un** opérateur ; il doit être déclaré comme plancher
d'un opérateur, et non comme plancher humain général.

## 6. Relecture de la 4.7.8, avant le complément

- **KI-048, trouvé indépendamment.** Script de travail (même méthode que
  `tests/helpers/navigateur.cjs`) sur `a74c225` :
  `left grille Node : 2916 | grille service worker : 0 | candidats Node 4 | SW 0`.
  Dans le service worker 4.7.8, le choix par la voie ne pouvait jamais aboutir.
  La parité « 312/312 » de la 4.7.8 comparait le module sous Node à l'étude,
  pas l'extension à l'étude. Corrigé en 4.7.9 (KI-048).
- **Non refait, faute de temps après le complément** : les chiffres du §9.2 de
  l'amendement n°9 (45,2 % → 56,0 %, 7 → 4 faux, 48 choix dont 30 jugés) et la
  parité 312/312 et 176/176. Ils restent **supposés** de mon point de vue.

## 7. Supposé, limites, écarts à la consigne

- **Supposé** : que le chemin B1 se produira sur une partie comme la 33 avec
  un appareil de voie. Il est démontré sur fixture et possible sur le terrain,
  mais pas encore observé.
- **Non mesuré** : la seconde lecture de la capture dans `commandLot` ; les
  relectures des lots p33 et p34 (pas encore livrées) ; 1834.
- **Consigne et cahier.** La consigne dit « aucun VALIDATE automatique ». Le
  Pilote valide pourtant automatiquement après application, par conception
  (§7, invariant 9 ; D-041). Je l'ai lue comme « aucun VALIDATE ni SKIP
  automatique hors du cycle existant du Pilote » ; le cahier l'emporte.
- **Question « appuis validés »** (D-041, chantier ultérieur). Lire dans ESV les
  poses validées des cuts voisins pour en faire des appuis mettrait des
  positions **humaines** dans l'entrée du moteur, ce que la consigne interdit
  (« la référence humaine ne sert qu'à juger »). Cela demande un amendement
  explicite, et un jugement qui n'utilise pas ces mêmes cuts.
- **Données** : pour reproduire, avec `D` pour dossier d'extraction :
  `git -C banane-data fetch origin claude/banane-47-gate-audit-vaktr1`, puis,
  pour chaque archive de `collections/2026-09-24_*`,
  `7z x -o"$D/<collecte>/<dossier>" "<archive>.7z"`. Pour la partie 20 longue,
  extraire les archives 07-05 à 07-23 de
  `collections/2026-09-23_v4.7.6_/session nativ/` dans `$D/p20long` : une
  archive par commande, car `7z x a.7z b.7z` prend `b.7z` pour un filtre. Mettre
  les chemins entre guillemets : les noms contiennent des espaces.

## 8. Questions pour la direction

1. B1 : acceptez-vous que tout repli après un retrait par une garde diffère le
   cut ? Ce n'est pas la forme 4.7.9, mais c'est la seule qui tient la garde.
2. D-044 : maintenez-vous la garde de paire, sachant qu'elle produit des choix
   à un seul appui chez ses voisins ? Faut-il, au minimum, qu'un cut gardé
   empêche aussi les choix à un appui dans sa zone ?
3. D-040 : C4 doit-il être engagé sur les cuts validés seulement, les
   acceptations restant un contrôle ?
4. I4 : faut-il un amendement n°10 qui porte D-040 à D-044 ?
5. Appuis validés : êtes-vous prêts à lever par amendement la règle « aucune
   position humaine en entrée », ou ce chantier doit-il être abandonné ?

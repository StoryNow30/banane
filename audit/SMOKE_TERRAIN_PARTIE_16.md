# Smoke terrain — partie 16, cuts 9451 → 9493

Date du smoke : **22 septembre 2026**, Edge réel, ESV réel, opérateur humain.
Checkpoint fonctionnel exercé : `5e6d0e8b14ea880195672e5b9da914f046701e0c`.

Ce document **capitalise** un smoke déjà exécuté. Il n'ajoute aucun code, ne
modifie aucune donnée source, ne rejoue rien hors ligne et ne produit aucun
oracle nouveau. Les faits consignés ici sont ceux observés pendant la session ;
les chiffres non consignés ne sont pas inventés.

Le compagnon structuré est `audit/smoke-terrain-partie-16.json`
(`format: banane-smoke-terrain-v1`). Les exports Natif et Pilote de la session
restent **privés et hors dépôt** : seuls les faits de décision sont versionnés,
pas les nuages ni les poses.

## 1. Portée et résultat brut

| Élément | Valeur |
|---|---|
| Partie | 16 |
| Portée du lot | cuts **9451 → 9493** |
| Moteur géométrique | `geometry-candidate-v1` (lot Pilote GCV1) |
| Cuts **non validés** rencontrés | **13** |
| Placements appliqués puis validés | **7** |
| Cuts différés | **6** |
| SKIP automatiques | **0** |

7 + 6 = 13 : chaque cut non validé rencontré est soit appliqué, soit différé.
Aucun cut n'est sorti par une troisième voie.

## 2. Gauge Safety Gate — trois déclenchements réels

Le garde d'écartement (D-027) a refusé la commande sur trois cuts. La grandeur
est l'écartement **prévu** après application des deltas, seule valeur connue
avant la commande — jamais l'état trouvé avant, qui est précisément ce que
Banane corrige.

| Cut | Écartement prévu | Classe | Marge sous la borne 1 405 mm |
|---:|---:|---|---:|
| **9452** | ≈ 1 333,5 mm | `LOW_INVALID` | ≈ 71,5 mm |
| **9453** | ≈ 1 368,3 mm | `LOW_INVALID` | ≈ 36,7 mm |
| **9488** | ≈ 1 328,8 mm | `LOW_INVALID` | ≈ 76,2 mm |

Pour **chacun** des trois, l'issue observée est identique et complète :

- **0** `apply`
- **0** `VALIDATE`
- **0** `SKIP`
- état `DEFERRED_UNRESOLVED`
- **navigation sans décision** : le cut est quitté sans correction appliquée,
  sans validation, sans saut, et reste enregistré pour revue humaine.

C'est exactement le contrat écrit en D-027 : un hors-contrat est une
**abstention**, jamais un SKIP. Le smoke le confirme sur du terrain réel, et
non plus seulement au banc.

**Robustesse de la classification sur ces trois cuts.** `KI-032` mesure l'écart
entre écartement prévu et écartement observé après application à
`max |prévu − observé| = 0,5253 mm` (lot du 21 septembre, 56 paires). Les trois
marges ci-dessus valent 36,7 à 76,2 mm, soit **deux ordres de grandeur
au-dessus** de cet écart. Aucun des trois classements ne peut basculer à cause
de cette incertitude. Cela ne vaut **que pour ces trois cuts** : une paire
prévue à moins d'un millimètre d'une borne resterait exposée, et `KI-032`
reste ouvert.

## 3. Trois autres différés — abstention scientifique, pas le garde

| Cut | Cause du report |
|---:|---|
| **9472** | ambiguïté / abstention scientifique |
| **9473** | ambiguïté / abstention scientifique |
| **9487** | ambiguïté / abstention scientifique |

Ces trois-là **ne sont pas** des refus d'écartement. Ils relèvent du chemin
`unresolved` ouvert par l'abstention GCV1 (voir `KI-031`), où rien dans la
capture ne départage deux placements soutenus. Les compter avec les trois cuts
du garde produirait un taux de refus du garde faux du simple au double : la
séparation des deux causes est le point central de cette section.

Bilan des causes de report : **3 garde d'écartement + 3 ambiguïté = 6 différés**.

## 4. Les sept placements appliqués

Les 7 placements réellement appliqués puis validés n'ont demandé que de
**petites corrections humaines**, d'amplitude **maximale ≈ 7,6 mm**.

Ce 7,6 mm est un **majorant observé sur 7 placements**, pas une distribution :
ni moyenne, ni écart-type, ni médiane ne sont consignés ici, parce qu'ils n'ont
pas été relevés pendant le smoke. Ne pas les reconstruire après coup.

Pour référence d'échelle, et **sans joindre les deux ensembles** : sur la
partie 15, le corpus de corrections montre des gestes 4,5 fois plus grands
qu'en travail normal (`panel.html`, avertissement du cerveau), et la session
Natif du 21 septembre place l'écartement après correction humaine dans
[1 429,6 ; 1 445,0] mm. Les 7 corrections de la partie 16 sont du même ordre que
le « travail normal », pas du geste de reprise.

## 5. Ce que ce smoke prouve

1. Le Gauge Safety Gate **se déclenche en conditions réelles**, sur trois cuts
   distincts d'une même partie, et pas seulement au banc.
2. Son issue est **propre et complète** : abstention totale, zéro commande,
   zéro validation, zéro SKIP, navigation sans décision, cut conservé pour revue.
3. La règle « un hors-contrat n'est jamais un SKIP » (D-027) **tient sur le
   terrain** : 0 SKIP automatique sur 13 cuts non validés.
4. Les deux causes de report — garde d'écartement et abstention scientifique —
   **coexistent sans se confondre** et produisent chacune l'issue attendue.
5. Le pilote **reste utilisable** malgré le garde : 7 des 13 cuts non validés
   ont été traités bout en bout, avec des retouches humaines faibles.
6. **Aucun gros faux placement gauge-admissible n'a été reproduit** sur ce
   smoke — c'est-à-dire aucun placement grossièrement faux qui serait malgré
   tout passé sous le garde.

## 6. Ce que ce smoke ne prouve PAS

1. **Il ne prouve pas l'absence de faux placements gauge-admissibles.** Le
   point 6 ci-dessus est une **non-reproduction sur 13 cuts**, pas une absence.
   L'absence de preuve n'est pas une preuve d'absence, et 13 cuts n'ont aucune
   puissance statistique.
2. **Il ne prouve pas que les trois refus du garde étaient les bons refus.** Il
   établit que le garde a refusé et que le pilote s'est abstenu proprement. Ce
   qu'aurait été le placement correct sur 9452, 9453 et 9488 n'est pas connu :
   aucune référence humaine finale n'a été collectée sur ces trois cuts, puisque
   par construction l'opérateur les a quittés sans décision.
3. **Il ne prouve aucune généralisation.** Une seule partie, un seul profil de
   voie, une seule session, un seul opérateur, une seule journée.
4. **Il ne mesure pas la précision du placement.** Le majorant de 7,6 mm porte
   sur 7 cas et ne constitue pas une mesure d'exactitude.
5. **Il ne valide pas l'affichage UI ajouté en `a507525`.** Le smoke a été
   exécuté sur le checkpoint `5e6d0e8`, qui ne contient pas cet affichage. Le
   mini-smoke UI est un exercice **distinct et encore à faire**.
6. **Il ne dit rien de `KI-032`.** Aucune des paires refusées n'a été récupérée,
   et la question de leur récupération automatique reste entière.

## 7. Statut du corpus — consommé, définitivement

La session Natif associée à ce smoke est classée :

> **partie 16 — `DEVELOPMENT` / `REGRESSION_CONSUMED`**

et **jamais** comme futur HOLDOUT indépendant.

La raison est celle du §5 de `CORPUS_V2_NATIF.md` : cette session a été
**regardée pour décider**. Elle a servi à qualifier le comportement du garde
d'écartement en 4.7 et à documenter les issues de report. Dès qu'un ensemble
est examiné pour prendre une décision de conception, il est dépensé ; il reste
utilisable pour la reproduction, la non-régression et la comparaison
historique, et il ne peut plus apporter de preuve indépendante de
généralisation. Une partie consommée ne redevient jamais un HOLDOUT
indépendant.

Toute preuve indépendante future devra venir de **nouvelles parties**,
affectées à HOLDOUT **avant** toute analyse, selon la règle écrite de
`CORPUS_V2_NATIF.md` §5.

## 8. Limites du corpus

- **Effectif** : 13 cuts non validés, dont 3 refus du garde et 3 abstentions
  d'ambiguïté. Aucune strate (côté × signe de Z) n'est peuplée de façon
  mesurable.
- **Une seule partie** : la partition du Corpus V2 est *par partie*. La partie
  16 ne peut donc fournir qu'un seul point de partition, non stratifiable.
- **Pas de référence humaine sur les cuts différés** : par construction, les 6
  cuts différés sont quittés sans décision et n'apportent aucun oracle.
- **Statistiques non relevées** : seul le majorant des corrections humaines
  (≈ 7,6 mm) a été noté. Les valeurs par cut n'ont pas été consignées et ne
  doivent pas être reconstruites après coup.
- **Exports hors dépôt** : les exports Natif et Pilote de la session sont
  privés. Les faits ci-dessus ne sont pas rejouables depuis ce dépôt seul.
- **Checkpoint antérieur à `a507525`** : ce smoke n'exerce ni l'affichage de la
  politique effective, ni `tools/native-gauge-report.cjs`.

## 9. Références

- `DECISIONS.md` — **D-027** (contrat 1 405 / 1 430 / 1 470, sans SKIP automatique)
- `KNOWN_ISSUES.md` — **KI-031** (abstention pour ambiguïté), **KI-032** (paires
  refusées non récupérées, écart prévu/observé), **KI-033** (politique effective)
- `CORPUS_V2_NATIF.md` §5 — règle de partition et statuts de corpus
- `AUDIT_PILOTE.md` — Défaut 7, et ce qui a changé en 4.7
- `src/gauge.js` — les trois bornes du contrat, à un seul endroit

# Jointure Écho ↔ Orbite (chantier S3, plan 5.0)

Outil hors ligne `tools/jointure-echo-orbite.cjs`. Il joint, cut par cut, un export **Écho** (corrections humaines observées, `banane-native-session-v2` ou v3 compact, en plusieurs segments ou volumes zip) et le **journal Orbite** (`ariane-journal-v4-*.json`) de la même partie. Réponse à la ligne C-03 de l'audit Écho : juger Ariane sur la vérité terrain sans jointure manuelle, Écho restant passif et Orbite la source. Lecture seule, aucune dépendance autre que le dépôt, rien n'est écrit sous `src/` (depuis D-143 l'outil importe seulement la fonction pure `referenceParEcriture` de `src/native-session.js`, pour appliquer la même règle que l'Écho).

## Mode d'emploi

```
node tools/jointure-echo-orbite.cjs --echo <dossier ou fichiers…> (--journal <fichier> | --sans-journal)
     [--partie N] [--base auto|premiere|derniere] [--sortie table.json] [--csv table.csv] [--sans-poses]
     [--visite-sans-action-bonne [durée minimale en s, 0,8 par défaut]]
```

- `--echo` : un dossier (JSON et volumes zip ; seuls les exports Écho sont lus : `ariane-echo-*` depuis la 4.9.5, `ariane-native-v4-*` et `banane-native-v4-*` avant) ou des fichiers. Plusieurs dossiers ou fichiers peuvent être donnés, par exemple les deux sessions d'une partie. Chaque segment est relu puis libéré, les nuages ne sont jamais gardés ; les records sont fusionnés par `recordId`, le segment le plus récent l'emporte (comme `merge-segments.cjs`). Compter 1 à 2 minutes pour une partie de 1,2 Go d'Écho en 14 segments ; mémoire non mesurée, lancer avec `node --max-old-space-size=6000` pour les grosses parties.
- `--journal` : un journal Orbite. `--sans-journal` : **Écho seul**, voir plus bas ; les deux options s'excluent et l'une des deux est obligatoire.
- `--visite-sans-action-bonne [s]` : règle de Mic « visité sans action = bon », voir plus bas. Coupée par défaut.
- `--partie N` : une seule partie. Sans cette option, les parties présentes au journal (les parties de l'Écho absentes du journal sont ignorées et comptées).
- `--sortie` : JSON `ariane-jointure-echo-orbite-v1` (`resume` + `table`) ; `--csv` : une ligne par cut ; `--sans-poses` : retire les coordonnées absolues de la table (à utiliser avant de partager un fichier). Le résumé lisible sort toujours sur la sortie standard.
- Clé de jointure : (partie, cut) ; le projet n'y entre que si les deux identités en portent un (`projectId` est nul dans tous les exports actuels : il n'y a pas de `projectKey` dans les données).

### Ce que contient la table (une ligne par cut)

| Champ | Sens |
|---|---|
| `classe` | `posee` (validation ou pose vérifiée au journal), `differee` (différé et jamais posé), `autre` (vu au journal sans issue : capture abandonnée…), `hors-journal` ; `sans-journal` en mode Écho seul |
| `motifDiffere` | par rail : motif du moteur (`gcv1.motif`), statut, début de la raison ; statut et transition du différé |
| `propositionMoteur` | par rail, pour un cut posé : statut, motif, convention appliquée, confiance |
| `b1Ombre` | dernier `b1-ombre` du cut : état, règle, changement, étage réel et hypothèse, nombre d'appuis, écart de pose |
| `poseAriane`, `arianeDeplacement` | bords posés par Ariane (scène du journal) ; son déplacement dans le repère profil (record du journal : initial → corrigé) |
| `poseHumaineFinale` | bords de la dernière validation observée par l'Écho (scène de l'Écho) |
| `etiquetteEcho`, `visitesEcho`, `visiteReference` | étiquette de la visite de référence, nombre de visites, rang de la visite retenue |
| `referenceCorrigeeParEcriture`, `etiquetteEchoApresCorrection` | D-143, seulement si la référence a été corrigée par l'écriture serveur de validation : `par` (`outil` : corrigée ici ; `echo` : déjà corrigée par l'Écho), `poseDe` (`last-observed-state` ou `write`), `ecartMaxMm` (écart entre la référence figée à la touche et l'écriture). Pour `par: 'outil'`, `etiquetteEchoApresCorrection` est l'étiquette qu'aurait donnée l'Écho avec la bonne référence ; `etiquetteEcho` reste celle de l'export |
| `referenceHumaine` | `observee`, `sans-reference` (aucune validation observée dans aucune visite), `absent-de-l-echo` |
| `regleVisiteBon`, `visiteSansAction` | avec `--visite-sans-action-bonne` : `regleVisiteBon: true` pour un cut visité sans action compté à correction nulle ; `visiteSansAction` donne, pour tout cut sans validation, l'application de la règle (`appliquee`, `raison` du refus, `visites`, `dwellMaxS`, `deplacementMaxMm`) |
| `ecartHumain` | par rail : latéral, vertical, longitudinal (mm, repère profil du rail) et distance 3D ; `repere: "3D"` et seule la distance 3D si la matrice de repère profil manque ; `maxDist3dMm` |
| `base`, `controleRepereMm` | pose à laquelle l'écart se mesure ; contrôle du repère de scène pour un cut posé |

### Règles

- **Clé de visite = (session, `visitIndex`).** `visitIndex` repart de 0 à chaque session Écho ; il ne suffit donc jamais seul. Chaque record garde sa session (`nativeSessionId`, à défaut l'identifiant de la session du fichier). Les visites d'un cut, toutes sessions confondues, sont rangées **dans l'ordre du temps** : début de la visite (`startedAt`), puis rang de la session, puis `visitIndex`. Avant la v2, le tri se faisait sur `visitIndex` d'abord : une visite de la seconde session passait devant celles de la première, la « première visite » (base de l'écart) était alors une visite déjà corrigée et l'écart de Mic tombait à 0 (D-134). L'union des segments reste faite par `recordId` ; sans `recordId`, la clé de visite sert de repli (deux visites 0 de deux sessions ne sont pas confondues). Le résumé donne le nombre de sessions et celui des cuts vus dans plusieurs sessions.
- **Référence corrigée par l'écriture serveur de validation (D-143).** La référence que l'Écho fige à la touche de validation est périmée quand ESV applique le déplacement d'un rail après la touche (clic sur un rail quelques millisecondes avant). L'écriture de validation de la ligne fait foi : statut 2xx, rattachée à la visite par **numéro de ligne** (`joinMethod: 'row-index'`, jamais par l'heure) et au cut de la visite, postérieure à l'intention ; la dernière de la visite compte. Si ses rails diffèrent de plus de 1 mm de la référence, celle-ci est remplacée : par le dernier état observé de la visite s'il concorde avec l'écriture à 1 mm près, sinon par les positions de l'écriture (l'orientation du repère profil de la référence est gardée). Les écritures « vu par l'opérateur », en échec, d'une autre ligne ou rattachées par l'heure sont ignorées. Même règle que l'Écho (`fiches/ECHO_REFERENCE_ECRITURE.md`), appliquée ici aux exports collectés avant le correctif ; une référence déjà corrigée par l'Écho (`source: 'validation-write'`) est comptée à part. L'ancienne référence d'un export corrigé (`supersededBy`) n'est pas une validation de plus (`validationsDeLaVisite`).
- **Dernière validation = référence.** La référence est celle de la visite la plus tardive **dans le temps** qui porte une validation, pas celle de la dernière visite (le prototype `cmp.cjs` perdait la référence d'un cut dont la dernière visite n'avait pas de validation). Le comportement du prototype se retrouve avec `--base derniere`.
- **Écart humain = pose finale humaine − pose de base**, dans le repère profil de la base (axes : longitudinal, latéral, vertical, comme `native-offline-evaluate.cjs`). Base `auto` : la pose d'Ariane si le cut est posé et le repère de scène calibré, sinon la pose initiale de la **première** visite de l'Écho. Pour un cut posé, les deux coïncident (voir ci-dessous) ; l'écart se mesure donc bien au-dessus de ce qu'Ariane a laissé, même si Mic revient sur le cut. Pour un cut différé ou hors journal, la base est l'état où ESV l'a présenté à Mic, pas une pose d'Ariane.
- **Repère de scène.** L'Écho et le journal n'ont pas la même origine de scène. L'outil estime la translation constante qui les lie (médiane par axe sur les rails posés des deux côtés) et la consigne dans le résumé. Sur les deux parties essayées le résidu est nul (0,0 mm médian et P90) : la pose initiale vue par l'Écho est exactement la pose posée par Ariane. Un cut dont le contrôle dépasse 20 mm retombe sur la première visite (`repere-incoherent`).
- **Écho seul (`--sans-journal`).** Pas de journal : tous les cuts de l'Écho (de la partie `--partie`, sinon de toutes) sont de classe `sans-journal`, sans repère de scène (non calibré) et sans motif de différé ni décision B1. L'écart se mesure à la **pose initiale de la première visite** (la pose que ESV présentait à l'opérateur) ; `--base derniere` reste permis. Sert à juger des corrections humaines hors d'un lot Ariane (poses d'un opérateur : parties 12 et 13). Sans `--partie`, le cut 0 des rechargements de page est compté avec les autres.
- **Visité sans action = bon (`--visite-sans-action-bonne [s]`).** Règle de Mic : un cut visité, ni modifié ni validé, compte comme une correction nulle. Appliquée aux seuls cuts sans validation observée, quand (a) aucun rail n'a bougé de 0,5 mm ou plus entre la pose initiale et la dernière pose observée, dans aucune visite, et (b) la plus longue visite dure au moins `s` secondes (0,8 par défaut, 0 = toutes ; 0,8 pile suffit). Le cut devient `observee`, `regleVisiteBon: true`, écart nul, base = pose d'Ariane (cut posé, repère calibré) sinon première visite ; il n'a pas de pose humaine finale. Restent `sans-reference` : les cuts déplacés sans validation, trop courts, sans rail mesurable, et le cut 0 (artefact de rechargement). Le résumé compte ces cuts **à part** : `visiteSansActionBonne` (cuts appliqués, par classe, refus par raison) et, par classe, `dontVisiteSansAction` et `avecValidationObservee` ; ils entrent aussi dans « avec référence » et dans les statistiques, puisque c'est la règle. Coupée par défaut : sans l'option, rien ne change. À décider avec Mic : la durée (0,8 s contre 1 s ou 3 s) et si un balayage continu vaut contrôle.
- Statistiques : médiane, P90 (interpolation linéaire, comme `native-offline-evaluate.cjs`) et maximum, par classe et par rail (gauche, droit, deux rails), plus latéral et vertical en valeur absolue ; corrections > 5 mm et > 10 mm comptées par cut (plus grand des deux rails) et par rail. Les statistiques ne portent que sur les cuts qui ont une référence humaine.

### Ce que le résumé ajoute (D-143)

- `referencesCorrigees` : `cuts` (total), `parLOutil`, `parLEcho`, et `liste` (partie, cut, écart maximal entre la référence figée et l'écriture, origine de la pose, étiquette avant et après).
- `ecartementsReferenceHorsPlage` : les cuts dont la pose de référence (distance 3D entre les deux rails, après correction) sort de 1 420–1 470 mm, bornes comprises : `liste` (partie, cut, écartement en mm). Une référence périmée se voit là : un seul rail déplacé donne un écartement impossible. Le résumé lisible les dit en deux lignes.

## Résultats de la première exécution (chiffres seuls)

Base `auto`. Écarts en distance 3D par rail (mm).

**Partie 17** (14 segments d'Écho, 814 records, 795 cuts ; journal de 268 cuts) : 266 cuts joints ; classes au journal : 232 posées, 35 différées, 1 autre. Repère de scène calibré sur 460 rails, résidu nul. Repère profil pour les 1200 rails.

| Classe (cuts en Écho) | Avec référence | Sans référence | Médiane | P90 | Max | > 5 mm | > 10 mm |
|---|---:|---:|---:|---:|---:|---:|---:|
| posée (230) | 192 | 38 | 5,0 | 11,1 | 20,0 | 132 cuts (192 rails) | 47 cuts (55 rails) |
| différée (35) | 35 | 0 | 43,4 | 115,4 | 122,6 | 32 cuts (62 rails) | 29 cuts (55 rails) |
| autre (1) | 1 | 0 | 88,7 | 111,8 | 117,6 | 1 | 1 |
| hors journal (529) | 372 | 157 | 5,3 | 14,2 | 42,6 | 271 cuts (385 rails) | 126 cuts (153 rails) |

Pour les cuts posés, latéral médian 1,1 mm et vertical médian 3,6 mm (valeurs absolues) : la correction de Mic est surtout verticale. Pour les cuts différés, latéral médian 40,8 mm et vertical 4,3 mm.

**Partie 24** (Écho de 5 minutes : 1 segment, 37 records ; journal de 515 cuts) : 10 cuts joints (505 cuts du journal que l'Écho n'a pas vus) ; classes au journal : 409 posées, 105 différées, 1 autre. Repère de scène calibré sur 12 rails, résidu nul.

| Classe (cuts en Écho) | Avec référence | Sans référence | Médiane | P90 | Max | > 5 mm | > 10 mm |
|---|---:|---:|---:|---:|---:|---:|---:|
| posée (6) | 4 | 2 | 6,6 | 9,0 | 10,5 | 3 cuts (5 rails) | 1 cut (1 rail) |
| différée (4) | 3 | 1 | 56,0 | 99,2 | 99,3 | 3 cuts (6 rails) | 3 cuts (6 rails) |
| hors journal (27) | 24 | 3 | 2,4 | 7,7 | 10,8 | 15 cuts (17 rails) | 1 cut (1 rail) |

Effectifs trop faibles sur la partie 24 pour conclure ; elle sert de contrôle de bon fonctionnement.

**Écart au prototype `cmp.cjs` (partie 17, `--base derniere`).** Cuts différés identiques (35, médianes 53,3 et 29,1 mm ; P90 117,5 contre 117,8 et 60,1 contre 60,5 : seule la convention de quantile diffère). Cuts posés : 192 avec référence contre 191, médianes 5,0 et 5,0 contre 4,9 et 5,0, P90 11,2 et 10,4 identiques, maximum 16,9 et 20,0 identiques ; 132 cuts à plus de 5 mm contre 131. Hors journal : 372 avec référence contre 368 ; le prototype comptait en plus l'unique cut « autre » dans cette classe (maximum 117,6 contre 42,6 mm ici). La différence totale de 6 cuts s'explique par la règle de la dernière validation : six cuts (un posé, cinq hors journal) ont une visite validée suivie d'une visite sans validation, que le prototype ignorait. Aucun écart n'atteint 1 mm hors de cet effet de population.

## Vérifications après la v2 (chiffres seuls)

- **Partie 17** (une seule session, 14 segments, mode dossier `ariane-native-v4-*`) : la table est **identique, ligne pour ligne** (797 lignes), à celle d'avant la v2. Posés : 192 avec référence, **132 cuts à plus de 5 mm, 47 à plus de 10 mm**, écart 3D par rail **5,0 / 11,1 / 20,0 mm** (médiane / P90 / max) : les chiffres de D-121 et D-128. Avec `--visite-sans-action-bonne 0` : 230 posés avec référence (38 visités sans action), toujours 132 et 47.
- **Partie 29** (deux sessions Écho, 3 segments, dossiers lus en mode dossier, journal du lot) : 821 cuts en Écho, 245 au journal (210 posés, 34 différés, 1 sans issue), 236 joints, 9 posés jamais visités ; 20 cuts vus dans les deux sessions. Avec l'ancien tri, **19 lignes** de la table changent. Posés : 192 avec référence, **7 cuts à plus de 10 mm sur 192 (3,6 %)**, 96 à plus de 5 mm, écart 3D par rail 3,4 / 7,4 / 19,8 mm ; différés 34. Ce sont les chiffres corrigés du rapport p29.
- **Partie 29 avec la règle** (même table que le contournement du rapport p29, ligne pour ligne) : durée 0 s, 106 cuts à correction nulle, 201 posés avec référence, 7/201 ; durée 1 s, 24 cuts, 195 posés avec référence, 7/195 ; durée 3 s, 6 cuts ; durée par défaut 0,8 s, 46 cuts (6 posés), 198 posés avec référence, 7/198, 96 à plus de 5 mm. Un cut est déplacé sans validation dans tous les cas.
- Essais : `tests/jointure-echo-orbite*.test.cjs`, sur données synthétiques (`tests/helpers/jointure-synthetique.cjs`) : deux sessions, exports `ariane-echo-*`, Écho seul, règle de la visite.

## Vérifications après D-143 (chiffres seuls)

- **Second projet, partie 1** (export final de l'Écho, 765 cuts, 885 records) : un cut corrigé par l'outil, le **428**. Écartement de la référence : 1 631,1 mm figé à la touche, **1 441,6 mm** corrigé ; rail droit déplacé de 190,3 mm entre la référence figée et l'écriture, pose prise au dernier état observé (qui concorde avec l'écriture). Étiquette de l'Écho `VALIDATE_CORRECTED_LEFT_ONLY`, étiquette avec la bonne référence `VALIDATE_CORRECTED_BOTH`. Aucun autre cut n'a de référence à plus de 1 mm de son écriture. 764 lignes sur 765 identiques à celles d'avant. Reste hors de 1 420–1 470 mm le cut 346 (1 480,8 mm), dont la référence concorde avec son écriture.
- **Partie 17** : table identique ligne pour ligne (797 lignes), aucune référence corrigée (exports sans écritures serveur) ; 192 avec référence, 132 cuts à plus de 5 mm, 47 à plus de 10 mm, 5,0 / 11,1 / 20,0 mm.
- **Partie 29** : table identique ligne pour ligne (830 lignes), aucune référence corrigée ; 192 avec référence, 7 cuts à plus de 10 mm sur 192, 96 à plus de 5 mm.
- Essais : `tests/jointure-echo-orbite-ecriture.test.cjs` (9 essais, fixtures synthétiques) et, côté Écho, `tests/echo-ref-ecriture.test.cjs`.

## Limites

- **Pose d'Ariane = pose au moment de la validation** (record du journal, état « corrigé » ; à défaut l'événement `applied-verified`). Si Mic a déplacé un rail avant que le journal ne consigne sa validation, ce déplacement est déjà dans la « pose d'Ariane ». Sur les deux parties, la pose d'Ariane coïncide à 0,000 mm avec la pose initiale vue par l'Écho, ce qui rend l'hypothèse crédible, sans la prouver pour d'autres lots.
- **Sessions Écho** : l'ordre est celui de `startedAt`. Deux sessions simultanées (deux onglets) seraient entrelacées dans l'ordre du temps ; la clé (session, `visitIndex`) les distingue mais l'outil ne les sépare pas. Une jointure d'un Écho en plusieurs sessions faite avant la v2 est à refaire.
- **Visité sans action** : « n'a pas bougé » se juge sur la pose initiale et la dernière pose de chaque visite, à 0,5 mm près ; un rail déplacé puis remis en place dans la même visite compte comme immobile. L'outil ne sait pas si le nuage était chargé (condition proposée à Mic).
- **Une seule translation de scène** par jointure. Si un Écho couvre plusieurs rechargements de la page ESV avec des origines de scène différentes, le résidu du résumé le montrera et les cuts concernés retomberont sur la première visite.
- **Différés et hors journal** : l'écart se mesure à l'état que ESV présentait à Mic, pas à une pose du moteur. Ces écarts (dizaines de millimètres pour les différés) ne jugent pas le moteur mais la distance qu'il aurait fallu combler.
- **Le journal doit couvrir le lot** : un cut que le journal n'a jamais vu est « hors journal », même si Ariane l'a traité dans un autre lot dont le journal n'est pas fourni.
- Une visite dont la validation est marquée incertaine (`candidate-timing-uncertain`) ou une étiquette `AMBIGUOUS_MULTIPLE_INTENTS` reste utilisée comme référence ; l'étiquette est consignée pour que l'analyse les écarte au besoin.
- Les dictionnaires d'un segment compact ne sont lus qu'avec le segment lui-même (les records n'en dépendent pas ; la réparation KI-060 ne concerne que les nuages, que l'outil ne lit pas).
- Pas de lecture du nuage de points : aucune mesure géométrique, seulement des poses.
- **Référence corrigée** : seules les écritures jointes à la visite de référence sont lues. Une validation écrite après la sortie du cut est jointe à la visite par numéro de ligne dans le délai de 5 s ; au-delà, elle n'est rattachée à aucune visite et ne corrige rien. Les 16 dernières écritures d'une visite sont gardées.

## Ce qui manque pour les mesures P0 du cahier (§ 5, lot P)

La jointure fournit la vérité terrain (pose humaine finale en repère profil) et la classe d'Ariane. Les trois mesures P0 demandent en plus des grandeurs que l'outil ne sort pas encore :

- **(a) Graine contre intersection contre moyenne, par classe de rail.** Le `gcv1-shadow-observed` du journal consigne par rail `frame.uSeed`, `frame.uMedian`, `frame.zMedian`, les deltas des candidats `v46`, `astar` et `next` et leur graine. Il n'y a pas de grandeur nommée « intersection » ; la définition de chaque estimateur et celle de la « classe de rail » sont à fixer. À faire : extraire ces champs dans la table et comparer chaque estimateur à la pose humaine finale (même repère profil, même base).
- **(b) Convention refusée contre rails calés ; amplitude de la correction sur les cuts « pair-guard ».** Le `proposed` consigne `gcv1.convention` (appliquée ou non, raison dont `shift-out-of-domain`, `duMm`, `dzMm`, delta brut) et le shadow `conventionCalibration` et `pairGauge`. La table ne garde aujourd'hui que le booléen « convention appliquée ». À faire : sortir `reason`, `dzMm` et le verdict `pairGauge` par rail ; définir « pair-guard » (motif de différé `gauge-out-of-contract` ? à confirmer) ; croiser avec l'écart vertical humain. L'écart vertical est déjà dans la table.
- **(c) Erreur des rails appliqués par tranche de pente brute du flanc.** Le journal garde un booléen `slopeLimited` et le motif `slope`, pas la valeur de la pente brute. À faire : vérifier si la pente est reconstructible (nuage, absent du journal) ou si elle doit être consignée par le moteur ; sinon la mesure se limite à « pente limitée oui/non ».
- **Échos 18 et 20** : cités par le cahier, non essayés ici (je n'avais que les parties 17 et 24). L'outil les prend tels quels.
- Les effectifs du cahier (410 rails à convention refusée, 89 cuts « pair-guard », 68 différés « pente ») n'ont pas été retrouvés dans cette passe, qui ne les cherchait pas.

## À faire hors de ce chantier

- `tools/perf-phases.cjs` ignore les relevés S6 de la 4.9.5.3 (non corrigé ici) : il faudrait ajouter `list-fields`, `esv-event` et `diag-compteur-bloque` à `OBS_KINDS` et lire les champs `ept`, `statuts`, `echecs` et `dureeTotMs` de `resource`.
- `tools/p0-commun.cjs` (`lectureSession`, mode dossier) a le même motif de nom que l'ancienne jointure et ignore donc aussi les exports `ariane-echo-*` en mode dossier ; non touché ici.

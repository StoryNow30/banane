# E5 — Jeu d'apprentissage v1 et métriques par version (plan 5.0)

Deux outils hors ligne, sans dépendance, lecture seule, rien sous `src/` :

- `tools/jeu-apprentissage.cjs` : table de jointure Écho ↔ Orbite → fichier JSON lignes, une ligne par cut joint (traits d'Ariane + étiquette de Mic).
- `tools/metriques-version.cjs` : les chiffres qui jugent une version sur la vérité terrain.

Essai : `tests/e5-metriques.test.cjs` (jointure synthétique de la partie 99, cuts inventés, seuils tombant pile sur 5,0 et 10,0 mm).

## Sources et reprise de l'existant

Les deux outils lisent la table produite par `tools/jointure-echo-orbite.cjs --sortie table.json` (S3, `JOINTURE_ECHO_ORBITE.md`). Rien n'est relu dans l'Écho ni dans les nuages.

Un `tools/jeu-apprentissage.cjs` existait déjà sur la branche de la maquette ESV (`claude/esv-locale-audit`, commits 0faaf0a et b11c96d). Il n'a pas été repris tel quel : il lit un export complet de la maquette (`tests/esv-maquette/lecteur-export.cjs`, absent de la base 5.0), travaille en coordonnées du scénario de la maquette et sort un autre format (`banane-apprentissage-v1`). L'outil E5 reprend ses principes : écart en repère profil (le long de la voie, en travers, vertical), valeur nulle quand rien n'est connu, rien d'inventé, fenêtre de voisinage de ±3 cuts, en-tête de résumé. Le nom de format est différent à dessein (`ariane-jeu-apprentissage-v1`) pour ne pas mélanger les deux fichiers. L'interpolation entre voisins (D-098) n'est pas dans le jeu : elle s'appuierait sur les corrections de Mic aux voisins, grandeur inconnue d'Ariane au moment de proposer.

## Format du jeu : `ariane-jeu-apprentissage-v1`

Fichier JSON lignes (une ligne = un objet). Première ligne `type: "entete"`, les suivantes `type: "cut"`, triées par partie puis numéro de cut.

```
node tools/jeu-apprentissage.cjs --jointure table.json --sortie jeu.jsonl
     [--sans-poses | --avec-poses] [--avec-hors-journal] [--fenetre 3]
```

**`--sans-poses` est le défaut** : aucune coordonnée absolue dans la sortie (contrôlé par l'essai : plus grande valeur absolue du jeu de la partie 17 = 129,7 mm). `--avec-poses` recopie `poseAriane` et `poseHumaineFinale` de la table (scène du journal et de l'Écho) sous `poses` ; ce sont des données privées, à garder dans le scratchpad, jamais dans le dépôt.

**En-tête** : `format`, `source` (format et base de la table, nombre de cuts joints), `options`, `cuts`, `avecReference`, `parClasse`, `seuilsMm` ([5, 10]), `absents` (ce que le jeu v1 ne porte pas encore).

**Ligne de cut** :

| Champ | Contenu |
|---|---|
| `partie`, `cut`, `classe` | clé de jointure ; classe d'Ariane au journal : `posee`, `differee`, `autre` (ou `hors-journal` avec `--avec-hors-journal`) |
| `joint` | vrai si le cut est à la fois au journal et à l'Écho (toujours vrai sans `--avec-hors-journal`) |
| `traits.propositionMoteur` | par rail : statut, motif, convention appliquée (booléen), confiance |
| `traits.b1Ombre` | état, règle, changement, étage réel et hypothèse, appuis, écart de pose de l'ombre B1 |
| `traits.differe` | pour un différé : statut, transition, rails non résolus, motif et statut par rail |
| `traits.deplacementAriane` | par rail, ce qu'Ariane a déplacé (pose de départ d'ESV → pose posée), en mm, repère profil |
| `traits.voisinage` | cuts de numéro inférieur dans ±fenêtre : nombre de posés, de différés, d'autres, et le plus proche. Numéros inférieurs seulement : le lot avance par numéros croissants, les suivants ne sont pas encore décidés quand Ariane propose |
| `etiquette.referenceHumaine` | `observee`, `sans-reference` (aucune validation de Mic observée), `absent-de-l-echo` |
| `etiquette.correctionMm` | par rail : longitudinal, latéral, vertical, distance 3D (mm, repère profil) ; plus `maxDist3dMm` du cut. Nul sans référence |
| `etiquette.pose`, `etiquette.differe` | classe d'Ariane en booléens |
| `etiquette.corrige5mm`, `corrige10mm` | `maxDist3dMm` strictement supérieur à 5 ou 10 mm ; nul sans référence |
| `etiquette.fauxVert` | pour un cut posé avec référence : corrigé de plus de 10 mm ; nul pour un différé ou sans référence |
| `etiquette.etiquetteEcho`, `base` | étiquette de la visite de référence à l'Écho ; pose à laquelle l'écart se mesure (`ariane` pour un posé, `premiere-visite` sinon) |
| `qualite` | visites à l'Écho, visite retenue, validations de la visite, statut de l'Écho |
| `traits` nul | cut hors journal (aucun trait d'Ariane) |

Frontière anti-fuite : les `traits` ne contiennent aucune grandeur issue de la référence humaine (essai : pas d'`ecartHumain` dans les traits). Tout ce qui vient de Mic est sous `etiquette`.

**Pas dans la v1** (champs à ajouter quand la donnée existe) : zone (M1), raison de la correction (E3), points par rail (nuage non lu), grandeurs P0 (graine, intersection, convention brute, pente brute : voir la fiche de la jointure), appartenance DEV / RÉSERVÉ (E4). Tant que le manifeste E4 n'existe pas, un jeu v1 ne doit servir ni à régler ni à juger GCV2.

## Métriques par version

```
node tools/metriques-version.cjs --jointure table.json [--journal journal.json]
     [--jointure autre.json …] [--journal-seul journal.json …]
     [--version V] [--json sortie.json] [--pause 120]
```

Sortie lisible sur la sortie standard, JSON `ariane-metriques-version-v1` avec `--json`. Un `--journal` suit son `--jointure` (version lue au journal, débit). `--journal-seul` mesure un journal sans Écho : différés et débit seulement, une entrée par partie. Plusieurs entrées de même version donnent un total « ensemble » ; des versions différentes n'en donnent pas (une version se juge seule).

### Définitions exactes

Population « **posés mesurables** » : cuts que le journal dit posés par Ariane (`validation-accepted` ou `applied-verified`) **et** dont l'Écho a observé une validation de Mic (référence humaine = dernière validation observée). Les posés sans validation observée (`PASS_NO_DECISION`) et ceux que l'Écho n'a pas vus sont comptés à part et ne sont **pas** devinés « bons ».

- **Écart 3D** : distance entre la pose finale de Mic et la pose d'Ariane, en mm. Donné **par rail** (gauche et droite mises ensemble ; c'est la mesure de D-121) et **par cut** (le plus grand des deux rails).
- **Médiane, P90, maximum** : quantile par interpolation linéaire (comme `native-offline-evaluate.cjs`), maximum exact. Affichage à 0,1 mm. Idem pour l'écart **latéral** et **vertical** : valeur absolue par rail (repère profil du rail) ; en plus, **biais moyen signé** latéral et vertical par rail.
- **Corrigé de plus de 5 / 10 mm** : cut dont l'écart 3D (le plus grand des deux rails) est **strictement** supérieur au seuil ; taux sur les posés mesurables. Le nombre de rails est donné en plus.
- **Taux de différés** : cuts différés et jamais posés ÷ cuts vus au journal (posés + différés + autres). Avec les motifs par rail non résolu (un différé compte une fois par motif distinct).
- **Taux de faux verts** : cuts posés par Ariane puis corrigés de plus de 10 mm ÷ posés mesurables. Une **borne basse** est donnée aussi : même numérateur ÷ tous les posés du journal (comme si tout posé non observé était juste).
- **Différés, écart humain** : écart de la pose de départ d'ESV à la pose de Mic. Ce n'est pas une erreur d'Ariane (elle n'a rien posé) mais la distance qu'il restait à combler.
- **Hors journal** : cuts que Mic a visités sans que le journal les connaisse (verts d'extraction, autres lots). Mêmes écarts ; sert de première mesure de « un vert n'est pas forcément juste ».
- **Cuts par heure** : un cut est décidé quand il porte `validation-accepted` ou `defer-finalized` (le plus tardif compte) ; cuts décidés − 1 ÷ durée. **Brut** : du premier au dernier cut décidé. **Actif** : on retire les intervalles de plus de `--pause` secondes (120 par défaut).

### Partie 17 (jointure `p17.json` + journal Orbite de la partie 17, version 4.9.0.12)

Chiffres agrégés, retrouvés à l'identique de D-121.

| Mesure | D-121 | Outil |
|---|---:|---:|
| Cuts posés avec référence humaine | 192 | 192 |
| Corrigés de plus de 10 mm | 47 | 47 (24,5 %) |
| Corrigés de plus de 5 mm | 132 | 132 (68,8 %) |
| Écart 3D par rail, médiane | 5,0 | 5,0 |
| Écart 3D par rail, P90 | 11,1 | 11,1 |
| Écart 3D par rail, maximum | 20,0 | 20,0 |

Autres valeurs de la même exécution :

- Posés au journal 232 : 192 mesurables, 38 sans validation observée, 2 absents de l'Écho.
- Écart 3D par cut : médiane 7,3 ; P90 12,7 ; maximum 20,0 mm.
- Latéral (absolu, par rail) : médiane 1,1 ; P90 4,9 ; maximum 9,1. Vertical : médiane 3,6 ; P90 10,4 ; maximum 19,9 mm. Biais moyen signé : latéral 0,1 mm, vertical 0,6 mm (les corrections vont dans les deux sens, la dispersion est verticale).
- Rails corrigés de plus de 5 mm : 192 ; de plus de 10 mm : 55.
- **Faux verts** : 47 sur 192 posés mesurables (24,5 %) ; borne basse 47 sur 232 (20,3 %).
- **Différés** : 35 sur 268 cuts du journal (13,1 %) ; motifs par rail : candidate 11, slope 8, ambiguity 6, gauge-out-of-contract 4, minTop 4, rsf 3, flank 1, input 1, window 1. Écart humain des 35 différés : médiane 43,4 mm par rail, P90 115,4, maximum 122,6 (surtout latéral : médiane 40,8 mm).
- **Hors journal** : 372 cuts avec référence, médiane 5,3 mm par rail, P90 14,2 ; 126 corrigés de plus de 10 mm (33,9 %).
- **Débit** : 267 cuts décidés en 19,7 minutes, 811 cuts par heure, sans pause de plus de 120 s (lot en mode rapide).

### Autres parties disponibles

| Partie | Version | Écho | Cuts du journal | Différés | Débit brut (cuts/h) |
|---:|---|---|---:|---:|---:|
| 17 | 4.9.0.12 | oui (14 segments) | 268 | 13,1 % | 811 |
| 18 | 4.9.0.12 | non | 421 | 8,3 % | 798 |
| 23 | 4.9.0.13 | non | 621 | 24,2 % | 836 |
| 24 | 4.9.0.15 | 5 minutes seulement | 515 | 20,4 % | 1 019 |
| 25 | 4.9.0.16 | non | 454 | 16,1 % | 1 022 |
| 26 | 4.9.0.16 | non | 370 | 15,7 % | 1 325 |
| 27 | 4.9.0.17 | non | 524 | 20,2 % | 686 (986 actif) |

Sur la partie 24, seuls 4 posés ont une référence humaine : aucun taux de faux verts n'est à tirer de ce lot. Les parties sans Écho n'ont que les différés et le débit. Les parties sont de lots différents (zones, ordres de cuts, durées) : la comparaison de versions par ces lignes n'a pas de valeur tant que les cuts ne sont pas les mêmes.

## Limites

- **Un seul projet ESV** (D-123) et **un seul Écho exploitable** (partie 17) : les chiffres valent pour ce lot.
- **La référence est la dernière validation de Mic observée à l'Écho.** Ce n'est pas une vérité indépendante : Mic peut valider un cut un peu faux ou le corriger sans besoin ; le bruit de ses propres gestes n'est pas mesuré.
- **« Posé » = pose au moment de la validation au journal**, hypothèse de la jointure (0,000 mm d'écart sur les parties essayées, non prouvée pour d'autres lots).
- **Faux vert** : seuls les posés revus par Mic comptent. L'étiquette `PASS_NO_DECISION` (38 posés sur la partie 17) peut valoir « vu, bon » comme « non regardé » ; l'Écho ne les départage pas (E6, E1 étape 2 et la relecture de toute la liste par Mic, D-122 point 7, doivent combler ce manque). Les deux bornes (24,5 % et 20,3 %) encadrent.
- **Les relectures E1 (`diff-liste`) ne sont pas branchées** : aucun instantané réel de la liste n'existe encore. Quand ils existeront, ils donneront une référence pour les cuts que l'Écho ne voit pas.
- **Pas de métrique par zone ni par raison** : la zone (M1) et la raison de la correction (E3) n'existent pas encore dans les données. Les différés sont ventilés par motif du moteur seulement.
- **« 0 mauvaise pose ajoutée »** (porte du cahier) ne se calcule pas ici : il faut le rejeu de deux versions sur les mêmes cuts. Les métriques d'une version se comparent à une autre sur le même ensemble de cuts, pas sur deux lots différents.
- **Cuts par heure** : horodatage des décisions du journal, sans le temps passé hors d'Orbite ; les lots en mode rapide vont à plusieurs centaines de cuts par heure, sans commune mesure avec un humain. Il n'y a pas de débit pour les Échos.
- **Écart d'un différé** : mesuré à la pose de départ d'ESV, pas à une proposition du moteur (voir la fiche de la jointure).
- Le jeu v1 ne porte pas de nuage ni de pose absolue par défaut : un entraînement qui voudrait les points par rail devra les relire dans l'Écho (hors périmètre de cet outil).

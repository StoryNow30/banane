# Cap 5 : moins de 5 différés par partie, la qualité d'abord (v4 livrée en test 15, v5 explorée)

Suite de `fiches/L1_APPRENTISSAGE.md` (test 14, décision L1-e). Objectif fixé par le responsable du terrain : moins de 5 différés posables par partie rejouable, avec une qualité mesurée en validation croisée par partie. La qualité passe avant le nombre de différés : en cas de conflit, le cut reste différé.

## 1. La v4 (test 15)

Leviers de la décision L1-e (`src/gcv2-l1.js`, `LEVIERS_LIVRES`, lus par l'extension ; le banc peut les changer par `BANC_LEVIERS` pour une mesure) :

| Levier | Valeur | Rôle |
|---|---|---|
| `exact`, `autreRail` | oui | écartement exact de la paire (pas celui des hypothèses) ; si le rail le moins sûr n'est pas soutenu à sa nouvelle place, l'autre rail est essayé |
| `anomalieMinMm` à `anomalieMaxMm` | 10 à 45 mm | écart à la référence d'écartement qui déclenche la correction |
| `sousTauCoherentMm` | 8 mm | sous τ, paire déjà à l'écartement de référence et soutenue par le nuage : validée |
| `voisins`, `raffineObligatoire` | oui | voie des voisins validés, rapprochée des hypothèses du nuage (8 mm), deux rails soutenus, écartement à 10 mm de la référence |
| `transport` | oui | les poses L1 du lot (GCV2 validées, chaîne refaite par L1-s) donnent la voie de référence ; jamais appuis de la chaîne ni voisines de sa décision (D-221) |
| `anomalieNonCorrigeeRien` | oui | anomalie d'écartement qu'aucun rail soutenu ne corrige : rien |
| `vetoVoieMm` | 45 mm | une validation à plus de 45 mm en travers de la voie sûre n'est pas posée |
| `consensus`, `consensusVoieProche` | oui | nuage (deux rails soutenus), écartement de référence (10 mm) et voie des voisins (15 mm) d'accord : validée |

Sous L1-se, la pose de la chaîne refaite par L1-s passe par la même correction d'écartement que la GCV2.

### Parité banc / extension

`tools/parite-l1se-sw.cjs` rejoue un lot archivé dans le vrai service worker : background.js en vm, moteur réel, vrais nuages du corpus. La liste d'ESV est dans le stockage local et l'ordre des cuts est celui du lot. L'outil compare ensuite, décision par décision, l'état, la source et le décalage (à 0,05 mm près) au rejeu du banc.

- Un écart a été trouvé et corrigé au banc. Dans le chemin L1-s b (décision refaite avec les options de L1), le banc acceptait une commande « engine » que l'extension n'envoie pas. Cela touchait 7 cuts sur les parties mesurées.
- 2:19 : 248 décisions identiques sur 248.
- 2:20 f228f6f9 : 281 sur 281. Le dernier cut du lot est comparé sur la pose envoyée : l'ESV simulé ne joue pas la validation de fin de lot.

## 2. Résultats v4 (banc v4b = test 15), L1-se

Les 20–50 mm sont comptés à part (bande « > 20 »). Les différés posables excluent les cuts sans nuage (captures de moins de 100 points).

| Partie | Différés réels | v4b posables (sans nuage) | Jugées | ≤ 10 mm | 10–20 | 20–50 | > 50 | Mauvaise voie |
|---|---|---|---|---|---|---|---|---|
| 2:19 | 207 | 3 (1) | 235 | 234 | 1 | 0 | 0 | 0 |
| 2:17 | 41 | 18 | 23 | 17 | 3 | 3 (9552, 9644, 9646) | 0 | 0 |
| 2:18 | 37 | 18 | 18 | 14 | 4 | 0 | 0 | 0 |
| 2:11 | 12 | 3 | 8 | 6 | 2 | 0 | 0 | 0 |
| 2:20 fd7067f7 | 42 | 8 (29) | 8 | 7 | 1 | 0 | 0 | 0 |
| 2:20 f228f6f9 | 123 | 2 | 175 | 173 | 2 | 0 | 0 | 0 |
| 2:6 | 11 | 3 | 8 | 6 | 2 | 0 | 0 | 0 |
| 2:7 | 21 | 2 | 19 | 14 | 3 | 2 (3220, 5684) | 0 | 0 |
| 2:13 | 3 | 0 | 0 | – | – | – | – | – |

Aucun vert de la chaîne n'est changé. Les budgets de D-223 (mauvaise voie ≤ 1 %, > 50 mm ≤ 3 %) tiennent partout. 2:10 (lot 91b36b65) : 9 cuts, aucun différé réel.

Les 29 cuts sans nuage de 2:20 fd7067f7 (293 à 320) ont des captures vides (4 à 7 points), alors que l'Écho de ces cuts en montre 3 000 à 7 000. C'est un levier de capture (attendre puis recapturer), pas un levier de décision.

## 3. v5 : la qualité d'abord, mesurée en validation croisée par partie

Diagnostic des 494 poses GCV2 jugées. Une pose validée avec une voie sûre des voisins (transport), à 5 mm ou moins en travers de cette voie, est juste dans 319 cas sur 321. Les poses à plus de 20 mm viennent surtout des validations faites sans voie sûre : 3220 et 5684 (2:7), 9644 et 9646 (2:17). Seule 9552 (2:17, consensus) a une voie sûre, à 2,9 mm en travers, et reste pourtant à 25,6 mm de l'opérateur.

Méthode : grille de seuils, partie laissée de côté, score « qualité d'abord ». Le score pèse dans l'ordre les poses à plus de 50 mm, puis à plus de 20 mm, puis une partie sous 95 % à 10 mm, puis les différés posables, puis la bande 10–20. Les seuils sont réappris sans la partie testée. Leviers mesurés (tous coupés par défaut) :

| Levier | En apprentissage | En validation croisée | Retenu |
|---|---|---|---|
| Sans voie sûre, validation de la test 13 si p ≥ 0,9 (`validerSansVoieMinP`) | retire les 7 poses > 10 mm sans voie | appris seulement par 2:7 : sans 2:7, le seuil appris est 0,7 et 5684 (37,4 mm) reste | non |
| « Plus de 150 mm » corrigé sans voie si anomalie ≥ 15 mm (`anomalieMinRienSansVoieMm`) | séparation parfaite (3 mauvaises, 7 bonnes) | appris seulement par 2:17 : sans 2:17, aucun seuil n'est retenu | non |
| Anomalie ≥ 15 mm partout (`anomalieMinRienMm`) | retire aussi 13 bonnes poses (2:20, 2:19) | – | non |
| Consensus coupé | retire 9552 et 9652 | appris seulement par 2:17 | non |
| Choix de la paire par l'écartement de référence (`selectionRefMm`) | 2 mauvaises voies en 2:17 (9527 à 202 mm, 9653 à 250 mm) | – | non |
| Sans voie sûre, aucune validation (`sansVoieRien`) | hors ligne, 20–50 mm de 5 à 1, choisi dans tous les plis | au rejeu réel, les premières poses du lot n'alimentent plus le transport : 2:20 f228f6f9 passe de 2 à 69 différés, 2:11 de 3 à 12 (plus aucune pose), 2:19 de 3 à 14 | non (coût) |
| Consensus sur toutes les paires d'hypothèses (`consensusTous`) | aucune paire ne réunit nuage, voie et écartement sur les différés restants de 2:17 | – | non |

Constat. Aucun levier mesuré n'enlève les poses à 20–50 mm sans être appris sur une seule partie, ou sans coûter des dizaines de bonnes poses. En 2:17, la voie des voisins est souvent à 50–130 mm de l'opérateur (ADV qui change vite). Les bonnes hypothèses existent dans le nuage (à quelques mm de l'opérateur), mais aucune preuve fiable ne les choisit : ces cuts restent différés.

## 4. Correction d'une affirmation antérieure

La fiche de la test 14 donnait « 52 % des approchés à plus de 50 mm ». Ce chiffre mesurait la correction depuis la pose d'ESV, pas l'erreur de pose : une pose approchée ne reste pas dans ESV. Voir la correction en fin de `fiches/L1_APPRENTISSAGE.md`.

## 5. Outils et essais

- `tools/banc-differes.cjs` : leviers par `BANC_LEVIERS` (JSON), consignés dans l'en-tête ; transport ; correction de la chaîne refaite ; nombre de points par ligne.
- `tools/parite-l1se-sw.cjs` : parité banc / service worker (options `--coupe N`, `--progres`).
- Essais : `tests/gcv2-l1-cap5.test.cjs` (leviers livrés, écartement exact, rail ramené, correction sans capture) et `tests/lot-profil-l1se-transport-sw.test.cjs` (transport sous L1-se, pas sous L1-s).

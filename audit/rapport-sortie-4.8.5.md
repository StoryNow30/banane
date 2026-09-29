# Rapport de sortie 4.8.5 — candidat stable

**29 septembre 2026 (D-063).** Les chiffres viennent des audits des lots
(`audit/lot-485-p25-2026-09-29.md` et `audit/lots-20-24-33-2026-09-29.md`,
branche `claude/banane-48-cahier`, rapports de `tools/acceptance-report.cjs` et
`tools/analyse-locale.cjs`) ; aucun n'est recalculé ici. C1 à C4 sont rapportés
ensemble.

**Candidat** : même code que le test 2 (`0d29e54`), seuls la version et le nom
changent (`4.8.5`, « Ariane »). Le moteur de décision (`src/lot-decision.js`,
`lot-decision-v7`) et `src/engine.js` sont identiques entre le test 1
(`36b8242`) et le test 2 : les mesures du test 1 valent pour ce code.

## Ce qui a tourné en réel, et sous quelle version

**Les deux lots de la 4.8.5 (parties 25 et 33) ont tourné sous le test 1
(4.8.5.1).** Aucun lot n'a tourné sous le test 2. En conséquence, **le code
de fin de partie du test 2 (D-062 b : fin mémorisée seulement si ESV affiche
une partie supérieure et que le cut vaut M−1) n'a pas été exercé en réel**,
ni la mise en sécurité pendant une pose (D-062 c). Ils ne sont vérifiés que
par les essais (`tests/fin-partie-m-485.test.cjs`,
`tests/securite-pose-485.test.cjs`, `tests/reprise-intrusion-485.test.cjs`,
`tests/cohabitation-p2-485.test.cjs`) et par l'essai de cohabitation dans
Chromium (onglet ESV synthétique).

| Lot | Partie | Version | Relecture | Cuts | Posés (C1) | C4 faux / jugés | C3 hors contrat posés |
|---|---|---|---|---|---|---|---|
| lot 25 (29/09, 0 → fin) | 25 | 4.8.5.1 (test 1) | Écho complète | 81 | 69 (85,2 %) | **2 / 62** (cuts 112, 113) | 0 |
| lot 33 (29/09) | 33 | 4.8.5.1 (test 1) | **aucune** (« RAS » de l'opérateur, non enregistré) | 100 | 84 (84,0 %) | non jugé | 0 |

C1 groupé des parties 25 et 33 : 153 / 181 (84,5 %).

## Critères

| Critère | Statut | Détail |
|---|---|---|
| C1 | **tenu** | 85,2 % (partie 25), 84,0 % (partie 33) ; objectif 79 % |
| C2 | publié sans plancher | partie 25, cuts validés : latéral p90 6,4 mm (max 13,1), vertical p90 2,4 mm (max 10,5) |
| C3 | **tenu** | 0 paire hors contrat posée ; refus d'écartement : 5 (partie 25), 4 (partie 33) |
| C4 | **validé sur l'expertise de la direction, sans mesure conforme à la lettre** (D-063) | partie 25 : 2 faux sur 62 posés jugés (3,2 % ; borne haute de Clopper–Pearson 95 % unilatérale 9,8 %), 7 posés non jugés (4 références non strictes, 3 passages trop brefs). **La porte exige au moins 100 posés jugés : 62 < 100.** La partie 25 était déjà validée à 99 % au départ (80 cuts restants) et ne pouvait pas en fournir plus. La direction juge cette relecture suffisante et valide la qualité (« ce que j'ai corrigé sur la 25, c'est amplement suffisant et je valide »), comme pour la 4.8.0 (D-060). Partie 33 : pas de relecture. |
| Garde d'écartement bas (1 420 mm) | tenue au banc, jamais déclenchée sur le terrain | banc J1 : 707 et 711 refusés, 718 posé, 0 juste perdu ; lots 25 et 33 : 0 refus de la garde (écartements posés de 1 429,5 à 1 451,2 mm) : **chaque refus examiné à la relecture** est une porte vide ici |
| Interruptions | 0 non reprenable | lot 25 : pause « Adaptateur ESV sans réponse » après la validation du dernier cut visité (8338), sans perte, 12 cuts restants tous différés ; lot 33 : arrêt après le différé du cut 5882, ESV passé au cut 7004 = M−1, adaptateur perdu pendant sa capture (page en cache de navigation), sans perte |

## Faux de la partie 25

Cuts **112 (12,9 mm)** et **113 (13,1 mm)**, rail droit, écart latéral, tous
deux corrigés par l'opérateur. Ils terminent une suite de 7 cuts consécutifs
(108 à 114) posés chacun sur les deux précédents : piste de **dérive en
chaîne**, non démontrée, non retrouvée dans les lots 4.8.0 des parties 21 à 24
(1 faux isolé sur 353 jugés). Observation locale, reportée en 4.9 ; elle ne
bloque pas la 4.8.5 (D-063).

## Ce que les lots ont appris

- **Compteur « N on M treated » lisible** (relevé passif D4) : M = 8 530
  (partie 25), 7 005 (partie 33) ; +1 par cut validé. Le texte « M cuts » n'a
  jamais été relevé (le test 1 ne le lisait pas) : la question reste ouverte.
- **Fin de partie** : aucun des deux lots n'est passé par le chemin D3/D-062
  (départ d'ESV après un dernier cut **différé**, puis « Reprendre »). Lot 25 :
  départ après un dernier cut **validé** (comportement de la 4.8.0) ; lot 33 :
  navigation vers le cut M−1, puis perte de l'adaptateur pendant sa capture.
- **Après le lot J2** (`PLAN_SUITE.md`) : message de fin de partie
  contradictoire quand M est connu et que le cut n'est pas M−1 ; détection
  « lot terminé, sauf les différés » (lot 25 : total − traités = 12 = différés).

## Problèmes connus acceptés pour la 4.8.5

- **KI-068** (nouveau) : l'export du journal d'Orbite embarque les visites et
  événements d'Écho de toute la session (1,03 Go pour le lot 33 contre 3,5 Mo
  pour le lot 25). Contournement : `tools/filtrer-journal.cjs` (branche
  `claude/banane-48-cahier`). Correction après la 4.8.5.
- **KI-067** : corrigé (D3, D-062), non exercé en réel (ci-dessus).

## Contexte : lots 4.8.0 des parties 20 à 24 (29/09)

Même moteur de décision, sans la garde de 1 420 mm : C1 groupé 432 / 527
(82,0 %) ; parties 21 à 24 : 1 faux sur 353 posés jugés (cut 4835, 10,55 mm
vertical) ; partie 20 : relecture inutilisable (repère incompatible). Le lot 25
(2 faux sur 62) ne se distingue pas nettement de ces lots (test exact de
Fisher, p = 0,06).

## Contrôles du candidat

`node tools/verify.cjs` à 0 ; portes J1 (633 cuts de validation, 8 jeux du
banc) ; paquet reproductible ; empreintes dans `LIRE_EN_PREMIER.md`.

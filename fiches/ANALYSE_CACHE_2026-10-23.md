# Analyse de l'export du cache du 23/10/2026 (tests 18 et 19, cinq parties)

Source : `banane-data/collections/2026-10-23_cache-tests-18-19_export-18-volumes` (journal et fiches de départ ; bilan non exploité ; corpus non lu). Aucun Écho : rien n'est jugé contre une vérité. Les chiffres sont lus dans les événements du journal (`defer-finalized`, `validation-accepted`, `passe-differes-*`, `relecture-*`, `deplacer-vue`), non recoupés avec le panneau. Période : depuis le 23/10 09 h 05 (heure de Paris) ; les données d'avant ont été vidées à la main par l'opérateur.

## 1. Lots (version 4.9.5.19)

| Partie | Invalides au départ | Posés (validés) | Différés | Durée du lot | Par cut traité |
|---|---|---|---|---|---|
| 29 | 85 | 0 | 0 | aucun cut traité dans le journal (30 min d'événements) | inexpliqué |
| 33 | 201 (280 ignorés) | 185 | 16 | 10 min 41 s | 3,19 s |
| 32 | 14 | 14 | 0 | 1 min 08 s | 4,88 s |
| 0 | 535 | 444 | 91 | 30 min 04 s | 3,37 s |
| 5 | 61 | 58 | 2 | 2 min 15 s | 2,26 s |
| Total (4 lots avec cuts) | 811 | 701 | 109 | | |

Part posée par le lot : 86 % (701 sur 810). Durée par cut traité = durée entre le premier et le dernier cut traité divisée par leur nombre (moyenne, pas la médiane de `perf-lot`, donc pas comparable telle quelle aux 2,44 s de la 4.9).

## 2. Partie 0 : 91 différés

- 91 différés sur 535 (17 %), répartis en 13 plages de cuts. Décision du lot : 70 « sans appui » (`no-anchor`), 17 « fenêtre » (déplacement de la vue demandé), 2 garde de jauge, 2 « pas de minimum qualifié près de la prédiction ». Raisons de la chaîne : « plusieurs placements STRONG compétitifs », « flanc interne insuffisamment observé », « plan de roulement non estimable ».
- **Déplacement de la vue : 30 tentatives dans le journal (18 cuts), 30 échecs.** Chaque tentative envoie un cran de molette puis constate `camera-immobile` (coordonnées d'écran identiques avant et après, `pixelMm` 0,444 avant et après) : refus `pre-vol:camera-immobile`. Les rails étaient juste hors de la vue (NDC 1,009 à 1,04), un dézoom de 2 à 5 % aurait suffi. Les 18 cuts ont tous été différés.
- Deuxième passe sur la partie 0 : 90 décisions en ombre, dont 59 « poserait » et 31 « rien » (13 plus de 150 mm, 5 sans voie, 5 sans approche, 4 départ le plus probable, 3 voie incohérente). **Aucun événement de fin de passe, aucune écriture, aucune relecture ensuite** : la passe s'est arrêtée sans motif dans le journal. Cause non établie.

## 3. Deuxième passe en écriture (partie 33)

Décidé 10 poses, **1 écrite**, puis refus à la deuxième : « cible hors de la vue : cette passe ne déplace pas la vue ». Soit 1 pose écrite sur 10 décidées. Parties 32 et 5 : 0 et 2 différés, 0 écrit. Le gain du banc de la passe est donc, sur ce seul cas de terrain, très inférieur au majorant.

## 4. Relecture en mode « corriger »

| Partie | Cuts relus | Corrigés | Durée | Par cut |
|---|---|---|---|---|
| 33 | 393 | 32 | 19 min 25 s | 2,96 s |
| 32 | 30 | 2 | 1 min 08 s | 2,26 s |
| 5 | 281 (216 en ADV) | 18 | 6 min 34 s | 1,40 s |
| 0 | aucune relecture dans le journal | | | |

Références : 1,8 s par cut (test 7, partie 11), 4,6 s (3:0, test 15). Aucun refus de navigation sur ces trois relectures.

## 5. Questions ouvertes

- Pourquoi aucun cut traité sur la partie 29 (85 invalides au départ) et pourquoi la passe de la partie 0 s'est-elle arrêtée sans fin ?
- Pourquoi la molette n'a-t-elle jamais déplacé la caméra (30 sur 30) ? Réglage d'ESV, geste non pris en compte, ou autre : à relever avec l'opérateur.
- Les 70 cuts « sans appui » de la partie 0 ne sont pas repris par la GCV2 du lot (en 4:2, les cuts de même motif l'étaient) : à expliquer.
- Autonomie (cuts sans retouche) : non calculable sans Écho.

## 6. Corrections du 25/10 (partie 0 jugée contre l'Écho, `ANALYSE_PARTIE0_ECHO_2026-10-23.md`, D-250)

- **Partie 29** : « aucun cut traité » est faux. Le lot de la partie 29 (8 h 33, heure de Paris) a été vidé à la main à 9 h 05, avec le reste du cache d'avant cette heure (voir l'en-tête), avant l'export, sans export confirmé ; il n'en reste que la capture du dernier cut. La ligne du § 1 et la première question du § 5 sont donc sans objet pour la partie 29.
- **Les 70 « sans appui »** : la formule « non repris par la GCV2 du lot » est trompeuse. La GCV2 du lot a posé 40 cuts depuis l'étape « différé » ; les 70 sont ceux qui restaient sans appui à la fin. Le lot 2 (14 h 41, « Tout recentré ») en a posé 11 de plus. Qualité de ces reprises : voir D-250 (5 poses à plus de 50 mm sur 42 jugées).
- **Passe de la partie 0** : la cause est établie. Le service worker a redémarré à 10 h 35 min 46 s, 32 s après la dernière décision ; la passe vit en mémoire et a disparu. Probable, non prouvé : l'arrêt du service worker par Chrome.
- **Déplacement de la vue** : recompté sur le lot 1 avec l'outil de jointure, 29 demandes de déplacement (64 envois de molette de 1 à 4 crans), toutes « caméra immobile » ; lot 2, 2 demandes (7 envois), même résultat.

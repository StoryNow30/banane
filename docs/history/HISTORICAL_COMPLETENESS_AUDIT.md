# Audit de complétude historique Banane

Date : 15 septembre 2026

Base GitHub auditée : `main` @ `569c9a55d1cc8294fa5b1365d49856233db8ed33` (baseline V4.5.7 avant V4.6).

## Conclusion

Le dépôt actuel est **complet comme snapshot de développement V4.5.7**, mais **incomplet comme archive historique du projet depuis V2**.

Le commit de baseline GitHub est un commit racine sans parent : l’historique antérieur a été aplati en un snapshot. Une grande partie du travail ancien subsiste dans le contenu du snapshot (tests, fixtures, audits, corpus, documents), mais pas sous forme de versions successives, de commits, de tags ou d’archives originales.

## Ce que le dépôt préserve déjà correctement

### Héritage V2 / V2.4.x

Présent dans le snapshot :

- `tests/v242/banane.js` ;
- tests V2.4.2 (`bounding-box`, `capture`, `manual`, fixtures et oracle matriciel) ;
- copies de `capture-core.js` et `lidar.js` ;
- corpus et références historiques part 23 réutilisés dans les tests actuels ;
- documentation moderne décrivant le comportement et les tests de V2.4.2.

Absent comme objet historique autonome :

- archive originale `banane_v2_4_2.zip` ;
- son arborescence originale complète (15 fichiers annoncés : source, manifest, README, FORMAT, changelog, tests, index de hashes) ;
- historique Git de cette phase.

### V3

Présent dans le snapshot :

- `tests/incidents/banane-dataset-v3-1788955914519.json` ;
- `tests/incidents/banane-journal-v3-1788955443422.json` ;
- `tests/incidents/banane-references-v3-1788955130252.json` ;
- incident cut 7460 ;
- corpus de développement part 23 et références ;
- logique de régression issue de V3.

Pièces historiques référencées hors dépôt :

- `banane_v3_corpus.zip` ;
- `banane-v3.zip` ;
- `banane-v3-3.0.1.zip` ;
- `prompt-banane-v3-test.md` ;
- `audit-reprise-grok-banane-2026-09-09.md` ;
- `diagnostic_3392_rail_droit.zip` ;
- `diagnostic_part23.zip`.

Point historique à préserver : l’audit du 9 septembre établissait qu’au début de la reprise, `banane_v3_corpus.zip` était un **corpus**, pas une extension V3 complète. Une V3 installable a été produite ensuite et est citée dans la passation vers V4. Ne pas confondre ces deux états temporels.

### V4.0 à V4.3

Le dépôt conserve beaucoup de substance :

- code courant dérivé de cette architecture ;
- `datasets/automatic/geometry-evaluation-v4.1.0.json` ;
- `datasets/automatic/geometry-evaluation-v4.2.0.json` ;
- `datasets/automatic/offline-evaluation-v4.3.0.json` ;
- `audit/ingestion-certificate-v4.3.0.json` ;
- `OFFLINE_EVALUATION.md` ;
- outils de rejeu hors ligne ;
- incidents/corpus hérités.

Mais les snapshots d’origine ne sont pas versionnés :

- `banane-v4.zip` (V4 TEST 4.0.0, annoncé à 118/118 tests) n’est pas conservé comme archive originale ;
- les archives installables/source exactes de V4.1, V4.2 et V4.3 ne sont pas identifiées comme objets immuables dans Git ;
- leurs différences successives ne sont pas reconstruisibles par `git diff`, puisque l’historique a été aplati.

### V4.4 / V4.4.1 / V4.4.3

Très bonne conservation documentaire et de tests :

- hashes historiques V4.4.0 ;
- audits Natif V4.4.0/V4.4.1 ;
- baseline offline V4.4.1 ;
- témoins V4.5 provenant de V4.4.3 ;
- outils d’audit et résultats associés.

Pièces originales non présentes comme archives :

- archive `banane-v4.4.1-test` (SHA-256 documenté : `7020ffab41e71e8ae952873a6417d654412a2f33e6c4afc629e98505d98f7c28`) ;
- archive source+tests V4.4.3 (SHA-256 documenté : `6b6e46e4525132b7381d59898d28194428cf68abca6580c651e7940f6ca75962`) ;
- ZIP installable V4.4.3 (SHA-256 documenté : `bc617dadb78f5a5d82c35ad0237ad3850f5ddf1f328bcf766c334c1c62916011`).

### V4.5.x

Le snapshot est très riche :

- V4.5-R et lot 1 ;
- cerveau V1 (`brain.js`, `geometry-brain.js`, jeu et ajustement) ;
- collecte Natif ;
- signature LOD ;
- réglages pilote ;
- interface unifiée ;
- documentation et passation V4.5.7 ;
- 364 tests annoncés avant V4.6 (362 dans un clone GitHub sans les trois références Natif privées).

Ce qui manque surtout est la **chronologie versionnée** :

- archives/snapshots distincts V4.5.0, 4.5.2, 4.5.3, 4.5.4, 4.5.5, 4.5.6, 4.5.7 ;
- notamment les livraisons connues `banane-v4.5.5-OFFICIELLE.zip`, `banane-v4.5.6-CERVEAU.zip`, `banane-v4.5.7-CERVEAU.zip` ;
- diffs Git entre ces versions.

## Données volontairement absentes de GitHub

`datasets/native/` est volontairement exclu. C’est sain pour la branche de développement : les gros exports Natif/LiDAR ne doivent pas être ajoutés à Git simplement pour rendre l’historique “complet”.

Exemples de grosses pièces historiques retrouvées/référencées hors Git :

- `banane-native-v4-1789294517253.json` (~130,3 Mo) ;
- `banane-native-v4-1789370906681.json` ;
- `banane-corrections-v4-1789042324894.json` (~131,8 Mo) ;
- segments Natif du 15/09 ;
- autres exports de collecte.

Ils doivent rester dans un stockage de données séparé avec manifeste SHA-256, sauf décision explicite contraire.

## Documentation métier

Trois documents métier sont référencés dans les audits :

- `R2_P_09_ProcedureESV3D.docx` ;
- `R2_D_05_Production des extractions de rails(1).docx` ;
- `R2_I_06_MéthodeOpérateur_ExtractionDeRails.docx`.

Ils ne doivent pas être importés automatiquement dans GitHub. Leur présence dans une bibliothèque de travail ne vaut pas autorisation d’hébergement dans un dépôt tiers.

## Classification de complétude

| Domaine | État |
|---|---|
| Code actif V4.5.7 | complet comme snapshot |
| Tests de régression | très complet |
| Corpus de tests embarqué | riche, mais pas exhaustif |
| Audits V4.4–V4.5 | très bien conservés |
| Historique V2–V4.5 sous forme de commits | absent |
| Archives originales de chaque version | partiel / absent |
| Gros exports Natif/LiDAR | volontairement hors Git |
| Documents métier | volontairement hors Git |

## Risque principal

Le risque n’est pas de perdre le code actuel : il est bien sauvegardé. Le risque est de perdre la capacité de répondre à des questions du type :

- « quel fichier a changé entre V4.2 et V4.3 ? » ;
- « quelle archive exacte était installée lors de tel test terrain ? » ;
- « ce comportement vient-il de V3.0.1 ou d’une modification V4 ? » ;
- « peut-on reproduire bit à bit une ancienne livraison ? ».

Le dépôt actuel ne peut pas toujours y répondre seul.

## Décision d’archivage proposée

Ne pas réécrire l’histoire Git de `main` et ne pas injecter d’anciennes versions dans la racine active.

Créer, sur une branche historique indépendante, un index immuable des archives retrouvées et, lorsque les droits et la taille le permettent, conserver les petites pièces historiques sous `history/`. Les gros datasets restent hors Git avec SHA-256, taille, date, rôle et emplacement externe documentés.

Aucune action de cet audit ne doit toucher la branche Claude V4.6 en cours.

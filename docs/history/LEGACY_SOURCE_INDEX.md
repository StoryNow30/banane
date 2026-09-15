# Index des sources historiques Banane

Cet index distingue ce qui est **déjà dans GitHub**, ce qui est **retrouvé/référencé hors GitHub**, et ce qui est **non retrouvé**. Il n’importe aucun gros dataset ni archive binaire.

## V2.4.2

État GitHub : héritage partiel mais substantiel.

Présent :
- `tests/v242/banane.js`
- `tests/v242/bounding-box.test.cjs`
- `tests/v242/capture.test.cjs`
- `tests/v242/manual.test.cjs`
- `tests/v242/fixtures.cjs`
- `tests/v242/matrices-oracle.json`
- copies actuelles de `capture-core.js` / `lidar.js`

Référencé hors GitHub :
- `banane_v2_4_2.zip`
- contenu annoncé : 15 fichiers, source V2.4.2, manifest, tests, formats, README, changelog, index de hashes
- vérification historique : 32 tests réussis, 0 échec

Statut : archive originale à retrouver/importer comme artefact historique si elle est encore disponible et si son contenu est autorisé à être hébergé.

## Corpus V3 initial

Référencé hors GitHub :
- `banane_v3_corpus.zip`
- 23 fichiers annoncés : README, `analyse_corpus.py`, index, références dédoublonnées, 10 LiDAR, 9 exports de références
- rôle : corpus de développement, pas extension V3 au moment de l’audit du 9 septembre

Autres diagnostics référencés :
- `diagnostic_3392_rail_droit.zip`
- `diagnostic_part23.zip`

Documents de contexte retrouvés dans la bibliothèque :
- `audit-reprise-grok-banane-2026-09-09.md`
- `prompt-banane-v3-test.md`

## V3 installable / V3.0.1

Référencé dans la passation vers V4 :
- `banane-v3.zip`
- `banane-v3-3.0.1.zip`

Pièces déjà conservées dans GitHub :
- `tests/incidents/banane-dataset-v3-1788955914519.json`
- `tests/incidents/banane-journal-v3-1788955443422.json`
- `tests/incidents/banane-references-v3-1788955130252.json`
- `tests/incidents/journal-part-24-cut-7460-v3.0.0.json`
- tests de régression associés

Statut : archives exactes V3/V3.0.1 non présentes comme objets historiques dans le dépôt actuel.

## V4 TEST 4.0.0

Référencé hors GitHub :
- `banane-v4.zip`
- version annoncée : V4 TEST 4.0.0
- vérification historique annoncée : 118/118 tests

Le dépôt actuel conserve la majorité des descendants architecturaux : service worker, bridge, adapter, engine, geometry, storage, sessions, tests et outils.

## V4.1 / V4.2 / V4.3

Présent dans GitHub :
- `datasets/automatic/geometry-evaluation-v4.1.0.json`
- `datasets/automatic/geometry-evaluation-v4.2.0.json`
- `datasets/automatic/offline-evaluation-v4.3.0.json`
- `audit/ingestion-certificate-v4.3.0.json`
- `OFFLINE_EVALUATION.md`
- outils de rejeu / évaluation

Références de données historiques hors Git :
- bilans automatiques V4.0/V4.1
- corrections V4.0/V4.2

Statut : résultats bien conservés ; archives source/installables exactes de chaque sous-version non identifiées comme snapshots immuables dans Git.

## V4.4.0

Présent :
- `audit/v4.4.0-frozen-engine-hashes.json`
- audits géométriques et offline V4.4.0
- moteur/géométrie historiques recopiés dans la baseline V4.5.7

Statut : excellente traçabilité par hashes et audits, mais pas d’archive V4.4.0 autonome identifiée.

## V4.4.1

Référencé hors GitHub :
- `banane-v4.4.1-test(2).zip`
- SHA-256 documenté : `7020ffab41e71e8ae952873a6417d654412a2f33e6c4afc629e98505d98f7c28`
- export réel associé : `banane-native-v4-1789294517253.json` (~130,3 Mo)

Présent dans GitHub :
- `audit/native-v4.4.1-real-audit.json`
- `audit/native-offline-v4.4.1-baseline.json/.md`
- documentation Natif héritée

## V4.4.3

Référencé hors GitHub :
- archive source+tests V4.4.3, SHA-256 `6b6e46e4525132b7381d59898d28194428cf68abca6580c651e7940f6ca75962`
- ZIP installable V4.4.3, SHA-256 `bc617dadb78f5a5d82c35ad0237ad3850f5ddf1f328bcf766c334c1c62916011`
- banc source original : 188 tests réussis

Présent dans GitHub :
- résultats et témoins V4.5 issus de cette baseline
- `audit/native-fluidity-v4.4.3.json`
- témoins V4.5 lot 1

## V4.5-R / lot 1

Présent dans GitHub :
- `CHANGELOG_V45R.md`
- `audit/V45_LOT1_RAPPORT.md`
- `audit/V45_LOT1_BORNE_TEMPORELLE.md`
- témoins SVG et JSON
- outils de profiling / placement lab / évaluation

Retrouvé hors GitHub :
- `RAPPORT_V45R.md`
- plusieurs exports Natif de terrain

## V4.5.5 / 4.5.6 / 4.5.7

Connu historiquement :
- `banane-v4.5.5-OFFICIELLE.zip`
- `banane-v4.5.6-CERVEAU.zip`
- `banane-v4.5.7-CERVEAU.zip`

Le snapshot GitHub `569c9a5` est l’état V4.5.7 consolidé. Il préserve :
- cerveau V1 ;
- intégration `geometry-brain` ;
- signature LOD ;
- réglages pilote ;
- interface unifiée ;
- tests et audits ;
- passation complète.

Statut : contenu final préservé, archives intermédiaires non versionnées dans Git.

## Données volumineuses retrouvées hors Git

Ne pas importer automatiquement :
- `banane-corrections-v4-1789042324894.json` (~131,8 Mo)
- `banane-native-v4-1789370906681.json`
- autres exports Natif V4.4/V4.5
- segments Natif V4 du 15/09

Pour ces fichiers, l’index historique doit idéalement contenir : nom, taille, SHA-256, date, version productrice, rôle, statut de sensibilité et emplacement de stockage.

## Pièces métier hors dépôt

Référencées dans les audits, non importées :
- `R2_P_09_ProcedureESV3D.docx`
- `R2_D_05_Production des extractions de rails(1).docx`
- `R2_I_06_MéthodeOpérateur_ExtractionDeRails.docx`

Elles servent au contexte métier, pas à la distribution du code. Leur hébergement GitHub doit faire l’objet d’une décision séparée.

# Plan jusqu'à la sortie de la 4.8

**Établi le 23 septembre 2026**, après les deux audits à mi-parcours
(`audit/mi-parcours/`) et les décisions D-037 et D-038. Ce plan ordonne les
chantiers ; le cahier (`BANANE_4.8_CAHIER.md`) reste le contrat.

## Cible de sortie

| Critère | Seuil 4.8 | Mesure |
|---|---|---|
| Couverture (C1) | **≥ 80 % des cuts distincts** de chaque lot Pilote complet de validation ; 90 % reste le cap | cuts sans entrée, différés ou refusés comptés ; revisite ≠ nouveau cut (D-038) |
| Faux (C4) | **0 cut faux** : erreur latérale OU verticale > 10 mm (D-038) | sur tous les cuts jugés des lots de validation |
| Qualité (C2) | médiane et p90 latéral / vertical non dégradés face à la 4.7.6 | plancher P2 affiché à côté |
| Interceptions (C3) | les paires hors contrat restent refusées | essais + lots |
| Curseurs (C5) | bilan daté de chaque curseur touché | `DECISIONS.md` |
| Généralisation | au moins une partie **tenue à l'écart** de tout réglage | lots de validation |

## Phase 0 — trancher le choix par la voie *(en cours)*

Chantier 1 de D-037 : `tools/lot-choice-study.cjs`.

1. Terminer l'étude sur les cinq sessions, critère 2D.
2. **Mesurer la variante réalisable en un seul passage** : ancres = cuts
   PRÉCÉDENTS du lot seulement. Le Pilote avance cut par cut et ne sait pas
   revenir à un cut donné (seulement « suivant » et « suivant sans décision ») :
   le second passage des deux côtés demanderait un lot de reprise des différés.
   L'étude compare les deux, pour choisir l'architecture sur un chiffre.
3. Relecture indépendante de l'étude (Astra) avant toute décision.

**Décision D1 (direction)** : lever par amendement n°9 la règle « la
prédiction ne fait que déplacer la fenêtre » pour autoriser le choix par la
voie, dans la variante retenue — ou arrêter la piste si elle crée des faux.

## Phase 1 — 4.7.8 : tout observer sur le terrain, rien d'appliqué de nouveau

Développement :

- **Décision sur le lot en observation dans le Pilote** : calculée et consignée
  à chaque cut (variante D1), jamais appliquée. Même principe que la 4.7.7,
  qui reste active en Natif.
- **Journal des candidats** (D-038) : minima et paires de chaque rail, pour
  séparer « pas de points », « bon rail non choisi » et « paire refusée ».
- **Qualification instrumentée par côté** (chantier 3) : raison, présence,
  visibilité, capture avant geste, doublons.
- **Banc aligné sur le Pilote** : matrice cut par cut (identifiant, entrée,
  paire, garde, différé, erreurs latérale et verticale, référence, revisites),
  plus aucun cut retiré par le filtre centré sur la pose ESV.
- **Exports légers** (KI-044), si le travail confié à Sol est livré : relecture
  contre le cahier, puis intégration.

Terrain (opérateur) :

- **F1** — 2 à 3 lots Pilote complets sur des parties à appareils de voie,
  chacun relu en Natif (chaque cut validé).
- **F2** — P2 : 30 cuts replacés en aveugle, quelques jours après leur première
  pose, sans regarder l'ancienne.

Mesure : C1 réel du Pilote (dénominateur D-038), couverture qu'aurait donnée la
décision sur le lot, faux 2D, parité hors ligne. **Arrêt** si la décision sur
le lot, en observation, produit un seul faux que le Pilote n'aurait pas fait.

**Décision D2** : activer, ou revenir à la phase 0.

## Phase 2 — 4.7.9 : activer la décision sur le lot dans le Pilote

Développement :

- Application, dans le Pilote, des cuts résolus par la voie, avec toutes les
  gardes existantes (deux rails, écartement en admissibilité, garde de
  continuité) ; tout le reste inchangé.
- Si la phase 0 le justifie : **lot de reprise des différés** (le Pilote repasse
  le lot en sautant les cuts déjà traités, avec ancres des deux côtés).
- Interface minimale : chaque cut appliqué par la voie est marqué comme tel, et
  « Différés : N » reste fidèle.

Terrain :

- **F3** — 2 lots Pilote sur des parties **jamais utilisées** pour régler quoi
  que ce soit, relus en Natif.

Mesure : les critères de la cible de sortie, partie par partie.

**Décision D3** : 80 % et 0 faux atteints → phase 3 ; sinon une itération 4.7.10
sur la cause mesurée, ou révision de l'objectif par amendement.

## Phase 3 — 4.8.0-rc : interface, qualité, preuve

- **Banane UI Next** (chantier B) : maquettes de Luna corrigées, validées par
  la direction, puis intégrées au panneau. Invariants de l'interface :
  politique effective affichée, « Différés : N » fidèle, incertitude de
  navigation visible avec son cut, aucun bouton présenté comme réussi sur un
  simple accusé.
- **Calage** validé sur une partie et un jour différents (recommandation 5 de
  l'audit indépendant).
- **Tests d'acceptation §14** (A à I) et invariants §7, chacun avec son essai.
- **Rapport C1 à C5**, avec P2 comme plancher déclaré ; problèmes connus à jour.
- **Audit indépendant** de la version candidate (Astra), puis corrections.
- **Cahier consolidé** : un seul texte 4.8 final reprenant le corps et les
  amendements.

Terrain :

- **F4** — contrôle Edge de la version candidate et un lot Pilote complet.

**Décision D4** : 90 % — rester un cap, ou redevenir un engagement pour la 4.9.

## Phase 4 — sortie 4.8.0

- Paquet reproductible selon la procédure 4.7, empreinte publiée.
- **Avec ton autorisation explicite seulement** : merge dans `main`, tag
  `v4.8.0`, release. Même règle pour la 4.7.0 encore ouverte (tag `v4.7.0`, QA
  indépendante, contrôle Edge court : `NEXT_TASKS.md`, §A).

## Hors 4.8 (reporté en 4.9)

Vitesse du Pilote et raccourcis clavier ; régresseur de position appris ;
multi-sessions et multi-onglets.

## Ce que chaque phase demande à l'opérateur

| Phase | Session terrain | Contenu |
|---|---|---|
| 1 | F1 | 2 à 3 lots Pilote à appareils de voie + relecture Natif |
| 1 | F2 | 30 cuts replacés en aveugle (P2) |
| 2 | F3 | 2 lots Pilote sur parties nouvelles + relecture Natif |
| 3 | F4 | contrôle Edge et un lot Pilote de la version candidate |

## Points de décision de la direction

D1 levée de la règle et variante · D2 activation · D3 passage en version
candidate ou itération · D4 statut des 90 % · sortie : merge, tag et release.

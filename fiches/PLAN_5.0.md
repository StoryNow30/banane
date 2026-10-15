# Plan détaillé 5.0 : chantiers, branches, niveaux, portes, ordre de lancement

Version 1 du 15 octobre 2026. Cahier signé par Mic le 15 octobre (D-119). Règles : `BANANE_5.0_CAHIER.md` et `fiches/ORGANISATION_DEV_5.0.md`. Ce plan est le tableau de bord : l'orchestrateur y tient l'état de chaque chantier (à faire / lancé / livré / au terrain / accepté) et le coût constaté. Même importance pour tous ; l'ordre est celui des dépendances et des réponses attendues.

Conventions : base de code = `claude/495-test-2` (4.9.5.2) tant que la 4.9.5 n'est pas fusionnée ; branche d'un chantier = `claude/50-<code>` ; outils hors ligne dans `tools/`, essais dans `tests/`, fiches dans `fiches/`. Jetons : estimation au niveau rapide, relecture forte comprise quand elle est due. « Q n » = question n du cahier § 7.

## 0. Ordre de lancement

| Vague | Chantiers | Pourquoi maintenant | Attend |
|---|---|---|---|
| **V0 (lancée le 15/10 au soir)** | S3 jointure Écho ↔ Orbite ; S8 documents à corriger | hors ligne, sans risque, tout en dépend | rien |
| V1 (dès la prochaine fenêtre) | S6 relevés en lecture seule (→ 4.9.5 test 3) ; S7 repli `phase-timing` ; E1 étape 1 (instantané de liste + diff) ; M6 outil ; E5 métriques | lecture seule ou hors ligne | S3 pour M6/E5 |
| V2 | P0 (a)(b)(c) mesures ; S4 maquette dans verify ; campagne de pannes | les décisions P1/P2/P5 en dépendent | S3 livré ; Échos joints |
| V3 | E2, E3, E6, E4 (→ 5.0 test 1, test 2) ; F1 ombre ; F4 ; F5 | Écho et données | 4.9.5 test 2 validée au terrain ; relevé console (F1) |
| V4 | M1, M2, M3 mesures par zone, M4 (1)(2) ; E1 étape 2 si Q1 oui ; M5 si Q4 oui (→ 5.0 test 3, test 4) | méthodes métier | Q1, Q3, Q4, Q9 ; S6 |
| V5 | P1, P2, P5 selon P0 ; P4 ; P3 ; P6 ; P7 (→ 5.0 test 5 à 7) | poser juste | P0 ; Q2 ; banc B (P4, P6) |
| V6 | M3 code, M4 (3)(4), M6 panneau (→ 5.0 test 8, 9) | méthodes actives | V4, V5 |
| V7 | G0, G1 ombre, G2 (→ 5.0 test 10 à 12) | méga cerveau | ≥ 500 corrections (E1), E5 |
| V8 | F3 si Q6 oui ; stable 5.0 | fin | tout |

**Règle ajoutée par Mic (D-123)** : chaque vague est aussi testée sur un **second projet ESV** (autre chantier, autre nuage) avant d'être tenue pour acquise ; la V0 (jointure Écho ↔ Orbite) le sera dès qu'un lot Orbite et un Écho d'un autre projet sont reçus.

Une vague ne démarre que si la précédente a livré ses portes **ou** si ses chantiers n'en dépendent pas. Deux chantiers au plus en parallèle par fenêtre de 5 h (un lourd, un léger).

## 1. Socle 4.9.5

| Code | Chantier | Branche | Niveau / effort | Entrées | Livrables | Porte | Jetons | État |
|---|---|---|---|---|---|---|---|---|
| S1+S2 | 4.9.5 test 2 | `claude/495-test-2` | rapide / moyen | .20 + 4.9.5.1 | paquet, consigne | verify 0 échec ; séance terrain | 112 k + correction de consigne (constaté) | **livré** (5c775b7), au terrain |
| S3 | Jointure Écho ↔ Orbite par cut | `claude/50-s3-jointure` | rapide / moyen | Écho 17 (7 segments), 20 ; journaux Orbite des mêmes parties ; `echo17/cmp.cjs` (prototype) ; `tools/native-offline-evaluate.cjs` | `tools/jointure-echo-orbite.cjs` : table par cut (classe Ariane posée/différée, pose Ariane, pose humaine finale, écart par rail en repère profil, B1 ombre, zone si connue) ; `fiches/JOINTURE_ECHO_ORBITE.md` ; essai sur fixture | sur Écho 17 : chaque cut joint à son journal, écart humain retrouvé à < 1 mm par rapport au prototype ; sortie sans identifiant | 196 k (constaté) | **livré 15/10** (`claude/50-s3-jointure`, 5aa2ccb) : 266/268 cuts joints, écarts à 0,1 mm du prototype ; **à rejouer sur un second projet** (D-123) |
| S4 | Maquette ESV dans verify + campagne de pannes | `claude/50-s4-banc` | rapide / haut ; relecteur fort sur `tools/verify.cjs` | `claude/esv-locale-audit` (maquette, banc), § 8-9 de l'audit | rejeu court (~40 cuts) dans verify ; rejeu complet avant paquet ; campagne de 8 pannes scriptée | verify passe avec le rejeu ; campagne verte sur 4.9.5.2 | 600 k + 150 k | à faire (V2) |
| S5 | Banc B sauvé | hors dépôt (`banane-banc`) | Mic + orchestrateur | copie privée chez Mic | dépôt privé, README | clonable, rejeu lancé une fois | 50 k | à faire avec Mic |
| S6 | Relevés en lecture seule (→ 4.9.5 test 3) | `claude/495-test-3` | rapide / moyen | liste au § 4 du cahier | 12 relevés consignés dans le journal/diag ; réglages à défaut ; essais | aucun changement de pose ; verify 0 ; export relu | 400 k | à faire (V1) |
| S7 | Repli `phase-timing`, filtrage Écho | avec S6 | éclair / bas | KI-068, D-110 8c | export −40 % | lecteurs (perf-v3, perf-phases) inchangés | 80 k | à faire (V1) |
| S8 | Documents à corriger | `claude/50-s8-docs` | éclair / bas | AUDIT_SUPER_CERVEAU § 1, FICHE_B1 c. 3, D-110, fiche intensité, noms de modèle hérités | 4 corrections + nettoyage | relecture orchestrateur | 105 k (constaté) | **livré 15/10** (`claude/50-s8-docs`, 86dd817 + 80299de) |

## 2. Lot M — Méthodes métier

| Code | Branche | Niveau / effort | Entrées | Livrables | Porte | Jetons | Attend |
|---|---|---|---|---|---|---|---|
| M1 carte de la partie | `claude/50-m1-carte` | rapide / haut ; relecteur fort | S6 (champs), Q3 (cuts ADV/PN), Échos | lecture de la table → zones et marges ; événement `carte-partie` ; outil hors ligne d'abord | verts corrigés « suspects » ≥ 70 % ; ADV connus détectés | 500 k (+300 k signature nuage) | V4 |
| M2 provenance des appuis | `claude/50-m2-provenance` | rapide / haut ; relecteur fort | b1-ombre des 4 lots, `appuis-liste.js`, `esv-observer.js` bits `fl` | 4 classes ; règles ; T calibrée sur la pose de départ (S6) | rejeu b1-ombre par classe sans perte ; 0 propagation | 400 k + 150 k | V4 |
| M3 méthodes par zone | `claude/50-m3-zones` | fort pour la conception, rapide pour le code | M1, D-098 à D-100, Q9 (marges ADV) | mesures par zone (note) ; puis règles en ombre | erreur médiane ≤ 5 mm voie courante ; ADV/PN mesurés | 300 k mesure + 600 k code + 150 k relecture | V4 puis V6 |
| M4 seconde passe utile | `claude/50-m4-seconde-passe` | rapide / haut ; relecteur fort | B3, `retablirApresRechargement`, D-109, Q1 | (1) règle « rien de neuf » ; (2) mémoire par partie ; (3)(4) prédiction encadrée et double lancement | re-différé < 20 % ; 0 mauvaise pose | 100 k + 400 k + 500 k | (1) V1 ; (2)(3)(4) V4/V6 |
| M5 visite de verts | `claude/50-m5-verts` | rapide / moyen | Q4, maquette | navigation lecture seule ciblée par M1 ; relevé maquette | 0 écriture autre que `SeenByOperator` | 250 k | Q4 |
| M6 liste « à relire » | `claude/50-m6-relire` | rapide / moyen | bilans des 4 lots, S3 | outil `coherence-voisins.cjs` ; puis score et section du panneau | corrigés ≥ 60 % dans ≤ 5 % des cuts | 200 k + 250 k | V1 outil, V6 panneau |

## 3. Lot P — Poser juste

| Code | Branche | Niveau / effort | Entrées | Livrables | Porte | Jetons | Attend |
|---|---|---|---|---|---|---|---|
| P0 mesures (a)(b)(c) | `claude/50-p0-mesures` | rapide / moyen, note relue par fort | S3, Échos 17/18/20, `convention-fit.cjs`, rejeu `Candidate.propose` | trois notes chiffrées ; décision écrite par mesure | décisions prises | 450 k | V2 |
| P1 convention / garde de paire | `claude/50-p1-convention` | rapide / haut ; relecteur fort | P0(b), Q2 | plafond ou domaine 12 mm ; garde portée par le rail repêché | rejeu 4 lots sans régression ; 0 mauvaise pose ; ≥ 50/89 récupérés | 200 k + 150 k | V5 |
| P2 porte de pente | `claude/50-p2-pente` | rapide / haut ; relecteur fort ; ré-épinglage avec Q2 | P0(c) | borne relâchée pour le flanc ou pente sur bande 14-30 mm | idem ; ≥ 40/68 | 350 k + 150 k | V5 |
| P3 dessus seul | `claude/50-p3-dessus-seul` | rapide / haut ; relecteur fort | P4, 66 rails Écho 17, 4 lots | module après `gcv1-shadow`, statut distinct, 3 preuves | ≤ 10 mm ; ombre un lot ; 0 mauvaise pose | 700 k + 200 k | V5 |
| P4 famine de flanc | `claude/50-p4-lod` | rapide / moyen ; banc B chez Mic | S6 (profondeur, budget), banc B | essai budget ×2/×4 pendant la capture ; note | réponse chiffrée | 300 k | V5, banc B |
| P5 estimateur par classe | avec P0/P2 | rapide / moyen | P0(a) | publication par classe ou trait M6 | décision écrite | 150 k | V5 |
| P6 B2 caméra, V4 | `claude/50-p6-b2`, `claude/50-p6-v4` | rapide / haut ; banc B | D-049, D-095, P4 | vue décentrée mesurée ; comparaison V4.6 à la demande | B2 mesuré au banc B avant terrain | 500 k + 150 k | V5 |
| P7 C4 retravaillé | `claude/50-p7-c4` | fort / haut (conception) | E1 (faux verts réels) | règle de qualité fondée sur mesures | note relue par Mic | 150 k | après E1 |

## 4. Lot E — Écho et données

| Code | Branche | Niveau / effort | Entrées | Livrables | Porte | Jetons | Attend |
|---|---|---|---|---|---|---|---|
| E1 relire la liste | `claude/50-e1-liste` | rapide / moyen (étape 1) ; rapide / haut + relecteur (étape 2, Q1) | `esv-observer.js` table, fiches de départ, journaux | étape 1 : instantané compact + `diff-liste.cjs` ; étape 2 : mémoire par partie, événement `ecart-liste`, compteur | correction humaine retrouvée < 1 mm | 300 k + 500 k | V1 ; étape 2 Q1 |
| E2 ombre GCV1 en Écho | `claude/50-e2-ombre-echo` | rapide / haut ; relecteur fort (anti-fuite) | `continuity-observer.js`, `native-session.js`, `native-offline-evaluate.cjs` | bloc `ombreGCV1` + `humanDeltaMm` ; B1 et interpolation ; essai anti-fuite | bloc = rejeu ; ≤ 0,8 s/visite | 500 k + 150 k | V3 |
| E3 raison de la correction | `claude/50-e3-raison` | rapide / moyen | D-112 p.4, panel | 4 pastilles + « bon tel quel », consignées dans la visite | ≥ 80 % étiquetées sans ralentir | 250 k | V3 |
| E4 manifeste DEV/RÉSERVÉ | `claude/50-e4-manifeste` | rapide / moyen | CORPUS_V2 § 5, D-057 | manifeste versionné, outil de revue, essai « 0 fuite » | essai passe | 250 k | V3 |
| E5 jeu d'apprentissage et métriques | `claude/50-e5-metriques` | rapide / moyen | `jeu-apprentissage` (branche maquette), S3, E1 | jeu v1 ; métriques par version | calculées sur Échos + relectures | 350 k | V1 |
| E6 caméra au VALIDATE | avec E2 | rapide / moyen | `adapter-page.js:142`, `native-session.js:215` | vue dans l'état observé | +0,2 Ko ; essai | 120 k | V3 |

## 5. Lot G — Méga cerveau

| Code | Branche | Niveau / effort | Entrées | Livrables | Porte | Jetons | Attend |
|---|---|---|---|---|---|---|---|
| G0 spécification | `claude/50-g0-spec` | fort / haut ; relue par Mic | P0, E1, E2, E5, AUDIT_SUPER_CERVEAU § 7 | fiche de conception GCV2 | relue et acceptée | 300 k | V7 |
| G1 hors ligne puis ombre | `claude/50-g1-gcv2` | rapide / haut ; relecteur fort ; séance distante dédiée | E4, E5, ≥ 500 corrections | GCV2 entraîné sur DEV, jugé sur RÉSERVÉ ; ombre 2 lots | erreur ≤ GCV1 partout ; différés ≤ ; 0 mauvaise pose | 2 M + 300 k | V7 |
| G2 activation réversible | avec G1 | rapide / moyen | G1 | réglage, retour GCV1 | essai | 100 k | V7 |

## 6. Lot F — Fiabilité

| Code | Branche | Niveau / effort | Entrées | Livrables | Porte | Jetons | Attend |
|---|---|---|---|---|---|---|---|
| F1 bus d'événements ESV | `claude/50-f1-bus` | rapide / haut | relevé console (accepté), S6 écoute en ombre | écouteur passif ; usages (étiquette Écho, `newPart`, `loading` en ombre) | concordance ≥ 99 % ; 0 exception en séance | 350 k | V3 |
| F2 campagne de pannes | avec S4 | éclair / bas | S4 | 8 pannes scriptées | verte à chaque paquet | compris | V2 |
| F3 reprise auto bornée | `claude/50-f3-reprise` | rapide / moyen | Q6, D-058 | liste blanche, 3 par lot | essais ; séance terrain | 250 k | Q6 |
| F4 preuve serveur | `claude/50-f4-preuve` | rapide / moyen | § 2.5-2.6 angles morts, D3 | 204 → `serverConfirmed` ; refus en `storage.session` ; Δ validés au F5 | essais ; export relu | 300 k | V3 |
| F5 saut direct après F5 | `claude/50-f5-saut` | rapide / moyen | `goToCut`, `retablirApresRechargement` | branchement + repli | banc puis terrain | 200 k | V3 |

## 7. Budget et rythme

Somme des estimations : ≈ 17 M de jetons au niveau rapide (dont 2,3 M pour G1) et ≈ 2,5 M de relectures fortes, hors orchestration. À raison d'au plus 60 % d'une fenêtre de 5 h par jour de travail, cela se lisse sur six à huit semaines de terrain, le terrain fixant le rythme. Chaque chantier livré met à jour ce tableau (coût constaté, état) et `DECISIONS.md`.

## 8. État des réponses de Mic

| Q | Sujet | Réponse | Chantiers débloqués |
|---|---|---|---|
| 1 | bords monde en mémoire, instantané de liste | **oui** (D-122) | E1 étape 2, M2, M4 (2) |
| 2 | toucher D-044, ré-épingler | **oui** (D-122) | P1, P2 |
| 3 | cuts ADV et PN connus | **oui**, numéros à recevoir (D-122) | M1, M3 |
| 4 | visiter des verts en lecture | **oui** (D-122) | M5 |
| 5 | Écho sur une partie 24 à 27 | **oui** : l'Écho de la partie 24 (tests 19/20) existe, à rapatrier (D-122) | juge B1 ombre |
| 6 | reprise automatique bornée | **oui** (D-122) | F3 |
| 7 | protocole de relecture | **tous les cuts posés** sont relus (D-122) | E1 (sens de « inchangé ») |
| 8 | Orbite et Écho en même temps | Mic demande pourquoi ; réponse : possible dès aujourd'hui avec deux profils Chrome, pas dans un même onglet (D-122) | périmètre |
| 9 | marges ADV (cuts avant pointe, après fin) | **20 cuts** (D-122) | M3 |

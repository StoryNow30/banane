# Consignes des chantiers parallèles 4.8

## Quatrième vague — 28 septembre 2026, 4.8.0 fusionnée, 4.8.5 en préparation

| Chantier | Qui | Fichier | Ce qu'il rend |
|---|---|---|---|
| 9 · Audit de l'orchestration de la suite (4.8.5, 4.9, au-delà) | Astra, auditeur | [`chantier-9-auditeur.md`](chantier-9-auditeur.md) | diagnostic du cycle 4.7 → 4.8 ; feuille de route orchestrée (jalons, chemin critique, voies parallèles, portes go / no-go) ; système de pilotage (boucle, cadence, décisions, tableau de bord, charge de l'opérateur) ; place de l'audit indépendant |
| Suite · Fiche pas à pas | **toi, l'opérateur** | [`operateur-suite.md`](operateur-suite.md) | étiquettes ; relectures p11 et p15 ; 4.8.5 de test à côté de la 4.8.0 ; un lot et sa relecture par cycle |

Plan audité : `PLAN_SUITE.md` (développement), `audit/orchestration-480-485-490-2026-09-28.md`.

## Troisième vague — 28 septembre 2026, 4.8.0 validée

| Chantier | Qui | Fichier | Ce qu'il rend |
|---|---|---|---|
| 8 · Audit qualité globale | Astra, auditeur | [`chantier-8-auditeur.md`](chantier-8-auditeur.md) | constats (problème → preuve → conséquence → amélioration → effort → priorité) sur le code, les performances, les données et l'UX ; feuille de route P1 / P2 / P3 |
| 8 · Session réelle | **toi, l'opérateur** | [`chantier-8-operateur.md`](chantier-8-operateur.md) | une session de 50 min dans ESV : vidéos, mémoire, notes ; exports dans banane-data, vidéos en privé à l'auditeur |

Matériel : banane-data `travail/2026-09-28_kit-audit-480/` (lots
représentatifs, mesures de temps, extraction). L'auditeur commence sans
attendre la session réelle ; ses constats sur la mémoire et le parcours dans
ESV restent supposés tant qu'elle n'est pas arrivée.

## Deuxième vague — 24 septembre 2026, base `155dbec` (4.7.16)

| Chantier | Qui | Fichier | Ce qu'il rend |
|---|---|---|---|
| 5 · Tests §14 et §7 (reprise) | ingénieur, profil tests | [`chantier-5-ingenieur.md`](chantier-5-ingenieur.md) | matrice d'acceptation, tests manquants, contrôle au banc |
| 6 · Relecture 4.7.13 à 4.7.16 | Astra, relecteur | [`chantier-6-relecteur.md`](chantier-6-relecteur.md) | constats classés, conditions de la 4.8.0-rc |
| 7 · Faux sans appui | analyste | [`chantier-7-analyste.md`](chantier-7-analyste.md) | règle candidate : faux arrêtés / justes perdus, par session |

Les trois partent en même temps ; aucun n'attend l'opérateur. L'équipe
principale finit en parallèle l'interface « La ligne » (panneau) et prépare
le rapport de sortie : le chantier 5 ne touche pas au panneau.

Première vague (base `a74c225`, 4.7.8) : chantiers 2, 3 et 4 livrés et
intégrés ; chantier 1 reporté en 4.9 (D-049) ; chantier 5 jamais lancé,
repris ci-dessus.

## Première vague — 23 septembre 2026

Un fichier par personne. Chaque prompt est **autonome** : on le copie en entier
comme premier message, sans rien ajouter. Tous partent du même commit
(`a74c225`), pour que les résultats se comparent.

| Chantier | Qui | Fichier | Ce qu'il rend |
|---|---|---|---|
| 1 · Revenir à un cut | ingénieur | [`chantier-1-ingenieur.md`](chantier-1-ingenieur.md) | primitives de navigation testées, inventaire des chemins ESV, conception du lot de reprise |
| 1 · Revenir à un cut | **toi, l'opérateur** | [`chantier-1-operateur.md`](chantier-1-operateur.md) | quatre fichiers d'inspection d'ESV, remis en privé à l'ingénieur (25 min) |
| 2 · Faux isolés | analyste | [`chantier-2-analyste.md`](chantier-2-analyste.md) | règle de garde candidate : faux arrêtés / justes perdus, par session |
| 3 · Relecture de la 4.7.8 | Astra, relecteur | [`chantier-3-relecteur.md`](chantier-3-relecteur.md) | constats classés, conditions de la décision D2 |
| 4 · Rapport d'acceptation | ingénieur | [`chantier-4-ingenieur.md`](chantier-4-ingenieur.md) | outil C1 à C4 par partie, essai sur la partie 19 |
| 5 · Tests §14 et §7 | ingénieur | [`chantier-5-ingenieur.md`](chantier-5-ingenieur.md) | matrice d'acceptation, tests manquants, contrôle au banc |

## Ordre

Les cinq peuvent partir en même temps. Seul le chantier 1 attend quelque chose
de toi : fais l'inspection quand l'ingénieur a démarré, il commence par ce
qui n'en dépend pas.

## Règles communes (dans chaque prompt)

Chaque personne travaille sur sa propre branche `chantier-48/…`. Aucun push
sur `main`, aucune fusion, aucun tag, aucune release. Les fichiers gelés et le
moteur ne sont pas touchés. L'écartement ne sert qu'en admissibilité ; pas
d'application partielle ; pas de VALIDATE ni de SKIP automatiques. Les cuts
9033 et 9241 restent exclus. Chaque rapport sépare le vérifié du supposé.

## Au retour

Chaque branche revient au fil principal, qui la relit contre le cahier avant
toute intégration. Rien n'entre dans l'extension sans ta décision.

## P2 : un seul opérateur

ESV n'ouvre pas une même partie dans deux projets : le plancher P2 ne peut
être mesuré qu'avec **un opérateur** (F2 : 30 cuts reposés en aveugle quelques
jours après). L'écart entre opérateurs reste non mesuré et sera déclaré comme
limite dans le rapport de la 4.8.

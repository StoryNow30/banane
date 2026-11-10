# Cadrage révisé : étude « coupes non résolues » (10/11, D-321)

Sources : F/ = /home/user/banane/fiches/ ; CH/ = /home/user/banane/chantiers/ ; DEC = /home/user/banane/DECISIONS.md ; BD/ = /home/user/banane-data/. Relu pour cette révision : CH/CH-033.rapport.md, CH/CH-034.rapport.md, CH/CH-053/M-rapport.md, CH/CH-056.md, CH/CH-057/rapport.md, CH/CH-079/rapport.md, rapport CH-042 (branche origin/chantier/CH-042), DEC D-270, D-275, D-285, D-287, D-288, D-292, D-308, D-321, note et table du 10/11. Le reste vient des sept lectures et des deux critiques.

**Ce que la révision change.** Les deux critiques sont fondées sur l'essentiel (vérifié dans les fichiers). Les angles 1 et 2 du premier cadrage étaient déjà essayés (CH-033, CH-042, CH-034) ; les angles 3 et 4 sont retirés ; les angles 5 et 6 sont réduits à ce que les données contiennent. Le banc ne peut prouver aucun budget : il trie des pistes pour l'ombre, rien de plus.

## 1. Le problème en chiffres (ÉTABLI, populations non comparables)

| Population | Non résolus | Source |
|---|---|---|
| 40 lots, 07-19/10, avant L1 | 1 367 / 6 878 (19,9 %) ; sans appui 879 | F/DIAG_DIFFERES § 2-3 |
| 8 lots du 26/10 | 79 / 1 344 (5,9 %) ; ambiguïté 15 | F/DIFFERES_CAUSES_2026-10-28 |
| Partie 20 du 28/10 | 168 / 889 (18,9 %) ; 123 sans appui | BD/outils/analyse-lots/CH-015/RAPPORT § 3 |
| 9 parties des 04 et 05/11 | 82 différés jugés, dont 67 corrigés de plus de 10 mm | CH/CH-057/rapport § 2 |

- **Mauvaises voies d'Ariane (> 50 mm).** 9 couples du 26 au 29/10 : 22 fautes sur 624 jugés, dont 21 sur la seule partie 20, en 4 épisodes (CH-033 § 1, § 4). 05/11 : 0 sur 229 jugés (D-285). 06/11 : 7 sur 108 jugés, dont une série de 5 au milieu de différés (D-292). 08/11 : 3 à 156-174 mm, écartement posé 1 458 à 1 463 mm (CH-079). Après le retrait de la garde (D-288) : 4 poses fausses en PN/ADV, dont 2 à 60 mm (CH-057 § 3).
- **10/11, à part.** 61 coupes à pose finale, 21 au-delà de 50 mm, dont 15 entre 811 et 828, série interrompue (813 SKIP de l'opérateur, 815 sans décision, 817 à 4,0 mm ; compté dans BD/collections/2026-11-10_v5_echo-partie1/derive/table.csv). Aucun lot, 508 lignes « sans-journal », auteur non établi : ce ne sont pas des mauvaises voies d'Ariane établies.
- **Mécanisme.** Les fautes sont au fond de zones invalides longues ; une chaîne décalée est continue avec elle-même ; il n'y existe aucune référence indépendante de la chaîne (CH-033 § 3, PROBABLE). Le vrai rail est dans le nuage capturé pour 42 rails sur 42, hors de la fenêtre de ±80 mm (CH-034 § 1, ÉTABLI, partie 20 seule).
- **Plafond.** Une pose à 10 mm est atteignable pour 64 corrections sur 99 à l'usage lot (CH-057 § 1) ; après B1-écart, 31 différés sur 45 (CH-053-M § 3).
- **Coût.** Un différé coûte 1,3 s de plus qu'un posé juste, 4,1 s en borne haute (F/REGLES_METIER l. 164 ; deux Échos, durées de visite). Résoudre 79 différés vaut donc 2 à 5 minutes (calcul sur ces chiffres). Une pose verte fausse reste la seule erreur dangereuse (D-220, D-223). Priorité de l'étude : retirer des poses fausses, puis reposer.

## 2. Déjà essayé (lignes corrigées ou ajoutées en gras)

| Piste | Résultat mesuré | Statut | Source |
|---|---|---|---|
| **Tracé en positions absolues par les cuts sains de la liste (H10-H13)** | évaluable pour 1 faute sur 13 ; faux de 1 à 2 m dès 75 cuts | écarté | CH-033 § 2-3 |
| **Continuité locale (H14) ; lignes saines à 6 cuts** | rappel 4/9, précision 4/99 ; couverture 15 %, 1 cut > 10 mm couvert | écarté | CH-033 § 2 ; CH-042 § 2 |
| **Huit pistes de pose, 22 lots, 1 575 jugés** | aucune ne gagne hors échantillon | écarté (D-275) | CH-042 § 3 |
| **Recherche large, mode « différer »** | examen : 7 fautes sur 9 différées, 0 pose juste déplacée sur 439 ; lot du 23/10 : 10 fautes sur 10 retirées pour 3,3 % de cuts sans pose en plus ; lot Aurore : 20 poses différées sur 219, dont 4 justes | tient l'examen ; éteinte (D-275) | CH-034 § 1, § 7 |
| **Recherche large, mode « choisir »** | 5 poses justes remplacées à plus de 50 mm | rejeté | CH-034 § 1 |
| **Différer puis deuxième passe (banc, partie 20)** | 19 fautes sur 21 sans levier, 2 avec ; 12 reposées à 1-5 mm | réglage seulement | CH-034 § 1 |
| **B1-écart (liste puis écartement)** | 9 parties : 44 justes sur 67, 5 faux de 10,8 à 31 mm, 0 sur 49 à plus de 50 mm (borne 7 %) ; examen du 05/11 : 14 sur 22, 0 sur 14 | ombre ; attend deux lots jugés | CH-057 § 2 ; CH-053-M § 4 |
| **Garde « après un différé » (R3)** | 25 retenus ; hors PN/ADV 11 justes sur 11 ; en PN/ADV 4 fausses évitées ; 06/11 : 3 fautes sur 7 | ombre (D-288) | CH-056 § 2 ; D-292 |
| **Garde de voie ; serrage (D-308)** | 46 pauses sur 4 413 posés ; 3 positifs ; n'attrape aucune des 7 du 06/11 ; serrage : pire en ADV | ombre | CH-079 |
| **Deuxième passe en écriture** | lot Aurore : 6 écrites, 6 justes (le « 3 sur 6 » était un artefact) ; 04-05/11 : 16 écrites, 7 jugées, 4 justes, 3 entre 10 et 50 mm, 0 au-delà ; 31/10 : 2 PROBABLE fausses, non jugées | livrée, 10 par lot | CH-034 § 3 ; CH-057 § 4 |
| Garde A | sépare les poses de la partie 0 sur laquelle elle est réglée ; aucune variante de seuil ne fait mieux | livrée | F/GARDE_PASSE_A § 4 bis |
| Contrat éteint ; seuils 5/3 ; choix par la perte ; validation sous tau ; balayage ; pool élargi | 13 sur 14 ; 37 sur 41 ; 28 sur 33 à plus de 50 mm ; 1 mauvaise voie sur 27 ; 90 sur 226 | écartés | F/DIAG § 5 ; F/DIFFERES_TROIS_TAS ; CH-053-M § 3 ; F/G1_MEMOIRE § 1 |
| Mémoire, voie prédite, H6, R1-R3, grappe | inchangé depuis le premier cadrage ; R3 seule : 13 fautes sur 21 au réglage | ombre ou écarté | fiches citées au premier cadrage |

## 3. Règles du jeu

- Budgets : poses validées à plus de 50 mm ≤ 3 % des posés ; mauvaise voie ≤ 1 % ; gain d'acceptation apparié entre versions (D-223, D-270). Différer est normal quand la voie n'est pas atteignable (D-270 point 3) ; « sans diminuer sa prod » (D-288) ; « ne rien changer et attendre un ou deux lots » (D-292).
- Jamais SKIP ; jamais valider un cut sans décision du moteur ni du lot (D-264) ; passe à 10 cuts par lot (D-259) ; fichiers de décision protégés.
- L'étude est demandée par l'opérateur (D-321) : hors ligne puis ombre, aucun changement sans accord écrit. **D-275 fixe la condition pour rouvrir un chantier de gain : un Écho complet sur 4 à 5 lots avec appareils de voie (environ 600 poses jugées), sur ordre de l'opérateur.** En face : 312 jugés du 04 au 08/11, choisis par l'opérateur (CH-079). La condition n'est pas remplie.
- Manifeste : toute partie reçue après sa date est réservée ; la prochaine partie avec Écho sert d'examen (D-287). Les parties des 06, 08 et 10/11 ont déjà été lues cut par cut (D-292, CH-079, note du 10/11) : elles ne sont plus un examen vierge.

## 4. Ce que le banc peut conclure

- **Portée.** Au mieux « candidat pour l'ombre ». Zéro faute prouve 5 % avec 73 poses, 3 % avec 125, 1 % avec 381 (formule de Wilson de tools/juger.cjs ; le dernier chiffre est un calcul, écrit dans aucune fiche). Les fautes viennent en séries : compter par série autant que par cut.
- **Table de cas.** Deux tables : différés et posés d'un lot (journal et Écho) ; relecture d'un Écho seul (10/11), jamais mêlées. Une seule définition : mauvaise voie = plus de 50 mm, pire rail, 3D (juger.cjs et juger-lot.cjs disent 100 mm en latéral : rejuger). Chaque mesure donnée avec et sans les lignes « visité sans action » ; les validations sans mouvement de moins de 1,5 s écartées (D-285). Le juge des « posés faux » n'existe pas (juger.cjs ne rejuge pas un posé de base) : à écrire.
- **Sur disque** (858 Mo libres) : 12 collections sur 114 ; jointures du 04/11 (64 différés avec pose finale, dont 18 consécutifs en partie 10) ; collection du 05/11 ; 9 cas du 08/11 ; 10/11. Hors disque : 06/11, partie 20, lots du 26/10.
- **Scellement.** Liste fermée des règles et variantes écrite avant tout calcul ; une ouverture d'examen par règle ; empreinte de `banc-differes predire` déposée avant l'Écho ; pas de réglage sur les 12 vérités de la garde ; l'outil du banc lit le manifeste et refuse par défaut.

## 5. Angles retenus (détail dans le champ angles)

1. **Différer par le nuage, puis seconde chance** : la règle figée de la recherche large (mode différer) jugée sur les fautes d'après le 01/11, face aux trois gardes en ombre.
2. **B1-écart, base à battre** : inventaire puis jugement de l'ombre sur les lots d'après le 05/11.
3. **Deuxième passe** : rejugement de la garde A et des écritures réelles depuis le 26/10.
4. **Couverture de la liste autour des fautes hors partie 20** : une mesure, sans module.

Retirés : voie longue (emplois a, b, c : H10-H14, B1 du premier passage, R2) ; carte des têtes (c'est CH-034, et son choix reposait sur la voie longue) ; sous-tranches (au plus 6 cuts gagnables sur 79 ; en ADV les deux concurrents sont de vrais rails) ; points hors découpe (pertes au filtre minimes, CH-053 C-rapport) et recapture (déjà livrée, D-283) ; conjonction d'ombres (effectif nul sur le 04/11).

## 6. Questions à l'opérateur, avant tout calcul

1. Les parties des 06, 08 et 10/11 passent-elles en apprentissage (alors l'étude n'a aucun examen, tout est PROBABLE au mieux) ou restent-elles fermées ?
2. D-321 vaut-il ordre de rouvrir la recherche large hors ligne, la condition de D-275 n'étant pas remplie ?
3. Une séance Écho tirée au sort (environ 150 posés par partie, D-285 point 4) et un Écho des différés sur deux lots sont-ils possibles ? Sans eux, aucun taux n'est présentable.

## Objections non levées

- Statut des parties d'après le 05/11 et lecture de D-321 face à D-275 : décision de l'opérateur, non tranchée ici.
- Nombre de différés jugés et d'événements B1-écart posables au 06/11 et au 08/11 : non dit. Séance tirée au sort : qu'elle ait eu lieu est non dit. Suivi demandé par D-292 (garde et grappe jugées sur les lots suivants) : non dit.
- Projet réel derrière les étiquettes de rejeu du manifeste : non établi ; l'indépendance vis-à-vis des témoins n'est pas vérifiable.
- Instantané de la liste : un seul par partie, le dernier ; son heure contre celle de la décision rejouée n'est pas contrôlée (contenu non ouvert, SUPPOSÉ).
- Ancrage : une pose écrite est jugée par l'acceptation de l'opérateur, une pose en ombre par sa pose libre ; les deux ne se comparent pas à 10 mm.
- D-275 dit que rien de CH-034 n'est fusionné ; src/recherche-large.js et son réglage éteint (src/settings.js l. 303) sont pourtant au tronc : origine non dite.
- Désaccords du premier cadrage inchangés : garde de paire (fiches opposées) ; provenance des appuis ; mémoire des différés « active » dans une fiche, `actif:false` dans le code ; rejeu du 10/11 ÉTABLI ou PROBABLE ; auteur des poses de départ du 10/11.
- Faisabilité sur un disque à 858 Mo libres des corpus à faire rendre : non établie.
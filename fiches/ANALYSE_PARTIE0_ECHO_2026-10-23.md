# Partie 0 du 23/10 : lots 1 et 2 jugés contre l'Écho de l'opérateur (contre-vérifié)

Sources (banane-data) : journal du lot 1 dans l'export du cache (`2026-10-23_cache-tests-18-19_export-18-volumes`), lot 2 (`2026-10-23_v4.9.5.19_partie-0-lot-2`), Écho (`2026-10-23_v4.9.5.19_echo-partie-0`), instantanés de la liste d'ESV (5, de 10 h 03 à 14 h 51). Vérité : la dernière validation de l'opérateur dans l'Écho ; un cut vu au moins 0,8 s sans aucun déplacement compte comme juste (règle « visité = bon »). Outil : `tools/jointure-echo-orbite.cjs` (tronc), recoupé par la liste d'ESV (position serveur après le lot contre pose finale de l'opérateur, en coordonnées monde) : écart maximal entre les deux mesures 0,8 mm sur 109 cuts.

**Contre-vérification indépendante** (un agent qui n'avait pas ces conclusions, scripts à lui, données brutes) : mêmes comptes de lots, mêmes cuts à plus de 20 mm, même répartition de la passe en ombre à un cut près sur la limite de 5 mm, même redémarrage du service worker, même cause pour la partie 29. Ses apports sont intégrés ci-dessous (marqués « contre-vérification »).

## 1. Écho : complet

| Session | Heures de Paris | Visites | Cuts distincts | Trous |
|---|---|---|---|---|
| 1 | 13 h 49 à 14 h 41 | 110 | 87 | 0 |
| 2 | 14 h 51 à 16 h 03 | 977 | 911 | 0 |

Chaque segment est un instantané complet ; le dernier export de chaque session contient toutes les visites des segments précédents. La session 2 est une revue de presque toute la partie 0 : l'opérateur a visité les 444 cuts posés par le lot 1.

## 2. Ce que chaque lot a fait

| | Lot 1 (10 h 03, clic « comme avant ») | Lot 2 (14 h 41, « Tout recentré ») |
|---|---|---|
| Cuts traités | 535 | 89 (les différés du lot 1, sauf 2) |
| Posés | 444 (83 %) | 11 (12 %) |
| Différés | 91 | 78 |
| Cycle médian | 2,32 s (533 cycles) | 3,53 s (89 cycles, surtout des différés) |

Référence de vitesse de la 4.9.0.8 : 2,44 s. Le lot 1 la tient.

## 3. Qualité des poses écrites (vérité Écho)

| Écart (pire rail, 3D) | Lot 1 : 286 jugés sur 444 | Lot 2 : 11 jugés sur 11 |
|---|---|---|
| ≤ 5 mm (dont « vus sans bouger ») | 227 (188) | 2 (0) |
| 5 à 10 mm | 41 | 4 |
| 10 à 20 mm | 12 | 2 |
| 20 à 50 mm | 2 | 0 |
| > 50 mm | **4 (1,4 %)** | **3 (27 %)** |

Les 158 cuts posés non jugés ont été vus moins de 0,8 s sans validation. Sur les seules validations de l'opérateur (98 cuts du lot 1), les mêmes 6 cuts dépassent 20 mm.

Cut 282 (contre-vérification) : L'opérateur l'a d'abord validé à 4,5 mm de la pose d'Ariane, puis l'a déplacé d'environ 206 mm et revalidé 5 s plus tard ; la règle « dernière validation » retient 209,5 mm. C'est la seule des 7 poses à plus de 50 mm dont la vérité se contredit.

Par étape de décision (deux lots) :

| Étape | Jugés | > 20 mm | > 50 mm |
|---|---|---|---|
| Première passe du moteur | 208 | 2 | 2 (199 : 153 mm ; 282 : 210 mm) |
| GCV2 dans le lot (cut d'abord différé, repris par L1) | 42 | 7 | **5 (12 %)** : 201, 1134, 1373 (lot 1), 1325, 1328 (lot 2) |
| Fenêtre, choix, croisement | 47 | 0 | 0 |

Budget D-223 (pose > 50 mm ≤ 3 %) : tenu par la première passe ; **dépassé par la GCV2 dans le lot sur cette partie** (5 sur 42). Signal commun à plusieurs de ces poses : Ariane a déplacé les deux rails de quantités très différentes (écartement changé de 50 à 70 mm), alors que la correction de l'opérateur déplace les deux rails ensemble d'environ 200 mm.

Les différés : la pose de départ d'ESV était fausse d'environ 200 mm (médiane 216 mm, vers la gauche ou vers la droite) sur ces cuts ; l'opérateur les a tous corrigés.

## 4. La deuxième passe du lot 1 aurait bien posé, mais elle n'a jamais écrit

- Décisions en ombre : 90, dont 59 « poserait ». Jugées contre la pose finale de l'opérateur : **35 à 36 à ≤ 5 mm (un cut est sur la limite), 21 à 22 à 5–10 mm, 1 à 11,6 mm, 1 à 150 mm** (cut 1135, en zone d'ADV). Les 31 « rien » : l'opérateur a déplacé le rail de plus de 50 mm dans les 30 cas jugeables. Sur 282, 1325 et 1328, que le lot 2 a posés à environ 200 mm, la passe du lot 1 était à 6,4, 5,4 et 2,7 mm.
- **Pourquoi rien n'a été écrit (établi)** : la dernière décision date de 10 h 35 min 14 s ; le service worker d'Ariane a redémarré à 10 h 35 min 46 s (nouvelle horloge de mesure, point « restored »). Contre-vérification : un second redémarrage a eu lieu à 14 h 26 min 18 s, pendant la première session Écho de l'opérateur (fermeture récupérée de l'Écho au même instant). La passe vit en mémoire : elle a disparu au redémarrage, sans événement de fin, et la relecture qui devait suivre n'a pas démarré. **Cause du redémarrage : probable**, arrêt du service worker par Chrome (environ 30 s sans activité d'extension pendant le second tour de la passe), non prouvée.
- Lot 2 : la passe tournait encore à l'export (24 décisions, 2 « poserait », toutes deux à ≤ 5 mm) ; la liste d'ESV de 14 h 51 montre qu'elle n'a rien écrit.

## 5. Le déplacement de la vue ne marche toujours pas, avec les deux réglages de clic

- Lot 1 : 29 déplacements de vue demandés (64 envois de molette de 1 à 4 crans), tous « caméra immobile ». Lot 2 (« Tout recentré ») : 2 demandés (7 envois), tous « caméra immobile ». Le réglage du clic ne change rien à la molette.
- L'opérateur, dans les deux Échos : 1 597 gestes relevés, **aucun zoom** (taille du pixel toujours 0,444 mm avant et après chaque geste). L'Écho n'écoute pas la molette, donc l'absence de molette dans le relevé ne prouve rien ; l'échelle constante est l'indice fort. Ses glisser au bouton droit déplacent la caméra (130 sur 240).
- **Probable** : dans cette configuration d'ESV, la molette ne zoome pas (réglage) ou ignore les événements d'Ariane ; on ne sait pas lequel. Piste pour le chantier 12 : glisser au bouton droit au lieu de la molette, à vérifier sur la maquette puis sur ESV.

## 6. Corrections de l'analyse du cache du 23/10

- **Partie 29** : « aucun cut traité » était faux. Le lot de la partie 29 (8 h 33) a été vidé à la main à 9 h 05, avant l'export, sans export confirmé (84 nuages, 15 839 événements). Il n'en reste que la capture du dernier cut.
- **Les 70 « sans appui »** : la GCV2 du lot 1 a bien repris des différés (40 cuts posés depuis l'étape « différé »), il en est resté 70 sans appui. Le lot 2 en a repris 9 de plus.

## 7. Défauts de données relevés (contre-vérification), sans effet sur les chiffres ci-dessus

- Écho : 58 écritures serveur rangées sous le record du cut voisin (57 « vu », 1 validation : ligne 1127 sous le record 1126) ; la jointure les rattache par numéro de ligne.
- Fiches de départ prises pendant l'Écho : elles portent l'identifiant du dernier lot (celui de la partie 5), pas un identifiant propre.

## 8. Ce qui n'est pas établi

- Le réglage « Tout recentré » ne peut pas être jugé ici : le lot 2 n'a traité que les restes difficiles du lot 1 ; la comparaison n'est pas à cuts égaux en difficulté.
- 158 poses du lot 1 n'ont pas de vérité (visites trop courtes).
- Une seule partie : les taux de la GCV2 dans le lot (5 sur 42) sont à confirmer sur d'autres parties.

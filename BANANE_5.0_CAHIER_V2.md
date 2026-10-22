# ARIANE 5.0 — CAHIER DES CHARGES, VERSION 2

Version 2 du 22 octobre 2026. Elle remplace l'objectif et l'ordre de `BANANE_5.0_CAHIER.md` (version 1 du 15 octobre, gardée comme historique) ; les règles non négociables de la version 1 tiennent toujours. Validée par Mic le 22/10/2026 : « je valide tout, à condition qu'on ne perde rien de nos perf sur GCV2 » (D-239). Aucune donnée de partie ni identifiant de projet.

---

## 1. Ce que la 5.0 doit être

Pour Mic, le cœur de la 5.0 est **les résultats de la GCV2 et l'autonomie** : Ariane pose seule, et juste, la grande majorité des cuts, y compris ceux que la GCV1 laissait en différé, avec peu d'erreurs graves et peu de reprises de la part de Mic. Les trois attentes de D-112 (poser juste plus souvent, traiter les zones difficiles, apprendre des corrections) en sont les moyens.

La direction a changé en cours de route (D-217 « différés −90 % », puis D-223 budgets d'erreurs) : plus d'autonomie, GCV2 livrée active sous le nom L1 plutôt qu'en ombre, deuxième passe qui écrit. La version 1 décrivait une 5.0 prudente en ombre avant actif ; elle n'est plus la référence sur ces points.

## 2. Règle première : ne rien perdre de la GCV2

Condition de Mic pour toute la suite. Chaque modification qui touche la décision d'un cut (GCV1, GCV2, leviers, garde de voie, hauteur apprise, contre-expertise des verts de chaîne, décodage global, provenance des appuis, deuxième passe) passe la **garde de non-régression GCV2** avant tout paquet.

1. **Population de référence** : les 9 lots de réglage et la partie 3:0 (en apprentissage, D-224), plus les parties ajoutées à l'apprentissage par décision écrite. Les parties d'examen (3:1, 3:5) ne servent jamais à régler.
2. **Critères stricts**, calculés sur les mêmes parties, par le même outil, contre la base gelée du § 3 :
   - cuts laissés sans pose : pas plus qu'en base, par groupe ;
   - poses à 10 mm ou moins : nombre et proportion au moins égaux à la base ;
   - poses à plus de 20 mm : 0 ; mauvaise voie : 0 ; verts changés : 0 ; pose sans preuve du nuage : 0 ;
   - aucun cut posé à 10 mm ou moins ne passe à plus de 20 mm.
3. **Liste de tous les cuts dont l'erreur augmente de plus de 2 mm**, montrée à Mic avec le paquet.
4. **Un recul d'un critère n'est jamais silencieux** : il demande une décision écrite de Mic avec le compromis chiffré (exemple connu : le cut 797 de la 3:0 passe de 8 à 10 mm en test 18).
5. **L'outil de jugement et la base sont versés au dépôt.** Aujourd'hui le juge est hors dépôt ; sans lui la garde n'est pas reproductible. La base ne contient que des comptes, des millimètres et des numéros de cuts, scellée par SHA-256.

## 3. Base gelée (test 18, banc, chaîne livrée avec la deuxième passe)

Mesures de banc sur des parties qui ont servi à régler : un plancher à ne pas perdre, pas une preuve de généralisation.

| Groupe | Cuts laissés sans pose (test 15 → 16 → 18) | Poses jugées | À 10 mm ou moins | À plus de 20 mm | Mauvaise voie | Verts changés |
|---|---|---|---|---|---|---|
| 9 lots de réglage | 57 → 25 → 12 | 534 | 518 | 0 | 0 | 0 |
| Partie 3:0 | 18 → 15 → 8 | 29 | 23 (dont 14 à 5 mm ou moins) | 0 | 0 | 0 |

Test 16, pour mémoire : 525 poses jugées, 407 à 5 mm ou moins, 510 à 10 mm ou moins.

## 4. Tableau de bord 5.0, le même à chaque version

1. Part de cuts laissés sans pose.
2. Précision des poses de la GCV2 : médiane, part à 5 et 10 mm, pires cas.
3. Budgets D-223 : mauvaise voie validée ≤ 1 %, pose à plus de 50 mm ≤ 3 %, pose sans preuve du nuage 0, avec leurs intervalles.
4. Autonomie : part de cuts d'une partie sans retouche de Mic, et temps net gagné.

Chaque chiffre dit sa population. Un chiffre de réglage et un chiffre d'examen ne se mélangent pas. Première mesure d'autonomie : les Échos de la 3:1 et de la 3:5.

## 5. Cibles

- Cuts laissés sans pose : 5 % ou moins hors échantillon.
- Mauvaise voie : 1 % ou moins ; pose à plus de 50 mm : 3 % ou moins ; pose sans preuve du nuage : 0.
- 90 % des poses à 10 mm ou moins. Aucune cible sous 5 mm avant une mesure de pointage indépendante.
- Autonomie : seuil fixé après la mesure de base.
- Tout ce qui précède se lit sur parties d'examen avec intervalles ; sur parties de réglage, c'est un plancher (§ 2).

## 6. Chantiers retenus, dans l'ordre

1. **Garde de non-régression GCV2** : verser le juge et la base ; commande unique de rejeu et comparaison. Prérequis des suivants.
2. **Tableau de bord** et mesure de base d'autonomie (3:1, 3:5, retours de la test 18, analyse de la partie 2).
3. **Choix de voie en ADV** : diagnostic « oracle » (la bonne paire est-elle parmi les candidats ?), puis décodage global de la voie avec abstention si le diagnostic le justifie. Sous la garde.
4. **Contre-expertise des verts de chaîne** et **provenance des appuis (M2)**. Sous la garde.
5. **Maquette ESV dans `verify`** et campagne de pannes (S4, F2) ; preuve serveur (F4) ; vérifier pourquoi `serverConfirmed` est faux sur toutes les poses du lot de la partie 2.
6. **Deuxième passe** : cible hors de la vue (touche `engine.js`, accord de Mic pour ré-épingler).
7. **Précision sous 5 mm** : 60 cuts repointés de façon indépendante, hauteur apprise en comparaison. Sous la garde.
8. **Livraison** : fusion des lignées, base de décisions unique, cahier signé, essai sur Edge, validation de l'ancien panneau remplacé, étiquette et publication par Mic.

**Mis au second plan** (repris seulement s'ils servent les cibles) : saut direct après F5, reprise automatique bornée, caméra au VALIDATE, ombre GCV1 pendant l'Écho, rail « dessus seul », B2 caméra.

## 7. Portes de version

- Une version de test : garde de non-régression verte, `node tools/verify.cjs` à 0 échec sans essai annulé, consigne terrain, retour de terrain analysé avant la suivante.
- Une nouveauté à la fois quand le risque d'écriture augmente (règle de la version 1, § 6, rétablie pour tout ce qui écrit dans ESV).
- **5.0 stable** : cibles du § 5 tenues sur parties d'examen avec intervalles, filet de sécurité du chantier 5 en place, fusion et publication par Mic.

## 8. Décisions qui restent à Mic

Seuil d'autonomie après la mesure de base ; contre-expertise des verts de chaîne (coupée) ; ré-épinglage de `engine.js` pour la deuxième passe ; projet de rattachement de la partie 2 ; fusion dans `main`, étiquette, publication.

## 9. Hors périmètre

Multi-sessions, suivi mobile, écriture directe sur le serveur d'ESV, modification de `src/engine.js` hors correctif avéré avec ré-épinglage accordé. Orbite et Écho en parallèle : abandonné pour la 5.0 (un seul état d'onglet dans le service worker).

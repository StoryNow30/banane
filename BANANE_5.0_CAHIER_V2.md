# ARIANE 5.0 — CAHIER DES CHARGES, VERSION 2

Version 2 du 22 octobre 2026, complétée le 23/10 (retour de terrain, SKIP, vitesse). Elle remplace l'objectif et l'ordre de `BANANE_5.0_CAHIER.md` (version 1 du 15 octobre, gardée comme historique) ; les règles non négociables de la version 1 tiennent toujours. Validée par Mic le 22/10/2026 : « je valide tout, à condition qu'on ne perde rien de nos perf sur GCV2 » (D-239). Aucune donnée de partie ni identifiant de projet.

---

## 1. Ce que la 5.0 doit être

Pour Mic, le cœur de la 5.0 est **les résultats de la GCV2 et l'autonomie** : Ariane pose seule, et juste, la grande majorité des cuts, y compris ceux que la GCV1 laissait en différé, avec peu d'erreurs graves et peu de reprises de la part de Mic. Les trois attentes de D-112 (poser juste plus souvent, traiter les zones difficiles, apprendre des corrections) en sont les moyens.

**Retour de terrain du 23/10/2026 (Mic, sans export)** : les tests 18 et 19 ont tourné sur une trentaine de parties ; résultats « extrêmement satisfaisants », la plupart du temps très peu de différés. Un certain nombre de ceux qui restent sont des cuts à SKIP. Mesure qualitative rapportée par Mic : elle reste à chiffrer (tableau de bord, § 4) ; la preuve hors échantillon du § 5 reste exigée.

La direction a changé en cours de route (D-217 « différés −90 % », puis D-223 budgets d'erreurs) : plus d'autonomie, GCV2 livrée active sous le nom L1 plutôt qu'en ombre, deuxième passe qui écrit. La version 1 décrivait une 5.0 prudente en ombre avant actif ; elle n'est plus la référence sur ces points.

## 2. Règle première : ne rien perdre de la GCV2

Condition de Mic pour toute la suite. Chaque modification qui touche la décision d'un cut (GCV1, GCV2, leviers, garde de voie, hauteur apprise, contre-expertise des verts de chaîne, décodage global, provenance des appuis, deuxième passe) passe la **garde de non-régression GCV2** avant tout paquet.

1. **Population de référence** : les 9 lots de réglage et la partie 3:0 (en apprentissage, D-224), plus les parties ajoutées à l'apprentissage par décision écrite. Les parties d'examen (3:1, 3:5) ne servent jamais à régler.
2. **Critères stricts**, calculés sur les mêmes parties, par le même outil, contre la base gelée du § 3 :
   - cuts laissés sans pose : pas plus qu'en base, par groupe ;
   - poses à 10 mm ou moins : nombre et proportion au moins égaux à la base ;
   - poses à plus de 20 mm : 0 ; mauvaise voie : 0 ; verts changés : 0 ; pose sans preuve du nuage : 0 ;
   - aucun cut posé à 10 mm ou moins ne passe à plus de 20 mm.
   - **temps par cut en lot et temps par cut de relecture : pas plus lents qu'en base, ou écart écrit (critère 6, permanent, D-242).** La base de vitesse est prise au premier rejeu de la garde (test 19) puis resserrée à chaque gain : la vitesse ne se perd jamais en améliorant le moteur.
3. **Liste de tous les cuts dont l'erreur augmente de plus de 2 mm, et de tous les cuts qui perdent leur pose**, montrée à Mic avec le paquet. Un total inchangé peut cacher un cut perdu et un cut gagné : la liste par cut est la vraie garde.
3 bis. **Parité extension / banc** : quand `background.js` ou un module du service worker change, la parité (`tools/parite-l1se-sw.cjs`, `--passe` si la deuxième passe est touchée) est rejouée sur au moins un lot, 0 écart ; la garde du banc seule ne prouve pas le vrai code.
4. **Un recul d'un critère n'est jamais silencieux** : il demande une décision écrite de Mic avec le compromis chiffré (exemple connu : le cut 797 de la 3:0 passe de 8 à 10 mm en test 18).
5. **L'outil de jugement et la base sont versés au dépôt.** Aujourd'hui le juge est hors dépôt ; sans lui la garde n'est pas reproductible. La base ne contient que des comptes, des millimètres et des numéros de cuts, scellée par SHA-256.

## 3. Base gelée (test 18, banc, chaîne livrée avec la deuxième passe)

Mesures de banc sur des parties qui ont servi à régler : un plancher à ne pas perdre, pas une preuve de généralisation.

| Groupe | Cuts laissés sans pose (test 15 → 16 → 18) | Poses jugées | À 10 mm ou moins | À plus de 20 mm | Mauvaise voie | Verts changés |
|---|---|---|---|---|---|---|
| 9 lots de réglage | 57 → 25 → 12 | 534 | 518 | 0 | 0 | 0 |
| Partie 3:0 | 18 → 15 → 8 | 29 | 23 (dont 14 à 5 mm ou moins) | 0 | 0 | 0 |

Test 16, pour mémoire : 525 poses jugées, 407 à 5 mm ou moins, 510 à 10 mm ou moins.

**Auto-audit (22/10)** : ces chiffres de la test 18 viennent du rapport de l'intégrateur ; l'orchestrateur a vérifié le paquet, le verify et les parités, pas recalculé ce tableau. Il devient la base gelée seulement une fois recalculé par le juge versé au dépôt (chantier 1), scellé par SHA-256 avec ses fichiers de vérité (comptes, millimètres, numéros de cuts, rien d'autre).

## 4. Tableau de bord 5.0, le même à chaque version

1. Part de cuts laissés sans pose.
2. Précision des poses de la GCV2 : médiane, part à 5 et 10 mm, pires cas.
3. Budgets D-223 : mauvaise voie validée ≤ 1 %, pose à plus de 50 mm ≤ 3 %, pose sans preuve du nuage 0, avec leurs intervalles.
4. Autonomie : part de cuts d'une partie sans retouche de Mic, et temps net gagné.

Chaque chiffre dit sa population. Un chiffre de réglage et un chiffre d'examen ne se mélangent pas. Première mesure d'autonomie : les Échos de la 3:1 et de la 3:5.

**Définition de l'autonomie (point 4), pour qu'elle soit calculable** : sur une partie où Mic a fait l'Écho complet, un cut est « sans retouche » si l'Écho ne le déplace pas de plus de 10 mm et ne change pas sa voie. Autonomie = cuts sans retouche / cuts du lot (nuage vide compris, comptés à part). Instrument : `tools/jointure-echo-orbite.cjs`. Le « temps net gagné » se mesure par le temps d'Écho par cut relu (déjà dans les exports) multiplié par les cuts que Mic n'a plus à reprendre, moins le temps passé sur les verts faux ; c'est une estimation, dite comme telle.

**Règle des parties d'examen** : une partie d'examen n'est ouverte qu'une fois, modèle et seuils gelés avant ; après l'examen elle passe en apprentissage par décision écrite (comme la 3:0, D-224) et une nouvelle partie neuve est nommée en réserve. Les résultats du premier examen ne servent pas à améliorer le second sous la même étiquette « hors apprentissage ».

## 5. Cibles

- Cuts laissés sans pose : 5 % ou moins hors échantillon.
- Mauvaise voie : 1 % ou moins ; pose à plus de 50 mm : 3 % ou moins ; pose sans preuve du nuage : 0.
- 90 % des poses à 10 mm ou moins. Aucune cible sous 5 mm avant une mesure de pointage indépendante.
- Autonomie : seuil fixé après la mesure de base.
- Tout ce qui précède se lit sur parties d'examen avec intervalles ; sur parties de réglage, c'est un plancher (§ 2).

## 6. Chantiers retenus, dans l'ordre

1. **Garde de non-régression GCV2** : verser le juge et la base ; commande unique de rejeu et comparaison. Prérequis des suivants. La garde porte aussi sur la vitesse (§ 2, critère 6) dès que la vitesse de référence est versée (chantier 9).
2. **Tableau de bord** et mesure de base d'autonomie. Les Échos 3:1 et 3:5 ne servent plus (3:5 retirée de la file par Mic le 22/10) ; la base vient des exports de lots récents de Mic, ou du cache de l'extension s'il n'a pas été vidé (une trentaine de parties en tests 18 et 19).
3. **Cuts à SKIP parmi les rouges restants : détection en ombre seulement** (règle D-172 : aucun point, ou un seul scanner). Observation de Mic : une partie de ce qui reste est de cette nature, pas tous. **Ariane n'envoie jamais de SKIP** (décision de Mic du 23/10, D-241) : le chantier repère en ombre, note au journal, compare aux SKIP de Mic dans les exports et chiffre la part concernée, pour informer l'opérateur ; aucune commande ESV. Sous la garde.
4. **Choix de voie en ADV** : diagnostic « oracle » (la bonne paire est-elle parmi les candidats ?), puis décodage global de la voie avec abstention si le diagnostic le justifie. Sous la garde.
5. **Contre-expertise des verts de chaîne** et **provenance des appuis (M2)**. Sous la garde.
6. **Maquette ESV dans `verify`** et campagne de pannes (S4, F2) ; preuve serveur (F4) ; vérifier pourquoi `serverConfirmed` est faux sur toutes les poses du lot de la partie 4:2.
7. **Deuxième passe** : cible hors de la vue (touche `engine.js`, accord de Mic pour ré-épingler).
8. **Précision sous 5 mm** : 60 cuts repointés de façon indépendante, hauteur apprise en comparaison. Sous la garde.
9. **Performance et vitesse, surtout en relecture** (demande de Mic du 23/10, D-242) : retrouver puis dépasser la vitesse de la 4.9, chiffres de référence du § 6 bis. Deux temps : (a) mesure de base dès le chantier 2 (temps par cut en lot, par phase, et temps par cut de relecture ; l'export du cache de Mic donne les tests 18 et 19 sur une trentaine de parties) ; (b) améliorations ciblées sur ce que la mesure désigne, en commençant par la relecture : attente de la page d'ESV, lectures de nuage, refus de navigation « action d'Ariane en cours » qui avait arrêté la relecture de la 3:0 (vérifier s'il persiste), recaptures. **Cible de la relecture : 1,8 s par cut ou mieux sur une grande partie ; lot : cycle médian de 2,44 s ou mieux sur une partie difficile ; toute valeur plus lente est un écart écrit.** Le chantier se termine avant la 5.0 officielle mais la constance (critère 6 de la garde) s'applique dès le chantier 1.
10. **Interface : reconnexion et historique** (demandes de Mic du 23/10, D-243) : (a) **reconnexion automatique à l'onglet ESV quand la page est rechargée** (F5) : aujourd'hui, en Orbite, il faut repasser par le menu à chaque rechargement (cause à reproduire : d'après le code seul Écho se rétablit seul, `echoReprise` ; Mic précise que le bouton sert à choisir l'onglet plutôt qu'à se reconnecter) ; à défaut ou en plus, (b) un bouton « Reconnecter » dans la barre du haut, à côté de « Onglets ESV » ; (c) **historique des parties traitées sur la page d'accueil** (partie, date, cuts posés, différés, durée, version), lu dans les événements de lot déjà journalisés. À recueillir : les autres petits détails d'interface de Mic. Touche `background.js` et le panneau : sous la garde, parité et relecture indépendante comme tout ce qui touche le service worker.
11. **Livraison** : fusion des lignées, base de décisions unique, cahier signé, essai sur Edge, validation de l'ancien panneau remplacé, petits défauts d'interface relevés par Mic (liste à recueillir), étiquette et publication par Mic.

**Mis au second plan** (repris seulement s'ils servent les cibles) : saut direct après F5, reprise automatique bornée, caméra au VALIDATE, ombre GCV1 pendant l'Écho, rail « dessus seul », B2 caméra.

## 6 bis. Vitesse de référence de la 4.9 (à retrouver, chantier 9)

Chiffres tels que consignés dans `DECISIONS.md` et `CHANGELOG.md`, non recalculés ici ; le chantier 9 les rejoue d'abord avec les outils de l'époque (`tools/perf-v3.cjs`, `tools/perf-lot.cjs`, `tools/perf-phases.cjs`).
- **Mode rapide, lot de la 4.9.0.8 (D-090, 13/10)** : 112 cuts (95 posés, 17 différés) en 8 min 24 s ; cycle médian V1 2,44 s en rapide contre 6,73 s en référence (−63,7 %) ; un cut rapide après un rapide 2,32 s ; capture 1,35 s contre 5,11 s ; pose 0,19 s contre 0,86 s ; part posée identique, 0 capture perdue.
- **Gains mesurés au terrain, rapide contre référence (CHANGELOG 4.9)** : −54 % (test 15), −71 % (test 16, partie 26), −48 % (test 16, partie 25), −57 % sur la séance de la test 17, −71 % sur une page ESV fraîche.
- **Relecture de la test 7 (D-184, partie 11)** : 144 cuts relus en 4 min 20 s (environ 1,8 s par cut) ; liste « À contrôler » : 256 verts signalés ≈ 8,5 min contre 36 min pour les 585 verts relus par Mic (partie 29, D-162).
- **Mesures de lots récents, `tools/perf-lot.cjs` sur les journaux archivés (23/10 ; parties et postes différents, comparaison non contrôlée)** : 3:0 en test 15 (758 cuts, partie difficile) cycle médian 4,0 s, p90 7,0 s, 718 cuts/h hors silences, capture ESV médiane 2,9 s (910 captures pour 763 cuts), analyse 717 ms ; 3:1 en test 16 (18 cuts) 4,6 s ; 4:2 en test 18 (68 cuts, 69 cuts invalides au départ) 1,6 s, p90 5,3 s, 1 573 cuts/h, capture médiane 739 ms, analyse 294 ms, décision du lot 31 ms, pose et validation sous 100 ms. Le temps d'Ariane (analyse + décision) pèse environ un cinquième du cycle ; le reste est l'attente de la page d'ESV (navigation → capture : 63 % du cycle en 4:2). Rien de mesuré sur la vitesse de la relecture 5.0 ni sur le temps de la deuxième passe sur un grand lot.
- **Relecture de fin de lot, durées lues dans les journaux archivés (`relecture-fin`, champ `dureeMs`, 23/10)** : partie 11 en test 7 (D-184) 144 cuts en 4 min 20 s, 1,8 s par cut ; 3:1 en test 16, 12 cuts en 26 s, 2,2 s par cut (estimé 46 s) ; 3:0 en test 15, 439 cuts relus en 33 min 47 s (2e lancement), 4,6 s par cut, 20 corrigés ; le 1er lancement de la 3:0 s'était arrêté après 11 min 51 s et 133 cuts (« passage au cut 226 refusé par la page : action d'Ariane en cours (capture) », 7 demandes) et avait été relancé à la main 36 minutes plus tard. Pour comparaison, le parcours de Mic en Écho : 1,6 à 1,7 s par cut en validation, 0,8 s en survol (D-1xx de la 5.0, parties 7 et 29), 585 verts relus en 36 min (3,7 s par cut). Aucune relecture dans le lot de la 4:2 (test 18). Aucune mesure en test 18 ou 19 sur une grande partie.
- **Question à Mic** : quelle relecture avais-tu en tête (relecture de fin de lot, « Mes corrections », ou l'Écho) et quel temps visais-tu ? Le chantier mesure les trois.
- **Cible** : chaque chiffre de référence atteint ou dépassé, ou écart écrit et décidé par Mic. Le temps par cut en lot et le temps par cut de relecture entrent dans la garde (§ 2, critère 6).

---

## 7. Portes de version

- **Constance de la performance** (D-242) : chaque amélioration du moteur (voie, appuis, contre-expertise, deuxième passe, hauteur apprise) annonce son coût en temps par cut avant d'être livrée ; un coût qui fait reculer le critère 6 demande une décision écrite de Mic, comme tout recul de la garde.
- Une version de test : garde de non-régression verte, `node tools/verify.cjs` à 0 échec sans essai annulé, consigne terrain, retour de terrain analysé avant la suivante.
- Une nouveauté à la fois quand le risque d'écriture augmente (règle de la version 1, § 6, rétablie pour tout ce qui écrit dans ESV).
- **5.0 stable** : vitesse de la 4.9 retrouvée (§ 6 bis) ; cibles du § 5 tenues sur parties d'examen avec intervalles, filet de sécurité du chantier 5 en place, fusion et publication par Mic.

## 8. Décisions qui restent à Mic

Seuil d'autonomie après la mesure de base ; contre-expertise des verts de chaîne (coupée) ; ré-épinglage de `engine.js` pour la deuxième passe ; projet de rattachement de la partie 2 ; fusion dans `main`, étiquette, publication.

**Tronc de développement** : le code de la 5.0 vit sur `claude/50-test17` (tête de la test 18) ; ce cahier, D-239 et l'architecture (`fiches/ARCHITECTURE_5.0.md`) sont écrits sur `claude/execute-prompt-00-18ra5a`. Ils sont à reporter sur le tronc au premier chantier, et `DECISIONS.md` doit redevenir un seul fichier (D-224 à D-238 sont aujourd'hui sur deux branches).

## 9. Hors périmètre

Envoi d'un SKIP par Ariane, quel que soit le cas (D-241). Multi-sessions, suivi mobile, écriture directe sur le serveur d'ESV, modification de `src/engine.js` hors correctif avéré avec ré-épinglage accordé. Orbite et Écho en parallèle : abandonné pour la 5.0 (un seul état d'onglet dans le service worker).

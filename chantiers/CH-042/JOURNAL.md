# CH-042 : journal de recherche (gain de qualité de pose, hors échantillon)

Une entrée par piste : protocole écrit avant, résultat, décision. Qualifications : ÉTABLI = compté par un script sur les exports ; PROBABLE = lecture de comptes ; SUPPOSÉ = hypothèse nommée. Aucun numéro de cut isolé, aucune coordonnée, aucun identifiant ESV ici : les tables par cut restent hors du dépôt (scratchpad de la session). Scripts de mesure : `chantiers/CH-042/scripts/` (lecture seule des exports de `banane-data`, clone local hors dépôt). Commencé le 2/11/2026.

## 0. Protocole (écrit le 2/11 avant toute mesure)

### 0.1 Ce que l'on mesure
Unité : un cut POSÉ par le lot et JUGÉ par l'Écho, au sens de `tools/juger-lot.cjs` (posé = écriture de validation 2xx pendant le lot ; jugé = corrigé par l'opérateur, ou « contrôlé, bon » = visité sans geste). Pour chaque cut jugé : l'erreur signée de la pose du lot, rail par rail et axe par axe, dans le repère profil de la pose de départ d'ESV (+ latéral = vers la droite du profil, + vertical = vers le haut), erreur = vérité − pose ; un « contrôlé, bon » vaut 0 sur les quatre composantes (c'est la définition de l'acceptation, D-270). Le geste (acceptation, fine ≤ 10 mm, moyenne 10 à 50, faute > 50 ; pire rail, 3D) est celui de `juger-lot`.

Un levier candidat est une fonction qui, à partir de ce que le lot sait AU MOMENT DE POSER (capture, science du cut, décision, appuis, voisins déjà validés, liste d'ESV), rend une pose corrigée. On la juge sur la même vérité : erreur après = vérité − pose corrigée. Jamais la vérité n'entre dans le calcul de la pose corrigée du cut jugé (essai anti-fuite : les signaux sont lus dans le journal du lot, écrits avant tout Écho).

### 0.2 Jeux (ÉTABLI à l'inventaire du 2/11, clone local de `banane-data`, branche des documents)
Jeu A, couples lot + Écho joints par la jointure (`tools/jointure-echo-orbite.cjs`, règle « visité sans action = bon ») : parties 15, 16, 17, 18, 20 du 26/10 (4.9.5.21) ; partie 0 du 26/10 (4.9.5.22, Écho .23) ; partie 1 du 26/10 (4.9.5.23) ; partie 20 du 28/10 (4.9.5.23, Écho du 29/10 ; archives 7z extraites hors dépôt) ; partie 17 du 28/10 (4.9.5.23, poses de référence de CH-012) ; parties 10 et 11 du 1/11 (4.9.5.30, Écho de l'Aurore : jugés biaisés vers les cuts signalés) ; partie 0 du 2/11 (4.9.5.31, Écho presque complet : 121 jugés sur 123 posés, le seul jeu à couverture quasi totale).
Jeu B, les 12 lots archivés de la garde GCV2 (`datasets/garde-gcv2/`, vérités scellées en mm dans le repère profil du départ, 4.9.5.3 à 4.9.5.19) : parties 6, 7, 11, 13, 17, 18, 19, 20 (deux lots) du second projet, partie 0 du troisième, partie 0 du 23/10 (deux lots, terrain). Même chaîne de décision (`lot-decision-v7`, moteur gelé) : les signaux consignés (`hauteurApprise`, `fauxVertOmbre`, candidats, appuis, étage) existent dans tous ces journaux (vérifié sur les 4.9.5.7 et 4.9.5.8).
Hors jeu : les parties qui ont servi à apprendre la hauteur apprise (1:17, 1:24, 1:29, 2:1) ne sont dans aucun jeu : tout modèle de hauteur existant y est hors échantillon. Les lots sans Écho (.24 à .28) servent au coût seulement.

### 0.3 Découpage : un lot laissé de côté à chaque fois (LOLO)
Un « lot » = un couple (partie, exécution du lot). Pour chaque lot k : les paramètres du levier (coefficients, seuils, plafonds, modèle) sont choisis sur TOUS les autres lots, puis appliqués aux cuts du lot k ; les prédictions hors pli de tous les lots sont réunies et jugées ensemble, et lot par lot. Un réglage lu sur le lot jugé n'est jamais un gain. Les choix de FORME du levier (quels signaux, quelle famille) sont faits une fois, sur le jeu B seul (plus ancien, plus pauvre), avant d'ouvrir le jeu A ; si le jeu A est consulté pour choisir une forme, le journal le dit et la conclusion est rétrogradée en « réglage ».
Jeu d'examen final (ouvert une fois, à la fin) : partie 0 du 2/11 (couverture 98 %, version la plus récente) ; tout levier retenu est jugé dessus avec ses paramètres figés avant l'ouverture, écrits dans ce journal avec leur empreinte.

### 0.4 Modèle nul et témoins
Modèle nul : la pose du lot telle quelle (erreur après = erreur avant). Témoin 1 : correction constante par axe et par rail apprise sur les autres lots (CH-034 a montré qu'elle dégrade : elle doit perdre ici aussi, sinon la mesure est fausse). Témoin 2 : la hauteur apprise livrée (plafond 5 mm, part 0,5) telle que consignée dans le journal (`hauteurApprise.rails[*].correctionMm`).

### 0.5 Critères d'un gain significatif hors échantillon (tous requis, sur les prédictions hors pli réunies)
1. **Erreur moyenne** (pire rail, 3D, sur les cuts jugés, acceptations comprises à 0) : baisse dont l'intervalle de confiance à 95 % (bootstrap par cut, 10 000 tirages, graine 20261102, stratifié par lot) exclut 0 ; et baisse de la **médiane** des corrigés ou du **90e centile** avec le même critère.
2. **Fautes** : aucune faute nouvelle (cut ≤ 50 mm avant, > 50 après) ; **moyennes** : le nombre de cuts > 10 mm après ≤ avant.
3. **Acceptations** : parmi les cuts « contrôlé, bon » (0 mm), la part déplacée de plus de 2 mm (pire rail, 3D) ≤ 0,5 point des jugés (SUPPOSÉ : sous 2 mm, soit 4 pixels, l'opérateur ne voit pas le déplacement ; les retouches fines mesurées valent 2 à 8 pixels, CH-034 § 4). Et la part de cuts à ≤ 2 mm d'erreur (« acceptation équivalente ») après ≥ avant − 0,5 point.
4. **Cohérence entre lots** : le gain (erreur moyenne) est du bon signe dans au moins deux lots sur trois parmi ceux qui ont au moins 20 jugés, et aucun lot n'est dégradé de plus de 1 mm en moyenne.
5. **Aucune dégradation d'un cut de plus de 5 mm** ne s'ajoute aux critères 2 et 3 sans être comptée et expliquée.
Puissance : écrite au § 1 après la construction de la table (écart type de l'erreur par axe, effectifs par lot) ; la taille d'effet détectable à 80 % est donnée avant chaque mesure.

### 0.6 Ordre des pistes (décision du 2/11)
1. Table par cut des jeux A et B (§ 1), bruit et puissance.
2. Piste 1 du ticket : la hauteur apprise, son plafond et sa forme (signaux déjà consignés : groupe, dz du calage, épaisseur du dessus, points) en LOLO. C'est la piste chiffrée par le ticket (13 rails de la partie 0 du 2/11, −6,5 mm sous plafond).
3. Piste 4 : modèle de résidu appris (régression régularisée, arbres) sur les signaux du lot, par axe et par rail, LOLO strict, par étage.
4. Piste 2 : continuité (voisins validés) comme a priori de hauteur et d'écartement.
5. Piste 3 : plusieurs captures par cut (inventaire d'abord : combien de cuts en ont).
6. Piste 7 : seuil de visibilité de l'opérateur (où l'acceptation bascule).
7. Pistes 5, 6, 8 selon ce que les précédentes laissent.

# Protocole de repointage indépendant (v7, précision à 5 mm ou moins)

Rédigé le 28/10/2026. Statut : **proposition, rien n'est lancé**. Elle porte sur le chantier 8 du cahier (« précision sous 5 mm : 60 cuts repointés de façon indépendante ») et sur la règle du cahier § 5 : aucune cible sous 5 mm avant une mesure de pointage indépendante.

## 1. Ce que la mesure existante dit déjà (`fiches/BRUIT_REFERENCE.md`, chantier 50)
- Bruit de la pose de référence de l'opérateur : de **0,75 mm** (pas de fin de réglage) à **1,5 mm en latéral et 2,3 mm en vertical** par axe (borne haute, tous jeux ; 1,0 à 4,1 mm en vertical selon la session). Grain du clic : 0,11 mm, négligeable.
- Conséquence : le seuil de **10 mm a un sens**. Le seuil de **5 mm a un sens comme taux de partie** (comparer deux versions sur les mêmes cuts avec la même référence), **pas comme verdict d'un cut isolé** : 19 à 42 % des cuts posés sont dans la zone grise de 3,6 à 6,4 mm.
- Ce que cette mesure ne voit pas : un **biais constant** de l'opérateur (convention de bord, hauteur du plan de roulement), et l'**ancrage** (il voit sa pose précédente quand il reprend un cut). Une relecture à l'aveugle séparerait les deux ; l'étude la juge impossible dans ESV, et rien dans le dépôt ne donne de cuts relus à deux dates sans ancrage.

## 2. Ce que le repointage ajouterait, et ce qu'il ne peut pas ajouter
- Il peut mesurer le **bruit de pointage à l'aveugle** (σ latéral et vertical par rail), donc dire si 5 mm est un seuil lisible cut par cut ou seulement comme taux de partie.
- Il **ne mesure pas le biais** : l'opérateur se compare à lui-même. Seul un second expert, ou une mesure physique indépendante, le verrait. Le protocole ne prétend pas le faire.

## 3. Plan réaliste : on en a besoin seulement si l'on veut une cible par cut
Une cible de v7 exprimée en **taux de partie sur les mêmes cuts, même référence** (par exemple « part des poses à 5 mm ou moins, +X points contre la v6 ») est mesurable **sans repointage** : la différence entre deux versions annule le bruit de référence, tant qu'elle dépasse 3 points (`BRUIT_REFERENCE.md`, effet sur les seuils). On commence donc par **chiffrer la base** (étape A) : c'est gratuit pour l'opérateur. Le repointage (étape B) n'est lancé que s'il veut une affirmation par cut.

**Étape A (aucun effort pour l'opérateur)** : la part des poses à 5 et 10 mm, la médiane et les pires cas de la v6 sur les lots 4.9.5.21 à 4.9.5.23 avec Écho, par partie et au total, avec intervalles (tableau de bord n° 2 du cahier). Une analyse de journaux par script, confiable à Cursor (D-253).

## 4. Étape B : le repointage, si l'opérateur le veut
**Principe d'une quasi-aveugle.** Il faut empêcher l'opérateur de s'ancrer sur sa pose précédente. On déplace donc le rail **d'un décalage aléatoire connu** avant qu'il repointe : il ne reconnaît plus sa pose et doit la retrouver depuis le nuage.
1. **Échantillon : 60 cuts**, tirés au hasard (graine écrite) parmi les cuts déjà validés et conservés par l'opérateur, en excluant ceux dont le nuage est absent ou ambigu et les cuts rouges (la mesure vise le pointage, pas la difficulté). Stratifier par zone (courbe, ADV, droit) pour que les trois soient représentés. La liste est sélectionnée par un script, sans que l'opérateur la choisisse.
2. **Délai : au moins 24 heures** après la première validation, pour effacer la mémoire visuelle de la position.
3. **Décalage aléatoire** : latéral et vertical tirés entre 15 et 40 mm, de signe aléatoire, sur les deux rails, appliqué par l'outil avant que l'opérateur ouvre le cut. Il ne connaît pas le décalage, et il n'est pas affiché. L'opérateur repointe les deux rails à la meilleure position qu'il voit, comme à son habitude, **sans consulter** son premier relevé.
4. **Ordre mélangé**, une seule visite par cut, pas de retour sur un cut déjà repointé.
5. **Enregistrement** en mode Écho, comme pour les autres séances : les exports sont archivés dans `banane-data`.
6. **Où** : sur un **exemplaire de travail** du projet, pas sur le projet de production, ou sur des parties déjà livrées dont les poses finales sont exportées et rétablissables. C'est une condition pour que le décalage ne touche pas des poses utiles. À confirmer par l'opérateur : ESV permet-il de dupliquer une partie ou de rétablir les poses exportées ?

**Analyse (par script, publiée sans coordonnées).** Écart entre la pose repointée et la pose de référence, par rail et par axe (latéral, vertical) : médiane, écart type, part ≤ 2 mm, ≤ 5 mm, pires cas ; graphique de Bland-Altman ; intervalles de confiance par bootstrap par cut ; comparaison aux valeurs de `BRUIT_REFERENCE.md`. Effectif de 60 cuts : un intervalle de l'écart type d'environ ± 18 %.

**Règle de décision, écrite avant la mesure.**
- σ de repointage ≤ 1,5 mm par axe : une cible « 5 mm ou moins » est lisible cut par cut ; la v7 vise un taux de poses à 5 mm ou moins mesuré sur les mêmes cuts.
- σ entre 1,5 et 2,5 mm : 5 mm reste un taux de partie, jamais un verdict de cut ; la v7 se juge en différences entre versions.
- σ > 2,5 mm : 5 mm n'est pas mesurable avec cette référence ; on garde 10 mm comme cible.

## 5. Ce que cela coûte, et le risque
- **Opérateur** : une séance d'environ 30 à 40 minutes (60 cuts à environ 30 s), le lendemain de la sélection, sur l'exemplaire de travail.
- **Développement** : un petit outil qui applique le décalage aléatoire aux cuts de la liste (écriture dans ESV : à écrire et à relire par l'intégrateur, jamais par un exécutant) et un script d'analyse. Une version de test dédiée, pas la production.
- **Risque principal** : les poses décalées restent dans le projet si l'opérateur n'en repointe pas un. Le protocole exige donc un exemplaire de travail, ou la liste des poses de référence exportée avant, pour pouvoir tout rétablir.

## 6. Ce qui est décidé et ce qui attend
- **Décidé** : rédaction de ce protocole ; l'étape A (base à 5 et 10 mm de la v6) est confiée à Cursor dans un chantier, sans effort pour l'opérateur.
- **Attend l'opérateur** : vouloir une cible par cut (étape B) ou se contenter d'un taux de partie ; et la réponse sur l'exemplaire de travail dans ESV.

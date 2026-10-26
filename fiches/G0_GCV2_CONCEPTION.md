# G0 — Conception du méga cerveau GCV2 (19 octobre 2026, à relire par l'opérateur)

Chantier G0 du cahier (`BANANE_5.0_CAHIER.md`, lot G). Écrite au niveau le plus fort à partir des mesures faites depuis le 15 octobre (audit du super cerveau, G0 v1, faux verts, hauteur apprise, voie prédite, mémoire des différés, relecture autonome, D-185 à D-191). Rien n'est codé ici ; la suite est dans `fiches/PLAN_SUITE_5.0.md` § 4 (missions G1-a à G2). Le moteur de géométrie `src/engine.js` n'est pas touché par la GCV2.

**En une phrase.** La GCV2 ne remplace pas le moteur qui lit le nuage ; c'est la couche qui **choisit, corrige et doute** au-dessus de lui : elle fabrique des hypothèses de pose à partir de tout ce qu'Ariane sait déjà, apprend sur les corrections de l'opérateur à reconnaître celle qui est juste, et ne pose que lorsqu'elle est sûre, sous des garde-fous qui ne s'apprennent pas.

## 1. Ce que les mesures imposent

| Constat mesuré | Source | Conséquence pour la GCV2 |
|---|---|---|
| La confiance du moteur mesure la qualité d'un ajustement, pas la justesse de la correspondance : un candidat à confiance 78 était faux de 78 mm | AUDIT_SUPER_CERVEAU § 2 | la GCV2 apprend un **score de justesse**, distinct de la confiance d'ajustement |
| 111 des 235 rails abstenus avaient une cellule forte écartée par le ratio de perte 1,5 | audit, cahier G0, IDEES cerveau-4 | le **réservoir de candidats** du moteur (`pool`, `competitiveView`, cellules STRONG) est la première source d'hypothèses ; aucune nouvelle géométrie n'est nécessaire pour attaquer ces abstentions |
| 70 des 85 faux verts viennent de la hauteur ; la hauteur apprise fait 85 → 61 sans en créer, en validation croisée ; aucun signal unique ne trie les faux verts d'une partie à l'autre (AUC 0,52 à 0,78) | FAUX_VERTS, HAUTEUR_APPRISE, D-140, D-160, D-161 | la hauteur apprise est une **transformation d'hypothèse** (chaque hypothèse existe avec et sans) ; le tri des faux verts demande une **combinaison** de traits, pas une règle à un seuil |
| Second projet : 127 différés, voie décalée de 149 mm, 61 % hors de la fenêtre de recherche ; 3 poses sur la mauvaise voie (163 à 280 mm) | D-141, VOIE_PREDITE | il faut un **a priori de voie** (voie prédite, appuis) parmi les hypothèses, et la mauvaise voie est la faute que les **garde-fous** interdisent avant tout apprentissage |
| Règle prudente (8 mm, chaîne + hauteur) : PN 36 sur 36 ; parties 14 à 16 : 29 des 35 grosses corrections reproduites, 2 abîmés, 0 mauvaise voie ; mais 39 des 118 grosses corrections sont des **abstentions** et 7 des 42 tombent **hors zone** | RELECTURE_AUTONOME, D-189, D-190 | la GCV2 doit d'abord **réduire les abstentions** (hypothèses) et ensuite seulement élargir les zones ; la règle prudente actuelle est la **référence** à battre, pas à jeter |
| 1 631 cuts corrigés, 442 validés tels quels, 1 177 visités sans action, sur 10 Échos ; l'opérateur en ajoute chaque jour | D-188, COMPTEUR_GCV2 | assez d'exemples pour un modèle à quelques dizaines de traits ; **pas** pour un réseau sur le nuage ; les cuts justes sont les exemples négatifs indispensables |
| Les corrections de moins de 5 mm sont dans le bruit de la référence | BRUIT_REFERENCE | les étiquettes sont des classes (≤ 5, ≤ 10, > 10, > 50 mm), pas une régression fine |

## 2. Forme retenue : trois étages au-dessus du moteur

### Entrée (par cut, au moment de la décision, sans fuite)

Ce qu'Ariane a **avant** tout geste humain, et rien d'autre : la capture (points par rail), la pose de départ qu'ESV montre, les résultats du moteur livré (A*, réservoir de cellules avec perte, position, qualité STRONG, vue compétitive, S1), le contexte (zone de la carte : PN, ADV, abords, hors ; appuis et voisins posés avec leur provenance ; voie prédite ; médiane d'écartement de la partie ; rôle du cut : vert, rouge, différé ; lot ou relecture). La frontière anti-fuite est celle de l'ombre « mémoire des différés » (`entreeSansFuite`) : un essai prouve qu'aucun trait ne lit la référence humaine.

### Étage 1 — Hypothèses (rien d'appris, tout rejouable)

Pour chaque rail, une liste bornée (douze au plus) de poses candidates, chacune étiquetée par son origine :

- **H0** la pose de départ (ne rien faire) ;
- **H1** la proposition A* du moteur, avec sa convention ;
- **H2** chaque cellule compétitive du réservoir (ratio ≤ 1,5), **et** les cellules STRONG écartées par le ratio : c'est le gisement des 111 abstentions sur 235 ;
- **H3** la pose relancée depuis la voie prédite ou les appuis (chaîne), là où une série de différés commence ;
- **H4** l'interpolation des voisins sûrs (poses humaines ou validées par le lot, jamais ses propres poses non vérifiées : règle M2) ;
- chaque hypothèse existe **avec et sans hauteur apprise**.

Première mesure de G1-a, avant tout apprentissage : le **rappel atteignable**, part des grosses corrections de l'opérateur pour lesquelles une hypothèse au moins est à 10 mm de sa pose finale. S'il est sous 60 %, c'est l'étage 1 qu'il faut enrichir, pas le modèle.

### Étage 2 — Score de justesse (appris, piste A1 de l'audit)

Pour chaque hypothèse d'un rail, deux probabilités calibrées : p(à 10 mm de la pose finale de l'opérateur) et p(à 5 mm). Traits (une trentaine, tous disponibles à l'instant de la décision) :

- **géométrie de l'hypothèse** : perte, ratio de perte à la meilleure, lignes au sommet, faces, STRONG, repêchée par S1, concurrents forts, épaisseur et points du dessus, points du rail ;
- **rapport à la pose de départ** : décalage latéral et vertical, décalage de la convention (`dz`) ;
- **rapport au contexte** : écart à la voie prédite, écart aux voisins sûrs, écartement de la paire qui en résulte contre la médiane de la partie, dévers avec l'autre rail ;
- **contexte** : zone, rôle du cut, lot ou relecture, origine de l'hypothèse (H0 à H4), avec ou sans hauteur.

Modèle : **régression logistique calibrée** par défaut (lisible, quelques coefficients, inférence en microsecondes) ; de **petits arbres** (profondeur 3 au plus, cinquante au plus) seulement s'ils gagnent nettement en validation croisée par partie. Les paramètres sont exportés dans `datasets/gcv2-parametres.json` (coefficients, seuils, version, parties d'apprentissage, empreinte du jeu) et lus par un module pur `src/gcv2.js`. Aucune dépendance, aucun code distant, aucun poids lourd dans le paquet : les contraintes du service worker et du Chrome Web Store (audit § 7) sont respectées par construction. La piste A2 (modèle sur le nuage brut) reste reportée : elle n'est justifiée que si le rappel atteignable de l'étage 1 reste bas.

### Étage 3 — Décision de paire (garde-fous non appris, puis seuil appris)

1. **Garde-fous, avant tout** : écartement de la paire dans le contrat (1 420–1 470 mm, ou médiane de la partie ± 15 mm), déplacement latéral de chaque rail ≤ 45 mm par rapport à la pose de départ (ou à la voie prédite au départ d'une série de différés), dévers ≤ 15 mm, rails dans la vue capturée. Une hypothèse qui les viole est écartée, quel que soit son score. Ces garde-fous **réduisent** le risque de mauvaise voie sans l'annuler : une paire au bon écartement et au bon dévers peut suivre la mauvaise voie (audit du 19/10, M4 ; les cinq mauvaises voies de G1-b en sont la preuve). La porte « 0 mauvaise voie » se mesure donc sur les actions, avec sa borne de Wilson, elle ne se déduit pas de la construction.
2. **Choix** : le couple (gauche, droite) qui maximise p_gauche × p_droite à 10 mm.
3. **Agir seulement si** p_couple ≥ τ **et** si le couple gagnant s'écarte de H0 d'au moins δ (sinon « laisser », comme la règle prudente aujourd'hui). τ et δ sont choisis sur les parties d'apprentissage pour 0 mauvaise voie et une erreur ≤ 9 % parmi les actions ; ils peuvent différer par zone.
4. Sinon : **abstention**, avec les deux meilleures hypothèses consignées.

### Sorties

La pose (ou l'abstention), la **confiance calibrée** (une probabilité, pas un score d'ajustement), la **raison** (hypothèse gagnante, trois traits dominants, garde-fou qui a bloqué), les deux alternatives. Ce sont les sorties « pose, confiance, raison » du cahier G0.

## 3. Ce qu'elle apprend des corrections

- **Un exemple** = (partie, cut, rail, hypothèse) ; **étiquette** = écart 3D de l'hypothèse à la pose finale de l'opérateur, en repère profil, en classes ≤ 5, ≤ 10, > 10, > 50 mm. Un cut validé tel quel ou visité 0,6 s sans action donne l'étiquette « H0 juste » : ce sont les exemples négatifs, aussi nombreux que les corrections.
- **Pondération** : chaque partie pèse autant qu'une autre (comme la hauteur apprise), pour qu'une grosse partie n'écrase pas les autres ; les projets sont équilibrés de la même façon quand il y en a plus de deux.
- **Référence** : la dernière validation de l'opérateur, corrigée par l'écriture serveur (D-143) ; les cuts sans référence et les SKIP n'entrent pas.
- **Anti-fuite** : les traits ne lisent jamais la référence ; un essai le prouve (même méthode que la hauteur apprise et E2). Le jeu porte des bords de rails : il reste **hors dépôt**, seuls les comptes et les paramètres entrent.

## 4. Apprentissage et jugement

- **Validation croisée par partie** sur les parties d'apprentissage (apprendre sur toutes sauf une, juger celle-là) ; τ et δ choisis sur l'apprentissage seulement.
- **Jugement** sur les parties réservées et les deux témoins fixes (1:25 et 1:11, jamais appris), par zone, avec la borne de Wilson à 95 %.
- **Mesures**, les mêmes que la relecture autonome : corrections justes (l'opérateur > 10 mm, GCV2 à 10 mm), reproduites à 5 mm, cuts abîmés, mauvaise voie, erreur parmi les actions, abstentions, laissés faux, par zone (PN, ADV, abords, hors) et par rôle (vert, rouge, différé).
- **Référence à battre** : GCV1 + règle prudente, chiffres de D-190 sur les mêmes parties (29 justes sur 35, 2 abîmés, 87 abstentions, 6 laissés faux).
- **Porte G1** (cahier) : erreur médiane ≤ GCV1 dans toutes les zones, différés ≤ GCV1, 0 mauvaise pose ajoutée sur les réservées, erreur ≤ 9 % parmi les actions.

## 5. Où elle tourne, dans l'ordre

1. **Hors ligne** (outils `gcv2-jeu`, `gcv2-apprendre`, `gcv2-juger`) : c'est là que tout se mesure.
2. **En ombre** (`gcv2-ombre`) dans la relecture et dans le lot : le même module pur calcule et consigne sa décision et son écart à GCV1, sans rien changer à la pose (preuve « sans effet » ; concordance rejeu = ombre).
3. **Activée, réversible**, par réglage (`gcv2.actif`), par zone et par rôle : **la relecture d'abord**, parce que c'est là que l'Écho de l'opérateur mesure chaque action ; le lot ensuite. Retour à GCV1 en un clic. Seul l'opérateur active.

## 6. Ce qu'elle n'est pas, et ce qui peut rater

- Pas un nouvel extracteur de géométrie : si aucune cellule du réservoir, aucune voie prédite et aucun voisin ne donne une pose juste, la GCV2 ne peut que s'abstenir. Le rappel atteignable (G1-a) mesure cette borne haute avant d'apprendre quoi que ce soit.
- Pas le SKIP (ne se mesure pas : ESV fond les scanners).
- Un seul opérateur expert et deux projets : risque de retenir par cœur ; d'où la validation croisée par partie, les témoins fixes et la rotation examen → apprentissage.
- Les corrections de moins de 5 mm sont du bruit : elles entrent dans le jeu, mais elles ne définissent ni la porte ni les seuils.
- Le gain principal attendu est sur les **abstentions** et les **faux verts de hauteur** ; sur les PN, la règle prudente fait déjà 36 sur 36 : la GCV2 doit au moins ne pas faire moins.

## 7. Rythme avec les corrections quotidiennes de l'opérateur

Chaque nouvelle partie est d'abord un examen (jugée par la GCV2 figée), puis entre en apprentissage (D-192). Réentraînement quand trois parties nouvelles sont entrées, ou une fois par semaine ; chaque jeu de paramètres est daté et versionné ; les parties qu'il a vues passent en « appris » dans le compteur (`compteur-gcv2-sources.json`, `etat: appris`) : c'est le moment précis où le compteur « appris » de l'opérateur devient vrai (D-191).

## 8. Ce que l'opérateur doit relire et décider

1. La forme : une couche de choix au-dessus du moteur, pas un nouveau moteur ; la piste A2 reportée.
2. L'ordre d'activation : relecture d'abord, lot ensuite.
3. Les témoins fixes 1:25 et 1:11, jamais appris.
4. Les seuils de porte : 0 mauvaise voie, erreur ≤ 9 %, et « au moins aussi bien que la règle prudente » comme condition d'activation.
5. La raison de la correction (E3, mission RM-11) : facultative ; elle donnerait des étiquettes de raison, au prix d'un clic par correction.

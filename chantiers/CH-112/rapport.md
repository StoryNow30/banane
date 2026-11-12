# CH-112 : mauvaise voie en zone d'aiguillage (rapport, D-346)

Étude hors ligne. Aucun fichier de l'extension touché. Outils : `chantiers/CH-112/outils/` ; sorties par cut (numéros et millimètres) : `banane-data/outils/analyse-lots/CH-112/sorties/`, à verser dans `banane-data/outils/analyse-lots/CH-112/`.

## Données (ÉTABLI)
- Lots jugés rejoués : 11/11 (p15, p16), 06/11 (p13, p15, p16), 05/11 (p8 à p12, examen), 08/11 (p3, p4, p6). Jointures refaites avec `tools/jointure-echo-orbite.cjs --visite-sans-action-bonne` ; un posé vu sans action compte pour juste. Comptes du 11/11 identiques aux NOTES (p16 : 378 posés, 11 faux > 10 mm, 7 > 100 mm).
- En tout : 2 505 posés, 779 jugés justes (≤ 10 mm), **17 faux de plus de 50 mm** (7 le 11/11, 7 le 06/11, 3 le 08/11 p6 ; aucun le 05/11).
- Partie 1 du 10/11 : Écho seul, aucun lot, donc aucune pose d'Ariane à juger : hors champ.

## Ce que montrent les traits (ÉTABLI, p16 du 11/11)
- Dans les deux zones fautives (3954-3975, 4504-4577), **les lignes validées d'office par ESV et les différés sont tous à 120-260 mm de la pose finale** : la liste d'ESV y suit l'autre voie. Les 7 faux d'Ariane collent à ces voisins ; les bons de la zone (3970, 4517-4522, 4565…) s'en écartent de 150 à 500 mm.
- D'où l'échec des traits locaux : saut par rapport aux voisins de la liste (3 à 5 faux arrêtés pour 9 à 25 bons), `advRails`, GCV1 (confiance, concurrents), déplacement d'Ariane, garde de voie (2/7), `adv: alerte` seule (27 bons par faux). L'écartement est normal des deux côtés : le nuage seul ne dit pas quelle voie est la bonne ; les nuages n'ont pas été rejoués.

## Le signe retenu : « voie des cuts sûrs » (`outils/regle-voie.cjs`)
Rejoué dans l'ordre du lot. **Références sûres** : cuts posés plus tôt par le lot et non arrêtés, ou traités par l'opérateur hors du lot ; jamais une ligne validée d'office par ESV. Pour un cut posé en `adv: alerte` : décalage latéral, dans l'axe latéral du profil du cut, de chaque rail posé par rapport au même rail du dernier cut sûr situé au plus **12 cuts** en arrière (écart g). **Arrêt (différé)** si les deux rails vont du même côté et que leur moyenne dépasse **100 + 2·g² mm** (le terme en g² absorbe la courbure, rayon d'environ 250 m). Sans référence : le cut passe mais ne devient pas sûr.

| | faux > 50 mm arrêtés | bons bloqués (≤ 10 mm) | arrêts / posés |
|---|---|---|---|
| 11/11 (p15, p16) | 6/7 | 0/398 | 6/474 |
| 06/11 (p13, p15, p16) | 5/7 | 0/96 | 6/898 (dont 8997, non jugé) |
| 05/11 (p8-p12) | 0/0 | 0/246 | 0/831 |
| 08/11 (p3, p4, p6) | 1/3 | 0/39 | 1/302 |
| **Total** | **12/17** (71 %, Wilson 95 % : 47-87 %) | **0/779** (borne haute 0,5 %) | **13/2 505** |

- Les 11 faux de 10 à 40 mm ne sont pas touchés (décalages de −10 à +20 mm) : ce ne sont pas des mauvaises voies.
- Manqués (5) : 3968 (11/11) et 7260, 7423 (06/11) : aucun cut sûr à moins de 12 cuts ; 360 (08/11) est en `marge-apres` (décalage 140 mm), 361 suit 360. Étendre l'arrêt aux marges en prend 14/17 mais bloque 1 bon (06/11 9274) ; G = 16 en prend 13/17 et bloque 4 bons (11/11 3970, 3971, 4517, 4518).
- Abstention (cut en zone alerte sans cut sûr à moins de 12 cuts) : 25 sur 738 cuts posés en zone alerte (3,4 %).
- Plateau : S de 60 à 120 mm donne les mêmes chiffres (12/17, 0/779).
- Validation croisée par plages (PROBABLE) : réglé sur le 11/11 seul (sans terme de courbure, S 80-150, G 12 : 6/7, 0 bon), il prend 6/10 sur les autres lots et **bloque 2 bons** (08/11 p6 181 et 182, référence 10 et 11 cuts en arrière, 255 et 280 mm : courbure de l'aiguillage). Réglé sur les autres lots (terme 2·g²), il prend 6/7 sur le 11/11 sans bloquer de bon. Le terme de courbure a été ajouté après avoir vu 181-182 : seule la prochaine séance Écho fera examen.

## Coût en différés
13 arrêts sur 2 505 posés (0,5 %) ; 12 étaient des mauvaises voies, 1 non jugé (06/11 p16 8997, décalage 127 mm : l'un des « deux alignements » 8996-9003 que CH-100 demandait à l'opérateur de regarder). Ces cuts iraient aux différés ; la deuxième passe (plafond 10, D-259) pourrait en réécrire : non mesuré.

## Forme proposée dans l'extension (en ombre d'abord)
Un événement `voie-sure-ombre` par cut posé en zone `adv: alerte` : référence (écart en cuts), décalages gauche/droit, seuil, « aurait différé ». Mémoire du lot : les cuts posés non arrêtés et les lignes traitées par l'opérateur au départ de la partie (instantané de liste déjà gardé). Aucun arrêt réel sans accord écrit de l'opérateur, chiffres à l'appui ; module de décision : patch, garde de pose et parité. À mesurer en ombre : le taux d'abstention (cuts sans référence) et les arrêts sur les lots sans Écho.

## À demander
- Une séance Écho sur les zones `adv: alerte` du prochain lot : seul examen vierge du signe.
- Un coup d'œil sur 06/11 p16 8996-9003 (8997 arrêté par le signe).

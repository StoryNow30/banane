# CH-124 : rapport (ancre indépendante de voie)

**Question du ticket.** Existe-t-il une ancre qui désigne la bonne voie dans les appareils de voie, connue au moment de décider et indépendante des poses d'Ariane ?

## 1. Réponse : oui (ÉTABLI)
L'axe de la voie relevée se prédit depuis la **trajectoire du véhicule de mesure**, lue dans la seule liste d'ESV du départ de la partie.
- Une coupe est perpendiculaire à la trajectoire, et la pose par défaut d'ESV (1 500,0 mm) est centrée dessus. Cheminée de plan en plan, la trajectoire se referme sur la pose par défaut suivante à 0,3 mm en médiane (1 052 poses par défaut, 22 listes).
- La trajectoire n'est pas l'axe : il faut le modèle du véhicule (deux pivots sur l'axe à 14 m, point de référence en porte-à-faux de 4 m), puis un calage local sur la voie courante intacte. Sans ce modèle, 242 cuts jugés sortent de 40 mm.
- Réglage figé avant tout jugement (`reglage-fige.md`) : θ = 75 mm, milieu du vide mesuré (aucune pose réelle entre 45 et 115 mm de l'axe).

| mesure (vérité = pose finale de l'opérateur) | cuts jugés | vérité − axe, médiane | max | mauvaises voies désignées |
|---|---|---|---|---|
| corpus de novembre (rejeu du banc) | 743 | 4,1 mm | 27,2 mm | 29 sur 29 (à 118 mm de l'axe au moins) |
| garde d'octobre | 1 458 | 7,3 mm | 61 mm (un seul cut au-delà de 40) | 13 sur 13 |
| examens vierges (mesuré par CH-116) | 191 | 2,8 mm | 15,5 mm | 2 sur 2 |

Le cut au-delà de 40 mm (octobre, 2-20-f228, cut 646, 61 mm) : sa « vérité » est la pose de départ validée sans mouvement ; la pose livrée et les voisins 647 et 648 sont sur l'axe (PROBABLE : vérité douteuse).
Contre-vérification (`sorties/contre-verification.md`) : pas de fuite par la liste. Calée sur les seules lignes jamais touchées : 30 sur 30. Mise en œuvre indépendante : 30 sur 30, 3,1 mm d'écart par cut au plus.

## 2. Levier N : refus d'ancre, sans ricochet
Toute pose que le lot s'apprête à valider et dont le milieu est à plus de 75 mm de l'axe est différée. La pose refusée continue de nourrir le lot comme le livré : les autres cuts ne changent pas. Le levier ne valide rien.

| jugement | cuts | refus | vraies corrections | vraies fautes | autres cuts changés |
|---|---|---|---|---|---|
| garde d'octobre (R1, jugée contre la vérité, R6) | 2 362 | 13 | 13 | 0 | 0 |
| corpus, première passe | 4 016 | 32 | 29 (3 non jugés) | 0 | 0 |
| examens vierges (CH-116) | — | 3 | 3 | 0 | 0 |

- **Cible du ticket tenue.** Mauvaises voies du corpus 29 → 0 (cible : 15 au plus) ; aucune nouvelle ; justes 496 → 496 ; 10-50 mm 36 → 36 ; bons bloqués 4 → 4 ; différés 591 → 623. Examen 0511 : aucun cut changé.
- **R3.** Les 32 refus : 16 poses de la chaîne, 16 de la GCV2. Ricochets : 0. Ancre muette : 28 cuts sur 4 016, tous à moins de 20 m d'un bout de liste.
- **Éteint = livré** : 4 016 cuts identiques sur 4 016.
- **Parité banc / vrai service worker** : lot d'octobre 0-2310-lot2, 91 lignes identiques sur 91 ; 12/11 p23 : EN COURS.
- Corpus en zones du journal et passe fidèle : À FAIRE (après la parité).

## 3. Ce que le levier ne fait pas, et ce qui n'est pas mesuré
- Il se tait sans liste, à moins de 20 m d'un bout de liste, et quand la pose de départ ne se cale pas sur sa ligne ; la commande est alors celle du livré.
- Il ne repose pas les cuts refusés : un refus = un cut de plus pour l'opérateur (environ 1 pour 125 cuts). La reprise (N+) est figée avant tout rejeu (`reglage-fige-reprise.md`) et n'a pas été rejouée.
- Le signal de cap n'est pas mesuré : la position suffit, et le cap ne se lit pas dans une seule coupe.
- La garde d'octobre avait compté comme reculs 7 « verts changés » de C1 (CH-117) et D (CH-119) : ce sont des mauvaises voies de la chaîne (126 à 247 mm de la vérité).

## 4. Suite proposée
1. Intégrer N (`INTEGRATION.md`) dès la parité de 12/11 p23.
2. N+ par une session neuve : garde d'octobre d'abord, même jugement.
3. L'axe prédit comme référence des chantiers de voie (CH-119, 120, 122, 123).

# CH-124 : rapport (ancre indépendante de voie)

**Question du ticket.** Existe-t-il une ancre qui désigne la bonne voie dans les appareils de voie, connue au moment de décider et indépendante des poses d'Ariane ?

## 1. Réponse : oui (ÉTABLI)
L'axe de la voie relevée se prédit depuis la **trajectoire du véhicule de mesure**, lue dans la seule liste d'ESV du départ de la partie.
- Une coupe est perpendiculaire à la trajectoire, et la pose par défaut d'ESV (1 500,0 mm) est centrée dessus. Cheminée de plan en plan, la trajectoire se referme sur la pose par défaut suivante à 0,3 mm en médiane (1 052 poses par défaut, 22 listes).
- La trajectoire n'est pas l'axe : il faut le modèle du véhicule (deux pivots sur l'axe à 14 m, point de référence en porte-à-faux de 4 m), puis un calage local sur la voie courante intacte. Sans ce modèle, 242 cuts jugés sortent de 40 mm.
- Réglage figé avant tout jugement (`reglage-fige.md`) : θ = 75 mm, milieu du vide mesuré (aucune pose réelle entre 45 et 110 mm de l'axe).

| mesure (vérité = pose finale de l'opérateur) | cuts jugés | vérité − axe, médiane | max | mauvaises voies désignées |
|---|---|---|---|---|
| corpus de novembre (rejeu du banc) | 743 | 4,1 mm | 27,2 mm | 29 sur 29 (à 118 mm de l'axe au moins) |
| garde d'octobre | 1 458 | 7,3 mm | 61 mm (un seul cut au-delà de 40) | 13 sur 13 |
| examens vierges (mesuré par CH-116) | 191 | 2,8 mm | 15,5 mm | 2 sur 2 |

Le cut au-delà de 40 mm (octobre, 2-20-f228, cut 646, 61 mm) : sa « vérité » est la pose de départ validée sans mouvement ; la pose livrée et les voisins 647 et 648 sont sur l'axe (PROBABLE : vérité douteuse).
Contre-vérification (`sorties/contre-verification.md`) : pas de fuite par la liste. Calée sur les seules lignes jamais touchées : 30 sur 30. Mise en œuvre indépendante : 30 sur 30, 3,1 mm d'écart par cut au plus.

## 2. Levier N : refus d'ancre, sans ricochet (D-355 : allumé d'office en Vision 18)
Toute pose que le lot s'apprête à valider et dont le milieu est à plus de 75 mm de l'axe est différée. La pose refusée continue de nourrir le lot comme le livré : les autres cuts ne changent pas. Le levier ne valide rien.

| jugement | cuts | refus | vraies corrections | vraies fautes | autres cuts changés |
|---|---|---|---|---|---|
| garde d'octobre (R1, jugée contre la vérité, R6) | 2 362 | 13 | 13 | 0 | 0 |
| corpus, première passe | 4 016 | 32 | 29 (3 non jugés) | 0 | 0 |
| corpus, zones du journal et passe fidèle | 4 016 | 35 | 30 (5 non jugés) | 0 | 2 (voir R3) |
| examens vierges (CH-116) | — | 3 | 3 | 0 | 0 |

- **Cible du ticket tenue** (zones du journal, passe fidèle). Mauvaises voies 29 → 0 (cible : 15 au plus), aucune nouvelle ; justes 501 → 503 ; 10-50 mm 36 → 36 ; bons bloqués 4 → 4 ; différés 571 → 603. Validation croisée sur 6 lots tenus à l'écart : 29 → 0, justes 296 → 298. Examen 0511 : identique au livré.
- **R3.** Première passe : 16 refus sur des poses de la chaîne, 16 sur des poses de la GCV2. Deuxième passe : 3 poses refusées ; une pose refusée ne prend aucune des 10 écritures, si bien que 2 poses que le livré avait décidées sans les écrire sont écrites (12/11 p23, cuts 3736 et 5285, à 3 et 10 mm de la vérité). Aucun autre cut ne change. Ancre muette : 28 cuts sur 4 016, tous à moins de 20 m d'un bout de liste.
- **Éteint = livré** : 4 016 cuts identiques sur 4 016 (deux fois : ancien arbre, puis tronc fusionné avec la passe).
- **Parité banc / vrai service worker** (`sorties/parite/`) : lot d'octobre 0-2310-lot2, 91 lignes identiques sur 91, 3 refus différés des deux côtés (refaite sur l'arbre d'intégration corrigé fed03f7 : 0 écart). 12/11 p23, sur l'arbre d'intégration 1bc4532 sans réglage : 296 lignes identiques sur 311 ; les 15 lignes d'écart sont exactement les 15 de la parité à l'éteint (CH-121), aucune n'est propre à N ; les 15 refus sont différés des deux côtés ; passe 9 + 4 des deux côtés.

## 3. Sur le terrain (`sorties/production-liste.md`, `INTEGRATION.md`)
- L'instantané de la liste est pris au départ de chaque lot, pendant que le premier cut se décide (journaux des 24 lots : première pose à moins d'une seconde de la fiche de départ dans 5 lots). `sw-ancre.patch` seul aurait gardé « pas de liste » pour tout le lot dans ces cas et fait perdre à la GCV2 sa référence d'écartement : corrigé par `sw-ancre-liste.patch`, **à intégrer avant d'allumer**. Ni le banc ni la parité ne voient ce défaut.
- Aucun nouvel instantané en cours de lot sur 24. Une liste prise pendant ou après un lot ne fausse pas l'axe (une ligne touchée porte un drapeau et sort du calage) ; sur un cut dont la ligne a été réécrite, l'ancre se tait.
- L'ancre se tait aussi sans liste et à moins de 20 m d'un bout de liste. La commande est alors celle du livré.

## 4. Ce qui n'est pas fait
- Le levier ne repose pas les cuts refusés : environ 1 différé de plus pour 125 cuts. La reprise (N+) est figée avant tout rejeu (`reglage-fige-reprise.md`) et n'a pas été rejouée : à reprendre par une session neuve, garde d'octobre d'abord.
- Le signal de cap n'est pas mesuré : la position suffit, et le cap ne se lit pas dans une seule coupe.
- La garde d'octobre avait compté comme reculs 7 « verts changés » de C1 (CH-117) et D (CH-119) : ce sont des mauvaises voies de la chaîne (126 à 247 mm de la vérité).
- Suite proposée : l'axe prédit comme référence des chantiers de voie (CH-119, 120, 122, 123).

# CH-124 : quelle liste l'ancre lit-elle sur le terrain ? (journaux des 24 lots-parties du corpus, 14/11)

Source : `fichesDepart` et événements des 7 journaux du corpus (comptes et durées seulement). Un instantané de la liste d'une partie est pris à chaque fiche de départ, c'est-à-dire au départ de chaque séance (lot ou Écho), quand la page annonce le résumé de la liste « avant séance » (`listeApresChargement`) ; il remplace le précédent s'il diffère.

## 1. Ce que le service worker avait au premier cut (ÉTABLI)
| | lots-parties |
|---|---|
| fiche de départ du lot lui-même, avant la première décision (0,03 à 9,4 s avant) | 22 sur 24 |
| fiche du lot APRÈS la première décision (0,23 s après) | 1 (06/11 p13) |
| pas de fiche pour ce lot : instantané du lot précédent sur la partie, 7,4 min plus tôt | 1 (05/11 p9, second lot, 8 cuts) |
| nouvelle fiche (donc nouvel instantané) EN COURS de lot | 0 sur 24 |
| rechargement de page en cours de lot | 1 lot (06/11 p16 : 1 rechargement, 5 séries de captures vides) ; aucun nouvel instantané |
| redémarrage du service worker en cours de lot | aucun vu (pas d'événement dédié au journal : SUPPOSÉ complet) |
| partie déjà travaillée par un lot le même jour | 2 (les deux seconds lots : 125 et 66 validations avant) |
| la décision L1-e a eu sa référence d'écartement lue dans la liste | toutes ses décisions, dans les 24 lots |

**Course au départ du lot.** La fiche de départ arrive 0,3 à 2,3 s après le départ du lot, et l'instantané s'écrit ensuite (demande à la page, compactage, stockage). La première pose du lot (toujours le premier cut, dans les 24 lots) tombe à moins d'une seconde de la fiche dans 5 lots sur 24 : −233 ms, 34 ms, 64 ms, 319 ms, 700 ms. La première décision de la GCV2, elle, vient 0,7 à 49 s après la fiche.

## 2. Défaut trouvé dans `sw-ancre.patch`, et corrigé
L'ancre lisait la liste par `l1eTable`, qui garde sa lecture pour tout le lot, et elle la lisait dès la première pose. Dans les lots où l'instantané n'est pas encore écrit à cet instant (3 à 5 lots sur 24 d'après les marges), elle aurait gardé « pas de liste » pour tout le lot : ancre muette, et **référence d'écartement de la GCV2 perdue pour tout le lot**, alors que le livré la lit plus tard et l'a. Ni le banc ni la parité ne peuvent le voir (la liste y est en place avant le premier cut).
Correctif `sw-ancre-liste.patch` (après `sw-ancre.patch` ; éteint : aucune ligne exécutée) : l'ancre lit elle-même l'instantané, sans toucher à `l1eTable` ; l'absence n'est jamais gardée (relue au cut suivant) ; pendant ses 6 premières lectures du lot un instantané plus récent remplace le premier lu ; ensuite la liste est figée pour le lot. Essai `tests/ch124-ancre-liste-sw.test.cjs` : rouge avant (référence perdue), vert après ; vérifié aussi sur l'arbre d'intégration 1bc4532.

## 3. Liste prise pendant ou après un lot : l'ancre peut-elle refuser à tort ?
- **L'axe ne vient pas des rails réécrits.** Il vient de la position et de l'orientation des plans de coupe (une pose réécrite reste dans son plan), des poses par défaut d'ESV, et d'un calage sur la voie courante : lignes valides, sans drapeau, écartement de 1 428 à 1 446 mm. Toute ligne touchée par Ariane ou par l'opérateur porte un drapeau et sort du calage. Mesuré sur le corpus : liste exportée contre liste du départ, 3,1 mm d'écart par cut au plus. Essai de synthèse (`tests/ch124-ancre.test.cjs`) : 37 lignes réécrites, dont 21 validées sur l'autre voie ; l'axe des autres cuts bouge de moins de 1,5 mm, aucun refus à tort.
- **Sur un cut dont la ligne a été réécrite depuis l'instantané, l'ancre se tait** (`calage-ligne` si les deux rails ont bougé différemment, `calage-lot` si la paire a bougé d'un bloc) : la commande est celle du livré. C'est ce que CH-116 a mesuré en rejouant un lot avec la liste prise après lui.
- **Limite connue (SUPPOSÉ rare, jamais vue).** Tant que le lot n'a noté qu'un seul cut, une ligne déplacée d'un bloc (les deux rails du même vecteur, à 2 mm près) depuis l'instantané serait crue : le jugement de ce premier cut serait décalé d'autant. Il peut alors différer une bonne pose ; il ne peut rien valider. Dès le deuxième cut les translations se départagent.

## 4. Faut-il une copie de l'instantané gardée à part pour le lot ?
Non mesuré comme nécessaire : aucun nouvel instantané en cours de lot sur 24, et un instantané plus récent ne fausse pas l'axe (§ 3). Le besoin réel était la course du départ (§ 2).

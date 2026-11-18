# Maquette `app-pile` — Pile de cartes

**Logique en une phrase.** Un portefeuille : chaque chose dont l'opérateur s'occupe est une carte pleine (Lot, À regarder, File, Écho) dont l'en-tête reste visible avec son chiffre clé ; on touche un en-tête, la carte vient devant ; la carte « À regarder » contient un paquet qu'on traite cut par cut, d'un geste ou par les boutons.

## Références et ce qui en est pris
- SwiftPieces, WalletStack (« header strips stacked so every header strip shows: tap one and it rises to the top and opens to its whole face », les autres rangées en lamelles ; couleurs pleines + encre foncée dans les deux thèmes).
- SwiftPieces, SwipeDeck (« a tinted outcome badge buds in … and stamps at the threshold », « the cards beneath rise one after another ») et son guide (décider sur la projection, garder la vitesse du doigt).
- mobbin, glossaire « Card » et « Stacked List » ; 60fps, « Trackables card morph to screen » ; v0, Tasko (une tuile dominante).

## Sens des signes
- La couleur d'une carte dit **quelle carte** : bleu ardoise = Lot, beurre = À regarder, lilas = File, sauge = Écho. Jamais un état.
- L'état est un mot et une forme dans l'en-tête (rond creux, rond plein, deux barres, carré, coche, flèche circulaire). Seule pastille de couleur d'état : brique « file arrêtée » avec triangle.
- Paquet : jeton « Vu ✓ » à gauche, « Ouvrir dans ESV » à droite ; il apparaît à 30 % du seuil et se fixe au seuil (35 % de la largeur).
- Bouton plein encre = l'action ; contour = second ; pointillés = impossible, raison écrite dessous.

## Partition de mouvement
| Événement | Ce qui bouge | Durée, courbe | Sens | Mouvement réduit |
|---|---|---|---|---|
| Toucher un en-tête | la carte monte à sa place, les autres glissent dans la pile (même nœud, trajet animé) ; la face entre avec un fondu retardé | 360 ms `(.2,.8,.2,1)` ; face 360 ms | une carte qui vient devant (portefeuille) | cartes posées sans trajet |
| Geste sur le cut du dessus | suit le doigt, tourne de 8° max ; jeton qui apparaît | direct | décider avant de lâcher | boutons seulement (le geste reste possible, sans rotation à l'écran) |
| Lâcher au-delà du seuil (à gauche) | la carte s'envole à gauche puis « Marqué comme vu » ; la suivante se lève | 260 ms `(.3,0,.8,.4)` | cut traité, au suivant | changement sur place |
| Lâcher à droite / en deçà | « Ouvrir dans ESV » (à droite), puis retour au centre avec un petit dépassement | 420 ms `(.2,.9,.25,1.12)` | on revient au paquet | retour sans dépassement |
| Arrivée d'un cut | chiffre de la face monte de 0,15 em ; chiffre de l'en-tête s'éclaire ; jauge s'allonge | 240 ms ; 360 ms | progrès lisible même carte fermée | sur place |
| Nouveau reste | compteur de l'en-tête « À regarder » descend en place | 260 ms | | changé |
| « Arrêter » | bouton brique + trait qui se vide | 4 000 ms | | absent |
| Total inconnu | trame qui défile dans la jauge | 1 000 ms linéaire | ça tourne | fixe |

## Pourquoi sans filiation
Motif de portefeuille et de paquet à balayer (apps de cartes, de tri), conçu à partir des références et du seul moteur commun.

## Ni voie ni nuage
Des cartes pleines et des chiffres ; la coupe n'apparaît qu'au dos d'un cut examiné, comme une donnée.

## Autocritique
- En thème sombre, la carte ouverte reste pâle : c'est voulu (couleurs de carte fixes) mais l'éclat surprend.
- Les cartes ouvertes ont du vide entre le compte et les actions (les actions sont posées en bas de carte comme un billet).
- Le geste de balayage est une habitude d'app de tri ; à la souris, les boutons restent le chemin principal.

## Chiffres du vérificateur (dernier passage)
Vérificateur, 20 scènes × 2 thèmes × 3 largeurs, mouvement réduit : `app-pile : 5778 textes mesurés, contraste minimal 6.04:1, 0 écarts, 0 erreurs de console`. Scénarios en mouvement normal (clair et sombre, 360 / 420 / 600) joués et regardés image par image : 0 erreur de console. Défilement interne conservé au fil des tics (mesuré).

# Maquette `app-feuille` — Feuille à crans

**Logique en une phrase.** Un écran de carte sans carte : derrière, un visage lisible à trois mètres (l'état, le compte en très grand, le temps) ; devant, une feuille du bas non modale à trois crans (Résumé, Lot, Tout) qui porte le détail et les rares actions, et dont le cran suit l'état.

## Références et ce qui en est pris
- mobbin, glossaire « Bottom Sheet » : crans (« snap points »), feuille **non modale** (on agit encore derrière), « pas pour une tâche principale » → la tâche principale (surveiller) reste au visage, la feuille porte le secondaire.
- beUI, composant « Bottom Sheet » (points d'arrêt, seuil de renvoi) et guide de mouvement (feuille 200–500 ms ; l'ancien contenu part plus vite que le nouveau n'arrive).
- 60fps, « Recollect Pro bottom sheet to page » : la même surface grandit (vu image par image).
- SwiftPieces : ScrollIsland (« which part am I in, how much is left »), block Agent Run (état, horloge, Pause, Stop confirmé, bilan), StepTrail (file de parties), rôle « value » (un chiffre lu ne dépasse jamais).
- navbar.gallery, type « Announcement » : incidents en bande mince en tête.

## Sens des signes
- Bleu pétrole : l'action à faire et le progrès d'Ariane. Ambre (fond pâle) : à regarder (différés, à examiner, ESV à relier). Brique : arrêt. Vert : fait.
- Formes de l'état, toujours avec le mot : rond creux = prêt, rond plein = en cours, deux barres = pause, carré = arrêté, coche = fini, flèche circulaire = relecture, œil = Écho, triangle = alerte.
- Barre pleine = total connu ; barre entièrement hachurée qui défile = total inconnu (aucune quantité suggérée).
- Écho verrouillé pendant un lot : cadenas + titre « Mettre le lot en pause pour passer en Écho ».

## Partition de mouvement
| Événement | Ce qui bouge | Durée, courbe | Sens | Mouvement réduit |
|---|---|---|---|---|
| Changement de cran (bouton, poignée, clavier ↑↓) | hauteur de la feuille | ouvrir 480 ms `cubic-bezier(.2,.9,.25,1.03)` (léger dépassement) ; fermer 300 ms `(.3,0,.2,1)` sans rebond | la même surface grandit ; ouvrir prend son temps, fermer s'efface | hauteur posée sans trajet |
| Feuille tirée à la main | suit le doigt 1:1, élastique au-delà des crans (×0,25) ; au lâcher, cran visé = position + vitesse × 180 ms | puis animation de cran | la feuille va là où le geste allait (projection, SwiftPieces / KoiPond) | suit le doigt, se pose sans trajet |
| Changement d'état (phase, vue) | cran conseillé (en cours → Résumé ; pause, arrêt, fin → Lot ; reste, examen → Tout) ; mot d'état monte de 6 px | 240 ms ease-out (0.16,1,0.3,1) | l'état choisit la hauteur utile | mot remplacé sur place |
| Arrivée d'un cut | grand chiffre monte de 0,18 em, opacité 0,35→1 ; barre s'allonge (forme) | 260 ms sans rebond ; barre 360 ms | « un de plus », jamais un chiffre faux en vol | chiffre et barre changent sur place |
| Nouveau différé / vert | son compte grossit 1→1,25→1 | 360 ms ease-out | quelque chose s'ajoute à regarder | rien, le chiffre change |
| « Arrêter ce lot » | bouton s'élargit en « Confirmer l'arrêt » ; trait clair qui se vide | largeur 360 ms ; trait 4 000 ms linéaire | le temps qu'il reste pour confirmer | trait absent, libellé suffit |
| Incident / alerte de file | bande d'annonce descend du haut | 280 ms ease-out | ce qui arrive d'en haut ne bouge pas le visage | apparaît |
| Total inconnu | hachures qui défilent en boucle | 1 800 ms, aller simple | « ça tourne », sans quantité | hachures fixes |
| Message bref | toast descend de 8 px | 220 ms | | apparaît |

## Pourquoi sans filiation
Partie d'une page blanche et d'un motif d'app (la feuille de Plans / Uber / Localiser, vue sur mobbin et 60fps), sans ouvrir l'interface actuelle ni les autres maquettes. Seuls `commun.js`, `construire.cjs`, `verifier.cjs` et le squelette ont été lus.

## Ni voie ni nuage
Le visage est un chiffre et une barre ; aucune illustration de voie, de rail ou de nuage ; la coupe n'apparaît que dans « Examiner un cut », comme une donnée encadrée et légendée.

## Autocritique (ce qui peut encore faire « vibe codé »)
- Au cran Résumé, sur 760 px, il reste un vide sous le trio ; le vide est voulu (lisible de loin) mais peut paraître inachevé.
- La police à chasse fixe pour le grand chiffre est un choix de style ; un opérateur peut la trouver « technique ».
- La feuille a une ombre portée : c'est sa seule ombre, mais elle reste un effet.
- Le geste de poignée n'a pas de retour sonore ni haptique (sans objet dans une extension).

## Chiffres du vérificateur (dernier passage)
Vérificateur, 20 scènes × 2 thèmes × 3 largeurs, mouvement réduit : `app-feuille : 6150 textes mesurés, contraste minimal 5.89:1, 0 écarts, 0 erreurs de console`. Scénarios en mouvement normal (clair et sombre, 360 / 420 / 600) joués et regardés image par image : 0 erreur de console. Défilement interne conservé au fil des tics (mesuré).

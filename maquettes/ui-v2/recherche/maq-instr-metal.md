# Maquette instr-metal (« Pupitre »)

**Logique en une phrase.** Un pupitre de métal où la lumière dit qui doit agir : un faisceau fait le tour de la fenêtre de comptage tant qu'Ariane avance seule, la touche attendue respire quand c'est à vous, et rien ne s'allume quand rien ne se passe.

## Références et ce qui en est pris
- libraries.dev, border-beam (`styles.ts` : cône `conic-gradient` qui tourne via `@property --beam-angle`, masqué en `content-box` pour ne garder que le bord ; fondu d'entrée 0,6 s ; `pulseDriver.ts` : respiration lente 2,3 s, coupée en mouvement réduit). Deux familles, deux sens : rotation = avancée, respiration = présence/attente. Couleur mono uniquement (pas d'arc-en-ciel).
- libraries.dev, metal-fx (README, `cursor/light.ts`, page Metal survolée) : la matière autour d'un seul élément ; ici la plaque brossée et les touches à course de 2 px.
- Scrubbers, `TapeFace.swift` (lecture qui roule chiffre par chiffre) → rouleaux d'odomètre ; `ScrubberScale.swift` + correspondance angulaire → molette à crans (36° par partie).
- ThinkingOrbs, horloge partagée (`ThinkingOrb.swift`) : la phase du faisceau et de la respiration est recalculée à chaque rendu, ils ne repartent jamais de zéro.

## Sens des signes
- Faisceau rapide (1,96 s/tour) autour de la fenêtre = Ariane pose seule ; lent (5,2 s) = Écho, elle observe. Personne n'a à agir.
- Respiration autour d'une touche = c'est à vous, cette touche (Continuer, Lancer, Exporter, Chercher l'onglet).
- Drapeau mécanique = l'état en toutes lettres derrière une lucarne ; ambre + triangle quand il faut agir.
- Rouleaux = ce qui reste (ou traités + « total inconnu ») et le cut en cours.
- Triangle = différé ; rond creux = à examiner ; rond plein = posé.
- Levier = Orbite/Écho ; interrupteurs = fin de partie, file ; molette à crans = nombre de parties.

## Partition de mouvement
| Événement | Ce qui bouge | Durée, courbe | Sens | Mouvement réduit |
|---|---|---|---|---|
| Arrivée d'un cut | rouleaux tournent d'un cran | 0,5 s, `cubic-bezier(.3,1.3,.5,1)` (léger dépassement) | compteur mécanique | chiffre posé |
| Changement d'état | le drapeau glisse vers le mot | 0,5 s, même courbe | l'état change de plaque | mot posé |
| En cours | faisceau tourne | 1,96 s linéaire, phase continue | Ariane avance | arc fixe à 200° |
| → pause / arrêt | faisceau s'éteint, la touche principale se met à respirer | 0,6 s fondu ; respiration 2,3 s | la main passe à l'opérateur | cadre fixe à 70 % |
| Compteurs posés/différés | chiffre « frappé » de haut en bas | 0,35 s | +1 | direct |
| Touches | course de 2 px, ombre qui disparaît | 0,08 s | touche mécanique | aucun |
| Levier / interrupteurs | bille qui bascule | 0,3 s, léger dépassement | bascule | direct |
| Molette | rotation au cran (36°) | 0,34 s ressort | nombre de parties | direct |
| Liste / modules | glissement 6 px + fondu, au changement de vue | 0,3 s, 28 ms de décalage | | aucun |

## Pourquoi sans filiation
Feuille blanche ; aucun fichier de l'interface ni autre maquette ouvert ; le vocabulaire (levier, molette, drapeau, rouleaux) vient d'un pupitre d'instrument.

## Pourquoi ni voie ni nuage
Une plaque, une fenêtre, des touches et de la lumière : rien ne figure une voie ni un relevé.

## Autocritique
- Le risque « skeuomorphe » : plaque brossée et touches en relief peuvent faire décor si on force ; brossage gardé à peine visible.
- Le faisceau mono est discret de loin ; c'est voulu (pas de lumière décorative), mais il faudra vérifier sur l'écran de terrain qu'il se lit à 2 m.
- Le drapeau contient des mots masqués que les lecteurs d'écran ignorent (aria-hidden), mais le vérificateur les mesure aussi : ils ont donc les mêmes couleurs.

## Vérificateur
`instr-metal : 13548 textes mesurés, contraste minimal 5.02:1, 0 écarts, 0 erreurs de console`. Jeu complet : 0 erreur ; molette tournée : 3 → 6 parties.

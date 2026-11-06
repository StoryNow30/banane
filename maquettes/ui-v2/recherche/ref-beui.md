# Référence : beui.dev

Lu le 29/10 dans Chromium. Fichiers : `scratchpad/mouv/rbe/` (textes, captures, code des onglets « Code »).

## Ce que j'ai ouvert exactement
- **Sections** : accueil (200), Components (200), Charts (200), Playground (200). **Les adresses « /blocks » et « /agents » répondent 404** (ÉTABLI) : les vraies sont sous « components/blocks » et « components/agents » ; je les ai trouvées dans le menu latéral et ouvertes ainsi.
- **Guide « Motion Guides »** (« Motion that explains, not distracts ») : lu en entier.
- **25 composants ouverts, documentation + code source public (onglet Code, lu)** : Timeline, Animated Alert, Sparkline, Card Dealer, Swipeable List, Voice Orb, Todo List, Streaming Response, Tool Approval, Agent Activity, Agent Loading States, Approval Card, Notification Stack, Dynamic Island, Line Chart, Bar Chart, Status Bar, Number Animation, Animated Toast Stack, Adaptive Stepper, Action Swap, Loader, Sortable List, Expandable Action Bar, Button ; Playground (explication d'un ressort).
- **Joués** : Card Dealer (« Deal 3 », rafale de 5 images à 110 ms), Status Bar (« Simulate incident »). Animated Alert : le bouton « Show alert » n'a pas répondu au clic automatisé (délai de 5 s dépassé, l'alerte était déjà ouverte) ; je l'ai lue dans le code.

## Le guide de mouvement (ÉTABLI, mot pour mot résumé)
- Quatre questions : **fréquence** (« 100× a day: no choreography »), **but** (« explain space, confirm input, show state, or soften a change… If you cannot explain why it moves, remove the movement »), **physique** (« ease-out for entrances, ease-in-out for movement, **linear for progress**, springs for gestures »), **repli** (« Reduced motion keeps useful opacity and color feedback while removing travel, scale, and parallax »).
- Jetons : `EASE_OUT [0.16, 1, 0.3, 1]`, `EASE_IN_OUT [0.77, 0, 0.175, 1]`, `EASE_DRAWER [0.32, 0.72, 0, 1]` ; ressorts `SPRING_PRESS (500/30/0.6)`, `SPRING_SWAP (460/30/0.55)`, `SPRING_PANEL (420/40/0.5)`, `SPRING_LAYOUT (360/32/0.6)`, `SPRING_GLIDE (700/50/0.5)` (raideur/amortissement/masse).
- Durées : appui 100–160 ms ; info-bulle 125–200 ms ; menu 150–250 ms ; feuille 200–500 ms ; « Under 300ms is the default for interface motion ».
- Recettes : « Content swap : let the old content leave faster than the new content arrives. Keep travel to a few pixels » ; « Layout continuity : move the shape first, then introduce its label » ; « Reduced motion is a designed state… Keep meaning. Remove travel ».

## Ce que le code m'apprend (ÉTABLI, lu)
- **Card Dealer** : chaque carte reste montée ; changer de zone (pioche → main → défausse) = changer une donnée, la carte vole en arc (`visualDuration 0.55, bounce 0.18`, arc négatif pour passer au-dessus) et se retourne en vol ; une carte qui change de place dans la main « saute » seulement (`0.4 / 0.2`) ; plusieurs cartes partent l'une après l'autre (`STAGGER 0.045 s`, fenêtre max 0,6 s) ; une table de positions précédentes distingue vol, saut et immobilité ; mouvement réduit ou redimensionnement = durée 0.
- **Number Animation** : chaque chiffre est une colonne 0–9 qui glisse (`y = -digit × 1.1em`), découpée par `clip-path: inset(0)` pour garder la ligne de base ; **les chiffres sont identifiés par leur rang depuis la droite**, donc un chiffre qui change roule au lieu de réapparaître ; le décalage entre chiffres n'est joué qu'à l'entrée (« a per-digit delay on live updates reads as lag ») ; texte lisible `sr-only` à côté.
- **Todo List** : statuts par forme, pas par couleur : en attente = cercle pointillé (`2 3`) ; en cours = arc qui tourne (1,1 s linéaire) ou arc proportionnel si la progression est connue ; fait = coche tracée (`pathLength`, 0,24 s) ; annulé = rose + trait. La liste annonce en `aria-live="polite"`.
- **Swipeable List** : ressort de relâche dépendant de la distance (`560/48/0.82`), seuils d'ouverture 46 % et de fermeture 72 %, vitesses 720/320.
- **Streaming Response** : le texte avance par curseur à vitesse fixe (`requestAnimationFrame`), `aria-busy` pendant l'arrivée, en mouvement réduit le texte est complet d'emblée.
- **Status Bar** : une barre par jour, arrondie, trois états avec légende écrite (Operational, Degraded, Outage) ; un incident ajoute une barre à droite et change le mot d'état.
- **Animated Alert** : `role="alert"` pour avertissement/erreur, `status` sinon ; entrée 6 px + opacité 0,18 s, sortie 0,12 s (plus rapide que l'entrée).
- **Voice Orb** : sphère liquide pilotée par l'analyse du micro ; en mouvement réduit, aucune transformation.

## Ce que j'en retiens pour Ariane
- Des **objets qui gardent leur identité** et changent de zone (Card Dealer) : un cut différé est une carte qui quitte le flux et rejoint la pile « ce qui reste ».
- **Formes de statut** (pointillé / arc / coche / trait) : l'état ne dépend jamais de la couleur seule.
- **Compteur à colonnes** : les traités qui roulent, « total inconnu » écrit en toutes lettres.
- **Barres de statut par période** : une barre par cut traité est une trace honnête et lisible de loin.
- Jetons de durée et de courbe réutilisés tels quels comme principes (je réécris mes propres courbes CSS).

## Ce que j'écarte
- L'orbe vocale, les lueurs, le shader : décor sans sens pour un lot.
- Les gestes de balayage pour agir : le panneau se pilote au clic, de loin ; le geste devient une transition jouée, pas une interaction exigée.

## Limites d'accès (exactes)
- « /blocks » et « /agents » : HTTP 404 (adresses d'index erronées, pas un refus).
- « Show alert » : `locator.click: Timeout 5000ms exceeded` (bouton non cliquable à ce moment).
- Composants « Pro » : non ouverts (payants).

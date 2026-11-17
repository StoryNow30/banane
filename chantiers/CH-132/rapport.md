# CH-132 : rapport (agent) — trois directions pour l'interface du panneau (D-365)

Branche `chantier/CH-132`, partie du tronc 001c12f. Rien n'entre au tronc : c'est un choix de direction, l'opérateur décide. Page : `chantiers/CH-132/directions.html` (vrai panneau à l'échelle 1, 600 px par défaut, curseur de 360 à 720 px, 19 scènes, palettes Glacier, Sarcelle et Signal, vue « Comparer » qui met les trois côte à côte).

## Les trois directions (une feuille chacune, `chantiers/CH-132/directions/`)
- **A · Instrument** (`instrument.css`) : l'actuel poussé au bout. Un seul grand repère au centre (anneau de 210 px, chiffre de 64 px, phrase courte dessous), une seule action pleine, les autres en liens discrets, la trace des cuts derrière « Détails » ; pas de cartes, un filet sous l'en-tête. Sacrifie la densité.
- **B · Console** (`console.css`) : outil professionnel, proche de la page à 73 % qu'il a aimée. Petite typographie (11 à 15 px), aucune carte, sections à filets, compteurs (traités, posés, à poser) alignés d'emblée sur une ligne, petit cadran à gauche de la phrase, boutons bas rectangulaires. Sacrifie le grand chiffre lisible de loin.
- **C · Fil** (`fil.css`) : une chronologie. En-tête d'état (mot, partie, phrase, avancement chiffré à droite), puis le fil des derniers cuts en texte sur toute la hauteur, les actions collées en bas. Sacrifie l'anneau et la vue d'ensemble immobile.
- Communs : phrases courtes, consignes visibles, palettes, écran des statistiques de la Constellation, mêmes ordres. Dans les trois, l'alerte de la Constellation passe avant le choix du nombre de parties (elle demande un geste).

## Mesures (ÉTABLI, `chantiers/CH-129/outils/audit.cjs` avec `FEUILLE_EN_PLUS` et un contrôle des tailles de police)
- Chaque direction : 13 scènes × 360, 600 et 720 px × 3 palettes = 117 vues ; 0 débordement, 0 troncature, 0 contraste sous 4,5:1, aucun texte sous 11 px. Défauts trouvés et corrigés en route : « % » à 10,5 px (A et C), phrase coupée et coche géante en fin de lot à 360 px (C).
- Règle ajoutée à l'audit (intégrateur, 17/11) : aucun anneau ni son halo (voile `::before`, ombre portée de l'arc) à moins de 12 px d'un bord qui coupe (premier parent en `overflow` non visible). Sur la version précédente, B · Console échouait à 600 px : anneau à 0 px du bord gauche, halo à -6 px (27 vues sur 39). La règle a aussi trouvé B au repos (8 px du bas) et C dans l'Aurore à 360 px (10 px de gauche). Corrigés : marge intérieure de 18 px à gauche, à droite et en bas de la tuile d'état de B ; 4 px de plus à gauche de l'anneau de C. Après correction : 0 défaut sur 117 vues dans chaque direction.
- Scène ajoutée : Constellation arrêtée sur une correction interrompue (Vision 19.1), « J'ai contrôlé le cut 2475 » en premier bouton (relevé dans le vrai panneau).

## Limites
Aucun fichier du panneau modifié (`src/`, `panel-signal.css` inchangés) ; les directions sont des feuilles posées par-dessus. Non vérifié : Chrome à côté d'ESV.

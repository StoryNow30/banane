# CH-101, étape 1 : trois propositions pour le panneau (rien n'est intégré)

- `index.html` : la page à comparer, **sans capture** (aucune image du panneau dans le dépôt). Elle est fabriquée par `node maquettes/ui-ch101/generer.cjs` ; ne pas la retoucher à la main.
- `style.css` : les trois propositions, chacune sous sa classe (`.pa` Plan de voie, `.pb` La coupe, `.pc` Main courante). Polices du dossier `fonts/`, aucune ressource extérieure.
- `generer.cjs` : le lot fabriqué (partie 13, cuts 4790 à 4900), les huit états, les trois rendus et la critique de l'existant. Avec `--captures DOSSIER --sortie FICHIER`, il inclut les captures du panneau actuel et les polices : cette page-là reste hors dépôt.

## Règle de couleur commune aux trois
La couleur répond à une seule question : « dois-je faire quelque chose ? ». Sûr (acquis) ; à toi, plein = maintenant, contour = plus tard ; en panne. Ariane qui travaille n'a pas de couleur. Aucun bouton ne porte une couleur de sens.

## Mesuré (ÉTABLI)
- Existant photographié : `panel.html` du tronc dans Chromium, montage des essais de navigateur, 19 états en 600 × 760 et 360 × 480, aucune erreur de page. Ce n'est pas la chaîne extension → maquette ESV.
- Existant : texte tertiaire à 3,9:1 sur le fond (seuil 4,5:1).
- Propositions : 8 états × 3, en 360 × 480 et 600 × 760 : aucun élément ne sort du cadre, tout texte à 4,5:1 au moins.

## SUPPOSÉ, à vérifier avant l'étape 2
- Le rail concerné pendant la pause « rail non résolu » (connu pour les cuts à poser, pas vérifié pour la pause).
- Le détail par cut du rattrapage (le panneau reçoit le cut en cours et le compte).
- Textes proposés : « ESV connecté » ; la phrase de la pause sans « ou le passer » (bouton masqué, D-320).

L'étape 2 attend le choix écrit de l'opérateur.

# Tour 2 (D-324) : `tour-2/`

Les trois propositions du premier tour (fichiers à la racine de ce dossier) sont **rejetées** par l'opérateur. Le tour 2 ne touche qu'à l'apparence : mêmes textes, mêmes boutons, mêmes informations que le panneau du tronc.

- `tour-2/style.css` : `.p1` « Signal, fini » (l'organisation actuelle, soignée), `.p2` « Système » (cartes et boutons arrondis, à la manière des panneaux de Chrome), `.p3` « Sobre » (titre, liste de lignes, presque sans couleur). Police du système, aucune ressource extérieure, thèmes clair et sombre.
- `tour-2/generer.cjs` : les huit états, relevés sur les photographies du panneau du tronc, et la page. `tour-2/index.html` est fabriquée par ce script, sans photographie.

Mesuré par script sur les 96 cadres (3 propositions × 8 états × 2 tailles × 2 thèmes) : aucun élément ne sort ni ne se tronque, tout texte actif à 4,5:1 au moins. Deux relectures par un agent neuf, sur images seules ; leurs défauts majeurs sont corrigés, sauf le vide de la fenêtre 600 × 760, qui vient de l'organisation actuelle.

Non vérifié : le rendu des caractères sur le poste de l'opérateur (les images de contrôle ont été faites avec Inter, police du système de la machine de travail).

# Référence : Carbon Design System, motif « Status indicators » — famille « info- »

## Ouvert exactement
Page « Patterns > Status indicators » de carbondesignsystem.com (mise à jour indiquée : 12 août 2026), lue en entier dans Chromium (texte complet extrait, 18 400 caractères) et quatre captures ciblées (sections « Status shapes », « Icon indicator statuses », « Shape indicator statuses », « Severity levels »). ÉTABLI. Les images d'exemple des formes ne se sont pas chargées dans mes captures (chargement différé) : les formes exactes de Carbon sont donc SUPPOSÉES d'après le texte, pas vues.

## Ce que j'y ai lu (ÉTABLI)
- Quatre éléments composent un indicateur : **symbole, forme, couleur, texte** ; « pour WCAG, au moins trois de ces éléments doivent être présents ». Ailleurs dans la même page : au moins deux parmi couleur, forme, symbole, plus le texte.
- Cinq variantes : icône (forme + symbole + couleur + libellé), forme (petits espaces, listes), badge avec nombre, badge sans nombre, indicateur différentiel (+/−, chevron ou flèche obligatoire, la couleur est facultative).
- **Statut consolidé** : un groupe prend la couleur de son élément le plus grave (vert + jaune + rouge → rouge).
- **Charge cognitive** : ne pas mettre d'indicateur quand aucune action n'est demandée ; au-delà de cinq ou six indicateurs, l'utilisateur se perd.
- **Niveaux de gravité** : haute (action immédiate : alerte, erreur, confirmation destructive), moyenne (pas d'action immédiate, accusé de réception, progression), basse (prêt à voir, changement depuis la dernière visite).
- Formes à valeur culturelle : en signalisation, l'hexagone dit « stop », le triangle pointe en bas dit « cédez » ; un mauvais usage casse la reconnaissance apprise. Angles droits = ordre ; courbes = continuité.
- Palette d'état : rouge 60 (#da1e28) danger, orange 40 (#ff832b) avertissement sérieux, jaune 30 (#f1c21b) avertissement, vert 50 (#24a148) normal, bleu 70 (#0043ce) information/progression, gris 60 (#6f6f6f) brouillon / pas commencé, violet 60 (#8a3ffc) hors norme. Le jaune et l'orange clairs exigent un **contour** (yellow 60 #8e6a00, orange 60 #ba4e00).
- Alignement : formes à gauche du libellé, jamais après un texte de longueur variable.
- Accessibilité : 3:1 entre l'indicateur et le fond, distinguable en niveaux de gris.

## Ce que j'en retiens pour Ariane
- La règle des **3 éléments sur 4** devient ma règle de vérification : chaque état du panneau porte forme + mot + (couleur ou symbole). Le noir et blanc doit suffire.
- **Statut consolidé** = l'en-tête du panneau prend la gravité la plus haute présente (maquette info-gravite surtout).
- **Gris = pas commencé / neutre** : Prêt, En pause et Arrêté par l'opérateur sont gris (ce ne sont pas des fautes), seul l'arrêt subi (alerte de file, refus d'ESV) monte en rouge.
- **Pas d'indicateur quand rien n'est à faire** : un lot qui tourne bien n'a pas de pastille d'état colorée.
- Différentiel : pour une tendance de cadence, une flèche ou un signe obligatoires, la couleur facultative.

## Ce que j'écarte
- Le violet « hors norme » et le bleu « information » comme couleurs d'état : trop de couleurs pour un panneau de 360 px (Carbon dit lui-même cinq ou six indicateurs au plus). Je garde trois niveaux.
- Les badges avec nombre sur bouton d'icône : pas d'icône-bouton dans ce panneau.
- La police de la marque (IBM Plex) : ce serait emprunter une identité.

## Erreurs d'accès
Aucune (statut 200). Images d'exemples non chargées dans les captures (chargement différé), noté plus haut.

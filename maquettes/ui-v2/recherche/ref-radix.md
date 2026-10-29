# Référence : Radix Colors (échelles à 12 pas) — famille « info- »

## Ouvert exactement
- Page d'accueil « Colors » de radix-ui.com (texte et capture) — ÉTABLI.
- « Docs > Palette composition > Understanding the scale » — lue en entier — ÉTABLI.
- « Docs > Palette composition > Scales » — ÉTABLI.
- Valeurs exactes : lues dans le navigateur, sur la page « Scales », depuis les variables CSS que la page elle-même charge (`--sand-1` … `--sand-12`, etc.), en clair puis en sombre (classe sombre du site). Fichier : info/refs/radix-valeurs.txt — ÉTABLI.
- Tentative de récupérer le paquet npm officiel des couleurs : **refusée par le classificateur de permissions de ma session** (« Code from External »). Je n'ai pas contourné ; la lecture des variables CSS de la page suffit.

## Ce que j'y ai lu (ÉTABLI)
Chaque pas a un usage : 1 fond d'application, 2 fond discret, 3/4/5 fonds de composant (repos, survol, pressé/sélectionné), 6 bordures non interactives, 7 bordures interactives et anneau de focus, 8 bordure survolée, 9 aplat le plus pur (le plus de chroma), 10 aplat survolé, **11 texte peu contrasté, 12 texte très contrasté**. « Les pas 11 et 12 garantissent Lc 60 et Lc 90 APCA sur le pas 2 de la même échelle. » La plupart des pas 9 portent du texte blanc ; ciel, menthe, citron vert, jaune et ambre portent du texte foncé. Le sombre n'est pas une inversion : c'est une échelle à part (pas 1 sombre #111110 pour sand).

## Mes mesures (outil à moi, formule WCAG 2 et APCA réécrites ; l'APCA retrouve Lc 75,6 sur la paire d'exemple du calculateur APCA)
- gray 11 #646464 sur gray 1 #fcfcfc : 5,77:1, Lc 77,8 ✔
- sand 11 #63635e sur sand 2 #f9f9f8 : 5,73:1 ✔ ; sombre sand 11 #b5b3ad sur sand 2 #191918 : 8,39:1, Lc −60 ✔
- amber 11 #ab6400 sur blanc : 4,61:1 (juste) ; amber 12 #4f3422 sur amber 5 #fbe577 : 8,98:1 ✔
- **red 9 #e5484d avec texte blanc : 3,91:1 ✘** → un aplat rouge ne peut pas porter du texte blanc normal ; je prends red 11 #ce2c31 (5,21:1 sur blanc) pour un aplat porteur de texte, ou du texte red 12 sur red 3.
- amber 9 #ffc53d avec texte sand 12 : 10,33:1 ✔ (aplat ambre = texte foncé, comme Radix le dit).

## Ce que j'en retiens pour Ariane
- **Une seule échelle neutre chaude (sand)** pour tout le panneau ; trois échelles d'état au plus : **amber** (à regarder), **red** (à agir), et une échelle froide pour l'action principale (indigo ou blue selon la maquette).
- Rôles fixés par pas : texte 12, texte secondaire 11, bordures 6/7, fonds 2/3, aplats 9 (ambre) ou 11 (rouge, à cause du 3,91:1 mesuré).
- Thème sombre = les échelles sombres, jamais une inversion calculée.

## Ce que j'écarte
- Les variantes alpha (transparence) : le vérificateur mesure les couleurs de fond CSS ; je préfère des aplats opaques.
- Le gamut P3 : sans intérêt mesurable ici.

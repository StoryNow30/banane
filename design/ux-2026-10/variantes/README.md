# Orbite, moitié basse : quatre variantes (13 octobre 2026)

Commande : `../BRIEF.md`. Le haut d’Orbite (piste H) ne change pas ; ici, de
« Activité » jusqu’au pied. Données fictives, les mêmes partout (lot en cours,
partie 34). Chaque variante : maquette HTML autonome (`?theme=sombre` ou
`?theme=clair`), PNG 480 px ×2 en sombre et en clair.
Planche : `planche-comparative.png` (l’actuel et les quatre, en sombre).
Régénérer : `node design/ux-2026-10/variantes/rendre.cjs`.

## Ce qui change dans les quatre

- **Plus de liens gris** : chaque export est une ligne entière, lisible, avec
  sa flèche. « Tout télécharger » est la première et la plus forte.
- **Plus de vide ni de paragraphes** : la phrase d’explication tient en une
  ligne de pied ; les exports disent « construit sur ce poste ».
- **La politique effective, enfin lisible** : aujourd’hui deux lignes disent
  « Politique effective de ce lot » avec deux valeurs contraires. Elles
  deviennent « Rail non résolu → continuer et différer » et « Faible confiance
  → mettre le lot en pause », plus « Décision sur le lot → appliquée ».
- **« Différés : N »** reste à sa place, en ambre, à droite de l’état du lot.
- **Résumé de la partie** : des chiffres au lieu d’une phrase repliée.

## Les variantes

| | Idée | Pour | Contre |
|---|---|---|---|
| **A · Tuiles** | Porsche : tuiles arrondies, gros chiffres, une jauge verte (posées / traitées), lignes icône + libellé + chevron | La plus lisible au premier coup d’œil ; chaque tuile = une idée ; belle | La plus longue (≈ 1 760 px) ; le dégradé vert rompt un peu avec le noir du haut ; plus « appli » que « outil discret dans ESV » |
| **B · Filet** | La ligne H jusqu’au bout : noir, filets, libellé à gauche et valeur à droite ; actions en barre de pied | Continue le haut sans couture ; sobre, dense mais aéré ; un seul bouton plein | Moins de « héros » ; reste une page à défiler (≈ 1 330 px) |
| **C · Onglets** | Commandes d’abord, état + politique toujours visibles, puis un seul contenu à la fois (Activité, Partie, Exports, Départs) | La plus courte (≈ 700 px) ; on sait quoi regarder ; rien de caché d’important | Un clic de plus pour les exports ; un composant nouveau dans le panneau |
| **D · Tableau** | Tableau des départs (piste E) : grille mono, cuts en palettes, exports en touches | Caractère fort, très « poste de commande » | Capitales mono plus lentes à lire ; s’éloigne du haut H |

PNG : `A-tuiles-*.png`, `B-filet-*.png`, `C-onglets-*.png` (et
`C-onglets-exports-*.png`, l’onglet Exports ouvert), `D-tableau-*.png`.

## Recommandation

**B · Filet**, avec la jauge verte de A sous les chiffres de la partie si tu
la veux. B prolonge le haut que tu aimes, respecte « un bouton plein, le
rouge pour ce qui ne se défait pas », et s’intègre en gardant tous les `id=`
sans nouveau composant. Si tu veux surtout raccourcir la page : **C**.

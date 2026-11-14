# Référence : insposite.com (répertoire de portfolios, d'inspiration et d'outils)

## Ce que j'ai ouvert exactement (Chromium, navigation ordinaire, 29/10)
- Les **5 pages** de la liste (bouton « Next », « Page 1 of 5 » à « Page 5 of 5 »), 70 sites recensés au total, classés Portfolio / Inspiration / Tool. ÉTABLI.
- La page elle-même : titre en deux lignes, la seconde dans une serif condensée bleue (« For People Who Build »), filtres en pastilles, cartes vignette + nom + catégorie + pseudo. Liste propre, peu utile en soi. ÉTABLI.

## Sites recensés que j'ai ouverts (16 tentés, 13 lus)
| Site (page de la liste) | Résultat | Ce qui sert ce produit |
|---|---|---|
| emilkowal.ski (p. 1) + deux articles : « You Don't Need Animations », « 7 Practical Animation Tips » | 200, lus en entier | **La règle de mouvement du panneau.** Animer seulement ce qui a un but ; la fréquence décide (un geste répété cent fois par jour ne s'anime pas) ; une animation d'interface reste **sous 300 ms** ; sortie/entrée en **ease-out** (courbe personnalisée, pas l'ease-in qui « paraît lent ») ; bouton pressé à **scale(0.97)** ; ne jamais partir de scale(0) mais de 0,9+ ; un indicateur qui tourne plus vite fait paraître le chargement plus rapide. Page d'accueil elle-même : une colonne de texte, titres gris 14 px, aucune image : le récit nu. |
| minimal.gallery (p. 2) | 200 | Galerie sur fond noir, étiquettes texte ; rien de neuf pour un panneau. |
| 60fps.design (p. 2) | 200 | « Endless collection of delightful details » : interactions d'applications filmées, classées par nom de composant ; confirme que le détail animé doit montrer un changement d'état. |
| microcopy.me (p. 4) | 200 (61 668 px) | 482 micro-textes classés « Errors / Account / Slogans / Headlines » : **les messages d'erreur sont des phrases complètes, polies, qui disent quoi faire**. Utile pour les incidents (« Aucun onglet ESV ne répond… »). |
| colorable.jxnblk.com (p. 5) | 200 | Outil de contraste : le **ratio s'affiche en très grand avec sa note « 7.84 AAA »** au-dessus des deux couleurs en code. Je mesure mes paires de couleurs avec la même exigence (≥ 4,5). |
| interfaceingame.com (p. 4) | 200 | Interfaces de jeux vidéo ; HUD lisibles de loin, mais esthétique de jeu écartée. |
| recent.design (p. 1) | 200 | Agrégateur à colonne latérale ; rien pour ce produit. |
| details.so/inspo (p. 5) | 200 | « The details behind the world's best websites » : titre serif centré, filtres par partie de page (Hero, Footer, Button, Scroll Animations, Page Transitions, Section Transitions). Montre que les **transitions de section** sont un sujet de conception à part entière. |
| carlbeaverson.com (p. 2) | 200 | Portfolio : paragraphe gris centré, grille de photos ; une seule voix, beaucoup de blanc. |
| refero.design (p. 2) | 200 | Titre serif « Design Research for the AI Era » ; rien de spécifique. |
| ramps.studio (p. 4) | 200 | Générateur de rampes de couleurs : chaque rampe a 10 pas **avec le contraste annoncé** ; confirme « une rampe par mesure, des pas distincts ». |
| logosystem.co (p. 4) | 200 | Mur de logos ; écarté. |
| dithergarden.com (p. 3) | 200 | Outil de tramage en monospace, rubriques numérotées « 01. Upload File 02. Process Image… » : **la numérotation monospace des étapes** est un procédé éditorial que je réemploie pour la file de parties. |
| designspells.com (p. 2) | **429, « Vercel Security Checkpoint — Failed to verify your browser — Code 21 »** | non lu, non contourné. |
| siteinspire.com (p. 1) | **429, même page « Vercel Security Checkpoint », Code 21** | non lu, non contourné. |
| janina.works (p. 3) | **403, page vide** | non lu, non contourné. |

## Ce que j'en retiens pour Ariane
- Les règles de mouvement d'emilkowal.ski deviennent la partition de toutes mes maquettes : rien d'animé sur ce qui revient toutes les 0,9 s sauf le chiffre qui change ; transitions d'état 180 à 280 ms en ease-out ; bouton pressé à 0,97.
- Les messages d'incident en phrases complètes, qui disent quoi faire (microcopy).
- Les étapes numérotées en monospace (dithergarden) pour la file de parties.

## Ce que j'écarte
- Les galeries à vignettes, les esthétiques de jeu, les murs de logos : rien à prendre pour un panneau de 360 px.

## Erreurs d'accès (exactes)
- designspells.com : HTTP 429, titre « Vercel Security Checkpoint », texte « Failed to verify your browser Code 21 ».
- siteinspire.com : HTTP 429, même page, « Code 21 ».
- janina.works : HTTP 403, corps vide.

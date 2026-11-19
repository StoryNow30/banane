# CH-142, addendum — la zone muette de V19 p3, cut par cut

Mesuré le 19/11 sur `banane-data/outils/analyse-lots/CH-142/sorties/detail.csv` (les 108 cuts de V19 p3), et sur la règle écrite dans `src/ancre-trajectoire.js:101`.

## Ce qui est ÉTABLI

- **44 cuts muets en V19 p3, tous posés, tous écrits** (`ecriture_observee` = 1) : le cut 1 (`bout-de-liste`), puis **trois plages** en `sens` : **2485–2502** (18 cuts), **2583–2593** (11), **2632–2645** (14).
- Dans cette partie, `rapportSens` vaut **1,031 partout** (seuil 1,10) : la direction des numéros de cut n'y est pas tranchée, sur aucun cut. Ce n'est ni un défaut de liste ni un manque de lignes (la liste porte 9 276 lignes utilisables).
- **64 cuts de la même partie sont pourtant établis** avec le même rapport. La règle (`src/ancre-trajectoire.js:101`) explique pourquoi : quand le rapport est faible, l'ancre n'est utilisée que si le déplacement qu'elle impose reste **≤ 20 mm** (`sensFaibleMaxMm`). Les 43 cuts muets sont donc ceux où l'ambiguïté de sens déplace la pose de **plus de 20 mm** ; les 64 autres sont en deçà.

**Conclusion (ÉTABLI) :** le mutisme de V19 p3 n'est pas une panne ni une donnée manquante — c'est **une ambiguïté géométrique de la partie**, que la règle tolère jusqu'à 2 cm et refuse au-delà. Les 44 poses ont été écrites sans garde.

## Ce que cette mesure ne dit pas

Faute de référence sur ces cuts (aucune correction de l'opérateur ni Écho ne les couvre dans les collections lues), **on ne sait pas si ces 44 poses étaient justes ou fausses**. Le seul fait mesuré est qu'elles ont été écrites sans protection.

## Ce que ça implique

Ni un correctif d'urgence, ni un réglage à changer à l'aveugle : le seuil de 20 mm est ce qui limite les dégâts, et le baisser ou le lever demande une mesure sur des cuts **jugés**. Piste à instruire quand une référence existera sur cette zone : trancher le sens par un autre chemin (la continuité des numéros d'une partie à l'autre), plutôt que par le seul coût géométrique.

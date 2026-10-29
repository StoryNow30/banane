# Séance terrain de la test 24 (4.9.5.24)

Cette version allume la **deuxième passe des différés en écriture** (D-259) : elle pose et valide sur place, 10 cuts au plus par lot. Première fois dans un vrai lot : tu es présent pendant le lot.

## Avant
1. Exporte tout ce qui est en cache (« Exporter tout »), puis installe `ariane-v4.9.5.24.zip` par-dessus, recharge ESV et vérifie « 4.9.5 test 24 (D-259) ».

## Le lot (par partie)
1. **Lance un lot de reprise** (Orbite) sur une partie où l'ADV est observé, avec **Écho** actif sur la même séance. Reste devant l'écran.
2. À la fin, **exporte** (« Exporter tout ») avant toute autre manipulation. Exporte après chaque partie.
3. Regarde les cuts que la passe a posés : s'ils sont bons, ne touche à rien ; s'ils sont faux, corrige-les. Dis tout de suite si une pose de la passe est fausse de plus de 20 mm ou sur la mauvaise voie.
4. Aucun SKIP, aucune validation à l'aveugle.

## Deux relevés en Écho (une fois, à la main)
- **Changer de partie** : en Écho, passe d'une partie à une autre une fois et note ce que fait ESV (reste-t-il connecté, que se passe-t-il à l'écran). Il sert à la file de parties.
- **Vue hors champ** : sur 3 cuts dont la pose sort de la vue, déplace d'abord à la **molette**, puis au **clic droit**, et note lequel marche (export après). Il tranche entre les deux gestes.

## Ce que je fais ensuite
`tools/juger-lot.cjs` juge chaque pose du lot et de la passe contre ta correction (ou l'absence de correction) dans l'Écho.

## Ce qui n'est pas vérifié
- La passe en écriture n'a jamais posé dans un vrai lot ESV.
- Une absence de correction vaut « bon » seulement si Écho tournait sur le cut.

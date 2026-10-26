# Séance terrain « 4.9.5 test 14 (L1-e) » : la GCV2 a appris de tes Échos

**Ce qui change par rapport à la test 13 : seulement les différés.** Tout ce que le lot posait avant, il le pose exactement comme avant. Sur un cut qu'il différait, la GCV2 fait la même proposition qu'en test 13, puis la **vérifie contre l'écartement des cuts voisins déjà valides** (ceux que personne n'a touchés). Tes Échos des parties 17, 18 et 19 ont montré que, dans les ADV, la GCV2 mettait souvent un rail 2 à 3 cm trop loin de l'autre. Maintenant :

- quand sa paire est trop large ou trop serrée de 1,5 à 4 cm, elle **déplace le rail le moins sûr** pour retrouver l'écartement des voisins, **seulement si le nuage montre un rail à cet endroit** ;
- elle **valide** ce cut (vert), même s'il est loin de la pose de départ d'ESV ;
- **plus aucune pose « approchée »** : un cut qu'elle ne valide pas reste **rouge, à la pose de départ d'ESV**, comme un différé ordinaire.

Sur le rejeu de ta partie 19, il reste 22 différés au lieu de 202, et les poses validées sont à 3 mm de toi en médiane. Sur les parties 11, 17 et 18 (qui n'ont pas servi à apprendre), le gain est petit : 55 différés au lieu de 60.

## 1. Installer et vérifier

1. Exporte d'abord ce que ta version actuelle garde.
2. **Contrôle l'empreinte du zip** (PowerShell, dans le dossier du zip) : `Get-FileHash .\ariane-4.9.5-test.14.zip -Algorithm SHA256`. Les 64 caractères doivent être ceux de mon message, sinon n'installe pas.
3. **Pose la test 14 par-dessus la test 13** : décompresse le zip dans le même dossier, en remplaçant les fichiers. Dans `chrome://extensions`, clique sur **Recharger** sur la carte Ariane.
4. **F5 sur l'onglet ESV**, puis choisis-le dans Ariane.
5. **Vérifie la version** : la carte, le panneau et le bouton blanc d'ESV disent « 4.9.5 test 14 (L1-e) ».

Rien à régler : le nouveau comportement est actif pour chaque lot. Il a besoin de la **liste des coupes d'ESV** de la partie, qu'Ariane garde quand ESV la charge (au chargement de la partie) : si elle manque, le lot fait comme la test 13, sans poses approchées.

## 2. Lancer un lot

Comme d'habitude. **Séance « différés seulement » permise** : sur une portion déjà faite, Orbite ne passe que sur les cuts rouges et essaie de les poser.

## 3. Après le lot

- Les cuts **verts** posés par la GCV2 se contrôlent comme tout vert d'Orbite. **Chaque pose est définitive dans ESV.**
- Les cuts **rouges** n'ont pas bougé : corrige-les comme des différés ordinaires.
- Note les cuts verts de la GCV2 qui sont **faux** (mauvais rail, mauvaise voie, plus de 1 cm) : ce sont eux qui comptent. Les zones à surveiller : les **ADV**, surtout là où les deux voies se rapprochent.

## 4. À la fin : les exports

**Orbite** : l'export du lot, comme d'habitude (il contient l'instantané de la liste et, pour chaque cut touché, la pose d'avant et la pose envoyée). **Écho** : « Terminer et télécharger », **tous les volumes et tous les segments automatiques** (sur la partie 19, les huit premiers n'étaient pas arrivés), leur SHA-256 (`Get-FileHash` sur chaque zip), et tes notes. Vide le cache seulement après ma confirmation de réception.

## 5. Si quelque chose ne va pas

Arrête le lot, note l'heure et le message, exporte et envoie les zips. **Ne désinstalle pas Ariane.**
Retour arrière : exporte, puis **désactive** la test 14 dans `chrome://extensions` (sans la supprimer), décompresse le zip de la **4.9.5 test 13** dans le même dossier, **réactive** la carte, **Recharger**, F5 sur ESV.

## 6. Ce qui n'est pas vérifié

- La correction n'a jamais posé dans ESV : tout vient du rejeu des lots 2:11, 2:17, 2:18 et 2:19, les seuls dont l'export contient la liste d'ESV.
- Les réglages (1,5 à 4 cm, 20 cuts voisins) viennent de la partie 19 ; ailleurs, le gain mesuré est faible.
- Dans les ADV de la partie 1 du second projet, ton écartement était de 1 448 à 1 461 mm : la correction n'y a pas été mesurée.
- Edge n'a pas été vu.

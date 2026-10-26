# Séance terrain « 4.9.6 test 1 (UI-L1) » : le nouveau panneau Ariane

**Ce qui change : seulement le panneau.** Il s'ouvre sur un accueil : ta partie en grand, puis les activités Orbite, Écho, Revue et Réglages. Le lot, la pose, les différés de la L1 et les exports sont **exactement ceux de la 4.9.5 test 13 (L1)**. Le nouveau panneau appuie sur les boutons de l'ancien : il ne commande rien de plus.

## 1. Installer et vérifier

1. Exporte d'abord ce que ta version actuelle garde.
2. **Contrôle l'empreinte du zip** (PowerShell, dans le dossier du zip) : `Get-FileHash .\ariane-4.9.6-test.1.zip -Algorithm SHA256`. Les 64 caractères doivent être ceux de mon message, sinon n'installe pas.
3. **Pose la test 1 par-dessus ta version actuelle** : décompresse le zip dans le même dossier, en remplaçant les fichiers. Dans `chrome://extensions`, clique sur **Recharger** sur la carte d'Ariane.
4. **F5 sur l'onglet ESV**, puis ouvre Ariane.
5. **Vérifie la version** : la carte et le bouton blanc d'ESV disent « 4.9.6 test 1 (UI-L1) ». La fenêtre d'Ariane est plus grande qu'avant : place-la à côté d'ESV.

## 2. Ce qu'il faut essayer

- **Accueil** : ta partie, l'état du lot (la pastille change de forme : en cours, pause demandée, en pause, terminé), puis les quatre cartes. Écho porte un cadenas pendant un lot.
- **Orbite** : lance ou reprends un lot depuis la carte de droite. **Pause** : le bouton devient « Pause demandée… » tant que le cut en cours n'est pas fini, puis « Reprendre ».
- **Revue** : après le lot, les différés et les verts à contrôler. Ouvre toi-même chaque cut dans ESV : cette version ne le fait pas encore.
- **Réglages** (l'engrenage en haut à droite) : les choix du lot, la connexion à ESV, l'export du dossier. « Ancien panneau » rend l'ancien panneau tel quel.

Pendant un lot, **ne change pas de cut dans ESV** : Ariane travaille sur le cut ouvert.

## 3. Ce qu'il faut me dire

- La fenêtre à côté d'ESV : taille, lisibilité des petits textes (motifs, heures, parcours du lot).
- Un écran qui dit une chose fausse (un chiffre, un état, un bouton) : note l'heure et ce qui était affiché.
- Ce que tu as dû aller chercher dans l'ancien panneau.

## 4. À la fin : les exports

Comme avec la test 13 : l'export du lot (Réglages, « Exporter le dossier », ou le bouton de fin de lot) et Écho « Terminer et télécharger », avec le SHA-256 de chaque volume.

## 5. Retour arrière

Reviens à la **4.9.5 test 13 (L1)** : désactive Ariane, redécompresse le zip de la test 13 dans le même dossier, réactive, **Recharger**, puis F5 sur ESV.

## Pas vérifié

L'usage réel à côté d'ESV, la taille de la fenêtre sur ton écran, et un incident réel (ESV qui ne répond plus) : ils n'ont été essayés que sur des états fabriqués.

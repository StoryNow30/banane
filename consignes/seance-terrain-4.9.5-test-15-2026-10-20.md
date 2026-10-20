# Séance terrain « 4.9.5 test 15 (L1-e4) » : la GCV2 pose davantage de différés, à moins d'un centimètre de toi

**Ce qui change par rapport à la test 14 : seulement les différés.**

- Tout ce que la chaîne du lot posait avant, il le pose comme avant.
- Sur un cut que la chaîne laisse rouge, la GCV2 de la test 14 décide avec plus de preuves.

Ce que la GCV2 fait de plus :

- **Écartement exact.** Elle ramène la paire de rails à l'écartement des cuts voisins déjà valides de la liste d'ESV. Si le rail qu'elle voulait déplacer n'est pas visible dans le nuage, elle essaie l'autre rail.
- **Voie des voisins.** Elle recalcule la voie à partir des poses qu'elle a déjà validées dans ce lot et ramène les deux rails sur ce que montre le nuage, à 8 mm près.
- **Consensus.** Sous le seuil de confiance, elle valide une paire seulement si trois preuves sont d'accord :
  - les deux rails sont visibles dans le nuage ;
  - l'écartement est à ± 10 mm de la référence ;
  - la voie est à ± 15 mm en travers de celle des voisins validés.
- **Gardes.** Elle ne fait rien quand la voie s'écarte de plus de 45 mm de celle des voisins, ni quand l'écart d'écartement ne peut pas être corrigé.
- **Pas de pose approchée.** Comme en test 14, un cut qu'elle ne valide pas reste rouge, à la pose de départ d'ESV.

La sélection d'une paire de rails par son seul écartement de référence a été essayée. Elle produisait des mauvaises voies sur la partie 17 : elle est **coupée** dans cette version.

**Ce que dit le banc.** Ce sont des rejeux de tes lots contre tes Échos, pas des mesures terrain. Ces parties ont aussi servi à régler la GCV2 : les chiffres ne disent donc pas encore ce qu'elle fera sur une partie nouvelle.

| Partie | Différés : avant → test 15 | Poses jugées à 1 cm ou moins |
|---|---|---|
| 19 | 207 → 2 (dont 1 sans nuage) | 234 sur 237 |
| 20, second lot | 123 → 2 | 171 sur 175 |
| 11 | 12 → 3 | |
| 17 | 41 → 18 | |
| 18 | 37 → 18 | |

Sur toutes ces parties : **0 mauvaise voie, 0 pose à plus de 5 cm**.

## 1. Installer et vérifier

1. Exporte d'abord ce que ta version actuelle garde.
2. **Contrôle l'empreinte du zip** (PowerShell, dans le dossier du zip) : `Get-FileHash .\ariane-4.9.5-test.15.zip -Algorithm SHA256`. Les 64 caractères doivent être ceux de mon message, sinon n'installe pas.
3. **Pose la test 15 par-dessus la test 14** : décompresse le zip dans le même dossier, en remplaçant les fichiers. Dans `chrome://extensions`, clique sur **Recharger** sur la carte Ariane.
4. **F5 sur l'onglet ESV**, puis choisis-le dans Ariane.
5. **Vérifie la version** : la carte, le panneau et le bouton blanc d'ESV disent « 4.9.5 test 15 (L1-e4) ».

Il n'y a rien à régler : le nouveau comportement est actif pour chaque lot.

Comme en test 14, il a besoin de la **liste des coupes d'ESV** de la partie. Ariane la garde quand ESV la charge, au chargement de la partie. Si elle manque, le lot fait comme la test 13, sans poses approchées.

## 2. Lancer un lot

Lance-le comme d'habitude. **Une séance « différés seulement » est permise** : sur une portion déjà faite, Orbite ne passe que sur les cuts rouges.

## 3. Après le lot

**Chaque pose est définitive dans ESV.**

Les cuts **verts** posés par la GCV2 se contrôlent comme tout vert d'Orbite. Note ceux qui sont **faux** : mauvaise voie, mauvais rail, ou plus de 1 cm de ta pose.

Zones à surveiller :

- les **ADV**, surtout là où deux voies ont un écartement proche ;
- les **longues suites** de cuts posés par la GCV2 : elle s'appuie sur ses propres poses du lot pour trouver la voie.

**Nuage vide.** Si un cut reste rouge alors que le nuage s'affiche bien chez toi, note son numéro. Sur la partie 20, 28 cuts avaient une capture vide au moment du lot, parce que le nuage n'était pas encore chargé. Cette version ne corrige pas ce problème.

## 4. À la fin : les exports

**Orbite** : fais l'export du lot, comme d'habitude.

**Écho** : choisis « Terminer et télécharger » et envoie :

- **tous les volumes et tous les segments automatiques** ;
- leurs SHA-256 (`Get-FileHash` sur chaque zip) ;
- tes notes.

Vide le cache seulement après ma confirmation de réception.

## 5. Si quelque chose ne va pas

1. Arrête le lot.
2. Note l'heure et le message.
3. Exporte et envoie les zips.

**Ne désinstalle pas Ariane.**

Retour arrière :

1. Exporte.
2. **Désactive** la test 15 dans `chrome://extensions`, sans la supprimer.
3. Décompresse le zip de la **4.9.5 test 14** (`ariane-4.9.5-test.14.zip`) dans le même dossier.
4. **Réactive** la carte, puis clique sur **Recharger**.
5. F5 sur ESV.

## 6. Ce qui n'est pas vérifié

- La test 15 n'a jamais posé dans ESV. Tout vient du rejeu des lots des parties 11, 17, 18, 19 et 20 du second projet.
- Ces parties ont toutes servi à régler les seuils. On n'a donc pas encore de mesure sur une partie nouvelle.
- Les parties 17 et 18 gardent 18 différés chacune.
- Edge n'a pas été vu.

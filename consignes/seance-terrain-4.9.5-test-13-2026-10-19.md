# Séance terrain « 4.9.5 test 13 (L1) » : Orbite s'occupe aussi des différés

**Ce qui change : le lot traite lui-même une partie des cuts qu'il différait.** Tout ce que le lot posait avant, il le pose **exactement comme avant**. Sur un cut qu'il différait, il essaie trois choses, dans l'ordre : déplacer la vue si la cible en sortait ; refaire sa décision sans la garde de paire ; puis un second avis (la GCV2), qui regarde le nuage et les cuts posés par le lot :

- **sûr de lui** : il pose et **valide** le cut (vert) ;
- **pas assez sûr** : il pose les rails **sans valider**. Le cut reste **rouge**, mais ses rails sont déjà **près** de la bonne place. Tu n'as plus qu'à ajuster ;
- **rien de bon**, ou une place à plus de 15 cm de la pose de départ : il ne pose rien. Le cut reste rouge, comme avant.

Un cut posé de cette façon ne sert jamais de point d'appui aux cuts suivants. Le reste (Écho, la relecture après le lot, Maj+Espace) ne change pas.

**Correctif (partie 19 du 19/10)** : la relecture « Corriger » après le lot ne s'arrête plus quand ESV est encore occupé par une capture. Elle attend quelques secondes et repart. Si ESV reste occupé plus de 12 secondes, elle s'arrête comme avant, avec le message.

## 1. Installer et vérifier

1. Exporte d'abord ce que ta version actuelle garde.
2. **Contrôle l'empreinte du zip** (PowerShell, dans le dossier du zip) : `Get-FileHash .\ariane-4.9.5-test.13.zip -Algorithm SHA256`. Les 64 caractères doivent être ceux de mon message, sinon n'installe pas.
3. **Pose la test 13 (L1) par-dessus ta version actuelle** (la 4.9.5.11, par exemple) : décompresse le zip dans le même dossier, en remplaçant les fichiers. Dans `chrome://extensions`, clique sur **Recharger** sur la carte Ariane.
4. **F5 sur l'onglet ESV**, puis choisis-le dans Ariane.
5. **Vérifie la version** : la carte, le panneau et le bouton blanc d'ESV disent « 4.9.5 test 13 (L1) ». Le panneau est celui de la test 9 (pas encore le nouveau).

Rien à régler : le nouveau comportement est actif pour chaque lot.

## 2. Lancer un lot

Comme d'habitude : choisis la plage, démarre, laisse faire. Tu verras parfois la vue d'ESV bouger un peu avant une pose : c'est voulu.

**Séance « différés seulement » permise** : tu peux lancer un lot sur une portion déjà faite. Orbite ne passe alors que sur les cuts **rouges** (les différés), et essaie de les poser.

## 3. Après le lot : les cuts rouges « approchés »

- Un cut posé sans validation reste **rouge** dans ESV, mais ses rails ont **bougé** vers le rail. **Ce changement est définitif dans ESV** : il reste après un F5 ou si tu fermes l'onglet. Pas besoin de vérifier qu'il a tenu.
- **Pour le corriger** : ouvre le cut comme d'habitude (Écho allumé), ajuste les rails à partir de là où ils sont, puis **Maj+Espace**. Si la pose approchée est fausse, replace les rails toi-même, exactement comme pour un différé ordinaire.
- Un cut **vert** posé par la GCV2 se contrôle comme tout vert d'Orbite.
- Note les cuts où la pose approchée t'a **gêné** (plus loin que la pose de départ, mauvais rail) : ce sont eux qui comptent.

## 4. À la fin : les exports

**Orbite** : l'export du lot, comme d'habitude (il garde, pour chaque cut touché, la pose d'avant et la pose envoyée). **Écho** : « Terminer et télécharger », tous les volumes, leur SHA-256 (`Get-FileHash` sur chaque zip), et tes notes. Vide le cache seulement après ma confirmation de réception.

Important pour la mesure : **ne retouche pas** un cut rouge approché par un autre lot avant de l'avoir corrigé dans Écho.

## 5. Si quelque chose ne va pas

Arrête le lot, note l'heure et le message, exporte et envoie les zips. **Ne désinstalle pas Ariane.**
Retour arrière (retrouver le lot d'avant, exactement) : exporte, puis **désactive** la test 13 (L1) dans `chrome://extensions` (sans la supprimer), décompresse le zip de ta version d'avant (**4.9.5.11**, ou la **4.9.5 test 9**) dans le même dossier, **réactive** la carte, **Recharger**, F5 sur ESV.

## 6. Ce qui n'est pas vérifié

- La GCV2 n'a jamais posé dans ESV : tout vient du rejeu des lots archivés. Ta séance est la première vraie mesure.
- Le déplacement de la vue a été essayé sur une maquette, pas sur tous les cas d'ESV.
- Le dernier cut d'un lot n'est pas « approché » (le lot s'arrête dessus sans naviguer).
- Edge n'a pas été vu.

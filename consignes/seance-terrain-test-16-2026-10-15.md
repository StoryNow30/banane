# Séance terrain « test 16 » : export découpé, historique des départs, sélecteur, tuile animée (15 octobre 2026)

La test 16 est la test 15 avec tes retours de la partie 24. **Rien ne change dans ce qu'Ariane décide, pose ou valide**, sauf deux protections :
- « Reprendre » après la fin d'un lot répond maintenant **« Lot déjà terminé »**, sans rien rejouer ;
- « Reprendre » après « Arrêter » (ou « Pause ») **refuse** d'appliquer une pose calculée avant l'arrêt si les rails ont bougé depuis.
- Le moteur n'est pas modifié.

Ce qui change à l'écran : l'export se découpe tout seul, les départs gardent l'historique des parties, la liste « Onglet ESV » est lisible et la tuile « Lot » bouge mieux.

## Le paquet

`ariane-4.9.0-test.16.zip`, version 4.9.0.16, nom « 4.9.0 test 16 ». L'empreinte SHA-256 et la taille sont dans mon message (cette consigne
est dans le paquet : elle ne peut pas porter sa propre empreinte).

## 1. Installer et vérifier (environ 10 minutes)

1. Tout ce que l'ancienne Ariane garde doit être **déjà exporté**.
2. **Contrôle l'empreinte du zip.** PowerShell, dans le dossier du zip : `Get-FileHash .\ariane-4.9.0-test.16.zip -Algorithm SHA256`.
   Les 64 caractères doivent être identiques à ceux de mon message. Sinon, n'installe pas et dis-le-moi.
3. **Pose la test 16 par-dessus l'ancienne** : décompresse le zip dans le même dossier que l'ancienne Ariane, en remplaçant les fichiers. Ne désinstalle rien. Puis, dans
   `chrome://extensions`, clique sur **Recharger** sur la carte Ariane. Une seule Ariane active à la fois.
4. **Recharge l'onglet ESV (F5)**, puis choisis cet onglet dans Ariane.
5. **Vérifie la version** : la carte dit « 4.9.0 test 16 », le panneau dit « ARIANE 4.9.0 test 16 » et le bouton blanc sur la page ESV dit « Ariane 4.9.0 test 16 · ouvrir ».
   Dans les réglages, la ligne « Mode rapide (V3) » dit toujours « neuf cuts sur dix (un sur dix en référence, tiré au sort) », « Allègement des nuages » dit toujours
   « actif (sondes sans information retirées) » et la ligne « Voisins de la liste d’ESV (B1) » dit toujours « en ombre (calculés et consignés, sans effet sur la pose) ».
   Une ligne nouvelle, « Taille d’un volume zip », dit « 17 Mo au plus (compressé) ».
   Sinon, ne lance rien et dis-le-moi.

## 2. Ce que tu regardes et ce que tu essaies (dans cet ordre)

Mêmes conditions que la test 15 : fenêtre ESV d'au moins 600 pixels, extension Claude désactivée, Orbite seulement.
Pour chaque point, note en une phrase si c'est **bien**, **pas bien** (et quoi), ou **pas vu**.

1. **Le sélecteur « Onglet ESV »** (Connexion à ESV) : la liste se lit dans le thème sombre comme dans le clair. Ouvre deux onglets ESV sur le même projet :
   chacun a un libellé différent (« Onglet 2 · fenêtre 1 · au premier plan — … »). L'onglet qu'Ariane utilise est marqué « utilisé par Ariane ». Choisis ensuite
   ton onglet et clique sur « Reconnecter ESV », comme avant ; puis ferme l'onglet en trop.
2. **L'historique des départs** (sous « Départs des parties ») : la partie en cours en grand, comme avant ; en dessous, « Parties précédentes » avec,
   pour chaque partie, l'heure du dernier départ, validés, invalides, total et le nombre de départs. Clique sur une partie : le détail de ses départs s'ouvre.
   « Voir les N départs » ouvre aussi le détail de la partie en cours.
3. **La tuile « Lot »** pendant un lot à plage fixe (premier et dernier cut remplis) : le vert avance en douceur et le pourcentage défile ; une petite onde part du bord
   du vert à chaque cut terminé. Clique sur **Pause** : la tuile devient calme (vert terne, plus rien ne bouge). **Reprendre** : tout se rallume.
   Laisse ce lot **jusqu'à sa fin** (dernier cut du lot) : un reflet traverse une fois la tuile. « 1 cut » s'écrit sans « s ».
4. **Arrêter puis Reprendre** : pendant un autre lot à plage fixe, clique sur **Arrêter le lot** en plein cut, puis **Reprendre** sans toucher aux rails : le lot reprend.
   Recommence, mais déplace un rail dans ESV avant de cliquer sur **Reprendre** : Ariane refuse (« Rails modifiés depuis la capture du cut … ») et ne pose rien.
5. **Reprendre après la fin** : après un lot **jusqu'à la fin de partie** laissé jusqu'au dernier cut de la partie, clique sur **Reprendre** deux fois :
   l'avis dit « Lot déjà terminé » et rien d'autre ne se passe (rien n'est rejoué dans ESV).
6. **Une erreur affichée dans l'avis** (essai non fait au test 15) : démarre un lot alors que l'onglet ESV n'est pas choisi ou pas prêt. Ariane doit le refuser et
   l'écrire dans l'avis, comme avant.

« Reprendre » juste après « Pause », pendant que le cut finit, est refusé (« Attends la fin de l'action en cours ») : c'est voulu, comme avant.

## 3. À la fin : l'export se découpe tout seul

Attends 5 secondes, puis « Tout télécharger pour l'analyse ». **Plus besoin du script de découpe** : Ariane enregistre un ou plusieurs zips, chacun de 17 Mo au plus,
nommés `…-volume01-sur03.zip`, `…-volume02-sur03.zip`, etc. (un seul zip s'il tient en un). Chaque zip s'ouvre seul ; son `CONTENU.txt` dit « Volume n sur N »
et liste les départs des parties. Le message de l'export dit combien de volumes il y a ; s'il dit qu'un fichier « dépasse seul » la limite, ce volume-là est plus gros
que 17 Mo : envoie-le quand même et dis-le-moi. Envoie **tous les volumes**, tels quels, avec leur ligne SHA-256 (PowerShell : `Get-FileHash .\ariane-lot-*.zip -Algorithm SHA256`),
puis vide le cache seulement après ma confirmation de réception.

## 4. Si quelque chose ne va pas

Arrête, note l'heure et le message exact, exporte et envoie-moi les zips. **Ne désinstalle pas Ariane** (ça efface le cache). Retour arrière : exporte, vérifie et envoie les zips, puis
**désactive** la test 16 (interrupteur dans `chrome://extensions`, sans la supprimer) et pose la 4.9.0.15 (`ariane-4.9.0-test.15.zip`, SHA-256
`cdbb6fe9f7d9aa41963499fdfc49485da5a61d74dad5ae000f043f89bcc896ce`), puis F5 sur ESV. La 4.9.0.15 a le même moteur : seuls les changements ci-dessus disparaissent
(l'export redevient un seul zip, à découper avec le script de la test 9).

## 5. Ce qui n'est pas vérifié

Tout a été essayé hors ligne (essais du panneau et du service worker, captures dans Chromium avec un ESV simulé). Rien n'a été utilisé en séance réelle.
Le découpage n'a pas été essayé sur un vrai lot : un fichier du corpus vise au plus 34 Mo avant compression ; s'il se compresse mal, il peut dépasser seul 17 Mo
(le message le dit). La liste déroulante d'Edge sous Windows n'a pas été vue (Chromium sous Linux seulement). Toujours non vérifiés : le banc complet avec le corpus privé,
Edge, Chrome et Edge avant la version 129, un vrai réseau lent.

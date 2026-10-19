# Séance terrain « test 17 » : pourcentage des invalides, heure de Paris (15 octobre 2026)

La test 17 est la test 16 avec tes retours. **Rien ne change dans ce qu'Ariane décide, pose ou valide.** Le moteur n'est pas modifié.

Ce qui change à l'écran :
- la tuile « Lot » d'un lot sur **toute la partie** compte **les invalides traités** : « 39 / 514 invalides » et le pourcentage qui va avec ;
- toutes les heures du panneau sont **à l'heure de Paris** (plus de « UTC ») ;
- « Premier cut » et « Dernier cut » sont alignés.

## Le paquet

`ariane-4.9.0-test.17.zip`, version 4.9.0.17, nom « 4.9.0 test 17 ». L'empreinte SHA-256 et la taille sont dans mon message (cette consigne
est dans le paquet : elle ne peut pas porter sa propre empreinte).

## 1. Installer et vérifier (environ 10 minutes)

1. Tout ce que l'ancienne Ariane garde doit être **déjà exporté**.
2. **Contrôle l'empreinte du zip.** PowerShell, dans le dossier du zip : `Get-FileHash .\ariane-4.9.0-test.17.zip -Algorithm SHA256`.
   Les 64 caractères doivent être identiques à ceux de mon message. Sinon, n'installe pas et dis-le-moi.
3. **Pose la test 17 par-dessus l'ancienne** : décompresse le zip dans le même dossier, en remplaçant les fichiers. Ne désinstalle rien.
   Puis, dans `chrome://extensions`, clique sur **Recharger** sur la carte Ariane. Une seule Ariane active à la fois.
4. **Recharge l'onglet ESV (F5)**, puis choisis cet onglet dans Ariane.
5. **Vérifie la version** : la carte dit « 4.9.0 test 17 », le panneau dit « ARIANE 4.9.0 test 17 » et le bouton blanc sur la page ESV dit « Ariane 4.9.0 test 17 · ouvrir ».
   Sinon, ne lance rien et dis-le-moi.

## 2. Ce que tu regardes et ce que tu essaies

Mêmes conditions que la test 16 : fenêtre ESV d'au moins 600 pixels, extension Claude désactivée, Orbite seulement.
Pour chaque point, note en une phrase si c'est **bien**, **pas bien** (et quoi), ou **pas vu**.

1. **Le pourcentage sur toute la partie** : lance un lot du **premier cut** de la partie (0 ou 1) **jusqu'à la fin de partie** (« Dernier cut » vide).
   Quelques secondes après le départ, la tuile dit « N / M invalides » : N = cuts traités par le lot (posés et différés), M = invalides
   de la partie au départ (le chiffre de la carte « Départs des parties »). Le pourcentage est N ÷ M (une décimale sous 10 %, par exemple « 7,5 % »).
   Il ne recule jamais et finit à 100 %.
2. **Les autres lots** (plage fixe, ou départ au milieu de la partie) : la tuile garde la position dans la plage et « N cuts », comme avant.
   C'est voulu : Ariane ne sait pas compter les invalides d'une plage.
3. **L'heure de Paris** : les heures des départs (carte en cours, parties précédentes, détail), de l'activité du lot et des lots de la partie sont
   celles de ta montre. Nulle part « UTC ». Dans le `CONTENU.txt` de l'export, l'heure et les départs disent « heure de Paris ».
4. **Les bornes** : « Premier cut » et « Dernier cut » sont sur la même ligne, bien alignés.

**Essais de la test 16 pas encore faits sur le terrain** (dans cet ordre) :

5. **Pause puis Reprendre** pendant un lot : la tuile devient calme, puis tout se rallume.
6. **F5 pendant la pause** : appuie sur Pause, recharge l'onglet ESV (F5), puis **Reprendre** : note ce qui se passe (le lot reprend, ou l'avis dit quoi faire).
7. **Arrêter en plein cut, puis Reprendre** sans toucher aux rails : le lot reprend. Recommence en **déplaçant un rail** dans ESV avant de cliquer
   sur **Reprendre** : Ariane refuse (« Rails modifiés depuis la capture du cut … ») et ne pose rien.
8. **Reprendre après la fin** : laisse un lot **jusqu'à la fin de partie** aller jusqu'au dernier cut, puis clique deux fois sur **Reprendre** :
   l'avis dit « Lot déjà terminé » et rien n'est rejoué dans ESV.
9. **Un lot à plage fixe jusqu'à sa fin** (premier et dernier cut remplis) : le lot s'arrête au dernier cut ; la tuile finit à 100 %.
10. **Une erreur dans l'avis** : démarre un lot alors que l'onglet ESV n'est pas choisi ou pas prêt. Ariane refuse et l'écrit dans l'avis.

## 3. À la fin : l'export

Attends 5 secondes, puis « Tout télécharger pour l'analyse ». L'export **sort tout seul en volumes** (`…-volume01-sur03.zip`, etc. ; un seul zip s'il tient en un).
Envoie **tous les volumes**, tels quels, avec leur ligne SHA-256 (PowerShell : `Get-FileHash .\ariane-lot-*.zip -Algorithm SHA256`),
puis vide le cache seulement après ma confirmation de réception.

## 4. Si quelque chose ne va pas

Arrête, note l'heure et le message exact, exporte et envoie-moi les zips. **Ne désinstalle pas Ariane** (ça efface le cache). Retour arrière : exporte, vérifie et envoie les zips, puis
**désactive** la test 17 (interrupteur dans `chrome://extensions`, sans la supprimer) et pose la 4.9.0.16 (`ariane-4.9.0-test.16.zip`, SHA-256
`1d69dff2c58eb337e2a579c01eb44266e64296fc90d4c388f8875627d2c79926`), puis F5 sur ESV. La test 16 a le même moteur : seuls le pourcentage des invalides et l'heure de Paris disparaissent.

## 5. Ce qui n'est pas vérifié

Tout a été essayé hors ligne (essais du panneau, captures dans Chromium avec un ESV simulé). Rien n'a été utilisé en séance réelle.
Le « premier cut de la partie » est pris comme 0 ou 1 : si une partie commence plus loin, la tuile garde la position. Le nom des fichiers d'export garde l'heure UTC
(les outils d'analyse s'en servent). Edge et Chrome sous Windows n'ont pas été vus.

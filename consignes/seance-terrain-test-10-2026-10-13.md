# Séance terrain « test 10 » : fiche de départ des parties et raccourcis écrits (D-092) (13 octobre 2026)

**Rien ne change dans ce qu'Ariane décide, pose ou valide, ni dans sa vitesse.** La test 10 est la test 9 plus deux choses.

**1. La fiche de départ des parties.** Quand tu lances un lot, ESV charge la liste des cuts de la partie. Ariane en compte maintenant les **validés** et les
**invalides**, et note : l'heure, la partie, les validés, les invalides et le total. La fiche :
- s'affiche dans le panneau, bloc **« Départs des parties »** (les six derniers départs, le plus récent en premier) ;
- est recopiée dans **chaque export** (le fichier `CONTENU.txt` du zip, et le champ `fichesDepart` du bilan) ;
- **reste même si tu vides le cache des exports** : « Vider le cache des exports » ne la touche pas.

**2. Les raccourcis, écrits.** `D` = passer au cut de droite ; `Maj + Espace` = valider un cut. Ce sont deux actions d'ESV. Ariane n'en ajoute aucune : elle
laisse passer `D`, et ne retient `Maj + Espace` que pendant une séance Écho ou Corrections, pour l'enregistrer puis le transmettre **une seule fois** à ESV. En
Orbite, elle ne touche ni à l'un ni à l'autre. Rien à faire : c'est vérifié par des essais.

## Le paquet

`ariane-4.9.0-test.10.zip`, version 4.9.0.10, nom « 4.9.0 test 10 ». L'empreinte SHA-256 et la taille sont dans mon message (cette consigne
est dans le paquet : elle ne peut pas porter sa propre empreinte).

## 1. Installer et vérifier (environ 10 minutes)

1. Tout ce que l'ancienne Ariane garde doit être **déjà exporté**.
2. **Contrôle l'empreinte du zip.** PowerShell, dans le dossier du zip : `Get-FileHash .\ariane-4.9.0-test.10.zip -Algorithm SHA256`.
   Les 64 caractères doivent être identiques à ceux de mon message. Sinon, n'installe pas et dis-le-moi.
3. **Pose la test 10 par-dessus l'ancienne** : décompresse le zip dans le même dossier que l'ancienne Ariane, en remplaçant les fichiers. Ne désinstalle rien. Puis, dans
   `chrome://extensions`, clique sur **Recharger** sur la carte Ariane. Une seule Ariane active à la fois.
4. **Recharge l'onglet ESV (F5)**, puis choisis cet onglet dans Ariane.
5. **Vérifie la version** : la carte dit « 4.9.0 test 10 », le panneau dit « ARIANE 4.9.0 test 10 » et le bouton blanc sur la page ESV dit « Ariane 4.9.0 test 10 · ouvrir ».
   Dans les réglages, la ligne « Mode rapide (V3) » dit toujours « neuf cuts sur dix (un sur dix en référence, tiré au sort) » et « Allègement des nuages » dit toujours
   « actif (sondes sans information retirées) ». Sinon, ne lance rien et dis-le-moi.

## 2. Le lot, et ce que tu vérifies en plus

Mêmes conditions que la test 9 : fenêtre ESV d'au moins 600 pixels, extension Claude désactivée, un seul onglet ESV au premier plan, Orbite seulement, tu ne touches à rien.

**Vérifie la fiche de départ, c'est la seule chose nouvelle** :
1. Dans les cinq secondes qui suivent le lancement du lot, une ligne apparaît dans le bloc « Départs des parties » du panneau : partie, validés, invalides, total.
2. Les validés et les invalides de cette ligne sont ceux que **tu vois dans ESV** pour cette partie (note-les à côté si tu peux). Le total doit être égal aux deux additionnés.
3. Si tu relances le lot sur la même partie, une ligne s'ajoute si les chiffres ont changé.
4. Après « Tout télécharger », le fichier `CONTENU.txt` du zip contient « Départs des parties (N) » suivi des lignes.
5. Après « Vider le cache des exports », les lignes sont toujours dans le panneau.

## 3. À la fin du lot

Même procédure que la test 9 (consigne `seance-terrain-test-9-2026-10-13.md`, § 3) : attends 5 secondes, « Tout télécharger pour l'analyse », vérifie le zip, découpe-le en
morceaux de 20 Mo avec le script de la test 9 s'il fait plus de 20 Mo, envoie tous les morceaux avec la ligne SHA-256, puis vide le cache seulement après ma confirmation de réception.

## 4. Si quelque chose ne va pas

Arrête, note l'heure et le message exact, exporte et envoie-moi le zip. **Ne désinstalle pas Ariane** (ça efface le cache). Retour arrière : exporte, vérifie et envoie le zip, puis
**désactive** la test 10 (interrupteur dans `chrome://extensions`, sans la supprimer) et pose la 4.9.0.9, éprouvée aujourd'hui (`ariane-4.9.0-test.9.zip`, SHA-256
`0d9637b055942a3bca54c20cb8fd337112f4476352380a2d136349715d65fba7`), puis F5 sur ESV. La 4.9.0.9 ignore la fiche de départ et ne la détruit pas.

## 5. Ce qui n'est pas vérifié

La fiche de départ : essayée hors ligne et sur le service worker réel avec ESV simulé ; jamais sur le vrai ESV. Si le résumé de liste d'ESV ne vient pas au démarrage (page
rechargée sans liste), aucune ligne n'apparaît : dis-le-moi. Le préchargement du cut suivant n'est pas dans cette version : c'est une expérience à part, à décider.
Toujours non vérifiés : Edge, Chrome et Edge avant la version 129, un vrai réseau lent.

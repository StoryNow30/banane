# Séance terrain « test 11 » : B1 en ombre et sauvegarde corrigée (D-095, D-096) (13 octobre 2026)

**Rien ne change dans ce qu'Ariane décide, pose ou valide, ni dans sa vitesse.** La test 11 est la test 10 plus deux choses, invisibles pour toi.

**1. B1, en ombre.** Ariane lit en mémoire de la page ESV la liste des cuts (statut et position des voisins déjà validés). À chaque cut, elle **calcule à côté** ce qu'elle aurait
décidé avec ces voisins, et le **note** dans l'export (événements `b1-ombre`). Elle ne l'applique pas : la pose est exactement celle de la test 10. Elle n'envoie aucune
requête de plus à ESV. Ces notes me servent à juger, sur ton lot, si B1 aurait aidé ou gêné, avant de l'activer.

**2. La sauvegarde de secours du moteur.** Un cas rare (redémarrage de l'extension pendant la relecture des visites) pouvait perdre la liste des visites d'une séance. Corrigé et essayé.

Tout le reste de la test 10 est inchangé : fiche de départ des parties (bloc « Départs des parties », `CONTENU.txt`, `fichesDepart`), raccourcis `D` et `Maj + Espace`.

## Le paquet

`ariane-4.9.0-test.11.zip`, version 4.9.0.11, nom « 4.9.0 test 11 ». L'empreinte SHA-256 et la taille sont dans mon message (cette consigne
est dans le paquet : elle ne peut pas porter sa propre empreinte).

## 1. Installer et vérifier (environ 10 minutes)

1. Tout ce que l'ancienne Ariane garde doit être **déjà exporté**.
2. **Contrôle l'empreinte du zip.** PowerShell, dans le dossier du zip : `Get-FileHash .\ariane-4.9.0-test.11.zip -Algorithm SHA256`.
   Les 64 caractères doivent être identiques à ceux de mon message. Sinon, n'installe pas et dis-le-moi.
3. **Pose la test 11 par-dessus l'ancienne** : décompresse le zip dans le même dossier que l'ancienne Ariane, en remplaçant les fichiers. Ne désinstalle rien. Puis, dans
   `chrome://extensions`, clique sur **Recharger** sur la carte Ariane. Une seule Ariane active à la fois.
4. **Recharge l'onglet ESV (F5)**, puis choisis cet onglet dans Ariane.
5. **Vérifie la version** : la carte dit « 4.9.0 test 11 », le panneau dit « ARIANE 4.9.0 test 11 » et le bouton blanc sur la page ESV dit « Ariane 4.9.0 test 11 · ouvrir ».
   Dans les réglages, la ligne « Mode rapide (V3) » dit toujours « neuf cuts sur dix (un sur dix en référence, tiré au sort) » et « Allègement des nuages » dit toujours
   « actif (sondes sans information retirées) ». Une ligne nouvelle apparaît : « Voisins de la liste d’ESV (B1) », qui doit dire « en ombre (calculés et consignés, sans effet sur la pose) ».
   Sinon, ne lance rien et dis-le-moi.

## 2. Le lot, et ce que tu vérifies en plus

Mêmes conditions que la test 10 : fenêtre ESV d'au moins 600 pixels, extension Claude désactivée, un seul onglet ESV au premier plan, Orbite seulement, tu ne touches à rien.
**Tu n'as rien de nouveau à vérifier** sur l'écran. Continue de contrôler la ligne « Départs des parties » de la test 10 (validés + invalides = total, comparés à ESV), si tu ne l'as pas encore fait.
Laisse tourner au moins une partie complète : plus il y a de cuts, mieux B1 en ombre est jugé. Ne change rien à ta façon de travailler.

## 3. À la fin du lot

Même procédure que la test 9 (consigne `seance-terrain-test-9-2026-10-13.md`, § 3) : attends 5 secondes, « Tout télécharger pour l'analyse », vérifie le zip, découpe-le en
morceaux de 20 Mo avec le script de la test 9 s'il fait plus de 20 Mo, envoie tous les morceaux avec la ligne SHA-256, puis vide le cache seulement après ma confirmation de réception.

## 4. Si quelque chose ne va pas

Arrête, note l'heure et le message exact, exporte et envoie-moi le zip. **Ne désinstalle pas Ariane** (ça efface le cache). Retour arrière : exporte, vérifie et envoie le zip, puis
**désactive** la test 11 (interrupteur dans `chrome://extensions`, sans la supprimer) et pose la 4.9.0.10 (`ariane-4.9.0-test.10.zip`, SHA-256
`09c32aaf551b4a8b3102e85693150546985196469841707fd61595f494503949`), puis F5 sur ESV. La 4.9.0.10 ignore les notes `b1-ombre` et ne les détruit pas.

## 5. Ce qui n'est pas vérifié

B1 : essayé hors ligne et sur le service worker réel avec une page ESV simulée ; jamais sur le vrai ESV. Le rapport entre le numéro d'un cut et la ligne de la liste est vérifié à chaque cut
(les notes disent si les deux méthodes s'accordent), pas supposé. Si les notes montrent « sans repère » partout, B1 n'a rien lu : dis-le-moi.
Toujours non vérifiés : Edge, Chrome et Edge avant la version 129, un vrai réseau lent.

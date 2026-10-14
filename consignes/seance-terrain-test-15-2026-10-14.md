# Séance terrain « test 15 » : les transitions du lot (B3) (14 octobre 2026)

**Rien ne devrait changer de ce que tu vois ni de ce qu'Ariane décide, pose ou valide.** La test 15 est la test 14 avec un changement **interne** (B3) :
chaque passage du lot d'un état à l'autre a maintenant un seul point d'entrée nommé dans le code.
- Les passages sont : démarrer, pause, reprendre, F5, cut suivant, différé, arrêter, fin de lot et erreur.
- Le moteur n'est pas modifié.
- Le panneau est celui de la test 14.

Ce test sert à vérifier qu'**aucun comportement ne change** par rapport à la test 14. **Si un comportement change, dis-le-moi et reviens à la test 14** (§ 4).

## Le paquet

`ariane-4.9.0-test.15.zip`, version 4.9.0.15, nom « 4.9.0 test 15 ». L'empreinte SHA-256 et la taille sont dans mon message (cette consigne
est dans le paquet : elle ne peut pas porter sa propre empreinte).

## 1. Installer et vérifier (environ 10 minutes)

1. Tout ce que l'ancienne Ariane garde doit être **déjà exporté**.
2. **Contrôle l'empreinte du zip.** PowerShell, dans le dossier du zip : `Get-FileHash .\ariane-4.9.0-test.15.zip -Algorithm SHA256`.
   Les 64 caractères doivent être identiques à ceux de mon message. Sinon, n'installe pas et dis-le-moi.
3. **Pose la test 15 par-dessus l'ancienne** : décompresse le zip dans le même dossier que l'ancienne Ariane, en remplaçant les fichiers. Ne désinstalle rien. Puis, dans
   `chrome://extensions`, clique sur **Recharger** sur la carte Ariane. Une seule Ariane active à la fois.
4. **Recharge l'onglet ESV (F5)**, puis choisis cet onglet dans Ariane.
5. **Vérifie la version** : la carte dit « 4.9.0 test 15 », le panneau dit « ARIANE 4.9.0 test 15 » et le bouton blanc sur la page ESV dit « Ariane 4.9.0 test 15 · ouvrir ».
   Dans les réglages, la ligne « Mode rapide (V3) » dit toujours « neuf cuts sur dix (un sur dix en référence, tiré au sort) », « Allègement des nuages » dit toujours
   « actif (sondes sans information retirées) » et la ligne « Voisins de la liste d’ESV (B1) » dit toujours « en ombre (calculés et consignés, sans effet sur la pose) ».
   Sinon, ne lance rien et dis-le-moi.

## 2. Ce que tu essaies (dans cet ordre)

Mêmes conditions que la test 14 : fenêtre ESV d'au moins 600 pixels, extension Claude désactivée, un seul onglet ESV au premier plan, Orbite seulement.
Pour chaque essai, note en une phrase si c'est **comme dans la test 14** ou **différent** (et quoi).

1. **Démarrer** un lot à plage fixe (premier et dernier cut remplis).
2. **Pause** pendant le lot, attends la fin du cut en cours, puis **Reprendre**.
3. **F5** sur l'onglet ESV pendant la pause, puis **Reprendre** dans Ariane.
4. **Arrêter** le lot en plein cut.
5. Un nouveau lot à plage fixe, laissé **jusqu'à sa fin** (dernier cut du lot).
6. Un lot **jusqu'à la fin de partie**, laissé jusqu'à la fin de la partie.
7. **Une erreur affichée dans l'avis** : démarre un lot alors que l'onglet ESV n'est pas choisi ou pas prêt. Ariane doit le refuser et l'écrire dans l'avis, comme avant.

« Reprendre » juste après « Pause », pendant que le cut finit, est refusé (« Attends la fin de l'action en cours ») : c'est voulu, comme avant.

## 3. À la fin

Même procédure que la test 9 (consigne `seance-terrain-test-9-2026-10-13.md`, § 3) : attends 5 secondes, « Tout télécharger pour l'analyse », vérifie le zip, découpe-le en
morceaux de 20 Mo avec le script de la test 9 s'il fait plus de 20 Mo, envoie tous les morceaux avec la ligne SHA-256, puis vide le cache seulement après ma confirmation de réception.

## 4. Si quelque chose ne va pas, ou si un comportement change

Arrête, note l'heure et le message exact, exporte et envoie-moi le zip. **Ne désinstalle pas Ariane** (ça efface le cache). Retour arrière : exporte, vérifie et envoie le zip, puis
**désactive** la test 15 (interrupteur dans `chrome://extensions`, sans la supprimer) et pose la 4.9.0.14 (`ariane-4.9.0-test.14.zip`, SHA-256
`8e36e2326cefe5c8c9bc40d617b05aaf8a9ca27feca8bd7fb4a0af3ed98abf72`), puis F5 sur ESV. La 4.9.0.14 a le même moteur et le même panneau : seule B3 disparaît.

## 5. Ce qui n'est pas vérifié

B3 a été essayée hors ligne : 9 essais de transitions et tous les essais existants, sans changement des attendus. Elle n'a jamais été utilisée en séance réelle.
Le banc complet avec le corpus privé n'a pas été lancé. Toujours non vérifiés : Edge, Chrome et Edge avant la version 129, un vrai réseau lent.

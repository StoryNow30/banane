# Séance terrain « test 12 » : nouveau panneau Orbite et retour à un cut (14 octobre 2026)

**Rien ne change dans ce qu'Ariane décide, pose ou valide, ni dans sa vitesse.** La test 12 est la test 11 plus deux choses.

**1. Le nouveau panneau Orbite (variante A « Accueil », celle que tu as choisie).** Même contenu, autre présentation : la vue d'Orbite est refaite (couleurs, hiérarchie, grands chiffres).
Le bloc « Ce lot applique » n'est plus sur la vue principale : la politique appliquée au lot est dans **« Détails du lot »** (fermé par défaut, un geste pour l'ouvrir) ; une petite
pastille la signale sur la vue seulement si elle n'est pas la politique par défaut. Rien d'autre n'a disparu : tout se retrouve.

**2. Le retour à un cut, sans bouton.** Ariane sait maintenant aller à un cut précis de la partie chargée et confirmer qu'elle y est (en lecture seule : ni validation, ni SKIP, ni rail touché).
Il n'y a **aucun bouton** dans cette version et la pose ne l'appelle jamais : rien à faire ni à voir. Je ne l'active pas avant de l'avoir validée avec toi sur le terrain.

Tout le reste de la test 11 est inchangé : B1 en ombre (notes `b1-ombre` dans l'export), fiche « Départs des parties », raccourcis `D` et `Maj + Espace`, sauvegarde de secours.

## Le paquet

`ariane-4.9.0-test.12.zip`, version 4.9.0.12, nom « 4.9.0 test 12 ». L'empreinte SHA-256 et la taille sont dans mon message (cette consigne
est dans le paquet : elle ne peut pas porter sa propre empreinte).

## 1. Installer et vérifier (environ 10 minutes)

1. Tout ce que l'ancienne Ariane garde doit être **déjà exporté**.
2. **Contrôle l'empreinte du zip.** PowerShell, dans le dossier du zip : `Get-FileHash .\ariane-4.9.0-test.12.zip -Algorithm SHA256`.
   Les 64 caractères doivent être identiques à ceux de mon message. Sinon, n'installe pas et dis-le-moi.
3. **Pose la test 12 par-dessus l'ancienne** : décompresse le zip dans le même dossier que l'ancienne Ariane, en remplaçant les fichiers. Ne désinstalle rien. Puis, dans
   `chrome://extensions`, clique sur **Recharger** sur la carte Ariane. Une seule Ariane active à la fois.
4. **Recharge l'onglet ESV (F5)**, puis choisis cet onglet dans Ariane.
5. **Vérifie la version** : la carte dit « 4.9.0 test 12 », le panneau dit « ARIANE 4.9.0 test 12 » et le bouton blanc sur la page ESV dit « Ariane 4.9.0 test 12 · ouvrir ».
   Dans les réglages, la ligne « Mode rapide (V3) » dit toujours « neuf cuts sur dix (un sur dix en référence, tiré au sort) », « Allègement des nuages » dit toujours
   « actif (sondes sans information retirées) » et la ligne « Voisins de la liste d’ESV (B1) » dit toujours « en ombre (calculés et consignés, sans effet sur la pose) ».
   Sinon, ne lance rien et dis-le-moi.

## 2. Le lot, et ce que tu regardes en plus

Mêmes conditions que la test 11 : fenêtre ESV d'au moins 600 pixels, extension Claude désactivée, un seul onglet ESV au premier plan, Orbite seulement, tu ne touches à rien.
**Regarde le panneau pendant le lot** et dis-moi, en une phrase chacun : ce qui est lisible, ce qui ne l'est pas, ce qui manque. C'est la seule chose nouvelle. Continue de comparer la ligne
« Départs des parties » aux chiffres d'ESV (validés + invalides = total).

## 3. À la fin du lot

Même procédure que la test 9 (consigne `seance-terrain-test-9-2026-10-13.md`, § 3) : attends 5 secondes, « Tout télécharger pour l'analyse », vérifie le zip, découpe-le en
morceaux de 20 Mo avec le script de la test 9 s'il fait plus de 20 Mo, envoie tous les morceaux avec la ligne SHA-256, puis vide le cache seulement après ma confirmation de réception.

## 4. Si quelque chose ne va pas

Arrête, note l'heure et le message exact, exporte et envoie-moi le zip. **Ne désinstalle pas Ariane** (ça efface le cache). Retour arrière : exporte, vérifie et envoie le zip, puis
**désactive** la test 12 (interrupteur dans `chrome://extensions`, sans la supprimer) et pose la 4.9.0.11 (`ariane-4.9.0-test.11.zip`, SHA-256
`a9675f286a14fcdba2e1acf8521241ccc5dc8a734d29a1d88bd2f7f1b36c1a1c`), puis F5 sur ESV. La 4.9.0.11 garde le même moteur : seul le panneau change.

## 5. Ce qui n'est pas vérifié

Le nouveau panneau : essayé hors ligne (essais et rendu dans Chromium), jamais utilisé en séance réelle. Le retour à un cut : essayé sur une page ESV synthétique, jamais sur le vrai ESV ; il
n'est pas appelé. Toujours non vérifiés : Edge, Chrome et Edge avant la version 129, un vrai réseau lent.

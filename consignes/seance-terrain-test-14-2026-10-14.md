# Séance terrain « test 14 » : le vert de la tuile du lot (14 octobre 2026)

**Rien ne change dans ce qu'Ariane décide, pose ou valide, ni dans sa vitesse.** La test 14 est la test 13 avec une seule correction : **le vert de la tuile du lot**.
Dans la test 13, il restait vide pour un lot « jusqu'à la fin de partie », parce qu'Ariane ne connaissait pas la fin du lot.

Désormais :
- **Lot avec un dernier cut** : le vert se remplit comme avant (part de la plage parcourue).
- **Lot « jusqu'à la fin de partie »** : Ariane lit le compteur d'ESV « cut N sur M » ; le dernier cut de la partie est M−1. Le vert se remplit jusqu'à ce cut.
- **Si le compteur n'est pas lisible** : le vert devient une bande animée et la tuile dit « fin de partie inconnue ». Jamais de faux pourcentage.
- Le vert avance à chaque cut. Il ne recule pas si tu reviens sur un cut précédent.

Tout le reste de la test 13 est inchangé : cartes « Départs des parties », politique du lot dans « Détails du lot », B1 en ombre, raccourcis `D` et `Maj + Espace`.

## Le paquet

`ariane-4.9.0-test.14.zip`, version 4.9.0.14, nom « 4.9.0 test 14 ». L'empreinte SHA-256 et la taille sont dans mon message (cette consigne
est dans le paquet : elle ne peut pas porter sa propre empreinte).

## 1. Installer et vérifier (environ 10 minutes)

1. Tout ce que l'ancienne Ariane garde doit être **déjà exporté**.
2. **Contrôle l'empreinte du zip.** PowerShell, dans le dossier du zip : `Get-FileHash .\ariane-4.9.0-test.14.zip -Algorithm SHA256`.
   Les 64 caractères doivent être identiques à ceux de mon message. Sinon, n'installe pas et dis-le-moi.
3. **Pose la test 14 par-dessus l'ancienne** : décompresse le zip dans le même dossier que l'ancienne Ariane, en remplaçant les fichiers. Ne désinstalle rien. Puis, dans
   `chrome://extensions`, clique sur **Recharger** sur la carte Ariane. Une seule Ariane active à la fois.
4. **Recharge l'onglet ESV (F5)**, puis choisis cet onglet dans Ariane.
5. **Vérifie la version** : la carte dit « 4.9.0 test 14 », le panneau dit « ARIANE 4.9.0 test 14 » et le bouton blanc sur la page ESV dit « Ariane 4.9.0 test 14 · ouvrir ».
   Dans les réglages, la ligne « Mode rapide (V3) » dit toujours « neuf cuts sur dix (un sur dix en référence, tiré au sort) », « Allègement des nuages » dit toujours
   « actif (sondes sans information retirées) » et la ligne « Voisins de la liste d’ESV (B1) » dit toujours « en ombre (calculés et consignés, sans effet sur la pose) ».
   Sinon, ne lance rien et dis-le-moi.

## 2. Le lot, et ce que tu regardes en plus

Mêmes conditions que la test 13 : fenêtre ESV d'au moins 600 pixels, extension Claude désactivée, un seul onglet ESV au premier plan, Orbite seulement, tu ne touches à rien.
**Regarde le vert de la tuile du lot** pendant un lot « jusqu'à la fin de partie », et dis-moi en une phrase :
- s'il se remplit et avance à chaque cut ;
- ou s'il affiche la bande « fin de partie inconnue ».

Si tu peux, note aussi le compteur « cut N sur M » qu'ESV affiche.

## 3. À la fin du lot

Même procédure que la test 9 (consigne `seance-terrain-test-9-2026-10-13.md`, § 3) : attends 5 secondes, « Tout télécharger pour l'analyse », vérifie le zip, découpe-le en
morceaux de 20 Mo avec le script de la test 9 s'il fait plus de 20 Mo, envoie tous les morceaux avec la ligne SHA-256, puis vide le cache seulement après ma confirmation de réception.

## 4. Si quelque chose ne va pas

Arrête, note l'heure et le message exact, exporte et envoie-moi le zip. **Ne désinstalle pas Ariane** (ça efface le cache). Retour arrière : exporte, vérifie et envoie le zip, puis
**désactive** la test 14 (interrupteur dans `chrome://extensions`, sans la supprimer) et pose la 4.9.0.13 (`ariane-4.9.0-test.13.zip`, SHA-256
`a55f60bb6eb5e23424c45aa31ef4189b42b349c8e68895aee1549f5c0bfbf201`), puis F5 sur ESV. La 4.9.0.13 garde le même moteur : seul le panneau change.

## 5. Ce qui n'est pas vérifié

Le vert d'un lot « jusqu'à la fin de partie » : essayé hors ligne (essais, et le vrai panneau dans Chromium avec un ESV simulé), jamais en séance réelle avec le vrai compteur d'ESV.
Toujours non vérifiés : Edge, Chrome et Edge avant la version 129, un vrai réseau lent.

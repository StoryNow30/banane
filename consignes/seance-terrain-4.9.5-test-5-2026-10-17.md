# Séance terrain « 4.9.5 test 5 » : la liste « À contrôler » et des parties neuves (17 octobre 2026)

**Rien ne change dans ce qu'Orbite décide, lit, pose ou valide, ni dans ce qu'Écho observe.** Le moteur n'est pas modifié, le mode rapide non plus.
Ariane n'envoie aucune commande de plus à ESV. Tout le reste de la test 4 est là, sans changement.

## Ce qui change pour toi

- **La carte « À contrôler », en fin de lot.** Quand un lot Orbite est fini, une carte apparaît dans le panneau, sous « Ce lot » : le nombre de verts à relire, le temps estimé, et les plages où aller (« grappe 268–278 », « autour du différé 283 », « PN 1656–1663 »…). Ce sont des cuts verts qu'Orbite n'a pas visités et qui ressemblent à des erreurs. La liste complète part dans l'export. Ariane ne fait rien dans ESV pour la dresser. Pendant un lot, la carte est cachée.
- **Écho note tes gestes sur la vue.** Quand tu glisses la vue au clic gauche ou que tu dézoomes à la molette, Écho note la longueur, la durée et le nombre de crans. Rien n'est empêché ni commandé : c'est pour apprendre ton geste.
- **Des idées sont notées, jamais appliquées.** Ariane note aussi, à côté de la vraie pose : la voie prédite d'un cut différé, tes règles de métier (PN, grappes de différés), une hauteur corrigée, et la correction verticale P8 de la test 4. La page Réglages les montre, « consignées seulement ». **Déplacer la vue** est dans la version, mais **coupé**.

## Le paquet

`ariane-4.9.5-test.5.zip`, version 4.9.5.5, nom « 4.9.5 test 5 ». L'empreinte SHA-256 et la taille sont dans mon message (cette consigne est dans le paquet : elle ne peut pas porter sa propre empreinte).

## 1. Installer et vérifier (environ 10 minutes)

1. Tout ce que la test 4 garde doit être **déjà exporté** (lot Orbite et session Écho).
2. **Contrôle l'empreinte du zip.** PowerShell, dans le dossier du zip : `Get-FileHash .\ariane-4.9.5-test.5.zip -Algorithm SHA256`. Les 64 caractères doivent être identiques à ceux de mon message. Sinon, n'installe pas et dis-le-moi.
3. **Pose la 4.9.5 test 5 par-dessus la test 4** : décompresse le zip dans le même dossier, en remplaçant les fichiers. Ne désinstalle rien. Puis, dans `chrome://extensions`, clique sur **Recharger** sur la carte Ariane.
4. **Recharge l'onglet ESV (F5)**, puis choisis cet onglet dans Ariane.
5. **Vérifie la version** : la carte dit « 4.9.5 test 5 », le panneau dit « ARIANE 4.9.5 test 5 » et le bouton blanc sur la page ESV dit « Ariane 4.9.5 test 5 · ouvrir ». Sinon, ne lance rien et dis-le-moi.

## 2. Ce qu'on te demande

1. **Des parties neuves.** Prends des parties qu'Orbite et toi n'avez jamais traitées : pas les parties 12, 13, 17, 24 et 29 du premier projet, ni la partie 1 du second. Ces parties neuves sont **réservées au jugement** : elles servent à juger les idées notées, jamais à les régler.
2. Pour chaque partie : **un lot Orbite** sur toute la partie, puis **une Écho complète** de la partie.
3. **Au moins une partie à voie décalée**, si tu en as une (beaucoup de différés, comme la partie 1 du second projet).
4. **À la fin du lot, lis la carte « À contrôler »** et note le nombre de cuts et le temps affichés. Démarre Écho et **relis d'abord ces plages**. Puis, **cette fois, relis toute la partie comme d'habitude**, sans sauter les autres verts : on juge la liste, il faut savoir ce qu'elle a manqué.
5. **En Écho, quelques cuts dont le rail est hors de la vue** : déplace la vue comme d'habitude, au **glisser gauche** ou au **dézoom**, puis pose.
6. **Un seul F5 en Écho, en fin de partie** : il reste permis. **Note l'heure.**
7. **Note tout ralentissement du lot** : l'heure, le cut, et ce que tu as vu.

Si un avis apparaît sous le message d'état du panneau (contrat d'ESV, ou « ESV a refusé d'enregistrer la validation… ») : ne lance pas de lot, note l'heure et le texte exact.

## 3. À la fin : les exports

- **Orbite** : « Tout télécharger pour l'analyse ». La liste « À contrôler » est dedans. Envoie **tous les volumes**, avec leur SHA-256 (`Get-FileHash .\ariane-lot-*.zip -Algorithm SHA256`).
- **Écho** : « Terminer et télécharger », puis **tous les volumes**, avec leur SHA-256, l'heure du F5 et tes notes.
- Vide le cache seulement après ma confirmation de réception.

## 4. Si quelque chose ne va pas

Arrête, note l'heure et le message exact, exporte et envoie-moi les zips. **Ne désinstalle pas Ariane** (ça efface le cache).
Retour arrière : exporte, vérifie et envoie les zips, puis **désactive** la 4.9.5 test 5 (interrupteur dans `chrome://extensions`, sans la supprimer), pose la 4.9.5 test 4, puis F5 sur ESV. La pose est la même dans les deux versions.

## 5. Ce qui n'est pas vérifié

- La carte « À contrôler » a été vue dans Chromium sur un lot simulé, jamais sur un vrai lot. Elle a besoin de la liste d'ESV chargée en entier : si elle dit « Instantané de la liste absent », note-le.
- Le temps affiché compte 3,7 secondes par vert : la vraie liste peut être un peu plus longue.
- Le relevé de tes gestes n'a jamais été vu sur le vrai ESV.
- Edge n'a pas été vu.

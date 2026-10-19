# Séance terrain « 4.9.5 test 6 » : deux façons de cliquer, les aiguillages dans « À contrôler » (17 octobre 2026)

**La pose ne change pas : Orbite pose les rails au même endroit qu'avant.** Le moteur n'est pas modifié. Ce qui change, si tu le choisis : la façon de cliquer, et une règle de mise en attente. Le reste de la test 5 est là.

## Ce qui change pour toi

- **Le clic du mode rapide, au choix.** Dans Orbite, une carte « Clic du mode rapide » propose trois choix :
  - « Comme avant » : le rail gauche est cliqué hors de l'écran, ce qu'aucun humain ne peut faire ;
  - « Variante : rail gauche recentré » : le rail gauche est cliqué après avoir recentré la vue ;
  - « Tout recentré, comme un humain » : les deux rails, après avoir recentré la vue.
  Un lot dure 6 à 9 % de plus en variante, 12 à 18 % en « tout recentré ». Le choix est gardé et lu au démarrage de chaque lot : un changement pendant un lot sert au lot suivant, et le panneau le dit.
- **Une règle métier, coupée par défaut.** La case « Règle métier : mettre en attente les cuts d’une grappe (aiguille, série de rouges) ». Cochée, Ariane met en attente un cut qu'elle aurait validé au milieu d'une grappe ; elle ne pose jamais ailleurs. Lue au démarrage du lot, comme le clic.
- **La carte « À contrôler » montre aussi les aiguillages** : des plages « ADV 1200–1215 ».
- **Ariane note chaque clic parti hors de la vue**, sans rien changer.
- **Liste corrigée** : le dernier lot fait foi pour un cut vu par plusieurs lots ; la liste part aussi dans l'export sans zip.
- **Toujours coupés** : la mémoire des différés de l'Écho et **déplacer la vue**.

## Le paquet

`ariane-4.9.5-test.6.zip`, version 4.9.5.6. L'empreinte SHA-256 et la taille sont dans mon message.

## 1. Installer et vérifier

1. Exporte d'abord tout ce que la test 5 garde.
2. **Contrôle l'empreinte du zip.** PowerShell, dans le dossier du zip : `Get-FileHash .\ariane-4.9.5-test.6.zip -Algorithm SHA256`. Les 64 caractères doivent être ceux de mon message. Sinon, n'installe pas.
3. **Pose la 4.9.5 test 6 par-dessus la test 5** : décompresse le zip dans le même dossier, en remplaçant les fichiers. Ne désinstalle rien. Puis, dans `chrome://extensions`, clique sur **Recharger** sur la carte Ariane.
4. **Recharge l'onglet ESV (F5)**, puis choisis-le dans Ariane.
5. **Vérifie la version** : la carte dit « 4.9.5 test 6 », le panneau dit « ARIANE 4.9.5 test 6 » et le bouton blanc sur la page ESV dit « Ariane 4.9.5 test 6 · ouvrir ». Dans Orbite, « Comme avant » est coché et la case de la règle est vide. Sinon, ne lance rien et dis-le-moi.

## 2. L'essai des deux méthodes

1. **Des parties neuves** : pas les parties 12, 13, 17, 24 et 29 du premier projet, ni la partie 1 du second.
2. **Un lot en « Variante »** : coche-la **avant** de démarrer le lot.
3. **Un lot en « Tout recentré »** sur une autre partie.
4. **Si tu le peux, un lot « Comme avant »** sur une partie semblable, pour comparer.
5. Chaque fois, **note l'heure de début et l'heure de fin du lot**, et dis-moi si tu vois une **différence de vitesse ou de comportement** (vue, pause, message).

## 3. Pour chaque partie : la liste, puis une Écho complète

1. Un **lot Orbite** sur toute la partie, puis **une Écho complète**.
2. **À la fin du lot, lis la carte « À contrôler »**, zones d'ADV comprises : note le nombre et le temps affichés.
3. En Écho, **relis d'abord ces plages**, puis **relis toute la partie comme d'habitude** : on juge la liste, il faut savoir ce qu'elle a manqué.
4. Un seul F5 en Écho, en fin de partie, l'heure notée.

## 4. La règle « grappe de différés »

**Active-la sur un lot de ton choix**, si possible sur une partie avec des aiguillages, puis **note les cuts mis en attente que tu trouves inutiles**.

## 5. À la fin : les exports

- **Orbite** : « Tout télécharger pour l'analyse », après chaque lot. Le choix du clic et de la règle y est noté. Envoie **tous les volumes**, avec leur SHA-256 (`Get-FileHash .\ariane-lot-*.zip -Algorithm SHA256`) et tes heures.
- **Écho** : « Terminer et télécharger », **tous les volumes**, leur SHA-256, l'heure du F5 et tes notes.
- Vide le cache seulement après ma confirmation de réception.

## 6. Si quelque chose ne va pas

Arrête, note l'heure et le message, exporte et envoie les zips. **Ne désinstalle pas Ariane** (ça efface le cache).
Retour arrière : exporte, vérifie et envoie les zips, puis **désactive** la 4.9.5 test 6 (interrupteur dans `chrome://extensions`, sans la supprimer). Décompresse le zip de la 4.9.5 test 5 dans le même dossier, en remplaçant les fichiers, puis **réactive** la carte Ariane et clique sur **Recharger**, puis F5 sur ESV. La test 5 clique toujours « Comme avant », sans la règle.

## 7. Ce qui n'est pas vérifié

- Les deux méthodes ont été mesurées au banc, jamais dans le vrai ESV.
- Le choix du clic et la case ont été vus dans Chromium, pas sur un vrai lot.
- La règle n'a jamais été activée sur le terrain : on ne sait pas combien de cuts elle met en attente pour rien.
- Les zones d'ADV : 8 sur 8 trouvées, sur des parties qui ont toutes servi à régler.
- La carte « À contrôler » a besoin de la liste d'ESV chargée en entier : si elle dit « Instantané de la liste absent » ou « Liste d’ESV non lue », note-le.
- Edge n'a pas été vu.

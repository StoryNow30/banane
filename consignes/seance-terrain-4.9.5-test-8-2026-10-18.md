# Séance terrain « 4.9.5 test 8 » : la relecture couvre ce que tu contrôles

**La pose ne change pas : Orbite pose les rails au même endroit qu'avant.** Le moteur n'est pas modifié. Ce qui change : la **couverture de la relecture après le lot**, d'après ton Écho de la partie 11. Elle reste coupée tant que tu ne la choisis pas.

## Ce qui change pour toi

- **Plus de plafond en ADV** : Ariane relit toutes les zones d'ADV qu'elle a détectées, et enchaîne celles qui sont séparées de 40 cuts au plus. **La relecture dure plus longtemps** : environ 12 minutes pour une partie comme la 11, contre 4 minutes.
- **La liste « À contrôler » est relue en entier** : aucun plafond ne peut plus en écarter un cut.
- **Un cut à l'écartement hors norme est relu avec son cut d'avant et son cut d'après.** En « Corriger », il peut être corrigé comme un vert d'abords : 8 mm au moins, 45 mm en travers au plus, jamais un cut posé ou différé par le lot, jamais un SKIP.
- Le reste est celui de la test 7 : « Coupée » (par défaut), « Ombre » et « Corriger », avec **Maj+Espace**. La relecture part seule après un lot jusqu'à la fin de la partie ; « Arrêter la relecture » l'arrête.
- **Toujours coupés** : la mémoire des différés de l'Écho et **déplacer la vue**.

## 1. Installer et vérifier

1. Exporte d'abord ce que la test 7 garde.
2. **Contrôle l'empreinte du zip.** PowerShell, dans le dossier du zip : `Get-FileHash .\ariane-4.9.5-test.8.zip -Algorithm SHA256`. Les 64 caractères doivent être ceux de mon message, sinon n'installe pas.
3. **Pose la 4.9.5 test 8 par-dessus la test 7** : décompresse le zip dans le même dossier, en remplaçant les fichiers. Ne désinstalle rien. Dans `chrome://extensions`, clique sur **Recharger** sur la carte Ariane.
4. **Recharge l'onglet ESV (F5)**, puis choisis-le dans Ariane.
5. **Vérifie la version** : la carte dit « 4.9.5 test 8 », le panneau dit « ARIANE 4.9.5 test 8 » et le bouton blanc sur la page ESV dit « Ariane 4.9.5 test 8 · ouvrir ». Dans la carte « Relecture après le lot », ton dernier choix est gardé : « Coupée » est cochée sauf si tu avais laissé « Ombre » ou « Corriger ».

## 2. Un lot en « Corriger »

1. **Une partie neuve** : pas les parties 12, 13, 17, 24 et 29 du premier projet, ni les parties 1 et 11 du second. De préférence avec des PN et des ADV : note leurs plages et leurs aiguilles.
2. Coche **« Corriger »** **avant** de démarrer le lot, puis lance-le jusqu'à la fin de la partie (« Dernier cut » vide).
3. Quand le lot finit, la relecture part seule. Sinon la carte dit pourquoi (lot borné : valide le dernier cut, puis « Lancer la relecture »). **Ne touche à rien dans ESV pendant qu'elle travaille.** Note l'heure de début et l'heure de fin (« Relecture finie »).
4. Fais ensuite **une Écho complète** : note **combien de cuts tu as dû reprendre parmi ceux qu'Ariane a corrigés**, et les cuts faux qu'elle a laissés.
5. Si la relecture s'arrête sur un cut ou demande « J’ai contrôlé le cut » : lis le message, contrôle ce cut dans ESV, clique, note-le.

## 3. Un lot en « Ombre » (si tu as le temps)

Même déroulé, sur une autre partie neuve, avec **« Ombre »** **avant** de démarrer le lot : elle visite et note, sans écrire. Puis **une Écho complète**.

## 4. À la fin : les exports

- **Orbite** : « Tout télécharger pour l'analyse », après chaque lot. Le choix de la relecture y est noté (Ombre ou Corriger). Exporte après « Relecture finie ». Envoie **tous les volumes**, avec leur SHA-256 (`Get-FileHash` sur chaque zip) et tes heures.
- **Écho** : « Terminer et télécharger », **tous les volumes**, leur SHA-256, l'heure du F5 et tes notes.
- Vide le cache seulement après ma confirmation de réception. Après la séance, remets « Coupée ».

## 5. Si quelque chose ne va pas

Arrête, note l'heure et le message, exporte et envoie les zips. **Ne désinstalle pas Ariane.**
Retour arrière : exporte, vérifie et envoie les zips, puis **désactive** la 4.9.5 test 8 (interrupteur dans `chrome://extensions`, sans la supprimer). Décompresse le zip de la 4.9.5 test 7 dans le même dossier, en remplaçant les fichiers, puis **réactive** la carte Ariane et clique sur **Recharger**, puis F5 sur ESV.

## 6. Ce qui n'est pas vérifié

- **Maj+Espace envoyé par Ariane a servi dans le vrai ESV** (18 corrections, aucune écriture refusée) ; si ESV change de cut, la relecture s'arrête et nomme le cut.
- **Une zone d'ADV peut encore échapper à Ariane** : la première de la partie 11 (cuts 6362 à 6424) n'était pas détectée. Contrôle-la toi-même.
- Le seuil de 9 % n'est pas démontré pour l'ADV, les abords et les écartements (3 cas seulement comparés à toi).
- La durée de 12 minutes est estimée, pas mesurée.
- La relecture a lieu après le lot, pas au fil du lot. Edge n'a pas été vu.

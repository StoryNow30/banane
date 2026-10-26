# Séance terrain « 4.9.5 test 10, 11 et 12 » : le nouveau panneau, en trois présentations (19 octobre 2026)

**La pose ne change pas : Orbite pose les rails au même endroit qu'avant, Écho observe comme avant.** Le moteur, le lot, la relecture et les exports ne sont pas modifiés. Ce qui change : l'**apparence du panneau**, en trois versions à essayer l'une après l'autre.

| Version | Zip | Présentation de départ |
|---|---|---|
| **4.9.5 test 10** | `ariane-4.9.5-test.10-linear.zip` | **Linear** : liste dense des cuts avec leur statut, volet de détail, palette de commandes |
| **4.9.5 test 11** | `ariane-4.9.5-test.11-raycast.zip` | **Raycast** : une barre, la première suggestion est la suite logique |
| **4.9.5 test 12** | `ariane-4.9.5-test.12-figma.zip` | **Figma et Arc** : la partie en ruban de cuts, inspecteur à droite |

Les trois présentations sont dans chaque zip : **Réglages → Interface** les change sans réinstaller, et « Ancien panneau » (ou la liste) ramène le panneau de la test 9 entier.

## 1. Installer, une version à la fois

1. Exporte d'abord ce que la test 9 garde.
2. **Contrôle l'empreinte du zip** : `Get-FileHash .\ariane-4.9.5-test.10-linear.zip -Algorithm SHA256`. Les 64 caractères doivent être ceux de mon message.
3. Décompresse le zip **dans le même dossier** que la test 9, en remplaçant les fichiers. Ne désinstalle rien. Dans `chrome://extensions`, clique sur **Recharger** sur la carte Ariane. **Une seule Ariane active à la fois** : pour passer à la version suivante, refais les étapes 2 et 3 avec l'autre zip.
4. **Recharge l'onglet ESV (F5)**, puis ouvre Ariane. La fenêtre s'agrandit toute seule.
5. **Vérifie la version** : la carte dit « 4.9.5 test 10 » (ou 11, 12) et le bouton blanc sur la page ESV dit « Ariane 4.9.5 test N · ouvrir ».

## 2. Ce qu'il y a à essayer

- **Orbite** : un lot court. Regarde si tu sais, à chaque instant, **ce que tu dois faire** : le bouton plein vert est celui du panneau d'avant. Essaie **Pause** puis **Reprendre**.
- **Écho** : une courte séance, puis « Terminer et télécharger ».
- **Au clavier** : `Ctrl K` (palette de commandes), `J` et `K` ou les flèches pour se déplacer, `Entrée` pour le bouton principal, `Échap` pour revenir.
- **Réglages** : « Après le lot », « Clic du mode rapide », « Série de différés » et « Raison de la correction » sont les mêmes choix que dans le panneau d'avant, sans cases : une liste chacun.
- **Dis-moi** : laquelle des trois tu garderais, et ce qui manque ou gêne.

## 3. Ce qui ne change pas

- Orbite, la pose, le lot, la relecture après le lot, le moteur, Écho : comme à la test 9. Chaque clic sur le nouveau panneau **clique le bouton d'origine** : mêmes messages au service worker, mêmes exports (un essai le compare).
- Les choix gardés (relecture, clic, grappe, raison) gardent leurs valeurs de la test 9. Rien n'est coché de plus ou de moins qu'avant.

## 4. Si quelque chose ne va pas

Arrête, note l'heure et le message, exporte et envoie les zips. **Ne désinstalle pas Ariane.** Dans le nouveau panneau, « Ancien panneau » ramène l'ancien en un clic.
Retour arrière : exporte, vérifie et envoie les zips, puis **désactive** la version (interrupteur dans `chrome://extensions`, sans la supprimer). Décompresse le zip de la 4.9.5 test 9 dans le même dossier, en remplaçant les fichiers, puis **réactive** la carte Ariane et clique sur **Recharger**, puis F5 sur ESV.

## 5. Ce qui n'est pas vérifié

- **Chrome réel** : les trois présentations ont été vues dans un Chromium de test, avec un état fabriqué, jamais sur un vrai lot ni dans ESV.
- **La taille de la fenêtre** : Ariane demande à Chrome d'agrandir sa fenêtre (1 120 × 760 pour Linear et Figma, 900 × 660 pour Raycast) ; si Chrome refuse, la mise en page se resserre.
- **Le flou de Raycast** : la fenêtre est opaque, pas translucide au-dessus d'ESV (une fenêtre d'extension ne peut pas l'être).
- **Le compteur GCV2** : le total (2 684) est une valeur écrite à la main au 19 octobre ; seule la part de la séance d'Écho est en direct.
- **Pas dans ces versions** : le bouton « Envoyer » avec message à coller et empreintes (« Tout télécharger » et « Terminer et télécharger » sont gardés tels quels), les profils de séance, l'envoi automatique.

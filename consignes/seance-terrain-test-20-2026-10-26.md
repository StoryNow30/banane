# Séance terrain « 4.9.5 test 20 (L1-e6) » : connexion à ESV tenue à jour, reconnexion après F5

**Ce qui change par rapport à la test 19 : la connexion à ESV seulement.**

- **Le message « ESV n'est pas connecté… » ne reste plus affiché à tort.** Il ne paraît que si ESV est vraiment injoignable, ou si aucun onglet ESV n'est choisi. Il disparaît dès que la page est prête.
- **Après un F5 sur ESV, Ariane se reconnecte seule** à l'onglet choisi, sans repasser par le menu. Elle ne le fait jamais pendant un lot (pause comprise), une deuxième passe, une relecture ou un Écho. Un lot en pause reste repris par ton clic sur « Reprendre », jamais seul.
- **Un bouton « Reconnecter »** apparaît à côté du choix de l'onglet ESV, quand un onglet est choisi.
- En coulisse, invisible dans le panneau actuel : l'historique des parties est maintenant gardé dans une clé qui survit au vidage du cache ; la nouvelle interface l'affichera. Ariane relève aussi, en lecture seule, la liste des parties de la page ESV, pour préparer l'enchaînement des parties.

Tout le reste est identique à la test 19 : la pose, la décision des cuts, la deuxième passe des différés, la relecture, l'Écho. Les poses déjà écrites dans ESV ne changent pas.

## 1. Avant d'installer : exporter

L'installation se fait par-dessus, dans le même dossier : le cache est gardé. Exporte quand même d'abord, dans cet ordre :

1. les **fiches de départ** ;
2. **« Exporter tout »** ;
3. l'export de la **partie à 95 différés**, si elle est encore dans le cache.

Envoie-moi les zips. Je les archive avant toute analyse.

## 2. Installer et vérifier

1. **Contrôle l'empreinte du zip** (PowerShell, dans le dossier du zip) : `Get-FileHash .\ariane-4.9.5-test.20.zip -Algorithm SHA256`. Les 64 caractères doivent être ceux de mon message, sinon n'installe pas.
2. **Pose la test 20 par-dessus la test 19** : décompresse le zip dans le même dossier, en remplaçant les fichiers. Dans `chrome://extensions`, clique sur **Recharger** sur la carte Ariane.
3. **F5 sur l'onglet ESV**, puis choisis-le dans Ariane, une dernière fois par le menu.
4. **Vérifie la version** : la carte, le panneau et le bouton blanc d'ESV disent « 4.9.5 test 20 (L1-e6) ».

Rien à régler.

## 3. Les essais à faire (5 minutes, sans lot en cours)

1. **Trois F5 de suite** sur l'onglet ESV, en laissant la page finir de charger à chaque fois. Après chacun, sans toucher au menu, Ariane doit redevenir prête. Le message « ESV n'est pas connecté » peut paraître pendant le chargement, puis il doit disparaître.
2. **Note le temps** entre la fin du chargement de la page et le moment où Ariane est prête. Il doit être sous la minute.
3. **Le bouton « Reconnecter »** : clique une fois dessus, Ariane doit redevenir prête sans message.
4. Ouvre une coupe où la **liste des parties** d'ESV est visible à l'écran, et laisse Ariane prête quelques secondes dessus.
5. **« Exporter tout »** et envoie-moi le zip : son journal contient le relevé de la liste des parties et les équipements de l'onglet après chaque F5.

Ensuite, travaille normalement. Un lot en cours ne doit jamais être relancé seul après un F5.

## 4. À partir de maintenant : un export après chaque partie

Fais **« Exporter tout » après chaque partie, avant de vider le cache**. Il faut 60 cuts écrits par la deuxième passe pour le contrôle que tu as accepté, et je n'en ai qu'un.

## 5. Si quelque chose ne va pas

1. Arrête ce que tu fais.
2. Note l'heure et le message.
3. Exporte et envoie les zips.

**Ne désinstalle pas Ariane.**

Retour arrière vers la test 19 : exporte, désactive la test 20 dans `chrome://extensions` sans la supprimer, décompresse le zip de la **4.9.5 test 19** dans le même dossier, réactive la carte, clique sur **Recharger**, F5 sur ESV.

## 6. Ce qui n'est pas vérifié

- La reconnexion n'a jamais tourné dans le vrai ESV. Elle est prouvée en essais (page prête 4 ms après la fin du chargement, 0 commande ESV, une seule reconnexion quand l'Écho et Ariane se réveillent ensemble) et sur la maquette.
- Le temps avant « prête » dans ESV, et les trois F5 de suite : c'est ce que cette séance mesure.
- La liste des parties d'ESV n'a jamais été vue par Ariane : sa forme est supposée.
- Tout ce que la test 19 n'avait pas prouvé reste vrai : l'écriture de la deuxième passe dans ESV, la tenue hors échantillon, Edge.

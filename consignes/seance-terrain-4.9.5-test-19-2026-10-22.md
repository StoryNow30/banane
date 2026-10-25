# Séance terrain « 4.9.5 test 19 (L1-e6) » : un seul correctif, l'Écho ne bloque plus le nouvel Écho

**Ce qui change par rapport à la test 18 : une seule chose.**

- Après un Écho terminé et téléchargé (« Terminer et télécharger »), le message « La session Écho précédente (N visite(s)) n'a pas été téléchargée en entier » ne revient plus quand tu veux lancer un nouvel Écho.
- La cause : Ariane notait bien le téléchargement dans le panneau, mais le service worker ne retenait pas que c'était l'export final. « Télécharger à nouveau la session » ne servait donc à rien.

Tout le reste est identique à la test 18 : la pose, la décision des cuts, la deuxième passe des différés (qui écrit dans ESV), la relecture, l'interface. Les poses déjà écrites dans ESV ne changent pas.

## 1. Installer et vérifier

1. Exporte d'abord ce que ta version actuelle garde.
2. **Contrôle l'empreinte du zip** (PowerShell, dans le dossier du zip) : `Get-FileHash .\ariane-4.9.5-test.19.zip -Algorithm SHA256`. Les 64 caractères doivent être ceux de mon message, sinon n'installe pas.
3. **Pose la test 19 par-dessus la test 18** : décompresse le zip dans le même dossier, en remplaçant les fichiers. Dans `chrome://extensions`, clique sur **Recharger** sur la carte Ariane.
4. **F5 sur l'onglet ESV**, puis choisis-le dans Ariane.
5. **Vérifie la version** : la carte, le panneau et le bouton blanc d'ESV disent « 4.9.5 test 19 (L1-e6) ».

Rien à régler.

## 2. L'essai à faire

1. Si le message est déjà affiché pour une session Écho dont tu as envoyé les zips : clique sur **« Télécharger à nouveau la session »**, laisse l'export se terminer, puis lance ton nouvel Écho. Cette fois le téléchargement confirmé est retenu.
2. La fois suivante, fais comme d'habitude : « Terminer et télécharger », puis démarre un nouvel Écho tout de suite. Il ne doit plus être refusé.
3. Si le message revient quand même, note l'heure et envoie-moi une capture. **N'abandonne pas la session** avant que je t'aie dit que ses zips sont bien archivés.

Un export incomplet (« Export Écho incomplet… ») continue de bloquer le nouvel Écho : c'est voulu, la session n'est pas libérée tant que tous les volumes ne sont pas confirmés.

## 3. Si quelque chose ne va pas

1. Arrête ce que tu fais.
2. Note l'heure et le message.
3. Exporte et envoie les zips.

**Ne désinstalle pas Ariane.**

Retour arrière vers la test 18 : exporte, désactive la test 19 dans `chrome://extensions` sans la supprimer, décompresse le zip de la **4.9.5 test 18** dans le même dossier, réactive la carte, clique sur **Recharger**, F5 sur ESV.

## 4. Ce qui n'est pas vérifié

- Le correctif n'a jamais tourné dans le vrai ESV. Il est couvert par un essai qui rejoue le chemin du panneau jusqu'au service worker (rouge avant, vert après).
- Tout ce que la test 18 n'avait pas prouvé reste vrai : l'écriture de la deuxième passe dans ESV, la tenue hors échantillon, Edge.

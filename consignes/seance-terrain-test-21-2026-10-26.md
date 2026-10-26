# Séance terrain « 4.9.5 test 21 (L1-e6) » : la nouvelle interface Signal, la passe en ombre

La test 21 contient tout ce qu'apportait la test 20, plus deux changements. Si tu n'as pas installé la test 20, installe directement celle-ci.

## Ce qui change

**1. Le panneau est la nouvelle interface, Signal.**

- Au démarrage, tu vois Signal, en sombre. En haut, un mot d'état avec son symbole et une phrase ; au milieu, l'avancement du lot et une seule action principale ; la vitesse en cuts par minute, avec la médiane et le temps restant.
- L'ancien panneau n'apparaît plus. Ses détails techniques sont dans Réglages, « Détails techniques ».
- En bas, le tiroir **« Ce qui reste »** liste les différés et les verts à contrôler. Chaque ligne a deux boutons :
  - **« Examiner »** (E au clavier) montre le cut dans Signal, sans rien envoyer à ESV ;
  - **« Ouvrir dans ESV »** amène ESV sur ce cut. Il est grisé, avec sa raison, pendant un lot, une relecture, une passe ou un Écho.
- En haut à droite, la **puce de l'onglet ESV** donne la liste des onglets et le bouton **« Reconnecter »**.
- **Ctrl K** ouvre la liste des commandes ; **Échap** la ferme.
- Dans une petite fenêtre, Signal passe en mode compact.
- Si Signal ne peut pas s'afficher, l'ancien panneau revient, avec la raison.

**2. La deuxième passe des différés est en ombre par défaut** (ta décision du 26/10). Elle calcule et note ce qu'elle poserait, mais n'écrit plus rien dans ESV. Ses cuts restent différés : tu les fais à la main, comme avant la test 17. L'interrupteur « Deuxième passe » des Réglages allume ou coupe la passe entière ; allumée, elle reste en ombre. **Laisse-la allumée** : c'est son ombre qui servira à vérifier la garde. Rallumer l'écriture demandera une nouvelle version, quand la garde sera prête.

**Déjà dans la test 20** :
- le message « ESV n'est pas connecté » ne reste plus affiché à tort ;
- Ariane se reconnecte seule après un F5, jamais pendant un lot, une passe, une relecture ou un Écho ;
- l'historique des parties survit au vidage du cache ;
- la liste des parties d'ESV est relevée en lecture seule.

**Rien d'autre ne change** : la pose et la décision des cuts, la relecture, l'Écho. Les poses déjà écrites dans ESV ne changent pas.

## 1. Avant d'installer : exporter

L'installation se fait par-dessus, dans le même dossier : le cache est gardé. Exporte quand même d'abord, dans cet ordre :

1. les **fiches de départ** ;
2. **« Exporter tout »** ;
3. l'export de la **partie à 95 différés**, si elle est encore dans le cache.

Envoie-moi les zips.

## 2. Installer et vérifier

1. **Contrôle l'empreinte du zip** (PowerShell, dans le dossier du zip) : `Get-FileHash .\ariane-4.9.5-test.21.zip -Algorithm SHA256`. Les 64 caractères doivent être ceux de mon message, sinon n'installe pas.
2. **Pose la test 21 par-dessus** la version installée (19 ou 20) : décompresse le zip dans le même dossier, en remplaçant les fichiers. Dans `chrome://extensions`, clique sur **Recharger** sur la carte Ariane.
3. **F5 sur l'onglet ESV**, puis choisis-le dans Ariane (puce de l'onglet, en haut à droite).
4. **Vérifie la version** : la carte et le bouton blanc d'ESV disent « 4.9.5 test 21 (L1-e6) ». Dans Signal, la version est dans Réglages.
5. **Vérifie la passe** : dans Réglages, la ligne doit dire « Deuxième passe (en ombre) », allumée.

## 3. Les essais à faire (10 minutes, sans lot en cours)

1. **Trois F5 de suite** sur l'onglet ESV, en laissant la page finir de charger à chaque fois. Après chacun, sans toucher au menu, Ariane doit redevenir prête en moins d'une minute.
2. **« Reconnecter »** dans la puce de l'onglet : Ariane doit redevenir prête, sans message.
3. Ouvre une coupe où la **liste des parties** d'ESV est visible, et laisse Ariane prête quelques secondes dessus.
4. **Regarde Signal** : est-ce clair, que manque-t-il, qu'est-ce qui gêne ? Une capture et une phrase suffisent.
5. Lance un lot comme d'habitude. Après le lot, ouvre « Ce qui reste », clique sur **« Ouvrir dans ESV »** sur un différé : ESV doit aller sur ce cut.
6. **« Exporter tout »** et envoie-moi le zip.

## 4. À partir de maintenant : un export après chaque partie

Fais **« Exporter tout » après chaque partie, avant de vider le cache**. La passe en ombre note tout ce qu'elle aurait posé : ces exports serviront à vérifier la garde avant de rallumer l'écriture.

## 5. Si quelque chose ne va pas

1. Arrête ce que tu fais.
2. Note l'heure et le message, et fais une capture.
3. Exporte et envoie les zips.

**Ne désinstalle pas Ariane.**

Retour arrière vers la test 19 : exporte, désactive la test 21 dans `chrome://extensions` sans la supprimer, décompresse le zip de la **4.9.5 test 19** dans le même dossier, réactive la carte, clique sur **Recharger**, F5 sur ESV. En test 19, la passe écrit : coupe-la entièrement avec son interrupteur dans Réglages.

## 6. Ce qui n'est pas vérifié

- Signal n'a jamais été vu sur ton écran ni dans le vrai ESV : il a été vérifié en essais et sur la maquette, avec l'extension réelle.
- Le mode clair n'a pas été vu dans l'extension.
- Les confirmations (vider le cache, passer un cut) restent les fenêtres du navigateur.
- La vitesse affichée ne compte pas le passage d'un cut au suivant ; il n'y a pas encore de vitesse de relecture.
- La reconnexion n'a jamais tourné dans le vrai ESV ; la liste des parties d'ESV n'a jamais été vue par Ariane.
- Tout ce que la test 19 n'avait pas prouvé reste vrai : la tenue hors échantillon, Edge.

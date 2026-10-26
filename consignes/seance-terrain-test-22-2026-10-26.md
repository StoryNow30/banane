# Séance terrain « 4.9.5 test 22 (L1-e6) » : les défauts de Signal corrigés, la passe qui survit au redémarrage

La test 22 reprend la test 21 (Signal, deuxième passe des différés en ombre) et corrige les défauts que tu as signalés, plus ceux d'une revue de code de Signal. **La pose et la décision des cuts, la relecture et l'Écho ne changent pas.** La deuxième passe reste **en ombre** : elle n'écrit rien dans ESV.

## Ce qui change

**1. Connexion.**
- Le panneau ne reste plus « Hors ligne » à l'ouverture alors qu'un onglet ESV est ouvert : la liste des onglets se remplit, et un seul choix suffit.
- La puce en haut à droite **nomme l'onglet réellement visé**. Si Ariane garde un onglet que tu n'as pas désigné, elle dit « Onglet à choisir ».
- **« Démarrer le lot » n'est actif que si l'onglet est choisi, nommé et prêt.** Sinon il est grisé, avec sa raison (« Choisis un onglet ESV »).
- Un refus de connexion (« Recharge la page ESV (F5)… ») s'affiche maintenant.

**2. Pause et Arrêter retrouvés.** Si tu fermes puis rouvres le panneau pendant un lot, Signal montre Pause et Arrêter (en test 21, il proposait « Démarrer le lot »).

**3. Bascule Orbite / Écho.** Elle n'est plus jamais verrouillée. Une séance Écho finie s'affiche « Séance terminée » et ne bloque plus rien. Les démarrages restent refusés quand il le faut.

**4. « Parties traitées »** affiche le nombre de **cuts skippés** (« 0 skippé », « 2 skippés »), l'heure de Paris, et « ignorés au départ » pour les cuts qu'ESV comptait déjà ignorés. Les parties enregistrées avant la test 22 n'ont pas le nombre de skippés : rien n'est affiché pour elles.

**5. Corrections de la revue de Signal :**
- les **bornes du lot** sont visibles et modifiables après « Nouveau lot », avec la case « Reprise des différés » ;
- « Ouvrir dans ESV » vise **la partie du lot**, pas la partie affichée ; si ESV est sur une autre partie, il refuse et le dit ;
- les refus d'action, l'avis de contrat d'ESV et la correction interrompue sont **affichés** ;
- le **résultat de la deuxième passe en ombre** apparaît en fin de lot (« N sur M qu'elle poserait ») ;
- plus de « 0 vert » avant le calcul des verts ; « validés tels quels » ne compte plus les SKIP ;
- l'écran n'est plus réécrit chaque seconde ;
- dans Ctrl K, une commande dangereuse (Arrêter le lot, SKIP, Terminer et télécharger) demande une **seconde Entrée**.

**6. En coulisse (T21d).** La preuve d'écriture par le serveur est rattachée après coup à chaque cut (le champ de confirmation serveur passe de « faux » à « inconnu » puis « confirmé »). La deuxième passe reprend au point exact si Chrome redémarre le service worker en pleine passe, sans jamais réécrire un cut. Aucun effet visible tant qu'elle reste en ombre.

**Pas dans cette version :** les animations de Signal, le retrait de l'ancien panneau, et la garde des appuis faux de la deuxième passe. La passe reste en ombre.

## 1. Avant d'installer : exporter
L'installation se fait par-dessus, dans le même dossier : le cache est gardé. Exporte quand même d'abord :
1. les **fiches de départ** ;
2. **« Exporter tout »**, après chaque partie, avant de vider le cache.

Envoie-moi les zips.

## 2. Installer et vérifier
1. **Contrôle l'empreinte du zip** (PowerShell, dans le dossier du zip) : `Get-FileHash .\ariane-4.9.5-test.22.zip -Algorithm SHA256`. Les 64 caractères doivent être ceux de mon message, sinon n'installe pas.
2. **Pose la test 22 par-dessus la test 21** : décompresse le zip dans le même dossier, en remplaçant les fichiers. Dans `chrome://extensions`, clique sur **Recharger** sur la carte Ariane.
3. **F5 sur l'onglet ESV**, puis ouvre le panneau d'Ariane.
4. **Vérifie la version** : la carte et le bouton blanc d'ESV disent « 4.9.5 test 22 (L1-e6) ».
5. **Vérifie la passe** : dans Réglages, « Deuxième passe (en ombre) », allumée. Laisse-la allumée.

## 3. Les essais à faire (10 minutes)
1. **Plusieurs onglets ESV ouverts**, panneau fermé, puis ouvre le panneau : la liste des onglets doit s'afficher, sans « Hors ligne ». Choisis ton onglet : **un seul clic**, la puce doit nommer l'onglet. Note si c'est lent.
2. **« Démarrer le lot » avant de choisir un onglet** (ou avec la puce « Onglet à choisir ») : il doit être grisé, avec sa raison.
3. **Bascule Orbite / Écho** : elle doit marcher à tout moment, même juste après une séance Écho.
4. **Sur un lot court : ferme puis rouvre le panneau pendant le lot.** Pause et Arrêter doivent être là. (Ne le fais pas sur un gros lot.)
5. Après le lot : « Parties traitées » doit indiquer les skippés, et la fin de lot doit dire ce que la passe en ombre aurait posé. Clique « Ouvrir dans ESV » sur un différé : ESV doit aller sur ce cut dans la bonne partie.
6. **« Exporter tout »** et envoie-moi le zip.

## 4. Si quelque chose ne va pas
1. Arrête ce que tu fais.
2. Note l'heure et le message, et fais une capture.
3. Exporte et envoie les zips.

**Ne désinstalle pas Ariane.**

Retour arrière vers la test 21 : exporte, désactive la test 22 dans `chrome://extensions` sans la supprimer, décompresse le zip de la **4.9.5 test 21** dans le même dossier, réactive la carte, clique sur **Recharger**, F5 sur ESV. Avec la test 21, évite les lots tant que les défauts de Signal ne sont pas corrigés.

## 5. Ce qui n'est pas vérifié
- Aucune de ces corrections n'a tourné dans ton vrai ESV : elles sont prouvées par essais, sur la maquette avec l'extension réelle (accueil, plusieurs onglets, bascule, démarrage), et par un verify complet (2 659 essais, 0 échec, 0 annulé).
- Le temps de connexion sur le vrai ESV n'est pas mesuré : sur la maquette, prêt en 0,14 à 0,4 s.
- Edge n'est pas essayé.
- Si le panneau revient sur l'écran d'accueil par une manipulation manuelle (adresse modifiée à la main), Signal peut afficher Orbite sans les gardes de l'ancien panneau.
- « Démarrer Écho » vise toujours l'onglet gardé par le service worker et n'est pas conditionné à un onglet prêt.
- Un redémarrage de Chrome pendant le lot lui-même perd encore la mémoire des différés (à traiter plus tard).

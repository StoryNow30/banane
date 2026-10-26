# Séance terrain « 4.9.5 test 23 (L1-e7) » : le total du lot rendu, Signal animé et seul

La test 23 reprend la test 22. **La pose et la décision des cuts, la relecture et l'Écho ne changent pas.** La deuxième passe reste **en ombre** : elle n'écrit rien dans ESV.

## Ce qui change

**1. Le total du lot est rendu.** En test 22, l'écran « En cours » disait « 13 traités » sans total, sans graduations et sans temps restant. La cause : Signal remplit « Dernier cut » avec la fin retenue pour la partie, donc le lot a une borne numérotée et le total était inconnu. Maintenant :
- « **N traités sur M ciblés** », les **graduations** du rail et le **temps restant** s'affichent dès que le total est calculable (M = les cuts invalides compris dans les bornes du lot) ;
- si le total n'est pas calculable de façon sûre, l'écran dit « N traités · total inconnu » : jamais un total deviné ;
- **les bornes du lot sont dites pendant le lot** (« Lot du cut X au cut Y » ou « jusqu'à la fin de la partie ») ;
- à la fin, une ligne « Bornes » et un avis quand le lot s'arrête parce qu'ESV est passé hors des bornes : **rien après le dernier cut n'est traité par ce lot**.

Les bornes envoyées au lot ne changent pas : le premier cut est toujours celui qu'ESV affiche, le dernier est celui du champ « Dernier cut ». Si tu veux un lot jusqu'à la fin de la partie, laisse ce champ vide ou remets la fin de partie.

**2. Signal est la seule présentation.** Le lien « Essayer le nouveau panneau », le choix « Interface » des réglages et les présentations d'essai sont retirés.

**3. Signal bouge, sans tout redessiner.** Le curseur glisse sur le rail, l'anneau se remplit, les chiffres qui changent le signalent une fois, la palette et les réglages entrent sans rejouer leur entrée. Si ton système demande moins de mouvement, tout reste fixe.

**4. En Écho aussi,** le panneau dit quand ESV n'est plus connecté.

**5. En coulisse :** la **garde des appuis faux** de la deuxième passe (elle refuse une pose de la passe quand le déplacement est inférieur à 100 mm et qu'aucune pose normale du lot n'est à 4 cuts ou moins). La passe reste en ombre : la garde est jugée et journalisée, rien n'est écrit.

## 1. Avant d'installer : exporter
L'installation se fait par-dessus, dans le même dossier : le cache est gardé. Exporte quand même d'abord :
1. les **fiches de départ** ;
2. **« Exporter tout »**, après chaque partie, avant de vider le cache.

Envoie-moi les zips.

## 2. Installer et vérifier
1. **Contrôle l'empreinte du zip** (PowerShell, dans le dossier du zip) : `Get-FileHash .\ariane-4.9.5-test.23.zip -Algorithm SHA256`. Les 64 caractères doivent être ceux de mon message, sinon n'installe pas.
2. **Pose la test 23 par-dessus la test 22** : décompresse le zip dans le même dossier, en remplaçant les fichiers. Dans `chrome://extensions`, clique sur **Recharger** sur la carte Ariane.
3. **F5 sur l'onglet ESV**, puis ouvre le panneau d'Ariane.
4. **Vérifie la version** : la carte et le bouton blanc d'ESV disent « 4.9.5 test 23 (L1-e7) ».
5. **Vérifie la passe** : dans Réglages, « Deuxième passe (en ombre) », allumée. Laisse-la allumée.

## 3. Les essais à faire (10 minutes)
1. **Lot court, en regardant l'écran En cours.** Tu dois voir « N traités sur M ciblés », les graduations sur le rail et un temps restant. Note si l'un des trois manque, et ce qui est écrit dans « Premier cut » et « Dernier cut » avant de démarrer.
2. **Dernier cut vide ou fin de partie** : refais un lot court en vidant « Dernier cut ». Le total doit rester affiché.
3. **Pendant le lot,** les bornes sont rappelées en une ligne. À la fin, regarde la ligne « Bornes » et l'avis éventuel « hors du lot ».
4. **Mouvement** : le curseur doit glisser, sans clignoter ni sauter à chaque cut. Note ce qui te gêne.
5. **Bascule Orbite / Écho, onglets ESV, Pause et Arrêter** après fermeture et réouverture du panneau : comme en test 22, rien ne doit avoir régressé.
6. **« Exporter tout »** et envoie-moi le zip.

## 4. Si quelque chose ne va pas
1. Arrête ce que tu fais.
2. Note l'heure et le message, et fais une capture.
3. Exporte et envoie les zips.

**Ne désinstalle pas Ariane.**

Retour arrière vers la test 22 : exporte, désactive la test 23 dans `chrome://extensions` sans la supprimer, décompresse le zip de la **4.9.5 test 22** dans le même dossier, réactive la carte, clique sur **Recharger**, F5 sur ESV.

## 5. Ce qui n'est pas vérifié
- Aucune de ces corrections n'a tourné dans ton vrai ESV : elles sont prouvées par essais (verify complet : 2 673 essais, 0 échec, 0 annulé, 2 ignorés) et sur la maquette avec l'extension réelle. Sur la maquette, trois passes ont donné 29 réussis sur 30, 28 sur 30 et 30 sur 30 : les échecs changent d'une passe à l'autre (« extension non chargée », « précision des nœuds »), déjà vus sur la test 22 sans ces changements.
- Le rejeu des 12 lots de la garde des appuis n'est pas refait sur le code fusionné ; la garde est jugée par ses essais et la passe reste en ombre.
- La garde des appuis est établie sur la seule partie 0 ; sa généralisation reste supposée.
- Edge n'est pas essayé.
- Un redémarrage de Chrome pendant le lot lui-même perd encore la mémoire des différés (à traiter plus tard).
- « Démarrer Écho » vise toujours l'onglet gardé par le service worker et n'est pas conditionné à un onglet prêt.

# U2 4.9 : banc du panneau de production, préparation

Ce support est indépendant de `tests/browser/harness.js` et de la fixture web
historique. Il ne recopie aucun HTML/CSS/JS du panneau. L’outil charge le
`panel.html` de **DOSSIER_CIBLE** sous `chrome-extension://`, vérifie le service
worker MV3 et les URLs de `panel.js` / `panel.css`, et publie commit, manifeste
et empreintes SHA-256. Il ne teste jamais une page ESV.

## Exécution

```sh
node tools/navigateur-panneau-49.cjs DOSSIER_CIBLE --output /chemin/u2-resultats.json
node tools/navigateur-panneau-49.cjs DOSSIER_CIBLE --scenario focus-pause
node tools/navigateur-panneau-49.cjs DOSSIER_CIBLE --headed
```

Prérequis : Node, Playwright avec `chromium`, Chromium compatible avec le
chargement MV3. L’outil cherche `PLAYWRIGHT_MODULE`, le module `playwright`,
le runtime puis l’emplacement historique `/opt/node22`. `CHROMIUM` peut
indiquer un binaire **déjà installé et autorisé** ; sinon l’emplacement fourni
par Playwright est utilisé. Les installations restent à faire séparément,
aucune installation ni repli web simulé dans le banc.

Le profil navigateur est temporaire, neuf et supprimé après le test. Aucun
profil opérateur n’est réutilisé. Le viewport initial est 560 × 900 pixels ;
le réseau HTTP(S) des pages est refusé. Les commandes du panneau ne traversent
jamais le double du backend. Aucun téléchargement/corpus n’est nécessaire.

`backend.cjs` remplace uniquement `chrome.runtime.sendMessage` de la vraie
page **avant** son script. Chaque action est journalisée ; les actions non
simulées rendent une erreur et ne sont jamais transmises au service worker.
La connexion de présence et l’extension restent réelles. Les états sont
synthétiques : aucune géométrie, aucun export brut, aucun onglet ESV.

## Résultats et limites

`matrix.json` énumère les 23 fichiers de scénarios. Chaque fichier est isolé
sur une nouvelle page, limité à 7 s (navigation/chargement/essai inclus) ; le
lancement Chromium est relevé séparément, avec un timeout de 15 s. Chaque
résultat porte un comportement attendu, des références source, sa durée et
les observations/appels. Une erreur de chargement ou d’assertion est conservée.
Une infrastructure absente rend **BLOCKED**, `executed: false`, durée inconnue.
Les scénarios restants sont bloqués si l’infrastructure tombe après un résultat.

Codes de sortie : 0 = périmètre sélectionné exécuté sans échec ni blocage ;
1 = échec ou cible altérée ; 2 = infrastructure/scénario bloqué. Le champ
`executedScopeGate` ne vaut que pour la sélection ; **il ne déclare jamais U2
accepté**, même avec tous les scénarios verts. Un `--scenario` ne vaut pas
exécution de la matrice complète.

Le zoom est obtenu par **chrome.tabs.setZoom(tabId, 2)** dans la vraie extension,
confirmé par `getZoom() === 2` et par les métriques CSS/DPR, sans diminuer le
viewport et sans `style.zoom`. Un refus de cette API rend le scénario bloqué.
Cela vérifie le zoom Chromium dans ce profil ; le comportement du menu de zoom
Edge, son popup et le poste réel restent à contrôler. Les tests de layout
mesurent débordement/troncature et accès après défilement (hit-test des commandes),
pas une certification générale de lisibilité ou de lecteur d’écran.

La tabulation couvre les commandes disponibles dans les états testés ;
les activations avec décompte portent sur Démarrer/Pause/Reprendre/Arrêter Orbite,
Démarrer/Pause Écho. Les exports, l’abandon confirmé, SKIP explicite, la reprise
manuelle et les nouveaux contrôles ajoutés par U1 demandent des scénarios
complémentaires d’activation avant une couverture exhaustive. Aucun scénario
n’est désactivé pour rendre une livraison verte.

La réduction des animations est réellement émulée par Playwright ; styles de
tous les éléments/pseudoéléments et animations actives sont interrogés après
un changement synthétique de cut. Le témoin no-preference vérifie que
l’animation existe sans réduction. Les contrastes utilisent le seuil de texte
ordinaire **4,5:1 déjà adopté D-059/U02**, les tokens corrigés et des couleurs
calculées live/muted ; pas de seuil nouveau, ni certification de tous les SVG,
états superposés et fonds colorés.

## Situation de cette préparation

`resultat-486.json` : 0 exécuté, 0 réussi, 0 échec UI observé, 23 bloqués.
Chromium manque ; son installation standard a échoué. Le banc est écrit et
ses contrôles d’infrastructure sont vérifiés, **sa première exécution réelle
reste à faire**. Aucun diagnostic UI positif/négatif ne découle de ces blocages.

Contrôle local du double, des refus et de la comptabilisation :

```sh
node --test --test-reporter=tap --test-timeout=7000 tests/browser/u2-49/support.test.cjs
```

Ces quatre tests Node ne remplissent aucune porte navigateur. Ils restent
hors `verify`, comme les scénarios navigateur : ne pas additionner leurs
réussites aux comptes de ce banc.

Après disponibilité du navigateur : exécuter toute la matrice sur 4.8.6,
consigner les défauts réels pour attribution à U1 sans corriger le panneau,
puis compléter/rejouer sur le commit U1 exact et sur le commit d’assemblage.
U3 attend toujours U2 et la définition des actions clavier.

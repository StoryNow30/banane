# Relecture après le lot : ombre et correction prudente (5.0, D-170 à D-173)

Branche `claude/50-relecture-ombre`, partie de `claude/50-base` (2d60d04). Demande de Mic : qu'Ariane fasse **elle-même** la relecture qu'il fait en Écho après un lot Orbite (D-170). Accord de Mic pour visiter les verts, d'abord sans rien modifier (D-171). Règle SKIP de Mic (D-172). Condition de la test 7 : des règles métier qui **agissent** (D-173).

**Réglage coupé par défaut.** Mic choisit dans le panneau : « coupée », « ombre » (visite, ne modifie rien) ou « corriger » (corrige seulement les cuts sûrs). Le choix est lu au démarrage du lot et figé pour ce lot.

`src/engine.js` n'est pas touché. `DECISIONS.md` non plus.

## 1. En bref

| | Résultat |
|---|---|
| **Coupée** (défaut) | Rien ne change : le scope du lot ne porte aucun champ nouveau, les commandes envoyées à la page sont celles de la base **octet pour octet** (empreinte prise sur 2d60d04 et empreinte du test 6). Aucune passe. |
| **Ombre** | Après le lot, Ariane visite les cuts que Mic relirait, verts compris, capture, calcule et note. **Aucune pose, aucune validation, aucun SKIP, aucune écriture** : prouvé en essai (service worker réel) et au banc (extension réelle dans Chromium : 0 écriture reçue par le serveur, 0 clic de pose, 0 touche pendant la passe). |
| **Corriger** | Seuls les cuts qui passent la **règle prudente** sont corrigés, par la **même commande de pose que le lot** (`apply`, avec le clic du mode rapide figé dans le lot), relue à 1 mm, puis validés par **Ctrl+Entrée**, la touche de validation sur place qu'Orbite emploie déjà au dernier cut d'une partie. La validation est prouvée par l'écriture vue par l'observateur passif. Banc : 5 corrections, 5 écritures « valid » exactement sur ces 5 cuts, rien ailleurs. |
| **Seuils** | Provisoires et très prudents (`datasets/relecture-reglages-defaut.json`) : ADV coupée, confiance 80 à 90, rails cohérents à 6 mm, jamais plus de 60 mm en travers. Le fichier chiffré par `claude/50-zones-autonomes` (`datasets/relecture-reglages-proposes.json`) est lu s'il existe. Avec les valeurs provisoires, la passe du banc ne corrige rien. |
| **SKIP (D-172)** | Consigné seulement (`skipOmbre`). « Aucun point » se lit dans la capture. « Un seul scanner » ne se lit que si les points portent leur source (`pointSourceID`) : **aucune capture de terrain relevée ne la porte**, donc `scanners` reste vide et rien n'est deviné. Aucun SKIP n'est envoyé. |
| **Temps** (banc, cette machine) | **3,5 s par cut relu** en ombre (médiane 3,2 s entre deux cuts ; capture 2,5 s, calcul 0,38 s, navigation 0,09 s). Un cut corrigé : 4,2 s (médiane). Mic : 3,7 s par vert. Passe de 18 cuts : 63 s (ombre), 72 s (corriger, 5 corrections). Une passe au plafond (120 cuts) : environ 7 minutes. |
| **Trace dans ESV** | Les gestes d'un humain qui relit : boutons « cut suivant » dans une plage, saut par la carte entre deux plages, boutons de rail de la capture ; en correction, clics de pose et Ctrl+Entrée. Les écritures sont celles d'ESV lui-même (voir § 8). |

## 2. La passe, pas à pas

1. **Démarrage du lot.** Le service worker lit le choix gardé (`storage.local`, clé du panneau) et le fige dans le scope du lot (`scope.relecture`, consigné par `batch-started` et l'export). Coupée : le champ n'existe pas. Les arguments envoyés par le panneau ne comptent pas.
2. **Fin du lot.** À la fin naturelle du lot (boucle finie, ou arrêt au dernier cut), la passe est planifiée une fois (1,5 s). Elle ne part que si ESV est propre :
   - aucune intention, réconciliation ni navigation incertaine à clore, aucune action en cours, ni Écho, ni reprise, ni retour à un cut ;
   - ESV affiche la partie du lot ;
   - aucune pose d'Ariane non validée sur le cut affiché. C'est le cas d'un lot borné, qui pose le dernier cut sans le valider : Mic le valide lui-même, ESV passe à un autre cut, puis Mic clique sur « Lancer la relecture ».
   
   Sinon, la passe est « non lancée », avec la raison (panneau et événement `relecture-fin`).
3. **Sélection** (§ 3), puis, pour chaque cut, dans l'ordre :
   - **aller au cut** : `goToCut`, avec les boutons « cut suivant » d'ESV dans une plage. Entre deux plages, le chemin habituel du retour à un cut : l'événement de la carte, sinon pas à pas. Les cuts posés par le lot sont traversés, comme Mic le fait ;
   - **capture** : la même commande que le lot (`capture`, boutons de rail, lecture des points) ;
   - **calcul** : moteur (science GCV1), décision sur le lot avec, pour appuis, tous les cuts posés et validés par le lot (`lotPosed`), et la hauteur apprise que la décision consigne selon son réglage (aucune option passée à la décision, comme le lot). On obtient la pose calculée, l'écart par rail dans le repère profil (latéral et vertical), le pire écart, la confiance, le verdict (« je corrigerais » au-delà de 5 mm, sinon « je laisserais ») et sa raison. S'y ajoutent la commande que le lot écrirait et son écart, l'écartement écrit et sa référence, puis la règle prudente ;
   - **mode « corriger »**, quand la règle passe : relecture de l'état, rails inchangés depuis la capture, écartement dans le contrat. Puis `apply` (la commande du lot, avec son clic), relecture à 1 mm, relecture de l'état comme le moteur avant de valider, Ctrl+Entrée, et l'attente de l'écriture « valid » de la ligne du cut (6 s au plus) ;
   - **événement `relecture-ombre`** : identité, plage, zone, rôle, pose d'ESV, pose calculée, écart par rail, pire écart, confiance, étage, appuis, correction de hauteur apprise (`hauteurMm`), verdict, raison, `skipOmbre`, écart écrit, écartement, règle (oui ou non, et pourquoi), action (`visite`, `corrige`, `correction-refusee`, `correction-incertaine`, `navigation-refusee`), durées (navigation, capture, calcul, total) et chemin ;
   - **rythme** : chaque cut relu reste affiché au moins 2 à 4,5 s, tirées au hasard (Mic : médiane 2,4 s, moyenne 3,7 s).
4. **Fin** : événement `relecture-fin` (issue, comptes, durée) ; le panneau dit « Relecture finie : 18 cuts relus, 5 corrigés ».

**Pendant la passe**, le panneau refuse tout ce qui agirait dans ESV ou sur le lot : nouveau lot, reprise, retour à un cut, Écho, réglages, vidage. Il affiche « Relecture 12 sur 85, 3 corrigés · cut 456 · grappe 453–471 », avec un bouton « Arrêter la relecture ».

## 3. Sélection : la méthode de Mic (`src/relecture-ombre.js`, `selection`)

Les plages sont prises de `fiches/METHODE_MIC_P29.md` et des règles métier :

| Motif | Plage relue | Zone de la règle |
|---|---|---|
| PN reconnu (règles métier en ombre) | sa plage à contrôler, 4 cuts avant et 6 après, chaque cut | `pn` |
| ADV reconnue (rail de plus, `fiches/DETECTION_ADV.md`) | sa plage, 30 cuts de chaque côté | `adv` |
| grappe (3 cuts du lot ou plus, trous de 5 au plus) | toute la plage, sans trou, 3 cuts de marge | `abords` |
| différé (ou dernier cut laissé sans commande) | 2 cuts de chaque côté, et le différé lui-même | `abords` |
| cut isolé, ou paire | le cut d'avant et le cut d'après | `abords` |
| liste « À contrôler » (`src/verts-a-controler.js`) | ses verts | `vert-hors-zone` |

- Les plages proches sont fondues (trou de 3 cuts au plus).
- Les bornes de la partie vont de 0 à M − 1 (compteur d'ESV).
- **Cuts 0 à 3 inclus** (D-172) : aucun cut n'est exclu.
- Ordre : par plages, dans l'ordre des cuts.
- **Plafond** réglable (`BananeSettings.relecture.plafondCuts`, 120 par défaut dans le module). Les plages sont gardées **entières**, par priorité (PN, ADV, grappe, différé, isolé, à contrôler). Une plage qui ne tient pas est rendue dans `horsPlafond` et consignée dans `relecture-debut`.
- Rôle de chaque cut : `vert`, `differe` (encore invalide) ou `lot` (posé par le lot, traversé et non relu).

## 4. Règle prudente de correction (`src/relecture-critere.js`)

C'est une fonction pure. Elle ne dit « oui » que si **toutes** les conditions tiennent, et dit sinon la première qui manque.

1. Le cut a une pose calculée.
2. Il n'est pas à SKIP en ombre.
3. Son rôle est permis : `roles`, les **verts** seulement par défaut. Jamais un cut du lot.
4. L'étage est permis : `first-pass`, la pose du moteur confirmée par la voie des appuis, ou `window`, la reprise depuis la voie. La décision s'appuie sur `appuisMin` (2) cuts posés par le lot au moins.
5. La zone permet la correction.
6. Le pire écart (latéral ou vertical) atteint le seuil de la zone.
7. La confiance du moteur, sur **les deux rails**, atteint le minimum de la zone. Un rail repêché par S1 (sans confiance calibrée) est refusé.
8. **Jamais de changement de voie** : chaque rail reste à 60 mm au plus en travers. Une autre voie est à 1,5 m, et les poses sur la mauvaise voie mesurées allaient de 163 à 280 mm (D-159).
9. **Les deux rails sont cohérents** : écarts latéraux à 6 mm l'un de l'autre, écarts verticaux à 6 mm, et écartement écrit à 8 mm de la référence, celle des appuis voisins du lot (sans référence, refus).

Les conditions 6, 8 et 9 sont jugées sur la pose **qui serait écrite** : la commande du lot, avec ses contrôles de position, d'écartement et de vue.

**Seuils provisoires** (`datasets/relecture-reglages-defaut.json`, recopiés dans le module, un essai vérifie qu'ils sont égaux) :

| Zone | Corriger | Seuil | Confiance minimale |
|---|---|--:|--:|
| PN | oui | 15 mm | 85 |
| ADV | **non** | 25 mm | 95 |
| abords | oui | 12 mm | 80 |
| vert hors zone | oui | 15 mm | 90 |

Aucune partie n'a servi à les régler : ce sont des bornes de prudence, pas des mesures. Le fichier `datasets/relecture-reglages-proposes.json` est lu au début de chaque passe (`fetch` du fichier de l'extension). Il est validé valeur par valeur : une valeur absente ou invalide prend le défaut. La source (`propose` ou `defaut`) et le statut du fichier sont consignés dans `relecture-debut` et affichés dans l'état de la passe.

**Une correction refusée par la page** (pose qui lève, ou pose relue à plus de 1 mm de la commande) est remise : `restore`, la commande « Restaurer » du lot, relue à 1 mm. Le cut est ensuite quitté (« correction-refusee ») et la passe continue. Si la remise échoue, la passe s'arrête et dit le cut à contrôler.

**Une validation non prouvée** arrête la passe et dit le cut à contrôler : erreur de la page après l'envoi, cut changé, aucune écriture vue en 6 s, ou écriture refusée par le serveur. Une intention de correction est gardée dans `storage.local` de la pose jusqu'à la preuve. Après un redémarrage du service worker, le panneau la signale.

## 5. SKIP, règle de Mic (D-172)

- `skipOmbre:{raison, scanners, scannersLisibles, points}` dans chaque événement, **jamais envoyé** (aucune commande SKIP n'existe dans la passe).
- `aucun-point` : la capture n'a aucun point près des deux rails (`quality.perRail` à 0 et 0). Une capture qui échoue faute de points (ESV ne charge rien) est notée en erreur de capture, sans raison de SKIP : on ne sait pas.
- `un-seul-scanner` : seulement si les points visibles portent un identifiant de source (`attributes.pointSourceID`), que le lecteur garde quand Potree le fournit, et qu'il n'y en a qu'un. **Toutes les captures de terrain du dépôt n'ont que `intensity` et `classification`** : `scanners:null`, `scannersLisibles:false`. Le compte porte sur la capture entière : les deux vues sont fondues, et la capture ne dit plus de quelle coupe vient un point. Or Mic parle d'« un seul scanner sur l'une des deux coupes » : ce n'est donc pas encore sa règle exacte.
- Pour aller plus loin : relever sur le vrai ESV si le nuage porte `pointSourceID`. Le relevé de contrat en lecture seule peut l'ajouter. Il faudra aussi garder la vue d'origine de chaque point.

## 6. Sécurité : les essais

Essais rouges d'abord : les douze fichiers `tests/relecture-sw-*.test.cjs`, joués sur le code de la base, échouent tous (0 sur 9 avant le découpage). Ils passent tous sur la branche. Un fichier par essai : `tools/verify.cjs` donne 20 s à chaque fichier, et un lot réel en prend 3 à 6.

| Exigence | Essai |
|---|---|
| Coupée : commandes identiques à la base, octet pour octet | `relecture-sw-coupee-rien`, `-coupee-gardee` (empreinte `tests/fixtures/relecture-lot-50-base.json`, prise en jouant le même lot sur `background.js` et `src/adapter-page.js` de 2d60d04), `-coupee-trafique` (empreinte du test 6 inchangée, arguments de « Démarrer » ignorés) |
| Ombre : jamais de pose, de validation ni d'écriture | `relecture-sw-ombre` : après le lot, seulement `ping`, `state`, `goToCut`, `capture`, même quand la règle dirait « corriger » ; SKIP en ombre consigné, aucun SKIP envoyé |
| Corriger : seulement les cuts qui passent la règle, chemin de la pose Orbite, aucune marque | `relecture-sw-corriger` : 2 corrigés sur 7, `state` puis `apply` (même forme que les poses du lot), puis `state` et `validateInPlace` ; rails incohérents et voie refusés ; aucune trace du mot « relecture » dans ce qui part vers la page. `-corriger-clic-refus` : le clic figé dans le lot sert aussi à la passe ; une pose refusée est remise, sans validation |
| Arrêt ou panne : ESV propre | `relecture-sw-arret` (l'étape en cours finit, puis plus rien ; chaque `apply` a sa validation prouvée ; pendant la passe, ni lot, ni retour à un cut), `-panne` (ESV sans réponse : arrêt net), `-corriger-validation` (aucune écriture vue : arrêt, cut dit, intention gardée) |
| Le lot avant la passe est inchangé | `-ombre` et `-corriger` : le lot, sans le champ `relecture` du scope, a l'empreinte de la base |
| La passe ne part que si ESV est propre | `-hors-partie` (autre partie : non lancée ; « Lancer la relecture » au retour), `-pose-en-attente` (pose d'Ariane non validée sur le cut affiché) |
| Observateur coupé | `-sans-observateur` : « corriger » ramené à « ombre » ; rythme d'au moins `visiteMs` entre deux cuts |
| Modules purs | `relecture-ombre.test.cjs` (sélection, jugement, SKIP), `relecture-critere.test.cjs` (chaque condition, voie, cohérence, réglages), `relecture-panneau.test.cjs` (place de la carte, « Dernier lot » / « Prochain lot », avancement, CONTENU.txt) |

Ce que les essais remplacent : hors du lot, la science et la décision des verts sont remplacées pour l'essai. Le moteur de la fixture ne retrouve plus son rail quand la pose d'ESV a bougé (sa boîte de découpe est celle de la fixture). Le cut 113, lui, est calculé pour de vrai (étage `window`, appuis 111 et 112). Le banc (§ 7) joue tout pour de vrai.

**Modification de `src/adapter-page.js`** : `validateInPlace` accepte `preuve:'ecriture'`. Un vert est déjà compté « treated » par ESV, donc sa validation ne fait pas bouger le compteur « N on M treated » ; c'est l'écriture observée qui fait la preuve. Le geste est le même : Ctrl+Entrée, ou le bouton réglé. Sans l'option, le chemin du dernier cut (KI-069) est inchangé.

## 7. Banc : extension réelle, maquette ESV

`tools/relecture-banc.cjs` charge l'extension du dépôt dans Chromium et route l'hôte d'ESV vers la maquette de `claude/esv-locale-audit` (`fiches/AUDIT_ESV_LOCALE.md`), qu'on extrait hors du dépôt. Le banc garde le choix, lance un lot et attend la passe. Il joue Mic si le dernier cut attend sa validation. Tout passe par le vrai chemin : service worker, pont, observateur passif, adaptateur, page, serveur.

Partie de 20 cuts (0 à 19), lot de 8 à 11 : 8 et 10 posés et validés, 11 laissé non résolu (9 est vert dans la maquette, le lot ne le visite pas) ; latence de la maquette 40 ms par lot de nœuds, machine partagée (charge 4 à 6 sur 4 cœurs). Les règles métier en ombre voient une ADV sur toute la maquette (ses cuts reprennent les captures du corpus). La sélection est donc « ADV 0–19 » : 18 cuts relus, **cuts 0 à 3 compris**.

| | Ombre (seuils provisoires) | Corriger (seuils permissifs de banc) |
|---|---|---|
| Passe | 18 relus, 0 corrigé, **62,9 s** | 18 relus, **5 corrigés**, 72,3 s |
| Entre deux cuts, médiane (P90, max) | 3,2 s (4,1 ; 5,1) | 3,8 s (5,1 ; 6,7) |
| Moyenne par cut | **3,5 s** | 4,0 s |
| Capture, médiane | 2,47 s | 2,59 s |
| Calcul (moteur, décision, règle), médiane (P90) | 0,38 s (0,44) | 0,37 s (0,45) |
| Navigation, médiane | 0,09 s | 0,09 s |
| Cut corrigé, temps propre médian | — | 4,2 s (de 3,9 à 6,2 ; un cut visité : 3,0 s) |
| Écritures reçues par le serveur pendant la passe | **0** | **5**, « valid », exactement les lignes des 5 cuts corrigés |
| Page : poses de rail, touches pendant la passe | **0**, **0** | 10 poses (5 × 2 rails), 5 Ctrl+Entrée |
| Navigation vue par la page | 1 saut par la carte, puis boutons « cut suivant » | idem |

Avec les seuils **provisoires**, la règle refuse tous les cuts de la maquette. La correction exige 2 appuis du lot, et l'ADV y est coupée. Le banc « corriger » a donc pris un fichier de seuils permissif (ADV ouverte, confiance 0, cohérence à 100 mm, 1 appui), servi le temps du banc à la place du fichier proposé, puis retiré.

Même ainsi, la règle a refusé un rail S1 (cut 7) et les cuts sans appui. Au premier essai, la maquette commençait au cut 100 : la marge de l'ADV demandait le cut 74, et la carte de la maquette a levé. **La passe s'est arrêtée net** (« passage au cut 74 non confirmé, rien n'a été posé »). Sur le vrai ESV, les parties commencent au cut 0.

**Temps pour le terrain.** Le calcul y est 2,5 fois plus rapide (`fiches/CYCLE_OMBRE.md`), donc environ 0,15 s. La capture est celle du lot (mode rapide), et le temps d'affichage minimal (2 à 4,5 s, moyenne 3,25 s) domine. On attend **3,3 à 3,7 s par cut relu**, comme Mic (3,7 s), et environ 1 à 2 s de plus par cut corrigé.

**Passe type.** En partie 29, la liste « À contrôler » seule gardait 121 verts. Avec les PN, l'ADV et les abords du lot, on compte 100 à 150 cuts : 6 à 9 minutes. Au plafond de 120 cuts, environ 7 minutes.

## 8. Trace dans ESV

- **Commandes** : la passe n'emploie que des commandes qu'Ariane emploie déjà pour un humain, et n'en invente aucune :
  - `goToCut` du retour à un cut : boutons « cut précédent / suivant » et événement de la carte, relevés au banc ESV local ;
  - `capture` du lot : boutons de rail ;
  - en correction, `apply` du lot (clics de pose, même mode de clic que le lot), `restore` du lot si besoin, et Ctrl+Entrée relayé comme au dernier cut (KI-069).
  
  Aucun champ, aucun en-tête, aucune requête propre à Ariane : le mot « relecture » n'apparaît dans rien de ce qui part vers la page (essai).
- **Écritures** : elles sont faites par ESV lui-même.
  - En **ombre**, aucune écriture n'est provoquée par Ariane. ESV écrit seulement « SeenByOperator » la première fois qu'un cut est affiché (`fiches/TRACE_ESV.md`). Un vert visité devient donc violet sur la carte, comme quand Mic le visite. La maquette n'imite pas cette écriture : le banc ne la montre pas.
  - En **corriger**, chaque cut corrigé reçoit l'écriture de validation d'ESV (12 champs, mêmes clés), comme une validation de Mic. C'est une « seconde validation » quand le cut était déjà vert et traité : Mic en fait aussi en Écho, sur 1,5 % des cuts validés en partie 29.
- **Rythme** : au moins 2 à 4,5 s par cut relu, tirées au hasard. La passe ne fait pas de longue pause. En Écho, Mic tient 3,6 à 4,0 minutes sans pause de 10 s (`fiches/TRACE_ESV.md`) ; le lot Orbite, 4,1 à 5,9 minutes. Une passe de 7 minutes d'affilée dépasse ces deux durées : c'est la seule différence de cadence connue, à régler avec Mic (plafond plus bas, ou pause entre deux plages).
- **Parcours** : par plages, cut par cut (90 % de pas d'un cut chez Mic en Écho). Le lot, lui, avance par sauts.
- **À vérifier sur le vrai ESV** :
  - que Ctrl+Entrée valide bien un vert sur place (hypothèse D-065, jamais observée sur le terrain) ;
  - que le saut par la carte et les boutons « cut suivant » sont ceux du vrai ESV (hypothèses du banc ESV local, D-098).
  
  Sans preuve d'écriture, la passe s'arrête et le dit : elle ne peut pas croire à tort qu'un cut est validé.

## 9. Panneau

La carte occupe l'emplacement réservé par la réorganisation du panneau (test 7, `fiches/UX_PANNEAU_T7.md`) : le groupe **(d) « Relecture »** (`#groupe-relecture`), entre les résultats du dernier lot (c) et l'export replié (e). C'est un bloc `<section id="carte-relecture" class="carte">` dans le style des autres cartes. Son script est séparé (`src/carte-relecture.js`), chargé avant `panel.js`. Dans `panel.js`, une seule ligne change : celle de `CONTENU.txt`.

- Elle propose trois choix : « Coupée », « Ombre (visite, ne modifie rien) », « Corriger (corrige seulement les cuts sûrs) ».
- Comme les autres choix du lot, elle a deux lignes :
  - **« Dernier lot »** (« Lot en cours » pendant un lot) : le mode figé dans le scope du lot ;
  - **« Prochain lot »** : le choix gardé, qui servira au prochain « Démarrer ».
  
  Sans lot, la première ligne dit « aucun lot ».
- Pendant la passe, elle affiche « Relecture 12 sur 85, 3 corrigés · cut 456 · grappe 453–471 » et le bouton « Arrêter la relecture » ; les choix sont figés. Après, elle affiche le bilan, et « Lancer la relecture » quand la passe n'est pas partie seule.
- Elle signale une correction interrompue.
- **CONTENU.txt** reçoit une ligne quand la relecture du lot n'est pas coupée : « Relecture après le lot … : corriger (…) ; passe : finie, 85 sur 85 relus, 3 corrigés ». Coupée, aucune ligne.

## 10. Réglages

| Où | Quoi | Défaut |
|---|---|---|
| Panneau (`storage.local`, `banane50Relecture`) | coupée / ombre / corriger | coupée |
| `BananeSettings.relecture` (facultatif, absent de `src/settings.js`) | `departMs` (délai après le lot), `visiteMs` (temps d'affichage minimal, tiré entre deux bornes), `attenteEcritureMs` (preuve), `pasMax`, `plafondCuts` | 1 500 ms, [2 000, 4 500] ms, 6 000 ms, 40, 120 (module) |
| `datasets/relecture-reglages-proposes.json` | seuils chiffrés (chantier `claude/50-zones-autonomes`) | absent : défaut provisoire |

## 11. Doutes et limites

- **Seuils non mesurés.** La règle prudente n'a jamais été jugée sur des Échos : c'est le travail de `claude/50-zones-autonomes`. Avec les valeurs provisoires, elle ne corrigera presque rien. Avec un fichier proposé, elle corrige ce qu'il permet. Avant toute activation au terrain, il faut des chiffres en validation croisée et sur des parties réservées (D-173), avec 0 mauvaise voie.
- **La cohérence des rails exclut les corrections de hauteur d'un seul rail**, qui forment le gros des faux verts (D-160 : 70 sur 85 viennent de la hauteur). C'est voulu pour la prudence, mais la passe ne corrigera donc pas le plus fréquent tant que les seuils n'auront pas été chiffrés.
- **Ctrl+Entrée sur un vert** : il valide sur place selon Mic (geste de l'Écho) et la maquette, mais ce n'est pas observé sur le vrai ESV. La preuve par l'écriture protège : sans écriture vue, la passe s'arrête.
- **Les verts du lot passés** ne servent pas d'appuis. Les corrections de la passe non plus : seuls les cuts posés par le lot comptent. C'est prudent, mais un PN loin du lot sera presque toujours sans appui, donc refusé.
- **Pas de SKIP « un seul scanner »** tant que la capture ne porte pas la source des points (§ 5).
- **Banc** : la maquette n'a ni Potree réel ni vrai serveur, et pas d'écriture « seen ». Ses cuts reprennent quelques captures du corpus : l'ADV couvre toute la partie, et les écarts de 40 mm viennent de la fixture, pas d'un vrai vert. Les temps de capture sont ceux de la maquette, les temps de calcul ceux de cette machine chargée.
- **Essais** : hors du lot, la science et la décision des verts sont remplacées (§ 6). Le chemin de la passe est réel, mais son calcul complet n'est joué au banc que sur la maquette.
- **Mémoire volatile** : un redémarrage du service worker arrête la passe sans la relancer. Une correction coupée entre la pose et la preuve est signalée au panneau, pas réparée.
- **Pas de longue pause** dans une passe (§ 8).
- **Lot borné** : la passe attend que Mic valide le dernier cut posé. Si Mic quitte ce cut sans le valider, la pose d'Ariane est perdue (elle ne l'était pas avant, puisque rien ne quittait ce cut).

## 12. Rejouer

```
node --test tests/relecture-ombre.test.cjs tests/relecture-critere.test.cjs tests/relecture-panneau.test.cjs tests/relecture-sw-*.test.cjs
git archive origin/claude/esv-locale-audit tests/esv-maquette | tar -x -C <DOSSIER>
PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node tools/relecture-banc.cjs --maquette <DOSSIER>/tests/esv-maquette --mode ombre --debut 0 --cuts 20 --lot 8:11
PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node tools/relecture-banc.cjs --maquette <DOSSIER>/tests/esv-maquette --mode corriger --debut 0 --cuts 20 --lot 8:11 --reglages SEUILS.json
```

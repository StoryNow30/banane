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
| **Seuils** | Ceux du fichier chiffré par l'étude `claude/50-zones-autonomes` (`datasets/relecture-reglages-proposes.json`, `fiches/RELECTURE_AUTONOME.md`), appliqués tels quels : **seule la zone PN corrige** (écart de 8 mm et plus) ; ADV, abords et verts hors zone restent en ombre, même en « corriger » ; verts seulement, jamais un cut posé ou différé par le lot ; 45 mm au plus en travers ; écartement à 15 mm de la médiane de la partie ; les quatre étapes qui posent ; variante « chaine+h » (décision en chaîne, plus la hauteur apprise). Sans ce fichier : des valeurs provisoires très prudentes (`datasets/relecture-reglages-defaut.json`). |
| **SKIP (D-172)** | Consigné seulement (`skipOmbre`). « Aucun point » quand **deux captures complètes de suite** sont vides. Jamais « un seul scanner » : l'étude montre que tous les scanners arrivent dans un seul nuage d'ESV, ce n'est pas mesurable. Aucun SKIP n'est envoyé. |
| **Temps** (banc, cette machine) | **3,5 s par cut relu** (capture 2,5 s, calcul 0,37 à 0,41 s, navigation 0,09 s). Un cut corrigé : 4,2 s (médiane). Mic : 3,6 à 3,7 s par vert. Passe de 18 cuts : 63 s (ombre ; corriger avec le fichier réel : 63,5 s, 0 corrigé, la maquette n'a pas de PN) ; 72 s avec des seuils permissifs de banc (5 corrections). Une passe au plafond (120 cuts) : environ 7 minutes. |
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
   - **calcul**, variante du fichier (« chaine+h » par défaut, celle de l'étude) : moteur (science GCV1), puis décision sur le lot avec pour appuis la **chaîne** de la passe, puis la **hauteur apprise** que la décision consigne selon son réglage (aucune option passée à la décision, comme le lot). La chaîne part des cuts posés et validés par le lot (`lotPosed`) ; chaque cut relu y ajoute la pose de sa décision (étapes `first-pass`, `window`, `crossing`, pas un appui refusé), écrite ou non, comme dans l'étude. La pose calculée est celle de la décision, plus la correction de hauteur de chaque rail sur l'axe vertical de la pose d'ESV. On obtient la pose calculée, l'écart par rail dans le repère profil (latéral et vertical), le pire écart, la confiance, le verdict (« je corrigerais » au-delà de 5 mm, sinon « je laisserais ») et sa raison. S'y ajoutent la commande que le lot écrirait (avec la hauteur pour « +h ») et son écart, l'écartement de la pose et la médiane de la partie, puis la règle prudente ;
   - **SKIP en ombre** : une capture vide est relue une fois ; deux captures vides de suite font `aucun-point` ;
   - **mode « corriger »**, quand la règle passe : relecture de l'état, rails inchangés depuis la capture, écartement dans le contrat. Puis `apply` (la commande du lot, avec son clic), relecture à 1 mm, relecture de l'état comme le moteur avant de valider, Ctrl+Entrée, et l'attente de l'écriture « valid » de la ligne du cut (6 s au plus) ;
   - **événement `relecture-ombre`** : identité, plage, zone, rôle, pose d'ESV, pose calculée, écart par rail, pire écart, confiance, étage, appuis, rail repêché par S1, correction de hauteur apprise (`hauteurMm`), verdict, raison, `skipOmbre`, écart écrit, écartement et médiane, variante, règle (oui ou non, et pourquoi), action (`visite`, `corrige`, `correction-refusee`, `correction-incertaine`, `navigation-refusee`), durées (navigation, capture, calcul, total) et chemin ;
   - **rythme** : chaque cut relu reste affiché au moins 2 à 4,5 s, tirées au hasard (Mic : médiane 2,4 s, moyenne 3,7 s).
4. **Fin** : événement `relecture-fin` (issue, comptes, durée) ; le panneau dit « Relecture finie : 18 cuts relus, 5 corrigés ».

**Pendant la passe**, le panneau refuse tout ce qui agirait dans ESV ou sur le lot : nouveau lot, reprise, retour à un cut, Écho, réglages, vidage. Il affiche « Relecture 12 sur 85, 3 corrigés · cut 456 · grappe 453–471 », avec un bouton « Arrêter la relecture ».

## 3. Sélection : la méthode de Mic (`src/relecture-ombre.js`, `selection`)

La sélection est **alignée sur celle de l'étude** (`tools/relecture-autonome.cjs`, fonction `selection` ; bloc `selection` du fichier proposé, dont la passe lit les marges) : même ensemble de cuts, même type de zone pour chaque cut.

| Motif | Cuts relus | Zone de la règle |
|---|---|---|
| PN reconnu (règles métier en ombre) | sa plage à contrôler : 4 cuts avant, 6 après, chaque cut | `pn` |
| ADV reconnue (rail de plus, `fiches/DETECTION_ADV.md`) | sa plage : 30 cuts de chaque côté | `adv` |
| grappe (3 cuts du lot ou plus, trous de 5 au plus) | toute la plage, 3 cuts de marge | `abords` |
| cut du lot hors grappe (isolé, paire) | chaque cut, avec 1 cut de part et d'autre | `abords` |
| différé (ou dernier cut laissé sans commande) | 2 cuts de chaque côté, et le différé lui-même | `abords` |
| liste « À contrôler » (`src/verts-a-controler.js`) | ses verts | `vert-hors-zone` |
| en plus de l'étude (H5 de l'audit P-5) : vert de la liste d'ESV à plus de 15 mm de la médiane d'écartement de la partie, hors de toute plage | le vert | `ecartement`, **ombre seulement** |

- **Zones figées, tirées du lot.** Les zones PN et ADV viennent des seules captures du lot : les événements `regles-metier-ombre` de ce lot, lus **avant** la passe et figés pour toute la passe. La passe n'évalue aucune règle métier sur ses propres captures : une capture de vert ne crée ni n'étend jamais une zone. C'est le point de sécurité de l'audit P-5 : une fausse zone PN apparaît dès que des verts sont capturés (443–456 en partie 1 du second projet), en attendant le détecteur plus robuste de `claude/50-pn-robuste`. Chaque visite dit l'origine de sa zone (`zoneSource` : `lot` pour PN, ADV et abords, `liste` pour « À contrôler », `liste-esv` pour l'écartement) ; `relecture-debut` consigne les zones figées.
- **Verts hors plage par l'écartement (H5)** : exemple de l'audit, 7047–7054 en partie 9, absents de « À contrôler ». La médiane est prise sur les lignes valides de la liste d'ESV (20 au moins) ; la zone `ecartement` passe en dernier au plafond, et la règle ne la corrige jamais, quels que soient les réglages.
- **Type de zone de chaque cut**, comme l'étude : le premier qui le couvre, dans l'ordre PN, ADV, abords, liste (puis écartement). Un vert d'abords qui touche un PN reste « abords » : seul un cut de PN peut être corrigé.
- Les cuts couverts sont groupés en plages de cuts **consécutifs**. Aucun cut n'est ajouté pour boucher un trou (une première version fondait les plages à 3 cuts près : retiré pour coller à l'étude).
- Les bornes de la partie vont de 0 à M − 1 (compteur d'ESV). **Cuts 0 à 3 inclus** (D-172).
- Ordre : par plages, dans l'ordre des cuts. Rôle de chaque cut : `vert`, `differe` (encore invalide) ou `lot` (posé par le lot, traversé et non relu).
- **Différence avec l'étude : le plafond.** L'étude relit toute la sélection (117 à 781 verts par partie, 3,5 à 31 minutes). La passe a un plafond réglable (`BananeSettings.relecture.plafondCuts`, 120 par défaut, environ 7 minutes) : les plages sont gardées **entières**, par priorité (PN d'abord, puis ADV, grappe, différé, isolé, liste). Les PN, seule zone qui corrige, passent donc toujours en premier. Ce qui ne tient pas est rendu dans `horsPlafond` et consigné dans `relecture-debut`, avec le compte par zone (`parZone`).

## 4. Règle prudente de correction (`src/relecture-critere.js`)

C'est une fonction pure. Elle ne dit « oui » que si **toutes** les conditions tiennent, et dit sinon la première qui manque. Ce sont les conditions de l'étude (`agit` dans `tools/relecture-autonome.cjs`), mesurées de la même façon.

1. Le cut a une pose calculée.
2. Il n'est pas à SKIP en ombre.
3. Son rôle est permis (`roles` : les **verts**) et n'est pas dans `jamais` (cut différé par le lot, cut posé par le lot).
4. L'étage est permis (`etagesPermis`) : le fichier donne les quatre étapes qui posent, `first-pass`, `window`, `choice` et `crossing`, toutes acceptées. La décision s'appuie sur `appuisMin` appuis au moins : le fichier n'en fixe pas, donc aucun minimum (la chaîne tient lieu de voie, comme dans l'étude).
5. La zone permet la correction (`corriger`).
6. Le pire écart (latéral ou vertical, des deux rails) atteint le seuil de la zone.
7. La confiance du moteur (A*) est présente sur **les deux rails** et atteint le minimum de la zone (0 : « présente »). Un rail repêché par S1 garde sa confiance A*, comme dans l'étude ; il est signalé dans l'événement (`s1`).
8. **Jamais de changement de voie** : chaque rail reste à `voie.lateralMaxMm` au plus en travers.
9. **Les deux rails sont cohérents** : différence des écarts latéraux, et des écarts verticaux, à `diffLateraleMaxMm` et `diffVerticaleMaxMm` au plus ; **écartement de la pose à `ecartementMaxMm` au plus de la médiane de la partie** (sans médiane : refus).

Les conditions 6, 8 et 9 sont jugées sur la pose **qui serait écrite** : la commande du lot, avec ses contrôles de position, d'écartement et de vue, plus la hauteur apprise.

**Médiane de la partie** (condition 9). L'étude prend la médiane des écartements des verts de la partie, tels qu'ESV les montre. La passe prend la référence de la liste « À contrôler » : la médiane de l'écartement des lignes valides de la liste d'ESV (20 au moins), tirée de leurs bords. Sans liste lisible, elle prend la médiane des poses d'ESV des verts déjà relus, une fois qu'il y en a 5. Avant, la règle refuse.

**Seuils du fichier proposé** (`datasets/relecture-reglages-proposes.json`, lu au début de chaque passe par un `fetch` du fichier de l'extension, validé valeur par valeur ; une valeur absente ou invalide prend le défaut) :

| Zone | Corriger | Seuil | Confiance | Étude, validation croisée (6 parties) |
|---|---|--:|--:|---|
| PN | **oui** | 8 mm | présente | 36 corrections justes sur 36 actions, 0 erreur, 0 abîmé |
| ADV | non (ombre) | 8 mm | présente | 11 justes sur 17, 18 % d'erreurs |
| abords | non (ombre) | 8 mm | présente | 30 justes sur 37, 14 % d'erreurs |
| vert hors zone | non (ombre) | 8 mm | présente | 2 actions |

Avec : verts seulement, jamais un cut posé ou différé par le lot ; 45 mm au plus en travers ; cohérence des rails sans limite (100 mm) ; écartement à 15 mm de la médiane ; les quatre étapes ; variante « chaine+h ».

Sans le fichier proposé, la passe prend les valeurs **provisoires** de `datasets/relecture-reglages-defaut.json`, recopiées dans le module (un essai vérifie qu'ils sont égaux) : PN 15 mm et confiance 85, abords 12 mm et 80, hors zone 15 mm et 90, ADV coupée ; 60 mm en travers ; rails cohérents à 6 mm ; écartement à 8 mm ; étapes `first-pass` et `window` ; 2 appuis. La source (`propose` ou `defaut`) et le statut du fichier sont consignés dans `relecture-debut` et affichés dans l'état de la passe.

**Une correction refusée par la page** (pose qui lève, ou pose relue à plus de 1 mm de la commande) est remise : `restore`, la commande « Restaurer » du lot, relue à 1 mm. Le cut est ensuite quitté (« correction-refusee ») et la passe continue. Si la remise échoue, la passe s'arrête et dit le cut à contrôler.

**Une validation non prouvée** arrête la passe et dit le cut à contrôler : erreur de la page après l'envoi, cut changé, aucune écriture vue en 6 s, ou écriture refusée par le serveur. Une intention de correction est gardée dans `storage.local` de la pose jusqu'à la preuve. Après un redémarrage du service worker, le panneau la signale.

## 5. SKIP, règle de Mic (D-172)

- `skipOmbre:{raison, points, captures, capturesVides}` dans chaque événement, **jamais envoyé** (aucune commande SKIP n'existe dans la passe).
- `aucun-point` : seulement quand la capture est **vraiment vide après chargement complet**. Une capture complète sans aucun point près des deux rails est relue une fois ; si la seconde est vide aussi, `raison:'aucun-point'`. L'étude a retrouvé ainsi 1 SKIP de Mic sur 4 aux cuts 0 à 3, avec 3 fausses alertes sur des visites brèves d'une ou deux captures vides ou incomplètes : une seule capture vide ne suffit donc pas.
- Une capture qui échoue (ESV ne charge rien dans le délai) est notée en erreur de capture, sans raison de SKIP : on ne sait pas.
- **Jamais `un-seul-scanner`** : tous les scanners arrivent dans un seul nuage d'ESV. Les captures de terrain n'ont que `intensity` et `classification`, rien ne dit de quel scanner vient un point.

## 6. Sécurité : les essais

Essais rouges d'abord : les fichiers `tests/relecture-sw-*.test.cjs`, joués sur le code de la base, échouent tous (0 sur 9 avant le découpage). Ils passent tous sur la branche. Un fichier par essai : `tools/verify.cjs` donne 20 s à chaque fichier, et un lot réel en prend 3 à 6.

| Exigence | Essai |
|---|---|
| Coupée : commandes identiques à la base, octet pour octet | `relecture-sw-coupee-rien`, `-coupee-gardee` (empreinte `tests/fixtures/relecture-lot-50-base.json`, prise en jouant le même lot sur `background.js` et `src/adapter-page.js` de 2d60d04), `-coupee-trafique` (empreinte du test 6 inchangée, arguments de « Démarrer » ignorés) |
| Ombre : jamais de pose, de validation ni d'écriture | `relecture-sw-ombre` : après le lot, seulement `ping`, `state`, `goToCut`, `capture`, même quand la règle dirait « corriger » ; SKIP en ombre consigné, aucun SKIP envoyé |
| Corriger : seulement les cuts qui passent la règle, chemin de la pose Orbite, aucune marque | `relecture-sw-corriger` : 2 corrigés sur 7, `state` puis `apply` (même forme que les poses du lot), puis `state` et `validateInPlace` ; rails incohérents et voie refusés ; aucune trace du mot « relecture » dans ce qui part vers la page. `-corriger-clic-refus` : le clic figé dans le lot sert aussi à la passe ; une pose refusée est remise, sans validation |
| Arrêt ou panne : ESV propre | `relecture-sw-arret` (l'étape en cours finit, puis plus rien ; chaque `apply` a sa validation prouvée ; pendant la passe, ni lot, ni retour à un cut), `-panne` (ESV sans réponse : arrêt net), `-corriger-validation` (aucune écriture vue : arrêt, cut dit, intention gardée) |
| Le lot avant la passe est inchangé | `-ombre` et `-corriger` : le lot, sans le champ `relecture` du scope, a l'empreinte de la base |
| La passe ne part que si ESV est propre | `-hors-partie` (autre partie : non lancée ; « Lancer la relecture » au retour), `-pose-en-attente` (pose d'Ariane non validée sur le cut affiché) |
| Observateur coupé | `-sans-observateur` : « corriger » ramené à « ombre » ; rythme d'au moins `visiteMs` entre deux cuts |
| Zones figées (audit P-5) | `-zones-figees` : une « zone PN » apparue pendant la passe (comme celle qu'ouvrirait une capture de vert) n'est pas lue ; la passe ne lit aucune surface de règle métier sur ses captures ; le cut reste aux abords, en ombre, `zoneSource:'lot'` |
| Fichier proposé réel | `-fichier-reel` : le vrai fichier servi à la passe ; un vert de PN corrigé, un vert de PN sous 8 mm laissé, un vert d'abords laissé en ombre (zone coupée), le différé du lot jamais touché. `relecture-critere.test.cjs` lit aussi le vrai fichier : quatre étapes, zones, 45 mm, 15 mm, chaine+h |
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

**Avec le fichier proposé réel** (mode « corriger », même lot, même maquette) : **18 cuts sélectionnés, 0 corrigé, 18 laissés**, passe de **63,5 s** (3,5 s par cut en moyenne, médiane 3,8 s entre deux cuts ; calcul médian 0,37 s), 0 écriture, 0 pose, 0 touche. Toute la maquette est en zone ADV, que le fichier laisse en ombre ; elle n'a pas de PN (ses cuts reprennent des captures du corpus sans passage à niveau). Le chemin de correction d'un vert de PN avec ce fichier est prouvé par l'essai `relecture-sw-fichier-reel`, et la mécanique de correction de bout en bout par le banc « permissif » ci-dessus.

Le banc « permissif » a pris un fichier de seuils ouvert (ADV ouverte, confiance 0, cohérence à 100 mm, 1 appui), servi le temps du banc à la place du fichier proposé, puis remis. Même ainsi, la règle a refusé les cuts sans appui. Au premier essai, la maquette commençait au cut 100 : la marge de l'ADV demandait le cut 74, et la carte de la maquette a levé. **La passe s'est arrêtée net** (« passage au cut 74 non confirmé, rien n'a été posé »). Sur le vrai ESV, les parties commencent au cut 0.

**Temps pour le terrain.** Le calcul y est 2,5 fois plus rapide (`fiches/CYCLE_OMBRE.md`), donc environ 0,15 s. La capture est celle du lot (mode rapide), et le temps d'affichage minimal (2 à 4,5 s, moyenne 3,25 s) domine. On attend **3,3 à 3,7 s par cut relu**, comme Mic (3,7 s), et environ 1 à 2 s de plus par cut corrigé.

**Partie type, avec le fichier réel.** L'étude compte, pour la sélection « méthode de Mic », de 117 à 781 verts par partie (`fiches/RELECTURE_AUTONOME.md` § 7 ; partie 29 : 545 verts, dont 38 de PN, 182 d'ADV, 316 d'abords, 9 de la liste). À 3,5 s par cut :
- toute la sélection de la partie 29 durerait environ 32 minutes ; au plafond de 120 cuts, la passe dure **environ 7 minutes** et relit d'abord les 38 verts de PN (2 à 3 minutes), puis les plages d'ADV et d'abords entières qui tiennent ;
- seuls les verts de PN peuvent être corrigés : en validation croisée, l'étude en corrige 36 sur 167 verts de PN relus dans les six parties d'apprentissage (environ 6 par partie en moyenne, aucun dans les parties sans PN), 0 erreur ; tous les autres cuts relus sont laissés et notés.

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
| `datasets/relecture-reglages-proposes.json` | seuils chiffrés par l'étude (chantier `claude/50-zones-autonomes`, fusionné) : zones, étapes, rôles, `jamais`, voie, cohérence, variante, marges de sélection | présent ; absent : défaut provisoire `datasets/relecture-reglages-defaut.json` |

## 11. Doutes et limites

- **Ce qui diffère encore de l'étude**, dit précisément :
  - *la chaîne d'appuis* : celle de l'étude part vide et passe par tous les cuts que Mic a visités, cuts du lot compris, recalculés ; la passe traverse les cuts posés par le lot sans les recalculer, et leurs poses validées servent d'appuis à leur place, avant les poses de la passe. L'étude prévient qu'une pose avec les seuls appuis du lot n'a pas été mesurée ; ce mélange non plus ;
  - *la médiane de la partie* : l'étude prend les écartements des verts vus par Mic à l'Écho ; la passe prend la liste d'ESV (bords des lignes valides), sinon les verts déjà relus (5 au moins), et refuse avant ;
  - *l'écartement de la pose* : celui des positions de la décision, comme l'étude (sans la hauteur) ;
  - *le plafond* de 120 cuts (absent de l'étude) ; les PN passent en premier ;
  - *H5* : les verts hors plage par l'écartement sont en plus, en ombre seulement.
- **La porte des 9 % n'est pas démontrée** : l'étude n'a jugé que 3 actions de PN sur parties réservées (3 justes) ; il en faut au moins 39 sans erreur. Chaque correction est notée (pose avant, pose après, écart) pour que la prochaine Écho de Mic la juge.
- **Zones PN** : tirées des seules captures du lot, donc les PN que le lot n'a pas traversés (tout en verts) ne sont pas relus en PN ; c'est le prix de la sécurité de l'audit P-5, en attendant `claude/50-pn-robuste`.
- **Ctrl+Entrée sur un vert** : il valide sur place selon Mic (geste de l'Écho) et la maquette, mais ce n'est pas observé sur le vrai ESV. La preuve par l'écriture protège : sans écriture vue, la passe s'arrête.
- **SKIP** : « aucun point » ne retrouve qu'un SKIP de Mic sur 4 dans l'étude ; « un seul scanner » ne se mesure pas (§ 5).
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

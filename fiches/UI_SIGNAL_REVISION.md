# CH-002 — Signal, phase 1 : audit des libellés, clarté, mouvement, finition

Lecture du code au 28/10/2026. Rien n'est modifié dans `src/`, `panel.js`, `panel*.css`. Les phrases « ÉTABLI » sont lues dans les fichiers cités. Aucune séance n'a été cliquée : la visibilité des boutons est celle que `panel.js` (`render`, `button`, `hierarchie`) et `src/signal-rendu.js` (`modele`) écrivent. Les durées sont celles écrites dans `panel-signal.css`, pas des temps mesurés à l'écran.

Signal n'invente pas ses commandes. Un clic `legacy:<id>` clique le bouton du panneau d'avant (`src/signal-rendu.js`, en-tête). Le libellé affiché est le texte de ce bouton, sauf trois réécritures : « Exporter le dossier » pour `#export-tout`, « Pause demandée… » pendant le clic Pause, « Voir ce qui reste » en fin de lot s'il reste quelque chose à examiner.

Le code couleur ne change pas. Jetons recopiés de `panel-signal.css` (sombre, puis clair) :

| Jeton | Sombre | Clair |
|---|---|---|
| fond | `#121314` | `#E8E9E7` |
| surface | `#1A1B1D` | `#F1F2F0` |
| surface2 | `#222427` | `#FAFAF9` |
| encre | `#ECEDEE` | `#141516` |
| encre2 | `#A6A9AD` | `#4E5257` |
| encre3 | `#6F7378` | `#7C8085` |
| filet | `rgba(255,255,255,.12)` | `rgba(0,0,0,.12)` |
| filet-fort | `rgba(255,255,255,.22)` | `rgba(0,0,0,.24)` |
| vivant | `#37C871` | `#15703F` |
| attention | `#E8A93B` | `#8A570A` |
| alerte | `#F0665A` | `#B2372B` |
| action / texte | `#ECEDEE` / `#121314` | `#141516` / `#E8E9E7` |

D-247 : « l'interface 5.0 cherche la simplicité avec densité d'information ». La densité tient dans le mot juste et dans le mouvement qui porte un fait. Pas dans un décor.

Maquette des libellés proposés et du mouvement : `maquettes/ui-5.0/S-revision.html`. Chiffres inventés. Sa scène Repos est l'état Prêt de la section 1 (le repos d'où part un lot neuf). L'écran hors ligne, la relecture, Écho, l'historique et la connexion perdue sont dans l'inventaire ; la maquette ne les redessine pas.

## 1. Inventaire des libellés

Colonne « Nature » : **nouveau** (un départ qui n'existait pas), **reprise** (la même tâche continue), **prépare** (rien ne part), **autre** (arrêt, export, navigation, acquittement).

### Barre, tiroir, cache — toutes les vues

| Libellé | Acte | Effet réel | Nature |
|---|---|---|---|
| Orbite | `mode:automatic` | Change de vue. Ne lance pas le lot. | autre |
| Écho | `mode:native` | Change de vue. « Démarrer l'observation » reste grisé pendant un lot (`panel.js`, `LOT_TIENT_ECHO`). | autre |
| Puce (nom d'onglet, « Aucun onglet », « Onglet à choisir », « Reconnexion… », « ESV ne répond plus ») | `sg:esv` | Ouvre la liste. « Connecter » ou « Reconnecter » ré-équipe l'onglet (`conn:` ou `#reconnect`). Aucune pose. | autre |
| Commandes (Ctrl K) | `sg:palette` | Ouvre la palette. Voir la fin de cette section. | autre |
| Réglages | `sg:reglages` | Ouvre la feuille. Les choix (relecture, clic, grappe, passe, raison, bandeau, thème) sont ceux du panneau. | autre |
| Poignée du tiroir | `sg:tiroir` | Ouvre « Ce qui reste » (Orbite) ou les visites (Écho). | autre |
| Ouvrir | `sg:ouvrir:<cut>` | Clique `#goto-cut`. Navigation seule. Grisé pendant un lot, une pause, une relecture, une passe, Écho, ou hors `ready`, avec la raison (`panel.js`, `raisonAllerAuCut`). | autre |
| Examiner / Examiné | `sg:examiner` | Marque la ligne pour ce lot, dans le panneau. Aucune commande. | autre |
| Vider le cache | `#export-cache-clear` | Vide le cache des exports. Désactivé tant qu'un lot, une relecture, une passe en écriture ou une séance Écho tiennent, avec la raison dans la bande. | autre |

### Repos — rien n'est prêt à partir

Mot « Hors ligne » ou « Onglet à choisir » (`src/signal-rendu.js`, branche `!cibleOk`). Pas de lot, ou l'onglet ciblé n'est pas nommé et `ready`.

| Libellé | Acte | Effet réel | Nature |
|---|---|---|---|
| Choisir un onglet | `sg:esv` | Ouvre la liste. Bouton plein quand aucun onglet n'est à la fois choisi, nommé et prêt. | autre |
| Onglets ESV | `sg:esv` | Même liste. Bouton plein quand un onglet est choisi mais qu'aucune partie n'y est affichée. | autre |
| Démarrer le lot | `#start-batch` | Présent en second, **grisé**. Raison : « Choisis un onglet ESV : le lot part sur l'onglet nommé en haut à droite. » Ne part pas. | nouveau, refusé |

### Prêt — mot « Prêt »

Aucun lot en mémoire, onglet ciblé listé, nommé, `ready`. Bornes affichées (« Premier cut », « Dernier cut »). La case de reprise est cachée : elle n'existe qu'après un lot fini reprenable.

| Libellé | Acte | Effet réel | Nature |
|---|---|---|---|
| Démarrer le lot | `#start-batch` → `api('start')` | Crée un lot **neuf**. Premier cut : la valeur du champ, sinon le cut affiché. Dernier cut vide : jusqu'à la fin de la partie. `panel.js`, gestionnaire `start-batch`. | **nouveau** |
| Premier cut / Dernier cut | `#start`, `#end` | Ne lancent rien. Lus par Démarrer. | prépare |

Pause, Reprendre, Nouveau lot, Arrêter, Réessayer, SKIP, Reprise manuelle : cachés. L'export est dans le DOM mais Signal le retire de l'instrument tant que l'état n'est ni `fini` ni `arrete`. Il peut rester dans la palette.

### En cours — mot « En cours »

`batch.state === 'RUNNING'`. Bouton plein du panneau : le premier visible de `hierarchie`. Ici c'est Pause (`panel.js`, Pause visible seulement en `RUNNING`).

| Libellé | Acte | Effet réel | Nature |
|---|---|---|---|
| Pause | `#pause` → `api('pause')` | Le moteur passe le lot en `PAUSED` tout de suite (`src/engine.js`, `pause`). Signal, au clic, tant que l'état est encore `RUNNING`, écrit « Pause demandée… » et désactive le bouton (`src/ui5.js`, `pauseLot`). | autre |
| Pause demandée… | aucun | Statut d'attente. Pas une commande. | autre |
| Arrêter le lot | `#stop` → `api('stop')` | Clôt le lot. Second plan, encre alerte. | autre |

« Démarrer le lot » et « Nouveau lot » sont cachés (`lotOuvert`).

### Pause — mot « En pause »

`PAUSED` sans motif `low-confidence` (ce motif est un incident, plus bas). `pausedAt` est posé à l'entrée en pause (`background.js`) : « en pause depuis » a une heure.

| Libellé | Acte | Effet réel | Nature |
|---|---|---|---|
| Reprendre | `#resume` → `api('resume')` | `reprendreLot` : le **même** lot repart (retour au cut, reprise du moteur). `background.js`. | **reprise** |
| Arrêter le lot | `#stop` | Clôt le lot. | autre |

### Fin de lot — mots « Terminé » et « Arrêté »

`COMPLETED`, `FINISHED_WITH_UNCONFIRMED_ACTIONS` et `ERROR` : mot « Terminé » pour les deux premiers, « Erreur du lot » pour `ERROR` (incident). `STOPPED` avec `stoppedAtEnd` : Signal dit « Terminé ». `STOPPED` sans `stoppedAtEnd` : « Arrêté ».

`#new-batch` et `#start-batch` ne sont **jamais visibles ensemble** (`panel.js`, vers les boutons `new-batch` et `start-batch`) : « Nouveau lot » tant que `nouveauLot` est faux ; « Démarrer le lot » seulement après le clic, qui ne fait que `nouveauLot = true` et rouvrir les bornes.

| Libellé | Quand | Effet réel | Nature |
|---|---|---|---|
| Voir ce qui reste | Fin, et au moins un différé ou un vert déjà compté | Ouvre le tiroir. Signal remplace alors le bouton plein. `src/signal-rendu.js`, cas `fini`. | autre |
| Exporter le dossier | Fin. Plein s'il ne reste rien à examiner ; sinon second, derrière le tiroir. | `#export-tout`. Le texte du panneau est « Tout télécharger pour l'analyse ». | autre |
| Nouveau lot | Fin, tant qu'on n'a pas cliqué, et pas pendant l'écriture de la passe | **Ne lance rien.** Rouvre les bornes et fait revenir « Démarrer le lot ». `panel.js`, clic `new-batch`. | **prépare** |
| Démarrer le lot | Après ce clic | Lot **neuf** sur les bornes rouvertes. Le mot d'état reste « Terminé » ou « Arrêté » : l'écran n'est pas « Prêt ». | **nouveau** |
| Reprendre | `PAUSED` ou `STOPPED`, ou fin de partie probable, ou adaptateur muet débloquable | Voir la ligne suivante. | **reprise**, ou rien |
| Reprendre, lot déjà clos | `lotTermine` : `STOPPED` et issue `dernier-cut-valide`, `dernier-cut-differe`, `partie-sans-rouge`, `depart-sur-vert`, ou raison `navigation-other-part-after-defer` | **Ne rejoue rien.** Pose une notice qui renvoie à « Nouveau lot ». `background.js`, `lotTermine` puis `action==='resume'`. Le bouton reste affiché. | ni l'un ni l'autre |
| Reprise des différés : repartir des cuts posés par le lot précédent | Case. Lot GCV1 fini, au moins un différé et une pose, même partie, bornes visibles (donc après « Nouveau lot ») | Ne lance pas. Coche : recopie les bornes du premier différé à la fin du lot précédent. Le `start` suivant envoie `lotReprise:true` (appuis du lot clos, lot **neuf**). | **prépare** une reprise ; le départ est Démarrer |
| Lancer la relecture | Lien, si la relecture n'est pas en cours, pas en pause, pas déjà finie pour ce lot, mode pas « coupée » | `relecture-lancer`. Départ de la relecture. | **nouveau** (la relecture) |
| Relancer la deuxième passe | Lien, passe `arretee`, des poses décidées restent, lot plus ouvert | `passe-differes-ecrire`. Pose les cuts déjà décidés qui restent. Ne recalcule pas un lot. | **reprise** de la passe |

Après « Nouveau lot », si l'état est encore `STOPPED` et que `lotTermine` est faux, « Démarrer le lot » et « Reprendre » sont à l'écran ensemble. L'un crée un lot neuf, l'autre continue le même. Même icône : `icBouton` donne `play` à `start`, `new-batch`, `resume` et `reprendre` (`src/signal-rendu.js`).

### Relecture — mots « Relecture » et « Relecture en pause »

L'état `rel` remplace « Terminé » tant que `#relecture-arreter` est visible. Si le module de pause a des boutons, ils passent devant (`src/relecture-pause.js`, `vue`).

| Libellé | Quand | Effet réel | Nature |
|---|---|---|---|
| J'ai contrôlé le cut N | Une correction interrompue | `#relecture-acquitter`. Débloque. Passe devant les autres. | autre |
| Pause | Relecture en cours, réglage de pause allumé | `relecture-pause`. « Pause demandée… » tant que l'étape finit. | autre |
| Reprendre la relecture | En pause. « au cut N » si le cut est connu. Grisé si ESV ne répond pas. | `relecture-reprendre`. La **même** relecture. | **reprise** |
| Arrêter la relecture | En cours (bouton du panneau) ou en pause (bouton du module) | Arrête la passe. Encre alerte. | autre |
| Lancer la relecture | Voir la fin de lot | Départ. Caché pendant la pause de relecture. | **nouveau** |

### Passe en ombre

La feuille dit « Deuxième passe (en ombre) » : « note ce qu'elle poserait […] sans rien écrire ». C'est l'état actuel (écriture coupée, `CLAUDE.md`). La passe n'a pas son propre écran.

| Libellé | Quand | Effet réel | Nature |
|---|---|---|---|
| Ligne « en ombre : N sur M qu'elle poserait · rien n'est écrit » | Fin de lot, `passeDifferes.mode === 'ombre'` | Lecture. Aucun bouton de pose. | autre |
| Ligne « calcul des cuts restés sans pose… » | `etat === 'calcul'` | Lecture. | autre |
| Deuxième passe (en ombre), Allumée / Coupée | Réglages, hors séance | Le choix gardé. Ne lance pas la passe. | prépare |
| Mot « Deuxième passe », cadenas, « ne touche à rien » | Seulement si `etat === 'ecriture'` | Aucune action. « Arrêter le lot » devient « Arrêter la deuxième passe » (`#stop`). | autre |
| Relancer la deuxième passe | Écriture arrêtée avec un reste, pas le mode ombre en train de noter | Voir la fin de lot. Inutile tant que la passe ne fait que noter. | reprise |

### Écho

Hiérarchie du panneau : `native-resume`, `native-end`, `native-download`, `native-start`, `native-pause`. Le premier visible est le bouton plein.

| Libellé | Quand | Effet réel | Nature |
|---|---|---|---|
| Démarrer l'observation | Aucune séance ouverte | `#native-start`. | **nouveau** |
| Démarrer une nouvelle session | Séance `FINISHED` | Le même bouton, texte changé (`panel.js`). | **nouveau** |
| Pause | Collecte en cours ou au démarrage | `#native-pause`. Second plan : le plein est « Terminer et télécharger », parce qu'`native-end` est avant `native-pause` dans la hiérarchie. | autre |
| Reprendre | Pause, ou ESV sans réponse | `#native-resume`. Plein. La **même** séance. | **reprise** |
| Terminer et télécharger | Séance ouverte, pas `FINISHED`. Plein pendant la collecte. | `#native-end`, puis l'export. | autre |
| Télécharger à nouveau la session | `FINISHED`, ou ESV sans réponse. Plein une fois la séance finie (il passe avant « Démarrer une nouvelle session »). | Réexporte. | autre |
| Abandonner la séance Écho… | Feuille de réglages, pas l'instrument | `#native-discard`, confirmation, suppression. | autre |
| Écho, « Disponible après le lot » | Un lot Orbite est ouvert | Cadenas. Aucun départ. | autre |

Mots d'état : « Aucune séance », « Démarrage », « En observation », « Écho en pause », « ESV ne répond plus », « Séance à terminer », « Séance terminée ».

### Historique

Pas un mode. Bloc « Parties traitées » dans la feuille (`historiqueHtml`). Douze lignes au plus. Chaque ligne : numéro de partie, fin (`terminée`, `arrêtée`, `en cours`, `interrompue`, ou le mot brut), ciblés, posés, différés, skippés, ignorés au départ, heure de Paris. Vide : « Aucune partie enregistrée pour l'instant. » Aucun bouton. Le sélecteur de parties (`partsSelector`) n'est pas dessiné (le journal des versions le dit encore non affiché).

### Connexion perdue

`connection.status === 'unavailable'`, ou lot `PAUSED_ADAPTER_UNRESPONSIVE`.

| Libellé | Effet réel | Nature |
|---|---|---|
| Incident « ESV n'est pas connecté. Si la page ESV est figée, recharge-la (F5), puis reconnecte-la. » | Remplace l'objet : le rail disparaît (`objetHtml`, l'incident est dessiné à la place). | autre |
| Puce « ESV ne répond plus » | Ouvre la liste. Pastille encre alerte. | autre |
| Reconnecter | `#reconnect`, si le bouton d'origine est visible. Grisé pendant `reconnecting`. | autre |
| Reprendre | Adaptateur muet, lot GCV1, sans résultat à réconcilier et sans intention en cours (`debloquable`). La reprise du même lot, après que la page répond. | **reprise** |
| Démarrer le lot | Grisé, comme au repos, s'il n'y a pas de lot ouvert. | nouveau, refusé |

« Reconnexion… » (`reconnecting`) n'est pas la perte : la raison sous les boutons dit « Reconnexion à ESV en cours… ». La pastille pulse (`sg-pulse`, 1,2 s).

### Incidents du lot — hors des dix états, boutons réels

`unresolved-rail`, `low-confidence`, `MANUAL_TAKEOVER`, `reconcileRequired`, navigation de différé incertaine. Mot « À toi », « Interrompu », « ESV ne répond plus » ou « Repris à la main ».

| Libellé | Effet réel | Nature |
|---|---|---|
| Réessayer ce cut | `api('retry')`. Nouvelle capture du même cut. Refusé si les rails ont bougé pendant la pause. | **reprise** du cut |
| Reprise manuelle | `api('manual-takeover')`. Le cut est rendu, aucune commande dessus. | autre |
| Repris manuellement | `api('manual-completion')`. Le lot **continue** au cut suivant. Le cut n'est pas compté validé par Ariane. | **reprise** du lot |
| SKIP explicite | `api('explicit-skip')`, après confirmation. Décision envoyée, qui ne se défait pas depuis Ariane. | autre |
| Archiver le résultat interrompu · cut N | `api('close-uncertain')`. Clôt l'opération non confirmée. | autre |
| Arrêter | `#stop`. Dans `PAUSED_AFTER_STATE_MISSING`, c'est le seul bouton d'action : le panneau le dit dans la notice. | autre |

### Palette (Ctrl K)

Sans recherche, **quatre** commandes ; avec recherche, sept (`paletteListe`). L'ordre : bouton plein, secondaires, tiroir, export, changement de vue, réglages, onglets, reconnecter, vider le cache, détails techniques. Au repos, les quatre premières doublonnent l'écran (démarrer, tiroir, export, passer en Écho) et le reste se cherche. Une commande dangereuse demande une seconde Entrée. D-247 constatait déjà une palette pauvre en information : Mic a choisi le panneau, pas la palette.

## 2. Clarté

Règle : un verbe, un seul sens. **Lancer** = un départ neuf. **Continuer** = la même tâche. **Préparer** = rien ne part. Un lot repris n'emploie pas le mot d'un lot neuf.

Ce que l'opérateur nomme est établi dans le code, avec un décalage :

- « Démarrer le lot » et « Nouveau lot » ne sont pas à l'écran en même temps. On les rencontre à la suite. « Nouveau lot » a l'air d'un départ et n'en est pas un.
- Le vrai choix, après un arrêt au milieu (`STOPPED` sans `lotTermine`), est « Reprendre » (même lot) contre « Nouveau lot » puis « Démarrer le lot » (lot neuf). Les trois verbes se ressemblent, et les icônes sont la même.
- « Reprendre » sur un lot déjà clos ne rejoue rien, et le bouton reste là.
- « Reprise des différés » emploie le mot de « Reprendre » pour un lot neuf.
- En Écho, pendant la collecte, le bouton plein est « Terminer et télécharger », pas « Pause ».

| Avant | Après | Affiché quand | Nature |
|---|---|---|---|
| Démarrer le lot | Lancer un lot neuf | Prêt. Et après « Préparer », si la case des différés est décochée. | nouveau |
| Démarrer le lot, case cochée | Lancer un lot sur ces différés | Bornes rouvertes, case cochée. | nouveau, borné par les différés |
| Nouveau lot | Préparer un autre lot | Arrêté au milieu, le même lot peut encore continuer. | prépare |
| Nouveau lot | Préparer le lot suivant | Lot clos (`lotTermine`, ou terminé sans `STOPPED` reprenable). | prépare |
| Reprendre | Continuer ce lot | Pause. Arrêté au milieu. Adaptateur revenu. | reprise |
| Reprendre, lot clos | retiré | `lotTermine`. La notice reste : rien ne sera rejoué. | — |
| Reprise des différés : repartir… | Partir des différés du lot clos | Case, mêmes conditions qu'aujourd'hui. | prépare |
| Reprendre la relecture | Continuer la relecture | Relecture en pause. | reprise |
| Reprendre (Écho) | Continuer l'observation | Écho en pause. | reprise |
| Relancer la deuxième passe | Continuer la deuxième passe | Passe d'écriture arrêtée, des poses restent. | reprise |
| Démarrer l'observation | Lancer l'observation | Écho, aucune séance. | nouveau |
| Démarrer une nouvelle session | Lancer une observation neuve | Écho, séance terminée. | nouveau |
| Pause | Mettre en pause | Lot en cours. Écho en collecte : devient le bouton plein, « Terminer et télécharger » passe en second. | autre |
| Pause demandée… | Pause demandée… | Inchangé. Statut, pas un verbe de départ. | autre |
| Arrêter le lot | Arrêter ce lot | Lot en cours ou en pause. | autre |
| Arrêter la deuxième passe | Arrêter la deuxième passe | Inchangé : l'objet est déjà unique. | autre |
| Arrêter la relecture | Arrêter la relecture | Inchangé. | autre |
| Lancer la relecture | Lancer la relecture | Inchangé : « Lancer » est le verbe du départ neuf. | nouveau |
| Voir ce qui reste | Voir ce qui reste | Inchangé. | autre |
| Exporter le dossier | Exporter le dossier | Inchangé. | autre |
| J'ai contrôlé le cut N | J'ai contrôlé le cut N | Inchangé. | autre |
| Réessayer ce cut | Réessayer ce cut | Inchangé. | reprise du cut |
| Reprise manuelle | Rendre ce cut | Incident de rail ou de confiance. Le mot « reprise » sort de ce bouton. | autre |
| Repris manuellement | Cut traité, continuer le lot | Après la remise en main, ESV sur le cut suivant. | reprise |
| SKIP explicite | Passer ce cut | Même confirmation qu'aujourd'hui. | autre |
| Choisir un onglet / Onglets ESV / Reconnecter | inchangés | Le sens est déjà unique. | autre |

Sous le bouton plein, une ligne de 13 px, encre3, dit le genre et rien d'autre : « lot neuf », « même lot », « ne lance rien », « différés du lot clos », « même relecture », « même observation ». C'est la densité de D-247 : la ligne dit ce que le verbe ne peut pas porter seul.

Palette : les mêmes mots, pas un second vocabulaire. Sans recherche, la liste est celle de l'écran (le plein n'y est pas répété en tête), pas un plafond de quatre. La recherche garde réglages, cache, détails, abandon. Ctrl K ne devient pas l'endroit où l'on choisit entre continuer et lancer : ce choix reste sur l'instrument, avec la ligne de genre.

Ouvert, pas tranché ici : après un arrêt au milieu, le bouton plein proposé est « Continuer ce lot », et « Préparer un autre lot » est le lien. L'inverse est possible. La phase 2 attend le choix.

## 3. Mouvement

Ce qui est écrit aujourd'hui dans le panneau (`panel-signal.css`, dernière règle quand deux durées se recouvrent) :

| Quoi | Durée écrite | Hors de 200–450 ms |
|---|---|---|
| Appui du bouton plein (`--d-appui`, scale 0,98) | 120 ms | oui, trop sec |
| Couleur locale (`--d-local`) | 200 ms | non |
| Glissé déclaré, puis repris (`--d-glisse`) | 280 ms, puis 320 ms | non |
| Entrée d'écran (`--d-entree`) | 360 ms | non |
| Rail et curseur (la règle de 420 ms suit celle de 240 ms) | 420 ms | non |
| Anneau, `stroke-dashoffset` | 500 ms, linéaire | oui |
| Glyphe (scale 0,55 et rotation −25°) | 380 ms | la rotation ne porte aucun fait |
| Coche « terminé » | 520 ms | oui |
| Éclat d'alerte | 900 ms, deux fois | oui |
| Coche « examiné » | 340 ms, avec un passage à scale 1,15 | le rebond |
| Pulsation de la pastille, et du glyphe « en cours » | 1,2 s et 2 s, en boucle | oui |
| Tourniquet « Pause demandée… » | 900 ms, en boucle | oui |
| Fond d'une ligne de palette | 120 ms | oui |

`vivant()` réécrit l'anneau toutes les 500 ms (`src/ui5.js`, `setInterval(vivant, 500)`) pendant que le CSS l'ease sur 500 ms linéaires : les deux se battent. Le commentaire du CSS demande déjà « une animation signale un changement, jamais un ornement ; une seule boucle ». Les boucles réelles sont trois : l'anneau, la pastille, le tourniquet.

`prefers-reduced-motion` met déjà les durées à 0 et coupe animations et transitions. L'anneau continue de sauter : le script écrit le décalage même quand la transition est morte. « En pause depuis » continue de changer de texte : c'est une information, pas un mouvement.

Proposition. Courbe unique, déjà là : `cubic-bezier(.2, .7, .2, 1)`. Pas de rebond, pas de rotation. Chaque ligne dit le fait porté.

| Quoi | Durée | Ordre | Fait porté |
|---|---|---|---|
| Chiffre traité | 240 ms | avec le rail | le compte a changé |
| Segment du rail | 320 ms | 0 | les traités ont avancé |
| Curseur | 320 ms, après 40 ms | suit le front du segment | le cut en cours |
| Repère différé, depuis la ligne | 280 ms, après 80 ms | quand le cut est différé | un différé, à cet endroit |
| Anneau, au changement de cut | 400 ms, la courbe | repart de vide | le temps de ce cut repart |
| Anneau, pendant le cut | le temps réel, sans ease CSS | tant que le cut dure | le temps passé ÷ la médiane. Sans médiane (moins de 3 durées), l'anneau reste vide : rien n'est inventé |
| Mot et glyphe | 280 ms, opacité et couleur | 0 au changement d'état | l'état a changé. La forme dit l'état, la couleur confirme, comme aujourd'hui |
| Phrase | 240 ms, après 40 ms | après le mot | ce qui se passe |
| Libellé du bouton | 220 ms, après 80 ms | après la phrase | l'action offerte a changé |
| Appui | 200 ms, 1 px vers le bas | au clic | le clic est pris. Plus de scale |
| Tiroir, feuille, palette, liste d'onglets | 320 ms | à l'ouverture | une couche couvre l'instrument |
| Lignes du tiroir | 240 ms, 40 ms par rang, six rangs | après l'ouverture | les lignes sont là |
| « Examiné » | 280 ms, opacité du trait | au clic | la ligne est marquée |
| Coche de fin | 400 ms, le trait se pose | une fois, en entrant dans Terminé | le lot est clos |
| Pastille de connexion | 300 ms, la couleur seule | au changement de statut | prêt, en reconnexion, perdu. Plus de pulsation |
| Perte de connexion | 320 ms, l'incident se pose **au-dessus** du rail | au statut `unavailable` | la page est perdue, le lot reste lisible. Aujourd'hui l'incident remplace le rail |

La phase 1 tenait tout dans cette table : 200 à 450 ms, sans boucle, sans rebond. La maquette restait trop proche du panneau. Phase 1b lève ces limites. Trois caractères, commutables dans la barre de `maquettes/ui-5.0/S-revision.html`. Le code couleur ne change pas. Rien de ce qui suit n'est dans `src/` ni dans `panel*.css`.

Règle commune. Micro-geste 120 à 220 ms. Geste courant 250 à 500 ms. Moment signature 1,2 s, une seule fois. Une seule boucle à la fois, 2,8 s, jamais pendant une pause ni en mouvement réduit. « Ralenti ×0,25 » multiplie ces durées par 4, pour juger le geste. Vivant et Signature n'animent que `transform` et `opacity` : le compositeur, pas la mise en page. Le texte qu'on lit (la phrase, les bornes) ne bouge pas. Le ressort s'écrit `linear(0, 0.18 14%, 0.55 32%, 0.92 50%, 1.14 68%, 0.97 84%, 1)`.

### Sobre

La proposition de la phase 1, telle quelle. Pas de ressort, pas de boucle, pas de dépassement. Courbe `cubic-bezier(.2, .7, .2, 1)`.

| Geste | Durée | Propriété | Coût |
|---|---|---|---|
| Chiffre traité | 240 ms | `opacity`, `transform` | compositeur |
| Segment du rail | 320 ms | `width` | mise en page |
| Curseur | 320 ms, après 40 ms | `left` | mise en page |
| Repère différé | 280 ms | `transform`, `opacity` | compositeur |
| Mot, glyphe, phrase | 240 à 280 ms | `opacity` | compositeur |
| Appui | 200 ms | `transform` (1 px) | compositeur |
| Tiroir et ses lignes | 320 ms, puis 240 ms | `transform`, `opacity` | compositeur |
| Anneau au changement de cut | 400 ms | `stroke-dashoffset` | peinture |

`width` et `left` restent ici pour que Sobre soit la proposition déjà écrite, pas un troisième ressort. Ils coûtent une mise en page à chaque cut : c'est le prix de cette référence, et la raison pour laquelle Vivant ne les reprend pas.

### Vivant

Les mêmes faits, avec un dépassement court là où le fait compte, et une seule vie ambiante.

| Geste | Durée | Propriété | Coût | Fait porté |
|---|---|---|---|---|
| Cut validé : le segment | 420 ms, ressort | `transform` (`scaleX`) | compositeur | les traités ont avancé |
| Cut validé : le curseur s'étire puis se pose | 420 ms, ressort | `transform` | compositeur | le cut vient d'être validé |
| Éclat du cut (une fois, pas une boucle) | 420 ms | `transform`, `opacity` | compositeur | le choc du cut |
| Chiffre, puis la ligne « posés · différés » | 200 ms, puis 220 ms | `transform`, `opacity` | compositeur | le compte, puis le détail |
| Différé posé | 380 ms, ressort | `transform`, `opacity` | compositeur | un différé, à cet endroit |
| Appui du bouton plein | 200 ms, ressort | `transform` (`scale`) | compositeur | le clic est pris |
| Ouverture du tiroir | 480 ms, ressort | `transform` | compositeur | une couche couvre l'instrument |
| Lignes du tiroir | 320 ms, 50 ms par rang | `transform`, `opacity` | compositeur | les lignes arrivent |
| Halo du cut en cours | 2,8 s, boucle | `transform`, `opacity` | compositeur, une seule boucle | le lot vit. S'arrête à la pause, au mouvement réduit, et en Sobre |

### Signature

Vivant, plus trois moments.

| Geste | Durée | Propriété | Coût | Fait porté |
|---|---|---|---|---|
| Passage de témoin : le mot et le glyphe sortent, les suivants entrent | 160 ms puis 320 ms | `transform`, `opacity` | compositeur | l'état a changé, il ne se fait pas remplacer d'un bloc |
| Fin de lot | 1,2 s, une seule fois | `transform`, `opacity` sur le glyphe, le sceau et les lignes du bilan | compositeur | le lot est clos. Le sceau s'ouvre et s'éteint. Les lignes du bilan arrivent en cascade |
| Arrivée de l'incident | 480 ms, ressort | `transform`, `opacity` | compositeur | l'alerte se pose au-dessus du rail, sans le masquer et sans déplacer la phrase |

Le bouton « Incident » de la barre montre l'arrivée. En Vivant elle dure 280 ms, sans dépassement. En Sobre elle est instantanée : l'information reste, le geste non.

### Séquence

« Dérouler un lot », environ 20 s à vitesse normale : repos, départ, six cuts dont un différé, pause demandée, pause (le halo s'arrête), reprise, deux cuts, le rail va au bout, fin de lot (le moment signature si le caractère est Signature). « Rejouer » rejoue le geste de la scène affichée, sans relancer la séquence. « Ralenti ×0,25 » étire durées et séquence par 4.

Mouvement réduit = tout fixe, dans les trois caractères. Les positions, les chiffres, les libellés et l'incident sont posés tout de suite. Le halo ne part pas. Le sceau de fin ne joue pas : le mot « Terminé » et la coche restent. Rien de ce qui informe n'est dans le geste.

## 4. Finition, sans rompre la simplicité

Six gestes. Aucune couleur neuve. Lisibles pendant le travail : rien ne bouge dans la zone du rail sauf un fait de la section 3. La case « Finition riche » de la maquette pose l'instrument sur `surface` avec le filet et l'ombre déjà jetés, le rail dans un puits `fond`, le glyphe un peu plus grand, et chaque icône de verbe un peu plus grande. Mêmes jetons.

1. **Matière.** L'objet (rail, bilan, bornes) repose sur `surface`, filet `filet`, filet haut `filet-fort`. Le fond reste `fond`. Le rail n'est plus posé dans le vide. Aucun grain, aucune image.

2. **Profondeur.** Le bouton plein reste plat (`action`). À l'appui il descend de 1 px (section 3), il ne grossit pas. Le tiroir ouvert prend l'ombre déjà jetée (`--ombre`, 8 px 24 px) ; fermé, aucune ombre. On voit qu'une couche est au-dessus.

3. **Icônes.** Trait 1,75, comme `IC` aujourd'hui. Le verbe décide du dessin : Lancer = cercle et barre (départ), Continuer = triangle, Préparer = deux bornes, Pause = deux barres, Arrêter = carré. Aujourd'hui Lancer, Continuer et Nouveau lot partagent le triangle.

4. **Ligne de genre.** 13 px, encre3, sous le bouton, une formule de la section 2. Pas de slogan. C'est elle qui sépare « même lot » et « lot neuf » quand l'œil va trop vite pour le verbe.

5. **États vides.** Repos et « Aucune séance » : le glyphe en cercle pointillé déjà dessiné (`echoVide`), plus la phrase déjà écrite. Rail au repos : la ligne pointillée et les deux bornes, segment de traités de largeur nulle. Historique vide et tiroir vide : la phrase déjà là (« Aucune partie enregistrée pour l'instant. », « Aucun différé. »), sans illustration. Le vide dit qu'il n'y a rien, pas qu'il manque un dessin.

6. **Typographie.** Inchangée dans le panneau : IBM Plex Sans et Plex Mono, chiffres tabulaires, mot d'état 28/32 en graisse 500, phrase 15/22 en encre2. La maquette, ouverte seule, retombe sur la police du système si les fichiers de `fonts/` ne sont pas à côté : les tailles et les graisses sont les mêmes, pas le dessin des lettres.

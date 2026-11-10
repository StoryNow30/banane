# CH-097 : constat de l'audit du 10/11 (extraits des rapports « service worker » et « panneau, page, réglages »)

## Service worker

### 1. Un lot en `ERROR` n'est « clos » ni pour le service worker ni pour le vidage du cache, alors que le panneau et la file le tiennent pour clos
- Où : `background.js:210` (`OBS_CLOS`), `:3259` (`LOT_CLOS`, même contenu : constante dupliquée), `src/export-cache.js` (`TERMINES`), `src/perf-phase.js:31` (`CLOSED_STATES`),
  `src/historique-parties.js` (`CLOS`, `ERROR` traité à part) ; contre `src/file-parties.js` (`CLOS` AVEC `ERROR`) et `panel.js:850, 866, 920` (avec `ERROR`), `panel.js:959` (sans).
- Catégorie : incohérent (six listes « lot clos », deux contenus) avec effets cassés.
- Preuve (lu) : `src/engine.js:1055` met le lot en `ERROR` ; `Engine.resume` (l. 1209) ne le reprend pas. Tant que ce lot reste le lot courant :
  - `export-cache.refus` rend « un lot n'est pas terminé (ERROR) : arrête-le ou termine-le d'abord » et, de toute façon, « la clôture de la mesure V1 du lot n'est pas terminée » (`perf-phase.batchState` : `ERROR` suspend la mesure sans la clore) ; or `panel.js:866` CACHE « Arrêter » pour `ERROR` : le vidage du cache des exports reste refusé jusqu'au lot suivant ;
  - `seanceObservateur()` (`background.js:257`) rend `lot:<id>` sans fin : `launcher-status` annonce une séance, les observations sont rangées au nom du lot mort, et `eveilBesoin()` (`:4071`) garde `chrome.power.requestKeepAwake` (niveau livré `display` : écran allumé) tant que le service worker vit ;
  - `refusReconnexionAuto()` (`:2995`) refuse la reconnexion après F5 en disant « lot ouvert : clique sur « Reprendre », il se reconnecte seul », faux pour un lot en erreur ;
  - `contexteAudit()` (`:445`) attribue les lectures de liste à la partie du lot en erreur (le défaut que D-141 corrigeait pour un lot clos) ;
  - `bilanClicsHorsVue`, `bilanDeplacementVue`, `cloreMesureHorsBoucle` ne s'écrivent jamais ; `refusCorrection` (`:3264`) dit « le lot est encore ouvert (ERROR) », message que le panneau reçoit quand une file arrêtée demande seule la liste (`panel.js:959-965`).
- Qualification : ÉTABLI pour l'incohérence et pour chaque refus côté service worker ; PROBABLE pour « l'opérateur n'a aucun bouton pour en sortir » (je n'ai pas lu tout Signal).
- Correction proposée : une constante partagée « lot terminé » (avec `ERROR`) pour les usages non décisionnels (éveil, reconnexion auto, audit de liste, bilans, vidage du cache), la liste à trois états restant là où « clos proprement » compte (grâce, passe, relecture).
- Sûr à corriger : OUI pour l'éveil, le message de reconnexion, l'audit de liste et la constante dupliquée ; NON sans choix de l'opérateur pour le vidage du cache et l'observateur (ce qu'on garde ou jette après une erreur).

### 6. Écho : `Math.max(...events)` au réveil du service worker peut dépasser la limite d'arguments et faire échouer `ready`
- Où : `src/native-session.js:90-91` (`init`, séance Écho en cours au réveil) ; `background.js:1697` (`await native.init()` dans `ready`).
- Catégorie : cassé (latent).
- Preuve : lu ; sous Node, 130 000 arguments lèvent « Maximum call stack size exceeded » (120 000 passent). Au-delà, `init` rejette, donc `ready` rejette : `dispatch` échoue pour TOUTE action, à chaque réveil, tant que l'état garde la séance « en cours ».
- Qualification : ÉTABLI pour le mécanisme ; SUPPOSÉ pour l'atteinte du seuil (aucune séance de cette taille vue ; le seuil du navigateur n'est pas mesuré).
- Correction : une boucle au lieu de l'étalement. Sûr à corriger : OUI.

### 7. Alertes de la file : `resume.refus` et `resume.ecritsPasse` ne sont jamais fournis
- Où : `fileResume` (`background.js:4132`) rend `{traites,poses,differes,main}` ; `src/file-parties.js:270-283` (`alertes`) lit `resume.ecritsPasse` et `resume.refus`.
- Catégorie : incohérent (contrat entre deux fichiers). Preuve (lu) : `partie.resume` n'a pas d'autre écrivain (`file-parties.js:151`). L'alerte `refus` ne peut jamais sortir ; l'alerte `differes` compare des différés BRUTS, sans retrancher ce que la deuxième passe a écrit, contre son commentaire.
- Qualification : ÉTABLI.
- Correction : lire `partie.passe.ecrits` (déjà noté) et porter les refus de la relecture dans `partie.relecture` ; ou retirer l'alerte `refus`.
- Sûr à corriger : OUI (alertes non bloquantes), mais cela change ce que Signal affiche.

### 8. Toute action du panneau qui échoue écrase l'avis du lot, sauvegarde l'état et consomme une entrée du journal des transitions
- Où : `background.js:4671` (rejet de `dispatch` → `coordinateurLot.transition('erreur', …)` : `engine.s.notice=message`, `engine.save()`, entrée `erreur` parmi les 64).
- Catégorie : incohérent / inefficace.
- Preuve (lu) : même traitement pour une action de lecture que pour « Démarrer ». Cas lu de bout en bout : `panel.js:1860` appelle `build` à chaque ouverture du panneau ; `build` est traité APRÈS le refus général « Écho est actif » (`background.js:4560` puis `:4593`) : pendant une séance Écho (donc pendant toute correction de l'Aurore), ouvrir le panneau remplace l'avis par « Écho est actif… » et n'affiche pas le paquet. Les entrées `erreur` poussent hors des 64 les transitions réelles (`transitionsLot` de l'export ; `fileTic` y cherche l'arrêt de l'opérateur, avec `obsFins` en second appui).
- Qualification : ÉTABLI.
- Correction : sortir `build` (et les lectures) du refus « Écho est actif » ; ne noter `erreur` (avis + transition) que pour les actions qui agissent.
- Sûr à corriger : OUI (aucune décision) ; cela change l'avis affiché.

### 10. Écho : le libellé résumé d'une visite n'est pas rafraîchi quand l'écriture de validation arrive après sa clôture
- Où : `src/native-session.js:631-635` (`noteServerWriteNow` : `referenceFromWrite`, `classify`, `saveRecord`, sans toucher `n.visits[].label`), contre `:470`, `:663`, `:99` qui le posent.
- Catégorie : incohérent. Preuve (lu) : l'écriture de validation suit la navigation (délai dit dans `background.js`, commentaire T21d), donc souvent `visit-ended` ; `referenceFromWrite` peut alors changer le libellé de l'enregistrement, pas celui du résumé que lisent le bilan de la correction (`visitesFusionnees`) et le panneau.
- Qualification : PROBABLE (non reproduit). Effet : « validé » au lieu de « corrigé » (ou l'inverse) dans `correction-fin` ; le compte « traités » ne change pas.
- Correction : recopier `observedLabelCandidate` dans le résumé après le `classify` d'une visite close. Sûr à corriger : OUI.

### 13. Messages reçus avant `ready` : relevés perdus sans trace
- Où : `background.js:4637-4638`. `esv-releve` et `clic-hors-vue` exigent `sender.tab.id===selectedTab`, or `selectedTab` est `null` avant `ready` : le message qui réveille le service worker est ignoré sans réponse ni trace (le défaut OBS-3, corrigé pour `esv-observation` seulement, `:4644`).
- Catégorie : cassé (mineur). Qualification : ÉTABLI (lecture). Effet borné : un relevé du compteur manquant donne le comportement de repli (pas de « dernier cut certain » sur ce cut).
- Sûr à corriger : OUI (traiter après `ready`, comme `esv-observation`).


## Panneau

### 1. INCOHÉRENT, ÉTABLI — l'interrupteur de la deuxième passe est dit « en ombre, n'écrit rien dans ESV » alors que le réglage livré écrit dans ESV
- Où : `src/signal-rendu.js:511` (feuille de réglages de Signal : « Rattrapage (en ombre) … sans rien écrire dans ESV ») ; `panel.html:249` (libellé de la case `#passe-differes` : « (en ombre : n'écrit rien dans ESV) ») ; `panel.js:564` (avis après le clic : « Deuxième passe allumée, en ombre : … sans rien écrire dans ESV »).
- Preuve : `src/settings.js` `passeDifferesDefaut = {ombre:true, ecriture:true, ecritureMax:10, …}` ; `background.js:2134-2140` (`passeDiffReglage`) rend alors le mode `'ecriture'`. `panel.html:251`, deux lignes sous la case, dit « Allumée par défaut… celle qui écrit s'arrête » ; `describe()` de `settings.js` nomme la même case « (écrit dans ESV) ».
- Conséquence : l'opérateur qui allume « Rattrapage (en ombre) » allume une passe qui pose et valide jusqu'à 10 cuts par lot.
- Correction proposée : libellé selon le mode réel (le service worker le connaît), ou texte fixe « écrit dans ESV, 10 cuts au plus par lot ».
- Sûr à corriger : NON (change ce que l'opérateur lit ; le texte lui revient ; des essais épinglent probablement ces chaînes).

### 4. CASSÉ, ÉTABLI (les deux bouts lus) — plus de 12 plages de verts : Signal sous-compte les « verts à contrôler » et affiche une ligne vide
- Où : `panel.js:308` (`VERTS_PLAGES_MAX=12`), `panel.js:348-349` (au-delà : `<li class="muted">… et N autres plages, dans l'export</li>`) ; `src/ui5.js:134-135` recompte les verts en additionnant « · N » lu dans le texte de chaque `<li>` de `#verts-plages` ; `:144-145` en tire `vertsNombre` et `aExaminer`.
- Conséquence : au-delà de 12 plages, `vertsNombre` ne compte que les 12 premières (le vrai nombre, `L.aControler`, n'est que dans `#verts-ligne`) ; le 13e `<li>`, sans `<b>` ni `<span>`, devient une ligne de vert vide dans le tiroir (`src/signal-rendu.js:384`). Fréquence de plus de 12 plages : non mesurée.
- Correction proposée : exposer la liste des verts par `ArianePanel` et la lire dans `ui5.js` au lieu du DOM ; à défaut ignorer le `<li class="muted">` et prendre le nombre dans `#verts-ligne`.
- Sûr à corriger : oui (affichage seul ; essai rouge simple : 13 plages).

### 13. INCOHÉRENT, ÉTABLI — heure de la machine au lieu de l'heure de Paris
- `src/relecture-pause.js:23` : « gardée jusqu'à … » par `toLocaleString('fr-FR', …)` sans `timeZone:'Europe/Paris'`, contre la règle de `panel.js:79-86` (« l'heure de Paris partout »). Texte repris par Signal.
- Sûr à corriger : oui (ajouter le fuseau ; sans effet sur une machine à l'heure de Paris).


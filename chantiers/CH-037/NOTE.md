# CH-037 : note (une page). Deux défauts de l'Aurore sur un vrai poste (4.9.5.30, 01/11)

Données lues dans `banane-data`, collection `2026-11-01_v4.9.5.30_aurore-parties-10-11` : séance Écho exportée à 16:25:43 (43 visites), et état d'Écho dans l'export Orbite de 16:27:34 (51 visites, `FINISHED`). Rien n'en est copié ici.

## Défaut 1 : « Ouvrir » vers une autre partie ne fait rien
**Cause (ÉTABLI, code).** Le réglage `correctionEntreParties.actif` est éteint (`src/settings.js`). La liste naît alors sans `entreParties`. Dans `src/signal-rendu.js` (`ongletCorrectionHtml`, `outil`), le bouton « Ouvrir » d'un cut d'une autre partie que la partie affichée est rendu `disabled`. La seule raison est dans l'infobulle (`title`). Un clic sur un bouton désactivé ne déclenche rien : aucun message n'arrive au service worker et rien n'est écrit au journal. **Preuve (ÉTABLI, journal)** : 41 `correction-ouvrir`, tous « confirme » dans la partie affichée, et 0 `correction-partie`.
**Correctif.**
- (a) `actif:true` par défaut. On peut l'éteindre de deux façons : dans `src/settings.js`, ou par un interrupteur des réglages de Signal, gardé dans `storage.local` comme la « série de cuts à poser ». Le réglage est relu **au clic**, et non plus seulement à la naissance de la liste.
- (b) Le bouton n'est plus jamais désactivé pour cause d'autre partie. Le clic part toujours au service worker. Un refus revient avec une raison lisible, affichée dans Signal (`#correction-etat` puis `sg-raison`) et journalisée (`correction-ouvrir`, code `PASSAGE_ETEINT`, `CHANGEMENT_PARTIE`, etc.). Les raisons possibles : réglage éteint, partie introuvable, changement refusé, délai.
- (c) Essais VM et maquette ESV : aller-retour, refus, Écho actif pendant le passage.

**Risques.** Allumé, le chemin est celui de CH-035 : le lien du sélecteur seul, aucune écriture, aucun SKIP. Il n'a jamais été vu sur un vrai ESV pendant une séance Écho (SUPPOSÉ). La maquette prouve l'enchaînement d'Ariane, pas la conduite du vrai ESV.

## Défaut 2 : le dernier cut validé reste orange
**Ce que montrent les données (ÉTABLI).**
- **Cut 9748 de la partie 11.** C'est le dernier cut de cette partie dans l'Aurore. La visite 8 reçoit `keydown Space + Shift`, `intent: VALIDATE`, à 16:18:57. À 16:19:15, `native-page-lost` (`page-reloaded`) : l'opérateur change de partie à la main. Dans l'état final d'Écho, cette visite n'a toujours **ni `endedAt` ni `label`**.
  - Cause dans le code : `pageLost` (et la clôture après redémarrage, l. ~90) classe l'enregistrement, mais ne recopie pas son étiquette dans le résumé `n.visits`. Seul `visit-ended` le fait (l. 456).
  - Conséquence : le cut s'affiche « vu sans validation ». Il n'est devenu « validé » qu'après que l'opérateur l'a rouvert à 16:26:47 et validé de nouveau (visite 46).
  - Plus généralement, le libellé n'existe qu'à la fin de la visite. La visite ouverte reste donc « ouvert dans ESV » tant que l'opérateur ne change pas de cut.
- **Cut 3250 de la partie 10.** 5 visites :
  - corrigé-validé à 16:20:21 ;
  - puis une visite sans décision ;
  - puis validé sans mouvement ;
  - puis une visite sans décision de 2,5 s à 16:27:30.
  - Le bilan de `correction-fin` (16:27:33) dit « vu » (`PASS_NO_DECISION`), alors que le cut a été corrigé puis validé. C'est la règle « la dernière visite décide » (`statutDe`).

**Signal fiable et déjà présent (ÉTABLI).** Dans la visite ouverte, l'intention `VALIDATE` est enregistrée **en direct** dans `n.current.operatorIntents` (traitement de `operator-event`), avec sa référence finale `humanFinalReference`. L'étiquette de fin (`observedLabelCandidate`) est calculée par `classify(record)` à partir de ces seules données. L'écriture 204 d'ESV n'est pas nécessaire : elle n'est pas observée sur cette séance (`serverConfirmationStatus: not-observed`).

**Correctif** (ni `native-session.js`, qui reste en lecture, ni un module de décision ne sont touchés) :
- (a) Le service worker calcule une **étiquette provisoire**. Il applique le même `native.classify` à une **copie** de chaque enregistrement qui n'a pas encore de libellé dans `n.visits` : la visite ouverte, ou une visite perdue avec la page. Le résultat est gardé dans `engine.s.correction.issues` (`{visitId: label}`). Signal, `correctionVerifierFin` et `correction-fin` lisent les mêmes visites fusionnées. Le cut passe donc « validé » ou « corrigé » au premier rafraîchissement qui suit Maj+Espace, sans navigation.
- (b) Règle écrite dans `statutDe` : **le résultat le plus fort parmi les visites décide**, dans l'ordre corrigé > validé > ouvert > vu > à faire. À force égale, la visite la plus récente l'emporte, et le libellé gardé est celui de la visite retenue.
- (c) Essais rouges puis verts sur des données fabriquées : une visite ouverte validée, une visite perdue avec la page, et le cut 3250 avec quatre visites dont la dernière sans décision.
- (d) L'écran, `correction-fin` et la fin « liste finie » passent par la même fonction de fusion. Un essai le vérifie.

**Risques.**
- La règle « le plus fort » peut masquer une revisite qui défait une correction. ESV n'a pas de geste « dévalider » observé par Écho, donc le risque est SUPPOSÉ faible.
- L'étiquette provisoire d'une visite ouverte peut changer si l'opérateur bouge un rail après Maj+Espace. Écho le marque déjà (`rail-change-after-validate-intent`), et l'étiquette finale remplace la provisoire à la clôture.
- Le défaut de `pageLost`, qui ne recopie pas l'étiquette dans `n.visits`, touche aussi les séances Écho hors Aurore. Je le signale à l'intégrateur sans le corriger : `native-session.js` est en lecture seule pour ce chantier.

# Signal — revue du code du test 21 (4.9.5.21) : D4 à D7, R1, R4 à R6, G1

Tronc de départ : `claude/50-test17` à `5a68f22`. Branche locale `aud21`, non poussée. Trois branches se partagent la revue : D1, D2 et la garde
« Démarrer le lot » (`co21`) ; D3, R2, R3 (`bas21`) ; ici D4, D5, D6, D7, R1, R4, R5, R6, G1. Fichiers touchés : `src/signal-rendu.js`, `src/ui5.js`,
`panel-signal.css`, deux essais neufs. **Aucun changement** de `background.js`, `panel.js`, `panel.html`, du moteur, de la pose, de la décision, de
l'écriture, de la relecture ni d'Écho (collecte) : Signal lit le panneau et clique ses éléments d'origine, comme avant. Ariane n'envoie jamais SKIP
et ne valide jamais un cut non résolu : aucun chemin nouveau n'y mène (G1 ajoute au contraire une confirmation au clavier).

Niveaux : **ÉTABLI** (lu dans le code et rejoué par un essai), **PROBABLE**, **SUPPOSÉ**.

## 1. Défaut → correctif → essai

Essais : `tests/signal-revue-t21.test.cjs` (vm : rendu pur, et page minimale de `tests/helpers/ui5-page.cjs`) et
`tests/ui5-navigateur-signal-revue-t21.test.cjs` (vrai `panel.js` dans Chromium, API Chrome simulée). Chaque essai a été vu **rouge** sur le code
d'avant (ou sur le commit d'avant), puis vert.

| Défaut | Constat (niveau) | Correctif | Essai |
|---|---|---|---|
| **D7** bornes et « Reprise des différés » absentes | ÉTABLI : aucun `data-borne` ni `lot-reprise` dans Signal ; après « Nouveau lot », la fin retenue n'était ni dite ni modifiable | `src/ui5.js` : `ar.bornesProchain` = champs `#start` / `#end` et `#bornes-note` tant que le panneau montre `#lot-bornes` **et** `#start-batch` ; `ar.reprise` = `#lot-reprise` si `#lot-reprise-row` est visible. `src/signal-rendu.js` `bornesHtml` : deux champs (« Premier cut », « Dernier cut », vide = fin de partie) et la case, en Orbite, sans lot ouvert ; ce qu'on tape va dans les champs d'origine (gestionnaire existant), la case clique `#lot-reprise` | vm : D7 ×3 ; navigateur : après « Nouveau lot », le dernier cut tapé dans Signal (4850) est celui que `start` envoie |
| **D5** « Ouvrir dans ESV » vers la partie affichée | ÉTABLI (code) | `src/ui5.js` : `part = batch.scope.part ?? current.part` ; si ESV affiche une autre partie, `goToCut` refuse `WRONG_PART` et `#goto-cut-etat` l'affiche dans le tiroir (chemin existant) | vm : partie affichée 14, lot 13 → cible `13:4812` ; sans lot → partie affichée |
| **D4** `#notice` jamais affiché | ÉTABLI : refus muet (rejoué en navigateur : `start` refusé, rien dans Signal avant le correctif) | `m.avis` : la ligne d'avis **en erreur** (`#notice.error`) ; pas quand ESV est déconnecté ni muet dans Écho (l'incident le dit déjà) ; bloc `sg-incident` au-dessus de l'objet, ou dans l'incident s'il y en a un | vm : D4 ; navigateur : « Ouvre le premier cut du lot dans ESV. » affiché après le refus de `start` |
| **R5** `#avis-contrat` jamais affiché | ÉTABLI | dans `m.avis` | vm : R5 |
| **D6** correction interrompue | texte jamais montré : ÉTABLI ; bouton absent en état `rel` : SUPPOSÉ (l'état `rel` demande une passe en cours, la correction interrompue suit d'ordinaire une passe arrêtée) | `#relecture-interrompue` dans `m.avis` ; en `rel`, `relecture-acquitter` (s'il est visible) passe devant les boutons de pause de la relecture | vm : texte en fin de lot, bouton principal en `rel` ; sans correction interrompue, rien ne change |
| **R6** DOM réécrit chaque seconde | ÉTABLI (rejoué en navigateur : l'écran `.sg-fen` était remplacé entre deux rendus du panneau) | `src/ui5.js` `maj` : la comparaison ignore `stroke-dashoffset` et le texte de `.sg-pause-depuis` ; `vivant()` les fait avancer, tous (l'anneau de la poignée du tiroir, qui ne vivait que par la réécriture, compris) ; un vrai changement redessine | vm : même état une seconde plus tard → pas de réécriture, un cut de plus → redessin ; navigateur : même `.sg-fen` après 2,6 s de lot, les deux anneaux avancent |
| **R4a** « 0 vert » / « Rien à examiner » avant le calcul | ÉTABLI | `vertsNombre: null` quand `#verts-controle` est caché ; fin de lot « N différés · verts pas encore calculés », poignée idem | vm : rendu et page |
| **R4b** « validés tels quels » = vus − corrigés | ÉTABLI | `echo.valides` = visites `VALIDATE_NO_MOVEMENT` | vm : 5 visites (1 correction, 1 SKIP, 1 sans issue) → 2 |
| **R1** passe en ombre invisible | ÉTABLI | `ar.passeFin` (passe de **ce** lot, `lotId` vérifié, hors écriture) ; ligne « Deuxième passe » de la fin de lot : en calcul / « N sur M qu'elle poserait · rien n'est écrit dans ESV » / posés et validés sur décidés / erreur | vm : rendu et page (autre lot → rien ; en écriture → état « Deuxième passe » inchangé) |
| **G1** Entrée sur une commande dangereuse | SUPPOSÉ (risque) | palette : « Arrêter le lot », « Arrêter la relecture », SKIP, « Terminer et télécharger » partent à la **seconde** Entrée (la ligne dit « Entrée encore pour confirmer ») ; toute autre touche annule ; clic inchangé | vm : G1 |

Commits (préfixe « Revue T21 : ») : D7, D5, D4+R5+D6, R6, R4, R1, G1, puis deux compléments trouvés à la relecture du diff : D7 (bornes aussi après
un lot en `ERROR`, que le panneau traite comme fini) et R6 (l'anneau de la poignée restait figé sans la réécriture).

## 2. Ce qui reste ouvert

- **Dépendance à D1 (branche `co21`).** Tant que le panneau reste en vue `home`, `panel.js` ne met à jour ni ses boutons, ni ses bornes, ni sa ligne
  d'avis : les bornes montrées par Signal sont alors les champs vides (le lot partirait du cut affiché jusqu'à la fin de la partie, ce que Signal dit
  désormais), et une ligne d'avis en erreur peut rester affichée jusqu'à la prochaine action ou au prochain changement de vue (règle du panneau :
  `uiError` vit jusque-là). ÉTABLI par lecture (`panel.js:131`, `:867`, `:1280`).
- **Fusion avec `co21`.** `co21` met aussi `s.notice.texte` (en erreur) dans `m.raison` de l'état « Hors ligne / Onglet à choisir » : après fusion, le
  refus y serait dit deux fois ; garder l'un des deux (le bloc d'alerte de D4 vaut pour tous les états).
- **R4b, instantané sans `valides`.** `src/ui5.js` le fournit toujours ; seul un instantané fabriqué sans ce champ retombe sur « vus − corrigés »
  (gardé pour ne pas toucher l'essai d'Écho de `tests/signal-rendu.test.cjs`, que `bas21` réécrit).
- **R4a.** « Pas encore calculés » vaut aussi quand le calcul a échoué ou est coupé : le panneau ne distingue pas ces cas dans le DOM (carte cachée).
- **Mineur de R1 non fait.** L'état « Deuxième passe » (verrou « ne touche à rien ») ne vérifie toujours pas `passeDifferes.lotId === batch.id` :
  laissé ainsi, car afficher le verrou de trop est sans risque, l'inverse non.
- **Hors périmètre ici** : D1, D2, D3, R2, R3 (autres branches), R7, G2, G3.

## 3. Preuves

- `node tools/verify.cjs` (une seule fois, machine au repos : aucun rejeu ni parité, pas de `lourd.lock`), le 26/10 de 11 h 43 à 11 h 51 UTC, sur la tête
  de `aud21` avant ce commit de fiche : **2627 essais, 2625 réussis, 0 échec, 0 annulé**, 2 ignorés (les deux essais du corpus Natif privé, absent
  de ce clone : ignorés, pas réussis), syntaxe des 64 fichiers d'exécution, géométrie inchangée, moteur conforme à la baseline V4.6.0. Les sorties
  `audit/verification.*` n'ont pas été commitées (pas de version, pas de paquet).
- Maquette ESV (`CHROMIUM=/opt/pw-browsers/chromium node tests/esv-maquette/essais.cjs`) : **25 / 25**, 0 échec, 0 ignoré.
- Rouge d'abord : chaque essai de `tests/signal-revue-t21.test.cjs` a échoué sur le code d'avant son correctif ; les deux essais de navigateur ont
  échoué sur `5a68f22` (D4 : refus non affiché ; R6 : `.sg-fen` remplacé), l'anneau de la poignée sur le commit R6 d'avant son complément.

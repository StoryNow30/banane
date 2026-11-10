# CH-097 : rapport de l'exécutant (10/11/2026)

Branche `chantier/CH-097`, un commit par défaut. Chaque essai `tests/ch097-N-*.test.cjs` a été vu rouge sur le tronc avant le code, vert après (ÉTABLI, mesuré dans la machine de l'exécutant). Aucun fichier protégé touché, aucun `.patch`. Le bouton « SKIP explicite » et son chemin ne sont pas touchés.

| N° | Défaut | Issue | Preuve (rouge → vert) |
|---|---|---|---|
| 1 | Lot en ERROR jamais « clos » | **corrigé** pour ce qui est sans choix ; le reste **laissé à l'opérateur** (ci-dessous) | 4 rouges → 5 verts |
| 2 | Écho, `Math.max(...events)` au réveil | **corrigé** (boucle) | 200 000 événements : « Maximum call stack size exceeded » → vert |
| 3 | Alertes de la file (`refus`, `ecritsPasse`) | **corrigé** dans `src/file-parties.js` | 3 rouges → 5 verts |
| 4 | Action refusée qui écrase l'avis | **corrigé** | 2 rouges → 3 verts |
| 5 | `esv-releve`, `clic-hors-vue` avant `ready` | **corrigé** | 1 rouge → 3 verts |
| 6 | Verts au-delà de 12 plages | **corrigé** | 4 rouges → 5 verts |
| 7 | Heure de la machine | **corrigé** (`timeZone:'Europe/Paris'`) | 2 rouges → 3 verts (machine forcée à Tokyo) |
| 8 | Libellé de la deuxième passe (D-319) | **corrigé** | 5 rouges → 5 verts |
| 9 | Libellé d'une visite Écho après écriture tardive | **reproduit** (PROBABLE → ÉTABLI), puis **corrigé** | 1 rouge → 3 verts |

## Ce qui a été fait, défaut par défaut
1. Une seule liste « clos proprement » (`OBS_CLOS` ; `LOT_CLOS` retiré, même contenu) et `LOT_TERMINE` (= clos + ERROR) pour deux usages sans décision : l'éveil (un lot en ERROR relâche l'écran) et la reconnexion après F5 (un lot en ERROR ne la refuse plus : l'onglet est ré-équipé comme pour un lot clos ; 0 commande ESV mesuré dans l'essai, le lot reste en ERROR). Choix de l'exécutant à confirmer : lever le refus plutôt que seulement changer son texte, parce que le panneau n'offre pas « Reprendre » pour un lot en ERROR.
2. `src/native-session.js` `init` : boucle au lieu de l'étalement. Le seuil du navigateur reste non mesuré, l'atteinte du seuil sur le terrain reste SUPPOSÉE.
3. Le service worker envoyait déjà `refusees` (événement `relecture-fin`) et `ecrits` (`passe-fin`) ; la file jetait le premier et ne lisait pas le second. `alertes` lit `passe.ecrits` et `relecture.refusees` (un résumé qui porte `ecritsPasse` ou `refus` garde la priorité). Alertes non bloquantes : aucune décision ne change ; Signal peut maintenant afficher « N refus de la page » et moins d'alertes « différés ».
4. `build` répond pendant Écho. Une LECTURE qui échoue (`LECTURES_PANNEAU` : `view`, `build`, `cloud`, `journal-meta`, `dataset-meta`, `native-health`, `native-export-advice`, `brain-state`, `gcv1-shadow-state`, `gcv1-export-meta`) rend son erreur au panneau sans avis, sans sauvegarde, sans transition « erreur ». Un geste refusé reste noté comme avant. Les exports (`journal`, `dataset`, …) sont restés dans les gestes : liste volontairement courte.
5. Les deux relevés reçus avant `ready` sont rangés une fois le service worker prêt, seulement pour l'onglet choisi. Service worker prêt : inchangé.
6. `panel.js` expose `ArianePanel.vertsListe()` ; `src/ui5.js` prend le nombre dans `aControler` et écarte la ligne de renvoi. Les plages au-delà de 12 restent absentes du tiroir de Signal, comme dans le panneau (« dans l'export »).
8. Le service worker rend le mode effectif (`passeDifferesReglage:{mode,max}`, lu par `passeDiffReglage`, la fonction que la passe lit avant d'écrire) dans `choix-lot` et `choix-lot-etat`. Un seul module fabrique les textes (`passe2Textes`, `src/signal-rendu.js`) pour la case du panneau, l'avis après le clic et la feuille de réglages de Signal. Réglage livré : « (pose et valide jusqu'à 10 cuts en fin de lot) » ; « en ombre » seulement si la passe n'écrit pas. Aucun réglage ne change.
9. Après le `classify` d'une visite close, l'étiquette est recopiée dans `native.visits[].label` ; l'état n'est gardé que si elle a changé.

## Laissé à l'opérateur (défaut 1, rien de changé)
- **Vidage du cache des exports** avec un lot en ERROR (aujourd'hui refusé jusqu'au lot suivant). Choix A : compter ERROR comme terminé (`src/export-cache.js`, clôture de la mesure dans `src/perf-phase.js`) : le vidage devient possible sans geste, la mesure V1 du lot en erreur est close telle quelle. Choix B : rendre « Arrêter » visible pour un lot en ERROR (`panel.js`) : l'opérateur clôt lui-même le lot, puis vide.
- **Observateur** : la séance reste `lot:<id>` sans fin pour un lot en ERROR. Choix A : la finir à l'erreur, après la grâce : les observations suivantes ne sont plus rangées au nom du lot mort, les bilans de fin (clics hors vue, déplacement de vue) s'écrivent. Choix B : la garder jusqu'à un geste de l'opérateur : on continue de voir ce qu'ESV écrit après la panne, au prix du rangement actuel.
- Non touchés non plus, dits « sûrs » par le constat mais hors de la liste du ticket : `contexteAudit` (lectures de liste attribuées à la partie du lot en erreur) et le message de `refusCorrection` (« le lot est encore ouvert (ERROR) »).

## À savoir pour l'intégration
- `src/file-parties.js` est sous l'empreinte gelée de `tools/typage-ch075.cjs` (CH-075). Son code change au défaut 3 : la référence a été refaite sur le commit `a674e14` (commit séparé). Si l'intégration ne garde pas ce commit, `--origine` ne trouvera plus la base : refaire `base`, `source` et `ast` sur le commit du tronc.
- Quatre assertions d'essais existants épinglaient l'ancien état et ont été mises à jour : la forme exacte de la réponse `choix-lot` (`tests/choix-lot-grappe-sw.test.cjs`, `tests/choix-lot-clic-transmis-sw.test.cjs` : champ `passeDifferesReglage` en plus), le libellé en dur de `panel.html` (`tests/passe-differes-panneau.test.cjs`) et « Rattrapage (en ombre) » (`tests/signal-vocabulaire-orbite.test.cjs`).
- Parité de la relecture et garde de pose : aucun module de décision n'est dans le diff (`git diff claude/50-test17 --stat` : `background.js`, `panel.js`, `panel.html`, `src/native-session.js`, `src/file-parties.js`, `src/ui5.js`, `src/signal-rendu.js`, `src/relecture-pause.js`, `types/ch075.d.ts`, `tools/typage-ch075.cjs`, essais).

## Verify et maquette
En cours au moment de ce commit : les chiffres sont ajoutés au commit suivant.

# CH-086 — Étude : écritures après la validation en fond (piste 1 de CH-084)

**But** : sur chaque cut, laisser courir pendant la capture suivante les écritures qui suivent la validation (visite `putRecord`, `validation-observation`, `validation-accepted`, sauvegarde après `processed`), avec la preuve « stocké » obtenue avant la sauvegarde de l'intention de pose suivante. Les écritures d'avant une commande (intention de pose, `validation-intent`) restent attendues.

1. **Fenêtre** : elle va du retour de la commande de validation (`outcomeObserved`, navigation observée) jusqu'à la porte. Dans la fenêtre, `putRecord`, `event()` (`putEvent` puis sauvegarde) et `save()` partent dans le même ordre et avec le même contenu qu'aujourd'hui, mais le lot ne les attend pas. Trois garanties le permettent : `src/storage.js` découpe l'état à l'appel et passe les écritures une à une (`enFile`) ; IndexedDB ordonne ses transactions ; l'événement entre dans le journal en mémoire avant la sauvegarde qui le suit.
2. **Porte** : avant l'intention de pose (`apply`), l'intention de différé (PREPARED), l'intention de validation, et à toute sortie de `run()`. Toutes les écritures de la fenêtre doivent être confirmées dans `delaiMs` (2 s). Sur échec ou délai, une reprise : visites et événements de la fenêtre réécrits, puis l'état complet. Si la reprise échoue aussi : pause motivée `ECRITURE_NON_CONFIRMEE`, avant toute mutation de l'intention ; aucune commande, jamais de SKIP.
3. **Visites** : l'identifiant est retiré de `enBase` avant le `putRecord` non attendu. Toute sauvegarde concurrente garde donc la visite complète dans l'état tant qu'IndexedDB ne l'a pas confirmée.
4. **Rapprochement au démarrage** : l'état porte `fenetreEcritures` (identifiants des événements et des visites lancés). `init()` réécrit ceux que l'état porte, de façon idempotente (même clé), et consigne `ecritures-fond-reprises`.
5. **Arrêt du service worker dans la fenêtre** : l'état durable est l'un de ceux que le chemin d'avant pouvait laisser :
   - intention de validation → `reconcileRequired`, pause, rien de renvoyé ;
   - observation sans acceptation → `PAUSED_AFTER_STATE_MISSING` ;
   - acceptation → crédit sur l'identifiant de tentative ;
   - cut compté → reprise au cut suivant.
6. **Réglage** : `ecrituresApresValidation: {enFond: true, delaiMs: 2000}` (`src/settings.js`), allumé pour le lot d'essai. `background.js` le passe au moteur ; s'il est absent ou éteint, le moteur suit le chemin d'avant.
7. **Fichiers** : `src/engine.js` (interdit à l'exécutant) est livré en `chantiers/CH-086/engine.patch`. Aucun module de décision n'est touché.
8. **Non fait** : `gcv1-shadow-observed` en `put` sans sauvegarde (reprise après F5 non prouvée).

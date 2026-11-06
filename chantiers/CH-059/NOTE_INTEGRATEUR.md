# CH-059 — note à l'intégrateur : le patch du moteur

`chantiers/CH-059/engine.patch` (à appliquer avec `git apply`, vérifié applicable sur la tête de `chantier/CH-059`) touche **seulement `save()`** de `src/engine.js` :

- si le magasin déclare `copieALaSauvegarde === true` (le vrai `BananeStorage3`, `src/storage.js`, qui découpe l'état en morceaux de façon synchrone, avant toute attente), `save()` lui passe l'état vivant au lieu d'en faire une copie entière (`K.clone`) ;
- sinon (magasins d'essai `MemoryStore`, harnais), rien ne change : la copie d'avant.
- Aucune décision, aucun événement, aucun ordre d'écriture ne change ; la relecture au démarrage n'est pas touchée (le recollage est fait par `getState()` du magasin).

Pourquoi : sans le patch, la sauvegarde est déjà bornée en octets écrits (le magasin découpe la copie), mais la copie entière de l'état reste faite à chaque événement, et son coût suit la taille de l'état en mémoire. Mesures dans `chantiers/CH-059/rapport.md`.

Vérifié sur un arbre patché (tête de la branche + patch) :
- essais `ch059-etat-borne`, `ch059-morceaux`, `v5-sauvegarde`, `native-session`, `echo-4918`, `background`, `export-delta`, `vidage-capture-ouverte` : tous verts ;
- `tools/ch059-parite-export.cjs` (tronc contre arbre patché, 120 visites, redémarrage au milieu) : export et état en mémoire identiques ;
- `tools/ch059-retour-arriere.cjs` (vers `2bc1f56`) : pas de plantage, 95 visites relues dans l'ordre ;
- `tools/parite-relecture-sw.cjs` (tronc contre arbre patché) : relevés identiques.

À faire par l'intégrateur en appliquant le patch : ré-épingler le moteur comme en D-089 (`tests/pose-inchangee-4958.json`, essai « le moteur est celui de la baseline » de `tests/pose-lot-inchanges-4959.test.cjs`, `audit/v4.6.0-engine-baseline.json`), puis le `verify` de la version.

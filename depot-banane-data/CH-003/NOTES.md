# Détail par cut, CH-003

Transit vers `banane-data`. Rien ici n’est un livrable de code. Comptes, durées, millimètres, références de collection, de partie et de cut. Pas d’identifiant, pas de coordonnée, pas d’horodatage.

Commande, depuis la racine de `banane`, sur le dossier des volumes 1 de lots (journaux `ariane-journal-v4-…` seulement) :

```
node tools/perf-relecture-phases.cjs CHEMIN \
  --cuts depot-banane-data/CH-003/cuts.jsonl \
  --attentes depot-banane-data/CH-003/attentes-adaptateur.jsonl \
  --passes depot-banane-data/CH-003/passes.json
```

Population : 22 journaux de lots du 18 au 26 octobre 2026, branche `claude/execute-prompt-00-18ra5a` de `banane-data`. Les échos ne sont pas lus. 22 passes, toutes en mode « corriger ». 5 344 cuts à durées. Une passe (partie 13 du 19/10) n’a pas de `relecture-fin`.

## Fichiers

- `cuts.jsonl` — une ligne par cut relu qui porte des durées. 5 344 lignes. Colonnes : `collection`, `version` (champ du journal), `partie`, `cut`, `lancement` (1, puis 2 si la même collection et la même partie ont deux passes ; c’est le cas de la partie 0 du 20/10), `mode`, `issue`, `zone`, `role`, `action`, les sept phases en millisecondes (`attentePageMs`, `lectureNuageMs`, `recaptureMs`, `decisionMs`, `ecritureMs`, `validationMs`, `attenteAdaptateurMs`), `sourceAttentePage` et `sourceLecture` (`commandes` ou `repli-durees`), `residuMs`, `totalMs`, `points` (nombre de points de la première capture), puis les millimètres : `pireMm`, `ecartementMm`, `longGaucheMm`, `latGaucheMm`, `vertGaucheMm`, `longDroitMm`, `latDroitMm`, `vertDroitMm`, `hauteurGaucheMm`, `hauteurDroitMm`, `chaineCuts`, `captures`, `capturesVides`. Un champ absent du journal vaut `null`. 5 006 lignes ont un `pireMm`.
- `attentes-adaptateur.jsonl` — une ligne par attente `ADAPTER_BUSY`. 6 lignes, toutes sur le premier lancement de la partie 0 du 20/10, cut 226, essais 1 à 6 (250, 500, 1 000, 2 000, 4 000, 4 000 ms), `dansCut` faux : elles sont après le dernier cut journalisé de cette passe.
- `passes.json` — une entrée par passe, sans les cuts : collection, version, partie, mode, issue, corrigés, durée, pauses, trous, mur hors pauses, écart à 1,8 s, médiane de points. 22 entrées.

Les agrégats lus dans la fiche `fiches/VITESSE_RELECTURE_PAR_PHASE_2026-10-28.md` sortent de ces fichiers.

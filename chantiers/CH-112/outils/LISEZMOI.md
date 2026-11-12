# CH-112 : outils (hors ligne, lecture seule)

- `liste.cjs` : décode un instantané `ariane-liste-instantane-1` (rails en mètres, statut, drapeaux).
- `traits.cjs` : traits par cut posé (jointure + journal + liste) → CSV (numéros et mm).
- `regle-voie.cjs` : rejeu séquentiel du signe « voie des cuts sûrs » et bilan (`charger`, `rejouer`, `bilan`).
- `lots.cjs` : lots jugés rejoués ; chemins sous `CH112_DONNEES` (dossier local d'extraction de `banane-data`, jamais au dépôt).
- `grille.cjs` : grille de réglages par lot (11/11 contre les autres).

Réglage du rapport : `rejouer(d, { methode: 'profil1', seuil: 100, courbure: 2, ecart: 12, abstenuSur: false, marges: false, traites: false })`.
Jointures : `node tools/jointure-echo-orbite.cjs --echo <dossier Écho> --journal <journal> --partie N --visite-sans-action-bonne --sortie <json>`.

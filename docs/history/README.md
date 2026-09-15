# Historique Banane — zone d’audit Astra

Cette arborescence est volontairement séparée du runtime courant.

But : documenter ce qui existe, ce qui manque au dépôt GitHub et quelles pièces historiques pourront être archivées plus tard, sans modifier le code actif ni perturber le travail en cours sur `v4.6-engine-state-machine`.

Règles :

- cette branche `astra/history-audit` part exactement de `main` au commit `569c9a55d1cc8294fa5b1365d49856233db8ed33` ;
- aucun fichier runtime, test, audit existant, hash, baseline ou manifeste n’est modifié ;
- aucun export LiDAR massif ni document métier potentiellement sensible n’est importé automatiquement ;
- aucune archive historique n’est reconstituée à partir de souvenirs : seules les pièces retrouvées ou explicitement référencées sont inventoriées ;
- cette branche n’a pas vocation à être mergée pendant le chantier V4.6. Elle peut rester indépendante jusqu’à ce qu’un import historique soit validé.

Fichiers :

- `HISTORICAL_COMPLETENESS_AUDIT.md` : audit de complétude du dépôt courant ;
- `LEGACY_SOURCE_INDEX.md` : index des artefacts historiques retrouvés ou documentés ;
- `IMPORT_PLAN.md` : méthode d’archivage sans contaminer la racine active.

Date de l’audit : 15 septembre 2026.

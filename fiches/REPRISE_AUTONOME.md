# Protocole de reprise autonome (nuit du 15 au 16 octobre 2026 et suivantes)

Demande de Mic (D-124) : avancer sur tous les chantiers possibles pendant son absence et relancer automatiquement la session après chaque réinitialisation de sa fenêtre de 5 h. Ce fichier est relu à chaque réveil ; il remplace la mémoire de la conversation.

## À chaque réveil, dans l'ordre

1. **Programmer le réveil suivant d'abord** : `send_later` à maintenant + 5 h 05, avec le même message de réveil. Ainsi, si la limite tombe pendant le travail, la reprise est déjà assurée.
2. **Lire l'état** : `fiches/PLAN_5.0.md` (colonne État), fin de `DECISIONS.md`, `git fetch` et `git log` des branches `origin/claude/50-*` et `origin/claude/495-*` depuis le dernier réveil.
3. **Recueillir** les chantiers livrés : vérifier le rapport (porte de sortie, verify 0 échec, rien sous `src/engine.js`), les fusionner dans `claude/50-base` (fusion simple, essais ciblés), mettre à jour le plan (coût constaté, état), consigner une ligne dans `DECISIONS.md`.
4. **Relancer** un chantier mort à cause de la limite (agent sans rapport) depuis sa branche, avec le même brief.
5. **Lancer** les chantiers suivants du plan dont les entrées sont prêtes : un lourd et un léger au plus, briefs complets, niveau rapide par défaut (éclair pour le mécanique, fort seulement pour une relecture due), base `claude/50-base`.
6. **Ne pas dépasser 60 %** de la fenêtre ; garder 20 % pour un export de Mic s'il arrive.
7. **Écrire à Mic** un compte rendu de cinq lignes au plus en fin de réveil (ce qui est livré, ce qui tourne, ce qui attend de lui).

## Arrêt

- Mic écrit : le protocole s'arrête, on reprend en conversation.
- Deux réveils de suite sans rien à recueillir ni à lancer : ne plus programmer de réveil, le dire à Mic en une ligne.
- Jamais sans Mic : fusion dans `main`, étiquette, publication, activation d'une pose sur le terrain, modification de `src/engine.js`.

## Ce qui attend Mic (ne pas bloquer dessus)

- Numéros de cuts d'un ADV et d'un PN connus (Q3).
- Volumes de l'Écho partie 24 des tests 19/20 (Q5).
- Lot Orbite et Écho d'un second projet ESV (D-123).
- Exports de la séance 4.9.5 test 2.
- Séance 4.9.5 test 3 (paquet envoyé, D-127) et ses exports.

## À intégrer au prochain numéro de test

- Logo retenu par Mic (piste A « La voie ») : commit a426771 sur `claude/ux-variantes`. Prendre `icons/` (`git checkout a426771 -- icons/`), puis déclarer dans `manifest.json` `"icons": {"16":"icons/ariane-16.png","32":"icons/ariane-32.png","48":"icons/ariane-48.png","128":"icons/ariane-128.png"}` et la même liste sous `action.default_icon`. Fait : intégré à la 4.9.5 test 3 (D-127).

## Prochain réveil (après D-129)

- Lourd : **P1 plafond de convention à 8 mm** (`claude/50-p1-convention` depuis `claude/50-base`) : `src/placement-convention.js` seulement (jamais `src/engine.js`), décalage plafonné, reste consigné ; essais ; rejeu des quatre lots au banc (`fiches/P0_MESURES.md`) sans régression ; relecteur indépendant. Rien n'est activé au terrain sans Mic.
- Léger : corriger AUDIT_SUPER_CERVEAU § 1 avec les chiffres de P0 (a).

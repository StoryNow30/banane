# CH-NNN : titre en une ligne

**Exécutant :** cursor | glm | agent. **Branche :** `chantier/CH-NNN` partie de `claude/50-test17`. **Coût prévu :** durée et nombre de passages.

## But
Une phrase mesurable : ce qui est vrai à la fin et ne l'était pas au début.

## Ce qui est livré
1. Fichiers créés ou modifiés, nommés.
2. Essais : lesquels, rouges d'abord.
3. `chantiers/CH-NNN.rapport.md` : fait, pas fait, mesures (une demi-page).

## Interdits
- La liste de `CLAUDE.md`, plus ce qui est propre au ticket.

## Critère de fin
Les commandes qui doivent rendre 0, les essais qui doivent être verts, la branche poussée, le `rapport` posté sur le hub (`node tools/hub.cjs dire --chantier CH-NNN --de <toi> --type rapport --fichier chantiers/CH-NNN.rapport.md`).

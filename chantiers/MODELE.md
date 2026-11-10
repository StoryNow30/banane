# CH-NNN : titre en une ligne

**Exécutant :** agent (une session Claude fille, D-306). **Branche :** `chantier/CH-NNN` partie de `claude/50-test17`. **Coût prévu :** durée et nombre de passages.

## But
Une phrase mesurable : ce qui est vrai à la fin et ne l'était pas au début.

## Ce qui est livré
1. Fichiers créés ou modifiés, nommés.
2. Essais : lesquels, rouges d'abord.
3. `chantiers/CH-NNN/rapport.md` : fait, pas fait, mesures (une demi-page). Un changement d'un fichier protégé est livré en `chantiers/CH-NNN/<fichier>.patch` (l'intégrateur l'applique).

## Interdits
- La liste de `CLAUDE.md`, plus ce qui est propre au ticket.

## Critère de fin
Les commandes qui doivent rendre 0, les essais qui doivent être verts, la branche poussée, puis un `send_message` à la mère (`@parent`) avec l'état précis (PRÊT, ce qui est livré et mesuré, ce qui n'est pas fait). S'il existe une pull request pour le chantier, le `rapport` y est aussi posté (`node tools/hub.cjs dire --chantier CH-NNN --de <toi> --type rapport --fichier chantiers/CH-NNN/rapport.md`).
